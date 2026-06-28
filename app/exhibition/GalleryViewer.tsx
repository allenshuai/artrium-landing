'use client'

import { useRef, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useGLTF, PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'

const ARCH_PATH = "M95.7731 0C42.8754 0 0 42.8827 0 95.7731V191.546H191.546V95.7731C191.546 42.8827 148.671 0 95.7731 0Z"
const ARCH_COLORS = ["#A2DEF8", "#F69C9F", "#FBF5AF"] as const

function ArchCrosshair() {
  const [colorIndex, setColorIndex] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setColorIndex(i => (i + 1) % ARCH_COLORS.length), 2200)
    return () => clearInterval(id)
  }, [])
  return (
    <div
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 22,
        height: 22,
        opacity: 0.85,
        pointerEvents: 'none',
      }}
    >
      <svg viewBox="0 0 192 192" width="100%" height="100%" fill="none">
        <path d={ARCH_PATH} fill={ARCH_COLORS[colorIndex]} style={{ transition: 'fill 0.4s ease' }} />
      </svg>
    </div>
  )
}

function Gallery() {
  const { scene } = useGLTF('/gallerybegining.glb')
  useEffect(() => {
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [scene])
  return <primitive object={scene} />
}

const SPEED = 5
const keys = new Set<string>()

function Player() {
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
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp'))
    const back = Number(keys.has('KeyS') || keys.has('ArrowDown'))
    const left = Number(keys.has('KeyA') || keys.has('ArrowLeft'))
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight'))

    direction.current.set(right - left, 0, back - forward).normalize()

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

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#111', position: 'relative' }}>
      <Canvas shadows camera={{ fov: 75, near: 0.1, far: 500 }}>
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
        <Gallery />
        <Player />
        <PointerLockControls
          onLock={() => setLocked(true)}
          onUnlock={() => setLocked(false)}
        />
      </Canvas>

      {locked && <ArchCrosshair />}

      {!locked && (
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
    </div>
  )
}
