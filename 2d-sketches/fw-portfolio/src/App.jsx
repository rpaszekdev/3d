import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ── Data ──────────────────────────────────────────────────────────────────────

const PROJECTS = [
  { name: 'Ruby Campbell', seeds: ['ruby1', 'ruby2', 'ruby3'] },
  { name: 'Shaped by Earth', seeds: ['earth1', 'earth2'] },
  { name: 'Echoes in Light', seeds: ['light1', 'light2', 'light3'] },
  { name: 'Moving Portraits', seeds: ['portrait1', 'portrait2'] },
  { name: 'Issey Miyake SS25', seeds: ['issey1', 'issey2', 'issey3'] },
  { name: 'Studies in Motion', seeds: ['motion1', 'motion2'] },
];

const ORANGE = '#e8430a';
const BG = '#0a0a0a';
const TILE_SIZE = 200;
const GRID = 4;
const FACE_SIZE = GRID * TILE_SIZE;
const CUBE_SCALE = 0.28;

const buildTileImg = (seed) => `https://picsum.photos/seed/${seed}/${TILE_SIZE}/${TILE_SIZE}`;

const buildFaceTiles = (startIndex) => {
  const allSeeds = PROJECTS.flatMap((p) => p.seeds);
  const tiles = [];
  for (let i = 0; i < GRID * GRID; i++) {
    const seedIdx = (startIndex + i) % allSeeds.length;
    const seed = allSeeds[seedIdx];
    const project = PROJECTS.find((p) => p.seeds.includes(seed));
    tiles.push({ seed, projectName: project.name, url: buildTileImg(seed) });
  }
  return tiles;
};

const FACES = {
  front: buildFaceTiles(0),
  right: buildFaceTiles(16),
  top: buildFaceTiles(32),
};

// ── Ruler ─────────────────────────────────────────────────────────────────────

const Ruler = () => {
  const ticks = [];
  for (let i = 0; i <= 1400; i += 100) {
    ticks.push(i);
  }

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 28,
      background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'flex-end', zIndex: 10, overflow: 'hidden',
    }}>
      {ticks.map((val) => (
        <div key={val} style={{
          position: 'absolute', left: `${(val / 1440) * 100}%`, bottom: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
        }}>
          <span style={{
            fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 2,
            fontFamily: 'monospace', transform: 'translateX(-50%)',
          }}>{val}</span>
          <div style={{
            width: 1, height: val % 500 === 0 ? 10 : 6,
            background: 'rgba(255,255,255,0.15)',
          }} />
        </div>
      ))}
      {/* small ticks every 20px */}
      {Array.from({ length: 72 }, (_, i) => i * 20).map((val) => (
        val % 100 !== 0 && (
          <div key={`s${val}`} style={{
            position: 'absolute', left: `${(val / 1440) * 100}%`, bottom: 0,
            width: 1, height: 3, background: 'rgba(255,255,255,0.07)',
          }} />
        )
      ))}
    </div>
  );
};

// ── CubeFace ──────────────────────────────────────────────────────────────────

