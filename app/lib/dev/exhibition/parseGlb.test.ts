import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Resolved from the repo root, not __dirname: `npm test` compiles this file to
// .test-build/, where the fixtures directory does not exist.
const FIXTURES = join(process.cwd(), "app", "lib", "dev", "exhibition", "__fixtures__");
import test from "node:test";

import { glbJsonChunkRange, GlbFormatError, MAX_DEPTH, MAX_NODES, parseGlb } from "./parseGlb";
import { AssetFetchError, MAX_JSON_CHUNK, readRemoteGlbHead, type FetchLike } from "./remoteGlb";
import {
  isIssueList,
  MAX_ISSUES,
  PARSER_VERSION,
  validateMap,
} from "../../exhibition-map/schema";
import {
  RESERVED_IDS,
  isValidImportId,
  newImportId,
  summarize,
} from "./imports";

type TestNode = {
  name: string;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  children?: number[];
  mesh?: number;
  camera?: number;
};

type TestCamera = { type?: string; orthographic?: { xmag?: number; ymag?: number } };

/** Builds a header + JSON-chunk GLB. One unit cube mesh, shared by every node. */
function glb(
  nodes: TestNode[],
  opts: { withMesh?: boolean; camera?: TestCamera } = {}
): ArrayBuffer {
  const withMesh = opts.withMesh !== false;
  const gltf = {
    ...(opts.camera ? { cameras: [opts.camera] } : {}),
    asset: { version: "2.0" },
    scene: 0,
    scenes: [{ nodes: nodes.map((_, i) => i).filter((i) => !nodes.some((n) => n.children?.includes(i))) }],
    nodes: nodes.map((n) => ({
      name: n.name,
      ...(n.translation ? { translation: n.translation } : {}),
      ...(n.rotation ? { rotation: n.rotation } : {}),
      ...(n.children ? { children: n.children } : {}),
      ...(n.camera !== undefined ? { camera: n.camera } : {}),
      ...(withMesh && n.mesh !== undefined ? { mesh: n.mesh } : {}),
    })),
    meshes: [{ name: "cube", primitives: [{ attributes: { POSITION: 0 } }] }],
    accessors: [{ min: [-1, -1, -1], max: [1, 1, 1] }],
  };

  return rawGlb(JSON.stringify(gltf));
}

