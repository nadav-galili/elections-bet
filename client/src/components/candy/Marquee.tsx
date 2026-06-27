import { cn } from '@/lib/utils';

/**
 * Infinite, seamless marquee (DESIGN.md motion: ambient movement). The track
 * holds two identical copies of `items` and slides by -50%, so the loop is
 * gapless. Pauses on hover; respects prefers-reduced-motion (see index.css).
 */
export function Marquee({ items, className }: { items: string[]; className?: string }) {
  const row = (ariaHidden: boolean) => (
    <ul aria-hidden={ariaHidden || undefined} className="flex shrink-0 items-center gap-3 px-1.5">
      {items.map((item, i) => (
        <li
          key={`${item}-${i}`}
          className="flex items-center gap-2 rounded-full border border-border/70 bg-card px-4 py-2 text-base font-semibold text-foreground/80"
        >
          <span className="size-2 rounded-full bg-candy-mint" />
          {item}
        </li>
      ))}
    </ul>
  );

  return (
    <div
      className={cn(
        'candy-marquee group relative w-full overflow-hidden',
        '[mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]',
        className,
      )}
    >
      <div className="candy-marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
