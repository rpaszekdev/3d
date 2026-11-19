// app.js — SSL Benchmark website logic
// Loads benchmark-data.json and renders all views

let DATA = null;

// --- Init ---

async function init() {
  try {
    const resp = await fetch("data/benchmark-data.json");
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    DATA = await resp.json();
  } catch (err) {
    document.getElementById("loading").textContent =
      "Failed to load benchmark data. Run the pipeline first: npm run pipeline";
    console.error(err);
    return;
  }

  document.getElementById("loading").style.display = "none";
  renderHeader();
  renderLeaderboard();
  renderGallery();
  setupCompare();
  setupTabs();
}

// --- Header ---

function renderHeader() {
  const { meta } = DATA;
  document.getElementById("header-models").textContent = meta.models.length;
  document.getElementById("header-prompts").textContent = meta.promptCount;
  document.getElementById("header-date").textContent = new Date(
    meta.generatedAt,
  ).toLocaleDateString();

  const chipsEl = document.getElementById("header-chips");
  chipsEl.innerHTML = meta.models
    .map((m) => `<span class="chip">${m}</span>`)
    .join("");
}

// --- Leaderboard ---

function renderLeaderboard() {
  const tbody = document.getElementById("leaderboard-body");
  tbody.innerHTML = "";

  const sorted = [...DATA.leaderboard];

  sorted.forEach((entry, i) => {
    const rank = i + 1;
    const rankClass =
      rank <= 3 ? `rank-cell rank-${rank}` : "rank-cell";

    const tierCells = [1, 2, 3, 4, 5]
      .map((t) => {
        const score = entry.tierScores[t];
        if (score == null) return `<td class="tier-score">-</td>`;
        return `<td><span class="tier-score ${scoreColorClass(score)}">${score}</span></td>`;
      })
      .join("");

    const barW = Math.round(entry.avgTotal * 10);

    tbody.innerHTML += `
      <tr>
        <td class="${rankClass}">${rank}</td>
        <td class="model-name">${entry.model}</td>
        <td class="score-cell">
          ${entry.avgTotal.toFixed(1)}
          <span class="score-bar" style="width:${barW}px"></span>
        </td>
        <td class="${scoreColorClass(entry.avgRecog)}">${entry.avgRecog}</td>
        <td class="${scoreColorClass(entry.avgAesth)}">${entry.avgAesth}</td>
        <td class="${scoreColorClass(entry.avgCreat)}">${entry.avgCreat}</td>
        ${tierCells}
        <td style="color:var(--text-dim)">${entry.count}</td>
      </tr>
    `;
  });
}

// --- Gallery ---

function renderGallery() {
  const container = document.getElementById("gallery-grid");
  const tierFilter = document.getElementById("gallery-tier");
  const sortSelect = document.getElementById("gallery-sort");

  function render() {
    const tier = tierFilter.value;
    const sort = sortSelect.value;

    let prompts = [...DATA.prompts];
    if (tier !== "all") {
      prompts = prompts.filter((p) => p.tier === parseInt(tier, 10));
    }

    // Sort prompts by criteria
    if (sort === "score-desc" || sort === "score-asc") {
      prompts.sort((a, b) => {
        const aAvg = avgScoreForPrompt(a.id);
        const bAvg = avgScoreForPrompt(b.id);
        return sort === "score-desc" ? bAvg - aAvg : aAvg - bAvg;
      });
    } else if (sort === "spread") {
      prompts.sort((a, b) => scoreSpread(b.id) - scoreSpread(a.id));
    }

    container.innerHTML = prompts.map((p) => renderPromptCard(p)).join("");
  }

  tierFilter.addEventListener("change", render);
  sortSelect.addEventListener("change", render);
  render();
}

function renderPromptCard(prompt) {
  const results = DATA.results.filter((r) => r.promptId === prompt.id);
  const tierLabels = { 1: "Basic", 2: "Intermediate", 3: "Complex", 4: "Scene", 5: "Abstract" };

  const renderCells = results
    .sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0))
    .map(
      (r) => `
    <div class="render-cell" onclick="openModal('${r.model}', '${r.promptId}')">
      ${
        r.imagePath
          ? `<img src="${r.imagePath}" alt="${r.model}" loading="lazy">`
          : `<div style="aspect-ratio:1;background:var(--canvas-bg);display:flex;align-items:center;justify-content:center;color:var(--text-dim);font-size:12px">No render</div>`
      }
      <div class="render-info">
        <div class="render-total">${r.scores?.total || "-"}</div>
        <div class="render-model">${r.model}</div>
        <div class="render-scores">
          R:${r.scores?.recognizability || "-"}
          A:${r.scores?.aesthetic || "-"}
          C:${r.scores?.creativity || "-"}
        </div>
      </div>
    </div>
  `,
    )
    .join("");

  return `
    <div class="prompt-card">
      <div class="prompt-card-header">
        <h3>${prompt.prompt}</h3>
        <span class="tier-badge">Tier ${prompt.tier} — ${tierLabels[prompt.tier]}</span>
      </div>
      <div class="renders-grid">${renderCells}</div>
    </div>
  `;
}

// --- Compare ---

