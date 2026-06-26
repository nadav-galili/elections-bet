# תחזית בחירות / Elections Bet — v1 Implementation Plan

A Hebrew, right-to-left web app where groups of friends predict the Knesset mandate split, lock in before election night, and watch a live leaderboard once results land. **Points-only — zero money in the system.** The closer your call, the higher your score.

> Status: greenfield. This document is the self-contained spec produced in the design/grilling session (2026-06-26) and approved for build.

---

## 1. Core mechanic

- **A pick = predicted mandates per party** across an admin-curated official party list, per election.
- Each party value is **`0` or `4–120`** — never 1/2/3 (the 3.25% electoral threshold means the real minimum is 4 seats).
- The whole pick must total **exactly 120** (live "remaining" counter).
- **One pick per `(user, election)`** — shown read-only inside every group the user is in. No per-group picks.
- "Passed threshold" = **≥4 mandates** in the results.

### Scoring = base + 3 bonuses (one pluggable function)

- **Base:** `240 − Σ|predicted − actual|` (higher is better; a perfect call = 240).
- **+10** — called the largest party (ties: match either tied-largest party).
- **+1 per party, capped at +10** — correctly called each party as in (≥4) vs out (0) of the Knesset.
- **+10** — called the **3-way bloc outcome**: Bloc A ≥ 61 / Bloc B ≥ 61 / Hung (neither — the unaligned/Arab parties hold the balance). Each party is admin-tagged A / B / Unaligned; the user's bloc call is **derived** from their mandate split. A and B can never both reach 61 (122 > 120), so the three outcomes are mutually exclusive.

---

## 2. Election-night timeline (two separate reveal events)

1. **Picks open** — admin opens the election; users create/edit picks freely.
2. **Lock (default 20:00 = polls-close − 2h, admin-configurable per election)** — picks freeze, no edits. A user with no pick is marked `לא הגיש` and excluded from ranking.
3. **Reveal picks (lock + offset, default 20:02)** — automatic timer. Everyone in a group sees each other's picks. **No scores yet.**
4. **Reveal scores (admin-triggered)** — one editable results set. Admin types in exit-poll numbers ~22:00 and Publishes → scores compute & reveal, labelled `מדגם` (provisional). Days later the admin updates to certified finals → scores auto-recompute, labelled `סופי` (final).

Before reveal, a group shows **who submitted** (✓) but never the numbers. Privacy enforced in the API layer (no Supabase RLS).

---

## 3. Stack

| Layer               | Choice                                                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Platform            | Web only, responsive, **Hebrew / RTL**. No native mobile.                                                                                                                      |
| Frontend            | Vite + React + TypeScript · Tailwind + shadcn/ui · React Router (SPA)                                                                                                          |
| Data fetching       | **Axios** (HTTP) + **TanStack Query** (cache, loading/server state, response lifecycle)                                                                                        |
| Forms               | **React Hook Form** + **Zod** (schema shared with API)                                                                                                                         |
| Tables              | **TanStack Table** (sort/filter/paginate — leaderboards, admin lists)                                                                                                          |
| Icons / Motion      | **Lucide** (`lucide-react`) · **Beui** = `github.com/starc007/ui-components` (animated/motion)                                                                                 |
| Backend             | Node.js + **Express 5** + TypeScript REST API                                                                                                                                  |
| Backend conventions | **No try/catch in async handlers** — Express 5 auto-forwards rejected promises to a **central error middleware**. **Zod**-validated requests.                                  |
| Auth                | **Clerk** (Google, Apple, email+password) · `@clerk/express` verifies tokens · users synced via webhook · `role` flag (USER / SUPER_ADMIN)                                     |
| Database            | **PostgreSQL** on Railway · **Prisma** + Prisma Migrate                                                                                                                        |
| Images              | **URLs only** (`logoUrl` text field) — no object storage. Avatars from Clerk.                                                                                                  |
| Deploy              | **Docker** on **Railway**                                                                                                                                                      |
| Repo                | **Single git repo**; `client/` + `server/` folders under root; root `concurrently` dev script runs both. **Bun** is the package manager (Bun workspaces); Node is the runtime. |
| Testing             | Favor **unit/component over E2E**. **Vitest + React Testing Library** (client) / Vitest (server). **Playwright** E2E via the `compound-engineering:playwright-test` skill.     |
| Pre-commit          | **Husky + lint-staged** → type-check + tests, set up via the `setup-pre-commit` skill                                                                                          |
| Docs                | Pull every package/tool's API fresh via **Context7** at scaffold time                                                                                                          |
| Timezone            | All lock/reveal/scoring in **Asia/Jerusalem** (store UTC)                                                                                                                      |

---

## 4. Groups, admin & leaderboards

