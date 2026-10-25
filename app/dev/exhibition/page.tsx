import DevExhibitionHub from "./Hub";
import { galleryRouteSlug } from "@/app/lib/gallery-config";

// A server component so the gallery's unlisted slug stays on the server: only
// the href built from it reaches the browser, as a prop of this gated page,
// never as a constant in a client chunk under /_next/static. Dynamic so the
// slug is read per request rather than baked into a prerendered page.
export const dynamic = "force-dynamic";

export default function DevExhibitionPage() {
  const slug = galleryRouteSlug();
  return <DevExhibitionHub galleryHref={slug ? `/exhibition/${slug}` : null} />;
}
