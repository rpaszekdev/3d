/**
 * Render client — sends SDF DSL code to the render server
 * and receives multi-angle screenshots back.
 */

const RENDER_URL = "http://localhost:3333";

export async function renderSdf(sdfCode, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(`${RENDER_URL}/render`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: sdfCode }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      if (err.error === "Render timed out" && attempt < retries) {
        console.log(
          `  Render timeout, retrying (${attempt + 1}/${retries})...`,
        );
        continue;
      }
      return { error: err.error || "Render request failed", screenshots: [] };
    }

    const data = await res.json();
    if (data.error === "Render timed out" && attempt < retries) {
      console.log(`  Render timeout, retrying (${attempt + 1}/${retries})...`);
      continue;
    }
    return data;
  }
}

export async function checkRendererHealth() {
  try {
    const res = await fetch(`${RENDER_URL}/health`);
    const data = await res.json();
    return data.rendererConnected;
  } catch {
    return false;
  }
}
