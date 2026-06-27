---
version: 'neuform-staff-featured-2026-05-22'
name: 'Space - Visual Ideation Workspace'
description: 'Space Visual Feature Section is designed for highlighting product capabilities and value points. Key features include reusable structure, responsive behavior, and production-ready presentation. It is suitable for component libraries and responsive product interfaces.'
colors:
  primary: '#13A8FF'
  secondary: '#F1F5F9'
  accent: '#AA71FF'
  background: '#F1F5F9'
  surface: '#27272A'
  text-primary: '#111827'
  text-secondary: '#4B5563'
  border: '#27272A'
  highlight-peach: '#FCC4A6'
  highlight-mint: '#A8EFCF'
  highlight-butter: '#FFEF9D'
typography:
  display-lg:
    fontFamily: 'Chewy'
    fontSize: '64px'
    fontWeight: 500
    lineHeight: '1.04'
    letterSpacing: '0'
  body-md:
    fontFamily: 'Patrick Hand'
    fontSize: '16px'
    fontWeight: 400
    lineHeight: '1.6'
  label-md:
    fontFamily: 'JetBrains Mono'
    fontSize: '12px'
    fontWeight: 600
    lineHeight: '1.2'
spacing:
  base: '8px'
  gap: '16px'
  card-padding: '24px'
  section-padding: '80px'
rounded:
  card: '4px'
  control: '12px'
  pill: '9999px'
components:
  card:
    background: 'Use the surface token with subtle borders and HTML-matched shadow depth'
    radius: 'Match the declared card radius token'
  button:
    background: 'Use primary or accent colors for the main action'
    radius: 'Use the control or pill radius based on the source HTML'
---

# Space - Visual Ideation Workspace

Source: Neuform staff featured templates. Author: Sourasith Phomhome (@madebysourasith). Views: 190; favorites: 11; remixes: 3.
Tags: feature, section, animated, cta.

## Overview

Space Visual Feature Section is designed for highlighting product capabilities and value points. Key features include reusable structure, responsive behavior, and production-ready presentation. It is suitable for component libraries and responsive product interfaces.

S Workspace Features Templates Use Cases Pricing Support Log in Start free Live syncing Quick templates Infinite area Co-creation ready Express ideas visually T Visual ideation workspace SPACE Brainstorm, design, and ex…

## Composition

Use the attached HTML reference as the source of truth. Preserve the visible hierarchy, first-screen composition, section rhythm, density, and interaction tone before adapting copy or content.
Key visible headings include: SPACE.

## Colors

Anchor the palette in primary #13A8FF, secondary #F1F5F9, accent #AA71FF, background #F1F5F9, surface #27272A, text-primary #111827. Keep background, surface, text, and border roles distinct so generated layouts retain the same contrast pattern as the source.

### Candy highlight trio

On top of the anchor palette, three soft pastels act as a decorative highlight set — never as primary actions, body text, or large fills. Use them sparingly to make the interface feel playful and to encode meaning:

- highlight-mint #A8EFCF — positive / success / "on target" (correct predictions, the lead bloc, healthy status).
- highlight-peach #FCC4A6 — warm emphasis (featured tiles, hero wash, secondary spotlights, friendly empty states).
- highlight-butter #FFEF9D — bonus / attention (largest-party and bonus moments, badges, marquee accents).
  Pair every pastel surface with the dark text-primary #111827 (or the ink surface) for contrast — pastels are background-and-accent roles, not text colors. Keep at most two of the three on screen at once so the palette stays intentional, not busy.

## Typography

Use Chewy for display moments and Patrick Hand for body copy unless the HTML clearly demands a compatible fallback. Labels and technical metadata should use JetBrains Mono or an equivalent mono face.

### Hebrew / RTL adaptation (this app)

Chewy and Patrick Hand carry no Hebrew glyphs, so in this RTL Hebrew product map them to Hebrew-capable equivalents that keep the same rounded, friendly spirit: display → "Fredoka" (fallback "Heebo"), body → "Heebo". JetBrains Mono stays for LTR labels, IDs, and tabular numbers only. Never render Hebrew copy in a Latin-only face.

## Layout

Keep spacing deliberate and stable. Favor the same grid direction, max-width behavior, card density, and responsive stacking seen in the HTML. Do not replace distinctive source structures with generic SaaS sections.

## Components

Authentication and CTA controls should preserve the source button hierarchy, input density, and focused conversion path.

## Motion

Preserve existing motion cues such as masked reveals, staggered entrance, hover lift, scroll-triggered transitions, and ambient movement. Keep easing smooth and restrained.

## WebGL & Effects

If the source includes canvas, WebGL, Three.js, gradients, particles, or atmospheric effects, rebuild them as supporting layers behind the content. Keep effects performant, responsive, and secondary to the interface.

## Guardrails

- Do not flatten the source into a generic card grid.
- Do not swap the color mode unless the source clearly supports it.
- Preserve the first viewport signal, focal object, and visual density.
- Keep buttons, cards, and badges aligned to the same radius and border language.
