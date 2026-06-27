import { Router } from 'express';
import { requireAuth } from '@clerk/express';
import { prisma } from '../db';
import { HttpError } from '../middleware/error';
import { validate } from '../middleware/validate';
import { getClerkId, ensureDbUser } from '../middleware/auth';
import { upsertPickSchema } from '../lib/validation/pick';

const router = Router();

// Every player-facing route requires a signed-in user.
router.use(requireAuth());

// GET /api/elections — elections a player can pick in.
router.get('/elections', async (_req, res) => {
  const elections = await prisma.election.findMany({
    select: { id: true, nameHe: true, lockAt: true, revealAt: true, resultsStatus: true },
    orderBy: { lockAt: 'asc' },
  });
  res.json(elections);
});

// GET /api/elections/:id — the election + its parties, FOR PLAYERS.
// Must not expose picks or scores.
router.get('/elections/:id', async (req, res) => {
  const id = String(req.params.id);
  const election = await prisma.election.findUnique({
    where: { id },
    select: {
      id: true,
      nameHe: true,
      lockAt: true,
      revealAt: true,
      resultsStatus: true,
      blocALabel: true,
      blocBLabel: true,
      parties: {
        orderBy: { displayOrder: 'asc' },
        select: { id: true, nameHe: true, logoUrl: true, bloc: true, displayOrder: true },
      },
    },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');
  res.json(election);
});

// GET /api/elections/:id/pick — the CURRENT user's pick (or null).
router.get('/elections/:id/pick', async (req, res) => {
  const electionId = String(req.params.id);
  const user = await ensureDbUser(getClerkId(req));
  const pick = await prisma.pick.findUnique({
    where: { userId_electionId: { userId: user.id, electionId } },
    include: { entries: { select: { partyId: true, mandates: true } } },
  });
  if (!pick) {
    res.json(null);
    return;
  }
  res.json({ entries: pick.entries, submittedAt: pick.submittedAt });
});

// PUT /api/elections/:id/pick — create-or-replace the current user's pick.
router.put('/elections/:id/pick', validate(upsertPickSchema), async (req, res) => {
  const electionId = String(req.params.id);
  const entries = req.body.entries as { partyId: string; mandates: number }[];

  const user = await ensureDbUser(getClerkId(req));

  const election = await prisma.election.findUnique({
    where: { id: electionId },
    include: { parties: { select: { id: true } } },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');

  // Edit-until-lock: once now >= lockAt the pick is frozen.
  if (election.lockAt && new Date() >= election.lockAt) {
    throw new HttpError(409, 'התחזיות ננעלו');
  }

  // The pick must cover EXACTLY the election's party list — no extras, none missing.
  const electionPartyIds = new Set(election.parties.map((p) => p.id));
  const entryPartyIds = new Set(entries.map((e) => e.partyId));
  const sameSet =
    electionPartyIds.size === entryPartyIds.size &&
    [...entryPartyIds].every((id) => electionPartyIds.has(id));
  if (!sameSet) {
    throw new HttpError(400, 'התחזית חייבת לכלול את כל המפלגות בבחירות');
  }

  const existing = await prisma.pick.findUnique({
    where: { userId_electionId: { userId: user.id, electionId } },
    select: { id: true },
  });

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const pick = await tx.pick.upsert({
      where: { userId_electionId: { userId: user.id, electionId } },
      create: { userId: user.id, electionId, submittedAt: now },
      update: { submittedAt: now },
    });
    await tx.pickEntry.deleteMany({ where: { pickId: pick.id } });
    await tx.pickEntry.createMany({
      data: entries.map((e) => ({ pickId: pick.id, partyId: e.partyId, mandates: e.mandates })),
    });
  });

  res.status(existing ? 200 : 201).json({ entries, submittedAt: now });
});

export default router;
