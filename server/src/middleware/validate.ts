import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';

/**
 * Build an Express middleware that validates `req.body` against `schema`.
 * On success the parsed (and coerced) value replaces `req.body` and `next()`
 * is called. On a ZodError it responds 400 and does NOT call `next`.
 */
export function validate(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const err: ZodError = result.error;
      res.status(400).json({ error: 'שגיאת אימות', issues: err.issues });
      return;
    }
    req.body = result.data;
    next();
  };
}
