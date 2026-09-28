# Plan: multi-exhibition scaling + minimap coordinate mapping

Deferred work, deliberately. The `/dev/exhibition` portal (M1–M3) is built and
working for **one** exhibition; this document is what to do when a second one
arrives, and how to map GLB coordinates onto a designer-rendered minimap.

**Read `AGENT_DEV_EXHIBITION_CHECKLIST.md` first.** All of its operating rules —
workflow, authorship, no-AI-slop, the linear dependency graph — apply here
unchanged and are not repeated. This document adds scope; it does not replace any
rule.

---

## Status: partly launch-blocking, partly deferred

**The minimap ships with the upcoming exhibition.** That splits this document in
two, and the split is the most important thing on this page:

- **L1–L3 below are launch-blocking.** Without them the minimap either cannot be
  positioned at all, or positions most artworks off the edge of the map.
- **S1–S2 remain deferred**, and are *safely* deferred specifically because L3
  publishes the map as a committed static file. That decouples the visitor path
  from the dev portal's storage, so re-keying storage later cannot break a live
  exhibition.

Pick up the deferred half when **any** of these becomes true:

- A second exhibition needs to exist at the same time as the first.
- An exhibition is authored that is not roughly square, or more than ~2× the
  current 88 m footprint.
- Saved imports pass roughly a hundred, where `listImports` fan-out starts to hurt.
- Someone is tempted to add a second `NEXT_PUBLIC_GALLERY_*` env var pair. That
  temptation *is* the trigger; do S1 instead.

---

## Verified findings (measured, do not re-derive)

Established against the real assets during design. Re-measuring costs an hour.

| Finding | Evidence |
|---|---|
| Live visitor GLB is 244,499,180 bytes; JSON chunk 20,376 bytes | `content-length`; GLB header |
| Conformant export `gallery8_16-organized.glb` is 298,225,456 bytes; JSON chunk 20,724 | GLB header |
| Both parse from the JSON chunk alone, ~0.4 s, no geometry decode | `POST /api/dev/exhibition/parse` timing |
| Minimap PNGs are 2560×2560, 3.7–7.4 MB, three variants (Dark/White/Textured) | `.local-assets/minimaps/` |
| Drawn content is inset **exactly 45 px on all four sides** — content 2470×2470 | PNG decode, background-difference bbox |
| Symmetric margins ⇒ the render camera was **axis-aligned with no roll** | same |
| `Room_*` union (= current `map.bounds`) spans 88.238 × 88.238, origin-centred | parser output |
| **All** rendered geometry spans 108.750 × 108.801 | accessor AABBs, world-transformed |
| `Artwork_*` meshes reach ±54.38 in x — **outside** `bounds` | same |
| **3 of 5 artwork positions normalise outside [0,1]** against `map.bounds` | `lintel-north` u=1.0035, `lintel-east` u=−0.0034, `lintel-west` v=−0.0037 |
| Neither fixture contains any glTF camera | `cameras` absent in both JSON chunks |
| Two candidate framings for the PNG differ by **23%** and the image cannot disambiguate them | 2470 px ↔ 88.238 (0.0357 m/px) vs ↔ 108.750 (0.0440 m/px) |

### The consequence

`map.bounds` and "the world rectangle the minimap image covers" are **two different
rectangles**. Normalising artwork positions against `bounds` — the rule currently
written into the checklist's Minimap section — puts most of the artworks off the
edge of the map. Do not ship that rule.

---

## Phase 0 — unblock the current PNGs (hard dependency, do this first)

Ask the lead artist for the minimap camera's **orthographic scale**:

| If `ortho_scale` is… | image covers | framing used |
|---|---|---|
| **112.712** | ±56.356 | all rendered geometry |
| **91.454** | ±45.727 | `Room_*` union |

One answer resolves the 23% ambiguity. Record the resulting rectangle as literal
numbers against the import and move on. This is a stopgap for renders that already
exist and where nobody captured the camera — it is not the long-term mechanism.

