import type { Request, Response, NextFunction } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { prisma } from '../db';
import { HttpError } from './error';

type DbUser = Awaited<ReturnType<typeof ensureDbUser>>;

/** Request augmented with the resolved local DB user. */
export type AuthedRequest = Request & { dbUser?: DbUser };

/** The authenticated Clerk user id, or 401. */
export function getClerkId(req: Request): string {
  const { userId } = getAuth(req);
  if (!userId) {
    throw new HttpError(401, 'Unauthorized');
  }
  return userId;
}

/**
 * Return the local DB user for a Clerk id, creating it on first sight
 * (a safety net in case the Clerk webhook hasn't fired yet).
 */
export async function ensureDbUser(clerkId: string) {
  const existing = await prisma.user.findUnique({ where: { clerkId } });
  if (existing) return existing;

  const cu = await clerkClient.users.getUser(clerkId);
  return prisma.user.create({
    data: {
      clerkId,
      email: cu.primaryEmailAddress?.emailAddress ?? null,
      displayName: cu.firstName ?? null,
      avatarUrl: cu.imageUrl ?? null,
    },
  });
}

/** Require the local user to be a super-admin. */
export async function requireSuperAdmin(clerkId: string) {
  const user = await ensureDbUser(clerkId);
  if (user.role !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'Forbidden');
  }
  return user;
}

/**
 * Express middleware: require a signed-in super-admin and attach the resolved
 * DB user as `req.dbUser`. Express 5 forwards rejections to the error handler,
 * so no try/catch is needed.
 */
export async function requireSuperAdminMw(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const clerkId = getClerkId(req);
  const user = await requireSuperAdmin(clerkId);
  (req as AuthedRequest).dbUser = user;
  next();
}

/**
 * Express middleware: require a signed-in user and attach the resolved
 * DB user as `req.dbUser`. Express 5 forwards rejections to the error handler,
 * so no try/catch is needed.
 */
export async function requireAuthMw(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const clerkId = getClerkId(req);
  const user = await ensureDbUser(clerkId);
  // A super-admin ban (reversible flag) locks the user out of every player route.
  if (user.bannedAt) {
    throw new HttpError(403, 'חשבונך הושעה');
  }
  (req as AuthedRequest).dbUser = user;
  next();
}
