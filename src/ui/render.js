// Frame composition: parallax backdrop, entities, particles, falling wrecks, lighting and screen
// shake. The renderer reads game state and turns events into effects; it never changes rules.

import { GROUND_Y, FIELD_H as H, FIELD_W as W } from "../core/stages.js";
import { TANK } from "../core/game.js";
import { UPGRADES } from "../core/weapons.js";
import {
  LAYER_TILE, buildBackdrop, drawBoss, drawCrate, drawEnemy, drawHostile, drawShot, drawSupply,
  drawTank, drawTroop,
} from "./art.js";

const TAU = Math.PI * 2;
const MAX_PARTS = 1400;

export function createRenderer(canvas) {
  const ctx = canvas.getContext("2d");
  const backdrops = new Map();
  let scale = 1;
  let dpr = 1;
  let reduced = false;

  const parts = [];      // fire, smoke, spark, debris, ring, flash, dust
  const decals = [];     // ground scorch marks
  const wrecks = [];     // falling aircraft
  const floaters = [];   // score popups
  const lights = [];     // short-lived light sources that tint the ground
  let shake = 0;
  let shakeX = 0;
  let shakeY = 0;
  let scroll = 0;
  let roll = 0;
  let time = 0;
  let nukeT = 0;
  let nukeX = 0;
  let muzzle = 0;
  let muzzleLaser = 0;
  let bossShadow = 0;

  function backdrop(id) {
    if (!backdrops.has(id)) backdrops.set(id, buildBackdrop(id, W, H, GROUND_Y));
    return backdrops.get(id);
  }

  function resize(cssW, cssH) {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const s = Math.min(cssW / W, cssH / H);
    const w = Math.floor(W * s);
    const h = Math.floor(H * s);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    scale = (w * dpr) / W;
  }

  // ---------------------------------------------------------------- particle helpers

  function add(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  function explode(x, y, size = 1, opts = {}) {
    const n = reduced ? 0.4 : 1;
    add({ k: "flash", x, y, r: 60 * size, life: 0.18, t: 0 });
    lights.push({ x, y, r: 160 * size, life: 0.35, t: 0, c: "255,170,80" });
    add({ k: "ring", x, y, r: 6, grow: 260 * size, life: 0.45, t: 0, w: 3 * size });
    for (let i = 0; i < 12 * size * n; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(30, 150) * size;
      add({ k: "fire", x: x + rnd(-6, 6) * size, y: y + rnd(-6, 6) * size, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, r: rnd(8, 18) * size, life: rnd(0.35, 0.7), t: 0 });
    }
    for (let i = 0; i < 9 * size * n; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(10, 60) * size;
      add({ k: "smoke", x: x + rnd(-10, 10) * size, y: y + rnd(-10, 10) * size, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 25, r: rnd(10, 20) * size, life: rnd(1.2, 2.4), t: 0, dark: opts.dark ?? 0.25 });
    }
    for (let i = 0; i < 16 * size * n; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(160, 520) * Math.sqrt(size);
      add({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.25, 0.6), t: 0, g: 400 });
    }
    if (opts.debris !== false) {
      for (let i = 0; i < 7 * size * n; i++) {
        const a = -Math.PI * rnd(0.1, 0.9);
        const sp = rnd(120, 340) * Math.sqrt(size);
        add({ k: "debris", x, y, vx: Math.cos(a) * sp + rnd(-60, 60), vy: Math.sin(a) * sp, rot: rnd(0, TAU), vr: rnd(-14, 14), s: rnd(2, 5) * Math.sqrt(size), life: rnd(1.4, 2.4), t: 0, c: opts.color ?? "#3a3f47", trail: Math.random() < 0.4 });
      }
    }
    shake = Math.min(18, shake + 5 * size);
  }

  function groundBlast(x, size = 1) {
    explode(x, GROUND_Y - 6, size, { color: "#4a3a2a" });
    for (let i = 0; i < 10 * size; i++) {
      add({ k: "dust", x: x + rnd(-20, 20), y: GROUND_Y - 2, vx: rnd(-140, 140), vy: rnd(-60, -10), r: rnd(6, 14) * size, life: rnd(0.7, 1.4), t: 0 });
    }
    // dirt fountain
    for (let i = 0; i < 12 * size; i++) {
      add({ k: "debris", x, y: GROUND_Y - 4, vx: rnd(-120, 120), vy: rnd(-380, -160), rot: 0, vr: rnd(-10, 10), s: rnd(1.5, 3.5), life: rnd(0.8, 1.4), t: 0, c: "#5a4430" });
    }
    decals.push({ x: x + scrollGround(), r: 30 * size, life: 14, t: 0 });
    if (decals.length > 40) decals.shift();
  }

  function scrollGround() {
    return scroll * 60;
  }

  function sparks(x, y, color = "255,220,140", n = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = rnd(80, 260);
      add({ k: "spark", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.12, 0.3), t: 0, g: 200, c: color });
    }
  }

  function floater(x, y, text, color = "#ffe9a8", big = false) {
    floaters.push({ x, y, text, color, life: big ? 1.6 : 1, t: 0, big });
    if (floaters.length > 40) floaters.shift();
  }

  // ---------------------------------------------------------------- events

  function onEvents(events, g) {
    for (const e of events) {
      switch (e.type) {
        case "fire": muzzle = 1; break;
        case "laser": muzzleLaser = 1; break;
        case "flak-fire": add({ k: "flash", x: e.x, y: e.y, r: 18, life: 0.08, t: 0, c: "170,255,100" }); break;
        case "missile-fire":
          for (let i = 0; i < 3; i++) add({ k: "smoke", x: e.x + rnd(-24, 24), y: e.y, vx: rnd(-20, 20), vy: rnd(-10, 10), r: rnd(5, 9), life: 0.8, t: 0, dark: 0 });
          break;
        case "spark":
          if (e.kind === "laser") sparks(e.x, e.y, "255,120,230", 5);
          else if (e.armored) sparks(e.x, e.y, "160,200,255", 3);
          else sparks(e.x, e.y, e.metal ? "255,230,170" : "255,200,120", 3);
          break;
        case "kill": {
          const big = e.big ? 1.6 : 1;
          explode(e.x, e.y, big * 0.9);
          if (e.how !== "nuke" || e.big) {
            wrecks.push({ kind: e.kind, x: e.x, y: e.y, vx: (e.vx || 0) * 0.6, vy: Math.min(60, (e.vy || 0)) - 40, dir: e.dir || 1, rot: 0, vr: (e.dir || 1) * rnd(0.6, 1.6), t: 0, id: Math.random() * 99, big: e.big });
          }
          break;
        }
        case "pop":
          add({ k: "flash", x: e.x, y: e.y, r: 26, life: 0.12, t: 0 });
          add({ k: "ring", x: e.x, y: e.y, r: 4, grow: 120, life: 0.25, t: 0, w: 2 });
          sparks(e.x, e.y, "255,200,120", 6);
          for (let i = 0; i < 3; i++) add({ k: "smoke", x: e.x, y: e.y, vx: rnd(-30, 30), vy: rnd(-30, 0), r: rnd(6, 10), life: 0.9, t: 0, dark: 0.3 });
          break;
        case "flak":
          add({ k: "flash", x: e.x, y: e.y, r: e.r * 1.3, life: 0.16, t: 0, c: "190,255,130" });
          add({ k: "ring", x: e.x, y: e.y, r: 6, grow: e.r * 3.5, life: 0.3, t: 0, w: 2.5, c: "190,255,140" });
          for (let i = 0; i < 10; i++) {
            const a = Math.random() * TAU;
            add({ k: "spark", x: e.x, y: e.y, vx: Math.cos(a) * rnd(100, 300), vy: Math.sin(a) * rnd(100, 300), life: 0.3, t: 0, g: 100, c: "210,255,150" });
          }
          for (let i = 0; i < 4; i++) add({ k: "smoke", x: e.x + rnd(-10, 10), y: e.y + rnd(-10, 10), vx: 0, vy: -10, r: rnd(8, 14), life: 1.1, t: 0, dark: 0.55 });
          break;
        case "blast": explode(e.x, e.y, 0.8 * (e.size || 1)); break;
        case "ground-hit": groundBlast(e.x, e.size || 1); break;
        case "dust":
          for (let i = 0; i < 3; i++) add({ k: "dust", x: e.x, y: GROUND_Y - 2, vx: rnd(-40, 40), vy: rnd(-40, -10), r: rnd(3, 6), life: 0.5, t: 0 });
          break;
        case "hurt": shake = Math.min(18, shake + 6); sparks(e.x, e.y, "255,160,80", 8); break;
        case "shield-hit":
          add({ k: "ring", x: g.tank.x, y: GROUND_Y - 22, r: 30, grow: 120, life: 0.35, t: 0, w: 3, c: "150,250,255" });
          sparks(e.x, e.y, "150,250,255", 10);
          break;
        case "tank-die":
          explode(e.x, e.y, 2.4, { color: "#4c5630" });
          groundBlast(e.x, 1.5);
          shake = 24;
          break;
        case "respawn":
          add({ k: "ring", x: e.x, y: GROUND_Y - 20, r: 10, grow: 300, life: 0.6, t: 0, w: 3, c: "255,200,120" });
          break;
        case "troop-die":
          if (e.how === "flee") break;
          if (e.how === "squash") {
            for (let i = 0; i < 6; i++) add({ k: "dust", x: e.x, y: GROUND_Y - 2, vx: rnd(-80, 80), vy: rnd(-60, -10), r: rnd(4, 8), life: 0.6, t: 0 });
            floater(e.x, GROUND_Y - 40, "BẸP!", "#ffcf4a");
          } else {
            add({ k: "flash", x: e.x, y: e.y - 10, r: 18, life: 0.1, t: 0 });
            sparks(e.x, e.y - 10, "255,200,140", 5);
            add({ k: "smoke", x: e.x, y: e.y - 10, vx: 0, vy: -20, r: 8, life: 0.8, t: 0, dark: 0.3 });
          }
          break;
        case "part-die":
          explode(e.x, e.y, 1.5);
          floater(e.x, e.y - 20, e.label.toUpperCase(), "#ffb35c", true);
          break;
        case "boss-boom": explode(e.x, e.y, rnd(1, 1.8)); break;
        case "boss-dead":
          for (let i = 0; i < 6; i++) explode(e.x + rnd(-140, 140), e.y + rnd(-40, 40), 2);
          lights.push({ x: e.x, y: e.y, r: 700, life: 1.2, t: 0, c: "255,220,160" });
          shake = 30;
          break;
        case "nuke":
          nukeT = 1.6;
          nukeX = e.x;
          shake = 30;
          lights.push({ x: W / 2, y: 200, r: 1200, life: 1.4, t: 0, c: "255,250,230" });
          break;
        case "score":
          if (e.pts >= 100) floater(e.x, e.y - 12, `+${e.pts}`, e.pts >= 2000 ? "#ffd84a" : "#fff3d0", e.pts >= 2000);
          break;
        case "pickup": {
          const info = UPGRADES[e.item];
          floater(e.x, e.y - 30, info.label.toUpperCase(), info.color, true);
          add({ k: "ring", x: e.x, y: e.y, r: 10, grow: 200, life: 0.45, t: 0, w: 3, c: hexRgb(info.color) });
          for (let i = 0; i < 18; i++) {
            const a = (i / 18) * TAU;
            add({ k: "spark", x: e.x, y: e.y, vx: Math.cos(a) * 200, vy: Math.sin(a) * 200, life: 0.5, t: 0, g: 0, c: hexRgb(info.color) });
          }
          break;
        }
        case "crate-land":
          for (let i = 0; i < 5; i++) add({ k: "dust", x: e.x, y: GROUND_Y - 2, vx: rnd(-50, 50), vy: rnd(-30, -5), r: rnd(4, 7), life: 0.6, t: 0 });
          break;
        case "rifle": add({ k: "flash", x: e.x + 8, y: e.y, r: 8, life: 0.05, t: 0 }); break;
        case "boss-fire": add({ k: "flash", x: e.x, y: e.y, r: 22, life: 0.08, t: 0, c: "255,120,80" }); break;
      }
    }
  }

  // ---------------------------------------------------------------- update

  function update(dt, g, playing) {
    time += dt;
    if (playing) scroll += dt;
    if (g && playing) roll += (60 + g.tank.vx) * dt * 1.0;
    shake *= Math.pow(0.02, dt);
    if (reduced) shake = 0;
    shakeX = (Math.random() * 2 - 1) * shake;
    shakeY = (Math.random() * 2 - 1) * shake;
    muzzle = Math.max(0, muzzle - dt * 14);
    muzzleLaser = Math.max(0, muzzleLaser - dt * 8);
    if (nukeT > 0) nukeT -= dt;

    for (const p of parts) {
      p.t += dt;
      if (p.k === "fire") { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy = p.vy * 0.9 - 30 * dt; }
      else if (p.k === "smoke") { p.x += p.vx * dt - 12 * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy = p.vy * 0.97 - 8 * dt; p.r += 14 * dt; }
      else if (p.k === "spark") { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g ?? 300) * dt; p.vx *= 0.97; }
      else if (p.k === "dust") { p.x += p.vx * dt - 30 * dt; p.y += p.vy * dt; p.vx *= 0.93; p.vy *= 0.93; p.r += 10 * dt; }
      else if (p.k === "debris") {
        p.vy += 700 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.y > GROUND_Y + 2) { p.y = GROUND_Y + 2; p.vy *= -0.35; p.vx *= 0.6; p.vr *= 0.5; }
        if (p.trail && Math.random() < 0.4) add({ k: "smoke", x: p.x, y: p.y, vx: 0, vy: -5, r: 3, life: 0.6, t: 0, dark: 0.4 });
      } else if (p.k === "ring") { p.r += p.grow * dt * (1 - p.t / p.life); }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].life) parts.splice(i, 1);

    for (const w of wrecks) {
      w.t += dt;
      w.vy += 360 * dt;
      w.x += w.vx * dt;
      w.y += w.vy * dt;
      w.rot += w.vr * dt * (w.kind === "blimp" ? 0.15 : 0.6);
      if (Math.random() < 0.8) add({ k: "smoke", x: w.x, y: w.y, vx: rnd(-10, 10), vy: -10, r: rnd(6, 12) * (w.big ? 1.6 : 1), life: rnd(1, 1.8), t: 0, dark: 0.6 });
      if (Math.random() < 0.6) add({ k: "fire", x: w.x + rnd(-6, 6), y: w.y, vx: 0, vy: -20, r: rnd(5, 10) * (w.big ? 1.6 : 1), life: 0.3, t: 0 });
      if (w.y > GROUND_Y - 8) { w.done = true; groundBlast(w.x, w.big ? 1.8 : 1.1); }
    }
    for (let i = wrecks.length - 1; i >= 0; i--) if (wrecks[i].done || wrecks[i].x < -200 || wrecks[i].x > W + 200) wrecks.splice(i, 1);

    for (const f of floaters) { f.t += dt; f.y -= (f.big ? 26 : 40) * dt; }
    for (let i = floaters.length - 1; i >= 0; i--) if (floaters[i].t >= floaters[i].life) floaters.splice(i, 1);
    for (const l of lights) l.t += dt;
    for (let i = lights.length - 1; i >= 0; i--) if (lights[i].t >= lights[i].life) lights.splice(i, 1);
    for (const d of decals) d.t += dt;
    for (let i = decals.length - 1; i >= 0; i--) if (decals[i].t >= decals[i].life) decals.splice(i, 1);
  }

  // ---------------------------------------------------------------- draw

  function drawLayer(layer, offsetX) {
    const c = layer.canvas;
    let x = -((offsetX % LAYER_TILE) + LAYER_TILE) % LAYER_TILE;
    while (x < W) {
      ctx.drawImage(c, x, layer.y);
      x += LAYER_TILE;
    }
  }

  function render(g, view = {}) {
    const bd = backdrop(g.stage.id);
    const th = bd.theme;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // ---- sky and parallax
    ctx.drawImage(bd.sky, -20, -20, W + 40, H + 40);
    const tx = g.tank.x - W / 2;
    for (const layer of bd.layers) drawLayer(layer, scroll * layer.speed + tx * layer.parallax);
    // city searchlights between layers
    if (th.night) searchlights();
    // boss shadow on the ground
    ctx.save();
    drawLayer(bd.ground, scroll * bd.ground.speed);
    ctx.restore();
    // scorch decals scroll with the ground
    for (const d of decals) {
      const x = d.x - scrollGround();
      const a = Math.min(1, (d.life - d.t) / 3) * 0.55;
      const gr = ctx.createRadialGradient(x, GROUND_Y + 4, 2, x, GROUND_Y + 4, d.r);
      gr.addColorStop(0, `rgba(10,6,4,${a})`);
      gr.addColorStop(1, "rgba(10,6,4,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.ellipse(x, GROUND_Y + 4, d.r, d.r * 0.25, 0, 0, TAU);
      ctx.fill();
      if (d.t < 3) {
        ctx.fillStyle = `rgba(255,120,40,${0.4 * (1 - d.t / 3)})`;
        ctx.beginPath(); ctx.ellipse(x, GROUND_Y + 3, d.r * 0.4, d.r * 0.08, 0, 0, TAU); ctx.fill();
      }
    }
    if (g.boss) {
      const b = g.boss;
      const a = Math.max(0, Math.min(0.35, (b.y + 100) / 600));
      const gr = ctx.createRadialGradient(b.x, GROUND_Y + 6, 10, b.x, GROUND_Y + 6, b.def.w * 0.55);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.ellipse(b.x, GROUND_Y + 6, b.def.w * 0.55, 14, 0, 0, TAU); ctx.fill();
    }

    // ---- entities behind
    if (g.supply) drawSupply(ctx, g.supply, time);
    if (g.boss) {
      for (const p of g.boss.parts) p.aim = Math.atan2(GROUND_Y - 30 - (g.boss.y + p.dy), g.tank.x - (g.boss.x + p.dx));
      drawBoss(ctx, g.boss, time);
    }
    for (const e of g.enemies) {
      if (e.hit > 0) ctx.filter = "brightness(2.6)";
      drawEnemy(ctx, e, time);
      ctx.filter = "none";
      if (e.hp < e.maxHp * 0.5 && Math.random() < 0.3) add({ k: "smoke", x: e.x - (e.dir || 1) * 10, y: e.y, vx: 0, vy: -6, r: 5, life: 0.8, t: 0, dark: 0.5 });
    }
    for (const w of wrecks) {
      ctx.save();
      ctx.filter = "brightness(0.55) sepia(0.4)";
      drawEnemy(ctx, { ...w, vx: 0, vy: 0, rot: w.rot, hit: 0 }, time);
      ctx.restore();
    }
    for (const c of g.crates) drawCrate(ctx, c, time, UPGRADES[c.type]);
    for (const tr of g.troops) drawTroop(ctx, tr, time);

    // ---- the tank
    const t = g.tank;
    if (!t.dead) {
      const blink = t.iframes > 0.3 && Math.floor(time * 20) % 2 === 0;
      if (!blink) {
        drawTank(ctx, { x: t.x, ground: GROUND_Y, aim: t.aim, recoil: t.recoil, vx: t.vx, roll, kit: g.kit, shield: t.shield, t: time });
      }
      // exhaust
      if (Math.random() < 0.3 + Math.abs(t.vx) / 600) add({ k: "smoke", x: t.x - 44, y: GROUND_Y - 40, vx: -20, vy: -30, r: 3, life: 0.9, t: 0, dark: 0.45 });
      if (Math.abs(t.vx) > 40 && Math.random() < 0.5) add({ k: "dust", x: t.x - Math.sign(t.vx) * 42, y: GROUND_Y - 2, vx: -t.vx * 0.3, vy: -20, r: 4, life: 0.5, t: 0 });
      // muzzle flash
      const px = t.x + Math.cos(t.aim) * (TANK.barrel + 4);
      const py = TANK.pivotY + Math.sin(t.aim) * (TANK.barrel + 4);
      if (muzzle > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.translate(px, py);
        ctx.rotate(t.aim);
        const m = muzzle;
        const gr = ctx.createRadialGradient(4, 0, 0, 4, 0, 22 * m);
        gr.addColorStop(0, "rgba(255,255,230,1)");
        gr.addColorStop(0.4, "rgba(255,190,80,.8)");
        gr.addColorStop(1, "rgba(255,90,20,0)");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.ellipse(8, 0, 22 * m, 9 * m, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      if (muzzleLaser > 0) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const gr = ctx.createRadialGradient(px, py, 0, px, py, 30);
        gr.addColorStop(0, `rgba(255,140,240,${muzzleLaser})`);
        gr.addColorStop(1, "rgba(255,60,200,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(px - 30, py - 30, 60, 60);
        ctx.restore();
      }
      // night headlight cone
      if (th.night) {
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        const hx = t.x + 47;
        const gr = ctx.createLinearGradient(hx, 0, hx + 220, 0);
        gr.addColorStop(0, "rgba(255,240,190,.25)");
        gr.addColorStop(1, "rgba(255,240,190,0)");
        ctx.fillStyle = gr;
        ctx.beginPath(); ctx.moveTo(hx, GROUND_Y - 26); ctx.lineTo(hx + 220, GROUND_Y - 50); ctx.lineTo(hx + 220, GROUND_Y + 10); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }

    // ---- shots and projectiles
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of g.shots) if (s.kind !== "missile") drawShot(ctx, s, time);
    ctx.restore();
    for (const s of g.shots) if (s.kind === "missile") drawShot(ctx, s, time);
    for (const h of g.hostile) drawHostile(ctx, h, time);

    // ---- particles
    drawParticles();

    // ---- ground light from explosions
    if (lights.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const l of lights) {
        const a = (1 - l.t / l.life) * 0.5;
        const gr = ctx.createRadialGradient(l.x, Math.min(GROUND_Y, l.y), 0, l.x, Math.min(GROUND_Y, l.y), l.r);
        gr.addColorStop(0, `rgba(${l.c},${a})`);
        gr.addColorStop(1, `rgba(${l.c},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
      }
      ctx.restore();
    }

    // ---- aim reticle
    if (view.reticle && !t.dead) {
      const { x, y } = view.reticle;
      ctx.save();
      ctx.strokeStyle = "rgba(255,240,200,.85)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 11, 0, TAU); ctx.stroke();
      ctx.rotate(0);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + time * 1.5;
        ctx.beginPath();
        ctx.moveTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14);
        ctx.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 20);
        ctx.stroke();
      }
      ctx.fillStyle = "#ff7a2a";
      ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
      ctx.restore();
    }

    // ---- floaters
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const f of floaters) {
      const a = Math.min(1, (f.life - f.t) * 3);
      const s = f.big ? 1 + Math.max(0, 0.4 - f.t) : 1;
      ctx.globalAlpha = a;
      ctx.font = `900 ${f.big ? 18 * s : 13}px "Segoe UI", system-ui, sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,.6)";
      const half = ctx.measureText(f.text).width / 2 + 6;
      const fx = Math.max(half, Math.min(W - half, f.x));
      ctx.strokeText(f.text, fx, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, f.y);
    }
    ctx.globalAlpha = 1;

    // ---- colour grade / atmosphere
    ctx.fillStyle = th.light;
    ctx.fillRect(-20, -20, W + 40, H + 40);
    if (g.tank.armor < g.tank.maxArmor * 0.3 && !g.tank.dead) {
      const a = 0.25 + 0.15 * Math.sin(time * 8);
      const gr = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.7);
      gr.addColorStop(0, "rgba(255,0,0,0)");
      gr.addColorStop(1, `rgba(200,20,20,${a})`);
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();

    // ---- nuke whiteout (not shaken)
    if (nukeT > 0) {
      const k = nukeT / 1.6;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const r = (1 - k) * 1400;
      const gr = ctx.createRadialGradient(nukeX, GROUND_Y - 200, r * 0.6, nukeX, GROUND_Y - 200, r);
      gr.addColorStop(0, `rgba(255,250,230,${k * 0.6})`);
      gr.addColorStop(0.9, `rgba(255,200,120,${k * 0.9})`);
      gr.addColorStop(1, "rgba(255,160,80,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = `rgba(255,255,240,${Math.max(0, k - 0.6) * 1.6})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  function searchlights() {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 3; i++) {
      const bx = 160 + i * 320;
      const a = -Math.PI / 2 + Math.sin(time * 0.4 + i * 2.1) * 0.6;
      const gr = ctx.createLinearGradient(bx, GROUND_Y, bx + Math.cos(a) * 500, GROUND_Y + Math.sin(a) * 500);
      gr.addColorStop(0, "rgba(160,190,255,.16)");
      gr.addColorStop(1, "rgba(160,190,255,0)");
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(bx - 4, GROUND_Y - 40);
      ctx.lineTo(bx + Math.cos(a - 0.06) * 600, GROUND_Y - 40 + Math.sin(a - 0.06) * 600);
      ctx.lineTo(bx + Math.cos(a + 0.06) * 600, GROUND_Y - 40 + Math.sin(a + 0.06) * 600);
      ctx.lineTo(bx + 4, GROUND_Y - 40);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawParticles() {
    // smoke and dust first (normal blending)
    for (const p of parts) {
      if (p.k === "smoke") {
        const k = p.t / p.life;
        // soft puffs: a fade-in, then a long fade-out; lighter and warmer as they age
        const a = Math.min(1, k * 8) * (1 - k) * 0.42;
        const v = Math.round(110 - 70 * (p.dark ?? 0.3) + 50 * k);
        const gr = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.1, p.x, p.y, p.r);
        gr.addColorStop(0, `rgba(${v + 30},${v + 26},${v + 22},${a})`);
        gr.addColorStop(0.6, `rgba(${v},${v - 4},${v - 8},${a * 0.8})`);
        gr.addColorStop(1, `rgba(${v},${v - 4},${v - 8},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      } else if (p.k === "dust") {
        const a = (1 - p.t / p.life) * 0.4;
        ctx.fillStyle = `rgba(150,120,85,${a})`;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
      } else if (p.k === "debris") {
        const a = Math.min(1, (p.life - p.t) * 2);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.moveTo(-p.s, -p.s * 0.6);
        ctx.lineTo(p.s, -p.s * 0.3);
        ctx.lineTo(p.s * 0.6, p.s * 0.7);
        ctx.lineTo(-p.s * 0.8, p.s * 0.4);
        ctx.closePath();
        ctx.fill();
        if (p.t < 0.5) { ctx.fillStyle = `rgba(255,150,60,${0.8 - p.t * 1.6})`; ctx.fill(); }
        ctx.restore();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const p of parts) {
      const k = p.t / p.life;
      if (p.k === "fire") {
        const r = p.r * (0.6 + k * 0.8);
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        const hot = 1 - k;
        gr.addColorStop(0, `rgba(255,${200 + 55 * hot | 0},${120 + 120 * hot | 0},${0.9 * hot})`);
        gr.addColorStop(0.5, `rgba(255,${110 + 60 * hot | 0},30,${0.6 * hot})`);
        gr.addColorStop(1, "rgba(200,40,10,0)");
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.k === "spark") {
        const c = p.c ?? "255,220,140";
        ctx.strokeStyle = `rgba(${c},${1 - k})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else if (p.k === "flash") {
        const c = p.c ?? "255,230,180";
        const r = p.r * (0.6 + k * 0.6);
        const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
        gr.addColorStop(0, `rgba(255,255,255,${1 - k})`);
        gr.addColorStop(0.3, `rgba(${c},${(1 - k) * 0.8})`);
        gr.addColorStop(1, `rgba(${c},0)`);
        ctx.fillStyle = gr;
        ctx.fillRect(p.x - r, p.y - r, r * 2, r * 2);
      } else if (p.k === "ring") {
        const c = p.c ?? "255,210,150";
        ctx.strokeStyle = `rgba(${c},${(1 - k) * 0.8})`;
        ctx.lineWidth = p.w * (1 - k) + 0.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }

  function clear() {
    parts.length = 0;
    wrecks.length = 0;
    floaters.length = 0;
    decals.length = 0;
    lights.length = 0;
    nukeT = 0;
    shake = 0;
  }

  return {
    resize,
    render,
    update,
    onEvents,
    clear,
    prewarm: (id) => backdrop(id),
    setReduced(v) { reduced = v; },
    /** CSS pixel → field units. */
    toField(cssX, cssY) {
      const s = scale / dpr;
      return { x: cssX / s, y: cssY / s };
    },
    get time() { return time; },
  };
}

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}
