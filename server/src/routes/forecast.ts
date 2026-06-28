import { Router, type Request } from 'express';
import { prisma } from '../db';
import { env } from '../env';
import { getActiveElection } from '../lib/election';
import { blocVerdictText, type Forecast } from '../lib/forecast';
import { forecastVerdict, getForecastOgImage, getForecastSnapshot } from '../lib/forecast-snapshot';
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

/**
 * Absolute base URL of THIS server (the API origin serving /forecast/og.png), derived
 * from the request so og:image is a fully-qualified URL behind any host/proxy. Honors
 * X-Forwarded-Proto/Host when present (the deployed app sits behind a proxy).
 */
function serverBaseUrl(req: Request): string {
  const proto = (req.headers['x-forwarded-proto'] as string)?.split(',')[0]?.trim() || req.protocol;
  const host = (req.headers['x-forwarded-host'] as string) || req.get('host') || '';
  return `${proto}://${host}`;
}

/** Open Graph / Twitter card meta for the unfurl preview. */
interface OgMeta {
  /** og:title — the bloc verdict (or count framing below threshold). */
  title: string;
  /** Absolute og:image URL pointing at GET /forecast/og.png. */
  image: string;
  /** Canonical absolute page URL. */
  url: string;
  description: string;
}

/**
 * The "biggest movers" section: the crowd's gains/losses vs each party's baseline.
 * Rendered only above the threshold, alongside the mandate bar. Withheld entirely
 * when no party has a baseline (both lists empty). A baseline of 0 surfaces as a
 * brand-new entrant (delta == the full forecast).
 */
function renderMovers(forecast: Forecast, partyNames: Map<string, string>): string {
  const gainers = forecast.biggestGainers ?? [];
  const losers = forecast.biggestLosers ?? [];
  if (gainers.length === 0 && losers.length === 0) return '';

  const moverRow = (m: { partyId: string; delta: number }, dir: 'up' | 'down'): string => {
    const name = partyNames.get(m.partyId) ?? m.partyId;
    const sign = m.delta > 0 ? '+' : '−';
    const mag = Math.abs(m.delta).toLocaleString('he-IL');
    return `
        <li class="mover-row mover-${dir}">
          <span class="mover-name">${esc(name)}</span>
          <span class="mover-delta">${sign}${mag}</span>
        </li>`;
  };

  const gainList =
    gainers.length > 0
      ? `<div class="mover-col">
          <p class="mover-head">העולים</p>
          <ul class="mover-list">${gainers.map((m) => moverRow(m, 'up')).join('')}</ul>
        </div>`
      : '';
  const loseList =
    losers.length > 0
      ? `<div class="mover-col">
          <p class="mover-head">היורדים</p>
          <ul class="mover-list">${losers.map((m) => moverRow(m, 'down')).join('')}</ul>
        </div>`
      : '';

  return `
        <p class="bar-title">התנועה הגדולה ביותר (מול הבסיס)</p>
        <div class="movers">${gainList}${loseList}</div>`;
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
  og: OgMeta,
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
        <ul class="bar-list">${rows}</ul>${renderMovers(forecast, partyNames)}`;
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
    og,
  );
}

/** Render the Open Graph + Twitter card meta tags for the unfurl preview. */
function ogMetaTags(og: OgMeta): string {
  return `
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${esc(og.title)}" />
    <meta property="og:description" content="${esc(og.description)}" />
    <meta property="og:image" content="${esc(og.image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:url" content="${esc(og.url)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(og.title)}" />
    <meta name="twitter:description" content="${esc(og.description)}" />
    <meta name="twitter:image" content="${esc(og.image)}" />`;
}

/** Wrap content in the shared HTML shell (RTL Hebrew, DESIGN.md tokens). */
function page(title: string, body: string, og?: OgMeta): string {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>${og ? ogMetaTags(og) : ''}
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
      .movers {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
        margin: 0 0 24px;
        text-align: start;
      }
      .movers:has(.mover-col:only-child) { grid-template-columns: 1fr; }
      .mover-head {
        font-size: 15px;
        font-weight: 700;
        color: var(--text-secondary);
        margin: 0 0 8px;
      }
      .mover-list { list-style: none; margin: 0; padding: 0; }
      .mover-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin: 0 0 6px;
        font-size: 15px;
      }
      .mover-name {
        font-weight: 500;
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mover-delta {
        font-family: 'Fredoka', 'Heebo', sans-serif;
        font-weight: 700;
        font-size: 16px;
      }
      .mover-up .mover-delta { color: #16a34a; }
      .mover-down .mover-delta { color: #dc2626; }
    </style>
  </head>
  <body>${body}</body>
</html>`;
}

/**
 * Serve the materialized OG PNG bytes for an election (image/png + cache headers).
 * Used by both the canonical and per-election og.png endpoints. 404s cleanly (never
 * 500s) when no image can be produced, so a failed render doesn't break unfurls hard.
 */
async function sendOgImage(electionId: string, res: import('express').Response): Promise<void> {
  const png = await getForecastOgImage(electionId);
  if (!png) {
    res.status(404).type('text/plain').send('not found');
    return;
  }
  res
    .status(200)
    .type('image/png')
    // Cache for an hour at the edge; well under the snapshot freshness window so a
    // refreshed card propagates within a cycle. Unfurlers also cache aggressively.
    .set('Cache-Control', 'public, max-age=3600')
    .send(png);
}

// GET /forecast/og.png — the canonical OG image (active election). Registered BEFORE
// the /:electionId catch-all so "og.png" isn't swallowed as an election id.
router.get('/og.png', async (_req, res) => {
  const election = await getActiveElection();
  if (!election) {
    res.status(404).type('text/plain').send('not found');
    return;
  }
  await sendOgImage(election.id, res);
});

// GET /forecast — canonical link, resolves to the active election.
router.get('/', async (req, res) => {
  const election = await getActiveElection();
  if (!election) {
    res.status(200).type('html').send(renderEmptyPage());
    return;
  }
  // Served from the materialized snapshot (lazy refresh past the freshness window,
  // single-flight on concurrent post-expiry reads) — NOT recomputed per request.
  const { forecast, partyNames } = await getForecastSnapshot(election.id);
  const base = serverBaseUrl(req);
  const og: OgMeta = {
    title: forecastVerdict(forecast, election.blocALabel, election.blocBLabel),
    image: `${base}/forecast/og.png`,
    url: `${base}/forecast`,
    description: 'זה משחק, לא סקר. ניחוש מנדטים בין חברים — בלי כסף, רק נקודות וכבוד.',
  };
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
        og,
      ),
    );
});

// GET /forecast/:electionId/og.png — per-election OG image (stable archive share).
router.get('/:electionId/og.png', async (req, res) => {
  const electionId = String(req.params.electionId);
  const exists = await prisma.election.findUnique({
    where: { id: electionId },
    select: { id: true },
  });
  if (!exists) {
    res.status(404).type('text/plain').send('not found');
    return;
  }
  await sendOgImage(electionId, res);
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
  const { forecast, partyNames } = await getForecastSnapshot(election.id);
  const base = serverBaseUrl(req);
  const og: OgMeta = {
    title: forecastVerdict(forecast, election.blocALabel, election.blocBLabel),
    image: `${base}/forecast/${encodeURIComponent(election.id)}/og.png`,
    url: `${base}/forecast/${encodeURIComponent(election.id)}`,
    description: 'זה משחק, לא סקר. ניחוש מנדטים בין חברים — בלי כסף, רק נקודות וכבוד.',
  };
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
        og,
      ),
    );
});

export default router;
