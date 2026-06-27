# SMOKE-TEST · election-night runbook (manual, non-Docker)

The end-to-end manual test from issue #6. One operator drives a full election-night
cycle locally — create election → two valid picks + one no-pick → lock → reveal picks
→ publish `מדגם` → update to `סופי` → verify both leaderboards.

This runbook is **non-Docker**. The deploy/Railway variant lives in **issue #12** —
when running against the deployed app, skip the "How to run locally" section, use the
deployed URL instead of `localhost`, and run the `db:make-admin` / `db:seed-parties`
scripts against the Railway `DATABASE_URL` (see issue #12 for credentials and the
`db:deploy` migration step). Every product step below is identical on deploy.

Source of truth: `implementation-plan.md` §1 (scoring) and §2 (timeline). Routes:
`server/src/routes/picks.ts`, `server/src/routes/leaderboard.ts`,
`server/src/routes/admin/elections.ts`.

---

## How to run locally

Prereqs (per `CLAUDE.md` + project memory):

1. **Native Postgres on `localhost:5432`** — NOT the Docker compose DB. Role
   `nadavgalili` (trust auth), database `elections_bet`. Confirm
   `server/.env` has:
   ```
   DATABASE_URL=postgresql://nadavgalili@localhost:5432/elections_bet?schema=public
   ```
2. **Clerk keys** in `client/.env` (`VITE_CLERK_PUBLISHABLE_KEY`) and `server/.env`
   (`CLERK_SECRET_KEY` + publishable). Without the client key you get the
   "missing config" screen instead of the app.
3. Apply migrations once (the 9 tables):
   ```
   bun run --filter server db:migrate
   ```
4. Start both apps (client + server) from the repo root:
   ```
   bun run dev
   ```
   Client on Vite's dev port, server on its Express port. The client attaches the
   Clerk bearer token to every `VITE_API_BASE_URL` call via `useApi()`.

You need **three browser identities** for this test (super-admin + 2 players). Use
your normal browser profile for the admin, plus two incognito/private windows (or two
separate Clerk accounts) for the players so their sessions don't collide.

---

## DST / timezone note (READ before setting lockAt)

- All lock/reveal/scoring math is **Asia/Jerusalem** (`implementation-plan.md` §3,
  Risks §7). Timestamps are **stored absolute (UTC)** in `lockAt` / `revealAt`. The
  Hebrew UI renders them in Jerusalem wall time via `Intl.DateTimeFormat(..., {
timeZone: 'Asia/Jerusalem' })` — see `client/src/lib/time.ts` (`IL_TZ`,
  `formatDateTime`, `formatTime`, `useCountdown`). The server centralizes the same
  zone logic in `server/src/lib/time.ts`: `IL_TZ`, `formatInIsrael`,
  `israelWallClockToUtc` (DST-aware wall-clock → UTC, re-derives the offset across a
  DST boundary so it never hardcodes UTC+2/UTC+3), and the `isLocked(lockAt, now)` /
  `isRevealed(revealAt, now)` predicates that compare absolute instants.
- The admin form's `lockAt` is a `datetime-local` input — the browser interprets it in
  **the operator's OS timezone**, then `ElectionFormPage` converts to ISO. If your
  machine is not on Jerusalem time, the lock you see in the player UI will be shifted.
  For a faithful test, run the machine on Jerusalem time, or just read back the
  rendered Jerusalem time in `/admin` after saving and trust that, not the raw input.
- **DST boundary:** Israel switches DST in spring/autumn. If your test `lockAt`
  straddles a DST change, verify the countdown and the displayed "20:00" still line up
  with Jerusalem wall-clock. To keep the smoke test fast you'll override the default
  20:00 with a near-future time (below) — but for a real DST regression test, set
  `lockAt` to an actual election-night 20:00 across the boundary and confirm the
  rendered time and countdown are correct.

---

## 1 · Become super-admin + create the election

1.1. In your **admin** browser, open the app and **sign in once** with Clerk. This
mirrors your user into Postgres (Clerk webhook / `ensureDbUser` fallback). Note the
email you signed in with.

