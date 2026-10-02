// Dev-portal persistence types. The saved-import envelope, its hub summary, and
// the ids it is filed under. The map document inside it is the shared schema.

import type { ExhibitionMap, ParseIssue } from "../../exhibition-map/schema";

/**
 * A saved parse. Keeps the issues found at import time alongside the map, so the
 * detail page can show why an import was accepted with warnings without
 * re-parsing a 300 MB asset.
 */
export type StoredImport = {
  id: string;
  savedAt: string;
  map: ExhibitionMap;
  errors: ParseIssue[];
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

export function summarize(stored: StoredImport): ImportSummary {
  return {
    id: stored.id,
    savedAt: stored.savedAt,
    filename: stored.map.source.filename,
    rooms: stored.map.rooms.length,
    artworks: stored.map.artworks.length,
    spawns: stored.map.spawns.length,
    errorCount: stored.errors.filter((e) => e.level === "error").length,
    warningCount: stored.errors.filter((e) => e.level === "warning").length,
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
