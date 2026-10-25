// Configuration for the private 3D gallery. Which GLB to load is no longer set
// here: it belongs to the published map, as that exhibition's `assetUrl`.
//
// For server components only. The route slug must never reach a browser bundle,
// so no client component imports this module; GalleryViewer keeps its own Draco
// decoder path for that reason.

/**
 * The unlisted gallery route's slug, or null when none is configured, in which
 * case the route 404s. There is deliberately no default in source. Rotate it by
 * changing GALLERY_ROUTE_SLUG (no code change needed). The public name is read
 * only as a deprecated fallback until GALLERY_ROUTE_SLUG is set on Vercel.
 */
export function galleryRouteSlug(): string | null {
  const slug = (process.env.GALLERY_ROUTE_SLUG ?? process.env.NEXT_PUBLIC_GALLERY_ROUTE_SLUG)?.trim();
  return slug || null;
}

/** The published map the gallery route serves, from content/exhibitions/<id>.json. */
export const GALLERY_EXHIBITION_ID = "standardized-vgallery";

/**
 * Production always serves the published URL: the committed map is what ships,
 * and a stale environment variable must not be able to swap an asset underneath
 * it. In development a local file can stand in — exhibition assets are hundreds
 * of megabytes and are served from the gitignored public/local/, not the CDN.
 */
function devOverride(published: string | null, override: string | undefined): string | null {
  return (process.env.NODE_ENV === "production" ? undefined : override) || published;
}

/** The GLB to load for an exhibition. Dev override: NEXT_PUBLIC_GALLERY_MODEL_URL. */
export function modelUrlFor(assetUrl: string | null): string | null {
  return devOverride(assetUrl, process.env.NEXT_PUBLIC_GALLERY_MODEL_URL);
}

/** The minimap image to show. Dev override: NEXT_PUBLIC_GALLERY_MINIMAP_URL. */
export function minimapUrlFor(imageUrl: string | null): string | null {
  return devOverride(imageUrl, process.env.NEXT_PUBLIC_GALLERY_MINIMAP_URL);
}
