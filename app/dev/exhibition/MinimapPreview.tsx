"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  validateMinimap,
  worldToImage,
  type ExhibitionMap,
  type Minimap,
} from "@/app/lib/exhibition-map/schema";

// Proof-of-concept calibration surface. The image is chosen locally and never
// uploaded — the whole point is to settle the world rectangle and the z
// direction before either is committed anywhere.
//
// Derived provisionally from pixel measurement of the current renders: the
// content box is inset 45px on all sides, and framing the room footprint instead
// of all geometry would place objects outside a 2560px image, which the clean
// margins rule out. Superseded the moment an orthographic minimap camera exists.
const PROVISIONAL_HALF_EXTENT = 56.356;

function defaultMinimap(map: ExhibitionMap): Minimap {
  if (map.minimap) return map.minimap;
  return {
    rect: {
      minX: -PROVISIONAL_HALF_EXTENT,
      maxX: PROVISIONAL_HALF_EXTENT,
      minZ: -PROVISIONAL_HALF_EXTENT,
      maxZ: PROVISIONAL_HALF_EXTENT,
    },
    zAxis: "down",
    source: "manual",
    pixelWidth: null,
    pixelHeight: null,
    variants: {},
    defaultVariant: null,
  };
}

function boundsRect(map: ExhibitionMap) {
  return {
    minX: map.bounds.min.x,
    maxX: map.bounds.max.x,
    minZ: map.bounds.min.z,
    maxZ: map.bounds.max.z,
  };
}

type Marker = { key: string; label: string; u: number; v: number; kind: "artwork" | "spawn" };
type RoomBox = { id: string; u0: number; v0: number; u1: number; v1: number };

const COLOURS = { artwork: "#C0392B", spawn: "#1F7A4D" } as const;

/** What a chosen image contributes to a published map: its file name and pixel size. */
export type ChosenImage = { fileName: string; width: number; height: number };

