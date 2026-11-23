// Escape anything that came from a player or from storage before it goes into markup.

const MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function esc(text) {
  return String(text ?? "").replace(/[&<>"']/g, (ch) => MAP[ch]);
}
