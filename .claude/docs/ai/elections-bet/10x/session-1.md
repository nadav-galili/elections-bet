# 10x Analysis: Elections Bet — Virality

Session 1 | Date: 2026-06-28

## Current Value

A Hebrew/RTL, points-only web game where friend-groups predict the Knesset
mandate split (a pick = mandates per party, total 120), lock before election
night, and compete on per-group + global leaderboards. Distribution today =
**a shareable per-group WhatsApp invite link**. Core loop runs on **one night,
once every few years**. Scoring = `240 − Σ|err|` + 3 bonuses, revealed when the
admin publishes exit-poll then final results.

## The Question

What would make a friend in a WhatsApp group _unable not to_ forward this — and
keep using it between elections?

---

## The two structural problems virality has to solve

Everything below is aimed at exactly two gaps. Read these first; the features
are just means to these ends.

1. **The share carries no payload.** Today you forward a bare invite link.
   Nobody screenshots a link. Virality needs a _shareable artifact_ — an image
   or message so good that posting it is the point, and the invite rides along
   inside it. This is the K-factor engine.

2. **One night every 4 years can't compound.** Network effects, habit, and
   reputation all need repetition. The single highest-leverage strategic move
   is to convert a one-shot event into a _recurring_ political-prediction game
   (polls, coalition, ministers, "will the government survive the year"). Without
   this, every other retention feature is fighting physics.

---

## Massive Opportunities

### 1. Off-season prediction cadence ("the game never ends")

