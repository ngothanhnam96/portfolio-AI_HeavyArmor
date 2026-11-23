// Post-processing for a game canvas: bloom, colour grade, vignette, film grain
// and screen flashes — the "modern game" finish, without touching the game's
// own drawing code.
//
// How it works: after the game draws a frame, post.frame() copies it, shrunk,
// into a second canvas laid exactly over the first. CSS then thresholds and
// blurs that copy and adds it on top with `mix-blend-mode: screen`, so only the
// bright things — shots, explosions, lights, neon — glow. The blur runs on the
// GPU, so the cost per frame is one small drawImage. A grade layer adds the
// vignette, a colour tint and a fine animated grain.
//
//   const post = createPost(canvas, { bloom: 0.6, tint: "rgba(255,120,40,.08)" });
//   ...in the render loop, after drawing:  post.frame();
//   ...on a big hit:                        post.flash("#fff", 120);

const REDUCED = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * @param {HTMLCanvasElement} canvas the game's canvas
 * @param {object} [options]
 * @param {number} [options.bloom=0.55]   glow strength (opacity of the glow layer, 0 turns it off)
 * @param {number} [options.blur=7]       glow radius in CSS pixels
 * @param {number} [options.threshold=2.3] contrast used to keep only bright areas glowing
 * @param {number} [options.exposure=0.8] brightness before the threshold; lower it for games
 *                                         with large light surfaces so only real lights glow
 * @param {number} [options.scale=0.5]    resolution of the glow copy relative to the canvas
 * @param {number} [options.vignette=0.55] how dark the corners get (0–1)
 * @param {string|null} [options.tint]    colour grade wash, e.g. "rgba(80,160,255,.08)"
 * @param {boolean} [options.grain=true]  animated film grain
 * @param {boolean} [options.scanlines=false] faint CRT lines (for pixel-art games)
 * @param {number} [options.spill=0.35]  wide soft light thrown around bright things (0 turns it off)
 * @param {string|null} [options.haze]   atmospheric colour rising from the bottom, e.g. "rgba(255,90,20,.18)"
 */
export function createPost(canvas, options = {}) {
  const opts = {
    bloom: 0.55, blur: 7, threshold: 2.3, exposure: 0.8, scale: 0.5, vignette: 0.55,
    tint: null, grain: true, scanlines: false, spill: 0.35, haze: null, ...options,
  };
  const parent = canvas.parentElement;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";

  const glow = document.createElement("canvas");
  glow.className = "fx-bloom";
  glow.setAttribute("aria-hidden", "true");
  const gctx = glow.getContext("2d");

  // A second, much softer copy: light that spills onto walls and floor.
  const spill = document.createElement("canvas");
  spill.className = "fx-bloom fx-spill";
  spill.setAttribute("aria-hidden", "true");
  const sctx = spill.getContext("2d");

  const grade = document.createElement("div");
  grade.className = `fx-grade${opts.grain && !REDUCED ? " fx-grain" : ""}${opts.scanlines ? " fx-scanlines" : ""}`;
  grade.setAttribute("aria-hidden", "true");

  const flashEl = document.createElement("div");
  flashEl.className = "fx-flash";
  flashEl.setAttribute("aria-hidden", "true");

  canvas.after(spill, glow, grade, flashEl);

  let quality = 1;          // drops to 0.5 (glow every other frame) on slow machines
  let tick = 0;
  let slow = 0;
  let lastTime = performance.now();

  function style() {
    glow.style.opacity = String(opts.bloom);
    glow.style.filter = `brightness(${opts.exposure}) contrast(${opts.threshold}) saturate(1.5) blur(${opts.blur}px)`;
    glow.hidden = opts.bloom <= 0;
    spill.style.opacity = String(opts.spill);
    // Same threshold as the glow, so only real lights spill; then lifted after the wide blur.
    spill.style.filter = `brightness(${opts.exposure}) contrast(${opts.threshold}) saturate(1.6) blur(${opts.blur * 4}px) brightness(1.5)`;
    spill.hidden = opts.spill <= 0 || opts.bloom <= 0;
    const v = opts.vignette;
    grade.style.background = [
      `radial-gradient(ellipse 80% 75% at 50% 50%, transparent 52%, rgba(0,0,0,${(0.55 * v).toFixed(3)}) 85%, rgba(0,0,0,${(0.85 * v).toFixed(3)}) 100%)`,
      opts.haze ? `linear-gradient(to top, ${opts.haze}, transparent 60%)` : null,
      opts.tint ? `linear-gradient(${opts.tint}, ${opts.tint})` : null,
    ].filter(Boolean).join(",");
  }

  function sync() {
    for (const el of [spill, glow, grade, flashEl]) {
      el.style.left = `${canvas.offsetLeft}px`;
      el.style.top = `${canvas.offsetTop}px`;
      el.style.width = `${canvas.offsetWidth}px`;
      el.style.height = `${canvas.offsetHeight}px`;
    }
    const w = Math.max(96, Math.round(canvas.width * opts.scale));
    const h = Math.max(54, Math.round(canvas.height * opts.scale));
    if (glow.width !== w || glow.height !== h) { glow.width = w; glow.height = h; }
    const sw = Math.max(48, Math.round(w / 3));
    const sh = Math.max(27, Math.round(h / 3));
    if (spill.width !== sw || spill.height !== sh) { spill.width = sw; spill.height = sh; }
  }

  const observer = typeof ResizeObserver === "function" ? new ResizeObserver(sync) : null;
  observer?.observe(canvas);
  window.addEventListener("resize", sync);
  style();
  sync();

  return {
    /** Call once per rendered frame, right after the game has drawn. */
    frame() {
      const now = performance.now();
      const dt = now - lastTime;
      lastTime = now;
      // Adaptive quality: if frames keep running long, refresh the glow every other frame.
      slow = dt > 24 ? Math.min(60, slow + 1) : Math.max(0, slow - 1);
      quality = slow > 30 ? 0.5 : 1;
      tick += 1;
      if ((tick & 31) === 0) sync();
      if (opts.bloom <= 0 || (quality < 1 && tick % 2)) return;
      if (glow.width !== Math.max(96, Math.round(canvas.width * opts.scale))) sync();
      gctx.clearRect(0, 0, glow.width, glow.height);
      gctx.drawImage(canvas, 0, 0, glow.width, glow.height);
      if (opts.spill > 0 && (tick % 2 === 0 || quality === 1)) {
        sctx.clearRect(0, 0, spill.width, spill.height);
        sctx.drawImage(glow, 0, 0, spill.width, spill.height);
      }
    },

    /** A full-screen flash, e.g. for an explosion, a hit taken or a boss down. */
    flash(color = "#ffffff", ms = 140, strength = 0.55) {
      if (REDUCED) return;
      flashEl.style.transition = "none";
      flashEl.style.background = color;
      flashEl.style.opacity = String(strength);
      void flashEl.offsetWidth;
      flashEl.style.transition = `opacity ${ms}ms ease-out`;
      flashEl.style.opacity = "0";
    },

    /** Change the look on the fly (a new level, a boss fight, low-power mode…). */
    set(next) {
      Object.assign(opts, next);
      grade.className = `fx-grade${opts.grain && !REDUCED ? " fx-grain" : ""}${opts.scanlines ? " fx-scanlines" : ""}`;
      style();
      sync();
    },

    sync,
    get options() { return { ...opts }; },

    destroy() {
      observer?.disconnect();
      window.removeEventListener("resize", sync);
      glow.remove();
      spill.remove();
      grade.remove();
      flashEl.remove();
    },
  };
}
