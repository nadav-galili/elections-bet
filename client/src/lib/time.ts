import { useEffect, useState } from 'react';

/** Israel timezone — all human-facing dates/times are rendered in this zone. */
export const IL_TZ = 'Asia/Jerusalem';

const FALLBACK = '—';

function toValidDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** he-IL short date + short time, pinned to Asia/Jerusalem. Returns `fallback` for null/invalid. */
export function formatDateTime(
  iso: string | null | undefined,
  fallback: string = FALLBACK,
): string {
  const d = toValidDate(iso);
  if (!d) return fallback;
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: IL_TZ,
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/** he-IL date only, pinned to Asia/Jerusalem. Returns `fallback` for null/invalid. */
export function formatDate(iso: string | null | undefined, fallback: string = FALLBACK): string {
  const d = toValidDate(iso);
  if (!d) return fallback;
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: IL_TZ,
    dateStyle: 'short',
  }).format(d);
}

/** he-IL time only (hour + minute), pinned to Asia/Jerusalem. Returns `fallback` for null/invalid. */
export function formatTime(iso: string | null | undefined, fallback: string = FALLBACK): string {
  const d = toValidDate(iso);
  if (!d) return fallback;
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: IL_TZ,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/**
 * Live countdown to `targetIso`. Ticks every second until the target is reached,
 * then stops ticking. Returns `{ msLeft: null }` when no target is set.
 * `ended` is true once the target has passed (msLeft <= 0).
 */
export function useCountdown(targetIso: string | null): { msLeft: number | null; ended: boolean } {
  const target = targetIso ? new Date(targetIso).getTime() : null;
  const validTarget = target != null && !Number.isNaN(target) ? target : null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (validTarget == null) return;
    // Already past the target — no need to tick.
    if (validTarget - Date.now() <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [validTarget]);

  const msLeft = validTarget == null ? null : validTarget - now;
  const ended = msLeft != null && msLeft <= 0;
  return { msLeft, ended };
}

/** Format milliseconds as `D ימים HH:MM:SS` (days dropped when 0), zero-padded. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days} ימים ${clock}` : clock;
}
