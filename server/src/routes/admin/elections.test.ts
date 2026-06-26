import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

// Clerk is fully stubbed: middleware passes through, getAuth yields a fixed user.
vi.mock('@clerk/express', () => ({
  clerkMiddleware: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  requireAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  getAuth: () => ({ userId: 'clerk_test' }),
  clerkClient: { users: { getUser: vi.fn() } },
}));

// Prisma is stubbed per-test. requireSuperAdmin reads prisma.user.findUnique
// for the role; the route handlers read election/party.
vi.mock('../../db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    election: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    party: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { createApp } from '../../app';
import { prisma } from '../../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  election: Record<
    'findMany' | 'findUnique' | 'create' | 'update' | 'delete',
    ReturnType<typeof vi.fn>
  >;
  party: Record<'create' | 'update' | 'delete' | 'findFirst', ReturnType<typeof vi.fn>>;
};

function asAdmin(): void {
  mocked.user.findUnique.mockResolvedValue({
    id: 'u1',
    clerkId: 'clerk_test',
    role: 'SUPER_ADMIN',
  });
}

function asUser(): void {
  mocked.user.findUnique.mockResolvedValue({ id: 'u1', clerkId: 'clerk_test', role: 'USER' });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('admin elections — gating', () => {
  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp()).get('/api/admin/elections');
    expect(res.status).toBe(403);
  });
});

describe('admin elections — happy paths', () => {
  it('GET / lists elections', async () => {
    asAdmin();
    mocked.election.findMany.mockResolvedValue([
      { id: 'e1', nameHe: 'בחירות', _count: { parties: 2 } },
    ]);
    const res = await request(createApp()).get('/api/admin/elections');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]._count.parties).toBe(2);
  });

  it('POST / creates an election (201)', async () => {
    asAdmin();
    mocked.election.create.mockResolvedValue({ id: 'e1', nameHe: 'בחירות 2026' });
    const res = await request(createApp())
      .post('/api/admin/elections')
      .send({ nameHe: 'בחירות 2026' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('e1');
    expect(mocked.election.create).toHaveBeenCalledOnce();
  });

  it('POST /:id/parties creates a party (201)', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({ id: 'e1' });
    mocked.party.create.mockResolvedValue({ id: 'p1', nameHe: 'ליכוד', electionId: 'e1' });
    const res = await request(createApp())
      .post('/api/admin/elections/e1/parties')
      .send({ nameHe: 'ליכוד', bloc: 'A' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe('p1');
    expect(mocked.party.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ electionId: 'e1' }) }),
    );
  });

  it('GET /:id returns an election with parties', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({ id: 'e1', nameHe: 'בחירות', parties: [] });
    const res = await request(createApp()).get('/api/admin/elections/e1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('e1');
  });
});

describe('admin elections — validation & not-found', () => {
  it('POST / with invalid body returns 400', async () => {
    asAdmin();
    const res = await request(createApp()).post('/api/admin/elections').send({ nameHe: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it('POST / with revealAt before lockAt returns 400', async () => {
    asAdmin();
    const res = await request(createApp()).post('/api/admin/elections').send({
      nameHe: 'x',
      lockAt: '2026-01-01T20:00:00.000Z',
      revealAt: '2026-01-01T19:00:00.000Z',
    });
    expect(res.status).toBe(400);
  });

  it('GET /:id for a missing election returns 404', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue(null);
    const res = await request(createApp()).get('/api/admin/elections/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('הבחירות לא נמצאו');
  });

  it('PATCH /:id/parties/:partyId for a missing party returns 404', async () => {
    asAdmin();
    mocked.party.findFirst.mockResolvedValue(null);
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/parties/nope')
      .send({ nameHe: 'שם חדש' });
    expect(res.status).toBe(404);
  });
});
