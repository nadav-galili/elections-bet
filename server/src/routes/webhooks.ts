import express, { Router } from 'express';
import { verifyWebhook } from '@clerk/express/webhooks';
import { prisma } from '../db';

const router = Router();

// POST /api/webhooks/clerk — keeps the local users table in sync with Clerk.
// Uses the raw body for signature verification (mounted before express.json()).
router.post('/clerk', express.raw({ type: 'application/json' }), async (req, res) => {
  const evt = await verifyWebhook(req);

  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const data = evt.data;
    const email = data.email_addresses?.[0]?.email_address ?? null;
    await prisma.user.upsert({
      where: { clerkId: data.id },
      create: {
        clerkId: data.id,
        email,
        displayName: data.first_name ?? null,
        avatarUrl: data.image_url ?? null,
      },
      update: {
        email,
        displayName: data.first_name ?? null,
        avatarUrl: data.image_url ?? null,
      },
    });
  } else if (evt.type === 'user.deleted') {
    if (evt.data.id) {
      await prisma.user.deleteMany({ where: { clerkId: evt.data.id } });
    }
  }

  res.json({ received: true });
});

export default router;
