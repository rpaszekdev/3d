import { useMemo, useState } from "react";
import { parseVoxi } from "./voxi/parser.js";
import { sizeStats } from "./voxi/mindsEye.js";
import { SCENES } from "./data/scenes.js";
import VoxelViewer from "./components/VoxelViewer.jsx";
import AsciiReader from "./components/AsciiReader.jsx";
import ReasoningFlow from "./components/ReasoningFlow.jsx";
import CodePanel from "./components/CodePanel.jsx";
import WhyItMatters from "./components/WhyItMatters.jsx";
import ReasoningTab from "./components/ReasoningTab.jsx";

export default function App() {
  const [tab, setTab] = useState("explore");
  const [sceneKey, setSceneKey] = useState("packing");
  const [code, setCode] = useState(SCENES.packing.code);
  const [selectedView, setSelectedView] = useState("right");

  const scene = useMemo(() => parseVoxi(code), [code]);
  const stats = useMemo(() => sizeStats(code, scene), [code, scene]);

  const pickScene = (key) => {
    setSceneKey(key);
    setCode(SCENES[key].code);
  };

  return (
    <div className="shell">
      <header className="hero">
        <div className="hero-tag">Mind's Eye</div>
        <h1>How a text-only LLM sees 3D</h1>
        <p className="hero-sub">
          A handful of VOXI lines → a voxel world → six depth-ASCII views. The
          same tokens the model writes are the tokens the model reads.
        </p>
        <div className="tab-nav">
          <button
            className={`tab ${tab === "explore" ? "is-active" : ""}`}
            onClick={() => setTab("explore")}
          >
            Explore
          </button>
          <button
            className={`tab ${tab === "reason" ? "is-active" : ""}`}
            onClick={() => setTab("reason")}
          >
            Watch it reason ▶
          </button>
        </div>
        {tab === "explore" && (
          <div className="scene-picker">
            {Object.values(SCENES).map((s) => (
              <button
                key={s.id}
                className={`pill ${sceneKey === s.id ? "is-active" : ""}`}
                onClick={() => pickScene(s.id)}
              >
                {s.title.split(" — ")[0]}
              </button>
            ))}
          </div>
        )}
      </header>

      {tab === "reason" && <ReasoningTab />}

      {tab === "explore" && (
        <>
          <section className="split">
            <div className="split-left panel">
              <div className="panel-head">
                <h2>Voxel scene</h2>
                <span className="panel-sub">
                  {scene.W}×{scene.H}×{scene.D} grid ·{" "}
                  {stats.voxelCount.toLocaleString()} voxels
                </span>
              </div>
              <VoxelViewer scene={scene} highlightView={selectedView} />
            </div>

            <div className="split-right panel">
              <div className="panel-head">
                <h2>Mind's Eye — 6 depth views</h2>
                <span className="panel-sub">
                  click a view to aim the camera arrow
                </span>
              </div>
              <AsciiReader
                scene={scene}
                selected={selectedView}
                onSelect={setSelectedView}
              />
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">How it reasons</h2>
            <div className="reason-grid">
              <ReasoningFlow activeView={selectedView} />
              <div className="reason-right">
                <div className="read-back">
                  <h3>
                    What the LLM reads back (view: {selectedView.toUpperCase()})
                  </h3>
                  <p>
                    Each digit is a ray's first hit depth. A <b>0</b> column
                    means the surface is at the front; a <b>9</b> column means
                    it's at the back. A "·" column means the ray passed through
                    empty space — that's either negative space inside the scene,
                    or the gap the packing problem is asking about.
                  </p>
                  <ul>
                    <li>
                      <b>Overlap check:</b> a single ray can only report one
                      depth; overlaps disappear here but show up as anomalies
                      across views.
                    </li>
                    <li>
                      <b>Gap detection:</b> "·" columns on a side view reveal
                      empty back-half slabs invisible from the front.
                    </li>
                    <li>
                      <b>Silhouette:</b> reading any view's outline gives
                      bounding-box reasoning for free.
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section className="section">
            <h2 className="section-title">Why this representation matters</h2>
            <WhyItMatters stats={stats} />
          </section>

          <section className="section">
            <h2 className="section-title">The source — how short is it?</h2>
            <CodePanel code={code} stats={stats} />
            <details className="edit-details">
              <summary>Edit the VOXI — the render updates live</summary>
              <textarea
                className="code-editor"
                spellCheck={false}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </details>
          </section>
        </>
      )}

      <footer className="foot">
        <span>minds-eye-explorer · VOXI + text raycasting</span>
      </footer>
    </div>
  );
}
