'use client'

import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { worldToImage, type Artwork, type Minimap as MinimapData, type Spawn } from '../lib/exhibition-map/schema'
import { minimapFrame, minimapImageSize, type Pose } from '../lib/exhibition/minimap'

// A heading-up minimap: the player marker stays pinned at the centre, pointing
// up, while the map slides and turns underneath. The live pose never leaves the
// browser — it is read each frame and written straight to a transform.

const VIEWPORT_PX = 200
/** Metres shown from the centre to the edge, whatever the exhibition's size. */
const RADIUS_M = 15

/** Filled in by the minimap; called every frame from inside the 3D canvas. */
export type PoseSink = RefObject<((pose: Pose) => void) | null>

export default function Minimap({
  minimap,
  imageUrl,
  artworks,
  spawns,
  poseSinkRef,
}: {
  minimap: MinimapData
  imageUrl: string
  artworks: Artwork[]
  spawns: Spawn[]
  poseSinkRef: PoseSink
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const size = useMemo(() => minimapImageSize(minimap, VIEWPORT_PX, RADIUS_M), [minimap])

  // Markers move with the map, so they are placed once, in image space.
  const markers = useMemo(() => {
    if (!size) return []
    const place = (x: number, z: number) => {
      const { u, v } = worldToImage(minimap, x, z)
      return { left: u * size.width, top: v * size.height }
    }
    return [
      ...artworks.map((a) => ({ key: `a-${a.id}`, kind: 'artwork' as const, ...place(a.position.x, a.position.z) })),
      ...spawns.map((s) => ({ key: `s-${s.id}`, kind: 'spawn' as const, ...place(s.position.x, s.position.z) })),
    ]
  }, [minimap, size, artworks, spawns])

  useEffect(() => {
    if (!size) return
    // Written to the DOM rather than React state: this runs 60 times a second.
    poseSinkRef.current = (pose) => {
      const layer = layerRef.current
      if (!layer) return
      const f = minimapFrame(minimap, pose, size.width, size.height)
      layer.style.transform =
        `translate(${VIEWPORT_PX / 2}px, ${VIEWPORT_PX / 2}px) rotate(${f.rotation}rad) translate(${-f.px}px, ${-f.py}px)`
    }
    return () => {
      poseSinkRef.current = null
    }
  }, [minimap, size, poseSinkRef])

  if (!size) return null

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        right: 24,
        bottom: 24,
        width: VIEWPORT_PX,
        height: VIEWPORT_PX,
        borderRadius: '50%',
        overflow: 'hidden',
        background: '#1a1a1a',
        border: '2px solid rgba(255,255,255,0.85)',
        boxShadow: '0 4px 18px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
      }}
    >
      <div
        ref={layerRef}
        data-minimap-layer
        style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', willChange: 'transform' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          // Explicit size, and maxWidth off: the global reset caps images at their
          // container's width, which would shrink the map to the 200px viewport.
          style={{ display: 'block', width: size.width, height: size.height, maxWidth: 'none' }}
        />
        {markers.map((m) => (
          <div
            key={m.key}
            style={{
              position: 'absolute',
              left: m.left,
              top: m.top,
              width: m.kind === 'spawn' ? 12 : 8,
              height: m.kind === 'spawn' ? 12 : 8,
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: m.kind === 'spawn' ? 'transparent' : '#F69C9F',
              border: m.kind === 'spawn' ? '2px solid #A2DEF8' : '1.5px solid #fff',
            }}
          />
        ))}
      </div>

      {/* The player: pinned at the centre, always pointing up. */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        style={{ position: 'absolute', left: VIEWPORT_PX / 2 - 9, top: VIEWPORT_PX / 2 - 9 }}
      >
        <path d="M9 1 L16 16 L9 12 L2 16 Z" fill="#FBF5AF" stroke="#3F3A36" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  )
}
