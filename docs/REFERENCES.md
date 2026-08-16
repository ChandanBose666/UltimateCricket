# Project References & Data Sources

## Free / dummy data store
- **public-apis** — https://github.com/public-apis/public-apis
  - Curated directory of ~1,717 free public APIs across 52 categories.
  - Useful buckets for this project: **Test Data** (30 entries — fake names, avatars,
    lorem/placeholder generators), **Sports & Fitness** (46), **Geocoding** (95 — venue
    lookup), **Weather** (37 — rain/DLS scenarios).
  - Caveats before depending on any entry:
    - Only ~45% require no auth; the rest need an API key or OAuth (mostly freemium).
    - CORS status is `Unknown` for ~57% of entries.
    - 92 entries are still HTTP-only.
    - CI validates *documentation link syntax* on new PRs only — it never pings an
      actual API endpoint, so dead entries accumulate silently.
    - No machine-readable index ships in the repo; the only data file is `README.md`.
  - **Verdict for this project:** fine for seeding demo/dev fixtures. Do NOT put any
    third-party free API on a runtime path in production.

## Recommended for our own test data
Generate fixtures locally (Faker / a seeded script) rather than calling a public API at
test time — deterministic, offline, no rate limits.

## Competitive landscape (checked Aug 2026)
- **CricHeroes** — https://cricheroes.com/global — 40M+ users, ~30k matches scored/month,
  free live scoring + league/tournament management + live streaming + AI highlights.
  This is the incumbent to beat.
