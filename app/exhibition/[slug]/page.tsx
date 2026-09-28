import { notFound } from "next/navigation";
import type { Metadata } from "next";
import GalleryViewer from "../GalleryViewer";
import { GALLERY_EXHIBITION_ID, GALLERY_ROUTE_SLUG, modelUrlFor } from "../../lib/gallery-config";
import { getExhibition } from "../../lib/exhibition/map";
import { REQUIRED_SPAWN_ID } from "../../lib/exhibition-map/schema";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Access and identity are separate questions. The unlisted slug keeps the
  // route private; the committed map decides which exhibition it shows.
  if (slug !== GALLERY_ROUTE_SLUG) {
    notFound();
  }

  // The id is a constant we control, so a missing or unloadable map here is a
  // publishing mistake — fail loudly rather than 404 as if the page never existed.
  const map = getExhibition(GALLERY_EXHIBITION_ID);
  if (!map) {
    throw new Error(`No published map at content/exhibitions/${GALLERY_EXHIBITION_ID}.json`);
  }

  const modelUrl = modelUrlFor(map.assetUrl);
  if (!modelUrl) {
    throw new Error(`Exhibition "${GALLERY_EXHIBITION_ID}" has no assetUrl to load.`);
  }

  // validateMap refuses a map without this spawn, so reaching here without it is a bug.
  const spawn = map.spawns.find((s) => s.id === REQUIRED_SPAWN_ID);
  if (!spawn) {
    throw new Error(`Exhibition "${GALLERY_EXHIBITION_ID}" has no Spawn_${REQUIRED_SPAWN_ID}.`);
  }

  return <GalleryViewer modelUrl={modelUrl} spawn={spawn} />;
}
