import assert from "node:assert/strict";
import test from "node:test";

import { getExhibition } from "./map";
import { modelUrlFor, GALLERY_EXHIBITION_ID } from "../gallery-config";
import { REQUIRED_SPAWN_ID, validateMap } from "../exhibition-map/schema";

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
  assert.ok(map?.assetUrl?.startsWith("https://assets.artrium.space/"), `got ${map?.assetUrl}`);
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
