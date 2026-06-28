import { Router } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { getActiveElection } from '../lib/election';
import { computeForecast, type Forecast } from '../lib/forecast';
import { isLocked } from '../lib/time';

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

/** Hebrew label for a derived bloc call, using the election's own bloc labels. */
function blocVerdictText(
  call: 'A' | 'B' | 'HUNG',
  blocALabel: string | null,
  blocBLabel: string | null,
): string {
  const aName = blocALabel?.trim() || 'גוש א׳';
  const bName = blocBLabel?.trim() || 'גוש ב׳';
  if (call === 'A') return `${aName} מקבל רוב`;
  if (call === 'B') return `${bName} מקבל רוב`;
  return 'אף גוש לא מקבל רוב';
}

/**
 * The forecast page for a resolved election.
 *
 * Below the reveal threshold (`numbersVisible=false`) the participation count is the
 * hero and no numbers leak. At/above it, the bloc verdict becomes the hero and the
 * trimmed mandate forecast bar renders (largest party highlighted). The framing is
 * permanent; the CTA deep-links into the SPA pick route on the SPA origin.
 */
function renderForecastPage(
  electionId: string,
  nameHe: string,
  forecast: Forecast,
  partyNames: Map<string, string>,
  blocALabel: string | null,
  blocBLabel: string | null,
  lockAt: Date | null,
): string {
  // Lock-aware CTA: a stranger who signs up should land where they can still act.
  // PRE-lock → the active-election pick screen (highest-intent path). POST-lock →
  // the reveal / leaderboard view (still captures the sign-up; never a frozen,
  // dead-end pick screen). Both deep-link into the SPA on CLIENT_ORIGIN.
  const locked = isLocked(lockAt);
  const ctaUrl = locked
    ? `${env.CLIENT_ORIGIN}/leaderboard`
    : `${env.CLIENT_ORIGIN}/elections/${encodeURIComponent(electionId)}/pick`;
  const ctaLabel = locked ? 'התחזיות ננעלו — לצפייה בתוצאות' : 'נסו לנחש גם אתם';

  let hero: string;
  let numbers = '';
  if (forecast.numbersVisible && forecast.parties && forecast.blocCall) {
    // ABOVE threshold: bloc verdict is the hero, mandate bar below it.
    const largest = new Set(forecast.largestPartyIds ?? []);
    const maxAvg = forecast.parties.reduce((m, p) => Math.max(m, p.avgMandates), 0) || 1;
    const rows = forecast.parties
      .map((p) => {
        const name = partyNames.get(p.partyId) ?? p.partyId;
        const pct = Math.max(2, Math.round((p.avgMandates / maxAvg) * 100));
        const isTop = largest.has(p.partyId);
        return `
        <li class="bar-row${isTop ? ' is-top' : ''}">
          <span class="bar-name">${esc(name)}</span>
          <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
          <span class="bar-val">${p.avgMandates.toLocaleString('he-IL')}</span>
        </li>`;
      })
      .join('');
    hero = `
        <p class="eyebrow">${esc(nameHe)} · לפי ${forecast.participantCount.toLocaleString('he-IL')} תחזיות</p>
        <p class="hero-verdict">${esc(blocVerdictText(forecast.blocCall, blocALabel, blocBLabel))}</p>`;
    numbers = `
        <p class="bar-title">תחזית המנדטים (ממוצע מנוכה)</p>
        <ul class="bar-list">${rows}</ul>`;
  } else {
    // BELOW threshold: participation count is the hero, no numbers.
    hero = `
        <p class="eyebrow">${esc(nameHe)}</p>
        <p class="hero-count"><span class="count">${forecast.participantCount.toLocaleString('he-IL')}</span> ישראלים כבר ניבאו</p>`;
  }

  return page(
    `תחזית בחירות — ${esc(nameHe)}`,
    `
      <main class="card">
        ${hero}
        ${numbers}
        <p class="framing">זה משחק, לא סקר. ניחוש מנדטים בין חברים — בלי כסף, רק נקודות וכבוד.</p>
        <a class="cta" href="${esc(ctaUrl)}">${esc(ctaLabel)}</a>
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
      .hero-verdict {
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 700;
        font-size: 30px;
        color: var(--primary);
        margin: 0 0 20px;
        line-height: 1.2;
      }
      .bar-title {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-secondary);
        margin: 0 0 12px;
      }
      .bar-list {
        list-style: none;
        margin: 0 0 24px;
        padding: 0;
        text-align: start;
      }
      .bar-row {
        display: grid;
        grid-template-columns: minmax(72px, 28%) 1fr auto;
        align-items: center;
        gap: 10px;
        margin: 0 0 10px;
      }
      .bar-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .bar-track {
        background: var(--background);
        border-radius: 8px;
        height: 14px;
        overflow: hidden;
      }
      .bar-fill {
        display: block;
        height: 100%;
        background: var(--primary);
        border-radius: 8px;
      }
      .bar-val {
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 600;
        font-size: 16px;
        color: var(--text-secondary);
        min-width: 36px;
        text-align: start;
      }
      .bar-row.is-top .bar-name { font-weight: 700; }
      .bar-row.is-top .bar-fill { background: var(--accent); }
      .bar-row.is-top .bar-val { color: var(--accent); }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

/**
 * Load an election's picks (with entries) + parties, then run the pure aggregator.
 * Returns the forecast plus a partyId->name lookup for the mandate bar. The DB read
 * lives here; computeForecast stays pure (gets the already-loaded data).
 */
async function forecastFor(electionId: string) {
  const [picks, parties] = await Promise.all([
    prisma.pick.findMany({
      where: { electionId },
      select: { submittedAt: true, entries: { select: { partyId: true, mandates: true } } },
    }),
    prisma.party.findMany({
      where: { electionId },
      select: { id: true, nameHe: true, bloc: true },
    }),
  ]);
  const forecast = computeForecast(picks, parties);
  const partyNames = new Map(parties.map((p) => [p.id, p.nameHe]));
  return { forecast, partyNames };
}

// GET /forecast — canonical link, resolves to the active election.
router.get('/', async (_req, res) => {
  const election = await getActiveElection();
  if (!election) {
    res.status(200).type('html').send(renderEmptyPage());
    return;
  }
  const { forecast, partyNames } = await forecastFor(election.id);
  res
    .status(200)
    .type('html')
    .send(
      renderForecastPage(
        election.id,
        election.nameHe,
        forecast,
        partyNames,
        election.blocALabel,
        election.blocBLabel,
        election.lockAt,
      ),
    );
});

// GET /forecast/:electionId — stable per-election archive URL so shared links persist.
router.get('/:electionId', async (req, res) => {
  const electionId = String(req.params.electionId);
  const election = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true, nameHe: true, blocALabel: true, blocBLabel: true, lockAt: true },
  });
  if (!election) {
    res.status(404).type('html').send(renderEmptyPage());
    return;
  }
  const { forecast, partyNames } = await forecastFor(election.id);
  res
    .status(200)
    .type('html')
    .send(
      renderForecastPage(
        election.id,
        election.nameHe,
        forecast,
        partyNames,
        election.blocALabel,
        election.blocBLabel,
        election.lockAt,
      ),
    );
});

export default router;
