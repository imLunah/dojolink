import { useState, useEffect } from 'react';

// Whether there is room beside the thing you are looking at.
//
// Asked in JS rather than answered with `lg:hidden` on two copies of the same
// markup, because the things that ask this question are dialogs and forms:
// rendering both layouts would mean two sets of inputs bound to one piece of
// state, one of them invisible and both of them writing to it.
//
// 1024px is the app's own desktop line — the nav's breakpoint, and the width
// below which there is no beside.
export default function useIsDesktop(minWidth = 1024) {
  const query = `(min-width: ${minWidth}px)`;
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setIsDesktop(e.matches);
    setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return isDesktop;
}