**This is now on the launch critical path**, and it depends on the lead artist
being reachable. If a re-export with `Minimap_Camera` (L1) lands before launch,
Phase 0 is skipped entirely — the camera supersedes it. Treat Phase 0 as the
fallback for shipping against PNGs that already exist.

Also confirm the vertical direction once, empirically: whether world **+Z** points
to the top or the bottom of the image. Do not reason about it from glTF handedness;
a mirrored minimap looks plausible until someone walks into a wall.

---

## The mechanism: the camera *is* the mapping

Every rule of the form "the image covers `bounds`" is a **global convention** — it
must hold for every exhibition forever and fails silently when one designer frames
differently. A camera exported in the GLB is **per-exhibition data**: a 20 m room
and a 300 m hall are described identically with no shared assumption. That is the
whole reason to prefer it.

A glTF orthographic camera carries:

```json
"cameras": [{
  "type": "orthographic",
  "orthographic": { "xmag": 56.356, "ymag": 56.356, "znear": 0.1, "zfar": 1000 }
}]
```

plus its node transform. For a top-down camera:

```
world.minX = camX - xmag     world.maxX = camX + xmag
world.minZ = camZ - ymag     world.maxZ = camZ + ymag
```

General form, if axis-alignment is ever not guaranteed:

```
right  = M · (1,0,0)
up     = M · (0,1,0)
center = (M[12], M[13], M[14])
corners = center ± xmag·right ± ymag·up
```

All of it is in the JSON chunk beside the node data the parser already reads —
roughly 20 lines in `parseGlb.ts`, no new dependency, no geometry decode.

**Two things fall out for free.** The 45 px margin stops mattering, because you
never infer from content — the image covers the camera rect by construction and
geometry simply does not fill it. And the camera's up vector, projected into world
XZ, answers the +Z-up-or-down question directly.

### Caveats that have each bitten someone

1. `xmag`/`ymag` are **half-extents** per the glTF spec, but Blender's `ortho_scale`
   is the **full** width. The exporter halves it. This conversion has been a source
   of exporter bugs — verify once against a known distance rather than trusting it.
2. Blender only writes cameras when **Include → Cameras** is ticked on export. The
   common failure is the artist adding the camera and it silently not appearing.
3. Render aspect must match `xmag:ymag`. On a non-square render Blender fits
   `ortho_scale` to the sensor-fit axis and derives the other — that is where
   stretched maps come from.
4. The PNG must be rendered from **that** camera. Nudging `ortho_scale` after export
   desyncs the mapping with no visible symptom until markers drift.

### Fallback

Keep `MinimapBounds` — a flat plane scaled to exactly the rendered area, importer
takes its world XZ AABB — as the documented fallback for tools that do not
round-trip cameras. Same contract style as `ExhibitionBounds`. The camera is the
primary because it is the same object that produced the image.

---

## Launch-blocking work

The minimap cannot ship correctly without all three.

### L1 — Minimap rectangle from the camera

- [ ] Extract an orthographic `Minimap_Camera` from the GLB; fall back to a
      `MinimapBounds` mesh AABB; otherwise leave `minimap` null and say so in
      `errors[]`. **Never guess a rectangle** — see the 23% ambiguity above.
- [ ] Add the `minimap` block to `schema.ts` (below). **One** rectangle shared by
      all variants; they are the same render and three copies will drift.
- [ ] Validator: aspect agreement,
      `(maxX-minX)/(maxZ-minZ) == pixelWidth/pixelHeight` within ~0.5%. Kills the
      stretched-minimap bug class permanently.
- [ ] Validator: plausible scale — warn below ~2 m or above ~2 km extent. Catches a
      scene authored in centimetres.
- [ ] Confirm the vertical direction empirically once and store it as `zAxis`.

### L2 — `bounds` must contain what the minimap plots

