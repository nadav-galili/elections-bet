import { Router } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { getActiveElection } from '../lib/election';
import { computeForecast } from '../lib/forecast';

// PUBLIC, server-rendered forecast page. Mounted OUTSIDE clerkMiddleware (top-level
// in app.ts, like /health) so it needs no auth — shareable links must open for
// anyone. Returns text/html, NOT an SPA route.
const router = Router();

/** HTML-escape untrusted text before interpolating it into the page. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A graceful "no active election" page (still HTTP 200). */
function renderEmptyPage(): string {
  return page(
    'תחזית בחירות',
    `
      <main class="card">
        <h1>אין בחירות פעילות</h1>
        <p class="lede">עדיין אין סבב בחירות פתוח לתחזית. נתראה בסבב הבא.</p>
      </main>
    `,
  );
}

/**
 * The forecast page for a resolved election. The participation count is the hero
 * (numbers/bloc verdict are out of this slice); the framing is permanent; the CTA
 * deep-links into the SPA pick route on the SPA origin (a separate origin).
 */
function renderForecastPage(electionId: string, nameHe: string, participantCount: number): string {
  const pickUrl = `${env.CLIENT_ORIGIN}/elections/${encodeURIComponent(electionId)}/pick`;
  return page(
    `תחזית בחירות — ${esc(nameHe)}`,
    `
      <main class="card">
        <p class="eyebrow">${esc(nameHe)}</p>
        <p class="hero-count"><span class="count">${participantCount.toLocaleString('he-IL')}</span> ישראלים כבר ניבאו</p>
        <p class="framing">זה משחק, לא סקר. ניחוש מנדטים בין חברים — בלי כסף, רק נקודות וכבוד.</p>
        <a class="cta" href="${esc(pickUrl)}">נסו לנחש גם אתם</a>
      </main>
    `,
  );
}

/** Wrap content in the shared HTML shell (RTL Hebrew, DESIGN.md tokens). */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Heebo:wght@400;500;700&display=swap"
      rel="stylesheet"
    />
    <style>
      :root {
        --primary: #13a8ff;
        --accent: #aa71ff;
        --background: #f1f5f9;
        --text-primary: #111827;
        --text-secondary: #4b5563;
        --highlight-butter: #ffef9d;
        --highlight-peach: #fcc4a6;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
        background: var(--background);
        color: var(--text-primary);
        font-family: 'Heebo', sans-serif;
        font-size: 18px;
        line-height: 1.5;
      }
      .card {
        background: #fff;
        border-radius: 24px;
        padding: 40px 32px;
        max-width: 480px;
        width: 100%;
        text-align: center;
        box-shadow: 0 10px 40px rgba(17, 24, 39, 0.08);
      }
      h1 {
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 700;
        font-size: 32px;
        margin: 0 0 12px;
      }
      .eyebrow {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-secondary);
        margin: 0 0 8px;
      }
      .hero-count {
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 700;
        font-size: 30px;
        margin: 0 0 16px;
        line-height: 1.25;
      }
      .hero-count .count { color: var(--primary); }
      .framing,
      .lede {
        font-size: 18px;
        color: var(--text-secondary);
        margin: 0 0 28px;
      }
      .cta {
        display: inline-block;
        background: var(--accent);
        color: #fff;
        text-decoration: none;
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 600;
        font-size: 18px;
        padding: 14px 28px;
        border-radius: 16px;
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

/** Count submitted (eligible) picks for an election, then run the pure aggregator. */
async function forecastFor(electionId: string) {
  const picks = await prisma.pick.findMany({
    where: { electionId },
    select: { submittedAt: true },
  });
  return computeForecast(picks);
}

// GET /forecast — canonical link, resolves to the active election.
router.get('/', async (_req, res) => {
  const election = await getActiveElection();
  if (!election) {
    res.status(200).type('html').send(renderEmptyPage());
    return;
  }
  const { participantCount } = await forecastFor(election.id);
  res
    .status(200)
    .type('html')
    .send(renderForecastPage(election.id, election.nameHe, participantCount));
});

// GET /forecast/:electionId — stable per-election archive URL so shared links persist.
router.get('/:electionId', async (req, res) => {
  const electionId = String(req.params.electionId);
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, nameHe: true },
  });
  if (!election) {
    res.status(404).type('html').send(renderEmptyPage());
    return;
  }
  const { participantCount } = await forecastFor(election.id);
  res
    .status(200)
    .type('html')
    .send(renderForecastPage(election.id, election.nameHe, participantCount));
});

export default router;
