// High-score table: five best scores with three-letter initials, saved in localStorage via
// the ui/storage.js wrapper. Anything read back is cleaned so a hand-edited save can't crash
// the page or inject markup.

export const TABLE_SIZE = 7;

export const DEFAULT_SCORES = [
  { name: "THE", score: 300000, stage: "city" },
  { name: "LUA", score: 200000, stage: "city" },
  { name: "TAN", score: 140000, stage: "karst" },
  { name: "PHA", score: 90000, stage: "dunes" },
  { name: "GIA", score: 50000, stage: "dunes" },
  { name: "XE", score: 25000, stage: "paddy" },
  { name: "SAT", score: 10000, stage: "paddy" },
];

/** Up to three letters or digits, upper case; "???" when nothing usable is left. */
export function cleanInitials(text) {
  const plain = String(text ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "D")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 3);
  return plain || "???";
}

/** A clean, sorted table from whatever was stored (or the defaults). */
export function cleanScores(raw) {
  if (!Array.isArray(raw)) return DEFAULT_SCORES.map((s) => ({ ...s }));
  const rows = raw
    .filter((r) => r && typeof r === "object" && Number.isFinite(r.score) && r.score >= 0)
    .map((r) => ({ name: cleanInitials(r.name), score: Math.floor(r.score), stage: typeof r.stage === "string" ? r.stage.slice(0, 16) : "paddy" }));
  return sortScores(rows).slice(0, TABLE_SIZE);
}

function sortScores(rows) {
  return [...rows].sort((a, b) => b.score - a.score);
}

export function qualifies(scores, score) {
  return score > 0 && (scores.length < TABLE_SIZE || score > scores[scores.length - 1].score);
}

export function insertScore(scores, name, score, stage = "paddy") {
  if (!qualifies(scores, score)) return { scores: scores.map((s) => ({ ...s })), place: -1 };
  const entry = { name: cleanInitials(name), score: Math.floor(score), stage };
  const next = sortScores([...scores.map((s) => ({ ...s })), entry]).slice(0, TABLE_SIZE);
  return { scores: next, place: next.indexOf(entry) };
}
