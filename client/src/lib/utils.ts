import { clsx, type ClassValue } from 'clsx';
import { isAxiosError } from 'axios';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract the API's Hebrew error message from a failed request, falling back to
 * `fallback` when the server didn't send one (e.g. a network error or a 500).
 * The server returns errors as `{ error: string }` (see middleware/error.ts).
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isAxiosError(error)) {
    const message = error.response?.data?.error;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}
