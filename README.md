# UltimateCricket

Cricket scoring + tournament management for grassroots and school cricket.

## 📌 Start here
- [`CLAUDE.md`](CLAUDE.md) — **agent instructions.** Claude Code reads this automatically
  at session start. Keep it at the repo root.
- [`docs/HACKATHON_PLAN.md`](docs/HACKATHON_PLAN.md) — **the build plan for this weekend.**
  Solo, 24–36h, judge-tested prototype. This is the one you execute.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the 6-month system design. Not the
  build order; it's your "where this goes next" material and your closing slide.
- [`docs/REFERENCES.md`](docs/REFERENCES.md) — data sources & competitive notes.

## ✅ Engine: done
`src/engine/` — pure TypeScript, zero dependencies. **56 tests passing, strict typecheck clean.**
```bash
npm i && npx vitest run && npx tsc --noEmit
```

## Hackathon scope (locked)
**In:** scoring engine · one-tap scoring UI · umpire-supervised toss · live scorecard ·
local knockout bracket · unlimited undo

**Out:** backend · auth · sync · realtime · round-robin · NRR · stats · DLS · streaming

## Stack (hackathon)
Expo + TypeScript · Zustand + AsyncStorage persist · **no backend** · ships as a web URL
(Vercel) plus an Android APK (EAS).

## The three rules
1. Engine before UI. Hours 1–5, no screens.
2. Deploy at T+25, not T+29.
3. Sleep T+16→19.5 is not negotiable.

## Continuing in VSCode
1. Unzip this whole folder to `E:\UltimateCricket`, open it in VSCode.
2. `CLAUDE.md` must stay at the repo root — Claude Code loads it automatically.
3. Paste `docs/KICKOFF_PROMPT.md` as your first message. Do NOT paste the plan docs
   themselves; the agent reads them from disk.
