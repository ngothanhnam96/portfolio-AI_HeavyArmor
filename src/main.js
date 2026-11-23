// Screens, input and the game loop. The rules live in src/core; this file wires them to the
// page: mouse, keyboard and touch, the canvas, post-processing, sound and the high scores.

import { createBot } from "./core/bot.js";
import {
  AIM_MAX, AIM_MIN, DEFAULT_DIFFICULTY, DIFFICULTIES, DT, TANK, chooseUpgrade, comboMultiplier,
  createGame, debugClear, fmt, stageProgress, step,
} from "./core/game.js";
import { cleanInitials, cleanScores, insertScore, qualifies } from "./core/scores.js";
import { FIELD_H, FIELD_W, GROUND_Y, STAGES, stageById } from "./core/stages.js";
import { esc } from "./core/text.js";
import { MAX, UPGRADES } from "./core/weapons.js";
import { isMuted, playEvents, setMuted, sfx, tickMusic, unlock } from "./ui/audio.js";
import { createPost } from "./ui/fx/post.js";
import { banner, enhance } from "./ui/fx/ui.js";
import { createRenderer } from "./ui/render.js";
import { load, save } from "./ui/storage.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
const hasTouch = (navigator.maxTouchPoints ?? 0) > 0;
const fine = window.matchMedia?.("(any-pointer: fine)").matches ?? true;
const touchUI = (hasTouch && !fine) || params.has("touch");

const canvas = $("game");
const renderer = createRenderer(canvas);
renderer.setReduced(reduced);
const post = createPost(canvas, { bloom: 0.5, blur: 7, exposure: 0.78, threshold: 2.4, spill: 0.3, vignette: 0.6, tint: "rgba(255,140,60,.05)", haze: "rgba(255,120,40,.10)" });

let scores = cleanScores(load("scores"));
let difficulty = DIFFICULTIES[load("difficulty")] ? load("difficulty") : DEFAULT_DIFFICULTY;
let mode = "campaign";
let screen = "title"; // title | play | pause | upgrade | over
let game = null;
let attract = makeAttract();
let acc = 0;
let last = performance.now();
let lastStatus = "";
let autopilot = params.has("autopilot") ? createBot() : null;

setMuted(load("muted", false));

// ------------------------------------------------------------------ input

const keys = new Set();
const mouse = { x: FIELD_W / 2, y: 200, down: false, active: false, lastMove: 0 };
let kbAim = -Math.PI / 2;
let aimMode = "mouse";
const touch = { left: false, right: false, aimId: null, fire: false, x: FIELD_W / 2, y: 200 };

function playerInput() {
  const t = game.tank;
  const left = keys.has("KeyA") || touch.left;
  const right = keys.has("KeyD") || touch.right;
  // keyboard turret rotation
  const rot = (keys.has("ArrowRight") || keys.has("KeyE") ? 1 : 0) - (keys.has("ArrowLeft") || keys.has("KeyQ") ? 1 : 0);
  if (rot) { aimMode = "keys"; kbAim = clampA(kbAim + rot * 2.4 * DT); }
  if (keys.has("ArrowUp") || keys.has("KeyW")) { aimMode = "keys"; kbAim = -Math.PI / 2; }
  let aim;
  let aimDist = 320;
  const px = t.x;
  const py = TANK.pivotY;
  if (touch.aimId !== null) {
    aim = Math.atan2(touch.y - py, touch.x - px);
    aimDist = Math.hypot(touch.x - px, touch.y - py);
    kbAim = clampA(aim);
  } else if (aimMode === "mouse") {
    aim = Math.atan2(Math.min(mouse.y, py - 4) - py, mouse.x - px);
    aimDist = Math.hypot(mouse.x - px, mouse.y - py);
    kbAim = clampA(aim);
  } else {
    aim = kbAim;
  }
  const fire = mouse.down || keys.has("Space") || keys.has("KeyJ") || touch.fire || params.has("autofire");
  const nuke = keys.has("KeyX") || keys.has("KeyK") || touch.nuke;
  touch.nuke = false;
  return { left, right, fire, aim, aimDist, nuke };
}

