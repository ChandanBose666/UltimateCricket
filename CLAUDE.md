# UltimateCricket — agent instructions

Read this fully before writing any code. Then read `docs/HACKATHON_PLAN.md`.

## Status

**Blocks T+0→1 (scaffold), T+1→5 (engine) and T+5→6.5 (toss) are DONE and validated.**

- Expo SDK 57 / RN 0.86 / React 19.2. Deps are exactly the §2 list, nothing else.
- `src/engine/` — 56 tests. `src/toss/` — 61 tests. **117 passing**, strict typecheck clean.
- Verify with `npx vitest run && npx tsc --noEmit`.
- Web build proven end to end (`npx expo export -p web`), not just compiled — the digital
  toss was clicked through in a browser and the commit hash re-hashes to match.

**Do not refactor or rewrite `src/engine/` or `src/toss/`.** If you need behaviour they
lack, add a failing test first, then extend. They are the parts of this build that are
known-correct.

Two toss details that differ from `HACKATHON_PLAN.md` §5, both deliberate:

- The commit and the coin use **domain-separated digests** (`UC-COMMIT:` / `UC-COIN:`), not
  both `SHA256(nonce)`. Sharing one digest would let the calling captain compute the result
  from the hash shown on screen before calling.
- `call` and `result` are **optional** on `TossRecord`, so `PHYSICAL_COIN` stays two taps.

Next block is T+6.5→13, the scoring UI.

## Context

Solo developer. **24–36 hour hackathon.** Judges will use the prototype themselves,
unsupervised. Ship date is fixed and will not move.

`docs/ARCHITECTURE.md` is the 6-month system design. **It is NOT the build order.** Do not
implement from it. It exists as reference and as the closing pitch slide. If a suggestion
of yours only makes sense in that document, it does not belong in this build.

## Non-negotiable constraints

1. **No backend.** No Supabase, no Firebase, no auth, no login, no network calls, no sync.
   All state is local: Zustand + `persist` middleware → AsyncStorage. If you find yourself
   writing a fetch call, stop.
2. **Engine before UI.** `src/engine/` must be written and passing tests before any screen
   is built. Do not scaffold screens "to see something working."
3. **No new dependencies** beyond the list in `docs/HACKATHON_PLAN.md` §2 without asking
   first. A UI library I haven't used costs three hours at hour 20.
4. **The cut list in §1 is closed.** Do not propose round-robin, NRR, player stats, DLS,
   super over, streaming, or dark mode. They are deliberately out.
5. **Ships as a web URL (Expo web → Vercel) plus an Android APK.** Every component must
   work under React Native Web. Avoid native-only modules and exotic gesture handlers.

## Architecture rules

- **Event sourcing.** A match is an append-only array of `BallEvent`. Derived state is a
  pure fold. Never mutate a recorded event.
- **Undo = append a void pointer** (`voidedBy`), never delete or edit.
- **The engine is pure.** `src/engine/` imports nothing — no React, no storage, no
  `Date.now()`, no randomness. Inputs in, state out. This is what makes it testable and
  what makes the whole plan work.
- **Cricket rules live only in the engine.** If a rule (wide, no-ball, free hit, strike
  rotation) appears in a component, that is a bug — move it.
- **`validate()` drives the UI.** Illegal actions are *disabled buttons*, not error toasts.

## Engine rules that are commonly implemented wrong

Each needs a named test. Do not mark the engine done until all pass.

- Wide: +1 team run, **not** a legal ball, batter faces nothing, nothing credited to batter.
- No-ball: +1 team run, **not** a legal ball, runs off bat **do** credit the batter and the
  batter **does** face it. Sets free hit.
- Free hit: only run-out / obstructing / hit-ball-twice dismissals count. **Persists through
  a following wide.**
- Bye / leg bye: legal ball, batter faces it, runs to team extras, **not** credited to the
  batter and **not** charged to the bowler.
- Strike rotation: swap on odd runs **and** at end of over. Both firing = **no net swap**.
- New batter arrives at the **striker's end** unless `crossed: true` on the wicket event.
- Overs are **balls**, never decimals. `19.3` overs is 117 balls. Never divide by 6 for maths.
- Innings ends: all out / overs exhausted / target passed.

## The toss (per MCC Laws of Cricket)

- Law 13.4 — captains toss **in the presence of one or both umpires**.
- Law 13.5 — the winning captain's bat/field decision is **immutable once notified**. There
  must be no edit path in the UI.
- Umpire is an **assignable, optional role** with a captains-confirm fallback. In gully and
  school cricket there is often no neutral umpire. Never make it a required field.
- Build `PHYSICAL_COIN` mode first (two taps, ten minutes). Digital commit-reveal second.

## Working style

- **Ask before scope changes.** Time is the binding constraint, not ideas.
- **Small commits.** Every hour should end at a working state.
- **When behind, cut in the pre-decided order** in `docs/HACKATHON_PLAN.md` §9. Do not
  re-deliberate scope at 4am.
- **Never cut:** the engine, undo, deploy, sleep.
- Test the **web build at hour 10**, not hour 25. React Native Web will surprise you.
- Start the EAS build at **T+25**. Builds queue.

## Remaining engine validation (optional, 30 min)

The golden fixture is synthetic — hand-computed, proves internal consistency. To prove the
engine agrees with the outside world, replay one real published innings per
`docs/replayRealInnings.md`. Worth doing if there's slack; skip it if behind schedule.