/** A GLB around any JSON chunk text, well-formed or not. */
function rawGlb(json: string): ArrayBuffer {
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
  // Bounds contain every contract object, not just the rooms: the artwork at
  // (12.4, 3.2, -8.1) and the spawn at (0, 1.4, 5) both stretch it.
  assert.deepEqual(map.bounds, {
    min: { x: -1, y: -1, z: -8.1 },
    max: { x: 12.4, y: 3.2, z: 5 },
  });
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

test("an explicit ExhibitionBounds wins, but is flagged when it clips contract objects", () => {
  const { map, errors } = parseGlb({
    bytes: glb([
      { name: "Room_main", mesh: 0, translation: [0, 0, 0] },
      { name: "ExhibitionBounds", mesh: 0, translation: [10, 0, 0] },
      { name: "Spawn_Main" },
    ]),
  });
  // The designer's explicit box is respected rather than silently widened...
  assert.deepEqual(map.bounds, { min: { x: 9, y: -1, z: -1 }, max: { x: 11, y: 1, z: 1 } });
  // ...but the room and spawn at the origin sit outside it, which must be said.
  const flagged = errors.find((e) => e.code === "bounds.excludes-contract-objects");
  assert.ok(flagged, "expected a warning that the explicit bounds clips objects");
  assert.equal(flagged.level, "warning");
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
  // Room cube at x=4 (±1), widened to reach Spawn_Main at the origin.
  assert.deepEqual(map.bounds, { min: { x: 0, y: -1, z: -1 }, max: { x: 5, y: 1, z: 1 } });
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

test("every artwork in the real export now normalises inside the map", () => {
  const file = readFileSync(join(FIXTURES, "conformant-export-head.glb"));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  const { map } = parseGlb({ bytes });
  const b = map.bounds;

  // Before the containment fix, 3 of these 5 fell outside [0,1] — lintel-north at
  // u=1.0035, lintel-east at u=-0.0034, lintel-west at v=-0.0037.
  for (const a of map.artworks) {
    const u = (a.position.x - b.min.x) / (b.max.x - b.min.x);
    const v = (a.position.z - b.min.z) / (b.max.z - b.min.z);
    assert.ok(u >= 0 && u <= 1, `artwork ${a.id} has u=${u}, outside the map`);
    assert.ok(v >= 0 && v <= 1, `artwork ${a.id} has v=${v}, outside the map`);
  }
  for (const sp of map.spawns) {
    const u = (sp.position.x - b.min.x) / (b.max.x - b.min.x);
    assert.ok(u >= 0 && u <= 1, `spawn ${sp.id} has u=${u}, outside the map`);
  }
});

test("OrthographicTopCamera defines the rectangle and the z direction", () => {
  const { map, errors } = parseGlb({
    bytes: glb(
      [
        { name: "Room_main", mesh: 0 },
        { name: "Spawn_Main" },
        // Rotated -90° about X: looks down world -Y, camera up along world -Z.
        { name: "OrthographicTopCamera", translation: [2, 40, -3], rotation: [-0.7071068, 0, 0, 0.7071068], camera: 0 },
      ],
      { camera: { type: "orthographic", orthographic: { xmag: 50, ymag: 50 } } }
    ),
  });

  assert.deepEqual(errors, []);
  assert.ok(map.minimap, "expected a minimap block");
  assert.equal(map.minimap.source, "camera");
  // Half-extents are xmag/ymag about the camera's world position.
  assert.equal(Math.round(map.minimap.rect.minX), -48);
  assert.equal(Math.round(map.minimap.rect.maxX), 52);
  assert.equal(Math.round(map.minimap.rect.minZ), -53);
  assert.equal(Math.round(map.minimap.rect.maxZ), 47);
  assert.equal(map.minimap.zAxis, "down");
});

test("the earlier Minimap_Camera name still defines the rectangle", () => {
  const { map, errors } = parseGlb({
    bytes: glb(
      [
        { name: "Room_main", mesh: 0 },
        { name: "Spawn_Main" },
        { name: "Minimap_Camera", translation: [0, 40, 0], rotation: [-0.7071068, 0, 0, 0.7071068], camera: 0 },
      ],
      { camera: { type: "orthographic", orthographic: { xmag: 10, ymag: 10 } } }
    ),
  });
  assert.equal(errors.length, 0);
  assert.equal(map.minimap?.source, "camera");
  assert.equal(map.minimap?.rect.minX, -10);
  assert.equal(map.minimap?.rect.maxX, 10);
});

test("two minimap cameras are an error rather than a guess", () => {
  const { map, errors } = parseGlb({
    bytes: glb(
      [
        { name: "Room_main", mesh: 0 },
        { name: "Spawn_Main" },
        { name: "OrthographicTopCamera", rotation: [-0.7071068, 0, 0, 0.7071068], camera: 0 },
        { name: "Minimap_Camera", rotation: [-0.7071068, 0, 0, 0.7071068], camera: 0 },
      ],
      { camera: { type: "orthographic", orthographic: { xmag: 10, ymag: 10 } } }
    ),
  });
  assert.equal(map.minimap, null);
  assert.ok(errors.some((e) => e.code === "minimap.duplicate-camera"));
});

test("a camera that is not orthographic or not top-down is rejected, not guessed", () => {
  const perspective = parseGlb({
    bytes: glb(
      [{ name: "Room_main", mesh: 0 }, { name: "Spawn_Main" },
       { name: "Minimap_Camera", rotation: [-0.7071068, 0, 0, 0.7071068], camera: 0 }],
      { camera: { type: "perspective" } }
    ),
  });
  assert.equal(perspective.map.minimap, null);
  assert.ok(perspective.errors.some((e) => e.code === "minimap.not-orthographic"));

  const sideways = parseGlb({
    bytes: glb(
      [{ name: "Room_main", mesh: 0 }, { name: "Spawn_Main" },
       { name: "Minimap_Camera", camera: 0 }],
      { camera: { type: "orthographic", orthographic: { xmag: 10, ymag: 10 } } }
    ),
  });
  assert.equal(sideways.map.minimap, null);
  assert.ok(sideways.errors.some((e) => e.code === "minimap.camera-not-top-down"));
});

test("no Minimap_Camera simply means no minimap, with no error", () => {
  const { map, errors } = parseGlb({
    bytes: glb([{ name: "Room_main", mesh: 0 }, { name: "Spawn_Main" }]),
  });
  assert.equal(map.minimap, null);
  assert.equal(errors.filter((e) => e.code.startsWith("minimap.")).length, 0);
});

test("a malformed minimap block is reported, not thrown", () => {
  const { map } = parseGlb({ bytes: glb([{ name: "Room_main", mesh: 0 }, { name: "Spawn_Main" }]) });
  // Before validateMinimap checked structure first, this read rect.maxX off an
  // empty object and threw — a 500 from the parse route on a posted document.
  for (const minimap of [{}, { rect: null }, { rect: { minX: 0 } }, "nope", 42]) {
    const codes = validateMap({ ...map, minimap }).map((i) => i.code);
    assert.ok(codes.some((c) => c.startsWith("minimap.")), `minimap ${JSON.stringify(minimap)} gave ${codes}`);
  }
});

test("a published minimap must name a real variant and carry its pixel size", () => {
  const { map } = parseGlb({ bytes: glb([{ name: "Room_main", mesh: 0 }, { name: "Spawn_Main" }]) });
  const base = {
    rect: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
    zAxis: "down" as const,
    source: "camera" as const,
    pixelWidth: 1000,
    pixelHeight: 1000,
    variants: { textured: "https://assets.artrium.space/t.png" },
    defaultVariant: "textured" as const,
  };
  const codes = (minimap: unknown) => validateMap({ ...map, minimap }).map((i) => i.code);

  assert.deepEqual(codes(base), []);
  assert.ok(codes({ ...base, defaultVariant: "dark" }).includes("minimap.default-variant"));
  assert.ok(codes({ ...base, variants: { sepia: "x" } }).includes("minimap.unknown-variant"));
  assert.ok(codes({ ...base, pixelWidth: null, pixelHeight: null }).includes("minimap.pixel-size"));
  // A 2:1 image over a square rectangle would stretch every marker.
  assert.ok(codes({ ...base, pixelWidth: 2000 }).includes("minimap.aspect-mismatch"));
});

// --- malformed JSON chunks --------------------------------------------------
// The route answers GlbFormatError with 422 and anything else with 502, so a
// malformed file must never surface as a TypeError or RangeError.

/** Asserts a GlbFormatError and nothing else: a TypeError must fail the test, not pass it. */
function assertFormatError(json: string, label: string) {
  assert.throws(
    () => parseGlb({ bytes: rawGlb(json) }),
    (e: unknown) => {
      assert.ok(e instanceof GlbFormatError, `${label}: expected GlbFormatError, got ${String(e)}`);
      return true;
    },
    label
  );
}

test("type-confused glTF JSON is a format error, never a TypeError", () => {
  const cube = { meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }] };
  const cases: Record<string, unknown> = {
    "document is an array": [],
    "document is null": null,
    "nodes is an object": { nodes: {} },
    "nodes is a string": { nodes: "Spawn_Main" },
    "a node is null": { nodes: [null] },
    "children is a string": { nodes: [{ name: "Room_main", children: "12" }, { name: "Spawn_Main" }] },
    "a child index is a string": { nodes: [{ name: "Room_main", children: ["1"] }, { name: "Spawn_Main" }] },
    "a child index is out of range": { nodes: [{ name: "Room_main", children: [7] }] },
    "name is a number": { nodes: [{ name: 42 }] },
    "translation holds a string": { nodes: [{ name: "Spawn_Main", translation: ["1", 0, 0] }] },
    "rotation is too short": { nodes: [{ name: "Spawn_Main", rotation: [0, 0, 1] }] },
    "matrix is too short": { nodes: [{ name: "Spawn_Main", matrix: [1, 0, 0, 1] }] },
    "matrix is not an array": { nodes: [{ name: "Spawn_Main", matrix: "identity" }] },
    "mesh is a string": { nodes: [{ name: "Room_main", mesh: "0" }], ...cube },
    "meshes is an object": { nodes: [{ name: "Room_main", mesh: 0 }], meshes: {} },
    "accessor bounds are strings": {
      nodes: [{ name: "Room_main", mesh: 0 }],
      ...cube,
      accessors: [{ min: "abc", max: "def" }],
    },
    "scene is a string": { scene: "0", scenes: [{ nodes: [0] }], nodes: [{ name: "Spawn_Main" }] },
    "scene nodes is a string": { scenes: [{ nodes: "0" }], nodes: [{ name: "Spawn_Main" }] },
    "camera xmag is a string": {
      nodes: [{ name: "Spawn_Main" }, { name: "OrthographicTopCamera", camera: 0 }],
      cameras: [{ type: "orthographic", orthographic: { xmag: "50", ymag: 50 } }],
    },
  };
  for (const [label, json] of Object.entries(cases)) assertFormatError(JSON.stringify(json), label);
});

test("an invalid JSON chunk is a format error, without echoing the parser's text", () => {
  assertFormatError('{"nodes": [', "unterminated");
  assertFormatError("not json at all", "not json");
  assert.throws(() => parseGlb({ bytes: rawGlb('{"nodes": [') }), /not valid JSON/);
});

/** A single chain: node i's only child is node i + 1. */
function chain(depth: number): string {
  const nodes = Array.from({ length: depth + 1 }, (_, i) => ({
    name: i === depth ? "Spawn_Main" : `Group_${i}`,
    translation: [1, 0, 0],
    ...(i < depth ? { children: [i + 1] } : {}),
  }));
  return JSON.stringify({ scenes: [{ nodes: [0] }], nodes });
}

test("nesting up to the depth cap composes; past it is a format error, not a stack overflow", () => {
  // The deepest node the walk accepts sits MAX_DEPTH levels below its root, and
  // every level adds 1 on x.
  const { map } = parseGlb({ bytes: rawGlb(chain(MAX_DEPTH)) });
  assert.equal(map.spawns[0]?.position.x, MAX_DEPTH + 1);

  assertFormatError(chain(MAX_DEPTH + 1), "one level past the cap");
  // Far deeper than the old recursive walk's call stack could follow.
  assertFormatError(chain(MAX_NODES - 1), "a chain of every node allowed");
});

test("a file with more nodes than the cap is a format error", () => {
  const nodes = Array.from({ length: MAX_NODES + 1 }, () => ({}));
  assertFormatError(JSON.stringify({ nodes }), "too many nodes");
});

test("a cycle in the node graph is walked once, not forever", () => {
  const json = JSON.stringify({
    scenes: [{ nodes: [0] }],
    nodes: [{ name: "Room_main", children: [1] }, { name: "Spawn_Main", children: [0] }],
  });
  const { map } = parseGlb({ bytes: rawGlb(json) });
  assert.deepEqual(map.spawns.map((s) => s.id), ["Main"]);
});

// --- parse by URL -----------------------------------------------------------
// The route's network rules, exercised through an injected fetch.

const ASSET = "https://assets.artrium.space/Standardized-VGallery.glb";

type Call = { url: string; init: RequestInit };

/** A fake CDN serving `file`, recording every request. `answer` can override a response by call number. */
function cdn(file: ArrayBuffer, answer?: (call: number, from: number, to: number) => Response | undefined) {
  const calls: Call[] = [];
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const header = new Headers(init.headers).get("range") ?? "";
    const [, from, to] = /^bytes=(\d+)-(\d+)$/.exec(header)!.map(Number);
    const override = answer?.(calls.length, from, to);
    if (override) return override;
    return new Response(file.slice(from, to + 1), {
      status: 206,
      headers: { "content-range": `bytes ${from}-${Math.min(to, file.byteLength - 1)}/${file.byteLength}` },
    });
  };
  return { calls, fetchImpl };
}

