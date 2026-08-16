# UltimateCricket — Hackathon Build Plan

**Constraints:** solo developer · 24–36 hours · judges will use the prototype unsupervised
**Supersedes** `ARCHITECTURE.md` for this build. That document is the 6-month plan; keep it
as the "where this goes next" slide, not the build order.

---

## 0. The one decision that determines whether you finish

**There is no backend. No Supabase, no auth, no login, no sync, no network calls.**

This will feel wrong. Do it anyway. Here's the arithmetic:

You have ~30 wall-clock hours. Subtract setup, debugging, sleep, deployment, and pitch
prep and you have **~20 hours of real coding**, alone. Supabase project setup + schema +
RLS policies + auth screens + session handling + the sync worker + debugging why the JWT
is expired at 3am is *conservatively* 8–10 of those hours. It produces **nothing a judge
can see.** A judge tapping your app cannot tell whether the data is in Postgres or in
AsyncStorage. They can absolutely tell whether the score is wrong or the app crashed.

Everything persists locally. That's it. When a judge asks "does it sync?", the answer is
"the architecture is event-sourced with an append-only ball log, so sync is a transport
concern — here's the design" and you show them one page of `ARCHITECTURE.md`. That answer
is *better* than a half-working sync, because it demonstrates you know the difference
between a demo and a system.

---

## 1. Scope: locked

### Building

| # | Feature | Why it survives the cut |
|---|---|---|
| 1 | **Ball-by-ball scoring engine** | The product. Non-negotiable. |
| 2 | **One-tap scoring UI** | The only screen judges will really exercise. |
| 3 | **Umpire-supervised toss** | Your differentiator + it's genuinely fun to demo. |
| 4 | **Live scorecard** (batting + bowling cards) | Proves the engine works. |
| 5 | **Knockout bracket, local** | Satisfies "tournaments" without a tournament engine. |
| 6 | **Unlimited undo** | Judges mis-tap. Without this they'll break it in 30 seconds. |

### Cut — say this out loud so you don't drift back

Backend · auth/login · cloud sync · realtime spectators · round-robin · groups+playoffs ·
NRR · player career stats · team logos/uploads · live streaming · highlights · DLS ·
super over · retired hurt · penalty runs · overthrow attribution · iOS-specific polish ·
dark mode · animations beyond a fade.

Every one of those is a plausible-sounding hour that costs you the demo.

---

## 2. Stack (revised for 24h)

| Layer | 6-month plan | **Hackathon** | Why changed |
|---|---|---|---|
| App | Expo | **Expo** | unchanged |
| State | SQLite + sync worker | **Zustand + `persist` → AsyncStorage** | SQLite is ~2h of setup; a 330-event JSON array is ~100 KB. Zustand persist is 15 minutes. |
| Backend | Supabase | **none** | §0 |
| Engine | `packages/scoring-engine` | **`src/engine/` in-app** | Skip the monorepo. No second consumer exists. |
| Delivery | App stores | **Expo web → Vercel, + EAS APK** | §6 — this is how judges get their hands on it |

Install list, hour zero, nothing else:

```bash
npx create-expo-app@latest UltimateCricket -t blank-typescript
cd UltimateCricket
npx expo install @react-native-async-storage/async-storage react-native-web react-dom
npm i zustand nanoid
npm i -D vitest
```

Resist every additional dependency. A UI library you haven't used before will cost you
three hours at hour 20.

---

## 3. Hour-by-hour

Assumes a 10:00 Saturday start, 16:00 Sunday finish. Adjust the clock, keep the ratios.

| Time | Block | Deliverable | Done means |
|---|---|---|---|
| **T+0 → 1** | Scaffold | App runs on device + in browser | Expo Go loads on your phone |
| **T+1 → 5** | ⭐ **Engine** | `reduce()`, `validate()`, `derive()` + Vitest suite | All §4 cases green. **No UI yet.** |
| **T+5 → 6.5** | Toss | Umpire-supervised toss flow | §5 works end to end |
| **T+6.5 → 13** | Scoring UI | The scoring screen | Can score a full 5-over innings by hand |
| **T+13 → 16** | Scorecard + flow | Batting/bowling cards, innings break, result | A whole match completes |
| **T+16 → 19.5** | 😴 **Sleep** | — | Non-negotiable. Code written at hour 19 awake gets deleted at hour 24. |
| **T+19.5 → 22.5** | Bracket | 8-team knockout, local, auto-advances | Winner of a match moves up the bracket |
| **T+22.5 → 25** | Hardening | §7 guardrails | You cannot break it by random tapping for 5 min |
| **T+25 → 27** | 🚨 **Deploy** | Web URL live + APK built | **Hard deadline. Do not slip this.** |
| **T+27 → 29** | Seed + pitch | Demo data, 3-min script, one slide | Judge landing on it cold sees something alive |
| **T+29 → 30** | Buffer | Nothing planned | It will get used |

