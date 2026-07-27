'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { OutlinePass } from 'three/examples/jsm/postprocessing/OutlinePass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { GALLERY_MODEL_URL, DRACO_DECODER_PATH } from '../lib/gallery-config'
import { ARTWORKS, ARTWORK_NAMES, getArtworkConfig, type ArtworkConfig } from './artworks'

const ARCH_PATH = "M95.7731 0C42.8754 0 0 42.8827 0 95.7731V191.546H191.546V95.7731C191.546 42.8827 148.671 0 95.7731 0Z"
const ARCH_COLORS = ["#A2DEF8", "#F69C9F", "#FBF5AF"] as const
const OUTLINE_COLOR = '#FBF5AF'
const HOVER_DISTANCE = 10

function ArchCrosshair({ active }: { active: boolean }) {
  const [colorIndex, setColorIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setColorIndex(i => (i + 1) % ARCH_COLORS.length), 2200)
    return () => clearInterval(id)
  }, [])
  const size = active ? 32 : 22
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: size,
        height: size,
        opacity: active ? 1 : 0.85,
        pointerEvents: 'none',
        transition: 'width 0.15s ease, height 0.15s ease, opacity 0.15s ease',
        filter: active ? `drop-shadow(0 0 8px ${OUTLINE_COLOR})` : 'none',
      }}
    >
      <svg viewBox="0 0 192 192" width="100%" height="100%" fill="none">
        <path
          d={ARCH_PATH}
          fill={active ? OUTLINE_COLOR : ARCH_COLORS[colorIndex]}
          style={{ transition: 'fill 0.2s ease' }}
        />
      </svg>
    </div>
  )
}

function LoadingScreen({ progress }: { progress: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        background: '#111',
      }}
    >
      <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 18 }}>
        Loading gallery… {progress}%
      </p>
      <div
        style={{
          width: 260,
          height: 6,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.15)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: 'linear-gradient(90deg, #F69C9F, #A2DEF8, #FBF5AF)',
            backgroundSize: '260px 100%',
            transition: 'width 0.15s ease-out',
          }}
        />
      </div>
    </div>
  )
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        background: '#111',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <p style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 8 }}>
        Couldn&apos;t load the gallery
      </p>
      <p style={{ fontSize: '0.9rem', opacity: 0.65, marginBottom: 20, maxWidth: 380 }}>
        {message}
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '10px 24px',
          borderRadius: 6,
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'transparent',
          color: '#fff',
          fontSize: '0.9rem',
          cursor: 'pointer',
        }}
      >
        Retry
      </button>
    </div>
  )
}

function PlaceholderImageIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{value}</div>
    </div>
  )
}

function ArtworkDetailOverlay({ artwork, onClose }: { artwork: ArtworkConfig; onClose: () => void }) {
  return (
    <div
      // Swallow clicks so drei's PointerLockControls (which re-locks the
      // pointer on ANY document click) doesn't grab the mouse back while
      // this modal is open.
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 20,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5vh 4vw',
      }}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.3)',
          background: 'rgba(255,255,255,0.05)',
          color: '#fff',
          fontSize: 20,
          lineHeight: 1,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ×
      </button>

      <div
        style={{
          display: 'flex',
          gap: '4vw',
          maxWidth: 1100,
          width: '100%',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            height: '60vh',
            width: '45vh',
            maxWidth: '90vw',
            background: '#2a2a2a',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.5)',
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          {artwork.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={artwork.imageUrl}
              alt={artwork.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <>
              <PlaceholderImageIcon />
              <p style={{ marginTop: 12, fontSize: 13, padding: '0 16px', textAlign: 'center' }}>
                Artwork image: {artwork.meshName}
              </p>
            </>
          )}
        </div>

        <div style={{ color: '#fff', maxWidth: 360 }}>
          <InfoField label="Title" value={artwork.title} />
          <InfoField label="Artist" value={artwork.artist} />
          <InfoField label="Year" value={artwork.year} />
          <InfoField label="Medium" value={artwork.medium} />
          <InfoField label="Dimensions" value={artwork.dimensions} />
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.5, marginBottom: 6 }}>
              Description
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85, margin: 0 }}>
              {artwork.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Gallery({
  reloadKey,
  onProgress,
  onError,
  onLoaded,
  onSceneReady,
}: {
  reloadKey: number
  onProgress: (loaded: number, total: number) => void
  onError: (error: unknown) => void
  onLoaded: () => void
  onSceneReady: (scene: THREE.Group) => void
}) {
  const [scene, setScene] = useState<THREE.Group | null>(null)

  useEffect(() => {
    let cancelled = false
    setScene(null)

    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath(DRACO_DECODER_PATH)

    const loader = new GLTFLoader()
    loader.setDRACOLoader(dracoLoader)

    loader.load(
      GALLERY_MODEL_URL,
      (gltf) => {
        if (cancelled) return
        gltf.scene.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            obj.castShadow = true
            obj.receiveShadow = true
          }
        })
        setScene(gltf.scene)
        onLoaded()
        onSceneReady(gltf.scene)
      },
      (event) => {
        if (cancelled) return
        onProgress(event.loaded, event.total)
      },
      (error) => {
        if (cancelled) return
        console.error('Failed to load gallery model:', error)
        onError(error)
      }
    )

    return () => {
      cancelled = true
      dracoLoader.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey])

  if (!scene) return null
  return <primitive object={scene} />
}