test("a published asset is read in two range requests, both 206, with redirects refused", async () => {
  const file = glb([{ name: "Spawn_Main" }]);
  const { calls, fetchImpl } = cdn(file);

  const head = await readRemoteGlbHead(ASSET, fetchImpl);
  const { length } = glbJsonChunkRange(file);
  assert.deepEqual(
    calls.map((c) => new Headers(c.init.headers).get("range")),
    ["bytes=0-19", `bytes=0-${19 + length}`]
  );
  assert.ok(calls.every((c) => c.init.redirect === "error"), "both requests must refuse redirects");
  assert.equal(head.filename, "Standardized-VGallery.glb");
  assert.equal(head.totalBytes, file.byteLength);

  const { map, errors } = parseGlb(head);
  assert.deepEqual(errors, []);
  assert.equal(map.assetUrl, ASSET);
});

test("a JSON chunk over the cap is refused before it is requested", async () => {
  const header = new ArrayBuffer(20);
  const view = new DataView(header);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(12, MAX_JSON_CHUNK + 1, true);
  view.setUint32(16, 0x4e4f534a, true);
  const { calls, fetchImpl } = cdn(header);

  await assert.rejects(readRemoteGlbHead(ASSET, fetchImpl), GlbFormatError);
  assert.equal(calls.length, 1, "the JSON chunk must never be fetched");
});