- [ ] `bounds` currently unions `Room_*` only, so **3 of 5 artworks fall outside
      it** (`lintel-north` u=1.0035, `lintel-east` u=−0.0034, `lintel-west`
      v=−0.0037). Union rooms ∪ artwork positions ∪ spawns, or rename it so no
      consumer assumes containment. Small parser change, one test.
- [ ] Note this is independent of L1: even with a correct image rectangle, any
      consumer that clamps or frames on `bounds` will clip those artworks.

### L3 — Publish the map as a committed static file

The mechanism is specified in **Publishing model** in
`AGENT_DEV_EXHIBITION_CHECKLIST.md`; it is M4 work. Summarised here because it is
what makes S1/S2 safe to defer.

- [ ] `content/exhibitions/<slug>.json`, committed, read server-side by one loader
      under `app/lib/exhibition/`.
- [ ] The visitor path must not call `/api/dev/exhibition/*` (password-gated) and
      must not need `BLOB_READ_WRITE_TOKEN`.
- [ ] Minimap PNGs published to `assets.artrium.space`, not `public/`.

**Why this defers S1 and S2.** With the map committed as a file, no import id and
no Blob layout appears in production. Storage can be re-keyed, exhibition identity
added, and env coupling retired at any later date without touching a live
exhibition. Without L3, S1 becomes launch-blocking too.

### Launch-blocking verification

- [ ] Overlay preview on `/dev/exhibition/[id]`: draw artwork and spawn markers on
      the PNG. A flip or a 23% scale error is obvious instantly. This is what turns
      "do not guess" into something enforceable, and it is a small addition to a
      page that already exists. **Do not sign off the minimap by eye on the live
      site** — verify here, against the map document, before publishing.

---

## Deferred work

### S1 — Exhibition identity

Today the system is single-exhibition at three levels:

```
app/lib/gallery-config.ts     NEXT_PUBLIC_GALLERY_MODEL_URL   ← one GLB, in env
                              NEXT_PUBLIC_GALLERY_ROUTE_SLUG  ← one slug, in env
app/exhibition/[slug]/page    slug !== GALLERY_ROUTE_SLUG → notFound()
app/lib/dev/exhibition/storage.ts   PREFIX = "dev-exhibition-imports/"  ← flat
```

A saved document has an *import* id but no *exhibition* id, so "exhibition
`spring-2027`, import 3, currently live" is inexpressible.

- [ ] Add `exhibitionId` (stable kebab slug, chosen deliberately — **not** derived
      from the GLB filename, which changes every export) to the map document.
- [ ] Re-key storage to `exhibitions/<exhibitionId>/imports/<importId>.json`.
- [ ] Add a per-exhibition pointer, `exhibitions/<exhibitionId>/exhibition.json`
      = `{ exhibitionId, title, currentImportId, published, createdAt }`. The *list*
      of exhibitions needs no manifest — `@vercel/blob`'s `list({ mode: 'folded' })`
      returns `folders`, so the storage prefix is the manifest. Only "which import
      is current" and human metadata are non-derivable. Keep the pointer
      per-exhibition, not one global `index.json`, which every save would have to
      read-modify-write and would race.
- [ ] Parser UI asks which exhibition a save belongs to.

### S2 — Retire the env coupling

- [ ] Move `assetUrl` and minimap variant URLs onto the exhibition record.
- [ ] `/exhibition/[slug]` resolves slug → exhibition → current import, instead of
      comparing against one env var.
- [ ] `gallery-config.ts` keeps only genuinely global values (the Draco decoder
      path).
- [ ] Note the route collision: **`/exhibition` is already the public open-call
      page**, so it cannot become an exhibition index without a product decision.
      `/exhibition/<exhibitionId>` is free.

### Deferred with a trigger

`listImports` fetches **every** stored document to build summaries — O(N) round
trips. Fine for one exhibition; stops being fine somewhere in the low hundreds. The
S1 prefix change contains the blast radius. The real fix (summary encoded in the
blob path, or a per-exhibition index) can wait until it actually hurts.

---

## Schema delta

