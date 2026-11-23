// Every picture in the game, drawn with Canvas 2D: the tank, the Iron Crow air wing, the four
// bosses, the supply chopper, crates, troops, projectiles and the four parallax backdrops.
// Sprites face right; callers flip with the entity's direction.

import { rng } from "../core/rng.js";

const TAU = Math.PI * 2;

// ------------------------------------------------------------------ colour helpers

export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function vgrad(ctx, y0, y1, stops) {
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
  return gr;
}

function metal(ctx, y0, y1, base) {
  return vgrad(ctx, y0, y1, [shade(base, 0.45), shade(base, 0.12), base, shade(base, -0.35), shade(base, -0.55)]);
}

function glow(ctx, x, y, r, color, alpha = 1) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color);
  gr.addColorStop(1, "rgba(0,0,0,0)");
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gr;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU);
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function rivets(ctx, x0, x1, y, step = 8, color = "rgba(255,255,255,.35)") {
  ctx.fillStyle = color;
  for (let x = x0; x <= x1; x += step) { ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill(); }
}

// Enemy livery: gunmetal with crimson and hazard yellow.
const IRON = "#56606f";
const IRON_D = "#363d49";
const CRIMSON = "#d23a3f";
const HAZARD = "#f2c230";

function crowMark(ctx, x, y, s) {
  // the Iron Crow insignia: a black chevron bird in a crimson disc
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = CRIMSON;
  ellipse(ctx, 0, 0, s, s);
  ctx.fill();
  ctx.fillStyle = "#16181d";
  ctx.beginPath();
  ctx.moveTo(-s * 0.75, -s * 0.15);
  ctx.lineTo(0, s * 0.45);
  ctx.lineTo(s * 0.75, -s * 0.15);
  ctx.lineTo(0, s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function canopy(ctx, x, y, rx, ry) {
  const gr = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
  gr.addColorStop(0, "#d9f6ff");
  gr.addColorStop(0.35, "#4fb5e6");
  gr.addColorStop(1, "#0d2c4a");
  ctx.fillStyle = gr;
  ellipse(ctx, x, y, rx, ry);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ellipse(ctx, x - rx * 0.3, y - ry * 0.35, rx * 0.35, ry * 0.25);
  ctx.fill();
}

function flame(ctx, x, y, len, w, t, hue = "orange") {
  const f = 0.8 + 0.2 * Math.sin(t * 60) + 0.1 * Math.sin(t * 37);
  const L = len * f;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const gr = ctx.createLinearGradient(x, y, x - L, y);
  if (hue === "blue") {
    gr.addColorStop(0, "rgba(220,245,255,1)");
    gr.addColorStop(0.3, "rgba(90,180,255,.9)");
  } else {
    gr.addColorStop(0, "rgba(255,250,210,1)");
    gr.addColorStop(0.3, "rgba(255,170,60,.9)");
  }
  gr.addColorStop(1, "rgba(255,60,20,0)");
  ctx.fillStyle = gr;
  ctx.beginPath();
  ctx.moveTo(x, y - w);
  ctx.quadraticCurveTo(x - L * 0.5, y - w * 0.8, x - L, y);
  ctx.quadraticCurveTo(x - L * 0.5, y + w * 0.8, x, y + w);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function propDisc(ctx, x, y, r, t) {
  ctx.save();
  ctx.fillStyle = "rgba(200,210,225,.18)";
  ellipse(ctx, x, y, 2.5, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(235,240,250,.55)";
  ctx.lineWidth = 1.6;
  const a = t * 40;
  for (let i = 0; i < 2; i++) {
    const s = Math.sin(a + i * Math.PI);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + s * r);
    ctx.stroke();
  }
  ctx.restore();
}

function rotorDisc(ctx, x, y, r, t, tilt = 0.12) {
  ctx.save();
  ctx.fillStyle = "rgba(210,220,235,.13)";
  ellipse(ctx, x, y, r, r * tilt);
  ctx.fill();
  ctx.strokeStyle = "rgba(230,238,250,.6)";
  ctx.lineWidth = 2;
  const a = t * 32;
  for (let i = 0; i < 3; i++) {
    const c = Math.cos(a + (i * TAU) / 3);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + c * r, y + Math.sin(a + (i * TAU) / 3) * r * tilt);
    ctx.stroke();
  }
  ctx.fillStyle = "#2a2f38";
  ellipse(ctx, x, y, 3.5, 2.5);
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ the player tank

export const TANK_COL = { hull: "#7d8a4a", hullD: "#4c5630", sand: "#c2a86a", trim: "#ff7a2a" };

/**
 * @param {object} o { x, ground, aim, recoil, vx, roll (tread distance), kit, shield, t, blink, firing }
 */
export function drawTank(ctx, o) {
  const { x, ground, aim, recoil = 0, kit, t } = o;
  ctx.save();
  ctx.translate(x, ground);
  const bob = Math.sin(o.roll * 0.12) * 0.6;

  // contact shadow
  const sh = ctx.createRadialGradient(0, 2, 4, 0, 2, 58);
  sh.addColorStop(0, "rgba(0,0,0,.55)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ellipse(ctx, 0, 2, 58, 9);
  ctx.fill();

  // ---- tracks
  ctx.save();
  ctx.translate(0, -12);
  rrect(ctx, -46, -10, 92, 22, 11);
  ctx.fillStyle = "#23262b";
  ctx.fill();
  // moving tread links
  ctx.save();
  rrect(ctx, -46, -10, 92, 22, 11);
  ctx.clip();
  ctx.fillStyle = "#3b3f46";
  const off = ((o.roll % 8) + 8) % 8;
  for (let i = -56; i < 56; i += 8) {
    ctx.fillRect(i + off, -10, 4, 3);
    ctx.fillRect(i - off + 4, 9, 4, 3);
  }
  ctx.restore();
  // road wheels
  for (let i = -3; i <= 3; i++) {
    const wx = i * 12.5;
    const r = Math.abs(i) === 3 ? 6.5 : 7.5;
    const gw = ctx.createRadialGradient(wx - 2, -2, 1, wx, 0, r);
    gw.addColorStop(0, "#9aa08a");
    gw.addColorStop(0.6, "#5a6048");
    gw.addColorStop(1, "#262a20");
    ctx.fillStyle = gw;
    ellipse(ctx, wx, 0, r, r);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.5)";
    ctx.lineWidth = 1;
    const a = o.roll / r;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(wx, 0);
      ctx.lineTo(wx + Math.cos(a + (k * TAU) / 3) * r * 0.7, Math.sin(a + (k * TAU) / 3) * r * 0.7);
      ctx.stroke();
    }
    ctx.fillStyle = "#c9c2a0";
    ellipse(ctx, wx, 0, 1.6, 1.6);
    ctx.fill();
  }
  // side skirt
  const sk = ctx.createLinearGradient(0, -12, 0, -3);
  sk.addColorStop(0, shade(TANK_COL.hull, 0.2));
  sk.addColorStop(1, TANK_COL.hullD);
  ctx.fillStyle = sk;
  ctx.beginPath();
  ctx.moveTo(-50, -12);
  ctx.lineTo(50, -12);
  ctx.lineTo(46, -4);
  ctx.lineTo(-46, -4);
  ctx.closePath();
  ctx.fill();
  rivets(ctx, -42, 42, -8, 10, "rgba(255,240,200,.35)");
  ctx.restore();

  // ---- hull
  ctx.translate(0, bob);
  ctx.beginPath();
  ctx.moveTo(-48, -22);
  ctx.lineTo(-40, -33);
  ctx.lineTo(34, -33);
  ctx.lineTo(50, -24);
  ctx.lineTo(48, -20);
  ctx.lineTo(-48, -20);
  ctx.closePath();
  ctx.fillStyle = metal(ctx, -33, -20, TANK_COL.hull);
  ctx.fill();
  // sand camo blotches
  ctx.save();
  ctx.clip();
  ctx.fillStyle = "rgba(194,168,106,.55)";
  ellipse(ctx, -26, -27, 11, 4, 0.2); ctx.fill();
  ellipse(ctx, 18, -29, 9, 3.5, -0.3); ctx.fill();
  ctx.fillStyle = "rgba(60,52,30,.45)";
  ellipse(ctx, -2, -25, 8, 3); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,220,.45)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-40, -32.5);
  ctx.lineTo(34, -32.5);
  ctx.stroke();
  // headlight
  ctx.fillStyle = "#fff3c4";
  ellipse(ctx, 45, -25, 2.4, 2);
  ctx.fill();
  glow(ctx, 47, -25, 10, "rgba(255,240,180,.8)", 0.7);
  // flame emblem on the hull side
  ctx.save();
  ctx.translate(-30, -26);
  ctx.fillStyle = TANK_COL.trim;
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.quadraticCurveTo(-5, 0, -1, -5);
  ctx.quadraticCurveTo(0, -1, 2, -2);
  ctx.quadraticCurveTo(2, -6, 5, -7);
  ctx.quadraticCurveTo(4, -2, 6, 1);
  ctx.quadraticCurveTo(5, 4, 0, 4);
  ctx.fill();
  ctx.restore();
  // exhaust stack
  ctx.fillStyle = "#2d3020";
  ctx.fillRect(-46, -38, 5, 7);

  // upgrade modules: missile pods on the hull ends, flak mortar on the back
  if (kit.homing > 0) {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 26, -36);
      rrect(ctx, -7, -6, 14, 9, 2);
      ctx.fillStyle = metal(ctx, -6, 3, "#4e5a66");
      ctx.fill();
      ctx.fillStyle = "#14181c";
      for (let i = 0; i < kit.homing; i++) { ellipse(ctx, -4 + i * 4, -2, 1.5, 1.5); ctx.fill(); }
      ctx.fillStyle = "#5cd2ff";
      ctx.fillRect(-7, 1, 14, 1.2);
      ctx.restore();
    }
  }
  if (kit.flak > 0) {
    ctx.save();
    ctx.translate(-38, -36);
    ctx.rotate(-0.9);
    ctx.fillStyle = metal(ctx, -3, 3, "#5d6a3a");
    rrect(ctx, -2, -3.5, 13, 7, 2);
    ctx.fill();
    ctx.fillStyle = "#9dff5c";
    ctx.fillRect(9, -3.5, 2, 7);
    ctx.restore();
  }

  // ---- turret
  ctx.save();
  ctx.translate(0, -40);
  // barrel
  ctx.save();
  ctx.rotate(aim);
  const rec = recoil * 7;
  const bl = ctx.createLinearGradient(0, -4, 0, 4);
  bl.addColorStop(0, "#9aa37a");
  bl.addColorStop(0.5, "#5d6640");
  bl.addColorStop(1, "#2a2f1c");
  ctx.fillStyle = bl;
  const n = Math.min(3, kit.gun);
  if (n >= 2) {
    // twin / triple barrels as the cannon levels up
    for (let i = 0; i < n; i++) {
      const oy = (i - (n - 1) / 2) * 5;
      ctx.fillRect(8 - rec, oy - 2, 34, 4);
    }
  } else {
    ctx.fillRect(8 - rec, -3, 34, 6);
  }
  ctx.fillStyle = "#2c3020";
  rrect(ctx, 36 - rec, -4.5 - (n - 1) * 1.5, 9, 9 + (n - 1) * 3, 1.5);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,.5)";
  ctx.fillRect(38 - rec, -1, 6, 2);
  if (kit.laser > 0) {
    // laser emitter strapped under the barrel
    ctx.fillStyle = "#3b2a44";
    rrect(ctx, 10 - rec * 0.5, 3.5, 22, 4, 2);
    ctx.fill();
    ctx.fillStyle = "#ff4fd8";
    ctx.fillRect(30 - rec * 0.5, 4, 3, 3);
    glow(ctx, 32 - rec * 0.5, 5.5, 8, "rgba(255,80,220,.9)", 0.6 + 0.3 * Math.sin(t * 8));
  }
  ctx.restore();
  // dome
  ctx.beginPath();
  ctx.moveTo(-24, 8);
  ctx.quadraticCurveTo(-24, -12, 0, -13);
  ctx.quadraticCurveTo(24, -12, 26, 8);
  ctx.closePath();
  const dg = ctx.createRadialGradient(-6, -8, 2, 0, 0, 30);
  dg.addColorStop(0, shade(TANK_COL.hull, 0.45));
  dg.addColorStop(0.5, TANK_COL.hull);
  dg.addColorStop(1, TANK_COL.hullD);
  ctx.fillStyle = dg;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  // hatch + commander
  ctx.fillStyle = "#3f4628";
  ellipse(ctx, -6, -11, 8, 3);
  ctx.fill();
  ctx.fillStyle = "#596238";
  ellipse(ctx, -6, -12, 6.5, 2);
  ctx.fill();
  // antenna whip
  ctx.strokeStyle = "#1c1e18";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(14, -8);
  const sway = Math.sin(t * 5) * 3 - (o.vx || 0) * 0.03;
  ctx.quadraticCurveTo(16 + sway * 0.5, -26, 18 + sway, -40);
  ctx.stroke();
  ctx.fillStyle = TANK_COL.trim;
  ctx.fillRect(16 + sway, -41, 4, 3);
  // vision slit with a warm light
  ctx.fillStyle = "#ffcf6a";
  ctx.fillRect(8, -4, 9, 1.6);
  ctx.restore();

  ctx.restore();

  // ---- shield bubble
  if (o.shield > 0) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const pulse = 0.5 + 0.2 * Math.sin(t * 6);
    const gr = ctx.createRadialGradient(x, ground - 26, 30, x, ground - 26, 64);
    gr.addColorStop(0, "rgba(124,247,255,0)");
    gr.addColorStop(0.8, `rgba(124,247,255,${0.12 * pulse})`);
    gr.addColorStop(1, `rgba(180,252,255,${0.55 * pulse})`);
    ctx.fillStyle = gr;
    ellipse(ctx, x, ground - 22, 64, 50);
    ctx.fill();
    ctx.strokeStyle = `rgba(180,252,255,${0.5 + 0.2 * Math.sin(t * 9)})`;
    ctx.lineWidth = 1.2;
    // hex shimmer
    for (let i = 0; i < o.shield; i++) {
      ctx.beginPath();
      ctx.ellipse(x, ground - 22, 64 - i * 4, 50 - i * 4, 0, Math.PI, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ enemies

export function drawEnemy(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y);
  const dir = e.dir || 1;
  ctx.scale(dir, 1);
  if (e.rot) ctx.rotate(e.rot);
  else if (e.kind !== "blimp") ctx.rotate(Math.atan2(e.vy || 0, Math.abs(e.vx || 1)) * 0.5);
  switch (e.kind) {
    case "fighter": fighter(ctx, t); break;
    case "diver": diver(ctx, t); break;
    case "heli": heli(ctx, t, e); break;
    case "bomber": bomber(ctx, t); break;
    case "transport": transport(ctx, t); break;
    case "jet": jet(ctx, t); break;
    case "blimp": blimp(ctx, t, e); break;
  }
  ctx.restore();
}

function fighter(ctx, t) {
  flame(ctx, -24, 0, 22, 3.5, t);
  // far wing
  ctx.fillStyle = shade(IRON, -0.45);
  ctx.beginPath();
  ctx.moveTo(4, -2); ctx.lineTo(-12, -14); ctx.lineTo(-16, -13); ctx.lineTo(-8, -2); ctx.fill();
  // fuselage
  ctx.beginPath();
  ctx.moveTo(30, 1);
  ctx.quadraticCurveTo(20, -6, 4, -6);
  ctx.lineTo(-22, -4);
  ctx.lineTo(-24, 4);
  ctx.lineTo(8, 6);
  ctx.quadraticCurveTo(22, 5, 30, 1);
  ctx.fillStyle = metal(ctx, -6, 6, IRON);
  ctx.fill();
  // nose cone
  ctx.fillStyle = CRIMSON;
  ctx.beginPath(); ctx.moveTo(30, 1); ctx.quadraticCurveTo(26, -3, 22, -4); ctx.lineTo(22, 5); ctx.quadraticCurveTo(27, 4, 30, 1); ctx.fill();
  // tail fin
  ctx.fillStyle = metal(ctx, -16, -3, IRON_D);
  ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-22, -17); ctx.lineTo(-26, -17); ctx.lineTo(-23, -4); ctx.fill();
  ctx.fillStyle = HAZARD;
  ctx.fillRect(-25, -16, 4, 2);
  canopy(ctx, 10, -6, 8, 3.5);
  // near wing
  ctx.fillStyle = metal(ctx, 0, 14, IRON);
  ctx.beginPath(); ctx.moveTo(8, 2); ctx.lineTo(-10, 15); ctx.lineTo(-16, 15); ctx.lineTo(-8, 3); ctx.fill();
  crowMark(ctx, -8, 9, 3);
  ctx.fillStyle = "rgba(255,255,255,.25)";
  ctx.fillRect(-18, -3.5, 34, 1);
}

