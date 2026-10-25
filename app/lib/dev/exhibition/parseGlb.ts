// Extracts the exhibition map from a GLB's glTF JSON chunk.
//
// Runtime-agnostic on purpose: takes an ArrayBuffer, returns a plain object, no
// Node built-ins and no three.js. The same module therefore runs in the browser
// (parsing a file the designer is holding) and in the parse route (parsing a
// range-read of an asset already on the CDN).
//
// This is not a second loader stack: GLTFLoader in GalleryViewer.tsx renders the
// exhibition, which needs the geometry. The importer needs names, transforms and
// accessor bounds, all of which live in the JSON chunk — 19.9 KiB of the live
// 244.5 MB asset. Decoding geometry to read them would be absurd.

import {
  BOUNDS_OBJECT,
  MINIMAP_CAMERA_OBJECTS,
  PARSER_VERSION,
  REQUIRED_SPAWN_ID,
  duplicates,
  idFor,
  isNum,
  isRecord,
  matchPrefix,
  suspectDuplicateSuffix,
  type Artwork,
  type Bounds,
  type Minimap,
  type ExhibitionMap,
  type ParseIssue,
  type ParseResult,
  type Quat,
  type Room,
  type Spawn,
  type Vec3,
} from "../../exhibition-map/schema";

const GLB_MAGIC = 0x46546c67; // "glTF"
const JSON_CHUNK = 0x4e4f534a; // "JSON"

export type ParseInput = {
  /** The GLB, or at least its header plus complete JSON chunk. */
  bytes: ArrayBuffer;
  filename?: string | null;
  url?: string | null;
  /** Full asset size, when `bytes` is only a range of it. */
  totalBytes?: number | null;
  /** sha256 of the full asset, when the caller read and hashed all of it. */
  hash?: string | null;
};

export class GlbFormatError extends Error {}

/**
 * Most nodes one file may hold. Real exports carry hundreds; the cap bounds the
 * walk on a hostile or corrupt JSON chunk.
 */
export const MAX_NODES = 20_000;

/** Deepest node nesting the walk follows. Blender hierarchies run to tens. */
export const MAX_DEPTH = 256;

// --- reading the glTF JSON -------------------------------------------------
// The JSON chunk is untrusted input: every field is type-checked as it is read,
// so a type-confused or malformed document is a GlbFormatError (the route's
// 422), never a TypeError or RangeError (a 502).

type Json = Record<string, unknown>;

function malformed(what: string): never {
  throw new GlbFormatError(`Malformed glTF JSON: ${what}.`);
}

function optionalArray(v: unknown, what: string): unknown[] {
  if (v === undefined) return [];
  if (!Array.isArray(v)) malformed(`${what} must be an array`);
  return v;
}

function optionalRecord(v: unknown, what: string): Json | undefined {
  if (v === undefined) return undefined;
  if (!isRecord(v)) malformed(`${what} must be an object`);
  return v;
}

function toIndex(v: unknown, what: string): number {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) malformed(`${what} must be a non-negative integer`);
  return v;
}

const optionalIndex = (v: unknown, what: string): number | undefined =>
  v === undefined ? undefined : toIndex(v, what);

/**
 * An optional array of indices, each checked, returned as is rather than
 * copied: a children list can hold millions of entries. Whether each index
 * names an existing node is the walk's business, not this check's.
 */
function indexList(v: unknown, what: string): number[] {
  const list = optionalArray(v, what);
  for (let k = 0; k < list.length; k++) toIndex(list[k], `${what}[${k}]`);
  return list as number[];
}

function optionalString(v: unknown, what: string): string | undefined {
  if (v === undefined) return undefined;
  if (typeof v !== "string") malformed(`${what} must be a string`);
  return v;
}

function optionalNumber(v: unknown, what: string): number | undefined {
  if (v === undefined) return undefined;
  if (!isNum(v)) malformed(`${what} must be a finite number`);
  return v;
}

/** Exactly `count` finite numbers, or undefined when absent. */
function optionalNumbers(v: unknown, count: number, what: string): number[] | undefined {
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.length !== count || !v.every(isNum)) {
    malformed(`${what} must be ${count} finite numbers`);
  }
  return v;
}

