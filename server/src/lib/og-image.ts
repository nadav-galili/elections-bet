// Dynamic OG card generation — the viral surface for the public /forecast page.
//
// When a /forecast link is pasted into WhatsApp / X / Telegram, the unfurler reads
// the <head> og:image and renders a preview card. SVG won't unfurl, so we render
// the card as a PNG: satori turns a small VDOM tree into an SVG with EMBEDDED font
// glyphs (so RTL Hebrew renders even where the platform lacks the font), then
// @resvg/resvg-js rasterizes that SVG to PNG bytes.
//
// The fonts are VENDORED as .ttf buffers (src/assets/fonts) and registered with
// satori explicitly — satori needs TTF/OTF/WOFF (NOT woff2), and embedding the
// buffer is what guarantees the Hebrew glyphs ship in the rendered image.
//
// This module builds the PNG bytes purely from a forecast shape + a few labels; the
// caller (snapshot refresh) does the DB work and the persistence. The standard OG
// card size is 1200×630.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import type { Forecast } from './forecast';

/** Standard Open Graph card dimensions (most unfurlers expect ~1.91:1). */
export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

const FONTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

// Load the vendored STATIC TTFs once at module init. Buffers are reused across every
// render. Heebo carries the Hebrew body glyphs (regular + bold); Fredoka is the
// display face (regular + bold). Static (non-variable) TTFs are used deliberately:
// satori's bundled opentype.js parser chokes on the variable-font `fvar` table.
const heeboRegular = readFileSync(join(FONTS_DIR, 'Heebo-Regular.ttf'));
const heeboBold = readFileSync(join(FONTS_DIR, 'Heebo-Bold.ttf'));
const fredokaRegular = readFileSync(join(FONTS_DIR, 'Fredoka-Regular.ttf'));
const fredokaBold = readFileSync(join(FONTS_DIR, 'Fredoka-Bold.ttf'));

// satori font registrations. RTL Hebrew renders because the glyphs come from these
// embedded buffers, not the runtime's system fonts.
const fonts = [
  { name: 'Heebo', data: heeboRegular, weight: 400 as const, style: 'normal' as const },
  { name: 'Heebo', data: heeboBold, weight: 700 as const, style: 'normal' as const },
  { name: 'Fredoka', data: fredokaRegular, weight: 600 as const, style: 'normal' as const },
  { name: 'Fredoka', data: fredokaBold, weight: 700 as const, style: 'normal' as const },
];

// Design tokens (DESIGN.md) — kept inline so the card matches the HTML page.
const COLORS = {
  primary: '#13A8FF',
  accent: '#AA71FF',
  bg: '#0F172A',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#4B5563',
};

/** What the OG card needs to render: the verdict line + a couple of headline numbers. */
export interface OgCardInput {
  /** Election display name (Hebrew). */
  nameHe: string;
  /** The hero line: the bloc verdict (above threshold) or the count framing (below). */
  verdict: string;
  /** Eligible participation count (the social proof number). */
  participantCount: number;
  /** Whether aggregated numbers may be shown (mirrors Forecast.numbersVisible). */
  numbersVisible: boolean;
  /** Largest-party name (Hebrew) when known, else null. */
  largestPartyName: string | null;
  /** Bloc tally for the headline numbers, else null (below threshold). */
  blocTally: { sumA: number; sumB: number } | null;
  /** Bloc labels for the tally pills. */
  blocALabel: string | null;
  blocBLabel: string | null;
}

// Minimal satori VDOM node helper. satori accepts React-element-shaped objects
// ({ type, props: { style, children } }) — we build them directly to avoid pulling
// in React / JSX just for an image.
type Node = {
  type: string;
  props: { style: Record<string, unknown>; children?: unknown };
};
function el(type: string, style: Record<string, unknown>, children?: unknown): Node {
  return { type, props: { style, children } };
}