function clampA(a) {
  if (a > Math.PI / 2) a -= Math.PI * 2; // keep the angle in the upper half
  return Math.max(AIM_MIN, Math.min(AIM_MAX, a));
}

function reticle() {
  if (!game || screen !== "play") return null;
  if (touch.aimId !== null) return { x: touch.x, y: touch.y };
  if (aimMode === "mouse" && mouse.active) return { x: mouse.x, y: Math.min(mouse.y, GROUND_Y - 6) };
  const d = 220;
  return { x: game.tank.x + Math.cos(game.tank.aim) * d, y: TANK.pivotY + Math.sin(game.tank.aim) * d };
}

function canvasPoint(ev) {
  const r = canvas.getBoundingClientRect();
  return renderer.toField(ev.clientX - r.left, ev.clientY - r.top);
}

canvas.addEventListener("pointermove", (ev) => {
  if (ev.pointerType === "touch") return;
  const p = canvasPoint(ev);
  mouse.x = p.x;
  mouse.y = p.y;
  mouse.active = true;
  aimMode = "mouse";
});
canvas.addEventListener("pointerdown", (ev) => {
  if (ev.pointerType === "touch") return;
  unlock();
  if (ev.button === 0) mouse.down = true;
  if (ev.button === 2 && screen === "play") touch.nuke = true;
});
window.addEventListener("pointerup", (ev) => { if (ev.pointerType !== "touch" && ev.button === 0) mouse.down = false; });
canvas.addEventListener("contextmenu", (ev) => ev.preventDefault());
window.addEventListener("blur", () => { keys.clear(); mouse.down = false; if (screen === "play") pause(); });

window.addEventListener("keydown", (ev) => {
  if (ev.target instanceof HTMLInputElement) return;
  unlock();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(ev.code)) ev.preventDefault();
  if (ev.code === "KeyM") { toggleMute(); return; }
  if (ev.code === "KeyP" || ev.code === "Escape") {
    if (screen === "play") pause();
    else if (screen === "pause") resume();
    return;
  }
  keys.add(ev.code);
});
window.addEventListener("keyup", (ev) => keys.delete(ev.code));

// touch controls
function hold(el, on, off) {
  el.addEventListener("pointerdown", (ev) => { ev.preventDefault(); unlock(); el.classList.add("active"); on(); el.setPointerCapture?.(ev.pointerId); });
  const end = () => { el.classList.remove("active"); off(); };
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
}
hold($("touch-left"), () => { touch.left = true; }, () => { touch.left = false; });
hold($("touch-right"), () => { touch.right = true; }, () => { touch.right = false; });
hold($("touch-nuke"), () => { touch.nuke = true; }, () => {});
$("touch-pause").addEventListener("click", () => pause());
const aimPad = $("touch-aim");
aimPad.addEventListener("pointerdown", (ev) => {
  ev.preventDefault();
  unlock();
  touch.aimId = ev.pointerId;
  touch.fire = true;
  const p = canvasPoint(ev);
  touch.x = p.x; touch.y = p.y;
  aimPad.setPointerCapture?.(ev.pointerId);
});
aimPad.addEventListener("pointermove", (ev) => {
  if (ev.pointerId !== touch.aimId) return;
  const p = canvasPoint(ev);
  touch.x = p.x; touch.y = p.y;
});
const endAim = (ev) => { if (ev.pointerId === touch.aimId) { touch.aimId = null; touch.fire = false; } };
aimPad.addEventListener("pointerup", endAim);
aimPad.addEventListener("pointercancel", endAim);

// ------------------------------------------------------------------ layout

function layout() {
  const stage = $("stage");
  const r = stage.getBoundingClientRect();
  renderer.resize(r.width, r.height);
  post.sync();
  const hud = $("hud");
  hud.style.inset = "auto";
  hud.style.left = `${canvas.offsetLeft}px`;
  hud.style.top = `${canvas.offsetTop}px`;
  hud.style.width = `${canvas.offsetWidth}px`;
  hud.style.height = `${canvas.offsetHeight}px`;
  $("touch").hidden = !touchUI;
}
window.addEventListener("resize", layout);
new ResizeObserver(layout).observe($("stage"));

