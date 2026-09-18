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
  PARSER_VERSION,
  REQUIRED_SPAWN_ID,
  duplicates,
  idFor,
  matchPrefix,
  suspectDuplicateSuffix,
  type Artwork,
  type Bounds,
  type ExhibitionMap,
  type ParseIssue,
  type ParseResult,
  type Quat,
  type Room,
  type Spawn,
  type Vec3,
} from "./schema";

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

type GltfNode = {
  name?: string;
  children?: number[];
  mesh?: number;
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
};

type Gltf = {
  nodes?: GltfNode[];
  meshes?: { name?: string; primitives?: { attributes?: Record<string, number> }[] }[];
  accessors?: { min?: number[]; max?: number[] }[];
  scenes?: { nodes?: number[] }[];
  scene?: number;
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

function readGltf(bytes: ArrayBuffer): Gltf {
  const { offset, length } = glbJsonChunkRange(bytes);
  if (bytes.byteLength < offset + length) {
    throw new GlbFormatError(
      `Truncated: JSON chunk needs ${offset + length} bytes, got ${bytes.byteLength}.`
    );
  }
  const text = new TextDecoder().decode(new Uint8Array(bytes, offset, length));
  return JSON.parse(text) as Gltf;
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

function localMatrix(node: GltfNode): Mat4 {
  if (node.matrix?.length === 16) return node.matrix.slice();

  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];

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

/** Depth-first walk accumulating world matrices and the ancestor name chain. */
function flatten(gltf: Gltf): FlatNode[] {
  const nodes = gltf.nodes ?? [];
  const sceneRoots = gltf.scenes?.[gltf.scene ?? 0]?.nodes ?? nodes.map((_, i) => i);
  const out: FlatNode[] = [];
  const seen = new Set<number>();

  const walk = (index: number, parentWorld: Mat4, parents: string[]) => {
    if (seen.has(index)) return; // defensive: a malformed cycle must not hang the parse
    seen.add(index);
    const node = nodes[index];
    if (!node) return;
    const world = multiply(parentWorld, localMatrix(node));
    const name = node.name ?? "";
    out.push({ index, name, world, node, parents });
    for (const child of node.children ?? []) walk(child, world, [...parents, name]);
  };

  for (const root of sceneRoots) walk(root, IDENTITY, []);
  return out;
}

/** World AABB of a node's own mesh, from accessor min/max. No geometry decode. */
function meshBounds(gltf: Gltf, entry: FlatNode): Bounds | null {
  const mesh = entry.node.mesh === undefined ? undefined : gltf.meshes?.[entry.node.mesh];
  if (!mesh) return null;

  let box: Bounds | null = null;
  for (const primitive of mesh.primitives ?? []) {
    const accessorIndex = primitive.attributes?.POSITION;
    if (accessorIndex === undefined) continue;
    const accessor = gltf.accessors?.[accessorIndex];
    const min = accessor?.min;
    const max = accessor?.max;
    if (!min || !max || min.length < 3 || max.length < 3) continue;

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

export function parseGlb(input: ParseInput): ParseResult {
  const gltf = readGltf(input.bytes);
  const flat = flatten(gltf);
  const errors: ParseIssue[] = [];

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
  const bounds = boundsObject ?? roomsBounds ?? allGeometry;
  if (!bounds) {
    errors.push({
      level: "error",
      code: "bounds.unresolved",
      message: `Could not resolve exhibition bounds: no ${BOUNDS_OBJECT} mesh, no Room_* geometry, and no positioned geometry at all.`,
    });
  } else if (!boundsObject && !roomsBounds) {
    errors.push({
      level: "warning",
      code: "bounds.from-all-geometry",
      message: `No ${BOUNDS_OBJECT} and no Room_* objects — bounds fall back to the AABB of every mesh in the file, which includes scenery.`,
    });
  }

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
  };

  return { map, errors };
}
