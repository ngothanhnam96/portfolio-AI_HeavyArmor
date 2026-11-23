// A predictive autopilot. It only reads the state and returns the inputs a player could press,
// so it proves the game is playable in tests and drives the live demo behind the title screen.
//
// Driving: score candidate spots along the road by where incoming fire will land, add a pull
// toward supply crates, and drive toward the safest one. Aiming: shoot down bombs and missiles
// that threaten the tank first, otherwise lead the nearest target.

import { GROUND_Y, FIELD_W as W } from "./stages.js";
import { TANK } from "./game.js";

const SHELL_SPEED = 900;

export function createBot({ nukeAt = 0.3 } = {}) {
  let wobble = 0;
  return function bot(g) {
    const t = g.tank;
    wobble += 1 / 120;
    if (t.dead) return { fire: false };

    // ---- where will hostile fire land?
    const threats = [];
    const hitY = GROUND_Y - 24;
    for (const h of g.hostile) {
      let tLand;
      let xLand;
      if (h.kind === "bomb") {
        // y + vy t + 150 t² = hitY
        const a = 150;
        const b = h.vy;
        const c = h.y - hitY;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        tLand = (-b + Math.sqrt(disc)) / (2 * a);
        xLand = h.x + h.vx * tLand;
      } else if (h.kind === "missile") {
        tLand = Math.max(0.1, (hitY - h.y) / Math.max(60, h.vy));
        xLand = h.x + h.vx * Math.min(tLand, 0.6);
      } else {
        if (h.vy <= 0) continue;
        tLand = (hitY - h.y) / h.vy;
        xLand = h.x + h.vx * tLand;
      }
      if (tLand < 0 || tLand > 3) continue;
      threats.push({ x: xLand, t: tLand, w: h.kind === "bomb" ? 70 : h.kind === "missile" ? 60 : 30, h });
    }

    // ---- pick the safest spot
    let bestX = t.x;
    let bestCost = Infinity;
    for (let x = TANK.minX; x <= TANK.maxX; x += 16) {
      const travel = Math.abs(x - t.x) / TANK.speed;
      let cost = Math.abs(x - t.x) * 0.01;
      for (const th of threats) {
        const near = Math.abs(th.x - x);
        if (near > th.w + TANK.halfW) continue;
        // can we be elsewhere by then? weight imminent hits more
        const arriving = Math.max(0.05, th.t);
        const reachable = travel < th.t ? 1 : 2.5;
        cost += (reachable * (th.w + TANK.halfW - near)) / arriving;
      }
      for (const c of g.crates) {
        const d = Math.abs(c.x - x);
        if (d < 60) cost -= 30 - d * 0.4;
      }
      for (const tr of g.troops) {
        if (tr.state !== "fall" && Math.abs(tr.x - x) < 60) cost -= 8; // run them over
      }
      // stay off the extreme edges
      if (x < 90 || x > W - 90) cost += 4;
      if (cost < bestCost) { bestCost = cost; bestX = x; }
    }
    const jitter = Math.sin(wobble * 0.7) * 6;
    const dx = bestX + jitter - t.x;
    const left = dx < -6;
    const right = dx > 6;

    // ---- aim
    const px = t.x;
    const py = TANK.pivotY;
    let target = null;
    let bestScore = Infinity;
    for (const h of g.hostile) {
      if (h.hp <= 0) continue;
      if (h.y > py - 30) continue;
      const near = Math.abs(h.x - px);
      if (near > 220) continue;
      const s = near * 0.5 + (py - h.y) * 0.3 - 120;
      if (s < bestScore) { bestScore = s; target = { x: h.x, y: h.y, vx: h.vx, vy: h.vy }; }
    }
    for (const e of g.enemies) {
      if (e.x < 10 || e.x > W - 10) continue;
      const s = Math.hypot(e.x - px, e.y - py) * (e.kind === "jet" || e.kind === "heli" ? 0.8 : 1);
      if (s < bestScore) { bestScore = s; target = { x: e.x, y: e.y, vx: e.vx, vy: e.vy }; }
    }
    for (const tr of g.troops) {
      if (tr.state === "fall") {
        const s = Math.hypot(tr.x - px, tr.y - py) + 120;
        if (s < bestScore) { bestScore = s; target = { x: tr.x, y: tr.y, vx: 0, vy: tr.vy }; }
      }
    }
    const b = g.boss;
    if (b && !b.entering && !b.dying) {
      let pt = null;
      for (const p of b.parts) {
        if (!p.alive) continue;
        const d = Math.abs(b.x + p.dx - px);
        if (!pt || d < pt.d) pt = { d, x: b.x + p.dx, y: b.y + p.dy };
      }
      const tx = pt ? pt.x : b.x;
      const ty = pt ? pt.y : b.y;
      const s = Math.hypot(tx - px, ty - py) - 100;
      if (s < bestScore) { bestScore = s; target = { x: tx, y: ty, vx: b.vx, vy: 0 }; }
    }
    let aim = -Math.PI / 2 + Math.sin(wobble * 1.3) * 0.5;
    let aimDist = 300;
    if (target) {
      const d = Math.hypot(target.x - px, target.y - py);
      const lead = d / SHELL_SPEED;
      const ax = target.x + target.vx * lead;
      const ay = target.y + target.vy * lead;
      aim = Math.atan2(ay - py, ax - px);
      aimDist = Math.hypot(ax - px, ay - py);
    }

    const danger = threats.filter((th) => th.t < 0.6 && Math.abs(th.x - t.x) < 50).length;
    const nuke = t.nukes > 0 && t.armor < t.maxArmor * nukeAt && (danger >= 2 || g.enemies.length >= 5 || !!b);
    return { left, right, fire: true, aim, aimDist, nuke };
  };
}
