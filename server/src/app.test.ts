import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app';

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'elections-bet-api' });
  });
});

describe('GET /api/me', () => {
  it('is protected — no data without auth', async () => {
    const res = await request(createApp()).get('/api/me');
    // Clerk's requireAuth() blocks unauthenticated requests (401/redirect),
    // never 200 with a body.
    expect(res.status).not.toBe(200);
  });
});
