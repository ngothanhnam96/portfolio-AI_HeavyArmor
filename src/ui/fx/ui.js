// Upgrade a game's existing menu markup to the shared fx look, without
// rewriting the menus themselves: call enhance(panel) after the game fills it.

const DEFAULTS = {
  logo: "h1",                     // big title → metallic text with a light sweep
  tagline: ".eyebrow",            // small kicker above the title
  primary: "button.primary",      // the main call to action
  ghost: "button:not(.primary)",  // every other plain button
  cards: "",                      // selectable cards that should lift and glint
  keys: ".controls",              // a table/list of <kbd> keys
  idle: true,                     // the primary button breathes softly on title screens
};

/**
 * @param {Element} root the panel the game just rendered
 * @param {Partial<typeof DEFAULTS>} [map] selectors for this game's markup
 */
export function enhance(root, map = {}) {
  if (!root) return;
  const cfg = { ...DEFAULTS, ...map };
  const all = (sel) => (sel ? [...root.querySelectorAll(sel)] : []);

  for (const el of all(cfg.logo)) {
    el.classList.add("fx-logo");
    el.dataset.text = el.textContent;
  }
  for (const el of all(cfg.tagline)) el.classList.add("fx-tagline");
  const cards = new Set(all(cfg.cards));
  for (const el of cards) el.classList.add("fx-card");
  const primaries = all(cfg.primary).filter((el) => !cards.has(el));
  primaries.forEach((el, i) => {
    el.classList.add("fx-btn");
    if (cfg.idle && i === 0) el.classList.add("fx-idle");
  });
  for (const el of all(cfg.ghost)) {
    if (!cards.has(el) && !el.classList.contains("fx-btn")) el.classList.add("fx-btn-ghost");
  }
  for (const el of all(cfg.keys)) el.classList.add("fx-keys");
}

/**
 * A cinematic stage banner ("MÀN 1 · RỪNG SƯƠNG MÙ") laid over the play area.
 * @returns {HTMLElement} the banner (it removes itself)
 */
export function banner(container, title, subtitle = "", ms = 2400) {
  const el = document.createElement("div");
  el.className = "fx-banner";
  el.setAttribute("role", "status");
  el.innerHTML = `${subtitle ? `<small></small>` : ""}<b></b>`;
  el.querySelector("b").textContent = title;
  if (subtitle) el.querySelector("small").textContent = subtitle;
  el.style.animationDuration = `${ms}ms`;
  container.append(el);
  setTimeout(() => el.remove(), ms + 50);
  return el;
}