/** Build the satori VDOM tree for the card from the input. */
function buildTree(input: OgCardInput): Node {
  const count = input.participantCount.toLocaleString('he-IL');

  const children: Node[] = [
    // Eyebrow: election name.
    el(
      'div',
      {
        fontFamily: 'Heebo',
        fontSize: 34,
        fontWeight: 400,
        color: COLORS.textSecondary,
        marginBottom: 8,
      },
      input.nameHe,
    ),
    // Hero verdict (Fredoka display).
    el(
      'div',
      {
        fontFamily: 'Fredoka',
        fontSize: 78,
        fontWeight: 700,
        color: COLORS.primary,
        lineHeight: 1.1,
        textAlign: 'center',
        marginBottom: 24,
      },
      input.verdict,
    ),
  ];

  // Headline numbers row (only above threshold, when we have a tally).
  if (input.numbersVisible && input.blocTally) {
    const aLabel = input.blocALabel?.trim() || 'גוש א׳';
    const bLabel = input.blocBLabel?.trim() || 'גוש ב׳';
    const pill = (label: string, value: number, color: string): Node =>
      el(
        'div',
        {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '14px 28px',
          borderRadius: 16,
          backgroundColor: '#F1F5F9',
          margin: '0 10px',
        },
        [
          el('div', { fontFamily: 'Heebo', fontSize: 26, color: COLORS.textSecondary }, label),
          el(
            'div',
            { fontFamily: 'Fredoka', fontSize: 52, fontWeight: 700, color },
            value.toLocaleString('he-IL'),
          ),
        ],
      );
    children.push(
      el('div', { display: 'flex', flexDirection: 'row', marginBottom: 20 }, [
        pill(aLabel, input.blocTally.sumA, COLORS.primary),
        pill(bLabel, input.blocTally.sumB, COLORS.accent),
      ]),
    );
    if (input.largestPartyName) {
      children.push(
        el(
          'div',
          {
            fontFamily: 'Heebo',
            fontSize: 30,
            fontWeight: 700,
            color: COLORS.text,
            marginBottom: 12,
          },
          `המפלגה הגדולה: ${input.largestPartyName}`,
        ),
      );
    }
  }

  // Participation line — always present (the social proof).
  children.push(
    el(
      'div',
      { fontFamily: 'Heebo', fontSize: 34, fontWeight: 700, color: COLORS.text, marginBottom: 8 },
      `${count} ישראלים כבר ניבאו`,
    ),
  );

  // Branding footer.
  children.push(
    el(
      'div',
      { fontFamily: 'Fredoka', fontSize: 28, fontWeight: 600, color: COLORS.accent },
      'תחזית בחירות · משחק, לא סקר',
    ),
  );

  // Inner white card.
  const card = el(
    'div',
    {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.card,
      borderRadius: 36,
      padding: '56px 64px',
      width: OG_WIDTH - 96,
      height: OG_HEIGHT - 96,
      textAlign: 'center',
    },
    children,
  );

  // Outer frame (full bleed background).
  return el(
    'div',
    {
      display: 'flex',
      width: OG_WIDTH,
      height: OG_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: COLORS.bg,
      // RTL so Hebrew lays out correctly.
      direction: 'rtl',
    },
    card,
  );
}

/**
 * Render the OG card to PNG bytes. satori → SVG (with embedded glyphs), resvg → PNG.
 * Returns a Buffer of valid PNG bytes (starts with the PNG magic header).
 *
 * Kept dependency-light and pure over the input; the caller persists the bytes.
 */
export async function renderForecastOgPng(input: OgCardInput): Promise<Uint8Array<ArrayBuffer>> {
  const svg = await satori(buildTree(input) as unknown as Parameters<typeof satori>[0], {
    width: OG_WIDTH,
    height: OG_HEIGHT,
    fonts,
  });
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: OG_WIDTH } });
  const png = resvg.render().asPng();
  // Copy into a standalone ArrayBuffer-backed Uint8Array. Node's Buffer is backed by
  // a shared pool (ArrayBufferLike), which the Prisma Bytes input type rejects.
  const out = new Uint8Array(png.byteLength);
  out.set(png);
  return out;
}

/**
 * Convenience: derive the OG card input from a computed forecast + the human labels,
 * then render. Used at snapshot-refresh time so the PNG is materialized alongside the
 * snapshot. `verdict` is the same hero line the HTML head uses for og:title.
 */
export async function renderForecastOgPngFromForecast(args: {
  nameHe: string;
  verdict: string;
  forecast: Forecast;
  partyNames: Map<string, string>;
  blocALabel: string | null;
  blocBLabel: string | null;
}): Promise<Uint8Array<ArrayBuffer>> {
  const { forecast, partyNames } = args;
  const largestId = forecast.largestPartyIds?.[0] ?? null;
  const largestPartyName =
    forecast.numbersVisible && largestId ? (partyNames.get(largestId) ?? null) : null;
  return renderForecastOgPng({
    nameHe: args.nameHe,
    verdict: args.verdict,
    participantCount: forecast.participantCount,
    numbersVisible: forecast.numbersVisible,
    largestPartyName,
    blocTally: forecast.numbersVisible ? forecast.blocTally : null,
    blocALabel: args.blocALabel,
    blocBLabel: args.blocBLabel,
  });
}
