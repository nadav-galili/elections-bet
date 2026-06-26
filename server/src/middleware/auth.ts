import type { Request } from 'express';
import { getAuth, clerkClient } from '@clerk/express';
import { prisma } from '../db';
import { HttpError } from './error';

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
