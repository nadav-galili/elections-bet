import { cn } from '@/lib/utils';
import { formatCountdown, formatDateTime, useCountdown } from '@/lib/time';

interface CountdownProps {
  /** ISO timestamp to count down to. `null` renders a muted "not yet scheduled" note. */
  to: string | null;
  /** Leading label while counting down. */
  label?: string;
  /** Text shown once the target has passed. */
  endedLabel?: string;
  className?: string;
}

/**
 * Live countdown to `to`, pinned to Israel time for the absolute timestamp.
 * Self-contained: ticks every second via `useCountdown` until the target is reached.
 */
export function Countdown({
  to,
  label = 'התחזיות ננעלות בעוד',
  endedLabel = 'התחזיות ננעלו',
  className,
}: CountdownProps) {
  const { msLeft, ended } = useCountdown(to);

  if (!to) {
    return <p className={cn('text-base text-muted-foreground', className)}>טרם נקבע מועד נעילה</p>;
  }

  if (ended) {
    return <p className={cn('text-base text-muted-foreground', className)}>{endedLabel}</p>;
  }

  return (
    <p className={cn('text-base text-muted-foreground', className)} aria-live="polite">
      {label}{' '}
      <span className="font-mono font-semibold tabular-nums">{formatCountdown(msLeft ?? 0)}</span> ·{' '}
      {formatDateTime(to)}
    </p>
  );
}
