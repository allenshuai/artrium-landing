// Content for interactive artworks in the gallery, keyed by GLB mesh name.
// imageUrl is null until real photography is ready — the overlay renders a
// placeholder box in that case with no other code changes required once set.
export type ArtworkConfig = {
  meshName: string
  title: string
  artist: string
  year: string
  medium: string
  dimensions: string
  description: string
  imageUrl: string | null
}

const PLACEHOLDER_DESCRIPTION =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation.'

// Mesh names must match the exporter's naming exactly (case-sensitive). If
// an artwork never highlights, compare against the "[Gallery] mesh names
// found in scene" console log for a naming mismatch.
export const ARTWORKS: ArtworkConfig[] = [
  {
    // The GLB exporter strips dots from Blender object names, so
    // "DesertHawk.001" in the source file became "DesertHawk001" here —
    // confirmed via the "[Gallery] mesh names found in scene" console log.
    meshName: 'DesertHawk001',
    title: '[Artwork Title]',
    artist: '[Artist Name]',
    year: '[YYYY]',
    medium: '[Medium]',
    dimensions: '[H x W cm]',
    description: PLACEHOLDER_DESCRIPTION,
    imageUrl: null,
  },
  {
    meshName: 'IMG_0738',
    title: '[Artwork Title]',
    artist: '[Artist Name]',
    year: '[YYYY]',
    medium: '[Medium]',
    dimensions: '[H x W cm]',
    description: PLACEHOLDER_DESCRIPTION,
    imageUrl: null,
  },
  {
    meshName: 'IMG_1986',
    title: '[Artwork Title]',
    artist: '[Artist Name]',
    year: '[YYYY]',
    medium: '[Medium]',
    dimensions: '[H x W cm]',
    description: PLACEHOLDER_DESCRIPTION,
    imageUrl: null,
  },
]

export const ARTWORK_NAMES = new Set(ARTWORKS.map((a) => a.meshName))

export function getArtworkConfig(meshName: string): ArtworkConfig | null {
  return ARTWORKS.find((a) => a.meshName === meshName) ?? null
}