function diver(ctx, t) {
  propDisc(ctx, 27, 0, 13, t);
  // gull wing (far)
  ctx.fillStyle = shade("#6d6450", -0.4);
  ctx.beginPath(); ctx.moveTo(6, -3); ctx.lineTo(-2, -12); ctx.lineTo(-10, -11); ctx.lineTo(-4, -3); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(25, -5);
  ctx.lineTo(25, 5);
  ctx.lineTo(-18, 3);
  ctx.lineTo(-24, -2);
  ctx.lineTo(-18, -6);
  ctx.closePath();
  ctx.fillStyle = metal(ctx, -6, 5, "#6d6450");
  ctx.fill();
  ctx.fillStyle = HAZARD;
  ctx.fillRect(18, -5, 7, 10);
  ctx.fillStyle = "#222";
  ctx.fillRect(18, -5, 1.5, 10);
  canopy(ctx, 2, -6, 9, 3.4);
  ctx.fillStyle = metal(ctx, -14, -4, "#4a4436");
  ctx.beginPath(); ctx.moveTo(-14, -5); ctx.lineTo(-22, -15); ctx.lineTo(-26, -14); ctx.lineTo(-22, -3); ctx.fill();
  // inverted gull wing (near)
  ctx.fillStyle = metal(ctx, 0, 14, "#6d6450");
  ctx.beginPath(); ctx.moveTo(10, 2); ctx.lineTo(4, 10); ctx.lineTo(-6, 13); ctx.lineTo(-12, 12); ctx.lineTo(-2, 8); ctx.lineTo(-2, 2); ctx.fill();
  // fixed gear and a bomb under the belly
  ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(8, 11); ctx.stroke();
  ctx.fillStyle = "#1c1c1c"; ellipse(ctx, 8, 12, 2.4, 2.4); ctx.fill();
  ctx.fillStyle = "#3a3a32"; ellipse(ctx, -4, 6, 6, 2.2); ctx.fill();
  crowMark(ctx, -10, 0, 3);
}

function heli(ctx, t, e) {
  const tilt = Math.max(-0.25, Math.min(0.25, (e.vx || 0) / 600));
  ctx.rotate(tilt * (e.dir || 1));
  // tail boom
  ctx.fillStyle = metal(ctx, -6, 2, "#5b6a4f");
  ctx.beginPath(); ctx.moveTo(-8, -6); ctx.lineTo(-40, -4); ctx.lineTo(-42, 0); ctx.lineTo(-8, 4); ctx.fill();
  ctx.fillStyle = shade("#5b6a4f", -0.3);
  ctx.beginPath(); ctx.moveTo(-36, -4); ctx.lineTo(-44, -16); ctx.lineTo(-46, -15); ctx.lineTo(-42, -2); ctx.fill();
  // tail rotor
  ctx.save();
  ctx.translate(-43, -6);
  ctx.strokeStyle = "rgba(230,235,245,.6)";
  ctx.lineWidth = 1.5;
  const a = t * 50;
  ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8); ctx.stroke();
  ctx.restore();
  // cabin
  ctx.beginPath();
  ctx.moveTo(24, 4);
  ctx.quadraticCurveTo(26, -10, 10, -14);
  ctx.lineTo(-12, -12);
  ctx.quadraticCurveTo(-16, 0, -10, 10);
  ctx.lineTo(16, 12);
  ctx.quadraticCurveTo(24, 10, 24, 4);
  ctx.fillStyle = metal(ctx, -14, 12, "#5b6a4f");
  ctx.fill();
  // glass nose
  ctx.beginPath();
  ctx.moveTo(24, 4); ctx.quadraticCurveTo(25, -8, 12, -12); ctx.lineTo(12, 3); ctx.closePath();
  const gr = ctx.createLinearGradient(12, -12, 24, 4);
  gr.addColorStop(0, "#c8f0ff"); gr.addColorStop(0.5, "#3a8fbf"); gr.addColorStop(1, "#0e2a40");
  ctx.fillStyle = gr; ctx.fill();
  // stub wings with rocket pods
  ctx.fillStyle = IRON_D;
  ctx.fillRect(-6, 4, 16, 3);
  ctx.fillStyle = metal(ctx, 6, 12, "#444b55");
  rrect(ctx, -4, 6, 14, 5, 2.5); ctx.fill();
  ctx.fillStyle = CRIMSON; ctx.fillRect(9, 6, 2, 5);
  // skids
  ctx.strokeStyle = "#1e2226"; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(-14, 17); ctx.lineTo(18, 17); ctx.quadraticCurveTo(22, 17, 22, 14); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, 11); ctx.lineTo(-8, 17); ctx.moveTo(10, 12); ctx.lineTo(10, 17); ctx.stroke();
  crowMark(ctx, -2, -3, 4);
  // rotor mast and blur
  ctx.fillStyle = "#2a2f38";
  ctx.fillRect(-2, -18, 5, 5);
  rotorDisc(ctx, 0, -19, 44, t);
  // red beacon
  if (Math.sin(t * 7) > 0.4) glow(ctx, -40, -4, 7, "rgba(255,60,60,1)");
}