// ------------------------------------------------------------------ games

function makeAttract() {
  const g = createGame({ seed: (Math.random() * 1e9) | 0, difficulty: "easy", stage: (Math.random() * STAGES.length) | 0 });
  g.kit.gun = 3; g.kit.homing = 1; g.kit.laser = 1;
  g.lives = 99;
  g.botFn = createBot({ nukeAt: 0.4 });
  return g;
}

function newGame(stageIndex = 0) {
  const seed = params.has("seed") ? Number(params.get("seed")) | 0 : (Math.random() * 1e9) | 0;
  game = createGame({ seed, difficulty, mode, stage: stageIndex });
  renderer.clear();
  lastStatus = "";
  hudCache = {};
  window.__ha && (window.__ha.game = game);
}

function startPlay(stageIndex = 0) {
  unlock();
  sfx("click");
  newGame(stageIndex);
  screen = "play";
  closeModal();
  $("hud").hidden = false;
  bannerStage();
}

function pause() {
  if (screen !== "play") return;
  screen = "pause";
  showPause();
}
function resume() {
  screen = "play";
  closeModal();
  last = performance.now();
}

function toggleMute() {
  setMuted(!isMuted());
  save("muted", isMuted());
  toast(isMuted() ? "ĐÃ TẮT TIẾNG" : "ĐÃ BẬT TIẾNG");
  const b = document.querySelector("[data-act=mute]");
  if (b) b.textContent = isMuted() ? "🔇 Âm thanh" : "🔊 Âm thanh";
}

// ------------------------------------------------------------------ loop

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const g = screen === "title" ? attract : game;
  const running = screen === "title" || screen === "play";

  if (running && g) {
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 12) {
      const input = screen === "title" ? g.botFn(g) : autopilot ? autopilot(g) : playerInput();
      const ev = step(g, input);
      if (ev.length) {
        renderer.onEvents(ev, g);
        if (screen === "play") { playEvents(ev); onEvents(ev); }
        else attractEvents(g, ev);
      }
      acc -= DT;
      n++;
    }
    if (n >= 12) acc = 0;
  }
  if (g) {
    renderer.update(dt, g, running);
    renderer.render(g, { reticle: reticle() });
    post.frame();
  }
  if (screen === "play" || screen === "pause" || screen === "upgrade") updateHud();
  const musicMode = screen === "title" ? "menu" : screen === "play" ? (game?.boss ? "boss" : "battle") : "off";
  tickMusic(dt, musicMode);
  requestAnimationFrame(frame);
}

function attractEvents(g, ev) {
  for (const e of ev) {
    if (e.type === "upgrade") chooseUpgrade(g, g.offers[0]);
    if (e.type === "win" || e.type === "game-over") {
      attract = makeAttract();
      renderer.clear();
    }
  }
}

function onEvents(ev) {
  for (const e of ev) {
    switch (e.type) {
      case "stage-start": break;
      case "boss-start": bossWarning(e.name); break;
      case "nuke": post.flash("#fff7e0", 900, 0.9); break;
      case "tank-die": post.flash("#ff5a2a", 400, 0.45); toast(game.lives > 0 ? `MẤT XE! CÒN ${game.lives}` : ""); break;
      case "hurt": if (e.dmg > 12) post.flash("#ff2a1a", 160, 0.18); break;
      case "boss-dead": post.flash("#fff", 600, 0.7); setTimeout(() => banner($("stage"), "TIÊU DIỆT!", game ? stageLabel() : "", 2600), 300); break;
      case "part-die": post.flash("#ffd0a0", 120, 0.25); break;
      case "pickup": flashKit(e.item); break;
      case "supply-in": toast("TRỰC THĂNG TIẾP TẾ"); break;
      case "upgrade": screen = "upgrade"; setTimeout(showUpgrade, 200); break;
      case "win": setTimeout(() => showOver(true), 1400); screen = "over"; break;
      case "game-over": setTimeout(() => showOver(false), 300); screen = "over"; break;
    }
  }
}

function stageLabel() {
  return `MÀN ${game.stageIndex + 1}${game.loop ? ` · VÒNG ${game.loop + 1}` : ""} · ${game.stage.name}`;
}