1.2. Promote that user to `SUPER_ADMIN`:

```
bun run --filter server db:make-admin -- <your-email-or-clerkId>
```

Expect `Promoted 1 user(s) ... to SUPER_ADMIN.` If you get `No user matched`, you
didn't actually complete sign-in — sign in, then re-run. Refresh the app; the `/admin`
surface is now reachable.

1.3. Create the election. In `/admin` → **בחירות חדשות**, fill the form
(`ElectionFormPage`):

- **שם הבחירות** — e.g. `הכנסת ה-26 (smoke)`.
- **מועד נעילת התחזיות (lockAt)** — the real default is **20:00** (polls-close − 2h).
  For the smoke test set it **~3–5 minutes in the future** so you don't wait around.
- **חשיפת תחזיות (דקות אחרי הנעילה)** — `revealOffsetMin`, **default `2`**. So the
  reveal time = `lockAt + 2min`. The client computes the absolute `revealAt` as
  `new Date(lockAt).getTime() + offset*60000` and sends it; the server stores it
  absolute and rejects `revealAt < lockAt` (`מועד החשיפה חייב להיות אחרי מועד הנעילה`).
- **תווית גוש א׳ / ב׳** — optional bloc labels (e.g. `גוש הימין` / `גוש המרכז-שמאל`).
  These drive the 3-way bloc bonus and the bloc labels in the UI.

  > Default semantics recap: lock default **20:00**, reveal default **lock + 2min =
  > 20:02**. You are overriding lock to a near-future time for speed; keep the +2
  > reveal offset so you can watch the reveal flip on its own.

Submit → you land on the election detail page (`/admin/elections/:id`).
API: `POST /api/admin/elections`.

1.4. Add the parties. Fastest path — seed the standard 25th-Knesset lineup (10 parties
with bloc tags + logos) into this election:

```
bun run --filter server db:seed-parties -- <electionId>
```

(The `<electionId>` is in the URL.) Or add parties by hand in the detail page
(`POST /api/admin/elections/:id/parties`): each needs **nameHe**, optional **logoUrl**,
**bloc** (`A` / `B` / `UNALIGNED`), **displayOrder**.

> **Freeze rule:** once _any_ user has submitted a pick, the party SET is locked —
> adding/removing a party returns `409 לא ניתן לשנות את רשימת המפלגות לאחר שהוגשו תחזיות`
> (`assertPartySetMutable`). So finish the party list **before** step 2. Editing a
> party in place (name/logo/bloc) stays allowed.

✅ **Checkpoint:** `/admin` lists the election with status **ללא תוצאות** (NONE) and the
correct party count.

---

## 2 · Two valid picks + one deliberate no-pick

Goal: exercise the `0 or 4–120, sum exactly 120` validator and seed the
`לא הגיש` / excluded-from-ranking path.

2.1. **Player A** — in incognito window #1, sign in as a _different_ Clerk account.
Open the pick screen for the election (`PickPage`). Enter a valid split:

- Every party value is **`0` or an integer `4–120`** — never 1/2/3.
- The total must be **exactly 120** (watch the live "remaining" counter; submit is
  blocked otherwise).
- Example for the 10-party seed (sums to 120):
  `32, 24, 14, 12, 11, 7, 6, 5, 5, 4`.

  Submit. API: `PUT /api/elections/:id/pick` → `201` on first submit (`200` on edit).
  Re-open the screen: your pick is shown and editable until lock.

  > Try an invalid total once to confirm the guard fires:
  > `סך המנדטים חייב להיות 120 בדיוק`. Try a `2` to confirm
  > `מספר המנדטים חייב להיות 0 או בין 4 ל-120`.

  2.2. **Player B** — in incognito window #2, sign in as a _third_ Clerk account. Submit a
  **different** valid 120-sum split, e.g.
  `28, 26, 13, 12, 10, 9, 8, 6, 4, 4`.

  2.3. **No-pick user** — this is **Player B is NOT it**; designate a _third_ player (or
  simply leave one of your three accounts without submitting). Concretely: have **one
  account sign in but submit NO pick**. Easiest is to reuse the super-admin account here
  as a non-submitter, or sign a third account in and stop before submitting. This user
  exists in the DB but has no `Pick` row.

