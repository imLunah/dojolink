// Count Up, from React Bits (https://reactbits.dev), MIT + Commons Clause,
// copyright David Haz. Licence text in ./LICENSE.md, which must travel with it.
//
// Changed from the original: it imports from framer-motion, which the app
// already ships, instead of adding the `motion` package for the same three
// hooks; it shows the final number at once under prefers-reduced-motion; and
// the finished value is also the element's text for screen readers from the
// first render, so nothing announces a run of changing numbers.
import { useCallback, useEffect, useRef } from 'react';
import { useInView, useMotionValue, useReducedMotion, useSpring } from 'framer-motion';

const decimalsOf = (n) => {
  const [, d] = String(n).split('.');
  return d && parseInt(d, 10) !== 0 ? d.length : 0;
};

export default function CountUp({ to, from = 0, delay = 0, duration = 1, className = '', separator = ',' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const motionValue = useMotionValue(from);
  const springValue = useSpring(motionValue, { damping: 20 + 40 * (1 / duration), stiffness: 100 * (1 / duration) });
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
    const id = setTimeout(() => motionValue.set(to), delay * 1000);
    return () => clearTimeout(id);
  }, [inView, reduce, motionValue, to, delay]);

  useEffect(() => springValue.on('change', (v) => {
    if (ref.current) ref.current.textContent = format(v);
  }), [springValue, format]);

  return (
    <>
      <span ref={ref} aria-hidden="true" className={className} />
      <span className="sr-only">{format(to)}</span>
    </>
  );
}