// Highlights the hovered artwork with a postprocessed edge glow. Once
// mounted this owns the render loop (see the priority passed to useFrame
// below), replacing R3F's default render call with the composer's.
function ArtworkOutline({ target }: { target: THREE.Object3D | null }) {
  const { gl, scene, camera, size } = useThree()
  const composerRef = useRef<EffectComposer | null>(null)
  const outlinePassRef = useRef<OutlinePass | null>(null)

  useEffect(() => {
    const composer = new EffectComposer(gl)
    composer.addPass(new RenderPass(scene, camera))

    const outlinePass = new OutlinePass(new THREE.Vector2(size.width, size.height), scene, camera)
    outlinePass.edgeStrength = 6
    outlinePass.edgeGlow = 0.6
    outlinePass.edgeThickness = 1.5
    outlinePass.pulsePeriod = 0
    outlinePass.visibleEdgeColor.set(OUTLINE_COLOR)
    outlinePass.hiddenEdgeColor.set(OUTLINE_COLOR)
    composer.addPass(outlinePass)
    composer.addPass(new OutputPass())

    composerRef.current = composer
    outlinePassRef.current = outlinePass

    return () => {
      composer.dispose()
      composerRef.current = null
      outlinePassRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, camera])

  useEffect(() => {
    composerRef.current?.setSize(size.width, size.height)
    outlinePassRef.current?.setSize(size.width, size.height)
  }, [size])

  useEffect(() => {
    if (outlinePassRef.current) {
      outlinePassRef.current.selectedObjects = target ? [target] : []
    }
  }, [target])

  useFrame(() => {
    composerRef.current?.render()
  }, 1)

  return null
}

type ArtworkTarget = { name: string; object: THREE.Object3D }

// Raycasts from the crosshair (screen center) against only the artwork
// meshes each frame, tracks hover state, and handles click-to-select.
function ArtworkInteractions({
  scene,
  paused,
  locked,
  onHoverChange,
  onSelect,
}: {
  scene: THREE.Group
  paused: boolean
  locked: boolean
  onHoverChange: (name: string | null) => void
  onSelect: (name: string) => void
}) {
  const { camera } = useThree()
  const targetsRef = useRef<ArtworkTarget[]>([])
  const hoveredRef = useRef<string | null>(null)
  const pausedRef = useRef(paused)
  const lockedRef = useRef(locked)
  const raycaster = useRef(new THREE.Raycaster())
  const ndcCenter = useRef(new THREE.Vector2(0, 0))
  const [outlineTarget, setOutlineTarget] = useState<THREE.Object3D | null>(null)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  useEffect(() => {
    lockedRef.current = locked
  }, [locked])

  useEffect(() => {
    raycaster.current.far = HOVER_DISTANCE
  }, [])

  useEffect(() => {
    const allMeshNames: string[] = []
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) allMeshNames.push(obj.name)
    })
    console.log('[Gallery] mesh names found in scene:', allMeshNames)

    const resolved: ArtworkTarget[] = []
    for (const cfg of ARTWORKS) {
      const object = scene.getObjectByName(cfg.meshName)
      if (object) {
        resolved.push({ name: cfg.meshName, object })
      } else {
        console.warn(
          `[Gallery] artwork mesh "${cfg.meshName}" not found in scene — check the mesh name list above for an exporter mismatch.`
        )
      }
    }
    targetsRef.current = resolved
  }, [scene])

  useEffect(() => {
    const handleClick = () => {
      if (!lockedRef.current || pausedRef.current) return
      if (hoveredRef.current) onSelect(hoveredRef.current)
    }
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [onSelect])

  useFrame(() => {
    if (pausedRef.current || !lockedRef.current || targetsRef.current.length === 0) {
      if (hoveredRef.current !== null) {
        hoveredRef.current = null
        onHoverChange(null)
        setOutlineTarget(null)
      }
      return
    }

    raycaster.current.setFromCamera(ndcCenter.current, camera)
    const hits = raycaster.current.intersectObjects(
      targetsRef.current.map((t) => t.object),
      true
    )

    let hitName: string | null = null
    if (hits.length > 0) {
      // Walk up from the hit mesh through its parents until one matches a
      // tracked artwork name (handles both leaf meshes and grouped meshes).
      let node: THREE.Object3D | null = hits[0].object
      while (node) {
        if (ARTWORK_NAMES.has(node.name)) {
          hitName = node.name
          break
        }
        node = node.parent
      }
    }

    if (hitName !== hoveredRef.current) {
      hoveredRef.current = hitName
      onHoverChange(hitName)
      const matched = hitName ? targetsRef.current.find((t) => t.name === hitName) : null
      setOutlineTarget(matched ? matched.object : null)
    }
  })

  return <ArtworkOutline target={outlineTarget} />
}

