import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import FloatingPanel from '../ui/FloatingPanel';
import useIsDesktop from '../../lib/useIsDesktop';
import { CARD } from '../../lib/surfaces';
import { CakeIcon as Cake, ChevronLeftIcon as ChevL, ChevronRightIcon as ChevR, XIcon } from 'lucide-react';
import useRefuseNudge from '../../lib/useRefuseNudge';



// The type list and its colors live in lib/eventTypes.js, mirrored by the server.
import { EVENT_TYPES, eventType, colorFor } from '../../lib/eventTypes';

// Birthdays sit on the same grid as events but must not read as one, so they get
// a tinted chip + cake glyph instead of a solid bar. The ink comes from a custom
// property rather than a literal: one pink cannot clear 4.5:1 against both a near
// white tint and the same tint over a dark card, so index.css supplies a darker
// pink in light and a lighter one in dark. A `bg-*` utility could not do this —
// the `.dark` overrides never reach an inline style.
const BIRTHDAY_COLOR = 'var(--birthday-ink)';
const BIRTHDAY_TINT = 'rgba(219, 39, 119, 0.14)';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MAX_CHIPS = 3;

const pad = (n) => String(n).padStart(2, '0');
const firstName = (name) => (name || '').trim().split(/\s+/)[0] || name;
const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayIso = () => { const n = new Date(); return iso(n.getFullYear(), n.getMonth(), n.getDate()); };
// Built from the string parts — parsing the ISO date would shift it a day in
// timezones behind UTC.
const longDate = (dIso) => {
  const [y, m, d] = (dIso || '').split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};



/* ---------------------------------------------------------------- form --- */