function bomber(ctx, t) {
  // far wing and engines
  ctx.fillStyle = shade(IRON, -0.5);
  ctx.beginPath(); ctx.moveTo(10, -6); ctx.lineTo(-6, -22); ctx.lineTo(-20, -22); ctx.lineTo(-12, -6); ctx.fill();
  ctx.fillStyle = shade(IRON, -0.4);
  rrect(ctx, -4, -20, 14, 5, 2); ctx.fill();
  propDisc(ctx, 11, -17.5, 7, t + 0.3);
  // fuselage
  ctx.beginPath();
  ctx.moveTo(46, 2);
  ctx.quadraticCurveTo(44, -10, 30, -11);
  ctx.lineTo(-38, -8);
  ctx.lineTo(-50, -4);
  ctx.lineTo(-48, 4);
  ctx.lineTo(28, 10);
  ctx.quadraticCurveTo(44, 10, 46, 2);
  ctx.fillStyle = metal(ctx, -11, 10, IRON);
  ctx.fill();
  // glazed nose
  ctx.beginPath(); ctx.moveTo(46, 2); ctx.quadraticCurveTo(45, -8, 36, -10); ctx.lineTo(36, 8); ctx.quadraticCurveTo(44, 8, 46, 2);
  const gr = ctx.createLinearGradient(36, -10, 46, 6);
  gr.addColorStop(0, "#d4f2ff"); gr.addColorStop(1, "#1c4a6a");
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 0.6;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(38 + i * 3, -9); ctx.lineTo(38 + i * 3, 8); ctx.stroke(); }
  // tail
  ctx.fillStyle = metal(ctx, -26, -6, IRON_D);
  ctx.beginPath(); ctx.moveTo(-32, -7); ctx.lineTo(-46, -26); ctx.lineTo(-54, -26); ctx.lineTo(-50, -5); ctx.fill();
  ctx.fillStyle = CRIMSON; ctx.fillRect(-53, -25, 7, 4);
  // bomb bay doors
  ctx.fillStyle = "#1b1e24";
  rrect(ctx, -12, 6, 26, 4, 1); ctx.fill();
  ctx.fillStyle = HAZARD;
  for (let i = 0; i < 6; i++) ctx.fillRect(-11 + i * 4.3, 6.5, 2, 1);
  // ventral turret
  ctx.fillStyle = "#3c434e"; ellipse(ctx, 18, 10, 5, 3.5); ctx.fill();
  ctx.fillStyle = "#14171b"; ctx.fillRect(18, 10, 9, 1.5);
  // near wing with two engines
  ctx.fillStyle = metal(ctx, 0, 26, IRON);
  ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-4, 24); ctx.lineTo(-22, 24); ctx.lineTo(-12, 1); ctx.fill();
  for (const [ex, ey] of [[8, 8], [0, 17]]) {
    ctx.fillStyle = metal(ctx, ey - 3, ey + 3, "#4a515c");
    rrect(ctx, ex - 9, ey - 3, 16, 6, 3); ctx.fill();
    propDisc(ctx, ex + 8, ey, 8, t + ex);
    ctx.fillStyle = "rgba(60,60,60,.4)"; ctx.fillRect(ex - 12, ey - 1, 4, 2);
  }
  crowMark(ctx, -30, -1, 4.5);
  ctx.fillStyle = "rgba(255,255,255,.22)"; ctx.fillRect(-36, -7, 66, 1.2);
}

function transport(ctx, t) {
  // far wing
  ctx.fillStyle = shade("#7b6f55", -0.5);
  ctx.beginPath(); ctx.moveTo(6, -14); ctx.lineTo(-4, -26); ctx.lineTo(-16, -26); ctx.lineTo(-10, -14); ctx.fill();
  // chunky fuselage
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.quadraticCurveTo(40, -14, 24, -15);
  ctx.lineTo(-24, -14);
  ctx.lineTo(-44, -10);
  ctx.lineTo(-44, -2);
  ctx.lineTo(-26, 12);
  ctx.lineTo(22, 13);
  ctx.quadraticCurveTo(40, 12, 40, 0);
  ctx.fillStyle = metal(ctx, -15, 13, "#7b6f55");
  ctx.fill();
  // cockpit windows
  ctx.fillStyle = "#1a3a52";
  ctx.beginPath(); ctx.moveTo(30, -10); ctx.lineTo(38, -6); ctx.lineTo(37, -3); ctx.lineTo(29, -5); ctx.fill();
  ctx.fillStyle = "rgba(200,240,255,.7)"; ctx.fillRect(31, -9, 3, 1);
  // round cabin windows
  ctx.fillStyle = "#ffd98a";
  for (let i = 0; i < 6; i++) { ellipse(ctx, 16 - i * 7, -6, 1.6, 1.6); ctx.fill(); }
  // rear ramp
  ctx.fillStyle = "#2d2a22";
  ctx.beginPath(); ctx.moveTo(-26, 12); ctx.lineTo(-40, 2); ctx.lineTo(-38, 0); ctx.lineTo(-22, 9); ctx.fill();
  // tail
  ctx.fillStyle = metal(ctx, -36, -10, "#5b5240");
  ctx.beginPath(); ctx.moveTo(-28, -13); ctx.lineTo(-40, -32); ctx.lineTo(-48, -32); ctx.lineTo(-46, -10); ctx.fill();
  ctx.fillStyle = HAZARD; ctx.fillRect(-47, -31, 7, 3);
  // high wing + engines
  ctx.fillStyle = metal(ctx, -18, -12, "#6a604a");
  rrect(ctx, -18, -19, 44, 5, 2); ctx.fill();
  for (const ex of [16, -2]) {
    ctx.fillStyle = metal(ctx, -16, -8, "#4c4638");
    rrect(ctx, ex - 6, -16, 14, 6, 3); ctx.fill();
    propDisc(ctx, ex + 9, -13, 9, t + ex);
  }
  crowMark(ctx, -14, 3, 4.5);
}

function jet(ctx, t) {
  flame(ctx, -26, 0, 30, 4, t, "blue");
  ctx.beginPath();
  ctx.moveTo(34, 0);
  ctx.lineTo(8, -5);
  ctx.lineTo(-10, -16);
  ctx.lineTo(-18, -16);
  ctx.lineTo(-14, -4);
  ctx.lineTo(-26, -3);
  ctx.lineTo(-26, 3);
  ctx.lineTo(-12, 4);
  ctx.lineTo(-20, 13);
  ctx.lineTo(-12, 13);
  ctx.lineTo(8, 5);
  ctx.closePath();
  ctx.fillStyle = metal(ctx, -16, 13, "#3f4652");
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(34, 0); ctx.lineTo(-24, 0); ctx.stroke();
  ctx.fillStyle = CRIMSON;
  ctx.beginPath(); ctx.moveTo(-10, -16); ctx.lineTo(-18, -16); ctx.lineTo(-16, -11); ctx.lineTo(-9, -11); ctx.fill();
  canopy(ctx, 12, -3.5, 7, 2.8);
  // missile under the wing
  ctx.fillStyle = "#e9e4d4"; ctx.fillRect(-6, 7, 16, 2.5);
  ctx.fillStyle = CRIMSON; ctx.fillRect(9, 7, 2, 2.5);
}

function blimp(ctx, t, e) {
  // envelope
  const L = 80;
  const H = 34;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, L, H, 0, 0, TAU);
  const gr = ctx.createLinearGradient(0, -H, 0, H);
  gr.addColorStop(0, "#8d96a3");
  gr.addColorStop(0.35, "#5d6672");
  gr.addColorStop(0.75, "#373e49");
  gr.addColorStop(1, "#22272f");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.clip();
  // armour plates
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1;
  for (let x = -L; x < L; x += 16) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.quadraticCurveTo(x + 6, 0, x, H); ctx.stroke(); }
  for (let y = -H + 12; y < H; y += 14) { ctx.beginPath(); ctx.moveTo(-L, y); ctx.lineTo(L, y); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,255,255,.18)";
  ctx.beginPath(); ctx.ellipse(-8, -18, L * 0.75, 8, 0, 0, TAU); ctx.fill();
  // hazard band
  ctx.fillStyle = HAZARD;
  ctx.fillRect(30, -H, 10, H * 2);
  ctx.fillStyle = "#1b1b1b";
  for (let y = -H; y < H; y += 8) { ctx.beginPath(); ctx.moveTo(30, y); ctx.lineTo(40, y + 4); ctx.lineTo(40, y + 8); ctx.lineTo(30, y + 4); ctx.fill(); }
  ctx.restore();
  crowMark(ctx, -18, 2, 11);
  // fins
  ctx.fillStyle = metal(ctx, -40, 40, IRON_D);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-58, s * 14); ctx.lineTo(-90, s * 40); ctx.lineTo(-96, s * 38); ctx.lineTo(-82, s * 6); ctx.fill();
  }
  ctx.fillStyle = CRIMSON; ctx.fillRect(-96, -4, 18, 8);
  // gondola
  ctx.fillStyle = metal(ctx, 30, 48, "#4a515c");
  rrect(ctx, -26, 30, 50, 16, 6); ctx.fill();
  ctx.fillStyle = "#ffd98a";
  for (let i = 0; i < 5; i++) ctx.fillRect(-20 + i * 9, 35, 5, 4);
  // engines
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#30363f";
    rrect(ctx, -40, 22 + s * 0, 14, 7, 3); ctx.fill();
    propDisc(ctx, -42, 25.5, 8, t + s);
  }
  // searchlight
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const sw = Math.sin(t * 0.9 + (e.id || 0)) * 0.35;
  ctx.translate(0, 46);
  ctx.rotate(sw);
  const bg = ctx.createLinearGradient(0, 0, 0, 200);
  bg.addColorStop(0, "rgba(255,240,190,.28)");
  bg.addColorStop(1, "rgba(255,240,190,0)");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.moveTo(-3, 0); ctx.lineTo(3, 0); ctx.lineTo(40, 200); ctx.lineTo(-40, 200); ctx.fill();
  ctx.restore();
  if (Math.sin(t * 5) > 0.3) glow(ctx, L - 4, 0, 8, "rgba(255,60,60,1)");
}

