import { useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, Edges } from '@react-three/drei'
import * as THREE from 'three'
import { COLORS } from '../voxi/parser.js'

function Voxels({ scene, highlightView }) {
  const ref = useRef()
  const { instances, center } = useMemo(() => {
    const { W, H, D, voxels } = scene
    const items = []
    for (const [k, c] of voxels) {
      const [x, y, z] = k.split(',').map(Number)
      items.push({ x, y, z, color: COLORS[c] ?? COLORS[9] })
    }
    return {
      instances: items,
      center: [W / 2, H / 2, D / 2],
    }
  }, [scene])

  return (
    <group ref={ref} position={[-center[0], -center[1], -center[2]]}>
      {instances.map((v, i) => (
        <mesh key={i} position={[v.x + 0.5, v.y + 0.5, v.z + 0.5]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color={v.color} roughness={0.55} metalness={0.05} />
          <Edges threshold={15} color="#0a0a12" />
        </mesh>
      ))}
      <CameraArrow scene={scene} view={highlightView} />
    </group>
  )
}

function CameraArrow({ scene, view }) {
  const { W, H, D } = scene
  const cx = W / 2, cy = H / 2, cz = D / 2
  // distance from center along the view's outward axis
  const reach = Math.max(W, H, D) * 0.8

  const positions = {
    front:  [cx, cy, D + reach * 0.4],
    back:   [cx, cy, -reach * 0.4],
    left:   [-reach * 0.4, cy, cz],
    right:  [W + reach * 0.4, cy, cz],
    top:    [cx, H + reach * 0.4, cz],
    bottom: [cx, -reach * 0.4, cz],
  }
  if (!view || !positions[view]) return null
  const p = positions[view]
  const target = new THREE.Vector3(cx, cy, cz)
  const origin = new THREE.Vector3(...p)
  const dir = target.clone().sub(origin).normalize()

  return (
    <group>
      <mesh position={p}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshStandardMaterial color="#fde047" emissive="#fde047" emissiveIntensity={0.6} />
      </mesh>
      <arrowHelper args={[dir, origin, reach * 0.3, 0xfacc15, 0.6, 0.3]} />
    </group>
  )
}

function Spin({ children }) {
  const g = useRef()
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.12
  })
  return <group ref={g}>{children}</group>
}

export default function VoxelViewer({ scene, highlightView, autoRotate = true }) {
  const maxDim = Math.max(scene.W, scene.H, scene.D)
  const camDist = maxDim * 1.8
  return (
    <div className="viewer-wrap">
      <Canvas camera={{ position: [camDist, camDist * 0.8, camDist], fov: 35 }} shadows>
        <color attach="background" args={['#07080d']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[10, 15, 10]} intensity={1.1} castShadow />
        <directionalLight position={[-8, 6, -8]} intensity={0.35} />
        <group>
          {autoRotate ? (
            <Spin>
              <Voxels scene={scene} highlightView={highlightView} />
            </Spin>
          ) : (
            <Voxels scene={scene} highlightView={highlightView} />
          )}
        </group>
        <Grid
          args={[maxDim * 3, maxDim * 3]}
          position={[0, -scene.H / 2 - 0.01, 0]}
          cellColor="#1f2937"
          sectionColor="#334155"
          fadeDistance={maxDim * 4}
        />
        <OrbitControls enablePan={false} minDistance={maxDim} maxDistance={maxDim * 4} />
      </Canvas>
      <div className="viewer-hint">drag to orbit · scroll to zoom</div>
    </div>
  )
}