/** The object at `list[i]`, which something else referred to. */
function item(list: unknown[], i: number, what: string): Json {
  if (i >= list.length) malformed(`${what} ${i} does not exist (there are ${list.length})`);
  const v = list[i];
  if (!isRecord(v)) malformed(`${what} ${i} must be an object`);
  return v;
}

/** The top-level arrays the parser reads, shape-checked once. Elements are checked as they are used. */
type Gltf = {
  nodes: unknown[];
  meshes: unknown[];
  accessors: unknown[];
  cameras: unknown[];
  /** Root node indices of the default scene. Not range-checked: see flatten. */
  roots: number[];
};

type GltfNode = {
  name: string;
  /** Not range-checked: see flatten. */
  children: number[];
  mesh?: number;
  camera?: number;
  /** Local transform, from `matrix` or from translation/rotation/scale. */
  local: Mat4;
};

/** Byte offset and length of the JSON chunk, read from the 20-byte prologue. */
export function glbJsonChunkRange(header: ArrayBuffer): { offset: number; length: number } {
  if (header.byteLength < 20) throw new GlbFormatError("Not a GLB: shorter than 20 bytes.");
  const view = new DataView(header);
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new GlbFormatError("Not a GLB: bad magic.");
  const version = view.getUint32(4, true);
  if (version !== 2) throw new GlbFormatError(`Unsupported GLB version ${version}.`);
  if (view.getUint32(16, true) !== JSON_CHUNK) {
    throw new GlbFormatError("First GLB chunk is not JSON.");
  }
  return { offset: 20, length: view.getUint32(12, true) };
}

function sceneRoots(json: Json, nodeCount: number): number[] {
  const scenes = optionalArray(json.scenes, "scenes");
  const sceneIndex = optionalIndex(json.scene, "scene") ?? 0;
  const scene = scenes[sceneIndex];
  // No scene to start from: every node is a root, as before.
  const all = () => Array.from({ length: nodeCount }, (_, i) => i);
  if (scene === undefined) return all();
  if (!isRecord(scene)) malformed(`scene ${sceneIndex} must be an object`);
  if (scene.nodes === undefined) return all();
  return indexList(scene.nodes, `scene ${sceneIndex} nodes`);
}

function readGltf(bytes: ArrayBuffer): Gltf {
  const { offset, length } = glbJsonChunkRange(bytes);
  if (bytes.byteLength < offset + length) {
    throw new GlbFormatError(
      `Truncated: JSON chunk needs ${offset + length} bytes, got ${bytes.byteLength}.`
    );
  }

  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, offset, length)));
  } catch {
    throw new GlbFormatError("The GLB's JSON chunk is not valid JSON.");
  }
  if (!isRecord(json)) malformed("the document must be an object");

  const nodes = optionalArray(json.nodes, "nodes");
  if (nodes.length > MAX_NODES) {
    throw new GlbFormatError(`The file has ${nodes.length} nodes; the parser reads at most ${MAX_NODES}.`);
  }

  return {
    nodes,
    meshes: optionalArray(json.meshes, "meshes"),
    accessors: optionalArray(json.accessors, "accessors"),
    cameras: optionalArray(json.cameras, "cameras"),
    roots: sceneRoots(json, nodes.length),
  };
}

function readNode(gltf: Gltf, i: number): GltfNode {
  const raw = item(gltf.nodes, i, "node");
  const what = `node ${i}`;
  const matrix = optionalNumbers(raw.matrix, 16, `${what} matrix`);
  return {
    name: optionalString(raw.name, `${what} name`) ?? "",
    children: indexList(raw.children, `${what} children`),
    mesh: optionalIndex(raw.mesh, `${what} mesh`),
    camera: optionalIndex(raw.camera, `${what} camera`),
    local: matrix
      ? matrix.slice()
      : composeTrs(
          optionalNumbers(raw.translation, 3, `${what} translation`) ?? [0, 0, 0],
          optionalNumbers(raw.rotation, 4, `${what} rotation`) ?? [0, 0, 0, 1],
          optionalNumbers(raw.scale, 3, `${what} scale`) ?? [1, 1, 1]
        ),
  };
}

// --- transforms ------------------------------------------------------------
// glTF matrices are column-major, 16 floats. Kept local so this module has no
// dependency on three.js.