// ------------------------------------------------------------------ bosses

export function drawBoss(ctx, b, t) {
  ctx.save();
  ctx.translate(b.x, b.y);
  if (b.dying) ctx.rotate(Math.sin(b.dying * 3) * 0.05 + b.dying * 0.04);
  switch (b.id) {
    case "vulture": vulture(ctx, b, t); break;
    case "mantis": mantis(ctx, b, t); break;
    case "whale": whale(ctx, b, t); break;
    case "phoenix": phoenix(ctx, b, t); break;
  }
  // parts
  for (const p of b.parts) drawPart(ctx, b, p, t);
  ctx.restore();
}

function drawPart(ctx, b, p, t) {
  ctx.save();
  ctx.translate(p.dx, p.dy);
  if (!p.alive) {
    // wrecked socket, smouldering
    ctx.fillStyle = "#1a1c20";
    ellipse(ctx, 0, 0, p.r * 0.8, p.r * 0.55);
    ctx.fill();
    ctx.fillStyle = `rgba(255,${120 + Math.sin(t * 12 + p.dx) * 60 | 0},40,.8)`;
    ellipse(ctx, 0, 0, p.r * 0.35, p.r * 0.25);
    ctx.fill();
    ctx.restore();
    return;
  }
  if (p.hit > 0) ctx.filter = "brightness(2.4)";
  const kind = p.pattern;
  if (kind === "bombs" || kind === "troops" || kind === "launch") {
    // hatch
    ctx.fillStyle = metal(ctx, -p.r * 0.6, p.r * 0.6, "#3a414b");
    rrect(ctx, -p.r, -p.r * 0.55, p.r * 2, p.r * 1.1, 4);
    ctx.fill();
    ctx.fillStyle = HAZARD;
    for (let i = 0; i < 5; i++) ctx.fillRect(-p.r + 2 + i * (p.r * 0.4), -p.r * 0.55, p.r * 0.2, p.r * 1.1);
    ctx.fillStyle = "#121418";
    rrect(ctx, -p.r * 0.7, -p.r * 0.3, p.r * 1.4, p.r * 0.6, 2);
    ctx.fill();
    glow(ctx, 0, 0, p.r * 0.9, kind === "launch" ? "rgba(90,200,255,.8)" : "rgba(255,120,40,.7)", 0.5 + 0.3 * Math.sin(t * 6));
  } else if (kind === "missile") {
    ctx.fillStyle = metal(ctx, -p.r * 0.7, p.r * 0.7, "#4a515c");
    rrect(ctx, -p.r, -p.r * 0.7, p.r * 2, p.r * 1.4, 4);
    ctx.fill();
    ctx.fillStyle = "#e9e4d4";
    for (let i = 0; i < 3; i++) { ctx.fillRect(-p.r + 4 + i * (p.r * 0.6), p.r * 0.2, p.r * 0.35, p.r * 0.7); }
    ctx.fillStyle = CRIMSON;
    for (let i = 0; i < 3; i++) ctx.fillRect(-p.r + 4 + i * (p.r * 0.6), p.r * 0.75, p.r * 0.35, 3);
  } else {
    // gun turret: a ball mount that tracks the tank
    const gr = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.3, 1, 0, 0, p.r);
    gr.addColorStop(0, "#a8b0bb");
    gr.addColorStop(0.6, "#4f5763");
    gr.addColorStop(1, "#1e2228");
    ctx.fillStyle = gr;
    ellipse(ctx, 0, 0, p.r, p.r);
    ctx.fill();
    const aim = p.aim ?? Math.PI / 2;
    ctx.save();
    ctx.rotate(aim);
    ctx.fillStyle = "#23272e";
    const barrels = kind === "stream" ? 3 : kind === "shellFan" || kind === "shell" ? 1 : 2;
    const bw = kind.startsWith("shell") ? 7 : 3.4;
    for (let i = 0; i < barrels; i++) ctx.fillRect(p.r * 0.4, (i - (barrels - 1) / 2) * (bw + 1.5) - bw / 2, p.r * 1.3, bw);
    ctx.restore();
    ctx.fillStyle = CRIMSON;
    ellipse(ctx, 0, 0, p.r * 0.35, p.r * 0.35);
    ctx.fill();
    glow(ctx, 0, 0, p.r * 0.6, "rgba(255,80,60,.9)", 0.4 + 0.3 * Math.sin(t * 5 + p.dx));
  }
  ctx.filter = "none";
  // damage smoke hint
  if (p.hp < p.maxHp * 0.4) glow(ctx, 0, -p.r * 0.5, p.r, "rgba(255,90,30,.5)", 0.4 + 0.3 * Math.sin(t * 15));
  ctx.restore();
}

function hullFlash(ctx, b) {
  if (b.hit > 0) ctx.filter = "brightness(1.8)";
}

function vulture(ctx, b, t) {
  hullFlash(ctx, b);
  // wings
  ctx.fillStyle = metal(ctx, -16, 14, "#4d5562");
  ctx.beginPath();
  ctx.moveTo(-40, -10); ctx.lineTo(-205, 0); ctx.lineTo(-210, 10); ctx.lineTo(-40, 16);
  ctx.lineTo(40, 16); ctx.lineTo(210, 10); ctx.lineTo(205, 0); ctx.lineTo(40, -10); ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  for (let x = -190; x <= 190; x += 24) { ctx.beginPath(); ctx.moveTo(x, -4); ctx.lineTo(x, 12); ctx.stroke(); }
  ctx.fillStyle = HAZARD;
  ctx.fillRect(-206, 2, 14, 6); ctx.fillRect(192, 2, 14, 6);
  // four engine nacelles with propellers
  for (const ex of [-160, -95, 95, 160]) {
    ctx.fillStyle = metal(ctx, -2, 18, "#3d444f");
    rrect(ctx, ex - 14, -2, 28, 18, 8); ctx.fill();
    ctx.fillStyle = "#1a1d22"; ellipse(ctx, ex, 16, 9, 3); ctx.fill();
    // rotor blur seen from below
    ctx.fillStyle = "rgba(210,220,235,.16)"; ellipse(ctx, ex, 18, 22, 4); ctx.fill();
    ctx.strokeStyle = "rgba(230,235,245,.45)"; ctx.lineWidth = 1.4;
    const a = t * 30 + ex;
    ctx.beginPath(); ctx.moveTo(ex + Math.cos(a) * 22, 18 + Math.sin(a) * 4); ctx.lineTo(ex - Math.cos(a) * 22, 18 - Math.sin(a) * 4); ctx.stroke();
  }
  // fuselage seen nose-on from below: a fat armoured belly
  ctx.beginPath();
  ctx.ellipse(0, 4, 64, 40, 0, 0, TAU);
  ctx.fillStyle = metal(ctx, -36, 44, "#5b6472");
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.4)";
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 22, -32); ctx.quadraticCurveTo(i * 26, 4, i * 22, 42); ctx.stroke(); }
  ctx.fillStyle = "rgba(255,255,255,.18)"; ellipse(ctx, -10, -18, 40, 10); ctx.fill();
  crowMark(ctx, 0, -12, 14);
  // cockpit windows
  ctx.fillStyle = "#16384f";
  rrect(ctx, -22, -40, 44, 10, 5); ctx.fill();
  ctx.fillStyle = "rgba(200,240,255,.7)"; ctx.fillRect(-18, -38, 10, 2);
  ctx.filter = "none";
}

function mantis(ctx, b, t) {
  hullFlash(ctx, b);
  // twin rotor pylons
  for (const s of [-1, 1]) {
    ctx.fillStyle = metal(ctx, -40, -10, "#4b5a40");
    ctx.beginPath(); ctx.moveTo(s * 30, -16); ctx.lineTo(s * 112, -34); ctx.lineTo(s * 116, -22); ctx.lineTo(s * 36, 0); ctx.fill();
    ctx.fillStyle = metal(ctx, -48, -14, "#3c4834");
    rrect(ctx, s * 112 - 18, -46, 36, 30, 10); ctx.fill();
    ctx.fillStyle = HAZARD; ctx.fillRect(s * 112 - 18, -20, 36, 3);
    rotorDisc(ctx, s * 112, -50, 86, t + s, 0.14);
  }
  // body
  ctx.beginPath();
  ctx.moveTo(-60, -10);
  ctx.quadraticCurveTo(-64, 30, -30, 40);
  ctx.lineTo(30, 40);
  ctx.quadraticCurveTo(64, 30, 60, -10);
  ctx.quadraticCurveTo(40, -36, 0, -36);
  ctx.quadraticCurveTo(-40, -36, -60, -10);
  ctx.fillStyle = metal(ctx, -36, 40, "#5b6a4f");
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = 1;
  for (let y = -20; y < 40; y += 12) { ctx.beginPath(); ctx.moveTo(-58, y); ctx.lineTo(58, y); ctx.stroke(); }
  // compound eye canopy: the mantis look
  for (const s of [-1, 1]) {
    const gr = ctx.createRadialGradient(s * 22, -8, 2, s * 22, -6, 18);
    gr.addColorStop(0, "#ffe7a0");
    gr.addColorStop(0.4, "#e0602a");
    gr.addColorStop(1, "#3a0c0c");
    ctx.fillStyle = gr;
    ellipse(ctx, s * 22, -6, 17, 12, s * 0.3);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.55)";
    ellipse(ctx, s * 18, -11, 5, 2.5, s * 0.3);
    ctx.fill();
  }
  glow(ctx, 0, -6, 46, "rgba(255,120,40,.6)", 0.35 + 0.15 * Math.sin(t * 4));
  crowMark(ctx, 0, 18, 9);
  // tail boom going back (seen in perspective)
  ctx.fillStyle = metal(ctx, -40, -30, "#3c4834");
  ctx.fillRect(-6, -60, 12, 26);
  ctx.filter = "none";
}

