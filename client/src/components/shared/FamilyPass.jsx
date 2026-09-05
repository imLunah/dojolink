import { useEffect, useRef } from 'react';
import Logo from '../ui/Logo';
import { BELTS } from '../../utils/beltConfig';

// A family's membership card, for the parent portal's onboarding. Landscape,
// like a card that lives in a wallet rather than on a lanyard: the staff get
// an ID badge because they work here, a family gets a pass because they
// belong here. Same physics as StaffBadge (drag to spin, throw it and it
// keeps momentum, leave it and it floats, `side` turns it over, a tap turns
// it over too) with a different object on the stage.
//
// The front is navy: the parent's name, the center, and one belt stripe along
// the foot per ninja in their current belt colour. The back is white: the
// ninjas by name and age with a swatch in their belt colour, the center code
// set like a card number, then the parent as printed during onboarding. Faces are inline hex on purpose (a printed object, identical in
// both themes; `.dark .bg-white` would turn a painted face slate mid-spin),
// and rotation is written straight to the node from one rAF loop.

const CARD_W = 420;
const CARD_H = 265;
const NAVY = '#1a2e4a';
const ACCENT = '#38a1ff';

const FACE = {
  position: 'absolute',
  inset: 0,
  borderRadius: 18,
  backfaceVisibility: 'hidden',
  overflow: 'hidden',
  boxShadow: '0 30px 60px -20px rgba(10, 20, 40, 0.35)',
  display: 'flex',
  flexDirection: 'column',
};

const SHEEN = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  background: 'linear-gradient(105deg, transparent 42%, rgba(255,255,255,0.22) 50%, transparent 58%)',
  backgroundSize: '320% 100%',
  backgroundPosition: 'var(--shx, 50%) 0',
};

const BELT_COLOR = Object.fromEntries(BELTS.map((b) => [b.name, b.color]));

