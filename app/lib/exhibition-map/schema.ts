// The one exhibition map schema, shared by the dev portal (which produces maps)
// and the visitor gallery (which consumes them). Neither feature owns it, so it
// lives here and imports nothing from either — no parallel shapes.
//
// The document is SPATIAL ONLY: ids, transforms, bounds. Artwork content
// (title, artist, medium, description, images) is joined by artwork id from
// wherever content lives, and must never be added to this document. Re-importing
// a GLB must not touch content, and fixing a content typo must not require a
// re-import.

export const PARSER_VERSION = 1;

/** The spawn every exhibition must define. */
export const REQUIRED_SPAWN_ID = "Main";

export type Vec3 = { x: number; y: number; z: number };
export type Quat = { x: number; y: number; z: number; w: number };
export type Bounds = { min: Vec3; max: Vec3 };

export type Room = { id: string; bounds: Bounds };

export type Artwork = {
  id: string;
  /** Owning room, or null when the object has no `Room_*` ancestor. */
  roomId: string | null;
  position: Vec3;
  /** World rotation as exported. The frontend derives facing/yaw from this. */
  rotation: Quat;
};

export type Spawn = { id: string; position: Vec3; rotation: Quat };

export type MapSource = {
  filename: string | null;
  bytes: number | null;
  /** sha256 of the bytes the parser read, or null when only a range was read. */
  hash: string | null;
  url: string | null;
};

export type ExhibitionMap = {
  /** Assigned on save (M3); null for a parse that was never persisted. */
  id: string | null;
  parserVersion: number;
  createdAt: string;
  source: MapSource;
  assetUrl: string | null;
  bounds: Bounds;
  rooms: Room[];
  artworks: Artwork[];
  spawns: Spawn[];
  /** Floorplan polylines. Always empty until the walls milestone. */
  walls: never[];
  /** Null until a minimap camera or MinimapBounds exists, or one is calibrated. */
  minimap: Minimap | null;
};

export type ParseIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
  /** The offending object name, when one applies. */
  object?: string;
};

export type ParseResult = { map: ExhibitionMap; errors: ParseIssue[] };

// ---------------------------------------------------------------------------
// Naming contract
// ---------------------------------------------------------------------------

// Ids are lowercase kebab: they survive three.js's name sanitisation (which
// strips dots) and a collapsed Blender ".00N" suffix produces an INVALID id
// rather than a valid id for a different object.
const ID = "[a-z0-9]+(?:-[a-z0-9]+)*";

export const PREFIXES = ["Artwork", "Room", "Spawn"] as const;
export type Prefix = (typeof PREFIXES)[number];

/** Spawn ids are conventionally capitalised (`Spawn_Main`), so allow both. */
const STRICT: Record<Prefix, RegExp> = {
  Artwork: new RegExp(`^Artwork_(${ID})$`),
  Room: new RegExp(`^Room_(${ID})$`),
  Spawn: new RegExp(`^Spawn_([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)$`),
};

/** Anything meant to be one of ours, however badly spelled. */
const LOOSE: Record<Prefix, RegExp> = {
  Artwork: /^artwork[_\-.]/i,
  Room: /^room[_\-.]/i,
  Spawn: /^spawn[_\-.]/i,
};

export const BOUNDS_OBJECT = "ExhibitionBounds";

/**
 * Top-down orthographic camera that frames the minimap. Current Blender exports
 * name it `OrthographicTopCamera`. `Minimap_Camera` is the earlier name and still parses.
 */
export const MINIMAP_CAMERA_OBJECTS = ["OrthographicTopCamera", "Minimap_Camera"] as const;
export const MINIMAP_CAMERA_OBJECT = MINIMAP_CAMERA_OBJECTS[0];

/** A collapsed Blender duplicate suffix (".001" -> "001") hides here. */
const SUSPECT_TRAILING_DIGITS = /\d{3,}$/;

export function matchPrefix(name: string): Prefix | null {
  return PREFIXES.find((p) => LOOSE[p].test(name)) ?? null;
}

/** Returns the id for a conformant name, or null. */
export function idFor(prefix: Prefix, name: string): string | null {
  return STRICT[prefix].exec(name)?.[1] ?? null;
}

