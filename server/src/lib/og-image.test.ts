import { describe, it, expect } from 'vitest';
import { renderForecastOgPng, OG_WIDTH, OG_HEIGHT } from './og-image';

// PNG files begin with this 8-byte magic signature.
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

// Build-risk retirement: prove satori + resvg render RTL Hebrew with the EMBEDDED
// vendored fonts into real PNG bytes BEFORE we wire the layout into the app. If this
// passes, the rendering pipeline (TTF buffers → SVG with glyphs → PNG) works end to end.
describe('renderForecastOgPng — satori RTL-Hebrew → PNG pipeline', () => {
  it('renders an above-threshold card to non-empty PNG bytes with the PNG magic header', async () => {
    const png = await renderForecastOgPng({
      nameHe: 'בחירות 2026',
      verdict: 'הימין מקבל רוב',
      participantCount: 1234,
      numbersVisible: true,
      largestPartyName: 'הליכוד',
      blocTally: { sumA: 65, sumB: 55 },
      blocALabel: 'הימין',
      blocBLabel: 'השמאל',
    });
    expect(png.length).toBeGreaterThan(1000);
    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_MAGIC);
  });

  it('renders a below-threshold (count-only) card to valid PNG bytes', async () => {
    const png = await renderForecastOgPng({
      nameHe: 'בחירות 2026',
      verdict: '12,000 ישראלים כבר ניבאו',
      participantCount: 42,
      numbersVisible: false,
      largestPartyName: null,
      blocTally: null,
      blocALabel: null,
      blocBLabel: null,
    });
    expect(png.length).toBeGreaterThan(1000);
    expect(Array.from(png.subarray(0, 8))).toEqual(PNG_MAGIC);
  });

  it('exposes the standard 1200×630 OG dimensions', () => {
    expect(OG_WIDTH).toBe(1200);
    expect(OG_HEIGHT).toBe(630);
  });
});