✅ **Checkpoint:** 2 picks exist, 1 designated user has none. (Optional DB check:
`bun run --filter server db:studio` → `Pick` table has exactly 2 rows for this election.)

---

## 3 · Lock passes → picks freeze + no-pick flag

Wait until the wall clock reaches **lockAt** (your near-future time). Then:

3.1. **Freeze (API):** as Player A, try to edit and re-submit the pick. The server
rejects it: `PUT /api/elections/:id/pick` → **`409` `התחזיות ננעלו`** (the
`now >= lockAt` guard in `picks.ts`).

3.2. **Freeze (UI):** reload `PickPage`. It now renders the **`FrozenView`** —
card titled **התחזיות ננעלו** with a `Lock` icon, picks read-only, no editable inputs.
The countdown (`התחזיות ננעלות בעוד …`) is gone.

3.3. **No-pick flag:** as the no-pick user, the home/pick surface shows the
**`טרם הגשת תחזית`** flag (reminder copy). In any group view (step 4) this user appears
as **טרם הגיש** pre-reveal and **לא הגיש** post-reveal, and is **excluded from ranking**
when scores publish (no `Score` row is ever written for a user with no `Pick`).

✅ **Checkpoint:** edits return `409 התחזיות ננעלו`; the no-pick user is flagged, not
ranked.

---

## 4 · Reveal picks on the timer → no scores yet

At **revealAt = lockAt + 2min** the reveal flips automatically (client-side `useCountdown`
against the stored `revealAt`). To see group reveal you need a group:

4.1. Have Player A create a group (`/groups` → create) and copy the invite link.
Open it as Player B and as the no-pick user → both auto-join (Clerk sign-in → join).

4.2. **Before revealAt:** open the group detail (`GroupDetailPage`). Members show
**who submitted** only — a **הגיש** badge (with `Check` icon) for A and B, **טרם הגיש**
for the no-pick user. **Numbers are hidden** (privacy enforced in the API layer, not the
DB — `leaderboard.ts` / groups route never returns picks pre-reveal).

4.3. **After revealAt** (wait ~2 min, or refresh): the group detail now shows each
member's **full pick** (party → mandates), and the no-pick user shows **לא הגיש**.
**Crucially: still NO scores.** The election `resultsStatus` is still `NONE`, so the
leaderboard endpoints return `{ published: false, state: 'pre_publish', participantCount }`
— a participation **count only**, never a score (the `NONE` branch in `leaderboard.ts`
never queries `Score`).

✅ **Checkpoint:** group members see each other's picks; both group and global
leaderboards show only a participation count, no scores, no ranks.

---

## 5 · Publish מדגם, then update to סופי

5.1. **Enter results.** In `/admin/elections/:id` (`ElectionDetailPage`), fill each
party's **actual mandates** and save. Same validator as picks: each value `0` or
`4–120`, **sum exactly 120** (`סך המנדטים חייב להיות 120 בדיוק` otherwise).
API: `PATCH /api/admin/elections/:id/results` (must cover **every** party — partial sets
return `התוצאות חייבות לכלול את כל המפלגות בבחירות`). This does **not** change status yet.

Example actuals (sum 120, deliberately not equal to either pick so scores differ):
`30, 24, 14, 13, 10, 8, 7, 6, 4, 4`.

5.2. **Publish מדגם (PROVISIONAL).** Click **פרסום תוצאות מדגם** → confirm. API:
`POST /api/admin/elections/:id/publish` with `{ "status": "PROVISIONAL" }`. This is the
**only** writer of `Score`: it runs `computeScore` per pick and upserts a `Score` row,
then sets `resultsStatus = PROVISIONAL`. (Guard: if results aren't fully entered & sum
120, publish returns `יש להזין תוצאות תקינות (סכום 120) לפני פרסום`.)

After publish the detail page badge reads **מדגם**.