export function suspectDuplicateSuffix(id: string): boolean {
  return SUSPECT_TRAILING_DIGITS.test(id);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const MAP_KEYS = ["id", "parserVersion", "createdAt", "source", "assetUrl", "bounds", "rooms", "artworks", "spawns", "walls", "minimap"];
const SOURCE_KEYS = ["filename", "bytes", "hash", "url"];
const ENTITY_KEYS: Record<"rooms" | "artworks" | "spawns", string[]> = {
  rooms: ["id", "bounds"],
  artworks: ["id", "roomId", "position", "rotation"],
  spawns: ["id", "position", "rotation"],
};

/**
 * Keys present but not allowed. This is what keeps artwork *content* out of the
 * map document: a smuggled `title` or `artist` is rejected rather than quietly
 * persisted, so the spatial/content boundary is enforced, not just documented.
 */
function unknownKeys(value: unknown, allowed: string[]): string[] {
  if (typeof value !== "object" || value === null) return [];
  return Object.keys(value).filter((k) => !allowed.includes(k));
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function isVec3(v: unknown): v is Vec3 {
  const o = v as Vec3 | null;
  return !!o && isNum(o.x) && isNum(o.y) && isNum(o.z);
}

function isQuat(v: unknown): v is Quat {
  const o = v as Quat | null;
  return !!o && isNum(o.x) && isNum(o.y) && isNum(o.z) && isNum(o.w);
}

function isBounds(v: unknown): v is Bounds {
  const o = v as Bounds | null;
  return !!o && isVec3(o.min) && isVec3(o.max);
}

/**
 * Structural validation of a map document from an untrusted source — the parse
 * route runs this on anything a client posts, since the browser does the
 * parsing. Returns the problems found; empty means the shape is sound.
 */
export function validateMap(value: unknown): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const err = (code: string, message: string, object?: string) =>
    issues.push({ level: "error", code, message, object });

  if (typeof value !== "object" || value === null) {
    err("map.not-object", "Map must be an object.");
    return issues;
  }
  const m = value as Partial<ExhibitionMap>;

  if (m.parserVersion !== PARSER_VERSION) {
    err(
      "map.parser-version",
      `Expected parserVersion ${PARSER_VERSION}, got ${String(m.parserVersion)}.`
    );
  }
  if (typeof m.createdAt !== "string" || Number.isNaN(Date.parse(m.createdAt))) {
    err("map.created-at", "createdAt must be an ISO date string.");
  }
  for (const key of unknownKeys(m, MAP_KEYS)) {
    err("map.unknown-field", `Unexpected top-level field "${key}". The map document is spatial only.`, key);
  }
  for (const key of unknownKeys(m.source, SOURCE_KEYS)) {
    err("map.unknown-field", `Unexpected source field "${key}".`, key);
  }
  if (!isBounds(m.bounds)) err("map.bounds", "bounds must be { min: Vec3, max: Vec3 }.");
  if (!Array.isArray(m.walls) || m.walls.length > 0) {
    err("map.walls", "walls must be an empty array until the walls milestone.");
  }

  for (const [key, check] of [
    ["rooms", (r: Room) => typeof r.id === "string" && isBounds(r.bounds)],
    [
      "artworks",
      (a: Artwork) =>
        typeof a.id === "string" &&
        (a.roomId === null || typeof a.roomId === "string") &&
        isVec3(a.position) &&
        isQuat(a.rotation),
    ],
    ["spawns", (s: Spawn) => typeof s.id === "string" && isVec3(s.position) && isQuat(s.rotation)],
  ] as const) {
    const list = m[key] as unknown;
    if (!Array.isArray(list)) {
      err(`map.${key}`, `${key} must be an array.`);
      continue;
    }
    list.forEach((entry, i) => {
      if (!check(entry)) err(`map.${key}.invalid`, `${key}[${i}] is malformed.`);
      for (const extra of unknownKeys(entry, ENTITY_KEYS[key])) {
        err(
          `map.${key}.unknown-field`,
          `${key}[${i}] has unexpected field "${extra}". Artwork content belongs outside this document, joined by id.`,
          extra
        );
      }
    });
    const ids = list.map((e: { id?: unknown }) => e?.id).filter((v): v is string => typeof v === "string");
    for (const dupe of duplicates(ids)) {
      err(`map.${key}.duplicate-id`, `Duplicate ${key} id "${dupe}".`, dupe);
    }
  }

  if (m.minimap !== undefined && m.minimap !== null) {
    issues.push(...validateMinimap(m.minimap as Minimap));
  }

  const spawns = Array.isArray(m.spawns) ? (m.spawns as Spawn[]) : [];
  if (!spawns.some((s) => s.id === REQUIRED_SPAWN_ID)) {
    err("spawn.missing-main", `No Spawn_${REQUIRED_SPAWN_ID} — the required spawn point.`);
  }

  return issues;
}

export function duplicates(ids: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    seen.add(id);
  }
  return [...dupes];
}

