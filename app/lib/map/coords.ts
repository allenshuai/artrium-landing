// Listing coordinates are user-supplied and the backend stores them unchecked
// (FRONTEND_REVIEW C2). mapbox-gl throws on NaN and on a latitude outside ±90,
// so both /api/map-pins and MapClient pass every pin through this check.

export type Coords = { latitude: number; longitude: number };

/** A finite number from a number or a non-empty numeric string, else null. */
function toCoordinate(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  // null, booleans, arrays and objects would coerce to 0 or 1 under Number().
  return null;
}

/** The pair as numbers when both are finite and within ±90 / ±180, else null. */
export function validCoords(latitude: unknown, longitude: unknown): Coords | null {
  const lat = toCoordinate(latitude);
  const lng = toCoordinate(longitude);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { latitude: lat, longitude: lng };
}