5.3. **Update to סופי (FINAL).** Edit the actuals if the certified finals differ
(`PATCH …/results` again), then click **פרסום תוצאות סופיות** → confirm. API:
`POST …/publish` with `{ "status": "FINAL" }`. Publish is **idempotent** — it
recomputes and upserts every `Score` and flips `resultsStatus = FINAL`. Badge now reads
**סופי**.

> Status mapping (don't mix these up): **`PROVISIONAL` = מדגם** (provisional / exit-poll),
> **`FINAL` = סופי** (certified). Admin list labels: `תוצאות זמניות` / `תוצאות סופיות`.

✅ **Checkpoint:** scores exist and reveal only _after_ publish; status went
`NONE → PROVISIONAL (מדגם) → FINAL (סופי)`, recomputing each time.

---

## 6 · Verify leaderboards + the מדגם/סופי label

6.1. **Global leaderboard** — `GET /api/elections/:id/leaderboard`. As any player, open
the leaderboard page (`LeaderboardPage`). Now `published: true`: ranked rows
(displayName + avatar + total), **your-rank highlight**, top-N + pagination. The
**no-pick user does NOT appear** (no `Score` row → excluded from ranking). Ties share a
rank, earlier `submittedAt` breaks the tie (`rankEntries`).

6.2. **Group leaderboard** — `GET /api/groups/:id/leaderboard`, scoped to that group's
members. Same shape, only the group's members. Non-members get `403 אינך חבר בקבוצה זו`.
Confirm A and B are ranked and the no-pick member is absent.

6.3. **Hand-check the numbers** against the formula (next section) for at least Player A
to prove the engine, then re-publish `FINAL` and confirm the same picks now score
against the certified actuals.

6.4. **Label is unmissable.** Confirm the **מדגם** vs **סופי** label is prominent and
visually distinct wherever scores show (admin badge variant differs:
`מדגם` = secondary, `סופי` = default). Per Risks §7 this label must never be ambiguous —
if a tester can't instantly tell provisional from final, that's a bug.

✅ **Checkpoint:** both boards correct, no-pick user excluded, tie-break by submit time,
מדגם/סופי label obvious.

---

## Expected results — scoring formula

From `implementation-plan.md` §1 and `server/src/lib/scoring.ts` (`computeScore`, a
single pure function). Per `(user, election)`:

```
total = base + bonusLargest + bonusThreshold + bonusBloc
```

- **base = `240 − Σ|predicted − actual|`** (floored at 0). A perfect call ⇒ base = 240.
- **bonusLargest = +10** — predicted the largest party (ties: matching _either_
  tied-largest party counts). 0 if either max is 0.
- **bonusThreshold = +1 per party, capped at +10** — per party, +1 when your
  in/out-of-Knesset call matches (in = `≥4`, out = `0/<4`); both-in or both-out scores.
- **bonusBloc = +10** — your derived 3-way bloc call matches the actual:
  **Bloc A ≥ 61 / Bloc B ≥ 61 / Hung** (neither — `HUNG`). Bloc is summed from each
  party's `A`/`B` tag; `UNALIGNED` ignored. A and B can't both reach 61.

Practical maxima: **base ≤ 240**, **total ≤ 270** (240 + 30 bonuses) with ≥10 parties.

**Worked sanity check (the example numbers above):**

- Predicted A: `32,24,14,12,11,7,6,5,5,4` · Actual: `30,24,14,13,10,8,7,6,4,4`
- `Σ|pred−actual|` = `2+0+0+1+1+1+1+1+1+0` = **8** → **base = 232**.
- Largest: predicted top = 32 (party 1), actual top = 30 (party 1) → **+10**.
- Threshold: every party is ≥4 in both predicted and actual → all 10 match, cap →
  **+10**.
- Bloc: depends on your `A/B` tags; with the seed lineup (A = right-religious,
  B = center-left) confirm both predicted and actual land on the same call → **+10** if
  they match, else 0.
- So Player A total ≈ **262** (262 if bloc matches; 252 if not). Cross-check this exact
  number against the leaderboard total for Player A.

Only published (`PROVISIONAL`/`FINAL`) elections expose scores; `NONE` exposes a
participation count only.
