#!/usr/bin/env node
// gallery.js — Generate a static HTML gallery from a pipeline run
// Usage: node gallery.js ./runs/1234567890

const fs = require('fs');
const path = require('path');

const runDir = process.argv[2];
if (!runDir || !fs.existsSync(runDir)) {
  console.error('Usage: node gallery.js <run-directory>');
  process.exit(1);
}

// Collect all result triples: .ssl + .png + .json
const files = fs.readdirSync(runDir);
const sslFiles = files.filter(f => f.endsWith('.ssl')).sort((a, b) => {
  return parseInt(a) - parseInt(b);
});

const results = [];
for (const sslFile of sslFiles) {
  const base = sslFile.replace('.ssl', '');
  const pngFile = base + '.png';
  const jsonFile = base + '.json';

  if (!files.includes(pngFile)) continue;

  const ssl = fs.readFileSync(path.join(runDir, sslFile), 'utf-8');
  const pngPath = pngFile; // relative path for HTML
  const pngBase64 = fs.readFileSync(path.join(runDir, pngFile)).toString('base64');

  let scores = { prompt: `scene ${base}`, recognizability: 0, aesthetic: 0, creativity: 0, total: 0, what_i_see: 'no evaluation' };
  if (files.includes(jsonFile)) {
    try {
      const raw = fs.readFileSync(path.join(runDir, jsonFile), 'utf-8').trim();
      // Try to extract JSON from response (handle markdown fences)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scores = { ...scores, ...JSON.parse(jsonMatch[0]) };
        if (!scores.total) {
          scores.total = Math.round((scores.recognizability + scores.aesthetic + scores.creativity) / 3 * 10) / 10;
        }
      }
    } catch (e) {
      console.warn(`Warning: Could not parse ${jsonFile}: ${e.message}`);
    }
  }

  results.push({ id: base, ssl, pngBase64, pngFile, scores });
}

// Sort by total score descending
results.sort((a, b) => b.scores.total - a.scores.total);

// Compute summary stats
const totals = results.map(r => r.scores.total).filter(t => t > 0);
const avg = totals.length > 0 ? (totals.reduce((s, v) => s + v, 0) / totals.length).toFixed(1) : 'N/A';
const avgRecog = results.length > 0 ? (results.reduce((s, r) => s + r.scores.recognizability, 0) / results.length).toFixed(1) : 'N/A';
const avgAesth = results.length > 0 ? (results.reduce((s, r) => s + r.scores.aesthetic, 0) / results.length).toFixed(1) : 'N/A';
const avgCreat = results.length > 0 ? (results.reduce((s, r) => s + r.scores.creativity, 0) / results.length).toFixed(1) : 'N/A';

// Count shape types used across all SSL files
const typeCounts = {};
const typeNames = ['box','sphere','cylinder','cone','pyramid','torus','line','dot','text','arc'];
for (const r of results) {
  const lines = r.ssl.split('\n').filter(l => l.trim() && !l.trim().startsWith('--') && !/^[PHVGF]/i.test(l.trim()));
  for (const line of lines) {
    const nums = line.trim().split(/\s+/).map(Number);
    if (nums.length >= 3 && nums[0] >= 0 && nums[0] <= 9) {
      const name = typeNames[nums[0]] || `type${nums[0]}`;
      typeCounts[name] = (typeCounts[name] || 0) + 1;
    }
  }
}
const topShapes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

