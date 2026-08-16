# UltimateCricket

**Ball-by-ball cricket scoring that works with no signal, no account, and no backend.**

Grassroots cricket happens on grounds with one bar of reception. UltimateCricket keeps a
full, correct scorecard entirely on the device — and models something no other scoring app
does: **the umpire-supervised toss**, per the MCC Laws of Cricket.

Built solo as a 24–36 hour hackathon project. Ships as a web URL and an Android APK.

---

## What works today

| | |
|---|---|
| **Scoring engine** | Event-sourced, pure TypeScript, zero dependencies |
| **Umpire-supervised toss** | MCC Law 13.4 / 13.5, physical coin or cryptographic commit–reveal |
| **One-tap scoring UI** | Runs, all four extras, six dismissal types, over and bowler management |
| **Live scorecard** | Full batting and bowling cards, extras breakdown, strike rate, economy |
| **Innings break & result** | Target, chase tracker, "won by N wickets/runs", tie handling |
| **Unlimited undo** | Any ball, any time — including after the match has ended |

**141 tests passing. Strict typecheck clean.**

Not built (deliberately, and the list is closed): backend, accounts, cloud sync, live
spectators, round-robin tournaments, NRR, career stats, DLS, super over.

---

## Quick start

```bash
npm install
npm run web        # browser
npm start          # Expo Go on a phone
```

Verify it:

```bash
npm test           # 141 tests
npm run typecheck  # strict, no errors
```

Requires Node 20+. No API keys, no `.env`, no services to provision — there is no backend
to configure.

---

## How it works

### A match is an append-only log

Nothing in this codebase stores a score. A match is an array of `BallEvent`, and every
number you see is a pure fold over that array:

```ts
derive(events, rules, opening)   // events.filter(live).reduce(reduce, initial)
```

This is why undo is trivial and unlimited: **undo appends a void pointer**, it never
deletes or edits. The fold simply skips voided events and recomputes. Reverse a wicket and
the free-hit flag, the strike rotation, and the bowler's figures all correct themselves,
because none of them were ever stored.

### The engine is pure and knows all the rules

`src/engine/` imports nothing — no React, no storage, no `Date.now()`, no randomness.
Inputs in, state out. Every cricket rule lives there and nowhere else:

- A **wide** adds a run, is not a legal ball, and the batter faces nothing.
- A **no-ball** adds a penalty, credits runs off the bat to the batter, and sets a free hit.
- A **free hit** permits only run-outs, and **survives a following wide**.
- **Byes and leg-byes** are legal balls charged to the team, not the batter, not the bowler.
- **Strike rotates** on odd runs *and* at the end of the over — both firing means no net swap.
- **Overs are balls, never decimals.** `19.3` overs is 117 balls.

If a rule ever appears inside a component, that's a bug.

### `validate()` drives the UI

Illegal actions are **disabled buttons**, never error toasts. The scoring screen builds a
candidate `BallEvent`, asks `isValid()`, and greys the control out if the answer is no. On a
free hit every dismissal but "run out" is visibly disabled; at an over boundary the bowler
who just bowled cannot be selected.

### The toss follows the actual Laws

Most scoring apps treat the toss as a dropdown. The Laws are more specific:

- **Law 13.4** — the captains toss *in the presence of one or both umpires*.
- **Law 13.5** — once the winning captain notifies the bat/field decision, **it cannot be
  changed**. There is deliberately no code path that reopens a confirmed toss, and the
  record is frozen at runtime.

The umpire is an **assignable, optional** role with a both-captains-confirm fallback —
gully and school cricket often have no neutral official, and a required field would lock
out most real users.

In digital mode the app publishes `SHA-256(nonce)` *before* the call is entered, then
reveals the nonce afterwards so anyone can re-hash it and confirm the coin was fixed in
advance. The commit and coin digests are **domain-separated**; sharing one digest would let
the calling captain read the result off the hash on screen and defeat the entire mechanism.
The SHA-256 is hand-written and zero-dependency, verified against the published FIPS 180-4
vectors.

---

## Layout

```
src/
  engine/     pure scoring engine — reduce / validate / derive / summary
  toss/       pure toss state machine + SHA-256 + commit-reveal
  store/      Zustand + persist → AsyncStorage (the only stateful layer)
  ui/         screens and shared components
docs/         build plan, architecture, references
```

`src/engine/` and `src/toss/` have no imports outside themselves and are covered by tests.
Everything else is a rendering of what they compute.

---

## Deploying

```bash
npx expo export -p web                    # static bundle → dist/
npx vercel deploy dist --prod             # web URL

eas build -p android --profile preview    # sideloadable APK
```

---

## Docs

- [`docs/HACKATHON_PLAN.md`](docs/HACKATHON_PLAN.md) — the build plan actually executed: scope, hour-by-hour, cut order.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the 6-month design (sync, tournaments). Reference, not build order.
- [`docs/REFERENCES.md`](docs/REFERENCES.md) — data sources and competitive notes.
- [`CLAUDE.md`](CLAUDE.md) — working agreement for AI agents in this repo.

---

## Stack

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · Zustand + AsyncStorage ·
Vitest. No UI library, no navigation library, no backend.
