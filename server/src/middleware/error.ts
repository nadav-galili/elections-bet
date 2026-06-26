import type { Request, Response, NextFunction } from 'express';

/** Throw this from any handler to control the HTTP status. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: 'Not found' });
}

// Express 5 auto-forwards rejected promises from async handlers to here,
// so route handlers never need try/catch.
export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  const status = err instanceof HttpError ? err.status : 500;
  const message = err instanceof Error ? err.message : 'Internal Server Error';
  if (status >= 500) {
    console.error('[api] unhandled error:', err);
  }
  res.status(status).json({ error: message });
}
