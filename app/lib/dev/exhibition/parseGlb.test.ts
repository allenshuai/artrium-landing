import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolved from the repo root, not __dirname: `npm test` compiles this file to
// .test-build/, where the fixtures directory does not exist.
const FIXTURES = join(process.cwd(), "app", "lib", "dev", "exhibition", "__fixtures__");
import test from "node:test";

import { glbJsonChunkRange, GlbFormatError, parseGlb } from "./parseGlb";
import {
  PARSER_VERSION,
  RESERVED_IDS,
  isValidImportId,
  newImportId,
  summarize,
  validateMap,
} from "./schema";

type TestNode = {
  name: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  children?: number[];
  mesh?: number;
};

/** Builds a header + JSON-chunk GLB. One unit cube mesh, shared by every node. */
function glb(nodes: TestNode[], opts: { withMesh?: boolean } = {}): ArrayBuffer {
  const withMesh = opts.withMesh !== false;
  const gltf = {
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i))) }],
    nodes: nodes.map((n) => ({
      name: n.name,
      ...(n.translation ? { translation: n.translation } : {}),
      ...(n.rotation ? { rotation: n.rotation } : {}),
      ...(n.children ? { children: n.children } : {}),
      ...(withMesh && n.mesh !== undefined ? { mesh: n.mesh } : {}),
    })),
    meshes: [{ name: "cube", primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ min: [-1, -1, -1], max: [1, 1, 1] }],
  };

  let json = JSON.stringify(gltf);
  while (json.length % 4 !== 0) json += " ";
  const jsonBytes = new TextEncoder().encode(json);

  const buffer = new ArrayBuffer(20 + jsonBytes.length);
  const view = new DataView(buffer);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, buffer.byteLength, true);
  view.setUint32(12, jsonBytes.length, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  new Uint8Array(buffer, 20).set(jsonBytes);
  return buffer;
}

const codes = (issues: { code: string }[]) => issues.map((i) => i.code).sort();

test("conformant export parses clean and validates", () => {
  const { map, errors } = parseGlb({
    bytes: glb([
      { name: "Room_main-gallery", mesh: 0, translation: [0, 0, 0] },
      { name: "Artwork_desert-hawk", mesh: 0, translation: [12.4, 3.2, -8.1] },
      { name: "Spawn_Main", translation: [0, 1.4, 5] },
    ]),
    filename: "exhibition.glb",
  });

  assert.deepEqual(errors, []);
  assert.equal(map.parserVersion, PARSER_VERSION);
  assert.deepEqual(map.rooms.map((r) => r.id), ["main-gallery"]);
  assert.deepEqual(map.artworks.map((a) => a.id), ["desert-hawk"]);
  assert.deepEqual(map.spawns.map((s) => s.id), ["Main"]);
  assert.deepEqual(map.artworks[0].position, { x: 12.4, y: 3.2, z: -8.1 });
  assert.deepEqual(map.walls, []);
  assert.equal(map.id, null);
  // Bounds come from the room's transformed cube, not from scenery.
  assert.deepEqual(map.bounds, { min: { x: -1, y: -1, z: -1 }, max: { x: 1, y: 1, z: 1 } });
  assert.deepEqual(validateMap(map), []);
});

test("a collapsed .001 duplicate suffix is caught, not silently accepted", () => {
  const { errors } = parseGlb({
    bytes: glb([
      { name: "Artwork_hawk", mesh: 0 },
      { name: "Artwork_hawk001", mesh: 0 },
      { name: "Spawn_Main" },
    ]),
  });
  // "hawk001" is a valid kebab id, so the trailing-digit heuristic is what flags it.
  assert.ok(codes(errors).includes("name.suspect-duplicate-suffix"));
});

test("two objects resolving to one id is a hard error", () => {
  const { errors } = parseGlb({
    bytes: glb([
      { name: "Artwork_hawk", mesh: 0 },
      { name: "Artwork_hawk", mesh: 0 },
      { name: "Spawn_Main" },
    ]),
  });
  const dupe = errors.find((e) => e.code === "artwork.duplicate-id");
  assert.ok(dupe, "expected a duplicate-id error");
  assert.equal(dupe.level, "error");
  assert.equal(dupe.object, "hawk");
});

