import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { AnimatePresence, motion } from 'framer-motion'
import Chair from './Chair.jsx'
import CameraRig from './CameraRig.jsx'

const SLIDES = [
  { phase: 'title',      caption: "LLMs Don't Have a Mind's Eye",                     subtitle: 'press → to begin' },
  { phase: 'build',      caption: 'Imagine a chair.',                                 subtitle: 'wood. four legs. a back.' },
  { phase: 'scale',      caption: 'Make it bigger.',                                  subtitle: 'throne-sized.' },
  { phase: 'rotate90',   caption: 'Lay it on its side.',                              subtitle: 'your viewpoint stays fixed; the chair turns.' },
  { phase: 'flip',       caption: 'Flip it upside down.',                             subtitle: 'legs in the air.' },
  { phase: 'removeBack', caption: 'Remove the back.',                                 subtitle: "it's a stool now — you reasoned about parts, not pixels." },
  { phase: 'removeLeg',  caption: 'Remove one front leg.',                            subtitle: 'watch what happens.' },
  { phase: 'underneath', caption: 'Look at it from underneath.',                      subtitle: 'four leg-tips and the underside of the seat.' },
  { phase: 'punchline',  caption: 'You just did seven operations on a 3D model.',     subtitle: 'no LLM today can do any of them.' },
  { phase: 'voxi',       caption: 'Until you give it text it can read.',              subtitle: 'this is VOXI — and the model just built that chair.' },
]

const VOXI_TEXT = `V 5 8 3
-- Chair

-- Four legs (height 4)
B 0 0 0 1 4 1 7
B 4 0 0 1 4 1 7
B 0 0 2 1 4 1 7
B 4 0 2 1 4 1 7

-- Seat (slab on top of legs)
B 0 4 0 5 1 3 7

-- Backrest (vertical, at back edge)
B 0 5 2 5 3 1 7`

export default function App() {
  const [i, setI] = useState(0)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') setI((v) => Math.min(v + 1, SLIDES.length - 1))
      if (e.key === 'ArrowLeft') setI((v) => Math.max(v - 1, 0))
      if (e.key === 'Home') setI(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const slide = SLIDES[i]

  return (
    <div className="stage">
      <div className="canvas-wrap">
        <Canvas shadows camera={{ position: [7, 6, 9], fov: 38 }}>
          <color attach="background" args={['#0a0a0a']} />
          <fog attach="fog" args={['#0a0a0a', 14, 32]} />
          <ambientLight intensity={0.35} />
          <directionalLight
            position={[6, 12, 5]}
            intensity={1.1}
            castShadow
            shadow-mapSize-width={1024}
            shadow-mapSize-height={1024}
          />
          <directionalLight position={[-6, 4, -4]} intensity={0.25} color="#7faaff" />
          <CameraRig phase={slide.phase} />
          <Chair phase={slide.phase} />
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.51, 0]} receiveShadow>
            <planeGeometry args={[60, 60]} />
            <shadowMaterial opacity={0.35} />
          </mesh>
        </Canvas>
      </div>

      <AnimatePresence mode="wait">
        {slide.phase === 'voxi' && (
          <motion.pre
            key="voxi"
            className="voxi-overlay"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="head">chair.voxi</div>
            {VOXI_TEXT}
          </motion.pre>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={i}
          className="caption"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
        >
          <h1>{slide.caption}</h1>
          {slide.subtitle && <p>{slide.subtitle}</p>}
        </motion.div>
      </AnimatePresence>

      <div className="hint">← →  navigate</div>
      <div className="counter">{String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}</div>
    </div>
  )
}
