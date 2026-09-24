// Count Up, from React Bits (https://reactbits.dev), MIT + Commons Clause,
// copyright David Haz. Licence text in ./LICENSE.md, which must travel with it.
//
// Changed from the original: it imports from framer-motion, which the app
// already ships, instead of adding the `motion` package for the same three
// hooks; it shows the final number at once under prefers-reduced-motion; and
// the finished value is also the element's text for screen readers from the
// first render, so nothing announces a run of changing numbers. The count is
// a fixed-length ease-out tween rather than the original's spring: that spring
// was heavily overdamped and crept through the last few digits for about three
// seconds whatever `duration` said.
import { useCallback, useEffect, useRef } from 'react';
import { animate, useInView, useReducedMotion } from 'framer-motion';

const decimalsOf = (n) => {
  const [, d] = String(n).split('.');
  return d && parseInt(d, 10) !== 0 ? d.length : 0;
};

export default function CountUp({ to, from = 0, delay = 0, duration = 1, className = '', separator = ',' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true });
  const decimals = Math.max(decimalsOf(from), decimalsOf(to));

  const format = useCallback((v) => {
    const s = Intl.NumberFormat('en-US', {
      useGrouping: !!separator,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(v);
    return separator && separator !== ',' ? s.replace(/,/g, separator) : s;
  }, [decimals, separator]);

  useEffect(() => {
    if (ref.current) ref.current.textContent = format(reduce ? to : from);
  }, [from, to, reduce, format]);

  useEffect(() => {
    if (!inView || reduce) return undefined;
    const controls = animate(from, to, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { if (ref.current) ref.current.textContent = format(v); },
    });
    return () => controls.stop();
  }, [inView, reduce, from, to, duration, delay, format]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className={className} />
      <span className="sr-only">{format(to)}</span>
    </>
  );
}
