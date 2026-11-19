import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const POSES = {
  title:      { pos: [7, 6, 9],     look: [0, 1, 0] },
  build:      { pos: [7, 6, 9],     look: [0, 1, 0] },
  scale:      { pos: [9, 7.5, 11],  look: [0, 1.5, 0] },
  rotate90:   { pos: [9, 7.5, 11],  look: [0, 1.5, 0] },
  flip:       { pos: [9, 7.5, 11],  look: [0, 1.5, 0] },
  removeBack: { pos: [9, 7.5, 11],  look: [0, 1.5, 0] },
  removeLeg:  { pos: [9, 5, 11],    look: [-1, 0, 0] },
  underneath: { pos: [0.01, -6, 0], look: [0, 2, 0] },
  punchline:  { pos: [9, 7.5, 11],  look: [0, 1.5, 0] },
  voxi:       { pos: [9, 6, 11],    look: [-2, 1, 0] },
}

export default function CameraRig({ phase }) {
  const { camera } = useThree()
  const targetPos = useRef(new THREE.Vector3(...POSES.title.pos))
  const targetLook = useRef(new THREE.Vector3(...POSES.title.look))

  useEffect(() => {
    const p = POSES[phase] ?? POSES.title
    targetPos.current.set(...p.pos)
    targetLook.current.set(...p.look)
  }, [phase])

  useFrame(() => {
    camera.position.lerp(targetPos.current, 0.045)
    camera.lookAt(targetLook.current)
  })

  return null
}