const CubeFace = ({ tiles, transform, activeProject, onTileHover }) => (
  <div style={{
    position: 'absolute', width: FACE_SIZE, height: FACE_SIZE,
    transform, backfaceVisibility: 'hidden',
    display: 'grid', gridTemplateColumns: `repeat(${GRID}, 1fr)`,
    gridTemplateRows: `repeat(${GRID}, 1fr)`, gap: 2,
  }}>
    {tiles.map((tile, i) => {
      const isActive = activeProject === tile.projectName;
      return (
        <div
          key={`${tile.seed}-${i}`}
          onMouseEnter={() => onTileHover(tile.projectName)}
          onMouseLeave={() => onTileHover(null)}
          style={{
            width: '100%', height: '100%', overflow: 'hidden',
            position: 'relative', cursor: 'pointer',
            transition: 'transform 0.3s ease, box-shadow 0.3s ease',
            transform: isActive ? 'scale(1.08)' : 'scale(1)',
            boxShadow: isActive ? `0 0 20px ${ORANGE}88` : 'none',
            zIndex: isActive ? 2 : 1,
          }}
        >
          <img
            src={tile.url}
            alt={tile.projectName}
            loading="lazy"
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: isActive ? 'brightness(1.3) saturate(1.2)' : 'brightness(0.7)',
              transition: 'filter 0.3s ease',
            }}
          />
          {isActive && (
            <div style={{
              position: 'absolute', inset: 0,
              border: `2px solid ${ORANGE}`,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      );
    })}
  </div>
);

// ── ScrollingList ─────────────────────────────────────────────────────────────

const REPEAT_COUNT = 12;

const ScrollingList = ({ activeProject, onProjectHover }) => {
  const items = useMemo(() => {
    const list = [];
    for (let r = 0; r < REPEAT_COUNT; r++) {
      PROJECTS.forEach((p) => list.push({ ...p, key: `${p.name}-${r}` }));
    }
    return list;
  }, []);

  const itemHeight = 52;
  const totalHeight = items.length * itemHeight;
  const animDuration = items.length * 0.8;

  return (
    <div style={{
      position: 'absolute', right: 60, top: '50%', transform: 'translateY(-50%)',
      height: 420, overflow: 'hidden', width: 260, zIndex: 5,
    }}>
      <style>{`
        @keyframes scrollUp {
          0% { transform: translateY(0); }
          100% { transform: translateY(-${totalHeight / 2}px); }
        }
        .scroll-list { animation: scrollUp ${animDuration}s linear infinite; }
        .scroll-list:hover { animation-play-state: paused; }
      `}</style>
      <div className="scroll-list" style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((item) => {
          const isActive = activeProject === item.name;
          return (
            <div
              key={item.key}
              onMouseEnter={() => onProjectHover(item.name)}
              onMouseLeave={() => onProjectHover(null)}
              style={{
                height: itemHeight, display: 'flex', alignItems: 'center',
                fontSize: 18, fontWeight: 500, letterSpacing: '0.02em',
                cursor: 'pointer', paddingLeft: 8,
                color: isActive ? ORANGE : '#555',
                transition: 'color 0.2s ease',
                borderLeft: isActive ? `2px solid ${ORANGE}` : '2px solid transparent',
                userSelect: 'none',
              }}
            >
              {item.name}
            </div>
          );
        })}
      </div>
      {/* fade edges */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to bottom, ${BG}, transparent)`, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 60,
        background: `linear-gradient(to top, ${BG}, transparent)`, pointerEvents: 'none',
      }} />
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = () => {
  const [activeProject, setActiveProject] = useState(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState({ y: 35, x: -20 });
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);

  const handleMouseMove = useCallback((e) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setMouse({ x: nx, y: ny });
  }, []);

  useEffect(() => {
    const animate = (time) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time;
      const dt = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      setRotation((prev) => ({
        y: prev.y + dt * 6,
        x: prev.x - dt * 2,
      }));

      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const cubeRotateY = rotation.y + mouse.x * 12;
  const cubeRotateX = rotation.x + mouse.y * 8;

  const halfFace = FACE_SIZE / 2;

  return (
    <div
      onMouseMove={handleMouseMove}
      style={{
        width: '100vw', height: '100vh', background: BG,
        position: 'relative', overflow: 'hidden', color: '#fff',
        fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
      }}
    >
      {/* Ruler */}
      <Ruler />

      {/* Dimension label top-left */}
      <div style={{
        position: 'absolute', top: 42, left: 30,
        fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', zIndex: 10,
      }}>
        1440px &times; 810px
      </div>

      {/* Available date top-right */}
      <div style={{
        position: 'absolute', top: 42, right: 30,
        fontSize: 11, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', zIndex: 10,
      }}>
        Available April 2026
      </div>

      {/* Nav */}
      <nav style={{
        position: 'absolute', top: 40, left: '50%', transform: 'translateX(-20%)',
        display: 'flex', gap: 24, fontSize: 14, zIndex: 10,
      }}>
        <span style={{ color: '#fff', fontWeight: 700 }}>Featured Works,</span>
        <span style={{ color: '#666', cursor: 'pointer' }}>Archive,</span>
        <span style={{ color: '#666', cursor: 'pointer' }}>About</span>
      </nav>

      {/* Giant FW letters */}
      <div style={{
        position: 'absolute', bottom: -80, left: -20, zIndex: 1,
        fontSize: 580, fontWeight: 900, lineHeight: 0.85,
        color: ORANGE, userSelect: 'none', pointerEvents: 'none',
        letterSpacing: '-0.03em', opacity: 0.95,
      }}>
        FW
      </div>

      {/* Left credits */}
      <div style={{
        position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)',
        zIndex: 5, fontSize: 11, color: 'rgba(255,255,255,0.35)',
        lineHeight: 1.7, fontFamily: 'monospace',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600, fontSize: 12 }}>
          Corentin Bernadou
        </div>
        <div>Freelance Developer</div>
        <div style={{ marginTop: 20 }}>Issue N&deg;003 / Coll. 2026</div>
        <div>Ref. EDI-032026-R02</div>
      </div>

      {/* 3D Cube */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '48%',
        transform: 'translate(-50%, -50%)',
        perspective: 1800,
        zIndex: 3,
      }}>
        <div style={{
          width: FACE_SIZE, height: FACE_SIZE,
          transformStyle: 'preserve-3d',
          transform: `
            scale(${CUBE_SCALE})
            rotateX(${cubeRotateX}deg)
            rotateY(${cubeRotateY}deg)
          `,
          transition: 'transform 0.05s linear',
        }}>
          {/* Front face */}
          <CubeFace
            tiles={FACES.front}
            transform={`translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
          {/* Back face */}
          <CubeFace
            tiles={FACES.front}
            transform={`rotateY(180deg) translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
          {/* Right face */}
          <CubeFace
            tiles={FACES.right}
            transform={`rotateY(90deg) translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
          {/* Left face */}
          <CubeFace
            tiles={FACES.right}
            transform={`rotateY(-90deg) translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
          {/* Top face */}
          <CubeFace
            tiles={FACES.top}
            transform={`rotateX(90deg) translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
          {/* Bottom face */}
          <CubeFace
            tiles={FACES.top}
            transform={`rotateX(-90deg) translateZ(${halfFace}px)`}
            activeProject={activeProject}
            onTileHover={setActiveProject}
          />
        </div>
      </div>

      {/* Scrolling project list */}
      <ScrollingList
        activeProject={activeProject}
        onProjectHover={setActiveProject}
      />
    </div>
  );
};

export default App;