function setupCompare() {
  const selectA = document.getElementById("compare-a");
  const selectB = document.getElementById("compare-b");

  // Populate model dropdowns
  const options = DATA.meta.models
    .map((m) => `<option value="${m}">${m}</option>`)
    .join("");
  selectA.innerHTML = options;
  selectB.innerHTML = options;

  // Default: first two models
  if (DATA.meta.models.length >= 2) {
    selectB.value = DATA.meta.models[1];
  }

  function render() {
    renderCompare(selectA.value, selectB.value);
  }

  selectA.addEventListener("change", render);
  selectB.addEventListener("change", render);
  render();
}

function renderCompare(modelA, modelB) {
  const container = document.getElementById("compare-grid");
  const tallyEl = document.getElementById("compare-tally");

  let wins = 0,
    losses = 0,
    draws = 0;
  const rows = [];

  for (const prompt of DATA.prompts) {
    const rA = DATA.results.find(
      (r) => r.model === modelA && r.promptId === prompt.id,
    );
    const rB = DATA.results.find(
      (r) => r.model === modelB && r.promptId === prompt.id,
    );

    if (!rA && !rB) continue;

    const scoreA = rA?.scores?.total || 0;
    const scoreB = rB?.scores?.total || 0;

    if (scoreA > scoreB) wins++;
    else if (scoreB > scoreA) losses++;
    else draws++;

    const winnerA = scoreA > scoreB ? "winner" : "";
    const winnerB = scoreB > scoreA ? "winner" : "";

    rows.push(`
      <div class="compare-row">
        <div class="compare-cell ${winnerA}">
          ${
            rA?.imagePath
              ? `<img src="${rA.imagePath}" alt="${modelA}" loading="lazy">`
              : `<div style="aspect-ratio:1;background:var(--canvas-bg)"></div>`
          }
          <div class="cell-score">
            <span>R:${rA?.scores?.recognizability || "-"} A:${rA?.scores?.aesthetic || "-"} C:${rA?.scores?.creativity || "-"}</span>
            <span class="total">${scoreA || "-"}</span>
          </div>
        </div>
        <div class="compare-vs">
          <div class="prompt-label">${prompt.prompt}</div>
          <div class="vs-text">vs</div>
        </div>
        <div class="compare-cell ${winnerB}">
          ${
            rB?.imagePath
              ? `<img src="${rB.imagePath}" alt="${modelB}" loading="lazy">`
              : `<div style="aspect-ratio:1;background:var(--canvas-bg)"></div>`
          }
          <div class="cell-score">
            <span>R:${rB?.scores?.recognizability || "-"} A:${rB?.scores?.aesthetic || "-"} C:${rB?.scores?.creativity || "-"}</span>
            <span class="total">${scoreB || "-"}</span>
          </div>
        </div>
      </div>
    `);
  }

  tallyEl.innerHTML = `
    <span class="win">${modelA}: ${wins} wins</span>
    <span class="draw">${draws} draws</span>
    <span class="loss">${modelB}: ${losses} wins</span>
  `;

  container.innerHTML = rows.join("");
}

// --- Modal ---

window.openModal = function (model, promptId) {
  const result = DATA.results.find(
    (r) => r.model === model && r.promptId === promptId,
  );
  if (!result) return;

  const prompt = DATA.prompts.find((p) => p.id === promptId);

  document.getElementById("modal-title").textContent = prompt?.prompt || promptId;
  document.getElementById("modal-subtitle").textContent = `${model} — Tier ${prompt?.tier || "?"}`;

  const imgEl = document.getElementById("modal-img");
  imgEl.src = result.imagePath || "";
  imgEl.style.display = result.imagePath ? "block" : "none";

  document.getElementById("modal-ssl").textContent = result.ssl;

  const scores = result.scores;
  if (scores) {
    document.getElementById("bar-recog").style.width = `${scores.recognizability * 10}%`;
    document.getElementById("bar-aesth").style.width = `${scores.aesthetic * 10}%`;
    document.getElementById("bar-creat").style.width = `${scores.creativity * 10}%`;
    document.getElementById("val-recog").textContent = `${scores.recognizability}/10`;
    document.getElementById("val-aesth").textContent = `${scores.aesthetic}/10`;
    document.getElementById("val-creat").textContent = `${scores.creativity}/10`;
    document.getElementById("modal-what").textContent = scores.whatISee
      ? `"${scores.whatISee}"`
      : "";
  }

  document.getElementById("modal").classList.add("active");
};

window.closeModal = function () {
  document.getElementById("modal").classList.remove("active");
};

// --- Tabs ---

function setupTabs() {
  const tabs = document.querySelectorAll(".tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      contents.forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });
}

// --- Helpers ---

function scoreColorClass(score) {
  if (score >= 7) return "score-high";
  if (score >= 4) return "score-mid";
  return "score-low";
}

function avgScoreForPrompt(promptId) {
  const results = DATA.results.filter(
    (r) => r.promptId === promptId && r.scores,
  );
  if (results.length === 0) return 0;
  return results.reduce((s, r) => s + r.scores.total, 0) / results.length;
}

function scoreSpread(promptId) {
  const results = DATA.results.filter(
    (r) => r.promptId === promptId && r.scores,
  );
  if (results.length < 2) return 0;
  const scores = results.map((r) => r.scores.total);
  return Math.max(...scores) - Math.min(...scores);
}

// --- Keyboard ---

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

// --- Start ---
init();
