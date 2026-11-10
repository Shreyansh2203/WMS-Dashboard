import { useEffect, useRef, useState } from 'react';

/**
 * Tween a number toward target. Initial mount renders the final value (no
 * count-up-on-load decoration); only user-driven changes (range toggle, site
 * switch) animate — that's the "numbers ticking from old to new" case.
 * Honors prefers-reduced-motion.
 */
export function useTween(target: number, duration = 520): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fromRef.current = target;
      setValue(target);
      return;
    }
    const from = fromRef.current;
    const delta = target - from;
    if (delta === 0) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic ≈ cubic-bezier(0.23, 1, 0.32, 1) feel
      setValue(from + delta * e);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}