test("either request answered with anything but 206 is refused", async () => {
  const file = glb([{ name: "Spawn_Main" }]);
  const whole = () => new Response(file, { status: 200 });

  // The second request is the one that used to accept any 2xx.
  for (const call of [1, 2]) {
    const { fetchImpl } = cdn(file, (n) => (n === call ? whole() : undefined));
    await assert.rejects(readRemoteGlbHead(ASSET, fetchImpl), AssetFetchError, `call ${call}`);
  }
  const { fetchImpl } = cdn(file, () => new Response("Not Found: bucket internal-assets-prod", { status: 404, statusText: "Not Found" }));
  await assert.rejects(readRemoteGlbHead(ASSET, fetchImpl), (e: Error) => {
    assert.ok(e instanceof AssetFetchError);
    assert.equal(e.message, "Asset host answered 404; expected 206 Partial Content.");
    return true;
  });
});

test("a 206 carrying more than the requested range is cut off", async () => {
  const file = glb([{ name: "Spawn_Main" }]);
  const { fetchImpl } = cdn(file, (n) =>
    n === 2 ? new Response(new Uint8Array(file.byteLength + 4096), { status: 206 }) : undefined
  );
  await assert.rejects(readRemoteGlbHead(ASSET, fetchImpl), AssetFetchError);
});

