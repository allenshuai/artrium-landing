import { NextResponse } from "next/server";
import { validCoords, type Coords } from "@/app/lib/map/coords";

// Cache the assembled response for five minutes so anonymous traffic cannot
// drive the six backend scans and the geocoding on every request (F1-9). The
// backend fetches below use the same value: a fetch with a shorter revalidate
// lowers the whole route's, which is what `revalidate: 60` used to do.
export const revalidate = 300;

const BASE = (process.env.ARTRIUM_API_BASE_URL ?? "").replace(/\/+$/, "");
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? "";

// Distinct locations geocoded per regeneration. Items past the cap stay off the
// map; the lasting fix is geocoding at write time in the backend (F2-11).
const GEOCODE_LIMIT = 200;
const GEOCODE_CONCURRENCY = 5;
// Mapbox rejects longer queries, so they would only spend the budget.
const GEOCODE_MAX_LENGTH = 256;

const NON_GEOCODABLE = new Set([
  "not available", "n/a", "na", "remote", "online",
  "virtual", "worldwide", "tbd", "various",
]);

type Raw = Record<string, unknown>;
type FieldKind = "text" | "list";
type Projected = Record<string, string | string[]>;

type Source = {
  key: string;
  path: string;
  /** Items without usable coordinates are geocoded from `location`. */
  geocode: boolean;
  /** The fields MapClient reads for this category; nothing else is sent. */
  fields: Record<string, FieldKind>;
};

const SOURCES: Source[] = [
  {
    key: "events", path: "/events", geocode: true,
    fields: { id: "text", title: "text", organizationName: "text", location: "text", startDateTime: "text", eventType: "text" },
  },
  {
    key: "jobs", path: "/jobs", geocode: true,
    fields: { id: "text", title: "text", company: "text", location: "text", type: "text", postedDate: "text" },
  },
  {
    key: "opportunities", path: "/opportunities", geocode: true,
    fields: { id: "text", title: "text", organizationName: "text", location: "text", opportunityType: "text", applicationDeadline: "text" },
  },
  {
    key: "marketplace", path: "/marketplace", geocode: false,
    fields: { listingId: "text", title: "text", location: "text", categories: "list", createdAt: "text" },
  },
  {
    key: "collaborations", path: "/collaborations", geocode: false,
    fields: { postId: "text", description: "text", username: "text", location: "text", category: "text", lookingFor: "list" },
  },
  {
    key: "spaces", path: "/spaces", geocode: false,
    fields: { spaceId: "text", title: "text", location: "text", categories: "list", availability: "text" },
  },
];

/** Strings pass, finite numbers become strings, anything else is dropped. */
function readField(value: unknown, kind: FieldKind): string | string[] | undefined {
  if (kind === "list") {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : undefined;
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function project(item: Raw, fields: Source["fields"]): Projected {
  const out: Projected = {};
  for (const [name, kind] of Object.entries(fields)) {
    const value = readField(item[name], kind);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/** The trimmed location to geocode, or null when it is not worth a call. */
function geocodeQuery(location: unknown): string | null {
  if (typeof location !== "string") return null;
  const q = location.trim();
  if (!q || q.length > GEOCODE_MAX_LENGTH || NON_GEOCODABLE.has(q.toLowerCase())) return null;
  return q;
}

async function geocode(query: string): Promise<Coords | null> {
  if (!MAPBOX_TOKEN) return null;
  try {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: Array<{ center?: unknown }> };
    const center = data.features?.[0]?.center;
    return Array.isArray(center) ? validCoords(center[1], center[0]) : null;
  } catch {
    return null;
  }
}

/** Geocodes each query once, a few at a time. Misses are absent from the map. */
async function geocodeAll(queries: string[]): Promise<Map<string, Coords>> {
  const found = new Map<string, Coords>();
  for (let i = 0; i < queries.length; i += GEOCODE_CONCURRENCY) {
    const batch = queries.slice(i, i + GEOCODE_CONCURRENCY);
    const results = await Promise.all(batch.map(geocode));
    batch.forEach((query, j) => {
      const coords = results[j];
      if (coords) found.set(query, coords);
    });
  }
  return found;
}

async function get(path: string): Promise<Raw[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    if (!Array.isArray(data)) return [];
    return data.filter((x): x is Raw => typeof x === "object" && x !== null && !Array.isArray(x));
  } catch {
    return [];
  }
}

export async function GET() {
  const lists = await Promise.all(SOURCES.map((source) => get(source.path)));

  // Distinct locations of geocodable items that arrived without usable coordinates.
  const pending = new Set<string>();
  SOURCES.forEach((source, i) => {
    if (!source.geocode) return;
    for (const item of lists[i]) {
      if (validCoords(item.latitude, item.longitude)) continue;
      const query = geocodeQuery(item.location);
      if (query) pending.add(query);
    }
  });
  const queries = [...pending];
  if (queries.length > GEOCODE_LIMIT) {
    console.warn(`map-pins: geocoding ${GEOCODE_LIMIT} of ${queries.length} locations; the rest are skipped`);
  }
  const geocoded = await geocodeAll(queries.slice(0, GEOCODE_LIMIT));

  const body: Record<string, object[]> = {};
  SOURCES.forEach((source, i) => {
    body[source.key] = lists[i].flatMap((item) => {
      let coords = validCoords(item.latitude, item.longitude);
      if (!coords && source.geocode) {
        const query = geocodeQuery(item.location);
        coords = (query && geocoded.get(query)) || null;
      }
      return coords ? [{ ...project(item, source.fields), ...coords }] : [];
    });
  });

  return NextResponse.json(body);
}