// Generate HTML
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>SSL Pipeline Results</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    background: #0f1117; color: #e0e0e8; padding: 24px; line-height: 1.5;
  }
  h1 { font-size: 24px; margin-bottom: 8px; }
  h1 span { color: #6c8cff; }
  .meta { color: #8888a0; font-size: 13px; margin-bottom: 24px; }
  .stats {
    display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 24px;
    padding: 16px; background: #1a1d27; border-radius: 8px; border: 1px solid #2d3244;
  }
  .stat { text-align: center; min-width: 100px; }
  .stat .value { font-size: 28px; font-weight: 700; color: #6c8cff; }
  .stat .label { font-size: 11px; color: #8888a0; text-transform: uppercase; letter-spacing: 0.5px; }
  .shapes-bar { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .shapes-bar .chip {
    background: #232733; border: 1px solid #2d3244; border-radius: 12px;
    padding: 4px 10px; font-size: 12px; color: #aab;
  }
  .shapes-bar .chip b { color: #6c8cff; }
  .grid {
    display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 16px;
  }
  .card {
    background: #1a1d27; border: 1px solid #2d3244; border-radius: 8px;
    overflow: hidden; cursor: pointer; transition: border-color 0.15s;
  }
  .card:hover { border-color: #6c8cff; }
  .card img { width: 100%; aspect-ratio: 1; object-fit: cover; display: block; background: #13151f; }
  .card-body { padding: 12px; }
  .card-title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
  .card-scores { display: flex; gap: 8px; font-size: 12px; color: #8888a0; }
  .card-scores .score { display: flex; align-items: center; gap: 3px; }
  .card-scores .score b { color: #e0e0e8; font-size: 13px; }
  .card-total {
    float: right; font-size: 20px; font-weight: 700; color: #6c8cff;
    line-height: 1;
  }
  .card-see { font-size: 12px; color: #8888a0; margin-top: 6px; font-style: italic; }
  .modal-overlay {
    display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8);
    z-index: 100; align-items: center; justify-content: center; padding: 24px;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: #1a1d27; border: 1px solid #2d3244; border-radius: 12px;
    max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 24px;
  }
  .modal h2 { font-size: 18px; margin-bottom: 12px; }
  .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .modal img { width: 100%; border-radius: 6px; background: #13151f; }
  .modal pre {
    background: #13151f; padding: 12px; border-radius: 6px; font-size: 12px;
    font-family: 'SF Mono', 'Fira Code', monospace; overflow-x: auto;
    color: #aab; line-height: 1.5; max-height: 300px; overflow-y: auto;
  }
  .modal .eval { margin-top: 12px; padding: 12px; background: #232733; border-radius: 6px; }
  .modal .eval-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
  .modal .eval-row .bar-wrap { flex: 1; margin-left: 12px; background: #2d3244; border-radius: 3px; height: 14px; position: relative; }
  .modal .eval-row .bar { height: 100%; border-radius: 3px; background: #6c8cff; }
  .modal .what-i-see { margin-top: 8px; font-size: 13px; color: #aab; font-style: italic; }
  .close-btn {
    position: absolute; top: 12px; right: 16px; background: none; border: none;
    color: #888; font-size: 24px; cursor: pointer;
  }
  @media (max-width: 600px) {
    .modal-grid { grid-template-columns: 1fr; }
    .grid { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>

<h1><span>SSL</span> Pipeline Results</h1>
<p class="meta">${results.length} scenes | ${new Date().toLocaleDateString()} | ${path.basename(runDir)}</p>

<div class="stats">
  <div class="stat"><div class="value">${avg}</div><div class="label">Avg Total</div></div>
  <div class="stat"><div class="value">${avgRecog}</div><div class="label">Recognizability</div></div>
  <div class="stat"><div class="value">${avgAesth}</div><div class="label">Aesthetic</div></div>
  <div class="stat"><div class="value">${avgCreat}</div><div class="label">Creativity</div></div>
  <div class="stat"><div class="value">${results.length}</div><div class="label">Scenes</div></div>
</div>

<div class="shapes-bar">
  <span style="font-size:12px;color:#8888a0;padding:4px 0;">Most used shapes:</span>
  ${topShapes.map(([name, count]) => `<span class="chip"><b>${count}x</b> ${name}</span>`).join('')}
</div>

<div class="grid">
${results.map((r, i) => `
  <div class="card" onclick="openModal(${i})">
    <img src="data:image/png;base64,${r.pngBase64}" alt="${r.scores.prompt}" loading="lazy">
    <div class="card-body">
      <div class="card-total">${r.scores.total}</div>
      <div class="card-title">#${r.id} ${r.scores.prompt}</div>
      <div class="card-scores">
        <span class="score">R:<b>${r.scores.recognizability}</b></span>
        <span class="score">A:<b>${r.scores.aesthetic}</b></span>
        <span class="score">C:<b>${r.scores.creativity}</b></span>
      </div>
      <div class="card-see">"${r.scores.what_i_see}"</div>
    </div>
  </div>
`).join('')}
</div>

<div class="modal-overlay" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal" style="position:relative;">
    <button class="close-btn" onclick="closeModal()">&times;</button>
    <h2 id="modal-title"></h2>
    <div class="modal-grid">
      <img id="modal-img" src="">
      <pre id="modal-ssl"></pre>
    </div>
    <div class="eval">
      <div class="eval-row"><span>Recognizability</span><div class="bar-wrap"><div class="bar" id="bar-recog"></div></div><span id="val-recog"></span></div>
      <div class="eval-row"><span>Aesthetic</span><div class="bar-wrap"><div class="bar" id="bar-aesth"></div></div><span id="val-aesth"></span></div>
      <div class="eval-row"><span>Creativity</span><div class="bar-wrap"><div class="bar" id="bar-creat"></div></div><span id="val-creat"></span></div>
      <div class="what-i-see" id="modal-what"></div>
    </div>
  </div>
</div>

<script>
const DATA = ${JSON.stringify(results.map(r => ({
  id: r.id, prompt: r.scores.prompt, ssl: r.ssl,
  png: 'data:image/png;base64,' + r.pngBase64,
  scores: r.scores
})))};

function openModal(i) {
  const d = DATA[i];
  document.getElementById('modal-title').textContent = '#' + d.id + ' ' + d.prompt;
  document.getElementById('modal-img').src = d.png;
  document.getElementById('modal-ssl').textContent = d.ssl;
  document.getElementById('bar-recog').style.width = (d.scores.recognizability * 10) + '%';
  document.getElementById('bar-aesth').style.width = (d.scores.aesthetic * 10) + '%';
  document.getElementById('bar-creat').style.width = (d.scores.creativity * 10) + '%';
  document.getElementById('val-recog').textContent = d.scores.recognizability + '/10';
  document.getElementById('val-aesth').textContent = d.scores.aesthetic + '/10';
  document.getElementById('val-creat').textContent = d.scores.creativity + '/10';
  document.getElementById('modal-what').textContent = '"' + d.scores.what_i_see + '"';
  document.getElementById('modal').classList.add('active');
}

function closeModal() {
  document.getElementById('modal').classList.remove('active');
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
</script>
</body>
</html>`;

const outPath = path.join(runDir, 'gallery.html');
fs.writeFileSync(outPath, html);
console.log(`Gallery: ${outPath} (${results.length} scenes)`);
