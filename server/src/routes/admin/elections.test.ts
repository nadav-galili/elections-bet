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
// for the role; the route handlers read election/party. election/party/score are
// shared so the interactive $transaction callback receives the same mock fns the
// tests assert against (same pattern as picks.test.ts).
vi.mock('../../db', () => {
  const election = {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  const party = {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findFirst: vi.fn(),
  };
  const score = { upsert: vi.fn() };
  const pick = { count: vi.fn() };
  return {
    prisma: {
      user: { findUnique: vi.fn() },
      election,
      party,
      score,
      pick,
      $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({ election, party, score })),
    },
  };
});

import { createApp } from '../../app';
import { prisma } from '../../db';

const mocked = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn> };
  election: Record<
    'findMany' | 'findUnique' | 'create' | 'update' | 'delete',
    ReturnType<typeof vi.fn>
  >;
  party: Record<'create' | 'update' | 'delete' | 'findFirst', ReturnType<typeof vi.fn>>;
  score: Record<'upsert', ReturnType<typeof vi.fn>>;
  pick: Record<'count', ReturnType<typeof vi.fn>>;
  $transaction: ReturnType<typeof vi.fn>;
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
  // Default: no picks yet, so the party set is mutable (party add/delete allowed).
  mocked.pick.count.mockResolvedValue(0);
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

  it('POST /:id/parties persists baselineMandates (0 = brand-new entrant)', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({ id: 'e1' });
    mocked.party.create.mockResolvedValue({ id: 'p1', nameHe: 'מפלגה חדשה', electionId: 'e1' });
    const res = await request(createApp())
      .post('/api/admin/elections/e1/parties')
      .send({ nameHe: 'מפלגה חדשה', bloc: 'A', baselineMandates: 0 });
    expect(res.status).toBe(201);
    expect(mocked.party.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ baselineMandates: 0 }) }),
    );
  });

  it('PATCH /:id/parties/:partyId sets baselineMandates to a positive prior', async () => {
    asAdmin();
    mocked.party.findFirst.mockResolvedValue({ id: 'p1', electionId: 'e1' });
    mocked.party.update.mockResolvedValue({ id: 'p1' });
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/parties/p1')
      .send({ baselineMandates: 32 });
    expect(res.status).toBe(200);
    expect(mocked.party.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ baselineMandates: 32 }),
      }),
    );
  });

  it('PATCH /:id/parties/:partyId clears baselineMandates ("" -> null)', async () => {
    asAdmin();
    mocked.party.findFirst.mockResolvedValue({ id: 'p1', electionId: 'e1' });
    mocked.party.update.mockResolvedValue({ id: 'p1' });
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/parties/p1')
      .send({ baselineMandates: '' });
    expect(res.status).toBe(200);
    expect(mocked.party.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ baselineMandates: null }),
      }),
    );
  });

  it('PATCH /:id/parties/:partyId clears baselineMandates (null -> null)', async () => {
    asAdmin();
    mocked.party.findFirst.mockResolvedValue({ id: 'p1', electionId: 'e1' });
    mocked.party.update.mockResolvedValue({ id: 'p1' });
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/parties/p1')
      .send({ baselineMandates: null });
    expect(res.status).toBe(200);
    expect(mocked.party.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ baselineMandates: null }),
      }),
    );
  });

  it('POST /:id/parties rejects a negative baselineMandates (400)', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({ id: 'e1' });
    const res = await request(createApp())
      .post('/api/admin/elections/e1/parties')
      .send({ nameHe: 'מפלגה', bloc: 'A', baselineMandates: -3 });
    expect(res.status).toBe(400);
    expect(mocked.party.create).not.toHaveBeenCalled();
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

describe('admin elections — party set frozen after picks exist', () => {
  it('POST /:id/parties returns 409 once a pick has been submitted', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({ id: 'e1' });
    mocked.pick.count.mockResolvedValue(1);

    const res = await request(createApp())
      .post('/api/admin/elections/e1/parties')
      .send({ nameHe: 'ליכוד', bloc: 'A' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('לא ניתן לשנות את רשימת המפלגות לאחר שהוגשו תחזיות');
    expect(mocked.party.create).not.toHaveBeenCalled();
  });

  it('DELETE /:id/parties/:partyId returns 409 once a pick has been submitted', async () => {
    asAdmin();
    mocked.party.findFirst.mockResolvedValue({ id: 'p1', electionId: 'e1' });
    mocked.pick.count.mockResolvedValue(1);

    const res = await request(createApp()).delete('/api/admin/elections/e1/parties/p1');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('לא ניתן לשנות את רשימת המפלגות לאחר שהוגשו תחזיות');
    expect(mocked.party.delete).not.toHaveBeenCalled();
  });
});

describe('admin elections — PATCH /:id/results', () => {
  it('sets actual mandates for every party (200) with the submitted values', async () => {
    asAdmin();
    mocked.election.findUnique
      .mockResolvedValueOnce({ id: 'e1', parties: [{ id: 'p1' }, { id: 'p2' }] })
      .mockResolvedValueOnce({ id: 'e1', nameHe: 'בחירות', parties: [] });
    mocked.party.update.mockResolvedValue({});

    const res = await request(createApp())
      .patch('/api/admin/elections/e1/results')
      .send({
        entries: [
          { partyId: 'p1', actualMandates: 60 },
          { partyId: 'p2', actualMandates: 60 },
        ],
      });

    expect(res.status).toBe(200);
    expect(mocked.party.update).toHaveBeenCalledTimes(2);
    // The right value lands on the right party (not just "update was called").
    expect(mocked.party.update).toHaveBeenCalledWith({
      where: { id: 'p1' },
      data: { actualMandates: 60 },
    });
    expect(mocked.party.update).toHaveBeenCalledWith({
      where: { id: 'p2' },
      data: { actualMandates: 60 },
    });
  });

  it('returns 400 when the sum is not 120', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/results')
      .send({
        entries: [
          { partyId: 'p1', actualMandates: 60 },
          { partyId: 'p2', actualMandates: 50 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
  });

  it('returns 400 for an illegal value (2 mandates)', async () => {
    asAdmin();
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/results')
      .send({
        entries: [
          { partyId: 'p1', actualMandates: 2 },
          { partyId: 'p2', actualMandates: 118 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('שגיאת אימות');
  });

  it('returns 400 when the party set does not match the election', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      parties: [{ id: 'p1' }, { id: 'p2' }],
    });

    const res = await request(createApp())
      .patch('/api/admin/elections/e1/results')
      .send({
        entries: [{ partyId: 'p1', actualMandates: 120 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('התוצאות חייבות לכלול את כל המפלגות בבחירות');
  });

  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp())
      .patch('/api/admin/elections/e1/results')
      .send({
        entries: [
          { partyId: 'p1', actualMandates: 60 },
          { partyId: 'p2', actualMandates: 60 },
        ],
      });
    expect(res.status).toBe(403);
  });
});

describe('admin elections — POST /:id/publish', () => {
  const electionWithResults = (picksCount: number) => ({
    id: 'e1',
    parties: [
      { id: 'p1', bloc: 'A', actualMandates: 61 },
      { id: 'p2', bloc: 'B', actualMandates: 59 },
    ],
    picks: Array.from({ length: picksCount }, (_, i) => ({
      userId: `u${i}`,
      entries: [
        { partyId: 'p1', mandates: 61 },
        { partyId: 'p2', mandates: 59 },
      ],
    })),
  });

  it('returns 400 when a party result is missing (null)', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      parties: [
        { id: 'p1', bloc: 'A', actualMandates: null },
        { id: 'p2', bloc: 'B', actualMandates: 59 },
      ],
      picks: [],
    });

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('יש להזין תוצאות תקינות (סכום 120) לפני פרסום');
  });

  it('returns 400 when results are complete but do not sum to 120', async () => {
    asAdmin();
    mocked.election.findUnique.mockResolvedValue({
      id: 'e1',
      parties: [
        { id: 'p1', bloc: 'A', actualMandates: 60 },
        { id: 'p2', bloc: 'B', actualMandates: 59 }, // sum 119
      ],
      picks: [],
    });

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('יש להזין תוצאות תקינות (סכום 120) לפני פרסום');
    expect(mocked.score.upsert).not.toHaveBeenCalled();
  });

  it('persists the computed score breakdown for each pick', async () => {
    asAdmin();
    // results 61/59; the pick predicts 61/59 (perfect) =>
    // base 240, largest +10, threshold +2 (both parties in), bloc A +10 => 262.
    mocked.election.findUnique
      .mockResolvedValueOnce(electionWithResults(1))
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'PROVISIONAL', parties: [] });
    mocked.score.upsert.mockResolvedValue({});
    mocked.election.update.mockResolvedValue({});

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });

    expect(res.status).toBe(200);
    expect(mocked.score.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_electionId: { userId: 'u0', electionId: 'e1' } },
        create: expect.objectContaining({
          userId: 'u0',
          electionId: 'e1',
          base: 240,
          bonusLargest: 10,
          bonusThreshold: 2,
          bonusBloc: 10,
          total: 262,
        }),
        update: expect.objectContaining({ base: 240, total: 262 }),
      }),
    );
  });

  it('re-publishing recomputes Scores from the current results (idempotent)', async () => {
    asAdmin();
    // First publish: perfect pick over 61/59 => base 240.
    mocked.election.findUnique
      .mockResolvedValueOnce(electionWithResults(1))
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'PROVISIONAL', parties: [] });
    mocked.score.upsert.mockResolvedValue({});
    mocked.election.update.mockResolvedValue({});

    await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });
    const firstBase = mocked.score.upsert.mock.calls[0][0].create.base;
    expect(firstBase).toBe(240);

    // Results corrected to 80/40; the same pick (61/59) is no longer perfect.
    mocked.score.upsert.mockClear();
    mocked.election.findUnique
      .mockResolvedValueOnce({
        id: 'e1',
        parties: [
          { id: 'p1', bloc: 'A', actualMandates: 80 },
          { id: 'p2', bloc: 'B', actualMandates: 40 },
        ],
        picks: [
          {
            userId: 'u0',
            entries: [
              { partyId: 'p1', mandates: 61 },
              { partyId: 'p2', mandates: 59 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'FINAL', parties: [] });

    await request(createApp()).post('/api/admin/elections/e1/publish').send({ status: 'FINAL' });
    // Σ|diff| = |61-80| + |59-40| = 19 + 19 = 38 => base 202 (recomputed, not stale).
    const secondBase = mocked.score.upsert.mock.calls[0][0].create.base;
    expect(secondBase).toBe(202);
    expect(secondBase).not.toBe(firstBase);
  });

  it('publishes an election with no picks (sets status, writes no Scores)', async () => {
    asAdmin();
    mocked.election.findUnique
      .mockResolvedValueOnce(electionWithResults(0))
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'PROVISIONAL', parties: [] });
    mocked.election.update.mockResolvedValue({});

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });

    expect(res.status).toBe(200);
    expect(mocked.score.upsert).not.toHaveBeenCalled();
    expect(mocked.election.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ resultsStatus: 'PROVISIONAL' }) }),
    );
  });

  it('PROVISIONAL: computes & upserts a Score per pick and sets status', async () => {
    asAdmin();
    mocked.election.findUnique
      .mockResolvedValueOnce(electionWithResults(3))
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'PROVISIONAL', parties: [] });
    mocked.score.upsert.mockResolvedValue({});
    mocked.election.update.mockResolvedValue({});

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });

    expect(res.status).toBe(200);
    expect(mocked.score.upsert).toHaveBeenCalledTimes(3);
    expect(mocked.election.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultsStatus: 'PROVISIONAL' }),
      }),
    );
  });

  it('FINAL: recomputes & sets status FINAL', async () => {
    asAdmin();
    mocked.election.findUnique
      .mockResolvedValueOnce(electionWithResults(2))
      .mockResolvedValueOnce({ id: 'e1', resultsStatus: 'FINAL', parties: [] });
    mocked.score.upsert.mockResolvedValue({});
    mocked.election.update.mockResolvedValue({});

    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'FINAL' });

    expect(res.status).toBe(200);
    expect(mocked.score.upsert).toHaveBeenCalledTimes(2);
    expect(mocked.election.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ resultsStatus: 'FINAL' }),
      }),
    );
  });

  it('403 for a non-admin user', async () => {
    asUser();
    const res = await request(createApp())
      .post('/api/admin/elections/e1/publish')
      .send({ status: 'PROVISIONAL' });
    expect(res.status).toBe(403);
  });
});
