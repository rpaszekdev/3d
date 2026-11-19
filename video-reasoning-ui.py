#!/usr/bin/env python3
"""
video-reasoning-ui.py — Generate an interactive HTML visualization
showing how an LLM reasons about video through depth matrices.

Pipeline: video → frames → depth → LLM reasoning → interactive HTML report

Usage:
  python3 video-reasoning-ui.py test-videos/cater-single-scene.mp4 --start 7 --end 18 --fps 1 --size 20
"""

import argparse
import json
import base64
import os
import sys
import cv2
import numpy as np
from PIL import Image
import subprocess
import io

def extract_frames(video_path, fps=1, start=0, end=None, max_frames=15):
    cap = cv2.VideoCapture(video_path)
    video_fps = cap.get(cv2.CAP_PROP_FPS)
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total / video_fps
    if end is None: end = duration

    frame_interval = video_fps / fps
    frames = []
    timestamps = []
    frame_idx = int(start * video_fps)
    end_idx = int(end * video_fps)

    while frame_idx < end_idx and len(frames) < max_frames:
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret: break
        frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        timestamps.append(round(frame_idx / video_fps, 2))
        frame_idx += int(frame_interval)

    cap.release()
    print(f"Extracted {len(frames)} frames from {video_path}")
    return frames, timestamps

def estimate_depth(frames):
    from transformers import pipeline as tfpipeline
    print("Loading Depth Anything V2...")
    pipe = tfpipeline('depth-estimation', model='depth-anything/Depth-Anything-V2-Small-hf', device='cpu')

    depths = []
    for i, frame in enumerate(frames):
        h, w = frame.shape[:2]
        scale = 518 / max(h, w)
        small = cv2.resize(frame, (int(w*scale), int(h*scale)))
        result = pipe(Image.fromarray(small))
        depths.append(np.array(result['depth']))
        print(f"  Frame {i+1}/{len(frames)}")
    return depths

def process_depth(depth_map, size=20):
    ds = cv2.resize(depth_map.astype(float), (size, size), interpolation=cv2.INTER_AREA)
    dmin, dmax = ds.min(), ds.max()
    if dmax - dmin < 1e-6: return np.zeros((size, size), dtype=int)
    return np.clip(((ds - dmin) / (dmax - dmin) * 9).astype(int), 0, 9)

def depth_to_text(q):
    lines = []
    h, w = q.shape
    header = "   " + " ".join(f"{i%10}" for i in range(w))
    lines.append(header)
    for r in range(h):
        lines.append(f"{r:2d} " + " ".join(str(q[r,c]) for c in range(w)))
    return "\n".join(lines)

def frame_to_base64(frame, max_w=400):
    h, w = frame.shape[:2]
    scale = max_w / w
    resized = cv2.resize(frame, (int(w*scale), int(h*scale)))
    img = Image.fromarray(resized)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()

def depth_to_colored_base64(q, cell_size=20):
    colors = [
        (255,50,50),(255,100,30),(255,160,0),(255,220,0),(220,255,0),
        (100,200,50),(0,150,100),(0,100,180),(30,50,150),(20,20,80)
    ]
    h, w = q.shape
    canvas = np.zeros((h*cell_size, w*cell_size, 3), dtype=np.uint8)
    for r in range(h):
        for c in range(w):
            v = q[r,c]
            y1,y2 = r*cell_size,(r+1)*cell_size
            x1,x2 = c*cell_size,(c+1)*cell_size
            canvas[y1:y2,x1:x2] = colors[v]
            canvas[y1,x1:x2] = (40,40,40)
            canvas[y1:y2,x1] = (40,40,40)
            cv2.putText(canvas, str(v), (x1+5,y2-5), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (255,255,255), 1)
    img = Image.fromarray(canvas)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()