```ts
// spatial only, as always — no content fields
exhibitionId: string;

minimap: {
  variants: { dark: string; light: string; textured: string };
  pixelWidth: number;
  pixelHeight: number;
  /** World rectangle the image covers. From the camera, NOT from bounds. */
  world: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** Whether increasing world z moves down the image. Measured, not inferred. */
  zAxis: "down" | "up";
  /** How `world` was obtained, so a stopgap is never mistaken for ground truth. */
  source: "camera" | "minimap-bounds" | "manual";
} | null;
```

World → image:

```ts
const u = (x - world.minX) / (world.maxX - world.minX);
const t = (z - world.minZ) / (world.maxZ - world.minZ);
const v = zAxis === "down" ? t : 1 - t;
const px = u * pixelWidth, py = v * pixelHeight;
```

Player-centred rotating minimap — the static half is above, the dynamic half is a
transform on the image + marker layer with the player pinned at the viewport centre:

```
transform: rotate(-yaw) translate(-px, -py)
```

Artwork icons counter-rotate by `+yaw` if they must stay upright. Live player pose
stays frontend-local and is never written to the map document.

---

## Sizing policy (what changes when exhibitions differ in size)

- **Fix metres per pixel, not pixel dimensions.** 2560² over the current ~112 m is
  0.044 m/px; the same 2560² over a 500 m exhibition is 0.195 m/px — 4.4× coarser
  for no stated reason. Pick a target near 0.05 m/px, derive dimensions from the
  world rectangle, cap the long edge (~4096), and record the value per import.
- **Display a fixed radius in metres**, e.g. 15 m around the player — never a fixed
  fraction of the image, or a small gallery is absurdly zoomed and a large one is an
  unreadable speck. Derive metres-per-pixel once as
  `(maxX - minX) / pixelWidth` and expose it rather than recomputing per caller.
- **The current PNGs are 4–5× finer than needed.** A ~300 px widget showing 60 m
  across needs ~0.2 m/px even at 2× for retina. Downscaling is the correct
  resolution, not merely a payload win.
- **Serve from `assets.artrium.space`**, alongside the GLB. Keep multi-MB images out
  of `public/`, which ships inside the Vercel deploy. Convert to WebP/AVIF.

---

## Blender contract additions (for the lead artist)

Additions to the existing naming contract, not replacements:

- Add an **orthographic camera named `Minimap_Camera`** pointing straight down.
- Keep it **axis-aligned with zero roll**. Rotation would force a full 2×3 affine on
  every consumer; the current renders already comply, so this only codifies practice.
- Tick **Include → Cameras** when exporting the GLB.
- **Render the minimap PNG from that camera**, in the same session as the export.
- Optionally add a `MinimapBounds` plane matching the framed area as a fallback.
- `Scenery_*` remains outside the contract and is ignored without complaint — that
  is the intended way to mark non-exhibition geometry.

---

## Open questions needing a human decision

1. **Where artwork content lives.** Still unanswered from the original review. The
   map carries spatial ids and a stable `Artwork_<id>` to join on;
   `app/exhibition/artworks.ts` still holds title/artist/medium keyed by mesh name.
   Two sources, two naming schemes. The schema boundary is settled — the store is not.
2. **Who assigns `exhibitionId`.** Suggest a human-chosen slug at save time, since
   deriving it from a filename guarantees drift across re-exports.
3. **Whether minimap variants are a per-exhibition choice or a client theme.** Only
   affects whether the frontend picks one or the record names a default.

---

## Explicitly out of scope

- Collision / walk-mesh so the player cannot leave the floorplan. Separate frontend
  issue; the viewer has never had collision.
- `walls` polylines. With a PNG underlay these are likely **permanently
  unnecessary**, not merely deferred — `walls` was the only geometry-dependent field,
  so without it the parser may never need a Draco decoder at all.
- Any real database product. Blob stays the dev portal's workbench; the visitor
  path reads a committed static file. See **Publishing model** in the checklist.
- `/dev/exhibition/database` or `/endpoints` pages, as always.
