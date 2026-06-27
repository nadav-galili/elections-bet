// Centralized Asia/Jerusalem time logic for the server.
//
// Israel observes DST: in summer the offset is IDT (UTC+3), in winter IST
// (UTC+2). The transition dates are political and shift year to year, so we
// NEVER hardcode the offset — we derive it from the IANA 'Asia/Jerusalem' tz
// database at runtime via Intl.

export const IL_TZ = 'Asia/Jerusalem';

/** Render an absolute instant as a he-IL string in Asia/Jerusalem wall time. */
export function formatInIsrael(date: Date): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: IL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date);
}

// Returns the offset (in minutes) of Asia/Jerusalem from UTC at the given
// absolute instant: a positive number means Israel local time is AHEAD of UTC
// (e.g. +120 in winter, +180 in summer). Derived from the tz database.
function israelOffsetMinutesAt(instant: Date): number {
  // Format the instant in the Israel zone, then read those wall-clock fields
  // back as if they were UTC. The gap between that and the real instant IS the
  // zone offset for this instant.
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: IL_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): number => {
    const v = parts.find((p) => p.type === type)?.value;
    return Number(v);
  };

  let hour = get('hour');
  // Intl can emit hour '24' at midnight in some engines; normalize to 0.
  if (hour === 24) hour = 0;

  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    hour,
    get('minute'),
    get('second'),
  );
  return (asUtc - instant.getTime()) / 60000;
}

/**
 * Interpret an Israel wall-clock time (Y, monthIndex0, day, hour, minute) as an
 * absolute UTC instant, DST-aware.
 *
 * The offset itself depends on the instant we're trying to find, so we can't
 * read it directly. We make a first guess by treating the wall-clock as UTC,
 * derive the zone offset at that guess, subtract it, then re-derive the offset
 * at the corrected instant. Re-deriving catches the case where the naive guess
 * landed on the wrong side of a DST transition (the offset differs between the
 * guess and the answer).
 */
export function israelWallClockToUtc(
  y: number,
  monthIndex0: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const naiveUtcMs = Date.UTC(y, monthIndex0, day, hour, minute, 0);

  // First approximation: offset at the naive instant.
  let offsetMin = israelOffsetMinutesAt(new Date(naiveUtcMs));
  let candidateMs = naiveUtcMs - offsetMin * 60000;

  // Re-derive at the candidate; if the offset changed we straddled a DST
  // boundary, so recompute once more with the corrected offset.
  const offsetMin2 = israelOffsetMinutesAt(new Date(candidateMs));
  if (offsetMin2 !== offsetMin) {
    offsetMin = offsetMin2;
    candidateMs = naiveUtcMs - offsetMin * 60000;
  }

  return new Date(candidateMs);
}

/** True once now >= lockAt. A null lockAt is never locked. */
export function isLocked(lockAt: Date | null, now: Date = new Date()): boolean {
  if (lockAt == null) return false;
  return now.getTime() >= lockAt.getTime();
}

/** True once now >= revealAt. A null revealAt is never revealed. */
export function isRevealed(revealAt: Date | null, now: Date = new Date()): boolean {
  if (revealAt == null) return false;
  return now.getTime() >= revealAt.getTime();
}