- **Invites:** shareable per-group link; anyone can invite; click → Clerk sign-in → auto-join. Shared via WhatsApp. No email invites.
- **Leave / remove:** **no blocking ever** — leavers and admin-removed users can rejoin freely. Removal is a soft, reversible roster cleanup.
- **Group admin:** single admin (creator). Powers: soft-remove · rename · delete group. Transfer on demand; auto-promote earliest-joined member if an admin leaves untransferred. No co-admins.
- **Membership:** a user can be in many groups; no hard size cap. **Group-less play allowed** (global pick + global leaderboard without a group).
- **Global leaderboard:** editable display name (default Clerk first name) + avatar + score + rank. **No full picks globally.** Everyone auto-included. Pre-reveal = participation count. Ties share rank, earlier submission breaks. "Your rank" highlight + top-N + pagination.
- **Super-admin:** single super-admin (you), `role` flag seeded to your Clerk account. Dashboard: Elections (CRUD election, parties [Hebrew name, logoUrl, bloc tag], lock/reveal config, results entry & publish, recompute) · Groups god-mode (view all, delete, remove, reassign admin) · Users (search, rename, ban/delete) · Overview stats.
- **Reminders:** in-app countdown + `טרם הגשת תחזית` flag + WhatsApp out-of-band. Web push deferred.

---

## 5. Data model (Prisma + Postgres)

Picks & scores are **global per `(user, election)`**; groups are membership views.

- **User** — `id`, `clerkId` (unique), `displayName`, `avatarUrl`, `role` (USER | SUPER_ADMIN)
- **Election** — `id`, `nameHe`, `lockAt`, `revealAt`, `resultsStatus` (NONE | PROVISIONAL | FINAL), `resultsPublishedAt`, `blocALabel`, `blocBLabel`
- **Party** — `id`, `electionId`, `nameHe`, `logoUrl`, `bloc` (A | B | UNALIGNED), `displayOrder`, `actualMandates` (nullable)
- **Pick** — `id`, `userId`, `electionId` (unique together), `submittedAt`
- **PickEntry** — `id`, `pickId`, `partyId`, `mandates` (0 or 4–120)
- **Score** (materialized per user/election, recomputed on Publish) — `id`, `userId`, `electionId`, `base`, `bonusLargest`, `bonusThreshold`, `bonusBloc`, `total`
- **Group** — `id`, `nameHe`, `adminUserId`, `inviteToken` (unique)
- **GroupMembership** — `id`, `groupId`, `userId` (unique together), `joinedAt`

No blocking model: leaving/removal deletes the membership row; rejoining re-creates it.

---

## 6. Build sequence (8 milestones, each shippable)

- **M0 · Foundation** — single repo (`client/` + `server/` + `concurrently`); Vite/React/Tailwind/shadcn RTL shell wired with TanStack Query/Table, Axios, RHF+Zod, Lucide; Express 5 + Prisma + Postgres with central async error middleware; Docker; Clerk auth + webhook + role flag; Vitest + RTL + Playwright; Husky + lint-staged via `setup-pre-commit`; docs via Context7. → a logged-in Hebrew shell with the full toolchain.
- **M1 · Elections & parties** — Election + Party models; super-admin pages to create an election, CRUD parties (Hebrew name, logoUrl, bloc tag), set lock + reveal offset + bloc labels.
- **M2 · Pick flow** — global pick screen, validation (0 or 4–120, sum 120, live counter), edit-until-lock, freeze, "did not submit".
- **M3 · Groups** — create, invite link, auto-join, leave, soft-remove, transfer/auto-promote admin, rename, delete; who-submitted (pre-reveal) vs full picks (post-reveal).
- **M4 · Results & scoring** — results entry (validated 0/4+/sum 120), provisional/final, Publish, scoring engine (base + 3 bonuses), materialized Score, reveal-clock enforcement.
- **M5 · Leaderboards** — per-group + global boards, display name, your-rank highlight, pagination, pre-reveal participation count, tie handling.
- **M6 · Super-admin god-mode** — all-groups control, user moderation (rename/ban/delete), overview stats.
- **M7 · Polish & ship** — countdown, RTL/Hebrew copy pass, empty/error states, timezone + DST test, prod Docker/Railway deploy, full election-night smoke test.

---

## 7. Risks & open items

- **Hot-linked logos break** — hosts may block hotlinking or links die → use stable sources (Wikimedia); add fetch-cache later if needed.
- **No automated reminders** — people forget the 20:00 lock and get excluded. Accepted for v1; web push later.
- **Manual results = single human error point** on election night → mitigated by 0/4+ & sum-120 validation + a confirm step before Publish.
- **Provisional vs final confusion** — the `מדגם / סופי` label must be unmissable.
- **Timezone / DST** — all lock/reveal math in Asia/Jerusalem; test around the DST boundary.
- **External credentials needed from you:** Clerk keys (publishable + secret, with Google/Apple/email enabled), Railway Postgres `DATABASE_URL`. Scaffolded with `.env.example` placeholders.

## 8. v2 (deferred)

AI features — **Hebrew reveal commentary** + **WhatsApp recap** (leaning). Schema kept queryable so they slot in later. Built with the Claude API in Hebrew.