function EventForm({ initial, canDelete, onSave, onDelete, onCancel, busy, dirtyRef }) {
  const [title, setTitle] = useState(initial.title || '');
  const [date, setDate] = useState(initial.event_date || todayIso());
  const [time, setTime] = useState(initial.event_time || '');
  // A new event starts unpicked so nothing lands in Other by default. An old
  // event opens on the type its stored text folds to.
  const [type, setType] = useState(initial.id ? eventType(initial.type).label : '');
  const [description, setDescription] = useState(initial.description || '');
  const [confirmDel, setConfirmDel] = useState(false);

  const canSave = title.trim() && date && type;
  // Read by the sheet around the form, which refuses a stray dismissal while
  // anything here differs from what it opened with.
  if (dirtyRef) {
    dirtyRef.current = title !== (initial.title || '')
      || description !== (initial.description || '')
      || time !== (initial.event_time || '')
      || date !== (initial.event_date || todayIso())
      || (!!type && type !== (initial.id ? eventType(initial.type).label : ''));
  }
  const field = 'w-full rounded-lg border border-ninja-border bg-white px-3 py-2 font-ninja text-sm text-ninja-navy placeholder:text-ninja-muted focus:outline-none focus:border-ninja-blue transition-colors';

  return (
    <div className="space-y-4">
      <div>
        <label className="block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5">Event</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200}
          placeholder="e.g. Robotics game build" className={field} autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5">Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
        </div>
        <div>
          <label className="block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5">Time <span className="opacity-60 normal-case font-semibold">(optional)</span></label>
          <input value={time} onChange={(e) => setTime(e.target.value)} maxLength={40}
            placeholder="e.g. 3:00 PM" className={field} />
        </div>
      </div>

      <div>
        <label className="block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5">Type</label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: type ? colorFor(type) : 'transparent' }} />
          <select value={type} onChange={(e) => setType(e.target.value)} className={`${field} pl-8`}>
            <option value="" disabled>Choose a type</option>
            {EVENT_TYPES.map((t) => <option key={t.label} value={t.label}>{t.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block font-ninja text-xs font-bold uppercase tracking-wide text-ninja-muted mb-1.5">Notes <span className="opacity-60 normal-case font-semibold">(optional)</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} rows={3}
          placeholder="Anything instructors should know" className={`${field} resize-none`} />
      </div>

      <div className="flex items-center justify-between pt-1">
        {canDelete ? (
          confirmDel ? (
            <div className="flex items-center gap-2">
              <button onClick={onDelete} disabled={busy}
                className="font-ninja text-sm font-bold px-3 py-2 rounded-lg bg-ninja-red text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-95">Delete</button>
              <button onClick={() => setConfirmDel(false)} className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy rounded">Keep</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDel(true)} className="font-ninja text-sm font-bold text-ninja-red hover:underline rounded">Delete</button>
          )
        ) : <span />}

        <div className="flex items-center gap-2">
          <button onClick={onCancel} className="font-ninja text-sm font-bold text-ninja-muted hover:text-ninja-navy px-2 py-2 rounded">Cancel</button>
          <button
            onClick={() => onSave({ title, event_date: date, event_time: time, type, description })}
            disabled={busy || !canSave}
            className="font-ninja text-sm font-bold px-4 py-2 rounded-lg bg-ninja-blue text-white transition-transform duration-150 ease-[var(--ease-out)] active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100">
            {initial.id ? 'Save' : 'Add event'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- sheet --- */

// The event form opens inside the calendar card, over the month, rather than
// as a panel docked to the edge of the window. The month is what the event
// belongs to, so the form stays on it, and the window edge has nothing to do
// with a day on a calendar.
//
// It grows out of whatever was pressed: the day cell, the chip, or the
// "+ New event" link. `origin` is that point measured from the centre of the
// card, and the sheet is centred in the card, so starting the sheet translated
// by `origin` and scaled down puts it on top of the thing that opened it. It
// arrives opaque from the first frame and scales and travels only; the words
// inside fade in behind it, since a surface fading in reads as a ghost and text
// fading in costs nothing. Leaving is quicker and goes back where it came from.
// A spring with no bounce, because nothing threw it.
const SHEET_ENTER = { type: 'spring', bounce: 0, duration: 0.44 };
const SHEET_LEAVE = { duration: 0.2, ease: [0.4, 0, 1, 1] };
const SHEET_FROM = 0.2;

function EventSheet({ open, origin, title, onClose, dirtyRef, children }) {
  const reduce = useReducedMotion();
  const sheetRef = useRef(null);
  const { nudging, hinting, refuse } = useRefuseNudge();

  // A stray press or Escape closes an untouched form and refuses one holding
  // typed words. Its own buttons always close it.
  const dismiss = useRef(null);
  dismiss.current = () => { if (dirtyRef.current) refuse(); else onClose(); };

  useEffect(() => {
    if (!open) return;
    const returnTo = document.activeElement;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); dismiss.current(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (returnTo && typeof returnTo.focus === 'function' && document.contains(returnTo)) returnTo.focus();
    };
  }, [open]);

  const o = origin || { x: 0, y: 0 };
  const away = reduce
    ? { opacity: 0 }
    : { x: o.x, y: o.y, scale: SHEET_FROM };

  return (
    <AnimatePresence>
      {open && (
        <div key="sheet" className="absolute inset-0 z-20">
          {/* Dims the month so the sheet reads as on top of it. Tinted from the
              page token rather than white at an opacity, which would escape the
              dark overrides and stay light. */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0 rounded-2xl bg-ninja-bg/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: SHEET_LEAVE }}
            transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
            onClick={() => dismiss.current()}
          />
          <div className="absolute inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none">
            <motion.div
              ref={sheetRef}
              role="dialog"
              aria-modal="false"
              aria-label={title}
              initial={away}
              animate={reduce ? { opacity: 1 } : { x: 0, y: 0, scale: 1 }}
              exit={reduce
                ? { opacity: 0, transition: { duration: 0.15 } }
                : { ...away, opacity: 0, transition: SHEET_LEAVE }}
              transition={reduce ? { duration: 0.2 } : SHEET_ENTER}
              className="pointer-events-auto w-full max-w-[26rem] max-h-full flex"
            >
              <div className={`${CARD} relative w-full flex flex-col min-h-0 shadow-xl ${nudging ? 'panel-refuse' : ''}`}>
                <div className="flex-shrink-0 flex items-center justify-between gap-3 px-5 pt-4 pb-2">
                  <h2 className="font-ninja text-lg font-bold text-ninja-navy truncate tracking-[-0.01em]">{title}</h2>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="w-8 h-8 -mr-1.5 rounded-full flex items-center justify-center text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-colors flex-shrink-0 active:scale-95"
                  >
                    <XIcon size={17} strokeWidth={2.25} />
                  </button>
                </div>
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: reduce ? 0 : 0.08, ease: [0.23, 1, 0.32, 1] }}
                  className="flex-1 min-h-0 overflow-y-auto px-5 pb-5 pt-1"
                >
                  {children}
                </motion.div>

                <AnimatePresence>
                  {hinting && (
                    <motion.p
                      role="status"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                      className="absolute inset-x-3 bottom-3 rounded-xl bg-ninja-navy text-ninja-bg px-3 py-2 font-ninja text-xs font-bold text-center shadow-lg"
                    >
                      There are unsaved changes.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------ calendar --- */

// `bare` drops the card surface and the title row, for callers that host the
// calendar inside a dialog that already supplies both.
export default function EventCalendar({ canManage = true, bare = false }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [birthdays, setBirthdays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cursor, setCursor] = useState(() => { const n = new Date(); return { y: n.getFullYear(), m: n.getMonth() }; });
  const [modal, setModal] = useState(null); // { event } — add uses a bare {event_date}
  const isDesktop = useIsDesktop();
  const [dayView, setDayView] = useState(null); // ISO date whose full list is open
  const [busy, setBusy] = useState(false);
  const cardRef = useRef(null);
  const dirtyRef = useRef(false);
  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get('/events').catch(() => []),
      api.get('/students/birthdays').catch(() => []),
    ]).then(([evs, bdays]) => {
      if (!alive) return;
      setEvents(evs || []);
      setBirthdays(bdays || []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [user?.activeLocation?.id]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const e of events) {
      const arr = map.get(e.event_date) || [];
      arr.push(e);
      map.set(e.event_date, arr);
    }
    return map;
  }, [events]);

  // Keyed month-day (not a full date) so a birthday repeats every year.
  const birthdaysByDay = useMemo(() => {
    const map = new Map();
    for (const b of birthdays) {
      if (!b.month || !b.day) continue;
      const key = `${pad(b.month)}-${pad(b.day)}`;
      const arr = map.get(key) || [];
      arr.push(b);
      map.set(key, arr);
    }
    return map;
  }, [birthdays]);

  const { y, m } = cursor;
  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const cells = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const tIso = todayIso();

  const shift = (delta) => setCursor(({ y, m }) => {
    const d = new Date(y, m + delta, 1);
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const goToday = () => { const n = new Date(); setCursor({ y: n.getFullYear(), m: n.getMonth() }); };

  // Where the pressed control sits, measured from the centre of the card, so
  // the sheet can grow out of it. No press (opened from the day list) means it
  // grows from the middle.
  const originOf = (e) => {
    const card = cardRef.current?.getBoundingClientRect();
    const from = e?.currentTarget?.getBoundingClientRect?.();
    if (!card || !from) return null;
    return {
      x: from.left + from.width / 2 - (card.left + card.width / 2),
      y: from.top + from.height / 2 - (card.top + card.height / 2),
    };
  };

  const openSheet = (event, e) => {
    dirtyRef.current = false;
    setModal({ event, origin: originOf(e) });
  };
  const openAdd = (dateIso, e) => { if (canManage) openSheet({ event_date: dateIso }, e); };
  // Read-only viewers get no editor: the server rejects their writes, so
  // opening the form would be a dead end.
  const openEdit = (ev, e) => { if (canManage) openSheet(ev, e); };

  const save = async (payload) => {
    setBusy(true);
    try {
      const editing = modal?.event?.id;
      if (editing) {
        const updated = await api.patch(`/events/${editing}`, payload);
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
      } else {
        const created = await api.post('/events', payload);
        setEvents((prev) => [...prev, created]);
      }
      setModal(null);
    } catch { /* keep the form open */ } finally { setBusy(false); }
  };

  const remove = async () => {
    const id = modal?.event?.id;
    if (!id) return;
    setBusy(true);
    try {
      await api.delete(`/events/${id}`);
      setEvents((prev) => prev.filter((e) => e.id !== id));
      setModal(null);
    } catch { /* ignore */ } finally { setBusy(false); }
  };

  const Shell = isDesktop ? FloatingPanel : Modal;
  const dayShell = isDesktop ? { width: 'max-w-[24rem]' } : { width: 'max-w-sm' };

  return (
    <div ref={cardRef} className={`relative ${bare ? '' : `${CARD} p-5`}`}>
      {!bare && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-ninja font-bold text-ninja-navy text-lg">Calendar</h2>
            <p className="font-ninja text-xs text-ninja-muted">Events and ninja birthdays at this center</p>
          </div>
          {canManage && (
            <button type="button" onClick={(e) => openAdd(tIso, e)}
              className="flex-shrink-0 font-ninja text-sm font-bold text-ninja-blue hover:underline rounded">+ New event</button>
          )}
        </div>
      )}
      {bare && canManage && (
        <div className="flex justify-end mb-3">
          <button type="button" onClick={(e) => openAdd(tIso, e)}
            className="font-ninja text-sm font-bold text-ninja-blue hover:underline rounded">+ New event</button>
        </div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-ninja font-bold text-ninja-navy">{MONTHS[m]} {y}</h3>
        <div className="flex items-center gap-1">
          <button type="button" onClick={goToday} className="font-ninja text-xs font-bold text-ninja-muted hover:text-ninja-navy px-2.5 py-1 rounded-full hover:bg-ninja-bg transition-colors">Today</button>
          <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="w-8 h-8 flex items-center justify-center rounded-full text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-90"><ChevL className="w-4 h-4" /></button>
          <button type="button" onClick={() => shift(1)} aria-label="Next month" className="w-8 h-8 flex items-center justify-center rounded-full text-ninja-muted hover:text-ninja-navy hover:bg-ninja-bg transition-[transform,background-color,color] duration-150 ease-[var(--ease-out)] active:scale-90"><ChevR className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 mb-1">
        {WEEKDAYS.map((d) => (
          <span key={d} className="text-center font-ninja text-[11px] font-bold uppercase tracking-wide text-ninja-muted py-1">{d}</span>
        ))}
      </div>

      {/* Day grid. The month structure is known immediately; only the chips
          are waiting on the network, so the grid stays live while it loads. */}
      <div className="grid grid-cols-7 gap-1" aria-busy={loading}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`b${i}`} />;
          const dIso = iso(y, m, day);
          const dayEvents = byDay.get(dIso) || [];
          const dayBirthdays = birthdaysByDay.get(`${pad(m + 1)}-${pad(day)}`) || [];
          const isToday = dIso === tIso;
          // Events come first; both kinds share one 3-slot budget so a busy day
          // never blows the row height out.
          const shownEvents = dayEvents.slice(0, MAX_CHIPS);
          const shownBirthdays = dayBirthdays.slice(0, Math.max(0, MAX_CHIPS - shownEvents.length));
          const hidden = (dayEvents.length - shownEvents.length) + (dayBirthdays.length - shownBirthdays.length);
          return (
            // The cell used to be the <button>, with the chips as role="button"
            // spans inside it — interactive inside interactive, which is invalid
            // and what a screen reader trips over. The cell is a plain box now,
            // and "add an event here" is a real button stretched behind the
            // chips. Siblings, so a chip click never reaches the one underneath.
            <div
              key={dIso}
              className={`group relative min-h-[68px] rounded-lg border p-1.5 text-left align-top transition-colors ${
                isToday ? 'border-ninja-blue bg-ninja-blue/5' : 'border-transparent hover:border-ninja-border'
              } ${canManage ? 'hover:bg-ninja-bg' : ''}`}
            >
              {canManage && (
                <button
                  type="button"
                  onClick={(e) => openAdd(dIso, e)}
                  aria-label={`Add an event on ${longDate(dIso)}`}
                  className="absolute inset-0 w-full h-full rounded-lg cursor-pointer"
                />
              )}
              <span className={`relative pointer-events-none font-ninja text-xs font-bold tabular-nums ${isToday ? 'text-ninja-blue' : 'text-ninja-navy'}`}>{day}</span>
              <div className="relative mt-1 space-y-0.5 pointer-events-none">
                {shownEvents.map((ev) => (
                  canManage ? (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={(e) => openEdit(ev, e)}
                      title={ev.title}
                      className="pointer-events-auto block w-full truncate rounded px-1 py-0.5 text-left font-ninja text-[10px] font-semibold text-white leading-tight"
                      style={{ backgroundColor: colorFor(ev.type) }}
                    >
                      {ev.title}
                    </button>
                  ) : (
                    <span
                      key={ev.id}
                      title={ev.title}
                      className="block truncate rounded px-1 py-0.5 font-ninja text-[10px] font-semibold text-white leading-tight"
                      style={{ backgroundColor: colorFor(ev.type) }}
                    >
                      {ev.title}
                    </span>
                  )
                ))}
                {shownBirthdays.map((b) => (
                  <button
                    key={`b${b.id}`}
                    type="button"
                    onClick={() => navigate(`/manager/students/${b.id}`)}
                    title={`${b.full_name}'s birthday`}
                    className="pointer-events-auto flex w-full items-center gap-1 rounded px-1 py-0.5 font-ninja text-[10px] font-semibold leading-tight"
                    style={{ backgroundColor: BIRTHDAY_TINT, color: BIRTHDAY_COLOR }}
                  >
                    <Cake className="w-2.5 h-2.5 flex-shrink-0" />
                    <span className="truncate">{firstName(b.full_name)}</span>
                  </button>
                ))}
                {hidden > 0 && (
                  <button
                    type="button"
                    onClick={() => setDayView(dIso)}
                    className="pointer-events-auto block font-ninja text-[10px] font-bold text-ninja-muted hover:text-ninja-navy px-1 rounded"
                  >
                    +{hidden} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* A day's full list opens beside the calendar rather than over it.
          Pressing anywhere off the panel closes it. Below the desktop line
          there is no beside, so it falls back to the full-screen dialog. The
          event form is different: it opens inside the card (EventSheet). */}
      <Shell isOpen={!!dayView} onClose={() => setDayView(null)} title={dayView ? longDate(dayView) : ''} {...dayShell}>
        <div className="space-y-1.5">
          {(byDay.get(dayView) || []).map((ev) => (
            <button
              key={ev.id}
              type="button"
              disabled={!canManage}
              onClick={() => { setDayView(null); openEdit(ev); }}
              className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors ${canManage ? 'hover:bg-ninja-bg' : 'cursor-default'}`}
            >
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colorFor(ev.type) }} />
              <span className="font-ninja text-sm text-ninja-navy truncate flex-1">{ev.title}</span>
              {ev.event_time && <span className="font-ninja text-xs font-bold text-ninja-muted flex-shrink-0">{ev.event_time}</span>}
            </button>
          ))}
          {(dayView ? birthdaysByDay.get(dayView.slice(5)) || [] : []).map((b) => (
            <button
              key={`b${b.id}`}
              type="button"
              onClick={() => { setDayView(null); navigate(`/manager/students/${b.id}`); }}
              className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-left hover:bg-ninja-bg transition-colors"
            >
              <Cake className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BIRTHDAY_COLOR }} />
              <span className="font-ninja text-sm text-ninja-navy truncate flex-1">{b.full_name}</span>
              <span className="font-ninja text-xs font-bold text-ninja-muted flex-shrink-0">Birthday</span>
            </button>
          ))}
        </div>
      </Shell>

      <EventSheet
        open={!!modal}
        origin={modal?.origin}
        title={modal?.event?.id ? 'Edit event' : 'New event'}
        onClose={() => setModal(null)}
        dirtyRef={dirtyRef}
      >
        {modal && (
          <EventForm
            initial={modal.event}
            canDelete={canManage && !!modal.event.id}
            onSave={save}
            onDelete={remove}
            onCancel={() => setModal(null)}
            busy={busy}
            dirtyRef={dirtyRef}
          />
        )}
      </EventSheet>
    </div>
  );
}
