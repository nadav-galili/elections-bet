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

// POST /api/admin/elections/:id/parties — add a party to an election.
router.post('/:id/parties', validate(createPartySchema), async (req, res) => {
  const electionId = String(req.params.id);
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election) throw new HttpError(404, 'הבחירות לא נמצאו');
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
  await prisma.party.delete({ where: { id: partyId } });
  res.status(204).end();
});

export default router;