**What**: Beyond the election-night mandate pick, add lightweight recurring
prediction events between elections: _coalition formation_ (which parties join,
who's PM, days-to-government), _minister chairs_ (who gets Finance/Defense),
_will-the-government-survive-the-year_, and _poll-of-the-week_ mini-picks tied to
published Israeli polls. Same engine (pick → lock → reveal → score), smaller
surface.
**Why 10x**: Turns a once-every-4-years novelty into a habit with a permanent
leaderboard. Every recurring event is a fresh reason to re-open the group thread
and re-share. This is what makes _all_ the retention/reputation features
actually compound.
**Unlocks**: Persistent pundit reputation (#7), season leagues (#3), an
always-fresh "crowd says" feed (#2), a reason for push/WhatsApp nudges to exist.
**Effort**: High (new event type + scoring variants + admin authoring).
**Risk**: Content-authoring burden falls on the super-admin; coalition/minister
outcomes are fuzzier to adjudicate than mandate counts.
**Score**: 🔥

### 2. Crowd-wisdom / "the nation predicts" public page

**What**: Aggregate every user's pick into a public, anonymized "what Elections
Bet players predict" view — the average mandate split, biggest crowd-vs-poll
gaps, "the crowd thinks Bloc A gets 61." Auto-generated, shareable, embeddable.
**Why 10x**: This is a _PR and organic-acquisition_ machine, not just a feature.
Israeli media loves crowd-prediction stories ("10,000 bettors predict X"). Each
mention is top-of-funnel that no invite loop can match. It also makes the app
feel bigger than your group — social proof on arrival.
**Unlocks**: Press coverage → non-WhatsApp acquisition; a public artifact to
share that isn't tied to one group; data credibility ("the EB index").
**Effort**: High (aggregation, anti-gaming, a polished public page, embeds).
**Risk**: Sampling bias is real — must label it as "for fun," not a poll, or it
invites criticism. Needs volume before it's interesting.
**Score**: 🔥

### 3. Group-vs-group leagues

**What**: Groups compete against _other groups_ (avg score per group), and a
group can join a public "league" (e.g. by city, workplace, university). Office A
vs Office B; a national ladder of groups.
**Why 10x**: Today competition is intra-group; this makes the _group itself_ a
team with a rival, which multiplies invites — you recruit to make your team
stronger, and the rival group recruits back. Inter-group rivalry is the
strongest known multiplier for friend-group apps.
**Unlocks**: A reason to grow your group past the core friends; durable
group identity that survives between elections.
**Effort**: High (new aggregation + standings + league membership model).
**Score**: 👍

---

## Medium Opportunities

### 4. The shareable pick card ("can you beat my call?")

**What**: After you lock a pick, one tap generates a beautiful image — your
mandate bar split, your bloc call, your boldest party — branded, with a
"תוכל/י לנצח את התחזית שלי?" CTA and the group invite baked in. Built to be
posted to WhatsApp _before_ results, when bragging-confidence is highest.
**Why 10x**: This is the direct fix for Structural Problem #1. It converts every
locked pick into a recruiting asset and rides the existing WhatsApp channel.
Pre-results sharing is psychologically optimal — people love going on record
with a hot take. Likely the single highest ROI item in this doc.
**Impact**: Every pick (not just winners) becomes a shareable, invite-carrying
artifact. Touches 100% of active users at the moment they're most engaged.
**Effort**: Medium (server-side image render in Hebrew/RTL + share intent).
**Score**: 🔥

### 5. AI Hebrew roast + WhatsApp recap (already in v2 plan)

**What**: After scores publish, Claude writes playful Hebrew trash-talk ranking
how each group member did vs the real results, plus a paste-ready WhatsApp recap
of the group's night ("הגיבור: דנה. האסון: יוסי חזה 30 לליכוד 😬").
**Why 10x**: The reveal is the emotional peak; an AI roast is the most
forwardable thing the app can produce and it amplifies the exact channel that
distributes the app. Needs no external data — pure function of picks + results.
**Impact**: Turns the highest-emotion moment into shareable content; gives the
group a reason to keep the thread (and the app) alive post-election.
**Effort**: Medium (Claude API in Hebrew; you already kept the schema queryable).
**Score**: 🔥

### 6. Live election-night room (real-time appointment moment)

**What**: An election-night live view: a shared countdown to lock, then as the
admin enters exit-poll/finals, the leaderboard _animates live_ — ranks climb and
fall in real time, with per-party "you were off by N" reveals rolling in. A
shared, synchronous experience instead of a page you refresh.
**Why 10x**: Creates an _appointment_ — everyone in the group is in the app at
the same time, watching together. Synchronous drama is what people screenshot
and react to in the thread. It's the difference between a utility and an event.
**Impact**: Concentrates engagement into a high-intensity window that drives
real-time WhatsApp chatter (= organic re-shares).
**Effort**: Medium (live updates via polling/SSE; animated leaderboard; mostly
frontend on top of existing reveal logic).
**Score**: 👍

### 7. Persistent pundit reputation

**What**: A permanent, flex-able prediction record on your profile —
"דרג נביא: 87th percentile · 3 elections · best call: +18 on Party X." A badge/
score that persists across every event and is shareable.
**Why 10x**: Ego is the cheapest fuel. A reputation worth defending creates
return visits and a reason to share when it's good. Compounds _only if_ the
cadence problem (#1) is solved — without recurring events there's nothing to
build a record from.
**Impact**: Retention + a recurring reason to share status.
**Effort**: Medium (depends on #1; schema for cross-event aggregation).
**Score**: 👍

### 8. Nemesis / head-to-head rivalry

**What**: Pick a rival (in your group or by handle). The app tracks your
lifetime record against them ("את/ה מול יוסי: 3–1") and surfaces it every event.
Optional: challenge a _non-user_ by name → they must sign up to see/beat you.
**Why 10x**: Personal rivalry is stickier than a leaderboard rank, and the
"challenge someone not in the app" path is a direct, named acquisition vector —
the strongest kind of invite (a person, not a group, calling you out).
**Impact**: Retention via rivalry; targeted invites with built-in motivation.
**Effort**: Medium.
**Score**: 👍

### 9. AI pick assistant (lower friction = more completed picks)

**What**: Natural-language pick entry in Hebrew — "אני חושב שהליכוד מתרסק
והמרכז עולה, תכין לי תחזית סביב זה" → Claude proposes a valid 120-sum pick the
user can tweak. Also a "use current polls as a starting point" button.
**Why 10x**: The 120-sum constraint is real friction for casual users; abandoned
picks never get shared. Removing friction at the pick step directly increases the
number of artifacts (#4) and roasts (#5) the system can produce.
**Impact**: Higher pick-completion rate among casual/invited users — the exact
cohort that drops off.
**Effort**: Medium (Claude API + validation guardrails so output always obeys
0/4–120 + sum-120).
**Score**: 👍

---

## Small Gems

### 10. The "stragglers" nudge message

**What**: One tap generates a paste-ready WhatsApp line: "5/8 הגישו תחזית, נשארו
שעתיים לנעילה — חסרים: דנה, יוסי, אבי 👀".
**Why powerful**: The group does your retention work for you, and it manufactures
exactly the pre-lock urgency the plan flags as a risk ("people forget the 20:00
lock"). Tiny build, hits every group every election.
**Effort**: Low.
**Score**: 🔥

### 11. "Hot take" flag on one party

**What**: Let a user mark one party as their bold call. If that call lands within
a tight band, a special badge + bonus + a dedicated "קראתי את זה!" share card.
**Why powerful**: Manufactures a memorable, brag-worthy moment out of an
otherwise flat pick — the stuff people _want_ to screenshot.
**Effort**: Low (a flag + a scoring tweak + a card variant).
**Score**: 👍

### 12. AI "pundit persona" from your pick

**What**: Claude reads your pick and assigns a playful Hebrew archetype —
"מרכזן יום-הדין", "אופטימיסט בלוק", etc. — as a shareable card.
**Why powerful**: BuzzFeed-quiz identity bait. Shareable _at pick time_ (before
results), filling the long gap before scores exist. Pure fun, near-zero data.
**Effort**: Low (one Claude call + card render, reuses #4's renderer).
**Score**: 👍

### 13. Countdown urgency everywhere

**What**: A live "X hours to lock" ribbon on every screen + an auto "locking
soon" state, and (later) one opt-in web push at lock−1h.
**Why powerful**: Urgency converts intenders into submitters; submitters are
who share. The plan already flags missed-lock as a top risk.
**Effort**: Low (countdown now; push later).
**Score**: 👍

---

## Recommended Priority

### Do Now (quick wins, ride the existing WhatsApp loop)

1. **Shareable pick card (#4)** — the K-factor engine; nothing else compounds
   without a payload to share.
2. **Stragglers nudge (#10)** — trivial build, drives pre-lock completion, the
   group does the chasing.
3. **AI roast + WhatsApp recap (#5)** — already planned; the most forwardable
   artifact, fired at the emotional peak.

### Do Next (high leverage)

1. **AI pick assistant (#9)** — removes the 120-sum friction so more invited
   users actually produce a (shareable) pick.
2. **Live election-night room (#6)** — turns the night into a synchronous,
   screenshot-worthy event.
3. **Hot-take flag (#11) + pundit persona (#12)** — cheap moment-manufacturing
   that feeds the share cards.

### Explore (strategic bets — the compounding moves)

1. **Off-season cadence (#1)** — the real fix for the every-4-years problem;
   gates whether reputation/leagues mean anything. Risk: admin content burden.
2. **Crowd-wisdom public page (#2)** — PR/organic acquisition beyond WhatsApp.
   Risk: needs volume + careful "for fun, not a poll" framing.
3. **Group-vs-group leagues (#3)** + **pundit reputation (#7)** + **nemesis
   (#8)** — the rivalry/identity layer; only pays off once #1 exists.

### Backlog (good, not now)

- Web push at lock−1h (#13's second half) — deferred per plan; revisit after
  cadence exists to push _about_.

---

## Questions

### Answered

- **Q**: What's the distribution channel? **A**: WhatsApp friend-group invite
  links — so every feature should produce something worth pasting into WhatsApp.
- **Q**: Are AI features allowed? **A**: Yes (user opened the door); v2 already
  leans Hebrew roast + WhatsApp recap. Use the Claude API in Hebrew.

### Blockers (need user input)

- **Q**: Is the every-4-years cadence acceptable, or do you want to invest in
  off-season events (#1)? This is the single biggest fork in the strategy.
- **Q**: Are you comfortable with a _public_ crowd page (#2) and its press/
  scrutiny, or keep everything inside private groups?
- **Q**: How much super-admin authoring effort can you sustain between elections
  (drives feasibility of #1)?

## Next Steps

- [ ] Decide the cadence fork (#1) — it reshapes the whole roadmap.
- [ ] Prototype the shareable pick card (#4) — fastest path to measurable lift.
- [ ] Spec the Claude Hebrew prompt set (roast, recap, persona, pick-assist)
      against the existing pick/results schema.
- [ ] Instrument the funnel (invite → signup → pick locked → share) so virality
      changes are measurable, not vibes.