function bannerStage() {
  setTimeout(() => {
    if (!game) return;
    banner($("stage"), game.stage.name, `MÀN ${game.stageIndex + 1}${game.loop ? ` · VÒNG ${game.loop + 1}` : ""}`, 2600);
  }, 150);
}

function bossWarning(name) {
  const stage = $("stage");
  const hud = $("hud");
  for (const pos of ["top", "bottom"]) {
    const el = document.createElement("div");
    el.className = "warning-bars";
    el.style[pos] = `${pos === "top" ? canvas.offsetTop : stage.clientHeight - canvas.offsetTop - canvas.offsetHeight}px`;
    el.style.left = `${canvas.offsetLeft}px`;
    el.style.right = "auto";
    el.style.width = `${canvas.offsetWidth}px`;
    stage.append(el);
    setTimeout(() => el.remove(), 3300);
  }
  banner(stage, name, "⚠ CẢNH BÁO · BOSS XUẤT HIỆN", 3000);
  hud.classList.add("boss");
}

let toastT = 0;
function toast(text) {
  const el = $("toast");
  if (!text) return;
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove("show"), 1600);
}

// ------------------------------------------------------------------ HUD

let hudCache = {};
function setText(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).textContent = v;
}
function setHtml(id, v) {
  if (hudCache[id] === v) return;
  hudCache[id] = v;
  $(id).innerHTML = v;
}

const KIT = [
  { id: "spread", key: "gun", max: MAX.gun },
  { id: "rapid", key: "rapid", max: MAX.rapid },
  { id: "homing", key: "homing", max: MAX.homing },
  { id: "laser", key: "laser", max: MAX.laser },
  { id: "flak", key: "flak", max: MAX.flak },
];