// ninjas: [{ name, age, belt }]. `parentName` is the name as typed; empty
// prints "Your name" while the parent is still on the name step.
export default function FamilyPass({ parentName, relationship, phone, center, centerCode, ninjas = [], side = 'front', scale = 1, className = '' }) {
  const stageRef = useRef(null);
  const cardRef = useRef(null);
  const m = useRef({ rx: -6, ry: -18, tRx: -6, tRy: -18, vx: 0, dragging: false, px: 0, py: 0, lastTouch: 0, side: 'front', downX: 0, downY: 0, downT: 0, moved: 0 }).current;

  useEffect(() => {
    if (side !== m.side) {
      m.side = side;
      m.tRy += side === 'back' ? 180 : -180;
      m.lastTouch = performance.now();
    }
  }, [side]);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf;
    const frame = (t) => {
      const idle = !m.dragging && performance.now() - m.lastTouch > 2600;
      let sway = 0;
      let bob = 0;
      if (idle && !reduced) {
        sway = Math.sin(t / 1900) * 6;
        bob = Math.sin(t / 1450) * 5;
      }
      m.ry += (m.tRy - m.ry) * 0.09;
      m.rx += (m.tRx - m.rx) * 0.09;
      if (cardRef.current) {
        cardRef.current.style.transform = `translateY(${bob}px) rotateX(${m.rx}deg) rotateY(${m.ry + sway}deg)`;
        cardRef.current.style.setProperty('--shx', `${50 - Math.sin(((m.ry + sway) * Math.PI) / 180) * 65}%`);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  const onPointerDown = (e) => {
    m.dragging = true;
    m.vx = 0;
    m.px = e.clientX;
    m.py = e.clientY;
    m.downX = e.clientX;
    m.downY = e.clientY;
    m.downT = performance.now();
    m.moved = 0;
    m.lastTouch = performance.now();
    stageRef.current?.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!m.dragging) return;
    const dx = e.clientX - m.px;
    const dy = e.clientY - m.py;
    m.px = e.clientX;
    m.py = e.clientY;
    m.tRy += dx * 0.45;
    m.vx = dx;
    m.tRx = Math.max(-42, Math.min(42, m.tRx - dy * 0.3));
    m.moved = Math.max(m.moved, Math.hypot(e.clientX - m.downX, e.clientY - m.downY));
    m.lastTouch = performance.now();
  };
  const onPointerUp = () => {
    if (!m.dragging) return;
    m.dragging = false;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced) m.tRy += m.vx * 9;
    m.lastTouch = performance.now();
    // A tap turns the card over: the ninjas live on the back and not
    // everyone will think to drag.
    if (m.moved < 8 && performance.now() - m.downT < 600) {
      m.side = m.side === 'back' ? 'front' : 'back';
      m.tRy += m.side === 'back' ? 180 : -180;
    }
  };

  const shownName = (parentName || '').trim();
  const stripes = ninjas.length ? ninjas : [{ name: '', belt: null }];

  return (
    <div
      ref={stageRef}
      className={`relative select-none ${className}`}
      style={{
        width: CARD_W * scale + 48,
        height: CARD_H * scale + 56,
        perspective: 1150,
        touchAction: 'none',
        cursor: 'grab',
        display: 'grid',
        placeItems: 'center',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      role="img"
      aria-label={`${shownName || 'Your'} family pass${center ? ` for Code Ninjas ${center}` : ''}`}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', bottom: 6, width: CARD_W * scale * 0.78, height: 24 * scale + 8,
          borderRadius: '50%', background: 'rgba(10,18,35,0.18)', filter: 'blur(12px)',
        }}
      />
      <div style={{ width: CARD_W * scale, height: CARD_H * scale, transformStyle: 'preserve-3d' }}>
        <div style={{ width: CARD_W, height: CARD_H, transform: `scale(${scale})`, transformOrigin: 'top left', transformStyle: 'preserve-3d' }}>
          <div ref={cardRef} style={{ position: 'relative', width: CARD_W, height: CARD_H, transformStyle: 'preserve-3d', willChange: 'transform' }}>

            {/* ── front ── */}
            <div style={{ ...FACE, transform: 'translateZ(2.5px)', background: `linear-gradient(135deg, ${NAVY} 0%, #16253d 55%, #0f1a2e 100%)`, color: '#ffffff' }}>
              {/* The mark, large and faint, off the right edge. Faded as an
                  element: its paths overlap and a translucent colour would
                  double up where they cross. */}
              <div aria-hidden="true" style={{ position: 'absolute', right: -54, top: -30, opacity: 0.1, pointerEvents: 'none' }}>
                <span style={{ color: '#ffffff', display: 'inline-flex' }}><Logo variant="mark" className="h-[300px]" /></span>
              </div>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, left: 0, width: '48%', height: '100%', pointerEvents: 'none',
                  backgroundImage: `radial-gradient(circle, ${ACCENT} 1.6px, transparent 2.1px)`,
                  backgroundSize: '14px 14px', opacity: 0.12,
                  WebkitMaskImage: 'radial-gradient(120% 110% at 0% 100%, black 20%, transparent 70%)',
                  maskImage: 'radial-gradient(120% 110% at 0% 100%, black 20%, transparent 70%)',
                }}
              />

              <div style={{ padding: '22px 26px 0' }}>
                <span style={{ color: '#ffffff', display: 'inline-flex' }}><Logo variant="wordmark" accent={ACCENT} className="h-6" /></span>
              </div>

              <div style={{ padding: '0 26px', marginTop: 'auto', marginBottom: 22 }}>
                <div className="font-ninja font-extrabold uppercase" style={{ fontSize: 11, letterSpacing: '0.24em', color: '#8a9bb8' }}>Parent</div>
                <div className="font-ninja font-black" style={{ fontSize: 34, lineHeight: 1.05, letterSpacing: '-0.01em', color: shownName ? '#ffffff' : 'rgba(255,255,255,0.35)', overflowWrap: 'anywhere' }}>
                  {shownName || 'Your name'}
                </div>
                {center && (
                  <div className="font-ninja font-bold" style={{ fontSize: 13, color: '#8a9bb8', marginTop: 8 }}>
                    Code Ninjas {center}
                  </div>
                )}
              </div>

              {/* One stripe per ninja, in their belt colour. */}
              <div aria-hidden="true" style={{ display: 'flex', height: 12, flexShrink: 0 }}>
                {stripes.map((n, i) => (
                  <div key={`${n.name}-${i}`} style={{ flex: 1, background: BELT_COLOR[n.belt] || ACCENT, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }} />
                ))}
              </div>
              <div aria-hidden="true" style={SHEEN} />
            </div>

            {/* ── back ── */}
            <div style={{ ...FACE, transform: 'rotateY(180deg) translateZ(2.5px)', background: '#ffffff', color: NAVY }}>
              <div
                aria-hidden="true"
                style={{
                  position: 'absolute', top: 0, right: 0, width: '50%', height: '60%', pointerEvents: 'none',
                  backgroundImage: 'radial-gradient(circle, #006add 2.1px, transparent 2.6px)',
                  backgroundSize: '15px 15px', opacity: 0.12,
                  WebkitMaskImage: 'radial-gradient(110% 110% at 100% 0%, black 30%, transparent 72%)',
                  maskImage: 'radial-gradient(110% 110% at 100% 0%, black 30%, transparent 72%)',
                }}
              />
              {/* The names, with no belt swatch in front of them. A 12px chip
                  beside each one was a second, quieter way of saying what the
                  stripes along the foot of the front already say in full
                  width, and two ninjas in neighbouring belts put two little
                  squares down the edge of the list that read as bullet points
                  somebody had coloured in. */}
              <div className="flex flex-col flex-1" style={{ padding: '20px 26px 18px' }}>
                <div className="font-ninja font-extrabold uppercase" style={{ fontSize: 11, letterSpacing: '0.24em', color: '#8a9bb8' }}>
                  {ninjas.length === 1 ? 'Ninja' : 'Ninjas'}
                </div>
                <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ninjas.length === 0 && <span className="font-ninja font-bold" style={{ fontSize: 15, color: '#8a9bb8' }}>No ninjas linked yet</span>}
                  {ninjas.slice(0, 4).map((n, i) => (
                    <div key={`${n.name}-${i}`} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <b className="font-ninja font-extrabold" style={{ fontSize: 16, color: NAVY, overflowWrap: 'anywhere' }}>{n.name}</b>
                      {n.age != null && (
                        <span className="font-ninja font-bold" style={{ fontSize: 12.5, color: '#506690', whiteSpace: 'nowrap' }}>
                          Age {n.age}
                        </span>
                      )}
                    </div>
                  ))}
                  {ninjas.length > 4 && <span className="font-ninja font-bold" style={{ fontSize: 12, color: '#8a9bb8' }}>and {ninjas.length - 4} more</span>}
                </div>

                {/* The center code, set like the number on a bank card: wide,
                    embossed, the thing a parent reads off the card to sign in. */}
                {centerCode && (
                  <div style={{ marginTop: 'auto', marginBottom: 14 }}>
                    <div className="font-ninja font-extrabold uppercase" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#8a9bb8' }}>Center code</div>
                    <div
                      className="font-ninja font-black uppercase"
                      style={{
                        fontSize: 26, letterSpacing: '0.28em', lineHeight: 1.2, marginTop: 2,
                        color: '#3a537a',
                        textShadow: '0 1px 0 rgba(255,255,255,0.95), 0 -1px 0 rgba(20,35,60,0.22), 0 2px 2px rgba(20,35,60,0.08)',
                      }}
                    >
                      {centerCode}
                    </div>
                  </div>
                )}

                <div style={{ marginTop: centerCode ? 0 : 'auto', paddingTop: 12, borderTop: '1px solid #e6ebf2', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="font-ninja font-extrabold uppercase" style={{ fontSize: 10, letterSpacing: '0.22em', color: '#8a9bb8' }}>Parent</div>
                    <b className="block font-ninja font-extrabold" style={{ fontSize: 16, color: (parentName || '').trim() ? NAVY : '#8a9bb8', overflowWrap: 'anywhere' }}>
                      {(parentName || '').trim() || 'Your name'}
                    </b>
                    <span className="font-ninja font-bold" style={{ fontSize: 12.5, color: '#506690' }}>
                      {[relationship, (phone || '').trim()].filter(Boolean).join(' · ')}
                    </span>
                  </div>
                  <div className="font-ninja text-right" style={{ fontSize: 11, color: '#8a9bb8', lineHeight: 1.6, flexShrink: 0 }}>
                    {center ? `Code Ninjas ${center}` : 'Code Ninjas'}<br />
                    <span className="font-extrabold" style={{ color: ACCENT }}>www.dojolink.app</span>
                  </div>
                </div>
              </div>
              <div aria-hidden="true" style={SHEEN} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