export function hasBlockingError(issues: ParseIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------

/**
 * The world rectangle a minimap image covers. This is NOT `bounds` — it is a
 * property of the render camera, and conflating the two puts artworks off the
 * edge of the map. Always recorded, never inferred from the image.
 */
export type MinimapRect = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type Minimap = {
  rect: MinimapRect;
  /** Whether increasing world z moves DOWN the image. Measured, not reasoned about. */
  zAxis: "down" | "up";
  /** How `rect` was obtained, so a provisional value is never mistaken for truth. */
  source: "camera" | "minimap-bounds" | "manual";
  /** Set when known; the PoC calibrates against a locally chosen file. */
  pixelWidth: number | null;
  pixelHeight: number | null;
};

/** Project a world point into normalized image space. Origin is the image top-left. */
export function worldToImage(
  minimap: Minimap,
  x: number,
  z: number
): { u: number; v: number } {
  const u = (x - minimap.rect.minX) / (minimap.rect.maxX - minimap.rect.minX);
  const t = (z - minimap.rect.minZ) / (minimap.rect.maxZ - minimap.rect.minZ);
  return { u, v: minimap.zAxis === "down" ? t : 1 - t };
}

export const MINIMAP_ASPECT_TOLERANCE = 0.005;

/** Extent sanity: catches a scene authored in centimetres or millimetres. */
const MIN_PLAUSIBLE_EXTENT = 2;
const MAX_PLAUSIBLE_EXTENT = 2000;

export function validateMinimap(m: Minimap): ParseIssue[] {
  const issues: ParseIssue[] = [];
  const w = m.rect.maxX - m.rect.minX;
  const h = m.rect.maxZ - m.rect.minZ;

  if (!(w > 0) || !(h > 0)) {
    issues.push({
      level: "error",
      code: "minimap.degenerate-rect",
      message: "Minimap rectangle must have positive width and depth.",
    });
    return issues;
  }

  if (m.pixelWidth && m.pixelHeight) {
    const worldAspect = w / h;
    const pixelAspect = m.pixelWidth / m.pixelHeight;
    const drift = Math.abs(worldAspect - pixelAspect) / pixelAspect;
    if (drift > MINIMAP_ASPECT_TOLERANCE) {
      issues.push({
        level: "error",
        code: "minimap.aspect-mismatch",
        message: `Image is ${m.pixelWidth}×${m.pixelHeight} (aspect ${pixelAspect.toFixed(4)}) but the world rectangle is ${w.toFixed(2)}×${h.toFixed(2)} (aspect ${worldAspect.toFixed(4)}). Markers would be stretched.`,
      });
    }
  }

  for (const [label, extent] of [["width", w], ["depth", h]] as const) {
    if (extent < MIN_PLAUSIBLE_EXTENT || extent > MAX_PLAUSIBLE_EXTENT) {
      issues.push({
        level: "warning",
        code: "minimap.implausible-scale",
        message: `Minimap ${label} of ${extent.toFixed(2)} m is outside the plausible ${MIN_PLAUSIBLE_EXTENT}–${MAX_PLAUSIBLE_EXTENT} m range. Check the scene's units.`,
      });
    }
  }

  return issues;
}
