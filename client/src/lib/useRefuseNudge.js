import { useCallback, useEffect, useRef, useState } from 'react';

// A dismissal that was asked for and declined, made visible.
//
// Refusing silently is worse than closing: the press did nothing and the
// screen said nothing, so the next guess is that the app is stuck. The panel
// shoves toward the edge it would have left by and settles back — the same
// resistance a drawer gives when something is in the way — and a line says
// what is holding it.
//
// `signal` lets a parent refuse on the panel's behalf: bump the number and the
// same nudge plays, for presses that never reach the panel at all.
export default function useRefuseNudge(signal = 0) {
  const [nudging, setNudging] = useState(false);
  const [hinting, setHinting] = useState(false);
  const timers = useRef([]);

  const refuse = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    // Off and on across a frame, so a second refusal replays the animation
    // instead of landing on a class that is already there.
    setNudging(false);
    requestAnimationFrame(() => setNudging(true));
    setHinting(true);
    timers.current.push(setTimeout(() => setNudging(false), 460));
    timers.current.push(setTimeout(() => setHinting(false), 2800));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const seen = useRef(signal);
  useEffect(() => {
    if (signal === seen.current) return;
    seen.current = signal;
    refuse();
  }, [signal, refuse]);

  return { nudging, hinting, refuse };
}
