// Materialized forecast cache — the read/refresh seam between the public /forecast
// route and the pure computeForecast() aggregator.
//
// Why this exists: re-aggregating every pick on every page load is wasteful for a
// shareable public page. Instead we MATERIALIZE the computed forecast into a
// ForecastSnapshot row (one current row per election, mirroring the materialized
// Score pattern) and refresh it on a relaxed cadence — no cron infra, just a lazy
// recompute the first time a read finds the snapshot older than SNAPSHOT_TTL_MS.
//
// Concurrency: a single Node server, so we guard the post-expiry recompute with an
// in-process SINGLE-FLIGHT lock (a module-level Map<electionId, Promise>). The first
// reader past the window kicks off the recompute; everyone else serves the slightly
// stale snapshot until that promise resolves, then subsequent reads pick up the
// fresh row. This caps the recompute to once per window regardless of read volume.
//
// Testability: SNAPSHOT_TTL_MS and "now" are both injectable (mirroring lib/time.ts
// taking a `now` param) so tests can drive freshness deterministically without
// sleeping.

import { prisma } from '../db';
import { blocVerdictText, computeForecast, type Forecast } from './forecast';
import { renderForecastOgPngFromForecast } from './og-image';

/**
 * Freshness window for a materialized snapshot, in milliseconds. A read that finds
 * the snapshot older than this triggers a lazy recompute. Default 8h ⇒ ~3 refreshes
 * a day under steady traffic, which is plenty for a crowd-forecast headline that
 * moves slowly. This is the one cadence knob — change it here. Overridable per call
 * for tests.
 */
export const SNAPSHOT_TTL_MS = 8 * 60 * 60 * 1000;

/** What a resolved snapshot read hands back to the route. */
export interface ForecastSnapshotResult {
  forecast: Forecast;
  /** partyId -> Hebrew name, for the mandate bar / movers. */
  partyNames: Map<string, string>;
  /** When this forecast was actually computed (the materialized row's timestamp). */
  computedAt: Date;
}

/**
 * The hero/verdict headline shared by the /forecast HTML hero, the og:title meta and
 * the OG image. Above threshold ⇒ the bloc verdict; below ⇒ the participation framing.
 * PURE so the page, the meta and the image always read identically.
 */
export function forecastVerdict(
  forecast: Forecast,
  blocALabel: string | null,
  blocBLabel: string | null,
): string {
  if (forecast.numbersVisible && forecast.blocCall) {
    return blocVerdictText(forecast.blocCall, blocALabel, blocBLabel);
  }
  return `${forecast.participantCount.toLocaleString('he-IL')} ישראלים כבר ניבאו`;
}

/**
 * The stored snapshot blob shape. We persist the full forecast plus the partyId->name
 * map (as a plain object, since Json can't hold a Map) so the route can render purely
 * from the snapshot without a second party query.
 */
interface SnapshotData {
  forecast: Forecast;
  partyNames: Record<string, string>;
}

// In-process single-flight registry: at most one in-flight recompute per election.
// Keyed by electionId; the value is the recompute promise. Cleared when it settles.
const inFlight = new Map<string, Promise<ForecastSnapshotResult>>();

/**
 * Run the pure aggregator against fresh DB state and persist the result as the
 * election's current snapshot (upsert: one row per election). Returns the freshly
 * computed result. The DB reads live here; computeForecast stays pure.
 */
async function recomputeAndPersist(electionId: string, now: Date): Promise<ForecastSnapshotResult> {
  const [picks, parties, election] = await Promise.all([
    prisma.pick.findMany({
      where: { electionId },
      select: { submittedAt: true, entries: { select: { partyId: true, mandates: true } } },
    }),
    prisma.party.findMany({
      where: { electionId },
      select: { id: true, nameHe: true, bloc: true, baselineMandates: true },
    }),
    prisma.election.findUnique({
      where: { id: electionId },
      select: { nameHe: true, blocALabel: true, blocBLabel: true },
    }),
  ]);

  const forecast = computeForecast(picks, parties);
  const partyNamesObj: Record<string, string> = {};
  for (const p of parties) partyNamesObj[p.id] = p.nameHe;
  const data: SnapshotData = { forecast, partyNames: partyNamesObj };

  // Materialize the OG card PNG alongside the snapshot so the unfurl image is ready
  // without per-request rendering. If generation fails for any reason, we still
  // persist the forecast (ogImage stays null) — the share image is best-effort and
  // must never block serving the page.
  const partyNames = new Map(Object.entries(partyNamesObj));
  let ogImage: Uint8Array<ArrayBuffer> | null = null;
  try {
    const png = await renderForecastOgPngFromForecast({
      nameHe: election?.nameHe ?? 'תחזית בחירות',
      verdict: forecastVerdict(
        forecast,
        election?.blocALabel ?? null,
        election?.blocBLabel ?? null,
      ),
      forecast,
      partyNames,
      blocALabel: election?.blocALabel ?? null,
      blocBLabel: election?.blocBLabel ?? null,
    });
    ogImage = png;
  } catch {
    ogImage = null;
  }

  await prisma.forecastSnapshot.upsert({
    where: { electionId },
    create: {
      electionId,
      data: data as unknown as object,
      participantCount: forecast.participantCount,
      ogImage,
      computedAt: now,
    },
    update: {
      data: data as unknown as object,
      participantCount: forecast.participantCount,
      ogImage,
      computedAt: now,
    },
  });

  return {
    forecast,
    partyNames,
    computedAt: now,
  };
}

