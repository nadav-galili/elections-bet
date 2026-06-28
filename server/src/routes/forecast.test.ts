import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is stubbed: the forecast route is public, but createApp still constructs
// clerkMiddleware for the /api surface, so we keep it a no-op.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: null }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// Prisma is stubbed per-test. The forecast route reads election.findFirst (active),
// election.findUnique (archive URL), and pick.findMany (participation).
vi.mock('../db', () => ({
  prisma: {
    election: { findFirst: vi.fn(), findUnique: vi.fn() },
    pick: { findMany: vi.fn() },
  },
}));

import { createApp } from '../app';
import { prisma } from '../db';
import { env } from '../env';

const mocked = prisma as unknown as {
  election: Record<'findFirst' | 'findUnique', ReturnType<typeof vi.fn>>;
  pick: { findMany: ReturnType<typeof vi.fn> };
};

function submitted(): { submittedAt: Date | null } {
  return { submittedAt: new Date('2026-01-01T00:00:00Z') };
}
function draft(): { submittedAt: Date | null } {
  return { submittedAt: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /forecast — canonical public page', () => {
  it('is reachable with NO authentication and returns server-rendered HTML', async () => {
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות 2026' });
    mocked.pick.findMany.mockResolvedValue([submitted(), submitted()]);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('<!doctype html>');
    expect(res.text).toContain('dir="rtl"');
  });

  it('renders the participation count for the active election', async () => {
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות 2026' });
    // 3 submitted + 2 drafts ⇒ only 3 count.
    mocked.pick.findMany.mockResolvedValue([
      submitted(),
      submitted(),
      submitted(),
      draft(),
      draft(),
    ]);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    expect(res.text).toContain('3');
    expect(res.text).toContain('ישראלים כבר ניבאו');
    // Count is scoped to the active election.
    expect(mocked.pick.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { electionId: 'e1' } }),
    );
  });

  it('renders the permanent "game, not a poll" framing', async () => {
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות 2026' });
    mocked.pick.findMany.mockResolvedValue([]);

    const res = await request(createApp()).get('/forecast');
    expect(res.text).toContain('משחק, לא סקר');
  });

  it('includes a CTA deep-linking into the SPA pick route on CLIENT_ORIGIN', async () => {
    mocked.election.findFirst.mockResolvedValue({ id: 'e1', nameHe: 'בחירות 2026' });
    mocked.pick.findMany.mockResolvedValue([]);

    const res = await request(createApp()).get('/forecast');
    expect(res.text).toContain(`${env.CLIENT_ORIGIN}/elections/e1/pick`);
  });

  it('no active election: graceful 200 empty page', async () => {
    mocked.election.findFirst.mockResolvedValue(null);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('אין בחירות פעילות');
    // No participation query when there is no election.
    expect(mocked.pick.findMany).not.toHaveBeenCalled();
  });
});

describe('GET /forecast/:electionId — stable per-election archive URL', () => {
  it('resolves a specific election and renders its count, no auth', async () => {
    mocked.election.findUnique.mockResolvedValue({ id: 'old', nameHe: 'בחירות 2022' });
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const res = await request(createApp()).get('/forecast/old');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('בחירות 2022');
    expect(res.text).toContain('1');
    expect(mocked.election.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'old' } }),
    );
    // The archive URL must NOT fall through to the active-election query.
    expect(mocked.election.findFirst).not.toHaveBeenCalled();
  });

  it('unknown election id: 404 HTML page', async () => {
    mocked.election.findUnique.mockResolvedValue(null);

    const res = await request(createApp()).get('/forecast/missing');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/text\/html/);
    expect(res.text).toContain('אין בחירות פעילות');
  });
});