**The two rules that decide whether you ship:**

1. **Deploy at T+25, not T+29.** More hackathon projects die at the build step than at any
   feature. EAS builds queue. Vercel needs a config tweak. DNS is slow. Budget for it.
2. **If a block runs over, cut from the *next* block, never from sleep or deploy.**
   The bracket is the designated sacrifice. If T+22.5 arrives and the bracket is half
   done, delete it and ship 5 features that work.

---

## 4. Engine scope (T+1 → 5)

Same design as the full plan — pure functions, event log, fold to state — but a trimmed
rule set. Write these as Vitest cases *first*; each is one line to assert.

**Must handle:**

- Dot, 1/2/3, 4, 6
- **Wide** — +1 team, not a legal ball, no ball faced, nothing to the batter
- **No-ball** — +1 team, not a legal ball, runs off bat **do** credit the batter, sets free hit
- **Free hit** — only run-out dismissals count; **persists through a following wide**
- **Bye / leg bye** — legal ball, batter faces it, runs to extras, not charged to the bowler
- **Strike rotation** — swap on odd runs **and** at over end; both firing = **no net swap**
- **Wickets** — bowled, caught, LBW, run out, stumped, hit wicket
- **New batter** at the striker's end unless `crossed: true`
- **Over complete** at 6 legal deliveries; bowler cannot bowl consecutive overs
- **Innings end** — all out / overs done / target chased
- **Undo** — append a void pointer, never mutate or delete

**Explicitly out:** DLS, super over, retired hurt, penalty runs, overthrow attribution,
maiden tracking, powerplays, bowler over-quotas.

```ts
// The entire public surface. Keep it this small.
export function reduce(s: InningsState, e: BallEvent, r: Rules): InningsState;
export function validate(s: InningsState, e: BallEvent, r: Rules): Violation[];
export function derive(events: BallEvent[], r: Rules): InningsState;
```

`derive` = `events.filter(e => !e.voidedBy).reduce(reduce, initial)`. That fold is your
definition of truth; everything rendered is a cache of it.

**Your acceptance test:** open any completed T20 scorecard on ESPNcricinfo, replay one
innings ball by ball into your engine, and assert the final total, wickets, extras
breakdown and every batter's runs/balls match exactly. If that passes, your engine is
correct and you can build UI without fear. If you skip this, you will discover at hour 26
that wides are incrementing the over count.

---

## 5. The toss — umpire-supervised (T+5 → 6.5)

You were right and the earlier design was wrong. Per the MCC Laws of Cricket:

> **Law 13.4** — "The captains shall toss a coin for the choice of innings, **on the field
> of play and in the presence of one or both of the umpires**, not earlier than 30 minutes,
> nor later than 15 minutes before the scheduled … time for the start of play."
>
> **Law 13.5** — "As soon as the toss is completed, the captain of the side winning the toss
> shall decide whether to bat or to field and **shall notify the opposing captain and the
> umpires** of this decision. Once notified, the decision cannot be changed."

So the model is: **captains act, umpire witnesses and confirms, decision is immutable.**

### Data model

```ts
type MatchOfficial = {
  role: 'UMPIRE_1' | 'UMPIRE_2' | 'SCORER';
  name: string;
  playerId?: string;         // often a player or a parent, not a neutral official
};

type Toss = {
  tossedBy:   TeamId;        // home side tosses (Law 13.4)
  calledBy:   TeamId;        // visiting side calls
  call:       'HEADS' | 'TAILS';
  result:     'HEADS' | 'TAILS';
  wonBy:      TeamId;
  decision:   'BAT' | 'FIELD';   // Law 13.5 — immutable once set
  method:     'DIGITAL' | 'PHYSICAL_COIN';
  witnessedBy: MatchOfficial[];  // empty ⇒ fell back to both-captains-confirm
  confirmedAt: number;
  commitHash?: string;       // digital mode only
  nonce?:      string;
};
```

### Flow (build this exact sequence — it's your demo)

1. **Assign officials.** Umpire 1 required-ish, Umpire 2 optional. A "No umpire — captains
   confirm" escape hatch, because in gully and school cricket there often isn't one and a
   required field would lock out most of your users.
