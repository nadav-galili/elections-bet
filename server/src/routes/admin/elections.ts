import { Router } from 'express';
import { prisma } from '../../db';
import { HttpError } from '../../middleware/error';
import { validate } from '../../middleware/validate';
import {
  createElectionSchema,
  updateElectionSchema,
  createPartySchema,
  updatePartySchema,
} from '../../lib/validation/election';
import { setResultsSchema, publishSchema } from '../../lib/validation/results';
import { computeScore, type ResultParty } from '../../lib/scoring';

const router = Router();

// GET /api/admin/elections — list elections with their party counts.
router.get('/', async (_req, res) => {
  const elections = await prisma.election.findMany({
    include: { _count: { select: { parties: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(elections);
});

// POST /api/admin/elections — create an election.
router.post('/', validate(createElectionSchema), async (req, res) => {
  const election = await prisma.election.create({ data: req.body });
  res.status(201).json(election);
});

// GET /api/admin/elections/:id — one election with its ordered parties.
router.get('/:id', async (req, res) => {
  const id = String(req.params.id);
  const election = await prisma.election.findUnique({
    where: { id },
    include: { parties: { orderBy: { displayOrder: 'asc' } } },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');
  res.json(election);
});

// PATCH /api/admin/elections/:id — update an election.
router.patch('/:id', validate(updateElectionSchema), async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.election.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'הבחירות לא נמצאו');
  const election = await prisma.election.update({ where: { id }, data: req.body });
  res.json(election);
});

// DELETE /api/admin/elections/:id — delete an election (cascades to parties).
router.delete('/:id', async (req, res) => {
  const id = String(req.params.id);
  const existing = await prisma.election.findUnique({ where: { id } });
  if (!existing) throw new HttpError(404, 'הבחירות לא נמצאו');
  await prisma.election.delete({ where: { id } });
  res.status(204).end();
});

// Once any user has submitted a pick, the party SET is frozen: picks are
// validated against the party list at submission time, so adding/removing a
// party afterwards would silently mis-score those picks at publish (a missing
// prediction reads as 0). Editing a party in place stays allowed.
async function assertPartySetMutable(electionId: string): Promise<void> {
  const pickCount = await prisma.pick.count({ where: { electionId } });
  if (pickCount > 0) {
    throw new HttpError(409, 'לא ניתן לשנות את רשימת המפלגות לאחר שהוגשו תחזיות');
  }
}

// POST /api/admin/elections/:id/parties — add a party to an election.
router.post('/:id/parties', validate(createPartySchema), async (req, res) => {
  const electionId = String(req.params.id);
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');
  await assertPartySetMutable(electionId);
  const party = await prisma.party.create({ data: { ...req.body, electionId } });
  res.status(201).json(party);
});

// PATCH /api/admin/elections/:id/parties/:partyId — update a party.
router.patch('/:id/parties/:partyId', validate(updatePartySchema), async (req, res) => {
  const electionId = String(req.params.id);
  const partyId = String(req.params.partyId);
  const party = await prisma.party.findFirst({ where: { id: partyId, electionId } });
  if (!party) throw new HttpError(404, 'הרשימה לא נמצאה');
  const updated = await prisma.party.update({ where: { id: partyId }, data: req.body });
  res.json(updated);
});

// DELETE /api/admin/elections/:id/parties/:partyId — delete a party.
router.delete('/:id/parties/:partyId', async (req, res) => {
  const electionId = String(req.params.id);
  const partyId = String(req.params.partyId);
  const party = await prisma.party.findFirst({ where: { id: partyId, electionId } });
  if (!party) throw new HttpError(404, 'הרשימה לא נמצאה');
  await assertPartySetMutable(electionId);
  await prisma.party.delete({ where: { id: partyId } });
  res.status(204).end();
});

// PATCH /api/admin/elections/:id/results — set each party's actual mandates.
// Does NOT change resultsStatus (that happens at publish time).
router.patch('/:id/results', validate(setResultsSchema), async (req, res) => {
  const id = String(req.params.id);
  const entries = req.body.entries as { partyId: string; actualMandates: number }[];

  const election = await prisma.election.findUnique({
    where: { id },
    include: { parties: { select: { id: true } } },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');

  // The results must cover EXACTLY the election's party list — same check as picks.
  const electionPartyIds = new Set(election.parties.map((p) => p.id));
  const entryPartyIds = new Set(entries.map((e) => e.partyId));
  const sameSet =
    electionPartyIds.size === entryPartyIds.size &&
    [...entryPartyIds].every((pid) => electionPartyIds.has(pid));
  if (!sameSet) {
    throw new HttpError(400, 'התוצאות חייבות לכלול את כל המפלגות בבחירות');
  }

  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      await tx.party.update({
        where: { id: e.partyId },
        data: { actualMandates: e.actualMandates },
      });
    }
  });

  const updated = await prisma.election.findUnique({
    where: { id },
    include: { parties: { orderBy: { displayOrder: 'asc' } } },
  });
  res.json(updated);
});

// POST /api/admin/elections/:id/publish — recompute & persist Scores, set status.
// Idempotent: re-running upserts Scores and re-applies the chosen status.
// This is the ONLY writer of Score (privacy: no player-facing scores endpoint).
router.post('/:id/publish', validate(publishSchema), async (req, res) => {
  const id = String(req.params.id);
  const status = req.body.status as 'PROVISIONAL' | 'FINAL';

  const election = await prisma.election.findUnique({
    where: { id },
    include: {
      parties: { select: { id: true, bloc: true, actualMandates: true } },
      picks: {
        select: {
          userId: true,
          entries: { select: { partyId: true, mandates: true } },
        },
      },
    },
  });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');

  // Results must be fully entered and valid (every party set, sum === 120).
  const allSet = election.parties.every((p) => p.actualMandates != null);
  const total = election.parties.reduce((sum, p) => sum + (p.actualMandates ?? 0), 0);
  if (!allSet || total !== 120) {
    throw new HttpError(400, 'יש להזין תוצאות תקינות (סכום 120) לפני פרסום');
  }

  const resultParties: ResultParty[] = election.parties.map((p) => ({
    id: p.id,
    bloc: p.bloc,
    actualMandates: p.actualMandates as number,
  }));

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const pick of election.picks) {
      const predicted = new Map<string, number>(pick.entries.map((e) => [e.partyId, e.mandates]));
      const breakdown = computeScore(predicted, resultParties);
      await tx.score.upsert({
        where: { userId_electionId: { userId: pick.userId, electionId: id } },
        create: {
          userId: pick.userId,
          electionId: id,
          base: breakdown.base,
          bonusLargest: breakdown.bonusLargest,
          bonusThreshold: breakdown.bonusThreshold,
          bonusBloc: breakdown.bonusBloc,
          total: breakdown.total,
          computedAt: now,
        },
        update: {
          base: breakdown.base,
          bonusLargest: breakdown.bonusLargest,
          bonusThreshold: breakdown.bonusThreshold,
          bonusBloc: breakdown.bonusBloc,
          total: breakdown.total,
          computedAt: now,
        },
      });
    }
    await tx.election.update({
      where: { id },
      data: { resultsStatus: status, resultsPublishedAt: now },
    });
  });

  const updated = await prisma.election.findUnique({
    where: { id },
    include: { parties: { orderBy: { displayOrder: 'asc' } } },
  });
  res.json(updated);
});

export default router;
