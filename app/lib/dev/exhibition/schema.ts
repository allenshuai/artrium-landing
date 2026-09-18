// The one exhibition map schema. The parser, the parse route, the parser UI
// and (M3) storage all use these types and validators — no parallel shapes.
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

const MAP_KEYS = ["id", "parserVersion", "createdAt", "source", "assetUrl", "bounds", "rooms", "artworks", "spawns", "walls"];
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