export default function MinimapPreview({
  map,
  onImage,
}: {
  map: ExhibitionMap;
  onImage?: (image: ChosenImage) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pixels, setPixels] = useState<{ w: number; h: number } | null>(null);
  const [minimap, setMinimap] = useState<Minimap>(() => defaultMinimap(map));
  const [showLabels, setShowLabels] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);

  // A newly parsed map replaces any calibration in progress.
  useEffect(() => {
    setMinimap(defaultMinimap(map));
  }, [map]);

  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  const withPixels: Minimap = useMemo(
    () => ({ ...minimap, pixelWidth: pixels?.w ?? null, pixelHeight: pixels?.h ?? null }),
    [minimap, pixels]
  );

  const issues = useMemo(() => validateMinimap(withPixels), [withPixels]);

  const markers = useMemo<Marker[]>(() => {
    const out: Marker[] = [];
    for (const a of map.artworks) {
      const { u, v } = worldToImage(withPixels, a.position.x, a.position.z);
      out.push({ key: `a-${a.id}`, label: a.id, u, v, kind: "artwork" });
    }
    for (const s of map.spawns) {
      const { u, v } = worldToImage(withPixels, s.position.x, s.position.z);
      out.push({ key: `s-${s.id}`, label: `spawn ${s.id}`, u, v, kind: "spawn" });
    }
    return out;
  }, [map, withPixels]);

  const roomBoxes = useMemo<RoomBox[]>(
    () =>
      map.rooms.map((r) => {
        const a = worldToImage(withPixels, r.bounds.min.x, r.bounds.min.z);
        const b = worldToImage(withPixels, r.bounds.max.x, r.bounds.max.z);
        return {
          id: r.id,
          u0: Math.min(a.u, b.u),
          v0: Math.min(a.v, b.v),
          u1: Math.max(a.u, b.u),
          v1: Math.max(a.v, b.v),
        };
      }),
    [map, withPixels]
  );

  const offMap = markers.filter((m) => m.u < 0 || m.u > 1 || m.v < 0 || m.v > 1).length;

  // A top-down map collapses height, so objects stacked vertically share a point.
  const coincident = useMemo(() => {
    const seen = new Map<string, string[]>();
    for (const m of markers) {
      const key = `${m.u.toFixed(4)},${m.v.toFixed(4)}`;
      seen.set(key, [...(seen.get(key) ?? []), m.label]);
    }
    return [...seen.values()].filter((g) => g.length > 1);
  }, [markers]);

  function pickImage(file: File) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    const url = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setPixels({ w: probe.naturalWidth, h: probe.naturalHeight });
      onImage?.({ fileName: file.name, width: probe.naturalWidth, height: probe.naturalHeight });
    };
    probe.src = url;
    setImageUrl(url);
  }

  function setHalfExtent(value: number) {
    if (!Number.isFinite(value) || value <= 0) return;
    const cx = (minimap.rect.minX + minimap.rect.maxX) / 2;
    const cz = (minimap.rect.minZ + minimap.rect.maxZ) / 2;
    setMinimap({
      ...minimap,
      rect: { minX: cx - value, maxX: cx + value, minZ: cz - value, maxZ: cz + value },
      source: "manual",
    });
  }

  const halfExtent = (minimap.rect.maxX - minimap.rect.minX) / 2;

  return (
    <section className="mt-10">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">
        Minimap calibration (proof of concept)
      </h2>
      <p className="mt-1 text-sm text-[#3F3A36]/60">
        Pick a minimap PNG from disk. It stays in your browser — nothing is uploaded. Adjust the
        rectangle until the markers sit on the artworks, then copy the block below.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          className="border border-[#3F3A36] bg-[#3F3A36] px-3 py-1.5 text-sm font-medium text-[#FFFAF6] transition hover:bg-[#3F3A36]/85"
        >
          Choose minimap image
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) pickImage(file);
          }}
        />
        {pixels && (
          <span className="text-sm text-[#3F3A36]/60">
            {pixels.w}×{pixels.h}
          </span>
        )}
        {map.minimap && (
          <span className="text-sm text-[#1F7A4D]">
            Minimap camera found — rectangle came from the GLB
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="block text-xs uppercase tracking-wider text-[#3F3A36]/50">
            Half-extent (m)
          </span>
          <input
            type="number"
            step="0.1"
            value={Number(halfExtent.toFixed(3))}
            onChange={(e) => setHalfExtent(Number(e.target.value))}
            className="mt-1 w-32 border border-[#3F3A36]/25 bg-white px-2 py-1 text-sm outline-none focus:border-[#3F3A36]"
          />
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={minimap.zAxis === "down"}
            onChange={(e) =>
              setMinimap({ ...minimap, zAxis: e.target.checked ? "down" : "up", source: "manual" })
            }
          />
          +Z points down the image
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} />
          Labels
        </label>

        <button
          onClick={() => setMinimap({ ...minimap, rect: boundsRect(map), source: "manual" })}
          className="border border-[#3F3A36]/30 px-2 py-1 text-sm underline-offset-4 hover:underline"
        >
          Fit to bounds
        </button>
        <button
          onClick={() => setHalfExtent(PROVISIONAL_HALF_EXTENT)}
          className="border border-[#3F3A36]/30 px-2 py-1 text-sm underline-offset-4 hover:underline"
        >
          Reset to {PROVISIONAL_HALF_EXTENT}
        </button>
      </div>

      <p className="mt-3 text-sm">
        {markers.length} markers ({map.artworks.length} artworks, {map.spawns.length} spawns) ·{" "}
        {offMap === 0 ? (
          <span className="text-[#1F7A4D]">all on the map</span>
        ) : (
          <span className="text-[#C0392B]">{offMap} off the map</span>
        )}
      </p>

      {coincident.map((group, n) => (
        <p key={n} className="mt-1 text-sm text-[#3F3A36]/60">
          Stacked at one point (a top-down map collapses height): {group.join(", ")}
        </p>
      ))}

      {issues.map((i, n) => (
        <p
          key={n}
          className="mt-2 border-l-2 pl-3 text-sm"
          style={{ borderColor: i.level === "error" ? "#C0392B" : "#D98C1F" }}
        >
          {i.message}
        </p>
      ))}

      {/* The plot renders with or without an image — the image is a backdrop, and
          the markers are the point. Without one you still see the spatial layout. */}
      <div
        className="relative mt-4 w-full overflow-hidden border border-[#3F3A36]/20"
        style={
          imageUrl
            ? undefined
            : {
                aspectRatio: "1 / 1",
                backgroundColor: "#2A2A2A",
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
                backgroundSize: "10% 10%",
              }
        }
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="Minimap" className="block w-full" />
        )}

        {roomBoxes.map((r) => (
          <div
            key={r.id}
            className="pointer-events-none absolute border border-dashed"
            style={{
              left: `${r.u0 * 100}%`,
              top: `${r.v0 * 100}%`,
              width: `${(r.u1 - r.u0) * 100}%`,
              height: `${(r.v1 - r.v0) * 100}%`,
              borderColor: "rgba(162,222,248,0.85)",
            }}
          />
        ))}

        {markers.map((m) => {
          const off = m.u < 0 || m.u > 1 || m.v < 0 || m.v > 1;
          return (
            <div
              key={m.key}
              className="pointer-events-none absolute"
              style={{
                left: `${Math.min(Math.max(m.u, 0), 1) * 100}%`,
                top: `${Math.min(Math.max(m.v, 0), 1) * 100}%`,
                transform: "translate(-50%, -50%)",
                opacity: off ? 0.35 : 1,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: COLOURS[m.kind],
                  border: "2px solid #fff",
                  boxShadow: "0 0 0 1.5px rgba(0,0,0,0.65)",
                }}
              />
              {showLabels && (
                <span
                  className="absolute left-4 top-[-1px] whitespace-nowrap text-[11px] font-semibold"
                  style={{ color: "#fff", textShadow: "0 0 3px #000, 0 0 3px #000, 0 0 3px #000" }}
                >
                  {m.label}
                  {off ? " (off map)" : ""}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {!imageUrl && (
        <p className="mt-2 text-sm text-[#3F3A36]/60">
          No image chosen — markers are plotted on a plain grid. Choose a minimap PNG above to
          check they line up with the artwork.
        </p>
      )}

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-[#3F3A36]/50">
        minimap block
      </h3>
      <pre className="mt-2 overflow-auto border border-[#3F3A36]/20 bg-white p-4 text-xs">
        {JSON.stringify(withPixels, null, 2)}
      </pre>
    </section>
  );
}
