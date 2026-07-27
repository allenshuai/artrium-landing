import { notFound } from "next/navigation";
import type { Metadata } from "next";
import GalleryViewer from "../GalleryViewer";
import { GALLERY_ROUTE_SLUG } from "../../lib/gallery-config";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function GalleryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (slug !== GALLERY_ROUTE_SLUG) {
    notFound();
  }

  return <GalleryViewer />;
}