test("fetch failures, redirects included, come back without their text", async () => {
  const secret = "connect ECONNREFUSED 10.0.12.7:443";
  const fetchImpl: FetchLike = async () => {
    throw new TypeError("fetch failed", { cause: new Error(secret) });
  };
  await assert.rejects(readRemoteGlbHead(ASSET, fetchImpl), (e: Error) => {
    assert.ok(e instanceof AssetFetchError);
    assert.ok(!e.message.includes("10.0.12.7") && !e.message.includes("fetch failed"), e.message);
    return true;
  });
});

test("only https URLs on the asset host are ever fetched", async () => {
  const { calls, fetchImpl } = cdn(glb([{ name: "Spawn_Main" }]));
  for (const url of [
    "http://assets.artrium.space/a.glb",
    "https://assets.artrium.space:8443/a.glb",
    "https://evil.example/a.glb",
    "https://assets.artrium.space.evil.example/a.glb",
    "https://user:pass@assets.artrium.space/a.glb",
    "not a url",
  ]) {
    await assert.rejects(readRemoteGlbHead(url, fetchImpl), GlbFormatError, url);
  }
  assert.equal(calls.length, 0);
});

// --- stored issues ----------------------------------------------------------

test("a submitted issue list must be well-formed and bounded", () => {
  const issue = { level: "warning", code: "bounds.not-a-mesh", message: "No mesh.", object: "ExhibitionBounds" };
  assert.equal(isIssueList([]), true);
  assert.equal(isIssueList([issue, { level: "error", code: "spawn.missing-main", message: "No spawn." }]), true);
  assert.equal(isIssueList(Array.from({ length: MAX_ISSUES }, () => issue)), true);

  assert.equal(isIssueList(Array.from({ length: MAX_ISSUES + 1 }, () => issue)), false, "over the cap");
  for (const bad of [
    null,
    42,
    "warning",
    { ...issue, level: "fatal" },
    { ...issue, code: 7 },
    { ...issue, message: undefined },
    { ...issue, object: { name: "x" } },
    { ...issue, object: null },
  ]) {
    assert.equal(isIssueList([bad]), false, JSON.stringify(bad));
  }
  assert.equal(isIssueList({ 0: issue, length: 1 }), false, "array-like is not an array");
});

test("a malformed stored issue is skipped, not thrown on, when summarising", () => {
  const { map } = parseGlb({ bytes: glb([{ name: "Spawn_Main" }]) });
  const base = { id: "abcdef1234567890", savedAt: "2026-09-23T00:00:00.000Z", map };

  // `[null]` alone used to make the hub list answer 500 until the blob was deleted.
  const summary = summarize({
    ...base,
    errors: [null, 42, "error", { level: "error" }, { level: "error", code: "x", message: "y", object: {} },
      { level: "error", code: "spawn.missing-main", message: "No spawn." },
      { level: "warning", code: "bounds.not-a-mesh", message: "No mesh." }],
  });
  assert.equal(summary.errorCount, 1);
  assert.equal(summary.warningCount, 1);

  // Not even an array.
  assert.equal(summarize({ ...base, errors: "oops" as unknown as unknown[] }).errorCount, 0);
});