function whale(ctx, b, t) {
  hullFlash(ctx, b);
  const L = 240;
  const H = 66;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(L, 4);
  ctx.bezierCurveTo(L, -H * 1.1, -L * 0.6, -H * 1.1, -L, -10);
  ctx.bezierCurveTo(-L * 0.6, H * 1.0, L * 0.8, H * 1.05, L, 4);
  const gr = ctx.createLinearGradient(0, -H, 0, H);
  gr.addColorStop(0, "#7d8794");
  gr.addColorStop(0.4, "#4f5865");
  gr.addColorStop(0.8, "#2c323b");
  gr.addColorStop(1, "#1c2027");
  ctx.fillStyle = gr;
  ctx.fill();
  ctx.clip();
  ctx.strokeStyle = "rgba(0,0,0,.35)";
  ctx.lineWidth = 1.2;
  for (let x = -L; x < L; x += 22) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.quadraticCurveTo(x + 10, 0, x, H); ctx.stroke(); }
  for (let y = -H + 18; y < H; y += 18) { ctx.beginPath(); ctx.moveTo(-L, y); ctx.lineTo(L, y); ctx.stroke(); }
  rivets(ctx, -L, L, -30, 11, "rgba(255,255,255,.25)");
  rivets(ctx, -L, L, 20, 11, "rgba(255,255,255,.18)");
  ctx.fillStyle = "rgba(255,255,255,.16)"; ellipse(ctx, 0, -40, L * 0.8, 10); ctx.fill();
  // whale mouth grille at the nose
  ctx.fillStyle = "#121418";
  ctx.beginPath(); ctx.moveTo(L, 6); ctx.quadraticCurveTo(L - 30, 26, L - 70, 22); ctx.lineTo(L - 70, 16); ctx.quadraticCurveTo(L - 30, 18, L, 2); ctx.fill();
  ctx.fillStyle = "#e7e2d2";
  for (let x = L - 66; x < L - 4; x += 8) ctx.fillRect(x, 16, 3, 5);
  ctx.restore();
  // eye
  ctx.fillStyle = "#ffcf4a";
  ellipse(ctx, L - 60, -6, 9, 6);
  ctx.fill();
  glow(ctx, L - 60, -6, 26, "rgba(255,200,80,.9)", 0.6 + 0.3 * Math.sin(t * 3));
  ctx.fillStyle = "#1a0d06"; ellipse(ctx, L - 58, -6, 3, 5); ctx.fill();
  crowMark(ctx, -40, -8, 18);
  // tail flukes
  ctx.fillStyle = metal(ctx, -60, 60, IRON_D);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(-L + 30, s * 10); ctx.lineTo(-L - 30, s * 62); ctx.lineTo(-L - 44, s * 56); ctx.lineTo(-L - 14, s * 2); ctx.fill();
  }
  // gondola deck
  ctx.fillStyle = metal(ctx, 44, 72, "#3f4652");
  rrect(ctx, -170, 46, 340, 22, 10); ctx.fill();
  ctx.fillStyle = "#ffd98a";
  for (let x = -160; x < 160; x += 14) ctx.fillRect(x, 52, 7, 5);
  // engine pods
  for (const ex of [-200, 200]) {
    ctx.fillStyle = "#30363f";
    rrect(ctx, ex - 16, 26, 32, 14, 6); ctx.fill();
    ctx.save(); ctx.translate(ex, 33); propDisc(ctx, ex > 0 ? 18 : -18, 0, 12, t); ctx.restore();
  }
  ctx.filter = "none";
}

function phoenix(ctx, b, t) {
  hullFlash(ctx, b);
  // swept wings in black with ember edges
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 40, -24);
    ctx.lineTo(s * 260, 10);
    ctx.lineTo(s * 250, 26);
    ctx.lineTo(s * 200, 22);
    ctx.lineTo(s * 180, 34);
    ctx.lineTo(s * 130, 28);
    ctx.lineTo(s * 40, 34);
    ctx.closePath();
    ctx.fillStyle = metal(ctx, -24, 34, "#2c2a33");
    ctx.fill();
    ctx.strokeStyle = "rgba(255,110,40,.8)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(s * 40, -24); ctx.lineTo(s * 260, 10); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.strokeStyle = `rgba(255,150,60,${0.35 + 0.2 * Math.sin(t * 6)})`;
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(s * 60, -20); ctx.lineTo(s * 250, 12); ctx.stroke();
    ctx.restore();
    // engine glows under the wings
    for (const ex of [90, 170]) {
      ctx.fillStyle = "#1a1a20";
      rrect(ctx, s * ex - 14, 24, 28, 12, 5); ctx.fill();
      glow(ctx, s * ex, 36, 20, "rgba(255,140,60,.95)", 0.7 + 0.2 * Math.sin(t * 20 + ex));
    }
  }
  // flight deck hull
  ctx.beginPath();
  ctx.moveTo(-90, -40);
  ctx.lineTo(90, -40);
  ctx.lineTo(110, 0);
  ctx.lineTo(80, 50);
  ctx.lineTo(-80, 50);
  ctx.lineTo(-110, 0);
  ctx.closePath();
  ctx.fillStyle = metal(ctx, -40, 50, "#3a3842");
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,.45)"; ctx.lineWidth = 1;
  for (let x = -80; x <= 80; x += 20) { ctx.beginPath(); ctx.moveTo(x, -40); ctx.lineTo(x * 0.9, 50); ctx.stroke(); }
  // deck runway stripes
  ctx.fillStyle = "rgba(255,210,90,.7)";
  for (let x = -80; x < 80; x += 18) ctx.fillRect(x, -32, 9, 2);
  // the phoenix crest: a burning core
  const pulse = 0.6 + 0.4 * Math.sin(t * 3);
  glow(ctx, 0, 6, 60, "rgba(255,90,30,.9)", 0.5 * pulse + 0.3);
  ctx.fillStyle = "#ffcf6a";
  ctx.beginPath();
  ctx.moveTo(0, -16); ctx.lineTo(14, 8); ctx.lineTo(0, 22); ctx.lineTo(-14, 8); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff6dc";
  ellipse(ctx, 0, 6, 5, 7); ctx.fill();
  // bridge tower
  ctx.fillStyle = metal(ctx, -64, -36, "#2a2830");
  rrect(ctx, 40, -66, 30, 30, 4); ctx.fill();
  ctx.fillStyle = "#ffd98a";
  for (let i = 0; i < 3; i++) ctx.fillRect(44 + i * 9, -60, 5, 4);
  if (Math.sin(t * 6) > 0.2) glow(ctx, 55, -70, 10, "rgba(255,50,50,1)");
  ctx.filter = "none";
}

// ------------------------------------------------------------------ friendly chopper, crates, troops

export function drawSupply(ctx, s, t) {
  ctx.save();
  ctx.translate(s.x, s.y);
  ctx.scale(s.dir, 1);
  ctx.rotate(0.08);
  // tail
  ctx.fillStyle = metal(ctx, -6, 2, "#3c6aa8");
  ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-44, -3); ctx.lineTo(-46, 1); ctx.lineTo(-10, 4); ctx.fill();
  ctx.fillStyle = "#fff"; ctx.fillRect(-46, -12, 4, 10);
  // body
  ctx.beginPath();
  ctx.moveTo(26, 2);
  ctx.quadraticCurveTo(26, -12, 8, -13);
  ctx.lineTo(-14, -11);
  ctx.quadraticCurveTo(-18, 2, -12, 10);
  ctx.lineTo(18, 10);
  ctx.quadraticCurveTo(26, 8, 26, 2);
  ctx.fillStyle = metal(ctx, -13, 10, "#3c6aa8");
  ctx.fill();
  ctx.fillStyle = "#cfe9ff";
  ctx.beginPath(); ctx.moveTo(26, 2); ctx.quadraticCurveTo(26, -9, 13, -11); ctx.lineTo(13, 1); ctx.fill();
  // white cross panel = supply
  ctx.fillStyle = "#fff";
  ctx.fillRect(-6, -6, 12, 4);
  ctx.fillRect(-2, -10, 4, 12);
  ctx.strokeStyle = "#1c2433"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(-14, 15); ctx.lineTo(20, 15); ctx.stroke();
  rotorDisc(ctx, 0, -16, 40, t);
  if (!s.dropped) {
    // crate on a sling
    ctx.strokeStyle = "rgba(30,30,30,.8)"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-2, 10); ctx.lineTo(-8, 24); ctx.moveTo(2, 10); ctx.lineTo(8, 24); ctx.stroke();
    crateBox(ctx, 0, 30, null, t);
  }
  ctx.restore();
  glow(ctx, s.x, s.y + 12, 8, Math.sin(t * 8) > 0 ? "rgba(90,255,140,1)" : "rgba(0,0,0,0)");
}