function updateHud() {
  const g = game;
  if (!g) return;
  setText("hud-score", fmt(g.score));
  const combo = g.combo >= 3 ? `COMBO ×${g.combo} · ${comboMultiplier(g.combo).toFixed(2)}` : "";
  if (hudCache.combo !== g.combo && g.combo >= 3) { const el = $("hud-combo"); el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump"); }
  hudCache.combo = g.combo;
  setText("hud-combo", combo);
  setText("hud-stage", `MÀN ${g.stageIndex + 1} · ${g.stage.name.toUpperCase()}`);
  const prog = Math.round(stageProgress(g) * 100);
  if (hudCache.prog !== prog) { hudCache.prog = prog; $("hud-progress").style.width = `${prog}%`; }
  const totalLives = DIFFICULTIES[g.difficulty].lives;
  setHtml("hud-lives", Array.from({ length: Math.max(totalLives, g.lives) }, (_, i) => `<i class="life-ico${i < g.lives ? "" : " lost"}"></i>`).join(""));
  setHtml("hud-nukes", Array.from({ length: Math.max(3, g.tank.nukes) }, (_, i) => `<i class="nuke-ico${i < g.tank.nukes ? "" : " empty"}">☢</i>`).join(""));
  setHtml("hud-shield", Array.from({ length: g.tank.shield }, () => `<i class="shield-ico"></i>`).join(""));
  const armor = Math.max(0, g.tank.armor / g.tank.maxArmor);
  const ap = Math.round(armor * 200) / 2;
  if (hudCache.armor !== ap) {
    hudCache.armor = ap;
    $("hud-armor").style.width = `${ap}%`;
    const bar = $("hud-armor").parentElement;
    bar.classList.toggle("warn", armor < 0.55 && armor >= 0.3);
    bar.classList.toggle("crit", armor < 0.3);
  }
  const kitKey = KIT.map((k) => g.kit[k.key]).join();
  if (hudCache.kit !== kitKey) {
    hudCache.kit = kitKey;
    $("hud-kit").innerHTML = KIT.map((k) => {
      const lv = g.kit[k.key];
      const u = UPGRADES[k.id];
      const pips = Array.from({ length: k.max }, (_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
      return `<div class="kit${lv ? "" : " off"}" data-kit="${k.id}" style="--c:${u.color}" title="${esc(u.label)}"><b>${u.short}</b><div class="pips">${pips}</div></div>`;
    }).join("");
  }
  const b = g.boss;
  const bossEl = $("hud-boss");
  if (b && !b.entering) {
    bossEl.hidden = false;
    setText("hud-boss-name", b.def.name.toUpperCase());
    const f = b.hp / b.maxHp;
    setText("hud-boss-hp", `${Math.ceil(f * 100)}%`);
    const pct = `${(f * 100).toFixed(1)}%`;
    if (hudCache.bossPct !== pct) {
      hudCache.bossPct = pct;
      $("hud-boss-fill").style.width = pct;
      $("hud-boss-lag").style.width = pct;
    }
    const armored = b.parts.some((p) => p.alive && p.guard);
    bossEl.querySelector(".hud-boss-bar").classList.toggle("armored", armored);
    setHtml("hud-boss-parts", b.parts.map((p) => `<span class="part-pip${p.alive ? "" : " dead"}">${esc(p.label)}</span>`).join("") + (armored ? `<span class="part-pip">🛡 GIÁP</span>` : ""));
  } else {
    bossEl.hidden = true;
  }
}

function flashKit(id) {
  const key = id === "spread" ? "spread" : id;
  requestAnimationFrame(() => {
    const el = document.querySelector(`.kit[data-kit="${key}"]`);
    if (el) { el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash"); }
  });
}

// ------------------------------------------------------------------ modals

const modal = $("modal");
const body = $("modal-body");

function openModal(html, { title = false, fx = {} } = {}) {
  body.innerHTML = html;
  modal.classList.toggle("title-mode", title);
  modal.hidden = false;
  body.classList.remove("fx-panel");
  void body.offsetWidth;
  body.classList.add("fx-panel");
  enhance(body, { cards: ".offer", primary: ".fx-go", ghost: "button:not(.fx-go):not(.offer):not(.seg button)", ...fx });
  body.querySelectorAll("button").forEach((b) => b.addEventListener("pointerenter", () => sfx("hover")));
  const first = body.querySelector(".fx-go, .offer, button");
  first?.focus({ preventScroll: true });
}
function closeModal() { modal.hidden = true; }

body.addEventListener("click", (ev) => {
  const b = ev.target.closest("button");
  if (!b) return;
  unlock();
  const act = b.dataset.act;
  if (!act) return;
  sfx("click");
  switch (act) {
    case "campaign": mode = "campaign"; startPlay(0); break;
    case "endless": mode = "endless"; startPlay(0); break;
    case "diff": difficulty = b.dataset.v; save("difficulty", difficulty); body.querySelectorAll(".seg button").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); break;
    case "howto": showHowto(); break;
    case "scores": showScores(); break;
    case "title": showTitle(); break;
    case "mute": toggleMute(); break;
    case "resume": resume(); break;
    case "restart": startPlay(0); break;
    case "quit": showTitle(); break;
    case "offer": takeOffer(b.dataset.v); break;
    case "skip": takeOffer(null); break;
    case "save": saveScore(); break;
  }
});

function showTitle() {
  screen = "title";
  game = null;
  $("hud").hidden = true;
  renderer.clear();
  attract = makeAttract();
  const diffBtns = Object.entries(DIFFICULTIES).map(([k, d]) => `<button data-act="diff" data-v="${k}" aria-pressed="${k === difficulty}">${d.label}</button>`).join("");
  openModal(`
    <p class="eyebrow">Chiến Dịch Phản Công</p>
    <h1>Thép <span>Lửa</span></h1>
    <div class="sub">HEAVY ARMOR</div>
    <p class="lead">Một chiếc xe tăng, cả bầu trời đầy máy bay địch. Lái qua đồng lúa, đồi cát, vịnh đá và thành phố đêm — bắn hạ phi đội Quạ Sắt và bốn pháo đài bay khổng lồ.</p>
    <div class="seg-label">ĐỘ KHÓ</div>
    <div class="seg" role="group" aria-label="Độ khó">${diffBtns}</div>
    <div class="stack">
      <button class="fx-go big" data-act="campaign">▶ Chiến Dịch</button>
      <button data-act="endless">∞ Sinh Tồn — chơi vòng lặp, địch mạnh dần</button>
      <div class="mini">
        <button data-act="howto">Hướng dẫn</button>
        <button data-act="scores">Bảng điểm</button>
        <button data-act="mute">${isMuted() ? "🔇" : "🔊"} Âm thanh</button>
      </div>
    </div>
    <div class="title-foot">Vẽ hoàn toàn bằng code · không ảnh · không file âm thanh</div>
  `, { title: true, fx: { tagline: ".eyebrow" } });
}

function showHowto() {
  const items = Object.entries(UPGRADES).map(([, u]) => `<div class="item" style="--c:${u.color}"><b>${u.short}</b><span><strong>${esc(u.label)}</strong> — ${esc(u.desc)}</span></div>`).join("");
  openModal(`
    <h2>Hướng dẫn</h2>
    <div class="howto">
      <div class="k"><kbd>A</kbd><kbd>D</kbd></div><div>Lái xe tăng sang trái / phải</div>
      <div class="k"><b>Chuột</b></div><div>Ngắm nòng pháo · giữ chuột trái để bắn · chuột phải: bom hạt nhân</div>
      <div class="k"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd></div><div>Xoay nòng bằng bàn phím · <kbd>Space</kbd> bắn</div>
      <div class="k"><kbd>X</kbd></div><div>Bom hạt nhân: xóa sạch bầu trời, gây sát thương lớn lên boss</div>
      <div class="k"><kbd>P</kbd><kbd>M</kbd></div><div>Tạm dừng · bật/tắt âm thanh</div>
    </div>
    <p>Bắn hạ bom và tên lửa trước khi chúng chạm đất. Lính dù đáp xuống sẽ bắn vào xe — cán qua chúng! Trực thăng tiếp tế thả thùng hàng: lái tới để nhặt.</p>
    <div class="items">${items}</div>
    <p>Boss có các bộ phận bảo vệ: khi còn tháp pháo, thân boss được bọc giáp và chỉ nhận 35% sát thương. Phá bộ phận trước!</p>
    <div class="row"><button class="fx-go" data-act="title">Đã hiểu</button></div>
  `);
}

function scoresTable(highlight = -1) {
  return `<table class="scores">${scores.map((s, i) => `<tr class="${i === highlight ? "me" : ""}"><td>${i + 1}</td><td>${esc(s.name)}</td><td>${esc(stageById(s.stage)?.name ?? "")}</td><td>${fmt(s.score)}</td></tr>`).join("")}</table>`;
}

function showScores() {
  openModal(`<h2>Bảng điểm</h2>${scoresTable()}<div class="row"><button class="fx-go" data-act="title">Quay lại</button></div>`);
}

function showPause() {
  openModal(`
    <h2>Tạm dừng</h2>
    <p>${esc(stageLabel())} · ${fmt(game.score)} điểm</p>
    <div class="stack">
      <button class="fx-go" data-act="resume">▶ Tiếp tục</button>
      <button data-act="restart">↻ Chơi lại từ đầu</button>
      <div class="mini"><button data-act="mute">${isMuted() ? "🔇" : "🔊"} Âm thanh</button><button data-act="quit">Về màn hình chính</button></div>
    </div>
  `);
}

function showUpgrade() {
  const g = game;
  const r = g.stageRanks[g.stageRanks.length - 1];
  const lvl = (id) => {
    const map = { spread: ["gun", MAX.gun], rapid: ["rapid", MAX.rapid], homing: ["homing", MAX.homing], laser: ["laser", MAX.laser], flak: ["flak", MAX.flak], shield: null, nuke: null };
    const m = map[id];
    if (m) return `CẤP ${g.kit[m[0]]} → ${g.kit[m[0]] + 1}`;
    if (id === "shield") return `${g.tank.shield} → ${g.tank.shield + 1} KHIÊN`;
    if (id === "nuke") return `${g.tank.nukes} → ${g.tank.nukes + 1} BOM`;
    if (id === "armor") return `${g.tank.maxArmor} → ${g.tank.maxArmor + 25} GIÁP`;
    return "";
  };
  const offers = g.offers.map((id) => {
    const u = UPGRADES[id];
    return `<button class="offer" data-act="offer" data-v="${id}" style="--c:${u.color}"><span class="ico">${u.short}</span><strong>${esc(u.label)}</strong><span class="lv">${lvl(id)}</span><small>${esc(u.desc)}</small></button>`;
  }).join("");
  openModal(`
    <p class="eyebrow">Hoàn thành · ${esc(g.stage.name)}</p>
    <div class="rank">${r.rank}</div>
    <div class="stats">
      <div class="stat"><b>${r.kills}</b><span>HẠ GỤC</span></div>
      <div class="stat"><b>${r.damage}</b><span>GIÁP MẤT</span></div>
      <div class="stat"><b>+${fmt(r.bonus)}</b><span>THƯỞNG</span></div>
    </div>
    <h2>Xưởng Sửa Chữa</h2>
    <p>Chọn một nâng cấp trước khi vào màn tiếp theo. Giáp được hồi 35%.</p>
    <div class="offers">${offers}</div>
  `, { fx: { tagline: ".eyebrow" } });
}

function takeOffer(id) {
  if (!game || game.status !== "upgrade") return;
  chooseUpgrade(game, id);
  if (id) sfx("pickup");
  screen = "play";
  closeModal();
  last = performance.now();
  bannerStage();
}

let pendingScore = null;
function showOver(won) {
  const g = game;
  const ok = qualifies(scores, g.score);
  pendingScore = ok ? { score: g.score, stage: g.stage.id } : null;
  const ranks = g.stageRanks.map((r) => r.rank).join(" · ") || "—";
  openModal(`
    <p class="eyebrow">${won ? "Chiến dịch hoàn thành" : "Xe tăng bị phá hủy"}</p>
    <h2>${won ? "CHIẾN THẮNG!" : "HẾT XE TĂNG"}</h2>
    <div class="stats">
      <div class="stat"><b>${fmt(g.score)}</b><span>ĐIỂM</span></div>
      <div class="stat"><b>${g.kills}</b><span>HẠ GỤC</span></div>
      <div class="stat"><b>${g.bestCombo}</b><span>COMBO</span></div>
    </div>
    <p>Xếp hạng từng màn: <b>${esc(ranks)}</b></p>
    ${ok ? `<p>Điểm vào bảng xếp hạng! Nhập 3 chữ cái:</p><div class="initials"><input id="initials" maxlength="3" autocomplete="off" value="${esc(load("initials", ""))}" aria-label="Tên viết tắt"><button class="fx-go" data-act="save">Lưu</button></div>` : scoresTable()}
    <div class="row"><button class="${ok ? "" : "fx-go"}" data-act="restart">↻ Chơi lại</button><button data-act="title">Màn hình chính</button></div>
  `, { fx: { tagline: ".eyebrow" } });
  if (ok) {
    const input = $("initials");
    input.focus();
    input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") saveScore(); });
  }
}

function saveScore() {
  if (!pendingScore) return;
  const name = cleanInitials($("initials")?.value);
  save("initials", name);
  const res = insertScore(scores, name, pendingScore.score, pendingScore.stage);
  scores = res.scores;
  save("scores", scores);
  pendingScore = null;
  openModal(`<h2>Bảng điểm</h2>${scoresTable(res.place)}<div class="row"><button class="fx-go" data-act="restart">↻ Chơi lại</button><button data-act="title">Màn hình chính</button></div>`);
}

// ------------------------------------------------------------------ boot

layout();
for (const s of STAGES) renderer.prewarm(s.id);
if (params.has("debug")) {
  window.__ha = {
    get game() { return game; },
    set game(v) { game = v; },
    get attract() { return attract; },
    start: (i = 0) => startPlay(i),
    clear: () => game && debugClear(game),
    autopilot: (on = true) => { autopilot = on ? createBot() : null; },
    step: (n = 1, input = {}) => { for (let i = 0; i < n; i++) renderer.onEvents(step(game, input), game); },
  };
}
const play = params.get("play");
if (play && stageById(play)) startPlay(STAGES.indexOf(stageById(play)));
else showTitle();
requestAnimationFrame((t) => { last = t; frame(t); });
