// Published exhibition maps, read from committed JSON under content/exhibitions/.
//
// This is the visitor side of the publishing model: the dev portal's Blob store
// is the workbench, and a map reaches visitors only by being committed here. So
// this module reads files that shipped with the build — the way updates.ts does
// — and never writes. It does not call the dev API, which is password-gated, and
// does not need a Blob token.

import fs from "fs";
import path from "path";
import { hasBlockingError, validateMap, type ExhibitionMap } from "../exhibition-map/schema";

const EXHIBITIONS_DIR = path.join(process.cwd(), "content", "exhibitions");

/** Same shape as the naming contract's ids, which also rules out path traversal. */
const EXHIBITION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * The published map for an exhibition, or null when there is no such file.
 *
 * A file that exists but fails validation throws rather than returning null: a
 * committed map that is broken is a publishing mistake, and it should fail loudly
 * rather than masquerade as a missing exhibition.
 */
export function getExhibition(id: string): ExhibitionMap | null {
  if (!EXHIBITION_ID.test(id)) return null;

  let raw: string;
  try {
    raw = fs.readFileSync(path.join(EXHIBITIONS_DIR, `${id}.json`), "utf-8");
  } catch {
    return null;
  }

  const doc: unknown = JSON.parse(raw);
  const issues = validateMap(doc);
  if (hasBlockingError(issues)) {
    throw new Error(
      `content/exhibitions/${id}.json is not a valid exhibition map: ${issues
        .filter((i) => i.level === "error")
        .map((i) => i.code)
        .join(", ")}`
    );
  }
  return doc as ExhibitionMap;
}