function crateBox(ctx, x, y, color, t) {
  ctx.save();
  ctx.translate(x, y);
  rrect(ctx, -11, -10, 22, 20, 2);
  ctx.fillStyle = vgrad(ctx, -10, 10, ["#c9a061", "#8a6532"]);
  ctx.fill();
  ctx.strokeStyle = "#4e3818";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(11, 10); ctx.moveTo(11, -10); ctx.lineTo(-11, 10); ctx.stroke();
  if (color) {
    ctx.fillStyle = color;
    ellipse(ctx, 0, 0, 7, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCrate(ctx, c, t, info) {
  if (!c.landed) {
    // parachute
    const sway = Math.sin(t * 2 + c.x) * 0.12;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(sway);
    ctx.strokeStyle = "rgba(255,255,255,.6)";
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const sx of [-24, -10, 10, 24]) { ctx.moveTo(sx, -40); ctx.lineTo(0, -10); }
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-26, -38);
    ctx.quadraticCurveTo(0, -78, 26, -38);
    ctx.quadraticCurveTo(13, -44, 0, -38);
    ctx.quadraticCurveTo(-13, -44, -26, -38);
    ctx.fillStyle = vgrad(ctx, -70, -38, ["#ffffff", info.color]);
    ctx.fill();
    ctx.restore();
  }
  // beacon glow
  const blink = c.landed && c.t > 6 ? (Math.sin(t * 20) > 0 ? 1 : 0.2) : 1;
  ctx.globalAlpha = blink;
  glow(ctx, c.x, c.y, 30, hexA(info.color, 0.55));
  crateBox(ctx, c.x, c.y, info.color, t);
  ctx.fillStyle = "#1a1408";
  ctx.font = "bold 10px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.short, c.x, c.y + 0.5);
  ctx.globalAlpha = 1;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function drawTroop(ctx, tr, t) {
  ctx.save();
  ctx.translate(tr.x, tr.y);
  if (tr.hit > 0) ctx.filter = "brightness(2.5)";
  if (tr.state === "fall") {
    const sway = Math.sin(tr.t * 1.6 + tr.id) * 0.15;
    ctx.rotate(sway);
    ctx.strokeStyle = "rgba(220,220,220,.55)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-14, -34); ctx.lineTo(0, -12); ctx.lineTo(14, -34);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-16, -32);
    ctx.quadraticCurveTo(0, -58, 16, -32);
    ctx.quadraticCurveTo(0, -38, -16, -32);
    ctx.fillStyle = vgrad(ctx, -50, -32, ["#9b8c6a", "#5c5240"]);
    ctx.fill();
    soldier(ctx, 0, -2, 0, tr.dir);
  } else {
    const walk = tr.state === "walk" ? tr.t * 9 : 0;
    soldier(ctx, 0, 0, walk, tr.dir, tr.state === "shoot");
  }
  ctx.restore();
}

function soldier(ctx, x, y, walk, dir, aiming = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(dir, 1);
  const l = Math.sin(walk) * 3;
  ctx.strokeStyle = "#2a2a24";
  ctx.lineWidth = 2.2;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(-l, 0); ctx.moveTo(0, -8); ctx.lineTo(l, 0); ctx.stroke();
  ctx.fillStyle = "#4a4f3a";
  rrect(ctx, -3, -17, 6, 10, 2); ctx.fill();
  ctx.fillStyle = "#d8a77c"; ellipse(ctx, 0, -20, 2.6, 2.8); ctx.fill();
  ctx.fillStyle = "#30342a"; ctx.beginPath(); ctx.arc(0, -21, 3.4, Math.PI, TAU); ctx.fill();
  ctx.strokeStyle = "#151515"; ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (aiming) { ctx.moveTo(-1, -14); ctx.lineTo(9, -16); }
  else { ctx.moveTo(-3, -10); ctx.lineTo(5, -17); }
  ctx.stroke();
  ctx.fillStyle = CRIMSON; ctx.fillRect(-3, -15, 6, 1.5);
  ctx.restore();
}

// ------------------------------------------------------------------ projectiles

export function drawHostile(ctx, h, t) {
  if (h.kind === "bullet" || h.kind === "rifle" || h.kind === "shell") {
    const r = h.kind === "shell" ? 7 : h.kind === "rifle" ? 2.5 : 4;
    glow(ctx, h.x, h.y, r * 3.2, h.kind === "rifle" ? "rgba(255,230,120,.9)" : "rgba(255,70,60,.9)");
    ctx.fillStyle = h.kind === "rifle" ? "#fff2a8" : "#ffe1d0";
    ellipse(ctx, h.x, h.y, r * 0.75, r * 0.75);
    ctx.fill();
    return;
  }
  ctx.save();
  ctx.translate(h.x, h.y);
  if (h.kind === "bomb") {
    ctx.rotate(Math.atan2(h.vy, h.vx));
    ctx.fillStyle = metal(ctx, -5, 5, "#3b4048");
    ellipse(ctx, 0, 0, 10, 5);
    ctx.fill();
    ctx.fillStyle = "#24282e";
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, -6); ctx.lineTo(-15, 6); ctx.fill();
    ctx.fillStyle = HAZARD; ctx.fillRect(2, -4.6, 2, 9.2);
    // blinking fuse warns the player
    if (Math.sin(t * 22 + h.x) > 0) glow(ctx, 8, 0, 8, "rgba(255,60,40,1)");
  } else if (h.kind === "missile") {
    ctx.rotate(h.heading);
    flame(ctx, -10, 0, 16, 3, t);
    ctx.fillStyle = "#e9e4d4";
    rrect(ctx, -10, -3, 20, 6, 3); ctx.fill();
    ctx.fillStyle = CRIMSON;
    ctx.beginPath(); ctx.moveTo(10, -3); ctx.lineTo(15, 0); ctx.lineTo(10, 3); ctx.fill();
    ctx.fillStyle = "#555"; ctx.fillRect(-10, -6, 4, 12);
    glow(ctx, 0, 0, 16, "rgba(255,80,60,.5)", 0.6);
  }
  ctx.restore();
}

export function drawShot(ctx, s, t) {
  if (s.kind === "shell") {
    const len = 16;
    const sp = Math.hypot(s.vx, s.vy);
    const ux = s.vx / sp;
    const uy = s.vy / sp;
    const gr = ctx.createLinearGradient(s.x, s.y, s.x - ux * len, s.y - uy * len);
    gr.addColorStop(0, "rgba(255,250,220,1)");
    gr.addColorStop(1, "rgba(255,170,40,0)");
    ctx.strokeStyle = gr;
    ctx.lineWidth = 3.2;
    ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * len, s.y - uy * len); ctx.stroke();
    return;
  }
  if (s.kind === "laser") {
    const sp = Math.hypot(s.vx, s.vy);
    const ux = s.vx / sp;
    const uy = s.vy / sp;
    const len = 90;
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(255,60,210,.45)";
    ctx.lineWidth = 7 + s.lvl * 2;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * len, s.y - uy * len); ctx.stroke();
    ctx.strokeStyle = "rgba(255,230,255,1)";
    ctx.lineWidth = 2 + s.lvl * 0.6;
    ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - ux * len, s.y - uy * len); ctx.stroke();
    ctx.restore();
    return;
  }
  if (s.kind === "flak") {
    glow(ctx, s.x, s.y, 12, "rgba(170,255,100,.9)");
    ctx.fillStyle = "#eaffd6";
    ellipse(ctx, s.x, s.y, 3.5, 3.5);
    ctx.fill();
    return;
  }
  if (s.kind === "missile") {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.heading);
    flame(ctx, -6, 0, 14, 2.5, t, "blue");
    ctx.fillStyle = "#dfe9f2";
    rrect(ctx, -6, -2, 12, 4, 2); ctx.fill();
    ctx.fillStyle = "#5cd2ff";
    ctx.fillRect(4, -2, 3, 4);
    ctx.restore();
  }
}

// ------------------------------------------------------------------ backdrops

export const THEMES = {
  paddy: {
    sky: ["#2f4a7d", "#7e7fae", "#f0a57c", "#ffd59a"], sun: { x: 690, y: 300, r: 40, c: "#fff1c8", glow: "rgba(255,190,120,.9)" },
    far: "#7486b3", mid: "#4e6f4e", near: "#2f4a2c", ground: ["#7a5b3a", "#5a4128", "#3c2b1a"], fog: "rgba(255,200,160,.18)",
    light: "rgba(255,200,140,.12)", night: false,
  },
  dunes: {
    sky: ["#2f86c9", "#6fc0e6", "#cfe9ef", "#fbe7c2"], sun: { x: 230, y: 90, r: 34, c: "#ffffff", glow: "rgba(255,250,220,.95)" },
    far: "#e8c48f", mid: "#d99a55", near: "#b8723a", ground: ["#e5c08a", "#c99a62", "#8f6a3e"], fog: "rgba(255,240,210,.22)",
    light: "rgba(255,240,200,.1)", night: false,
  },
  karst: {
    sky: ["#28194a", "#6b2f6b", "#d65a4f", "#ffb36b"], sun: { x: 470, y: 330, r: 52, c: "#ffd7a0", glow: "rgba(255,120,70,.9)" },
    far: "#5a3a73", mid: "#3a2650", near: "#1f1630", ground: ["#5b4a4a", "#3f3236", "#241c22"], fog: "rgba(255,130,110,.18)",
    light: "rgba(255,140,90,.12)", night: false,
  },
  city: {
    sky: ["#050816", "#0d1636", "#1d2452", "#3b2a5e"], sun: { x: 760, y: 110, r: 26, c: "#f2f4ff", glow: "rgba(190,210,255,.6)", moon: true },
    far: "#1b2244", mid: "#141a36", near: "#0b0f22", ground: ["#2a2d38", "#1c1e27", "#101218"], fog: "rgba(120,90,200,.16)",
    light: "rgba(120,160,255,.08)", night: true,
  },
};

const TILE = 1920;

/** Pre-render a stage's parallax layers into tileable canvases. */
export function buildBackdrop(id, W, H, groundY) {
  const th = THEMES[id];
  const r = rng(id.length * 7919 + id.charCodeAt(0) * 31);
  const mk = (h) => {
    const c = document.createElement("canvas");
    c.width = TILE;
    c.height = h;
    return c;
  };

  // sky (static, field-sized)
  const sky = document.createElement("canvas");
  sky.width = W;
  sky.height = H;
  {
    const c = sky.getContext("2d");
    c.fillStyle = vgrad(c, 0, groundY, th.sky);
    c.fillRect(0, 0, W, H);
    if (th.night) {
      for (let i = 0; i < 220; i++) {
        const a = r() * 0.8 + 0.2;
        c.fillStyle = `rgba(255,255,255,${a * (1 - i / 260)})`;
        c.fillRect(r() * W, r() * groundY * 0.75, r() < 0.1 ? 2 : 1, r() < 0.1 ? 2 : 1);
      }
    }
    const s = th.sun;
    glow(c, s.x, s.y, s.r * 7, s.glow, 0.55);
    glow(c, s.x, s.y, s.r * 2.4, s.glow, 0.9);
    c.fillStyle = s.c;
    ellipse(c, s.x, s.y, s.r, s.r);
    c.fill();
    if (s.moon) {
      c.fillStyle = "rgba(150,160,200,.35)";
      for (const [mx, my, mr] of [[-8, -6, 6], [7, 4, 4], [-2, 10, 3]]) { ellipse(c, s.x + mx, s.y + my, mr, mr); c.fill(); }
    } else {
      // god rays
      c.save();
      c.globalCompositeOperation = "lighter";
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.28 + r() * 0.1;
        const gr = c.createLinearGradient(s.x, s.y, s.x + Math.cos(a) * 600, s.y + Math.sin(a) * 600);
        gr.addColorStop(0, "rgba(255,240,200,.12)");
        gr.addColorStop(1, "rgba(255,240,200,0)");
        c.fillStyle = gr;
        c.beginPath();
        c.moveTo(s.x, s.y);
        c.lineTo(s.x + Math.cos(a - 0.05) * 700, s.y + Math.sin(a - 0.05) * 700);
        c.lineTo(s.x + Math.cos(a + 0.05) * 700, s.y + Math.sin(a + 0.05) * 700);
        c.fill();
      }
      c.restore();
    }
  }

  // clouds layer (tileable)
  const clouds = mk(groundY);
  {
    const c = clouds.getContext("2d");
    const n = th.night ? 7 : 12;
    for (let i = 0; i < n; i++) {
      const cx = r() * TILE;
      const cy = 40 + r() * (groundY * 0.45);
      const s = 0.6 + r() * 1.1;
      for (const ox of [0, -TILE, TILE]) cloud(c, cx + ox, cy, s, th, r);
    }
  }

  const far = mk(groundY);
  const mid = mk(groundY);
  const near = mk(groundY);
  const ground = mk(H - groundY + 20);
  const painters = { paddy: paintPaddy, dunes: paintDunes, karst: paintKarst, city: paintCity };
  painters[id](far.getContext("2d"), mid.getContext("2d"), near.getContext("2d"), groundY, th, r);
  paintGround(ground.getContext("2d"), id, th, r, H - groundY + 20);

  return {
    theme: th,
    sky,
    layers: [
      { canvas: clouds, speed: 8, parallax: 0.01, y: 0 },
      { canvas: far, speed: 6, parallax: 0.02, y: 0 },
      { canvas: mid, speed: 16, parallax: 0.05, y: 0 },
      { canvas: near, speed: 34, parallax: 0.1, y: 0 },
    ],
    ground: { canvas: ground, speed: 60, parallax: 0, y: groundY - 10 },
  };
}