test("dotted Blender names are rejected rather than mangled into ids", () => {
  const { map, errors } = parseGlb({
    bytes: glb([{ name: "Artwork_DesertHawk.001", mesh: 0 }, { name: "Spawn_Main" }]),
  });
  assert.deepEqual(map.artworks, []);
  const bad = errors.find((e) => e.code === "name.malformed");
  assert.ok(bad);
  assert.equal(bad.object, "Artwork_DesertHawk.001");
});

test("near-miss names are reported, never skipped in silence", () => {
  const { errors } = parseGlb({
    bytes: glb([{ name: "artwork-hawk", mesh: 0 }, { name: "Spawn_Main" }]),
  });
  assert.ok(errors.some((e) => e.code === "name.malformed" && e.object === "artwork-hawk"));
});

test("missing Spawn_Main is a hard error", () => {
  const { errors } = parseGlb({
    bytes: glb([{ name: "Room_main", mesh: 0 }, { name: "Spawn_Side" }]),
  });
  assert.ok(errors.some((e) => e.code === "spawn.missing-main" && e.level === "error"));
});

test("ExhibitionBounds mesh overrides the room union", () => {
  const { map, errors } = parseGlb({
    bytes: glb([
      { name: "Room_main", mesh: 0, translation: [0, 0, 0] },
      { name: "ExhibitionBounds", mesh: 0, translation: [10, 0, 0] },
      { name: "Spawn_Main" },
    ]),
  });
  assert.deepEqual(errors, []);
  assert.deepEqual(map.bounds, { min: { x: 9, y: -1, z: -1 }, max: { x: 11, y: 1, z: 1 } });
});

test("an ExhibitionBounds empty warns and falls back to rooms", () => {
  const { map, errors } = parseGlb({
    bytes: glb([
      { name: "Room_main", mesh: 0, translation: [4, 0, 0] },
      { name: "ExhibitionBounds" },
      { name: "Spawn_Main" },
    ]),
  });
  assert.ok(errors.some((e) => e.code === "bounds.not-a-mesh" && e.level === "warning"));
  assert.deepEqual(map.bounds, { min: { x: 3, y: -1, z: -1 }, max: { x: 5, y: 1, z: 1 } });
});

test("roomId comes from the nearest Room_* ancestor", () => {
  const { map } = parseGlb({
    bytes: glb([
      { name: "Room_west", mesh: 0, translation: [0, 0, 0], children: [1] },
      { name: "Artwork_hawk", mesh: 0, translation: [2, 0, 0] },
      { name: "Spawn_Main" },
    ]),
  });
  assert.equal(map.artworks[0].roomId, "west");
  // Child transforms compose: 0 + 2 on x.
  assert.equal(map.artworks[0].position.x, 2);
});

test("an unparented artwork gets roomId null, not a guess", () => {
  const { map } = parseGlb({
    bytes: glb([{ name: "Artwork_hawk", mesh: 0 }, { name: "Spawn_Main" }]),
  });
  assert.equal(map.artworks[0].roomId, null);
});

test("world rotation is preserved as a quaternion", () => {
  const halfTurnY = [0, 1, 0, 0] as [number, number, number, number]; // 180° about Y
  const { map } = parseGlb({
    bytes: glb([{ name: "Artwork_hawk", mesh: 0, rotation: halfTurnY }, { name: "Spawn_Main" }]),
  });
  const r = map.artworks[0].rotation;
  assert.ok(Math.abs(Math.abs(r.y) - 1) < 1e-6, `expected |y|≈1, got ${r.y}`);
  assert.ok(Math.abs(r.w) < 1e-6, `expected w≈0, got ${r.w}`);
});

test("non-GLB and truncated input fail loudly", () => {
  assert.throws(() => glbJsonChunkRange(new ArrayBuffer(8)), GlbFormatError);
  assert.throws(() => parseGlb({ bytes: new TextEncoder().encode("not a glb!!!").buffer as ArrayBuffer }), GlbFormatError);

  const good = glb([{ name: "Spawn_Main" }]);
  assert.throws(() => parseGlb({ bytes: good.slice(0, good.byteLength - 4) }), GlbFormatError);
});

test("header range is read from the 20-byte prologue", () => {
  const bytes = glb([{ name: "Spawn_Main" }]);
  const { offset, length } = glbJsonChunkRange(bytes);
  assert.equal(offset, 20);
  assert.equal(length, bytes.byteLength - 20);
});

