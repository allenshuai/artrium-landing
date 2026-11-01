# artrium-landing

The public site at [artrium.space](https://artrium.space): the landing page, `/map` (events, jobs,
opportunities and community listings from the Artrium app's API, on Mapbox), `/exhibition` (the
virtual 3D gallery), team, updates and privacy pages, and the waitlist form. It also hosts two
internal portals.
Next.js 16 (App Router), React 19, Tailwind 4, deployed on Vercel.

## Run it

```bash
npm ci
cp .env.example .env.local   # fill in what you need; everything is optional for the public pages
npm run dev                  # http://localhost:3000
npm run lint && npx next typegen && npx tsc --noEmit && npm test && npm run build
```

## Environment

| Variable | What it does |
|---|---|
| `TICKETCENTER_PASSWORD` | Shared team password for `/ticketcenter`. |
| `TICKETCENTER_COOKIE_SECRET` | Signs the Ticket Center's `tc_view` and `tc_lead` cookies. |
| `TICKETCENTER_LEADS` | Lead passcodes, `Name:passcode,Name2:passcode2`; a lead can edit tickets, meetings and the directory. |
| `DEV_EXHIBITION_PASSWORD` | Password for the `/dev/exhibition` portal. |
| `DEV_EXHIBITION_COOKIE_SECRET` | Signs that portal's `dev_ex_view` cookie. |
| `BLOB_STORE_ID` | Set by Vercel when a Blob store is connected; saved imports go there (OIDC auth). |
| `BLOB_READ_WRITE_TOKEN` | Blob token for code running outside Vercel; leave both empty locally to use `.local-imports/`. |
| `GOOGLE_SHEET_ID` | The spreadsheet behind the Ticket Center. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Service account that reads and writes that sheet. |
| `GOOGLE_PRIVATE_KEY` | That service account's private key. |
| `ARTRIUM_API_BASE_URL` | Artrium app API that `/api/map-pins` reads; unset, the map is empty. |
| `MAPBOX_TOKEN` | Server token for geocoding listings that have no coordinates. |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Browser token for drawing the map. |
| `WAITLIST_SCRIPT_URL` | Google Apps Script the waitlist form posts to; unset, `/api/waitlist` answers 503. |
| `WAITLIST_SHARED_SECRET` | Optional; sent to that script as a `secret` body field so it can refuse posts that skip `/api/waitlist`. See [Waitlist](#waitlist). |
| `NEXT_PUBLIC_GALLERY_MODEL_URL` | Development only: stands in for the published gallery GLB. |
| `NEXT_PUBLIC_GALLERY_MINIMAP_URL` | Development only: stands in for the published minimap image. |
| `NEXT_PUBLIC_GALLERY_ROUTE_SLUG` | The unlisted slug the gallery is served at, `/exhibition/<slug>`. |

## Waitlist

The form in `TicketPopup` posts to `/api/waitlist`, which checks the input with
`app/lib/waitlist/validation.ts` (the popup uses the same module), rate-limits per client (60 per 15
minutes, loose enough for a shared venue network), and relays to the Apps Script at
`WAITLIST_SCRIPT_URL`.

**Outstanding:** the script still accepts any post. The old hardcoded URL is in git history, so anyone
can call it directly and skip the checks. Someone with access to the script should:

1. In `doPost(e)`, parse `e.postData.contents`, compare its `secret` with a value kept in the script's
   properties, return `{ ok: false }` on a mismatch, and never write `secret` to the sheet. It has to be
   a body field: the `e` object Apps Script passes to `doPost` has no request headers.
2. Deploy that as a new deployment and archive the old one, so the URL in git history stops answering,
   then set the new URL as `WAITLIST_SCRIPT_URL` and the same secret as `WAITLIST_SHARED_SECRET` in Vercel.

`WAITLIST_SHARED_SECRET` can be set before the script checks it, provided the script writes only the
fields it reads by name (name, email, source) and not the whole body.

## Internal portals

Both are gated in `proxy.ts`, each by its own signed cookie, so one portal's login never opens the other.

- **`/ticketcenter`**: the team's tickets, meetings and outreach, stored in Google Sheets. The team
  password (`TICKETCENTER_PASSWORD`) lets you view; a lead passcode (`TICKETCENTER_LEADS`) also lets you edit.
- **`/dev/exhibition`**: the GLB parser, which turns an exhibition `.glb` into map JSON, and the
  saved imports. Gated by `DEV_EXHIBITION_PASSWORD`.

Their login endpoints are rate-limited per client (`app/lib/security/ratelimit.ts`).

## CI

`.github/workflows/ci.yml` runs on every pull request and on pushes to `main`: lint, `next typegen`,
typecheck, tests, build (no env vars needed), and `npm audit` of production dependencies at critical.

## Known issues

See [`docs/FRONTEND_REVIEW.md`](docs/FRONTEND_REVIEW.md) for the frontend review and what must land
before the exhibition opens.
