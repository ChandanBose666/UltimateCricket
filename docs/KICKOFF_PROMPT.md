# First message to paste into Claude Code

Copy everything below the line into your first message in VSCode. Do **not** paste the plan
documents themselves — Claude Code reads `CLAUDE.md` automatically, and pasting 900 lines of
markdown burns context you need for actual code.

---

Read `CLAUDE.md` and `docs/HACKATHON_PLAN.md` before doing anything.

I'm starting the hackathon build. We are at **T+5** of a 30-hour solo build — block T+1→5
(the scoring engine) is **already done**. `src/engine/` exists, is pure TypeScript, and has
56 passing tests plus a clean strict typecheck.

**First, verify it:**

```bash
npm i
npx vitest run     # expect 56 passing
npx tsc --noEmit   # expect clean
```

If that's green, **do not refactor the engine.** It is the validated foundation. If you need
behaviour it doesn't have, add a test first, then extend — never rewrite.

**Your task is block T+5→6.5: the toss module.**

Build `src/toss/` per `docs/HACKATHON_PLAN.md` §5:

- Umpire is an **assignable, optional** role with a captains-confirm fallback. Never required.
- Per MCC Law 13.4, the umpire initiates and witnesses; per Law 13.5 the bat/field decision is
  **immutable once confirmed** — no edit path in the UI.
- Build `PHYSICAL_COIN` mode first (two taps, ten minutes). `DIGITAL` commit-reveal second.
- Keep toss logic pure and testable, same discipline as the engine. Wire the UI after.

Then stop and show me before moving to the scoring UI (T+6.5→13).

Constraints, restated so we don't drift:

- **No backend, no network, no auth.** Zustand + AsyncStorage persist only.
- No new dependencies beyond Expo + Zustand + AsyncStorage + nanoid + Vitest.
- Everything must work under **React Native Web** — we ship a web URL as the primary demo.
- The cut list in `docs/HACKATHON_PLAN.md` §1 is closed. Don't propose additions.
