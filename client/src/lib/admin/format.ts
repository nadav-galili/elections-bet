import type { Bloc, Election, ResultsStatus } from '@/lib/admin/types';

/** Pull the server's Hebrew error message off an axios error, else a fallback. */
export function apiErrorMessage(err: unknown, fallback = 'הפעולה נכשלה. נסו שוב.'): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { error?: unknown } } }).response?.data;
    if (data && typeof data.error === 'string') return data.error;
  }
  return fallback;
}

/** Format an ISO timestamp for display in the admin tables (Hebrew locale). */
export function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(d);
}

/** Convert an ISO timestamp into a value usable by <input type="datetime-local">. */
export function toDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  // Adjust to local time, then strip the seconds/timezone for the input.
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

/** Convert a datetime-local value back to an absolute ISO string (or null). */
export function fromDateTimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export const resultsStatusLabels: Record<ResultsStatus, string> = {
  NONE: 'ללא תוצאות',
  PROVISIONAL: 'תוצאות זמניות',
  FINAL: 'תוצאות סופיות',
};

/** Human label for a party's bloc, using the election's custom labels. */
export function blocLabel(
  bloc: Bloc,
  election: Pick<Election, 'blocALabel' | 'blocBLabel'>,
): string {
  if (bloc === 'A') return election.blocALabel || 'גוש א׳';
  if (bloc === 'B') return election.blocBLabel || 'גוש ב׳';
  return 'לא משויך';
}