type Mat4 = number[];

const IDENTITY: Mat4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

function multiply(a: Mat4, b: Mat4): Mat4 {
  const out = new Array<number>(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      out[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  }
  return out;
}

function composeTrs([tx, ty, tz]: number[], [qx, qy, qz, qw]: number[], [sx, sy, sz]: number[]): Mat4 {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;

  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function translationOf(m: Mat4): Vec3 {
  return { x: m[12], y: m[13], z: m[14] };
}

/** Rotation quaternion of a world matrix, with scale divided out. */
function rotationOf(m: Mat4): Quat {
  const sx = Math.hypot(m[0], m[1], m[2]) || 1;
  const sy = Math.hypot(m[4], m[5], m[6]) || 1;
  const sz = Math.hypot(m[8], m[9], m[10]) || 1;

  const r = [
    m[0] / sx, m[1] / sx, m[2] / sx,
    m[4] / sy, m[5] / sy, m[6] / sy,
    m[8] / sz, m[9] / sz, m[10] / sz,
  ];
  const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = r;

  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = Math.sqrt(trace + 1) * 2;
    return { x: (m12 - m21) / s, y: (m20 - m02) / s, z: (m01 - m10) / s, w: 0.25 * s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { x: 0.25 * s, y: (m01 + m10) / s, z: (m20 + m02) / s, w: (m12 - m21) / s };
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s, w: (m20 - m02) / s };
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { x: (m20 + m02) / s, y: (m12 + m21) / s, z: 0.25 * s, w: (m01 - m10) / s };
}

function transformPoint(m: Mat4, x: number, y: number, z: number): Vec3 {
  return {
    x: m[0] * x + m[4] * y + m[8] * z + m[12],
    y: m[1] * x + m[5] * y + m[9] * z + m[13],
    z: m[2] * x + m[6] * y + m[10] * z + m[14],
  };
}

function growToInclude(box: Bounds | null, p: Vec3): Bounds {
  if (!box) return { min: { ...p }, max: { ...p } };
  return {
    min: { x: Math.min(box.min.x, p.x), y: Math.min(box.min.y, p.y), z: Math.min(box.min.z, p.z) },
    max: { x: Math.max(box.max.x, p.x), y: Math.max(box.max.y, p.y), z: Math.max(box.max.z, p.z) },
  };
}

function union(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return growToInclude(growToInclude(a, b.min), b.max);
}

// --- extraction ------------------------------------------------------------

type FlatNode = { index: number; name: string; world: Mat4; node: GltfNode; parents: string[] };

/**
 * References past the end of `nodes` from one referrer: how many, the first few
 * distinct indices, and whether more distinct ones followed. Fixed size however
 * many references there are.
 */
type Missing = { count: number; sample: number[]; more: boolean };

const MISSING_SAMPLE = 5;

const noMissing = (): Missing => ({ count: 0, sample: [], more: false });

function noteMissing(missing: Missing, index: number): void {
  missing.count++;
  if (missing.sample.includes(index)) return;
  if (missing.sample.length < MISSING_SAMPLE) missing.sample.push(index);
  else missing.more = true;
}

function danglingIssue(
  referrer: string,
  kind: "root" | "child",
  missing: Missing,
  nodeCount: number,
  object?: string
): ParseIssue {
  const what = missing.count === 1 ? `a ${kind}` : `${missing.count} ${kind === "root" ? "roots" : "children"}`;
  const list = missing.sample.join(", ") + (missing.more ? ", …" : "");
  return {
    level: "error",
    code: "node.dangling-reference",
    message: `${referrer} lists ${what} past the last node (the file has ${nodeCount} nodes): ${list}. Skipped; re-export the file.`,
    ...(object ? { object } : {}),
  };
}

/**
 * Pre-order walk accumulating world matrices and the ancestor name chain, in
 * file order, as the recursive walk did.
 *
 * An explicit stack rather than recursion, so a deep chain stops at MAX_DEPTH
 * with a GlbFormatError instead of overflowing the call stack. The stack holds
 * one frame per level of the current path, each with a cursor into its node's
 * children, never one entry per child reference: a node that lists the same
 * child a million times costs a million cursor steps, not a million stack
 * entries. The walk's memory grows with the node count, not the reference count.
 *
 * A root or child index past the end of `nodes` is skipped, as the recursive
 * walk did, and reported as one error per referrer: the rest of the file still
 * parses.
 */
function flatten(gltf: Gltf, issues: ParseIssue[]): FlatNode[] {
  const nodeCount = gltf.nodes.length;
  const out: FlatNode[] = [];
  const seen = new Set<number>();
  const stack: { entry: FlatNode; childParents: string[]; next: number; missing: Missing }[] = [];

  const visit = (index: number, parentWorld: Mat4, parents: string[]) => {
    if (seen.has(index)) return; // defensive: a malformed cycle must not hang the parse
    seen.add(index);
    if (parents.length > MAX_DEPTH) {
      throw new GlbFormatError(`Node hierarchy is deeper than ${MAX_DEPTH} levels.`);
    }
    const node = readNode(gltf, index);
    const entry = { index, name: node.name, world: multiply(parentWorld, node.local), node, parents };
    out.push(entry);
    stack.push({ entry, childParents: [...parents, node.name], next: 0, missing: noMissing() });
  };

  const missingRoots = noMissing();
  for (const root of gltf.roots) {
    if (root >= nodeCount) {
      noteMissing(missingRoots, root);
      continue;
    }
    visit(root, IDENTITY, []);

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { entry } = frame;
      if (frame.next === entry.node.children.length) {
        stack.pop();
        if (frame.missing.count > 0) {
          const label = entry.name ? `Node ${entry.index} ("${entry.name}")` : `Node ${entry.index}`;
          issues.push(danglingIssue(label, "child", frame.missing, nodeCount, entry.name || undefined));
        }
        continue;
      }
      const child = entry.node.children[frame.next++];
      if (child >= nodeCount) noteMissing(frame.missing, child);
      else visit(child, entry.world, frame.childParents);
    }
  }
  if (missingRoots.count > 0) issues.push(danglingIssue("The scene", "root", missingRoots, nodeCount));
  return out;
}

/** World AABB of a node's own mesh, from accessor min/max. No geometry decode. */
function meshBounds(gltf: Gltf, entry: FlatNode): Bounds | null {
  const meshIndex = entry.node.mesh;
  if (meshIndex === undefined) return null;
  const mesh = item(gltf.meshes, meshIndex, "mesh");

  let box: Bounds | null = null;
  for (const [p, primitive] of optionalArray(mesh.primitives, `mesh ${meshIndex} primitives`).entries()) {
    const what = `mesh ${meshIndex} primitive ${p}`;
    if (!isRecord(primitive)) malformed(`${what} must be an object`);
    const attributes = optionalRecord(primitive.attributes, `${what} attributes`);
    const accessorIndex = optionalIndex(attributes?.POSITION, `${what} POSITION`);
    if (accessorIndex === undefined) continue;
    const accessor = item(gltf.accessors, accessorIndex, "accessor");
    // An accessor without bounds contributes nothing, as before; bounds of the
    // wrong type are a malformed file.
    if (accessor.min === undefined || accessor.max === undefined) continue;
    const min = optionalNumbers(accessor.min, 3, `accessor ${accessorIndex} min`)!;
    const max = optionalNumbers(accessor.max, 3, `accessor ${accessorIndex} max`)!;

    for (const x of [min[0], max[0]]) {
      for (const y of [min[1], max[1]]) {
        for (const z of [min[2], max[2]]) {
          box = growToInclude(box, transformPoint(entry.world, x, y, z));
        }
      }
    }
  }
  return box;
}

/** Nearest ancestor that is a conformant `Room_*` name. */
function roomAncestor(parents: string[]): string | null {
  for (let i = parents.length - 1; i >= 0; i--) {
    const id = idFor("Room", parents[i]);
    if (id) return id;
  }
  return null;
}


/**
 * The world rectangle an orthographic minimap camera frames.
 *
 * glTF cameras look down their local -Z with +Y up, so a top-down minimap camera
 * is rotated to point along world -Y. `xmag`/`ymag` are HALF-extents of the view
 * volume per the glTF spec — note Blender's `ortho_scale` is the full width and
 * the exporter halves it, which is a known source of exporter bugs. Verify once
 * against a known distance rather than trusting the round trip.
 */
function minimapFromCamera(gltf: Gltf, flat: FlatNode[], errors: ParseIssue[]): Minimap | null {
  const found = flat.filter((f) => (MINIMAP_CAMERA_OBJECTS as readonly string[]).includes(f.name));
  if (found.length > 1) {
    errors.push({
      level: "error",
      code: "minimap.duplicate-camera",
      message: `Found both ${found.map((f) => f.name).join(" and ")}. Keep a single top-down orthographic camera.`,
      object: found[1].name,
    });
    return null;
  }
  const entry = found[0];
  if (!entry) return null;

  if (entry.node.camera === undefined) {
    errors.push({
      level: "error",
      code: "minimap.not-a-camera",
      message: `${entry.name} exists but carries no camera. In Blender, tick Include → Cameras when exporting.`,
      object: entry.name,
    });
    return null;
  }

  const camera = item(gltf.cameras, entry.node.camera, "camera");
  const what = `camera ${entry.node.camera}`;
  const type = optionalString(camera.type, `${what} type`);
  const ortho = optionalRecord(camera.orthographic, `${what} orthographic`);
  const xmag = optionalNumber(ortho?.xmag, `${what} xmag`);
  const ymag = optionalNumber(ortho?.ymag, `${what} ymag`);
  if (type !== "orthographic" || !xmag || !ymag) {
    errors.push({
      level: "error",
      code: "minimap.not-orthographic",
      message: `${entry.name} must be an orthographic camera with non-zero xmag/ymag. A perspective camera cannot define a flat map rectangle.`,
      object: entry.name,
    });
    return null;
  }

  const m = entry.world;
  const right = { x: m[0], y: m[1], z: m[2] };
  const up = { x: m[4], y: m[5], z: m[6] };
  const forward = { x: -m[8], y: -m[9], z: -m[10] };

  // Straight down is forward ≈ (0,-1,0). Anything else means the render is not a
  // plan view and a single axis-aligned rectangle cannot describe it.
  if (forward.y > -0.99) {
    errors.push({
      level: "error",
      code: "minimap.camera-not-top-down",
      message: `${entry.name} does not point straight down (forward y=${forward.y.toFixed(3)}). Keep it axis-aligned with no roll.`,
      object: entry.name,
    });
    return null;
  }

  const halfX = Math.abs(xmag * right.x) + Math.abs(ymag * up.x);
  const halfZ = Math.abs(xmag * right.z) + Math.abs(ymag * up.z);
  const centre = translationOf(m);

  return {
    rect: {
      minX: centre.x - halfX,
      maxX: centre.x + halfX,
      minZ: centre.z - halfZ,
      maxZ: centre.z + halfZ,
    },
    // Camera +Y is image-up. If that points along world -Z, then increasing world
    // z moves down the image.
    zAxis: up.z < 0 ? "down" : "up",
    source: "camera",
    pixelWidth: null,
    pixelHeight: null,
    // The GLB describes the frame, not the images rendered from it; those are
    // attached when the map is published.
    variants: {},
    defaultVariant: null,
  };
}

export function parseGlb(input: ParseInput): ParseResult {
  const gltf = readGltf(input.bytes);
  const errors: ParseIssue[] = [];
  const flat = flatten(gltf, errors);

  const rooms: Room[] = [];
  const artworks: Artwork[] = [];
  const spawns: Spawn[] = [];
  let boundsObject: Bounds | null = null;
  let allGeometry: Bounds | null = null;

  for (const entry of flat) {
    const { name } = entry;
    allGeometry = union(allGeometry, meshBounds(gltf, entry));

    if (name === BOUNDS_OBJECT) {
      const box = meshBounds(gltf, entry);
      if (box) {
        boundsObject = union(boundsObject, box);
      } else {
        errors.push({
          level: "warning",
          code: "bounds.not-a-mesh",
          message: `${BOUNDS_OBJECT} has no mesh, so it carries no size. Falling back to the union of Room_* geometry. Make it a cube to override.`,
          object: name,
        });
      }
      continue;
    }

    const prefix = matchPrefix(name);
    if (!prefix) continue;

    const id = idFor(prefix, name);
    if (!id) {
      errors.push({
        level: "error",
        code: "name.malformed",
        message: `"${name}" looks like a ${prefix} object but is not a valid ${prefix}_<id>. Ids must be lowercase kebab-case (letters, digits, single hyphens) — no dots, spaces or underscores.`,
        object: name,
      });
      continue;
    }

    if (suspectDuplicateSuffix(id)) {
      errors.push({
        level: "warning",
        code: "name.suspect-duplicate-suffix",
        message: `${prefix} id "${id}" ends in 3+ digits, which is what a Blender ".00N" duplicate suffix collapses to. Confirm this is intentional.`,
        object: name,
      });
    }

    if (prefix === "Room") {
      const box = meshBounds(gltf, entry);
      if (!box) {
        errors.push({
          level: "error",
          code: "room.no-mesh",
          message: `Room_${id} has no mesh, so it has no bounds. Rooms must be geometry.`,
          object: name,
        });
        continue;
      }
      rooms.push({ id, bounds: box });
    } else if (prefix === "Artwork") {
      artworks.push({
        id,
        roomId: roomAncestor(entry.parents),
        position: translationOf(entry.world),
        rotation: rotationOf(entry.world),
      });
    } else {
      spawns.push({
        id,
        position: translationOf(entry.world),
        rotation: rotationOf(entry.world),
      });
    }
  }

  for (const [kind, list] of [
    ["room", rooms],
    ["artwork", artworks],
    ["spawn", spawns],
  ] as const) {
    for (const dupe of duplicates(list.map((e) => e.id))) {
      errors.push({
        level: "error",
        code: `${kind}.duplicate-id`,
        message: `Two or more objects resolve to ${kind} id "${dupe}". Most often a Blender duplicate whose ".00N" suffix collapsed.`,
        object: dupe,
      });
    }
  }

  if (!spawns.some((s) => s.id === REQUIRED_SPAWN_ID)) {
    errors.push({
      level: "error",
      code: "spawn.missing-main",
      message: `No Spawn_${REQUIRED_SPAWN_ID}. Every exhibition must define the default spawn point.`,
    });
  }

  const roomsBounds = rooms.reduce<Bounds | null>((acc, r) => union(acc, r.bounds), null);

  // Rooms alone do not contain the artworks: wall-mounted pieces sit outside their
  // room's box. Anything that frames or clamps on `bounds` would clip them, so the
  // contract objects define the rectangle, not the rooms alone.
  let contractBounds = roomsBounds;
  for (const point of [...artworks.map((a) => a.position), ...spawns.map((sp) => sp.position)]) {
    contractBounds = growToInclude(contractBounds, point);
  }

  const bounds = boundsObject ?? contractBounds ?? allGeometry;
  if (!bounds) {
    errors.push({
      level: "error",
      code: "bounds.unresolved",
      message: `Could not resolve exhibition bounds: no ${BOUNDS_OBJECT} mesh, no Room_* geometry, and no positioned geometry at all.`,
    });
  } else if (!boundsObject && !contractBounds) {
    errors.push({
      level: "warning",
      code: "bounds.from-all-geometry",
      message: `No ${BOUNDS_OBJECT} and no Room_* objects — bounds fall back to the AABB of every mesh in the file, which includes scenery.`,
    });
  }

  if (boundsObject && contractBounds) {
    const outside =
      contractBounds.min.x < boundsObject.min.x || contractBounds.max.x > boundsObject.max.x ||
      contractBounds.min.z < boundsObject.min.z || contractBounds.max.z > boundsObject.max.z;
    if (outside) {
      errors.push({
        level: "warning",
        code: "bounds.excludes-contract-objects",
        message: `${BOUNDS_OBJECT} does not contain every room, artwork and spawn. Anything clamping to these bounds will clip them.`,
      });
    }
  }

  const minimap = minimapFromCamera(gltf, flat, errors);

  const map: ExhibitionMap = {
    id: null,
    parserVersion: PARSER_VERSION,
    createdAt: new Date().toISOString(),
    source: {
      filename: input.filename ?? null,
      bytes: input.totalBytes ?? input.bytes.byteLength,
      hash: input.hash ?? null,
      url: input.url ?? null,
    },
    assetUrl: input.url ?? null,
    bounds: bounds ?? { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    rooms,
    artworks,
    spawns,
    walls: [],
    minimap,
  };

  return { map, errors };
}
