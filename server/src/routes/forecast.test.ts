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
// election.findUnique (archive URL), pick.findMany (participation + entries), and
// party.findMany (bloc tags + names for the mandate bar).
vi.mock('../db', () => ({
  prisma: {
    election: { findFirst: vi.fn(), findUnique: vi.fn() },
    pick: { findMany: vi.fn() },
    party: { findMany: vi.fn() },
  },
}));

import { createApp } from '../app';
import { prisma } from '../db';
import { env } from '../env';
import { REVEAL_THRESHOLD } from '../lib/forecast';

const mocked = prisma as unknown as {
  election: Record<'findFirst' | 'findUnique', ReturnType<typeof vi.fn>>;
  pick: { findMany: ReturnType<typeof vi.fn> };
  party: { findMany: ReturnType<typeof vi.fn> };
};

type Entry = { partyId: string; mandates: number };
function submitted(entries: Entry[] = []): { submittedAt: Date | null; entries: Entry[] } {
  return { submittedAt: new Date('2026-01-01T00:00:00Z'), entries };
}
function draft(entries: Entry[] = []): { submittedAt: Date | null; entries: Entry[] } {
  return { submittedAt: null, entries };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: no parties (count-only behaviour) unless a test overrides it.
  mocked.party.findMany.mockResolvedValue([]);
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

  it('BELOW threshold: hides numbers end-to-end (no bloc verdict, no mandate bar)', async () => {
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      blocALabel: 'הימין',
      blocBLabel: 'השמאל',
    });
    mocked.party.findMany.mockResolvedValue([
      { id: 'a', nameHe: 'הליכוד', bloc: 'A' },
      { id: 'b', nameHe: 'יש עתיד', bloc: 'B' },
    ]);
    // A handful of submitted picks — well under REVEAL_THRESHOLD.
    mocked.pick.findMany.mockResolvedValue([
      submitted([
        { partyId: 'a', mandates: 70 },
        { partyId: 'b', mandates: 50 },
      ]),
      submitted([
        { partyId: 'a', mandates: 70 },
        { partyId: 'b', mandates: 50 },
      ]),
    ]);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    // Count hero shows; the bloc verdict + mandate bar must NOT leak.
    expect(res.text).toContain('ישראלים כבר ניבאו');
    expect(res.text).not.toContain('תחזית המנדטים');
    expect(res.text).not.toContain('מקבל רוב');
    expect(res.text).not.toContain('הליכוד');
  });

  it('AT/ABOVE threshold: bloc verdict is the hero and the mandate bar renders with the largest party highlighted', async () => {
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      blocALabel: 'הימין',
      blocBLabel: 'השמאל',
    });
    mocked.party.findMany.mockResolvedValue([
      { id: 'a', nameHe: 'הליכוד', bloc: 'A' },
      { id: 'b', nameHe: 'יש עתיד', bloc: 'B' },
      { id: 'c', nameHe: 'רעם', bloc: 'UNALIGNED' },
    ]);
    // Exactly REVEAL_THRESHOLD identical submitted picks: A bloc = 65 ⇒ call A;
    // largest party is "a" (הליכוד).
    const entries: Entry[] = [
      { partyId: 'a', mandates: 65 },
      { partyId: 'b', mandates: 40 },
      { partyId: 'c', mandates: 15 },
    ];
    mocked.pick.findMany.mockResolvedValue(
      Array.from({ length: REVEAL_THRESHOLD }, () => submitted(entries)),
    );

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    // Bloc verdict hero: A bloc (הימין) gets a majority.
    expect(res.text).toContain('הימין מקבל רוב');
    // Mandate bar renders all parties.
    expect(res.text).toContain('תחזית המנדטים');
    expect(res.text).toContain('הליכוד');
    expect(res.text).toContain('יש עתיד');
    expect(res.text).toContain('רעם');
    // Largest party highlighted (is-top class on its row).
    expect(res.text).toMatch(/bar-row is-top[\s\S]*?הליכוד/);
    // The count-as-hero line is replaced by the verdict.
    expect(res.text).not.toContain('ישראלים כבר ניבאו');
  });

  it('ABOVE threshold: renders the biggest movers vs baseline (gainers and losers)', async () => {
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      blocALabel: 'הימין',
      blocBLabel: 'השמאל',
    });
    mocked.party.findMany.mockResolvedValue([
      { id: 'a', nameHe: 'הליכוד', bloc: 'A', baselineMandates: 32 }, // 40 - 32 = +8
      { id: 'b', nameHe: 'יש עתיד', bloc: 'B', baselineMandates: 24 }, // 20 - 24 = -4
      { id: 'c', nameHe: 'רעם', bloc: 'UNALIGNED', baselineMandates: null }, // no delta
    ]);
    const entries: Entry[] = [
      { partyId: 'a', mandates: 40 },
      { partyId: 'b', mandates: 20 },
      { partyId: 'c', mandates: 60 },
    ];
    mocked.pick.findMany.mockResolvedValue(
      Array.from({ length: REVEAL_THRESHOLD }, () => submitted(entries)),
    );

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    // The movers section header and both columns render.
    expect(res.text).toContain('התנועה הגדולה ביותר');
    expect(res.text).toContain('העולים');
    expect(res.text).toContain('היורדים');
    // Gainer הליכוד with +8, loser יש עתיד with −4.
    expect(res.text).toMatch(/mover-up[\s\S]*?הליכוד/);
    expect(res.text).toContain('+8');
    expect(res.text).toMatch(/mover-down[\s\S]*?יש עתיד/);
    expect(res.text).toContain('−4');
  });

  it('ABOVE threshold but NO baselines: the movers section is omitted', async () => {
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      blocALabel: 'הימין',
      blocBLabel: 'השמאל',
    });
    mocked.party.findMany.mockResolvedValue([
      { id: 'a', nameHe: 'הליכוד', bloc: 'A', baselineMandates: null },
      { id: 'b', nameHe: 'יש עתיד', bloc: 'B', baselineMandates: null },
    ]);
    mocked.pick.findMany.mockResolvedValue(
      Array.from({ length: REVEAL_THRESHOLD }, () =>
        submitted([
          { partyId: 'a', mandates: 65 },
          { partyId: 'b', mandates: 55 },
        ]),
      ),
    );

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    // Mandate bar renders, but with no baselines the movers section is withheld.
    expect(res.text).toContain('תחזית המנדטים');
    expect(res.text).not.toContain('התנועה הגדולה ביותר');
  });

  it('PRE-lock: the CTA routes to the active-election pick screen', async () => {
    // lockAt in the far future ⇒ picks still open ⇒ deep-link into the pick screen.
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      lockAt: new Date('2999-01-01T20:00:00Z'),
    });
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`href="${env.CLIENT_ORIGIN}/elections/e1/pick"`);
    expect(res.text).toContain('נסו לנחש גם אתם');
    // No dead-end frozen path: it must NOT send strangers to the leaderboard pre-lock.
    expect(res.text).not.toContain(`href="${env.CLIENT_ORIGIN}/leaderboard"`);
  });

  it('PRE-lock: a null lockAt is treated as open and routes to the pick screen', async () => {
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      lockAt: null,
    });
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const res = await request(createApp()).get('/forecast');
    expect(res.text).toContain(`href="${env.CLIENT_ORIGIN}/elections/e1/pick"`);
  });

  it('POST-lock: the CTA routes to the reveal/leaderboard view, not a frozen pick screen', async () => {
    // lockAt in the past ⇒ picks frozen ⇒ CTA captures the sign-up via the leaderboard.
    mocked.election.findFirst.mockResolvedValue({
      id: 'e1',
      nameHe: 'בחירות 2026',
      lockAt: new Date('2020-01-01T20:00:00Z'),
    });
    mocked.pick.findMany.mockResolvedValue([submitted()]);

    const res = await request(createApp()).get('/forecast');
    expect(res.status).toBe(200);
    expect(res.text).toContain(`href="${env.CLIENT_ORIGIN}/leaderboard"`);
    expect(res.text).toContain('התחזיות ננעלו');
    // Must NOT deep-link into the now-frozen pick screen.
    expect(res.text).not.toContain(`href="${env.CLIENT_ORIGIN}/elections/e1/pick"`);
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