2. **Umpire starts the toss.** Nobody else can. Screen shows both captains + who tosses.
3. **Visiting captain calls** heads or tails.
4. **Coin animates and lands.** Digital mode uses commit-reveal: the app commits
   `SHA256(nonce)` *before* the call is entered, then reveals — so the result provably
   wasn't chosen after seeing the call. Show the hash on screen for two seconds. It is a
   ten-line feature and it looks extremely credible to judges.
5. **Winning captain chooses BAT or FIELD.**
6. **Umpire confirms.** Only now does the match state advance to `TOSS_DONE`. The decision
   is written immutably — no edit path in the UI, per Law 13.5.
7. Toss record shows on the scorecard header: *"Mumbai Colts won the toss and elected to
   bat. Umpire: R. Sharma."*

Also ship **PHYSICAL_COIN mode** — two taps, "who won / what did they choose" — because 22
people watching a real coin land is a trust mechanism that already works, and it's what
most users will actually use. Build it first; it takes ten minutes.

**Why this is worth 1.5 hours in a 24-hour build:** it's the only part of your app that
isn't in CricHeroes, it's visually distinctive, and "the umpire runs the toss and it's
cryptographically provable" is a sentence a judge remembers. It is a *demo* asset more
than a product asset — that's a legitimate reason to build it in a hackathon and not a
legitimate reason to build it in month one.

---

## 6. Delivery — how judges actually get their hands on it

You chose "judges try it themselves." That makes distribution a **feature**, and it is the
most commonly botched part of a hackathon.

**Primary: a web URL.** Expo supports React Native Web. `npx expo export -p web` produces
a static bundle; drop it on Vercel or Netlify. A judge opens a link on their own laptop —
zero install, zero friction, works even if the venue wifi hates you. Put the URL on a QR
code on your slide.

```bash
npx expo export -p web
npx vercel deploy dist --prod
```

**Secondary: an Android APK**, for the "does it work on a real phone" question.

```bash
eas build -p android --profile preview   # produces a sideloadable APK
```

Start this at **T+25**. EAS builds queue and can take 20+ minutes. Test the APK on an
actual phone before you call it done.

**Do not demo from a laptop simulator.** It reads as unfinished, and judges can't touch it.

**Test the web build at T+10, not T+25.** React Native Web will surprise you — some
gesture handlers and native modules simply don't exist there. Finding that out at hour 10
costs you a component swap. At hour 25 it costs you the demo.

---

## 7. Surviving unsupervised judges (T+22.5 → 25)

They will not follow your script. They will tap the thing you never tested. Budget the
full 2.5 hours.

- **Seed a live demo match on first launch.** A judge landing on an empty state with a
  "Create Team" button will create one team, get bored, and leave. Land them mid-innings:
  *India U16 132/4 (14.2)*, scoring screen open, a bracket already half-played.
- **Undo is always on screen.** Big, obvious, unlimited, no confirmation dialog.
- **Every screen has a working back button.** The single most common hackathon dead end.
- **A reset button.** "Reset demo data" in a corner, so judge #3 doesn't inherit judge #2's
  mess. You will be grateful for this.
- **Illegal actions are disabled, not error-toasted.** Grey out the bowler who just bowled.
  `validate()` already tells you why — use it to disable buttons.
- **Nothing may crash on empty.** Zero players, zero overs, zero teams. Wrap the scorecard
  in an error boundary.
- **Tap targets ≥ 48dp.** People score one-handed while watching a match.

---

## 8. The pitch problem

"A cricket scoring app" is not a pitch when CricHeroes exists, is free, has 40M+ users, and
every Indian judge in the room has it installed. Assume someone asks. Have the answer ready
in one sentence, not a feature list.

The two honest angles from this build:

- **"Cricket's scoring app that doesn't need the internet."** Grassroots cricket happens on
  grounds with one bar of signal. Demoable in 10 seconds: put your phone in airplane mode
  on stage and keep scoring.
- **"The umpire runs the toss, and it's provably fair."** Nobody else models match officials
  at all.

Lead with airplane mode. It's a physical, visible, unfakeable demo and it maps to a real
pain. The toss is your memorable second beat.

**Your last slide is `ARCHITECTURE.md`** — the event-sourced log, the single-writer lease
sync design, the pluggable tournament engine. "Here's the 6-month path; here's the 24 hours
of it that works today" is a much stronger close than a roadmap of features you didn't build.

---

## 9. Cut order, pre-decided

When you're behind — and you will be — cut in this order without re-deliberating at 4am:

1. Second umpire slot
2. Knockout bracket entirely *(fall back to a single match; say "tournaments are next")*
3. Commit-reveal hash *(keep the plain digital toss)*
4. Bowling card *(keep batting card)*
5. Innings 2 / chase logic *(demo one innings)*

**Never cut:** the engine, undo, deploy, sleep.
