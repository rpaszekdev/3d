import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const LEG_HEIGHT = 4
const SEAT_Y = LEG_HEIGHT
const BACK_Y_START = SEAT_Y + 1
const BACK_HEIGHT = 3
const LERP = 0.06

const PARTS = {
  LEG_FL: 'leg-FL',
  LEG_FR: 'leg-FR',
  LEG_BL: 'leg-BL',
  LEG_BR: 'leg-BR',
  SEAT: 'seat',
  BACK: 'back',
}

function buildVoxels() {
  const v = []
  const legs = [
    { x: -1, z: -1, part: PARTS.LEG_FL },
    { x: 1,  z: -1, part: PARTS.LEG_FR },
    { x: -1, z: 1,  part: PARTS.LEG_BL },
    { x: 1,  z: 1,  part: PARTS.LEG_BR },
  ]
  for (const leg of legs) {
    for (let y = 0; y < LEG_HEIGHT; y++) {
      v.push({ pos: [leg.x, y, leg.z], part: leg.part })
    }
  }
  for (let x = -1; x <= 1; x++) {
    for (let z = -1; z <= 1; z++) {
      v.push({ pos: [x, SEAT_Y, z], part: PARTS.SEAT })
    }
  }
  for (let x = -1; x <= 1; x++) {
    for (let y = 0; y < BACK_HEIGHT; y++) {
      v.push({ pos: [x, BACK_Y_START + y, 1], part: PARTS.BACK })
    }
  }
  return v.map((vox, i) => ({ ...vox, idx: i }))
}

const GROUP_BY_PHASE = {
  title:      { scale: 0.001, rotation: [0, 0, 0],          position: [0, -2, 0] },
  build:      { scale: 1.0,   rotation: [0, 0, 0],          position: [0, -2, 0] },
  scale:      { scale: 1.55,  rotation: [0, 0, 0],          position: [0, -2, 0] },
  rotate90:   { scale: 1.55,  rotation: [0, 0, Math.PI / 2],position: [-2, 0.4, 0] },
  flip:       { scale: 1.55,  rotation: [Math.PI, 0, 0],    position: [0, 4.5, 0] },
  removeBack: { scale: 1.55,  rotation: [0, 0, 0],          position: [0, -2, 0] },
  removeLeg:  { scale: 1.55,  rotation: [0.55, 0, -0.18],   position: [-1.4, -3.4, -0.4] },
  underneath: { scale: 1.55,  rotation: [0, 0, 0],          position: [0, -2, 0] },
  punchline:  { scale: 1.4,   rotation: [0, Math.PI / 4, 0],position: [0, -2, 0] },
  voxi:       { scale: 1.0,   rotation: [0, Math.PI / 6, 0],position: [-2.2, -2, 0] },
}

const COLOR = {
  [PARTS.SEAT]:   '#b88454',
  [PARTS.BACK]:   '#a37445',
  [PARTS.LEG_FL]: '#7e5630',
  [PARTS.LEG_FR]: '#7e5630',
  [PARTS.LEG_BL]: '#7e5630',
  [PARTS.LEG_BR]: '#7e5630',
}

function isVisible(vox, phase) {
  if (phase === 'title') return false
  if (phase === 'removeBack' && vox.part === PARTS.BACK) return false
  if (phase === 'removeLeg' && vox.part === PARTS.LEG_FL) return false
  return true
}

function buildAppearTime(vox, phase, total) {
  if (phase === 'build') return (vox.idx / total) * 1.4 + 0.05
  return 0
}

function lerpAngle(current, target, t) {
  const TAU = Math.PI * 2
  let diff = ((target - current) % TAU + TAU) % TAU
  if (diff > Math.PI) diff -= TAU
  return current + diff * t
}

function Voxel({ vox, phase, total, phaseStartRef }) {
  const meshRef = useRef()
  const visible = isVisible(vox, phase)
  const appearAt = buildAppearTime(vox, phase, total)

  useFrame((_, dt) => {
    const m = meshRef.current
    if (!m) return
    const elapsed = (performance.now() / 1000) - phaseStartRef.current
    const targetScale = visible && elapsed >= appearAt ? 1 : 0
    const t = 1 - Math.pow(1 - LERP * 1.6, dt * 60)
    m.scale.x = THREE.MathUtils.lerp(m.scale.x, targetScale, t)
    m.scale.y = m.scale.x
    m.scale.z = m.scale.x
  })

  return (
    <mesh ref={meshRef} position={vox.pos} castShadow receiveShadow scale={0}>
      <boxGeometry args={[0.96, 0.96, 0.96]} />
      <meshStandardMaterial color={COLOR[vox.part]} roughness={0.78} metalness={0.05} />
    </mesh>
  )
}

export default function Chair({ phase }) {
  const voxels = useMemo(() => buildVoxels(), [])
  const groupRef = useRef()
  const phaseStartRef = useRef(performance.now() / 1000)
  const lastPhaseRef = useRef(phase)

  if (lastPhaseRef.current !== phase) {
    phaseStartRef.current = performance.now() / 1000
    lastPhaseRef.current = phase
  }

  useFrame((_, dt) => {
    const g = groupRef.current
    if (!g) return
    const target = GROUP_BY_PHASE[phase] ?? GROUP_BY_PHASE.title
    const t = 1 - Math.pow(1 - LERP, dt * 60)
    g.scale.x = THREE.MathUtils.lerp(g.scale.x, target.scale, t)
    g.scale.y = g.scale.x
    g.scale.z = g.scale.x
    g.position.x = THREE.MathUtils.lerp(g.position.x, target.position[0], t)
    g.position.y = THREE.MathUtils.lerp(g.position.y, target.position[1], t)
    g.position.z = THREE.MathUtils.lerp(g.position.z, target.position[2], t)
    g.rotation.x = lerpAngle(g.rotation.x, target.rotation[0], t)
    g.rotation.y = lerpAngle(g.rotation.y, target.rotation[1], t)
    g.rotation.z = lerpAngle(g.rotation.z, target.rotation[2], t)
  })

  return (
    <group ref={groupRef} scale={0.001} position={[0, -2, 0]}>
      {voxels.map((vox) => (
        <Voxel
          key={vox.idx}
          vox={vox}
          phase={phase}
          total={voxels.length}
          phaseStartRef={phaseStartRef}
        />
      ))}
    </group>
  )
}