function cloud(c, x, y, s, th, r) {
  const base = th.night ? "rgba(60,70,120,.35)" : th === THEMES.karst ? "rgba(255,170,150,.5)" : "rgba(255,255,255,.75)";
  const shadow = th.night ? "rgba(20,24,50,.3)" : th === THEMES.karst ? "rgba(120,60,110,.4)" : "rgba(170,180,210,.45)";
  const puffs = 5 + ((r() * 4) | 0);
  for (let i = 0; i < puffs; i++) {
    const px = x + (i - puffs / 2) * 22 * s + r() * 10;
    const py = y + Math.sin(i) * 6 * s;
    const pr = (16 + r() * 18) * s;
    const gr = c.createRadialGradient(px, py - pr * 0.3, pr * 0.2, px, py, pr);
    gr.addColorStop(0, base);
    gr.addColorStop(0.7, shadow);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = gr;
    c.beginPath();
    c.arc(px, py, pr, 0, TAU);
    c.fill();
  }
}

/** A smooth ridge line across the tile that wraps seamlessly (sum of whole-period sines). */
function ridge(c, baseY, amp, color, r, harmonics = [1, 3, 7], bottom = 600, fill = true) {
  const ph = harmonics.map(() => r() * TAU);
  const amps = harmonics.map((h, i) => amp / (i + 1) * (0.6 + r() * 0.6));
  const yAt = (x) => baseY - harmonics.reduce((s, h, i) => s + Math.sin((x / TILE) * TAU * h + ph[i]) * amps[i], 0);
  c.beginPath();
  c.moveTo(0, bottom);
  for (let x = 0; x <= TILE; x += 6) c.lineTo(x, yAt(x));
  c.lineTo(TILE, bottom);
  c.closePath();
  if (fill) { c.fillStyle = color; c.fill(); }
  return yAt;
}

function hazeOver(c, y0, y1, color) {
  const gr = c.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, "rgba(0,0,0,0)");
  gr.addColorStop(1, color);
  c.fillStyle = gr;
  c.fillRect(0, y0, TILE, y1 - y0);
}

function paintPaddy(far, mid, near, gy, th, r) {
  // far blue mountains
  ridge(far, gy - 150, 70, th.far, r, [2, 5, 11], gy);
  ridge(far, gy - 110, 46, shade(th.far, -0.12), r, [3, 7, 13], gy);
  hazeOver(far, gy - 230, gy, th.fog);
  // mid hills with rice terraces
  const yAt = ridge(mid, gy - 70, 40, th.mid, r, [2, 4, 9], gy);
  mid.save();
  mid.clip();
  mid.strokeStyle = "rgba(190,230,120,.25)";
  mid.lineWidth = 1.2;
  for (let k = 0; k < 9; k++) {
    mid.beginPath();
    for (let x = 0; x <= TILE; x += 8) {
      const y = yAt(x) + 8 + k * 7;
      if (x === 0) mid.moveTo(x, y); else mid.lineTo(x, y);
    }
    mid.stroke();
  }
  mid.restore();
  // little trees on the hills
  for (let i = 0; i < 60; i++) {
    const x = r() * TILE;
    const y = yAt(x) + 3;
    mid.fillStyle = shade(th.mid, -0.3);
    ellipse(mid, x, y, 4 + r() * 4, 6 + r() * 5);
    mid.fill();
  }
  hazeOver(mid, gy - 120, gy, "rgba(255,200,160,.12)");
  // near: paddy water strip, dykes, bamboo clumps and stilt houses
  const water = near.createLinearGradient(0, gy - 40, 0, gy);
  water.addColorStop(0, "#d9a88a");
  water.addColorStop(1, "#7aa0b5");
  near.fillStyle = water;
  near.fillRect(0, gy - 36, TILE, 40);
  near.fillStyle = "rgba(255,230,190,.35)";
  for (let i = 0; i < 80; i++) near.fillRect(r() * TILE, gy - 34 + r() * 30, 10 + r() * 30, 1);
  // rice seedlings rows
  near.fillStyle = "#5f8a3a";
  for (let row = 0; row < 4; row++) {
    for (let x = 0; x < TILE; x += 9) {
      const y = gy - 30 + row * 9 + r() * 2;
      near.fillRect(x + (row % 2) * 4, y, 1.5, 5);
    }
  }
  for (let i = 0; i < 9; i++) {
    const x = r() * TILE;
    for (const ox of [0, -TILE, TILE]) bamboo(near, x + ox, gy - 30, r, th);
  }
  for (let i = 0; i < 4; i++) {
    const x = 100 + i * 480 + r() * 100;
    stiltHouse(near, x, gy - 34, th);
  }
  // a farmer's conical hat bobbing in the field
  for (let i = 0; i < 6; i++) {
    const x = r() * TILE;
    near.fillStyle = "#e9d8a6";
    near.beginPath(); near.moveTo(x - 7, gy - 24); near.lineTo(x, gy - 31); near.lineTo(x + 7, gy - 24); near.fill();
    near.fillStyle = "#3b4a5a"; near.fillRect(x - 2, gy - 24, 4, 6);
  }
}

function bamboo(c, x, base, r, th) {
  const n = 5 + ((r() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const bx = x + (i - n / 2) * 4;
    const h = 70 + r() * 60;
    const lean = (r() - 0.5) * 24;
    c.strokeStyle = shade(th.near, 0.1 + r() * 0.15);
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(bx, base);
    c.quadraticCurveTo(bx + lean * 0.3, base - h * 0.6, bx + lean, base - h);
    c.stroke();
    c.fillStyle = shade(th.near, 0.05 + r() * 0.2);
    for (let k = 0; k < 6; k++) {
      const ly = base - h * (0.45 + k * 0.1);
      const lx = bx + lean * (0.45 + k * 0.1);
      ellipse(c, lx + (k % 2 ? 7 : -7), ly, 9, 2.4, k % 2 ? 0.4 : -0.4);
      c.fill();
    }
  }
}

function stiltHouse(c, x, base, th) {
  c.fillStyle = shade(th.near, -0.2);
  for (const px of [-22, -8, 8, 22]) c.fillRect(x + px, base - 18, 3, 18);
  c.fillStyle = "#5a3f26";
  c.fillRect(x - 28, base - 34, 56, 16);
  c.fillStyle = "#ffcf7a";
  c.fillRect(x - 10, base - 30, 7, 6);
  c.fillRect(x + 6, base - 30, 7, 6);
  c.fillStyle = "#6b5233";
  c.beginPath(); c.moveTo(x - 36, base - 32); c.lineTo(x, base - 58); c.lineTo(x + 36, base - 32); c.fill();
  c.strokeStyle = "rgba(255,220,160,.3)";
  c.beginPath(); c.moveTo(x - 36, base - 32); c.lineTo(x, base - 58); c.stroke();
}

function paintDunes(far, mid, near, gy, th, r) {
  // a sliver of sea on the horizon
  far.fillStyle = "#4fa7c9";
  far.fillRect(0, gy - 150, TILE, 30);
  far.fillStyle = "rgba(255,255,255,.5)";
  for (let i = 0; i < 60; i++) far.fillRect(r() * TILE, gy - 148 + r() * 26, 6 + r() * 16, 1);
  ridge(far, gy - 120, 36, th.far, r, [2, 5, 9], gy);
  hazeOver(far, gy - 170, gy, th.fog);
  const yAt = ridge(mid, gy - 70, 46, th.mid, r, [2, 3, 6], gy);
  // wind ripples and lit crests
  mid.save();
  mid.clip();
  mid.strokeStyle = "rgba(255,230,180,.35)";
  for (let k = 0; k < 14; k++) {
    mid.beginPath();
    for (let x = 0; x <= TILE; x += 10) {
      const y = yAt(x) + 10 + k * 6 + Math.sin(x * 0.03 + k) * 2;
      if (x === 0) mid.moveTo(x, y); else mid.lineTo(x, y);
    }
    mid.stroke();
  }
  mid.restore();
  mid.strokeStyle = "rgba(255,245,215,.8)";
  mid.lineWidth = 2;
  mid.beginPath();
  for (let x = 0; x <= TILE; x += 6) { if (x === 0) mid.moveTo(x, yAt(x)); else mid.lineTo(x, yAt(x)); }
  mid.stroke();
  ridge(near, gy - 26, 18, th.near, r, [3, 5, 8], gy);
  for (let i = 0; i < 10; i++) {
    const x = r() * TILE;
    for (const ox of [0, -TILE, TILE]) palm(near, x + ox, gy - 24, 60 + r() * 40, r);
  }
  // round basket boats beached on the sand
  for (let i = 0; i < 5; i++) {
    const x = r() * TILE;
    near.fillStyle = "#4a3320";
    near.beginPath(); near.ellipse(x, gy - 18, 14, 6, 0, 0, Math.PI); near.fill();
    near.strokeStyle = "rgba(255,220,160,.35)";
    near.beginPath(); near.ellipse(x, gy - 18, 14, 3, 0, 0, TAU); near.stroke();
  }
}

function palm(c, x, base, h, r) {
  const lean = (r() - 0.5) * 30;
  c.strokeStyle = "#5a3e22";
  c.lineWidth = 4;
  c.beginPath();
  c.moveTo(x, base);
  c.quadraticCurveTo(x + lean * 0.2, base - h * 0.6, x + lean, base - h);
  c.stroke();
  c.strokeStyle = "rgba(0,0,0,.25)";
  c.lineWidth = 1;
  for (let k = 0.1; k < 1; k += 0.12) {
    const px = x + lean * k * k;
    const py = base - h * k;
    c.beginPath(); c.moveTo(px - 2, py); c.lineTo(px + 2, py - 1); c.stroke();
  }
  const tx = x + lean;
  const ty = base - h;
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (r() - 0.5) * 0.3;
    const len = 26 + r() * 10;
    c.strokeStyle = i % 2 ? "#3f7a3a" : "#2f6230";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(tx, ty);
    c.quadraticCurveTo(tx + Math.cos(a) * len * 0.6, ty + Math.sin(a) * len * 0.6 - 8, tx + Math.cos(a) * len, ty + Math.sin(a) * len * 0.5 + 10);
    c.stroke();
  }
  c.fillStyle = "#5a3e22";
  ellipse(c, tx, ty + 2, 4, 3);
  c.fill();
}