test("the real Blender export is reported as non-conformant, not empty-and-fine", () => {
  const file = readFileSync(join(FIXTURES, "real-export-head.glb"));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;

  const { map, errors } = parseGlb({ bytes, url: "https://assets.artrium.space/VirtualGallery7_26.glb", totalBytes: 244_499_180 });

  // The designer has not adopted the contract, so nothing resolves...
  assert.deepEqual(map.artworks, []);
  assert.deepEqual(map.rooms, []);
  assert.deepEqual(map.spawns, []);
  // ...and that must surface as blocking problems.
  assert.ok(errors.some((e) => e.code === "spawn.missing-main" && e.level === "error"));
  assert.ok(errors.some((e) => e.code === "bounds.from-all-geometry"));

  // Bounds still come out of the JSON chunk alone, with no geometry decode.
  assert.ok(map.bounds.max.x > map.bounds.min.x);
  assert.equal(map.source.bytes, 244_499_180);
  assert.equal(map.source.hash, null, "a range read must not claim a whole-file hash");

  // And the document is structurally valid apart from the missing spawn.
  assert.deepEqual(validateMap(map).map((i) => i.code), ["spawn.missing-main"]);
});

test("content smuggled into the map document is rejected", () => {
  const { map } = parseGlb({
    bytes: glb([
      { name: "Room_main", mesh: 0 },
      { name: "Artwork_hawk", mesh: 0 },
      { name: "Spawn_Main" },
    ]),
  });
  assert.deepEqual(validateMap(map), []);

  // The spatial/content boundary is enforced, not merely documented.
  const withContent = {
    ...map,
    artworks: [{ ...map.artworks[0], title: "Desert Hawk", artist: "A. Person" }],
  };
  const codes = validateMap(withContent).map((i) => i.code);
  assert.deepEqual(codes, ["map.artworks.unknown-field", "map.artworks.unknown-field"]);

  assert.deepEqual(
    validateMap({ ...map, assetSize: 123 }).map((i) => i.code),
    ["map.unknown-field"]
  );
});

test("the conformant export parses clean end to end", () => {
  const file = readFileSync(join(FIXTURES, "conformant-export-head.glb"));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;

  const { map, errors } = parseGlb({
    bytes,
    filename: "gallery8_16-organized.glb",
    totalBytes: 298_225_456,
  });

  // Specific checks first: asserting deepEqual(errors, []) narrows errors to
  // never[], which would make these unreachable to the type checker.
  assert.equal(
    errors.some((e) => e.object?.startsWith("Scenery_")),
    false,
    "Scenery_* is outside the contract and must be ignored without complaint"
  );
  assert.equal(errors.some((e) => e.code === "bounds.from-all-geometry"), false);
  assert.deepEqual(errors, [], "a conformant export must produce no issues at all");
  assert.deepEqual(validateMap(map), []);

  assert.deepEqual(map.rooms.map((r) => r.id).sort(), ["main-dome", "main-hall"]);
  assert.deepEqual(map.spawns.map((s) => s.id), ["Main"]);
  assert.deepEqual(
    map.artworks.map((a) => a.id).sort(),
    ["celestial-orb", "column-form", "lintel-east", "lintel-north", "lintel-west"]
  );

  // Artworks are parented under their room, so roomId resolves for every one.
  assert.equal(map.artworks.every((a) => a.roomId !== null), true);
  assert.equal(map.artworks.find((a) => a.id === "celestial-orb")?.roomId, "main-dome");

  // Bounds come from the Room_* union rather than every mesh in the file.
  assert.ok(map.bounds.max.y > map.bounds.min.y);
});

test("import ids are opaque and cannot shadow a static route", () => {
  for (const reserved of RESERVED_IDS) assert.equal(isValidImportId(reserved), false);
  assert.equal(isValidImportId("../escape"), false);
  assert.equal(isValidImportId("UPPERCASE"), false);
  assert.equal(isValidImportId("short"), false);

  const id = newImportId();
  assert.equal(isValidImportId(id), true);
  assert.notEqual(id, newImportId());
});

test("summaries are derived from the document, never stored twice", () => {
  const file = readFileSync(join(FIXTURES, "conformant-export-head.glb"));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  const { map, errors } = parseGlb({ bytes, filename: "gallery8_16-organized.glb" });

  const summary = summarize({ id: "abcdef1234567890", savedAt: "2026-09-23T00:00:00.000Z", map, errors });
  assert.equal(summary.rooms, map.rooms.length);
  assert.equal(summary.artworks, map.artworks.length);
  assert.equal(summary.filename, "gallery8_16-organized.glb");
  assert.equal(summary.errorCount, 0);
  assert.equal(summary.warningCount, 0);
});
