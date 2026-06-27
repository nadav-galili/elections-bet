import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Scroll-triggered "scale + fade up" reveal (DESIGN.md motion: staggered
 * entrance). Pure CSS transition driven by an IntersectionObserver. Where IO is
 * unavailable (jsdom/tests, very old browsers) content renders visible up front,
 * so it never hides text from assertions or no-JS readers.
 */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
          }
        }
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'translate-y-6 scale-[0.98] opacity-0 transition-all duration-700 ease-out motion-reduce:translate-y-0 motion-reduce:scale-100 motion-reduce:opacity-100 motion-reduce:transition-none',
        shown && 'translate-y-0 scale-100 opacity-100',
        className,
      )}
    >
      {children}
    </div>
  );
}
