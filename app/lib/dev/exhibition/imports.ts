// Dev-portal persistence types. The saved-import envelope, its hub summary, and
// the ids it is filed under. The map document inside it is the shared schema.

import { isParseIssue, isRecord, MAX_ISSUES, type ExhibitionMap, type ParseIssue } from "../../exhibition-map/schema";

/**
 * A saved parse. Keeps the issues found at import time alongside the map, so the
 * detail page can show why an import was accepted with warnings without
 * re-parsing a 300 MB asset.
 */
export type StoredImport = {
  id: string;
  savedAt: string;
  map: ExhibitionMap;
  /**
   * The parse issues, as stored. Saves are checked against ParseIssue now, but a
   * document written before that check can hold anything, so readers treat the
   * entries as unknown and skip what is malformed.
   */
  errors: unknown[];
};

/** What the hub list needs. Derived, never stored separately. */
export type ImportSummary = {
  id: string;
  savedAt: string;
  filename: string | null;
  rooms: number;
  artworks: number;
  spawns: number;
  errorCount: number;
  warningCount: number;
};

/**
 * A stored document read back, or null when it is not one. Checks what the hub
 * and the detail page dereference, nothing more: the map was validated when it
 * was saved and is not re-validated here, so an import saved under older rules
 * still lists. A missing issue list reads as empty.
 */
export function asStoredImport(value: unknown): StoredImport | null {
  if (!isRecord(value)) return null;
  const { id, savedAt, map } = value;
  if (typeof id !== "string" || typeof savedAt !== "string" || !isRecord(map) || !isRecord(map.source)) {
    return null;
  }
  if (![map.rooms, map.artworks, map.spawns, map.walls].every(Array.isArray)) return null;
  return { ...(value as StoredImport), errors: Array.isArray(value.errors) ? value.errors : [] };
}

/** What saveImport stores of a posted issue list, and how many issues it left out. */
export type IssuesToStore = { issues: ParseIssue[]; dropped: number };

const TRUNCATION_ORDER: readonly ParseIssue["level"][] = ["error", "warning", "info"];

/**
 * A posted issue list as it is stored, or null when it is not an array of
 * well-formed issues. Only the ParseIssue fields are kept, so an entry cannot
 * carry anything else into storage.
 *
 * A list longer than MAX_ISSUES is truncated rather than refused: the parser
 * page posts every issue it found, and a clean map with hundreds of warnings
 * must still save. Errors are kept ahead of warnings, since they are what
 * explains a partial import, and otherwise the posted order stands. The last
 * slot is an "info" issue saying how many were left out, so the stored list
 * never holds more than MAX_ISSUES.
 */
export function issuesToStore(value: unknown): IssuesToStore | null {
  if (!Array.isArray(value) || !value.every(isParseIssue)) return null;
  const all: ParseIssue[] = value.map(({ level, code, message, object }) =>
    object === undefined ? { level, code, message } : { level, code, message, object }
  );
  if (all.length <= MAX_ISSUES) return { issues: all, dropped: 0 };

  const room = MAX_ISSUES - 1;
  const keep = new Set<number>();
  for (const level of TRUNCATION_ORDER) {
    all.forEach((issue, i) => {
      if (keep.size < room && issue.level === level) keep.add(i);
    });
  }
  const kept = all.filter((_, i) => keep.has(i));
  const left = all.filter((_, i) => !keep.has(i));
  const count = (level: ParseIssue["level"], word: string) => {
    const n = left.filter((i) => i.level === level).length;
    return `${n} ${word}${n === 1 ? "" : "s"}`;
  };
  kept.push({
    level: "info",
    code: "issues.truncated",
    message: `${left.length} more issues not stored (${count("error", "error")}, ${count("warning", "warning")}): an import keeps at most ${MAX_ISSUES}. Parse the file again to see them all.`,
  });
  return { issues: kept, dropped: left.length };
}

export function summarize(stored: StoredImport): ImportSummary {
  // One malformed stored issue (`[null]`, say) used to throw here, and the hub
  // lists every import, so it took the whole list down with it.
  const issues = Array.isArray(stored.errors) ? stored.errors : [];
  const count = (level: ParseIssue["level"]) =>
    issues.filter((e) => isParseIssue(e) && e.level === level).length;
  return {
    id: stored.id,
    savedAt: stored.savedAt,
    filename: typeof stored.map.source.filename === "string" ? stored.map.source.filename : null,
    rooms: stored.map.rooms.length,
    artworks: stored.map.artworks.length,
    spawns: stored.map.spawns.length,
    errorCount: count("error"),
    warningCount: count("warning"),
  };
}

/** Segments under /dev/exhibition that an import id must never shadow. */
export const RESERVED_IDS = ["login", "parser"];

const ID_PATTERN = /^[0-9a-z]{8,32}$/;

export function isValidImportId(id: string): boolean {
  return ID_PATTERN.test(id) && !RESERVED_IDS.includes(id);
}

/** Opaque, sortable-free id. Collision risk is irrelevant at this scale. */
export function newImportId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