def get_llm_reasoning(depth_texts, timestamps):
    """Ask Claude to reason about the depth frames step by step."""
    all_frames = ""
    for t, dt in zip(timestamps, depth_texts):
        all_frames += f"\n--- Frame T={t}s ---\n{dt}\n"

    prompt = f"""You are analyzing depth matrices extracted from a real video. Each frame is a 20x20 grid where 0=closest to camera, 9=farthest. Objects appear as clusters of LOW depth values on the table/surface.

Here are the frames:
{all_frames}

Analyze this video step by step. For EACH frame, describe:
1. OBJECTS: What distinct objects/clusters do you see? (describe by position and depth)
2. CHANGES: What changed since the previous frame?
3. MOTION: What direction is each object moving?

After analyzing all frames, give a SUMMARY of what happened in the video.

Format your response as JSON array:
[
  {{"frame": "T=Xs", "objects": ["description1", "description2"], "changes": "what changed", "motion": "movement description"}},
  ...
  {{"frame": "SUMMARY", "objects": [], "changes": "", "motion": "overall narrative"}}
]

Return ONLY the JSON, no other text."""

    print("Asking Claude to reason about the frames...")
    result = subprocess.run(
        ["claude", "-m", "sonnet", "-p", prompt, "--no-input"],
        capture_output=True, text=True, timeout=120
    )
    response = result.stdout.strip()

    # Extract JSON from response
    try:
        # Find JSON array in response
        start = response.find('[')
        end = response.rfind(']') + 1
        if start >= 0 and end > start:
            return json.loads(response[start:end])
    except:
        pass

    return [{"frame": "error", "objects": [response[:200]], "changes": "parse error", "motion": ""}]