const SPEED = 5
const keys = new Set<string>()

function Player({ paused }: { paused: boolean }) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const direction = useRef(new THREE.Vector3())

  useEffect(() => {
    camera.position.set(0, 1.4, 5)
    const onKeyDown = (e: KeyboardEvent) => keys.add(e.code)
    const onKeyUp = (e: KeyboardEvent) => keys.delete(e.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [camera])

  useFrame((_, delta) => {
    if (paused) return

    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp'))
    const back = Number(keys.has('KeyS') || keys.has('ArrowDown'))
    const left = Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight'))

    direction.current.set(left - right, 0, back - forward).normalize()

    if (direction.current.lengthSq() > 0) {
      // Move relative to where the camera is looking (horizontal only)
      const front = new THREE.Vector3()
      camera.getWorldDirection(front)
      front.y = 0
      front.normalize()

      const strafe = new THREE.Vector3().crossVectors(front, new THREE.Vector3(0, 1, 0)).negate()

      velocity.current
        .set(0, 0, 0)
        .addScaledVector(front, -direction.current.z)
        .addScaledVector(strafe, direction.current.x)
        .normalize()
        .multiplyScalar(SPEED * delta)

      camera.position.add(velocity.current)
    }
  })

  return null
}

export default function GalleryViewer() {
  const [locked, setLocked] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [gltfScene, setGltfScene] = useState<THREE.Group | null>(null)
  const [hoveredArtwork, setHoveredArtwork] = useState<string | null>(null)
  const [selectedArtwork, setSelectedArtwork] = useState<string | null>(null)

  const overlayOpen = selectedArtwork !== null

  const handleProgress = useCallback((loaded: number, total: number) => {
    if (total > 0) {
      setProgress(Math.min(100, Math.round((loaded / total) * 100)))
    }
  }, [])

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Network or CORS error while fetching the model.'
    setError(message)
  }, [])

  const handleLoaded = useCallback(() => {
    setProgress(100)
    setLoaded(true)
  }, [])

  const handleSceneReady = useCallback((scene: THREE.Group) => {
    setGltfScene(scene)
  }, [])

  const retry = useCallback(() => {
    setError(null)
    setLoaded(false)
    setProgress(0)
    setGltfScene(null)
    setHoveredArtwork(null)
    setSelectedArtwork(null)
    setReloadKey((k) => k + 1)
  }, [])

  const handleSelect = useCallback((name: string) => {
    setSelectedArtwork(name)
    if (document.pointerLockElement) document.exitPointerLock()
  }, [])

  const handleCloseOverlay = useCallback(() => {
    setSelectedArtwork(null)
    document.body.requestPointerLock()
  }, [])

  useEffect(() => {
    if (!overlayOpen) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleCloseOverlay()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [overlayOpen, handleCloseOverlay])

  const selectedArtworkConfig = selectedArtwork ? getArtworkConfig(selectedArtwork) : null

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111', position: 'relative' }}>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 500 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <Gallery
          key={reloadKey}
          reloadKey={reloadKey}
          onProgress={handleProgress}
          onError={handleError}
          onLoaded={handleLoaded}
          onSceneReady={handleSceneReady}
        />
        <Player paused={overlayOpen} />
        {gltfScene && (
          <ArtworkInteractions
            scene={gltfScene}
            paused={overlayOpen}
            locked={locked}
            onHoverChange={setHoveredArtwork}
            onSelect={handleSelect}
          />
        )}
        <PointerLockControls
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
        />
      </Canvas>

      {loaded && locked && !overlayOpen && <ArchCrosshair active={hoveredArtwork !== null} />}

      {!loaded && !error && <LoadingScreen progress={progress} />}

      {error && <ErrorScreen message={error} onRetry={retry} />}

      {loaded && !error && !locked && !overlayOpen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            background: 'rgba(0,0,0,0.55)',
            cursor: 'pointer',
            userSelect: 'none',
          }}
          onClick={() => document.body.requestPointerLock()}
        >
          <p style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: 8 }}>Click to enter gallery</p>
          <p style={{ fontSize: '0.9rem', opacity: 0.65 }}>WASD / Arrow keys to move &nbsp;·&nbsp; Mouse to look &nbsp;·&nbsp; Esc to exit</p>
        </div>
      )}

      {selectedArtworkConfig && (
        <ArtworkDetailOverlay artwork={selectedArtworkConfig} onClose={handleCloseOverlay} />
      )}
    </div>
  )
}
