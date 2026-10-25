import assert from "node:assert/strict";
import test from "node:test";

import { getExhibition } from "./map";
import { minimapUrlFor, modelUrlFor, GALLERY_EXHIBITION_ID } from "../gallery-config";
import { ASSET_ORIGIN, REQUIRED_SPAWN_ID, validateMap } from "../exhibition-map/schema";

// The published map is what visitors get, so the file itself is under test: a
// broken or mis-pointed commit should fail here, not on the live site.

test("the published exhibition loads and passes the one schema", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID);
  assert.ok(map, `content/exhibitions/${GALLERY_EXHIBITION_ID}.json should exist`);
  assert.deepEqual(validateMap(map), []);
  assert.ok(map.spawns.some((s) => s.id === REQUIRED_SPAWN_ID), "the gallery needs Spawn_Main");
});

test("the published minimap rectangle came from the camera, not a guess", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID);
  assert.ok(map?.minimap, "expected a minimap block from OrthographicTopCamera");
  assert.equal(map.minimap.source, "camera");
  assert.equal(map.minimap.zAxis, "down");
  // xmag = ymag = 56.6 about the origin, as Blender exported it.
  for (const edge of [map.minimap.rect.maxX, -map.minimap.rect.minX, map.minimap.rect.maxZ, -map.minimap.rect.minZ]) {
    assert.ok(Math.abs(edge - 56.6) < 0.001, `edge ${edge} should be 56.6`);
  }
});

test("the published asset points at the CDN, never a local dev path", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID);
  assert.ok(map?.assetUrl?.startsWith(`${ASSET_ORIGIN}/`), `got ${map?.assetUrl}`);
});

test("exhibition ids cannot escape content/exhibitions", () => {
  for (const id of ["../package", "../../etc/passwd", "a/b", "UPPER", "", "with space"]) {
    assert.equal(getExhibition(id), null, `id ${JSON.stringify(id)} must not resolve`);
  }
});

test("an exhibition that was never published is null, not an error", () => {
  assert.equal(getExhibition("never-published"), null);
});

test("production always loads the published asset; the override is dev-only", () => {
  const saved = { env: process.env.NODE_ENV, url: process.env.NEXT_PUBLIC_GALLERY_MODEL_URL };
  const env = process.env as Record<string, string | undefined>;
  try {
    env.NEXT_PUBLIC_GALLERY_MODEL_URL = "/local/Standardized-VGallery.glb";

    env.NODE_ENV = "development";
    assert.equal(modelUrlFor("https://assets.artrium.space/x.glb"), "/local/Standardized-VGallery.glb");

    // A stale variable left set in Vercel must not swap the model under the map.
    env.NODE_ENV = "production";
    assert.equal(modelUrlFor("https://assets.artrium.space/x.glb"), "https://assets.artrium.space/x.glb");

    delete env.NEXT_PUBLIC_GALLERY_MODEL_URL;
    env.NODE_ENV = "development";
    assert.equal(modelUrlFor("https://assets.artrium.space/x.glb"), "https://assets.artrium.space/x.glb");
    assert.equal(modelUrlFor(null), null);
  } finally {
    env.NODE_ENV = saved.env;
    if (saved.url === undefined) delete env.NEXT_PUBLIC_GALLERY_MODEL_URL;
    else env.NEXT_PUBLIC_GALLERY_MODEL_URL = saved.url;
  }
});

test("the published minimap image is attached, sized, and on the CDN", () => {
  const minimap = getExhibition(GALLERY_EXHIBITION_ID)?.minimap;
  assert.ok(minimap?.defaultVariant, "the gallery needs a default minimap image");
  const url = minimap.variants[minimap.defaultVariant];
  assert.ok(url?.startsWith(`${ASSET_ORIGIN}/`), `got ${url}`);
  // Every variant, not just the default: any of them may be shown.
  for (const [name, variantUrl] of Object.entries(minimap.variants)) {
    assert.ok(variantUrl?.startsWith(`${ASSET_ORIGIN}/`), `${name} points at ${variantUrl}`);
  }
  // Without pixel dimensions the aspect check could not run against the camera.
  assert.equal(minimap.pixelWidth, 2560);
  assert.equal(minimap.pixelHeight, 2560);
});

test("the minimap image override is dev-only too", () => {
  const saved = { env: process.env.NODE_ENV, url: process.env.NEXT_PUBLIC_GALLERY_MINIMAP_URL };
  const env = process.env as Record<string, string | undefined>;
  try {
    env.NEXT_PUBLIC_GALLERY_MINIMAP_URL = "/local/Textured_MiniMap.png";
    env.NODE_ENV = "development";
    assert.equal(minimapUrlFor("https://assets.artrium.space/t.png"), "/local/Textured_MiniMap.png");
    env.NODE_ENV = "production";
    assert.equal(minimapUrlFor("https://assets.artrium.space/t.png"), "https://assets.artrium.space/t.png");
  } finally {
    env.NODE_ENV = saved.env;
    if (saved.url === undefined) delete env.NEXT_PUBLIC_GALLERY_MINIMAP_URL;
    else env.NEXT_PUBLIC_GALLERY_MINIMAP_URL = saved.url;
  }
});

test("assetUrl is null or an https URL on the asset host, nothing else", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID)!;
  const codes = (assetUrl: unknown) => validateMap({ ...map, assetUrl }).map((i) => i.code);

  assert.deepEqual(codes(null), []);
  assert.deepEqual(codes(`${ASSET_ORIGIN}/Standardized-VGallery.glb`), []);
  const withoutAssetUrl: Record<string, unknown> = { ...map };
  delete withoutAssetUrl.assetUrl;
  assert.deepEqual(validateMap(withoutAssetUrl), [], "an absent assetUrl reads as null");

  for (const bad of [
    "http://assets.artrium.space/a.glb",
    "https://assets.artrium.space:8443/a.glb",
    "https://user:pass@assets.artrium.space/a.glb",
    "https://assets.artrium.space.evil.example/a.glb",
    "https://evil.example/a.glb",
    "//assets.artrium.space/a.glb",
    "/local/Standardized-VGallery.glb",
    "javascript:alert(1)",
    "",
    42,
    { href: `${ASSET_ORIGIN}/a.glb` },
  ]) {
    assert.deepEqual(codes(bad), ["map.asset-url"], `assetUrl ${JSON.stringify(bad)}`);
  }
});

test("source fields are typed: strings or null, and a non-negative byte count", () => {
  const map = getExhibition(GALLERY_EXHIBITION_ID)!;
  const codes = (source: unknown) => validateMap({ ...map, source }).map((i) => i.code);

  assert.deepEqual(codes({ filename: null, bytes: null, hash: null, url: null }), []);
  assert.deepEqual(codes({}), [], "absent fields read as null");
  assert.deepEqual(codes({ ...map.source, url: "https://anywhere.example/a.glb" }), [], "source.url is provenance, not a load target");

  for (const [field, value] of [
    ["url", 42],
    ["filename", { name: "a.glb" }],
    ["hash", ["abc"]],
    ["bytes", "198171700"],
    ["bytes", -1],
  ] as const) {
    assert.deepEqual(codes({ ...map.source, [field]: value }), ["map.source.invalid"], `${field}: ${JSON.stringify(value)}`);
  }
  for (const source of [null, "a.glb", [], undefined]) {
    assert.deepEqual(codes(source), ["map.source"], `source ${JSON.stringify(source)}`);
  }
});
