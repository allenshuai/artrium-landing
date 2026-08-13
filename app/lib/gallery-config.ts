// Single source of truth for the private 3D gallery — rotate the route by
// changing NEXT_PUBLIC_GALLERY_ROUTE_SLUG (no code changes needed).
export const GALLERY_MODEL_URL =
  process.env.NEXT_PUBLIC_GALLERY_MODEL_URL ??
  "https://assets.artrium.space/VGallery8_10.glb";

export const GALLERY_ROUTE_SLUG =
  process.env.NEXT_PUBLIC_GALLERY_ROUTE_SLUG ?? "test0123456789";

export const DRACO_DECODER_PATH =
  "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