function paintKarst(far, mid, near, gy, th, r) {
  karstRow(far, gy - 40, 14, 120, 230, th.far, r, "rgba(255,150,120,.25)");
  hazeOver(far, gy - 260, gy, th.fog);
  karstRow(mid, gy - 30, 9, 90, 170, th.mid, r, "rgba(255,130,90,.3)");
  // sea with sunset reflections
  const sea = near.createLinearGradient(0, gy - 50, 0, gy);
  sea.addColorStop(0, "#c55a5a");
  sea.addColorStop(1, "#3a2548");
  near.fillStyle = sea;
  near.fillRect(0, gy - 46, TILE, 50);
  near.fillStyle = "rgba(255,200,140,.45)";
  for (let i = 0; i < 140; i++) near.fillRect(r() * TILE, gy - 44 + r() * 40, 8 + r() * 26, 1.2);
  // junk boats with batwing sails
  for (let i = 0; i < 5; i++) {
    const x = 150 + i * 380 + r() * 120;
    junk(near, x, gy - 30, 0.8 + r() * 0.5);
  }
  // rocky shore just behind the road
  ridge(near, gy - 8, 8, th.near, r, [5, 11, 23], gy + 4);
}

function karstRow(c, base, n, wMin, hMax, color, r, rim) {
  for (let i = 0; i < n; i++) {
    const x = (i / n) * TILE + r() * (TILE / n) * 0.6;
    const w = wMin * (0.5 + r() * 0.7);
    const h = hMax * (0.55 + r() * 0.45);
    for (const ox of [0, -TILE, TILE]) {
      const cx = x + ox;
      c.beginPath();
      c.moveTo(cx - w / 2, base + 4);
      c.bezierCurveTo(cx - w * 0.6, base - h * 0.5, cx - w * 0.45, base - h, cx - w * 0.1, base - h);
      c.bezierCurveTo(cx + w * 0.3, base - h * 1.05, cx + w * 0.55, base - h * 0.6, cx + w / 2, base + 4);
      c.closePath();
      c.fillStyle = color;
      c.fill();
      // sunlit rim on the left edge and vegetation tufts on top
      c.strokeStyle = rim;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(cx - w / 2, base);
      c.bezierCurveTo(cx - w * 0.6, base - h * 0.5, cx - w * 0.45, base - h, cx - w * 0.1, base - h);
      c.stroke();
      c.fillStyle = "rgba(20,40,30,.35)";
      for (let k = 0; k < 4; k++) { ellipse(c, cx - w * 0.2 + k * w * 0.12, base - h + 4 + (k % 2) * 3, 8, 4); c.fill(); }
    }
  }
}

function junk(c, x, base, s) {
  c.save();
  c.translate(x, base);
  c.scale(s, s);
  c.fillStyle = "#2a1a1c";
  c.beginPath(); c.moveTo(-26, 0); c.lineTo(26, 0); c.lineTo(20, 8); c.lineTo(-20, 8); c.fill();
  c.fillStyle = "#c2563d";
  for (const [mx, h] of [[-8, 40], [10, 32]]) {
    c.beginPath();
    c.moveTo(mx, -2);
    c.lineTo(mx, -h);
    c.quadraticCurveTo(mx + 18, -h + 4, mx + 16, -4);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(40,10,10,.6)";
    c.lineWidth = 0.8;
    for (let k = 1; k < 5; k++) { c.beginPath(); c.moveTo(mx, -h * (k / 5)); c.lineTo(mx + 16, -h * (k / 5) + 2); c.stroke(); }
  }
  c.restore();
}

function paintCity(far, mid, near, gy, th, r) {
  skyline(far, gy, 140, 260, 26, 60, th.far, r, 0.25, "#6f7fd6");
  hazeOver(far, gy - 300, gy, th.fog);
  skyline(mid, gy, 80, 190, 40, 90, th.mid, r, 0.5, "#ffd36a");
  // near: street lamps, neon signs, power lines
  near.fillStyle = th.near;
  near.fillRect(0, gy - 22, TILE, 26);
  for (let i = 0; i < 16; i++) {
    const x = i * 120 + 40;
    near.fillStyle = "#1a1e30";
    near.fillRect(x, gy - 90, 3, 70);
    near.fillRect(x, gy - 90, 16, 3);
    glow(near, x + 14, gy - 84, 28, "rgba(255,210,140,.8)", 0.7);
    near.fillStyle = "#fff3cc";
    near.fillRect(x + 11, gy - 87, 6, 3);
  }
  const neon = ["#ff3fa4", "#3ff2ff", "#ffe04a", "#7cff6b"];
  const words = ["PHỞ", "CAFÉ", "KARAOKE", "BÁNH MÌ", "HOTEL", "24H"];
  for (let i = 0; i < 9; i++) {
    const x = r() * (TILE - 100) + 50;
    const y = gy - 60 - r() * 60;
    const col = neon[i % neon.length];
    const word = words[i % words.length];
    near.save();
    near.font = "bold 15px system-ui, sans-serif";
    const w = near.measureText(word).width + 14;
    near.fillStyle = "rgba(10,10,25,.85)";
    rrect(near, x - w / 2, y - 12, w, 22, 4);
    near.fill();
    near.shadowColor = col;
    near.shadowBlur = 14;
    near.strokeStyle = col;
    near.lineWidth = 1.5;
    near.stroke();
    near.fillStyle = col;
    near.textAlign = "center";
    near.textBaseline = "middle";
    near.fillText(word, x, y);
    near.restore();
  }
  near.strokeStyle = "rgba(10,10,20,.8)";
  near.lineWidth = 1;
  for (let k = 0; k < 3; k++) {
    near.beginPath();
    for (let x = 0; x <= TILE; x += 120) {
      near.moveTo(x, gy - 140 + k * 6);
      near.quadraticCurveTo(x + 60, gy - 120 + k * 6, x + 120, gy - 140 + k * 6);
    }
    near.stroke();
  }
}

function skyline(c, gy, hMin, hMax, wMin, wMax, color, r, litChance, lit) {
  let x = 0;
  while (x < TILE) {
    const w = wMin + r() * (wMax - wMin);
    const h = hMin + r() * (hMax - hMin);
    const bw = Math.min(w, TILE - x);
    c.fillStyle = shade(color, (r() - 0.5) * 0.2);
    c.fillRect(x, gy - h, bw, h);
    if (r() < 0.3) { c.fillRect(x + bw * 0.4, gy - h - 20, 2, 20); }
    if (r() < 0.25) { c.fillRect(x + 4, gy - h - 8, bw - 8, 8); }
    for (let yy = gy - h + 8; yy < gy - 8; yy += 9) {
      for (let xx = x + 4; xx < x + bw - 6; xx += 8) {
        if (r() < litChance * 0.4) {
          c.fillStyle = r() < 0.8 ? lit : "#9ee7ff";
          c.globalAlpha = 0.5 + r() * 0.5;
          c.fillRect(xx, yy, 4, 5);
          c.globalAlpha = 1;
        }
      }
    }
    x += w + (r() < 0.2 ? 6 : 0);
  }
}

function paintGround(c, id, th, r, h) {
  c.fillStyle = vgrad(c, 0, h, th.ground);
  c.fillRect(0, 10, TILE, h);
  // top lip of the road
  c.fillStyle = shade(th.ground[0], 0.25);
  c.fillRect(0, 9, TILE, 3);
  if (id === "paddy") {
    c.fillStyle = "#4f7a2c";
    for (let x = 0; x < TILE; x += 3) {
      const gh = 3 + r() * 7;
      c.fillRect(x, 11 - gh, 2, gh);
    }
  } else if (id === "dunes") {
    c.strokeStyle = "rgba(255,240,210,.35)";
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      for (let x = 0; x <= TILE; x += 10) {
        const y = 20 + k * 9 + Math.sin((x / TILE) * TAU * 12 + k) * 2;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  } else if (id === "karst") {
    for (let i = 0; i < 90; i++) {
      c.fillStyle = shade(th.ground[1], (r() - 0.5) * 0.4);
      ellipse(c, r() * TILE, 14 + r() * (h - 20), 3 + r() * 8, 2 + r() * 4);
      c.fill();
    }
  } else if (id === "city") {
    c.fillStyle = "rgba(255,220,120,.6)";
    for (let x = 0; x < TILE; x += 80) c.fillRect(x, 40, 40, 3);
    c.fillStyle = "#3a3e4c";
    c.fillRect(0, 10, TILE, 6);
  }
  // tyre ruts
  c.strokeStyle = "rgba(0,0,0,.18)";
  c.lineWidth = 3;
  for (const y of [24, 30]) { c.beginPath(); c.moveTo(0, y); c.lineTo(TILE, y); c.stroke(); }
  // pebbles
  for (let i = 0; i < 260; i++) {
    c.fillStyle = `rgba(${r() < 0.5 ? "0,0,0" : "255,255,255"},${0.06 + r() * 0.1})`;
    c.fillRect(r() * TILE, 12 + r() * (h - 12), 1 + r() * 3, 1 + r() * 2);
  }
}

export const LAYER_TILE = TILE;