def generate_html(frames_b64, depth_b64, depth_texts, timestamps, quantized, reasoning, video_name):
    frames_data = json.dumps([{
        'time': t,
        'frame_b64': fb,
        'depth_b64': db,
        'depth_text': dt,
        'reasoning': reasoning[i] if i < len(reasoning) else {},
        'grid': q.tolist(),
    } for i, (t, fb, db, dt, q) in enumerate(zip(timestamps, frames_b64, depth_b64, depth_texts, quantized))])

    summary = reasoning[-1] if reasoning and reasoning[-1].get('frame') == 'SUMMARY' else {}

    html = f"""<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Video Depth Reasoning — {video_name}</title>
<style>
* {{ margin:0; padding:0; box-sizing:border-box; }}
body {{ background:#0a0a0f; color:#e0e0e0; font-family:'Courier New',monospace; }}
.header {{ background:linear-gradient(135deg,#1a1a2e,#16213e); padding:20px 30px; border-bottom:2px solid #0f3460; }}
.header h1 {{ font-size:22px; color:#e94560; }}
.header p {{ color:#888; font-size:13px; margin-top:5px; }}
.container {{ display:flex; height:calc(100vh - 80px); }}
.timeline {{ width:120px; background:#111; border-right:1px solid #333; overflow-y:auto; padding:10px; }}
.timeline-item {{ padding:8px; margin:4px 0; border-radius:6px; cursor:pointer; font-size:12px; text-align:center;
  background:#1a1a2e; border:1px solid #333; transition:all 0.2s; }}
.timeline-item:hover {{ background:#16213e; border-color:#0f3460; }}
.timeline-item.active {{ background:#0f3460; border-color:#e94560; color:#fff; }}
.timeline-item .dot {{ width:8px; height:8px; border-radius:50%; background:#e94560; display:inline-block; margin-right:5px; }}
.main {{ flex:1; display:flex; flex-direction:column; overflow:hidden; }}
.viewer {{ display:flex; flex:1; padding:15px; gap:15px; overflow:hidden; }}
.panel {{ flex:1; background:#111; border-radius:10px; border:1px solid #222; overflow:hidden; display:flex; flex-direction:column; }}
.panel-header {{ background:#1a1a2e; padding:8px 12px; font-size:13px; color:#e94560; font-weight:bold; border-bottom:1px solid #333; }}
.panel-content {{ flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; padding:10px; }}
.panel-content img {{ max-width:100%; max-height:100%; object-fit:contain; image-rendering:pixelated; }}
.reasoning-panel {{ width:380px; background:#111; border-left:1px solid #333; display:flex; flex-direction:column; }}
.reasoning-header {{ background:#1a1a2e; padding:10px 15px; font-size:14px; color:#e94560; font-weight:bold; border-bottom:1px solid #333; }}
.reasoning-content {{ flex:1; overflow-y:auto; padding:15px; font-size:12px; line-height:1.6; }}
.reasoning-section {{ margin-bottom:15px; }}
.reasoning-section h3 {{ color:#e94560; font-size:12px; margin-bottom:5px; text-transform:uppercase; letter-spacing:1px; }}
.reasoning-section p {{ color:#ccc; }}
.objects-list {{ list-style:none; padding:0; }}
.objects-list li {{ padding:4px 8px; margin:3px 0; background:#1a1a2e; border-radius:4px; border-left:3px solid #e94560; }}
.summary-bar {{ background:linear-gradient(135deg,#16213e,#1a1a2e); padding:12px 20px; border-top:2px solid #0f3460; font-size:12px; }}
.summary-bar strong {{ color:#e94560; }}
.depth-text {{ font-family:'Courier New',monospace; font-size:11px; white-space:pre; line-height:1.3; color:#8f8; background:#0a0a0f; padding:8px; border-radius:4px; overflow:auto; max-height:100%; }}
.cell-highlight {{ position:absolute; border:2px solid #e94560; pointer-events:none; }}
.controls {{ display:flex; align-items:center; gap:10px; padding:10px 20px; background:#111; border-top:1px solid #333; }}
.controls button {{ background:#0f3460; color:#fff; border:none; padding:6px 14px; border-radius:4px; cursor:pointer; font-family:inherit; }}
.controls button:hover {{ background:#e94560; }}
.controls .slider {{ flex:1; }}
.controls input[type=range] {{ width:100%; accent-color:#e94560; }}
.tab-bar {{ display:flex; gap:2px; padding:0 10px; background:#0a0a0f; }}
.tab {{ padding:6px 12px; cursor:pointer; font-size:11px; border-radius:4px 4px 0 0; background:#1a1a2e; color:#888; }}
.tab.active {{ background:#111; color:#e94560; }}
</style>
</head>
<body>

<div class="header">
  <h1>🔍 Video Depth Reasoning</h1>
  <p>{video_name} — {len(timestamps)} frames analyzed | LLM reads 20×20 depth matrices, no vision model</p>
</div>

<div class="container">
  <div class="timeline" id="timeline"></div>

  <div class="main">
    <div class="viewer">
      <div class="panel">
        <div class="panel-header">📹 Original Video Frame</div>
        <div class="panel-content"><img id="video-frame" src=""></div>
      </div>
      <div class="panel">
        <div class="panel-header" id="depth-panel-header">🔢 What the LLM "Sees"</div>
        <div class="tab-bar">
          <div class="tab active" onclick="setDepthView('visual')" id="tab-visual">Visual Grid</div>
          <div class="tab" onclick="setDepthView('text')" id="tab-text">Raw Numbers</div>
        </div>
        <div class="panel-content">
          <img id="depth-visual" src="" style="image-rendering:pixelated">
          <pre id="depth-text" class="depth-text" style="display:none"></pre>
        </div>
      </div>
    </div>

    <div class="controls">
      <button onclick="prevFrame()">◀ Prev</button>
      <div class="slider">
        <input type="range" id="frame-slider" min="0" max="{len(timestamps)-1}" value="0" oninput="goToFrame(this.value)">
      </div>
      <button onclick="nextFrame()">Next ▶</button>
      <button onclick="toggleAutoPlay()" id="play-btn">▶ Play</button>
      <span id="frame-label" style="color:#888;font-size:12px;min-width:80px">Frame 1/{len(timestamps)}</span>
    </div>
  </div>

  <div class="reasoning-panel">
    <div class="reasoning-header">🧠 LLM Reasoning</div>
    <div class="reasoning-content" id="reasoning-content">
      <p style="color:#666">Select a frame to see reasoning...</p>
    </div>
    <div class="summary-bar" id="summary-bar">
      <strong>Summary:</strong> <span id="summary-text">{summary.get('motion', 'Processing...')}</span>
    </div>
  </div>
</div>

<script>
const framesData = {frames_data};
let currentFrame = 0;
let autoPlay = null;
let depthView = 'visual';

function setDepthView(view) {{
  depthView = view;
  document.getElementById('tab-visual').className = view === 'visual' ? 'tab active' : 'tab';
  document.getElementById('tab-text').className = view === 'text' ? 'tab active' : 'tab';
  showFrame(currentFrame);
}}

function showFrame(idx) {{
  if (idx < 0 || idx >= framesData.length) return;
  currentFrame = idx;
  const f = framesData[idx];

  document.getElementById('video-frame').src = 'data:image/png;base64,' + f.frame_b64;

  if (depthView === 'visual') {{
    document.getElementById('depth-visual').style.display = 'block';
    document.getElementById('depth-text').style.display = 'none';
    document.getElementById('depth-visual').src = 'data:image/png;base64,' + f.depth_b64;
  }} else {{
    document.getElementById('depth-visual').style.display = 'none';
    document.getElementById('depth-text').style.display = 'block';
    document.getElementById('depth-text').textContent = f.depth_text;
  }}

  document.getElementById('depth-panel-header').textContent = '🔢 What the LLM "Sees" — T=' + f.time + 's';
  document.getElementById('frame-slider').value = idx;
  document.getElementById('frame-label').textContent = 'Frame ' + (idx+1) + '/' + framesData.length + ' (T=' + f.time + 's)';

  // Update timeline
  document.querySelectorAll('.timeline-item').forEach((el, i) => {{
    el.className = i === idx ? 'timeline-item active' : 'timeline-item';
  }});

  // Update reasoning
  const r = f.reasoning || {{}};
  let html = '';

  if (r.objects && r.objects.length) {{
    html += '<div class="reasoning-section"><h3>👁 Objects Detected</h3><ul class="objects-list">';
    r.objects.forEach(o => {{ html += '<li>' + o + '</li>'; }});
    html += '</ul></div>';
  }}

  if (r.changes) {{
    html += '<div class="reasoning-section"><h3>🔄 Changes</h3><p>' + r.changes + '</p></div>';
  }}

  if (r.motion) {{
    html += '<div class="reasoning-section"><h3>➡️ Motion</h3><p>' + r.motion + '</p></div>';
  }}

  if (!html) html = '<p style="color:#666">No reasoning data for this frame</p>';
  document.getElementById('reasoning-content').innerHTML = html;
}}

function prevFrame() {{ showFrame(currentFrame - 1); }}
function nextFrame() {{ showFrame(currentFrame + 1); }}
function goToFrame(idx) {{ showFrame(parseInt(idx)); }}

function toggleAutoPlay() {{
  if (autoPlay) {{
    clearInterval(autoPlay);
    autoPlay = null;
    document.getElementById('play-btn').textContent = '▶ Play';
  }} else {{
    autoPlay = setInterval(() => {{
      if (currentFrame >= framesData.length - 1) {{ currentFrame = -1; }}
      nextFrame();
    }}, 1500);
    document.getElementById('play-btn').textContent = '⏸ Pause';
  }}
}}

// Build timeline
const tl = document.getElementById('timeline');
framesData.forEach((f, i) => {{
  const el = document.createElement('div');
  el.className = i === 0 ? 'timeline-item active' : 'timeline-item';
  el.innerHTML = '<div class="dot"></div>T=' + f.time + 's';
  el.onclick = () => showFrame(i);
  tl.appendChild(el);
}});

// Show first frame
showFrame(0);
</script>
</body></html>"""
    return html

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("video", help="Video file path")
    parser.add_argument("--start", type=float, default=0)
    parser.add_argument("--end", type=float, default=None)
    parser.add_argument("--fps", type=float, default=1)
    parser.add_argument("--size", type=int, default=20)
    parser.add_argument("--max-frames", type=int, default=12)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    # Extract frames
    frames, timestamps = extract_frames(args.video, args.fps, args.start, args.end, args.max_frames)
    if not frames:
        print("No frames!"); sys.exit(1)

    # Depth estimation
    depths = estimate_depth(frames)

    # Process
    quantized = [process_depth(d, args.size) for d in depths]
    depth_texts = [depth_to_text(q) for q in quantized]

    # Encode images
    print("Encoding images...")
    frames_b64 = [frame_to_base64(f) for f in frames]
    depth_b64 = [depth_to_colored_base64(q) for q in quantized]

    # LLM reasoning
    reasoning = get_llm_reasoning(depth_texts, timestamps)

    # Generate HTML
    video_name = os.path.basename(args.video)
    html = generate_html(frames_b64, depth_b64, depth_texts, timestamps, quantized, reasoning, video_name)

    out_path = args.output or args.video.rsplit('.', 1)[0] + '-reasoning.html'
    with open(out_path, 'w') as f:
        f.write(html)

    print(f"\nDone! Open: {out_path}")
    os.system(f"open '{out_path}'")

if __name__ == "__main__":
    main()
