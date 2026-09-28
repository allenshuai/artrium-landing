// Configuration for the private 3D gallery. Which GLB to load is no longer set
// here: it belongs to the published map, as that exhibition's `assetUrl`.

/** Rotate the unlisted route by changing NEXT_PUBLIC_GALLERY_ROUTE_SLUG (no code changes needed). */
export const GALLERY_ROUTE_SLUG =
  process.env.NEXT_PUBLIC_GALLERY_ROUTE_SLUG ?? "test0123456789";

/** The published map the gallery route serves, from content/exhibitions/<id>.json. */
export const GALLERY_EXHIBITION_ID = "standardized-vgallery";

export const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

/**
 * The GLB to load for an exhibition.
 *
 * Production always uses the map's own `assetUrl`: the published artifact is what
 * ships, and a stale environment variable must not be able to swap the model
 * underneath it. In development, NEXT_PUBLIC_GALLERY_MODEL_URL can stand in — an
 * exhibition GLB is hundreds of megabytes and is served from the gitignored
 * public/local/ rather than from the CDN.
 */
export function modelUrlFor(assetUrl: string | null): string | null {
  const devOverride =
    process.env.NODE_ENV === "production" ? undefined : process.env.NEXT_PUBLIC_GALLERY_MODEL_URL;
  return devOverride || assetUrl;
}
