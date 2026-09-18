import { useLayoutEffect, useRef, useState } from 'react';
import useIsDesktop from './useIsDesktop';

// Pull a block out to the edges of the staff layout's <main>: flush with the
// top of the page and with both sides of the content region, the way the
// parent portal's page hero sits.
//
// The parent portal does this with container units, because its <main> is a
// size container. The staff <main> is not, and making it one would turn it
// into the containing block for every position:fixed thing on every staff
// page. So here the distances are measured instead: how far the block's
// parent sits from main's edges and how much padding main has on top, kept
// current as the sidebar collapses or the window changes.
//
// Desktop only. On a phone the staff page sits in a wrapper that clips
// sideways (the swipe between tabs needs it), so a bleed there would be cut.
export default function useStaffBleed() {
  const ref = useRef(null);
  const desktop = useIsDesktop();
  const [style, setStyle] = useState(undefined);

  useLayoutEffect(() => {
    const el = ref.current;
    const main = el?.closest('main');
    const parent = el?.parentElement;
    if (!desktop || !el || !main || !parent) { setStyle(undefined); return undefined; }

    const measure = () => {
      const m = main.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      const cs = getComputedStyle(main);
      setStyle({
        marginLeft: -(p.left - m.left),
        marginRight: -(m.right - p.right),
        marginTop: -parseFloat(cs.paddingTop || '0'),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [desktop]);

  return { ref, style, bled: Boolean(style) };
}
