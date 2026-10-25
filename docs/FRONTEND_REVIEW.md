# Frontend review

The frontend review of 2026-10-24 covers this site and the app together. It lives in the app repo, next to the backend review it follows:

- `artrium/docs/FRONTEND_REVIEW.md` — the consolidated, ranked findings and the fix order. The landing-site items are C2 (map crash), C5 (CI), C12 and C13 (Ticket Center), C19 (headers), C20 (waitlist and map-pins), C24 and C25 (portal validation), C26 and C27.
- `artrium/docs/review/F1-trust-boundaries.md`, `F2-input-rendering.md`, `F6-code-health.md` — the three code-read passes, each with a landing-site section.
- `artrium/docs/review/F3-F4-walkthrough.md` — the device and accessibility walkthrough script, which includes this site's pages.

What landed in this repo from that review: `.github/workflows/ci.yml` (lint, typecheck, test, build, audit on every push), the eslint ignore for compiled test output, the React hook rule fixes, and `next` 16.4.3.