/** Hydrate a stored snapshot row into a render-ready result. */
function hydrate(row: { data: unknown; computedAt: Date }): ForecastSnapshotResult {
  const data = row.data as SnapshotData;
  return {
    forecast: data.forecast,
    partyNames: new Map(Object.entries(data.partyNames ?? {})),
    computedAt: row.computedAt,
  };
}

/**
 * Get the materialized forecast for an election, recomputing lazily past the freshness
 * window. The route calls this instead of re-aggregating on every request.
 *
 * Behaviour:
 *  - No snapshot yet  ⇒ compute + persist synchronously (the first reader pays it).
 *  - Snapshot fresh   ⇒ serve it straight from the row, no recompute.
 *  - Snapshot stale   ⇒ trigger a recompute. The FIRST stale reader awaits it (and so
 *    receives fresh numbers); concurrent stale readers, finding a recompute already in
 *    flight, serve the slightly stale row immediately (single-flight). Once the
 *    in-flight recompute settles, the next read sees the fresh row.
 *
 * @param now  injectable clock (defaults to real now) so tests can drive freshness.
 * @param ttlMs injectable freshness window (defaults to SNAPSHOT_TTL_MS).
 */
export async function getForecastSnapshot(
  electionId: string,
  now: Date = new Date(),
  ttlMs: number = SNAPSHOT_TTL_MS,
): Promise<ForecastSnapshotResult> {
  const row = await prisma.forecastSnapshot.findUnique({ where: { electionId } });

  // Cold: no materialized row yet. Compute it now (this caller pays the cost).
  if (!row) {
    return runSingleFlight(electionId, now);
  }

  const ageMs = now.getTime() - row.computedAt.getTime();
  const stale = ageMs >= ttlMs;

  // Fresh enough: serve straight from the materialized row.
  if (!stale) {
    return hydrate(row);
  }

  // Stale. Is a recompute already running? If so, serve the stale row immediately
  // (single-flight: only one recompute per window, others read slightly-stale).
  if (inFlight.has(electionId)) {
    return hydrate(row);
  }

  // We're the first stale reader: kick off the recompute and await it (so we return
  // fresh numbers). Others arriving while it runs hit the branch above.
  return runSingleFlight(electionId, now);
}

/**
 * Get the materialized OG card PNG bytes for an election, or null if none can be
 * produced. Reads the stored `ogImage` column first; if it's missing (an older row,
 * or a row whose generation previously failed) it forces a fresh recompute — which
 * regenerates and persists the PNG — then re-reads. Returns null only if even the
 * recompute couldn't produce an image (e.g. satori unavailable), so the route can
 * 404 cleanly rather than 500.
 *
 * @param now injectable clock (defaults to real now), forwarded to the recompute.
 */
export async function getForecastOgImage(
  electionId: string,
  now: Date = new Date(),
): Promise<Buffer | null> {
  const row = await prisma.forecastSnapshot.findUnique({
    where: { electionId },
    select: { ogImage: true },
  });
  if (row?.ogImage) return Buffer.from(row.ogImage);

  // No stored image: materialize one (this also persists it), then re-read the bytes.
  await runSingleFlight(electionId, now);
  const fresh = await prisma.forecastSnapshot.findUnique({
    where: { electionId },
    select: { ogImage: true },
  });
  return fresh?.ogImage ? Buffer.from(fresh.ogImage) : null;
}

/**
 * Start (or join) the single recompute for this election. The promise is registered
 * in `inFlight` for the whole duration so concurrent callers can detect it, and is
 * cleared when it settles (success or failure).
 */
function runSingleFlight(electionId: string, now: Date): Promise<ForecastSnapshotResult> {
  const existing = inFlight.get(electionId);
  if (existing) return existing;

  const promise = recomputeAndPersist(electionId, now).finally(() => {
    inFlight.delete(electionId);
  });
  inFlight.set(electionId, promise);
  return promise;
}
