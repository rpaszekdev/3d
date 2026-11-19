/**
 * Render client — sends VOXI code to the reasoning render server (port 3334).
 */

const RENDER_URL = 'http://localhost:3334';

export async function renderVoxi(voxiCode) {
  const res = await fetch(`${RENDER_URL}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: voxiCode }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    return { error: err.error || 'Render request failed', screenshots: [] };
  }

  return res.json();
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
