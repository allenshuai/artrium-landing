import { NextResponse } from "next/server";

const BASE = (process.env.ARTRIUM_API_BASE_URL ?? "").replace(/\/+$/, "");
const MAPBOX_TOKEN = process.env.MAPBOX_TOKEN ?? "";

const NON_GEOCODABLE = new Set([
  "not available", "n/a", "na", "remote", "online",
  "virtual", "worldwide", "tbd", "various",
]);

type Coords = { latitude: number; longitude: number };

async function geocode(location: string): Promise<Coords | null> {
  const trimmed = location.trim().toLowerCase();
  if (!trimmed || NON_GEOCODABLE.has(trimmed)) return null;
  try {
    const q   = encodeURIComponent(location.trim());
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${q}.json?access_token=${MAPBOX_TOKEN}&limit=1`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json() as { features?: Array<{ center: [number, number] }> };
    const center = data.features?.[0]?.center;
    if (!center) return null;
    return { longitude: center[0], latitude: center[1] };
  } catch {
    return null;
  }
}

// Geocode in parallel batches of 5
async function geocodeBatch(items: Array<{ location?: string; latitude?: number | null; longitude?: number | null }>): Promise<(Coords | null)[]> {
  const SIZE   = 5;
  const output: (Coords | null)[] = [];
  for (let i = 0; i < items.length; i += SIZE) {
    const batch = items.slice(i, i + SIZE);
    const coords = await Promise.all(
      batch.map((item) => {
        if (item.latitude != null && item.longitude != null)
          return Promise.resolve({ latitude: Number(item.latitude), longitude: Number(item.longitude) });
        return item.location ? geocode(item.location) : Promise.resolve(null);
      }),
    );
    output.push(...coords);
  }
  return output;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function get<T>(path: string): Promise<T[]> {
  if (!BASE) return [];
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? (data as T[]) : [];
  } catch {
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getWithGeocode(path: string): Promise<any[]> {
  const items = await get<Record<string, unknown>>(path);
  const coords = await geocodeBatch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items as any[],
  );
  return items.map((item, i) => ({
    ...item,
    ...(coords[i] ?? {}),
  }));
}

export async function GET() {
  const [events, jobs, opportunities, marketplace, collaborations, spaces] =
    await Promise.all([
      getWithGeocode("/events"),
      getWithGeocode("/jobs"),
      getWithGeocode("/opportunities"),
      get("/marketplace"),
      get("/collaborations"),
      get("/spaces"),
    ]);

  return NextResponse.json({
    events,
    jobs,
    opportunities,
    marketplace,
    collaborations,
    spaces,
  });
}
