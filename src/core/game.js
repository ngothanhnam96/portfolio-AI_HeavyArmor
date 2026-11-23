// The whole simulation: createGame() builds a state, step(game, input) advances it by DT and
// returns the events of that step. Pure and seeded, no DOM: the UI only reads the state and
// turns events into sound and particles.
//
// input = { left, right, fire, aim (radians, -PI..0 is the sky), aimDist, nuke }

import { BOSSES, GUARD_FACTOR, phaseOf } from "./bosses.js";
import { segmentHitsCircle } from "./collide.js";
import { KINDS, TROOP } from "./enemies.js";
import { rng, range } from "./rng.js";
import { FIELD_W as W, GROUND_Y, STAGES } from "./stages.js";
import {
  applyUpgrade, baseKit, cannonInterval, flakInterval, gunPattern, homingInterval,
  laserInterval, rollCrate, rollOffers,
} from "./weapons.js";

export const DT = 1 / 120;
export const TANK = { speed: 250, accel: 1900, halfW: 40, height: 44, minX: 46, maxX: W - 46, pivotY: GROUND_Y - 40, barrel: 42 };
export const AIM_MIN = -Math.PI + 0.1;
export const AIM_MAX = -0.1;

export const DIFFICULTIES = {
  easy: { label: "Dễ", armor: 150, lives: 4, nukes: 3, hp: 0.85, fire: 0.7, bullet: 0.8, dmg: 0.6, boss: 0.8 },
  normal: { label: "Thường", armor: 110, lives: 3, nukes: 2, hp: 1, fire: 1, bullet: 1, dmg: 1, boss: 1 },
  hard: { label: "Khó", armor: 100, lives: 2, nukes: 1, hp: 1.2, fire: 1.3, bullet: 1.2, dmg: 1.3, boss: 1.25 },
};
export const DEFAULT_DIFFICULTY = "normal";
export const COMBO_WINDOW = 2.2;

export function fmt(n) {
  return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function createGame({ seed = 1, difficulty = DEFAULT_DIFFICULTY, mode = "campaign", stage = 0 } = {}) {
  const diff = DIFFICULTIES[difficulty] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
  const g = {
    seed, rand: rng(seed), difficulty, diff, mode,
    time: 0, status: "playing", statusT: 0, loop: 0,
    score: 0, combo: 0, comboT: 0, bestCombo: 0, kills: 0,
    lives: diff.lives,
    tank: {
      x: W / 2, vx: 0, aim: -Math.PI / 2, armor: diff.armor, maxArmor: diff.armor,
      shield: 0, nukes: diff.nukes, iframes: 0, dead: false, respawnT: 0, recoil: 0,
      cd: { gun: 0, laser: 0, flak: 0, homing: 0 }, firing: false, podSide: 1, nukeCd: 0,
    },
    kit: baseKit(),
    enemies: [], shots: [], hostile: [], troops: [], crates: [], queue: [],
    supply: null, supplyT: 7, boss: null, bossPending: false, bossWaitT: 0,
    stageIndex: 0, cursor: 0, waitT: 0, stageTime: 0, stageStats: null,
    stageRanks: [], offers: null, nextId: 1, events: [],
  };
  startStage(g, stage);
  return g;
}

export function startStage(g, index) {
  g.stageIndex = index;
  g.stage = STAGES[index];
  g.cursor = 0;
  g.waitT = 0;
  g.stageTime = 0;
  g.queue = [];
  g.enemies = [];
  g.hostile = [];
  g.troops = [];
  g.shots = [];
  g.crates = [];
  g.supply = null;
  g.supplyT = 9;
  g.boss = null;
  g.bossPending = false;
  g.bossWaitT = 0;
  g.offers = null;
  g.status = "playing";
  g.statusT = 0;
  g.stageStats = { kills: 0, spawned: 0, damage: 0, bestCombo: 0, startScore: g.score, deaths: 0 };
  g.events.push({ type: "stage-start", stage: g.stage.id, index });
}

/** Seconds since the stage began, as a 0–1 bar until the boss arrives. */
export function stageProgress(g) {
  if (g.boss || g.status !== "playing") return 1;
  return Math.min(1, g.cursor / g.stage.script.length);
}

const hpScale = (g) => g.diff.hp * (1 + 0.45 * g.loop);

// ------------------------------------------------------------------ step

export function step(g, input = {}) {
  g.events = [];
  const ev = g.events;
  if (g.status === "game-over" || g.status === "win" || g.status === "upgrade") return ev;
  g.time += DT;
  g.statusT += DT;

  if (g.status === "clear") {
    stepTank(g, { ...input, fire: false, nuke: false });
    stepShots(g);
    stepCrates(g);
    if (g.statusT >= 3.2) finishStage(g);
    return ev;
  }
  if (g.status === "dying") {
    stepWorld(g, {});
    if (g.statusT >= 2.4) {
      g.status = "game-over";
      ev.push({ type: "game-over", score: g.score });
    }
    return ev;
  }

  g.stageTime += DT;
  runScript(g);
  stepWorld(g, input);
  return ev;
}

function stepWorld(g, input) {
  stepTank(g, input);
  stepSupply(g);
  stepEnemies(g);
  if (g.boss) stepBoss(g);
  stepTroops(g);
  stepHostile(g);
  stepShots(g);
  stepCrates(g);
  if (g.comboT > 0) {
    g.comboT -= DT;
    if (g.comboT <= 0) g.combo = 0;
  }
}

// ------------------------------------------------------------------ script

function runScript(g) {
  const script = g.stage.script;
  if (g.waitT > 0) g.waitT -= DT;
  while (g.waitT <= 0 && !g.bossPending && g.cursor < script.length) {
    const s = script[g.cursor++];
    if (s[0] === "wait") g.waitT += s[1];
    else if (s[0] === "boss") g.bossPending = true;
    else if (s[0] === "wave") {
      const [, kind, count, gap, from, opts] = s;
      for (let i = 0; i < count; i++) {
        let side = from;
        if (from === "alt") side = i % 2 ? "R" : "L";
        else if (from === "rand") side = g.rand() < 0.5 ? "L" : "R";
        g.queue.push({ t: i * gap, kind, side, opts });
      }
    }
  }
  for (const q of g.queue) q.t -= DT;
  const ready = g.queue.filter((q) => q.t <= 0);
  if (ready.length) {
    g.queue = g.queue.filter((q) => q.t > 0);
    for (const q of ready) spawnEnemy(g, q.kind, q.side, q.opts);
  }
  if (g.bossPending && !g.boss) {
    g.bossWaitT += DT;
    if ((g.enemies.length === 0 && g.queue.length === 0) || g.bossWaitT > 14) spawnBoss(g);
  }
}

export function spawnEnemy(g, kind, side = "L", opts = {}) {
  const k = KINDS[kind];
  const dir = side === "L" ? 1 : -1;
  const hp = Math.round(k.hp * hpScale(g));
  const y = opts.y ?? range(g.rand, k.y[0], k.y[1]);
  const e = {
    id: g.nextId++, kind, dir, x: dir > 0 ? -70 : W + 70, y, baseY: y, vx: dir * k.speed, vy: 0,
    hp, maxHp: hp, r: k.r, t: 0, hit: 0, fireT: range(g.rand, 0.4, 1.2) * (k.fire || 1), state: 0,
    tx: range(g.rand, 140, W - 140), ty: y, drops: [], diveX: 0, shots: 0,
  };
  if (kind === "dive" || kind === "diver") e.diveX = clamp(g.tank.x + range(g.rand, -120, 120), 120, W - 120);
  if (kind === "transport") e.drops = [range(g.rand, 150, 330), range(g.rand, 380, 580), range(g.rand, 630, 810)].map((x) => (dir > 0 ? x : W - x));
  if (kind === "heli") { e.x = dir > 0 ? -60 : W + 60; e.ty = y; }
  g.enemies.push(e);
  g.stageStats.spawned++;
  return e;
}

function spawnBoss(g) {
  const def = BOSSES[g.stage.boss];
  const hp = Math.round(def.hp * g.diff.boss * (1 + 0.45 * g.loop));
  g.boss = {
    id: g.stage.boss, def, x: W / 2, y: -170, hp, maxHp: hp, t: 0, entering: true, dying: 0, hit: 0,
    fireT: 2.5, phase: 0, vx: 0,
    parts: def.parts.map((p) => ({ ...p, hp: Math.round(p.hp * g.diff.boss * (1 + 0.45 * g.loop)), maxHp: Math.round(p.hp * g.diff.boss * (1 + 0.45 * g.loop)), alive: true, cd: p.every * 0.7, hit: 0 })),
  };
  g.bossPending = false;
  g.events.push({ type: "boss-start", boss: g.boss.id, name: def.name });
}

// ------------------------------------------------------------------ tank

function stepTank(g, input) {
  const t = g.tank;
  const ev = g.events;
  if (t.dead) {
    t.respawnT -= DT;
    if (t.respawnT <= 0 && g.status === "playing" || (t.respawnT <= 0 && g.status === "clear")) {
      t.dead = false;
      t.armor = t.maxArmor;
      t.iframes = 2.6;
      t.x = W / 2;
      t.vx = 0;
      ev.push({ type: "respawn", x: t.x });
    }
    return;
  }
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const target = dir * TANK.speed;
  const dv = target - t.vx;
  const maxDv = TANK.accel * DT;
  t.vx += Math.max(-maxDv, Math.min(maxDv, dv));
  t.x += t.vx * DT;
  if (t.x < TANK.minX) { t.x = TANK.minX; t.vx = 0; }
  if (t.x > TANK.maxX) { t.x = TANK.maxX; t.vx = 0; }
  if (Number.isFinite(input.aim)) t.aim = clamp(input.aim, AIM_MIN, AIM_MAX);
  if (t.iframes > 0) t.iframes -= DT;
  if (t.recoil > 0) t.recoil = Math.max(0, t.recoil - DT * 6);
  for (const k in t.cd) if (t.cd[k] > 0) t.cd[k] -= DT;
  if (t.nukeCd > 0) t.nukeCd -= DT;
  t.firing = !!input.fire;

  if (input.nuke && t.nukes > 0 && t.nukeCd <= 0) nuke(g);
  if (!input.fire) return;

  const px = t.x;
  const py = TANK.pivotY;
  const ca = Math.cos(t.aim);
  const sa = Math.sin(t.aim);
  const tipX = px + ca * TANK.barrel;
  const tipY = py + sa * TANK.barrel;
  const kit = g.kit;

  if (t.cd.gun <= 0) {
    t.cd.gun += cannonInterval(kit.rapid);
    if (t.cd.gun < 0) t.cd.gun = 0;
    for (const p of gunPattern(kit.gun)) {
      const a = t.aim + p.a;
      const ox = -sa * p.o;
      const oy = ca * p.o;
      g.shots.push({ kind: "shell", x: tipX + ox, y: tipY + oy, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, dmg: 6, r: 3, life: 1.2 });
    }
    t.recoil = 1;
    ev.push({ type: "fire", x: tipX, y: tipY, aim: t.aim, n: kit.gun });
  }
  if (kit.laser > 0 && t.cd.laser <= 0) {
    t.cd.laser = laserInterval(kit.laser);
    g.shots.push({ kind: "laser", x: tipX, y: tipY, vx: ca * 2100, vy: sa * 2100, dmg: 8 + 6 * kit.laser, r: 4, life: 0.6, pierce: true, hitIds: new Set(), lvl: kit.laser });
    ev.push({ type: "laser", x: tipX, y: tipY, aim: t.aim, lvl: kit.laser });
  }
  if (kit.flak > 0 && t.cd.flak <= 0) {
    t.cd.flak = flakInterval(kit.flak);
    const dist = clamp(Number.isFinite(input.aimDist) ? input.aimDist : 300, 110, 560);
    g.shots.push({ kind: "flak", x: tipX, y: tipY, vx: ca * 700, vy: sa * 700, dmg: 14 + 6 * kit.flak, r: 5, life: dist / 700, splash: 48 + 10 * kit.flak });
    ev.push({ type: "flak-fire", x: tipX, y: tipY });
  }
  if (kit.homing > 0 && t.cd.homing <= 0) {
    t.cd.homing = homingInterval(kit.homing);
    for (let i = 0; i < kit.homing; i++) {
      t.podSide = -t.podSide;
      const sx = px + t.podSide * 24;
      g.shots.push({ kind: "missile", x: sx, y: GROUND_Y - 38, vx: t.podSide * 60, vy: -380 - i * 40, dmg: 14, r: 4, life: 3.2, target: null, heading: -Math.PI / 2 + t.podSide * 0.25 });
    }
    ev.push({ type: "missile-fire", x: px, y: GROUND_Y - 38 });
  }
}

function nuke(g) {
  const t = g.tank;
  t.nukes--;
  t.nukeCd = 1.2;
  t.iframes = Math.max(t.iframes, 1.4);
  g.events.push({ type: "nuke", x: t.x });
  for (const h of g.hostile) g.events.push({ type: "pop", x: h.x, y: h.y, kind: h.kind });
  g.hostile = [];
  for (const e of [...g.enemies]) damageEnemy(g, e, 999, "nuke");
  for (const tr of [...g.troops]) killTroop(g, tr, "nuke");
  if (g.boss && !g.boss.entering && !g.boss.dying) {
    for (const p of g.boss.parts) if (p.alive) damagePart(g, p, p.maxHp * 0.4);
    damageBoss(g, g.boss.maxHp * 0.08, true);
  }
}

export function hurtTank(g, dmg, x = g.tank.x, y = GROUND_Y - 30) {
  const t = g.tank;
  if (t.dead || t.iframes > 0 || g.status !== "playing") return false;
  if (t.shield > 0) {
    t.shield--;
    t.iframes = 0.6;
    g.events.push({ type: "shield-hit", x, y });
    return true;
  }
  const real = dmg * g.diff.dmg;
  t.armor -= real;
  t.iframes = 0.18;
  g.stageStats.damage += real;
  g.events.push({ type: "hurt", x, y, dmg: real });
  if (t.armor <= 0) killTank(g);
  return true;
}

function killTank(g) {
  const t = g.tank;
  t.armor = 0;
  t.dead = true;
  t.respawnT = 2.2;
  g.lives--;
  g.stageStats.deaths++;
  g.combo = 0;
  g.kit.gun = Math.max(1, g.kit.gun - 1);
  g.kit.rapid = Math.max(0, g.kit.rapid - 1);
  g.events.push({ type: "tank-die", x: t.x, y: GROUND_Y - 24 });
  if (g.lives <= 0) {
    g.status = "dying";
    g.statusT = 0;
  }
}

// ------------------------------------------------------------------ supply chopper

function stepSupply(g) {
  if (g.status !== "playing") return;
  if (!g.supply) {
    g.supplyT -= DT;
    if (g.supplyT <= 0) {
      const dir = g.rand() < 0.5 ? 1 : -1;
      g.supply = { x: dir > 0 ? -80 : W + 80, y: 62, dir, dropX: range(g.rand, 160, W - 160), dropped: false, t: 0 };
      g.supplyT = range(g.rand, 22, 30);
      g.events.push({ type: "supply-in" });
    }
    return;
  }
  const s = g.supply;
  s.t += DT;
  s.x += s.dir * 170 * DT;
  if (!s.dropped && (s.dir > 0 ? s.x >= s.dropX : s.x <= s.dropX)) {
    s.dropped = true;
    const type = rollCrate(g.rand, g.tank, g.kit);
    g.crates.push({ x: s.x, y: s.y + 26, vy: 66, type, landed: false, t: 0 });
    g.events.push({ type: "crate-drop", x: s.x, y: s.y + 26, item: type });
  }
  if (s.x < -120 || s.x > W + 120) g.supply = null;
}

function stepCrates(g) {
  const t = g.tank;
  for (const c of g.crates) {
    c.t += DT;
    if (!c.landed) {
      c.y += c.vy * DT;
      if (c.y >= GROUND_Y - 14) { c.y = GROUND_Y - 14; c.landed = true; c.t = 0; g.events.push({ type: "crate-land", x: c.x }); }
    }
    if (!t.dead && c.y > GROUND_Y - 90 && Math.abs(c.x - t.x) < 46) {
      c.gone = true;
      applyUpgrade(t, g.kit, c.type);
      addScore(g, 250, c.x, c.y, false);
      g.events.push({ type: "pickup", item: c.type, x: c.x, y: c.y });
    }
    if (c.landed && c.t > 8) c.gone = true;
  }
  g.crates = g.crates.filter((c) => !c.gone);
}

// ------------------------------------------------------------------ enemies

function stepEnemies(g) {
  const t = g.tank;
  for (const e of g.enemies) {
    const k = KINDS[e.kind];
    e.t += DT;
    if (e.hit > 0) e.hit -= DT;
    const onScreen = e.x > 20 && e.x < W - 20;
    switch (k.move) {
      case "cross": {
        e.x += e.vx * DT;
        e.y = e.baseY + Math.sin(e.t * 2.2 + e.id) * 20;
        e.vy = Math.cos(e.t * 2.2 + e.id) * 44;
        e.fireT -= DT;
        if (onScreen && e.fireT <= 0) {
          e.fireT = k.fire / g.diff.fire;
          aimedBullet(g, e.x, e.y + 8, 0);
        }
        break;
      }
      case "dive": {
        e.x += e.vx * DT;
        const d = (e.x - e.diveX) / 150;
        const prevY = e.y;
        e.y = e.baseY + 230 * Math.exp(-d * d);
        e.vy = (e.y - prevY) / DT;
        if (!e.state && Math.abs(e.x - e.diveX) < 30) {
          e.state = 1;
          g.hostile.push(makeBomb(g, e.x, e.y + 14, e.vx * 0.5, 60));
          aimedBullet(g, e.x, e.y + 10, 0);
        }
        break;
      }
      case "hover": {
        if (e.state === 0) {
          const dx = e.tx - e.x;
          const dy = e.ty - e.y;
          const d = Math.hypot(dx, dy);
          if (d < 6) { e.state = 1; e.t = 0; }
          else { e.vx = (dx / d) * k.speed; e.vy = (dy / d) * k.speed; e.x += e.vx * DT; e.y += e.vy * DT; }
        } else if (e.state === 1) {
          e.vx = Math.sin(e.t * 0.9) * 30;
          e.vy = Math.cos(e.t * 1.7) * 14;
          e.x += e.vx * DT;
          e.y += e.vy * DT;
          // drift toward the tank a little
          e.x += clamp(t.x - e.x, -1, 1) * 18 * DT;
          e.fireT -= DT;
          if (e.fireT <= 0) {
            e.fireT = k.fire / g.diff.fire;
            e.shots = 3;
            e.burstT = 0;
          }
          if (e.shots > 0) {
            e.burstT -= DT;
            if (e.burstT <= 0) { e.burstT = 0.14; e.shots--; aimedBullet(g, e.x, e.y + 14, (e.shots - 1) * 0.06); }
          }
          if (e.t > k.stay) { e.state = 2; e.vx = e.dir * 160; e.vy = -90; }
        } else {
          e.x += e.vx * DT;
          e.y += e.vy * DT;
          e.vx += e.dir * 60 * DT;
        }
        break;
      }
      case "bomber": {
        e.x += e.vx * DT;
        e.vy = 0;
        e.fireT -= DT;
        if (e.x > 50 && e.x < W - 50 && e.fireT <= 0) {
          e.fireT = k.fire / g.diff.fire;
          g.hostile.push(makeBomb(g, e.x, e.y + 22, e.vx * 0.7, 30));
        }
        break;
      }
      case "transport": {
        e.x += e.vx * DT;
        if (e.drops.length && (e.dir > 0 ? e.x >= e.drops[0] : e.x <= e.drops[0])) {
          e.drops.shift();
          spawnTroop(g, e.x, e.y + 18);
        }
        break;
      }
      case "jet": {
        e.x += e.vx * DT;
        e.y = e.baseY + Math.sin(e.t * 1.5) * 10;
        if (e.shots < 1 && Math.abs(e.x - t.x) < 320 && onScreen) {
          e.shots++;
          g.hostile.push(makeMissile(g, e.x, e.y + 10, e.vx * 0.4));
        }
        break;
      }
      case "blimp": {
        e.x += e.vx * DT;
        e.y = e.baseY + Math.sin(e.t * 0.8) * 8;
        e.fireT -= DT;
        if (onScreen && e.fireT <= 0) {
          e.fireT = k.fire / g.diff.fire;
          for (let i = -1; i <= 1; i++) g.hostile.push(makeBomb(g, e.x + i * 26, e.y + 40, e.vx + i * 40, 20));
          aimedBullet(g, e.x, e.y + 44, 0);
        }
        break;
      }
    }
    if (e.x < -160 || e.x > W + 160 || e.y < -200) e.gone = true;
  }
  g.enemies = g.enemies.filter((e) => !e.gone);
}

function aimedBullet(g, x, y, spread = 0, speed = 230, kind = "bullet") {
  const t = g.tank;
  const a = Math.atan2(GROUND_Y - 26 - y, t.x - x) + spread;
  const sp = speed * g.diff.bullet;
  g.hostile.push({ kind, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: kind === "shell" ? 7 : 4, dmg: kind === "shell" ? 16 : 8, hp: 0, t: 0 });
}

function makeBomb(g, x, y, vx, vy) {
  return { kind: "bomb", x, y, vx, vy, r: 7, dmg: 24, hp: 1, t: 0, splash: 52 };
}

function makeMissile(g, x, y, vx) {
  return { kind: "missile", x, y, vx, vy: 90, r: 6, dmg: 22, hp: 2, t: 0, heading: Math.atan2(90, vx) };
}

function spawnTroop(g, x, y) {
  g.troops.push({ id: g.nextId++, x, y, vy: TROOP.fall, state: "fall", hp: TROOP.hp, t: 0, fireT: 1, dir: 1, hit: 0 });
  g.events.push({ type: "troop-drop", x, y });
}

// ------------------------------------------------------------------ troops

function stepTroops(g) {
  const t = g.tank;
  for (const tr of g.troops) {
    tr.t += DT;
    if (tr.hit > 0) tr.hit -= DT;
    if (tr.state === "fall") {
      tr.y += tr.vy * DT;
      tr.x += Math.sin(tr.t * 1.6 + tr.id) * 12 * DT;
      if (tr.y >= GROUND_Y) { tr.y = GROUND_Y; tr.state = "walk"; tr.t = 0; g.events.push({ type: "troop-land", x: tr.x }); }
      continue;
    }
    if (t.dead) continue;
    const dx = t.x - tr.x;
    tr.dir = Math.sign(dx) || 1;
    if (Math.abs(dx) < TANK.halfW + 6) {
      // crushed under the treads
      killTroop(g, tr, "squash");
      continue;
    }
    if (Math.abs(dx) > TROOP.range) {
      tr.state = "walk";
      tr.x += tr.dir * TROOP.walk * DT;
    } else {
      tr.state = "shoot";
      tr.fireT -= DT;
      if (tr.fireT <= 0) {
        tr.fireT = TROOP.fire / g.diff.fire;
        const a = Math.atan2(GROUND_Y - 22 - (tr.y - 14), dx);
        g.hostile.push({ kind: "rifle", x: tr.x + tr.dir * 10, y: tr.y - 14, vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, r: 3, dmg: 4, hp: 0, t: 0 });
        g.events.push({ type: "rifle", x: tr.x, y: tr.y - 14 });
      }
    }
  }
  g.troops = g.troops.filter((tr) => !tr.gone);
}

function killTroop(g, tr, how) {
  if (tr.gone) return;
  tr.gone = true;
  g.kills++;
  g.stageStats.kills++;
  bumpCombo(g);
  addScore(g, TROOP.score * (how === "squash" ? 2 : 1), tr.x, tr.y - 20, true);
  g.events.push({ type: "troop-die", x: tr.x, y: tr.y, how, falling: tr.state === "fall" });
}

// ------------------------------------------------------------------ hostile projectiles

function stepHostile(g) {
  const t = g.tank;
  for (const h of g.hostile) {
    h.t += DT;
    if (h.kind === "bomb") {
      h.vy += 300 * DT;
    } else if (h.kind === "missile") {
      const want = Math.atan2(GROUND_Y - 24 - h.y, t.x - h.x);
      let d = want - h.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      h.heading += clamp(d, -1.5 * DT, 1.5 * DT);
      const sp = Math.min(240, 120 + h.t * 90) * g.diff.bullet;
      h.vx = Math.cos(h.heading) * sp;
      h.vy = Math.sin(h.heading) * sp;
      if (h.t > 7) h.gone = true;
    }
    h.x += h.vx * DT;
    h.y += h.vy * DT;
    if (!t.dead && tankContains(t, h.x, h.y, h.r)) {
      h.gone = true;
      hurtTank(g, h.dmg, h.x, h.y);
      if (h.kind !== "bullet" && h.kind !== "rifle") g.events.push({ type: "blast", x: h.x, y: h.y, size: h.kind === "bomb" ? 1 : 0.8 });
      else g.events.push({ type: "spark", x: h.x, y: h.y });
      continue;
    }
    if (h.y >= GROUND_Y - 2) {
      h.gone = true;
      if (h.kind === "bomb" || h.kind === "missile" || h.kind === "shell") {
        g.events.push({ type: "ground-hit", x: h.x, y: GROUND_Y, size: h.kind === "bomb" ? 1 : 0.7 });
        const splash = h.splash ?? 40;
        if (!t.dead && Math.abs(h.x - t.x) < splash + TANK.halfW * 0.5) hurtTank(g, h.dmg * 0.55, h.x, GROUND_Y - 10);
        for (const tr of g.troops) if (tr.state !== "fall" && Math.abs(tr.x - h.x) < splash) killTroop(g, tr, "blast");
      } else {
        g.events.push({ type: "dust", x: h.x, y: GROUND_Y });
      }
    }
    if (h.x < -60 || h.x > W + 60 || h.y < -80) h.gone = true;
  }
  g.hostile = g.hostile.filter((h) => !h.gone);
}

export function tankContains(t, x, y, r = 0) {
  const dx = Math.abs(x - t.x);
  if (y > GROUND_Y + 2 + r) return false;
  if (y > GROUND_Y - 26 - r) return dx < TANK.halfW + r;
  // the turret dome
  if (y > GROUND_Y - TANK.height - 8 - r) return dx < 22 + r;
  return false;
}

// ------------------------------------------------------------------ player shots

function stepShots(g) {
  for (const s of g.shots) {
    s.life -= DT;
    if (s.kind === "missile") steerMissile(g, s);
    const from = { x: s.x, y: s.y };
    s.x += s.vx * DT;
    s.y += s.vy * DT;
    const to = { x: s.x, y: s.y };
    if (s.kind === "flak") {
      if (s.life <= 0 || hitsAnything(g, from, to, s.r)) { flakBurst(g, s); s.gone = true; }
      continue;
    }
    collideShot(g, s, from, to);
    if (s.life <= 0 || s.y < -40 || s.x < -40 || s.x > W + 40 || s.y > GROUND_Y) {
      if (!s.gone && s.y > GROUND_Y) g.events.push({ type: "dust", x: s.x, y: GROUND_Y });
      s.gone = true;
    }
  }
  g.shots = g.shots.filter((s) => !s.gone);
}

function steerMissile(g, s) {
  if (s.t0 === undefined) s.t0 = 0;
  s.t0 += DT;
  if (!s.target || s.target.gone || s.target.hp <= 0 || (s.target.alive === false)) s.target = nearestTarget(g, s.x, s.y);
  const sp = Math.min(620, 380 + s.t0 * 500);
  if (s.target && s.t0 > 0.12) {
    const tx = s.target.bx ?? s.target.x;
    const ty = s.target.by ?? s.target.y;
    const want = Math.atan2(ty - s.y, tx - s.x);
    let d = want - s.heading;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    s.heading += clamp(d, -6 * DT, 6 * DT);
  }
  s.vx = Math.cos(s.heading) * sp;
  s.vy = Math.sin(s.heading) * sp;
}

function nearestTarget(g, x, y) {
  let best = null;
  let bd = Infinity;
  const consider = (o, ox, oy) => {
    const d = (ox - x) ** 2 + (oy - y) ** 2;
    if (d < bd) { bd = d; best = o; }
  };
  for (const e of g.enemies) if (e.x > 0 && e.x < W) consider(e, e.x, e.y);
  for (const h of g.hostile) if (h.hp > 0 && h.kind === "missile") consider(h, h.x, h.y - 200);
  const b = g.boss;
  if (b && !b.entering && !b.dying) {
    for (const p of b.parts) if (p.alive) { p.bx = b.x + p.dx; p.by = b.y + p.dy; consider(p, p.bx, p.by); }
    const core = { x: b.x, y: b.y, hp: b.hp, alive: true, isBossCore: true };
    if (!best || best === null) consider(core, b.x, b.y);
  }
  return best;
}

function hitsAnything(g, from, to, r) {
  for (const e of g.enemies) if (segmentHitsCircle(from, to, e.x, e.y, e.r + r)) return true;
  for (const h of g.hostile) if (h.hp > 0 && segmentHitsCircle(from, to, h.x, h.y, h.r + r + 4)) return true;
  const b = g.boss;
  if (b && !b.entering && !b.dying) {
    for (const p of b.parts) if (p.alive && segmentHitsCircle(from, to, b.x + p.dx, b.y + p.dy, p.r + r)) return true;
    for (const c of b.def.hull) if (segmentHitsCircle(from, to, b.x + c.dx, b.y + c.dy, c.r + r)) return true;
  }
  return false;
}

function flakBurst(g, s) {
  g.events.push({ type: "flak", x: s.x, y: s.y, r: s.splash });
  const rr = s.splash;
  for (const e of [...g.enemies]) if (dist2(e.x, e.y, s.x, s.y) < (rr + e.r) ** 2) damageEnemy(g, e, s.dmg, "flak");
  for (const h of g.hostile) if (h.hp > 0 && dist2(h.x, h.y, s.x, s.y) < (rr + h.r) ** 2) popHostile(g, h);
  for (const tr of [...g.troops]) if (dist2(tr.x, tr.y, s.x, s.y) < (rr + 10) ** 2) killTroop(g, tr, "flak");
  const b = g.boss;
  if (b && !b.entering && !b.dying) {
    let hitPart = false;
    for (const p of b.parts) if (p.alive && dist2(b.x + p.dx, b.y + p.dy, s.x, s.y) < (rr + p.r) ** 2) { damagePart(g, p, s.dmg); hitPart = true; }
    if (!hitPart && b.def.hull.some((c) => dist2(b.x + c.dx, b.y + c.dy, s.x, s.y) < (rr * 0.6 + c.r) ** 2)) damageBoss(g, s.dmg);
  }
}

function collideShot(g, s, from, to) {
  const pierce = !!s.pierce;
  const tryHit = (id) => {
    if (!pierce) return true;
    if (s.hitIds.has(id)) return false;
    s.hitIds.add(id);
    return true;
  };
  for (const h of g.hostile) {
    if (h.hp <= 0 || h.gone) continue;
    if (segmentHitsCircle(from, to, h.x, h.y, h.r + s.r + 3) && tryHit("h" + h.t + h.x)) {
      h.hp -= 1;
      if (h.hp <= 0) popHostile(g, h);
      if (!pierce) { s.gone = true; g.events.push({ type: "spark", x: s.x, y: s.y }); return; }
    }
  }
  for (const e of g.enemies) {
    if (e.gone) continue;
    if (segmentHitsCircle(from, to, e.x, e.y, e.r + s.r) && tryHit(e.id)) {
      damageEnemy(g, e, s.dmg, s.kind);
      g.events.push({ type: "spark", x: s.x, y: s.y, kind: s.kind });
      if (!pierce) { s.gone = true; return; }
    }
  }
  for (const tr of g.troops) {
    if (tr.gone) continue;
    const ty = tr.state === "fall" ? tr.y - 4 : tr.y - 10;
    if (segmentHitsCircle(from, to, tr.x, ty, TROOP.r + s.r) && tryHit(tr.id)) {
      tr.hp -= s.dmg;
      tr.hit = 0.08;
      if (tr.hp <= 0) killTroop(g, tr, "shot");
      if (!pierce) { s.gone = true; return; }
    }
  }
  const b = g.boss;
  if (b && !b.entering && !b.dying) {
    for (const p of b.parts) {
      if (!p.alive) continue;
      if (segmentHitsCircle(from, to, b.x + p.dx, b.y + p.dy, p.r + s.r) && tryHit("p" + p.id)) {
        damagePart(g, p, s.dmg);
        g.events.push({ type: "spark", x: s.x, y: s.y, kind: s.kind, metal: true });
        if (!pierce) { s.gone = true; return; }
      }
    }
    for (const c of b.def.hull) {
      if (segmentHitsCircle(from, to, b.x + c.dx, b.y + c.dy, c.r + s.r) && tryHit("core")) {
        damageBoss(g, s.dmg);
        g.events.push({ type: "spark", x: s.x, y: s.y, kind: s.kind, metal: true, armored: guarded(b) });
        if (!pierce) { s.gone = true; return; }
        break;
      }
    }
  }
}

function popHostile(g, h) {
  h.gone = true;
  h.hp = 0;
  addScore(g, h.kind === "missile" ? 60 : 30, h.x, h.y, false);
  g.events.push({ type: "pop", x: h.x, y: h.y, kind: h.kind });
}

export function damageEnemy(g, e, dmg, how = "shell") {
  if (e.gone) return;
  e.hp -= dmg;
  e.hit = 0.07;
  if (e.hp > 0) return;
  e.gone = true;
  const k = KINDS[e.kind];
  g.kills++;
  g.stageStats.kills++;
  bumpCombo(g);
  addScore(g, k.score, e.x, e.y, true);
  g.events.push({ type: "kill", kind: e.kind, x: e.x, y: e.y, vx: e.vx, vy: e.vy, dir: e.dir, big: e.kind === "blimp" || e.kind === "bomber", how });
  if (g.rand() < k.drop * (e.kind === "blimp" ? 1 : 1)) {
    const type = rollCrate(g.rand, g.tank, g.kit);
    g.crates.push({ x: clamp(e.x, 60, W - 60), y: e.y, vy: 66, type, landed: false, t: 0 });
    g.events.push({ type: "crate-drop", x: e.x, y: e.y, item: type });
  }
  g.enemies = g.enemies.filter((x) => !x.gone);
}

// ------------------------------------------------------------------ boss

const guarded = (b) => b.parts.some((p) => p.alive && p.guard);

function damagePart(g, p, dmg) {
  if (!p.alive) return;
  p.hp -= dmg;
  p.hit = 0.07;
  if (p.hp <= 0) {
    p.alive = false;
    const b = g.boss;
    bumpCombo(g);
    addScore(g, 2500, b.x + p.dx, b.y + p.dy, true);
    g.events.push({ type: "part-die", x: b.x + p.dx, y: b.y + p.dy, part: p.id, label: p.label });
  }
}

function damageBoss(g, dmg, raw = false) {
  const b = g.boss;
  if (!b || b.dying) return;
  b.hp -= raw ? dmg : dmg * (guarded(b) ? GUARD_FACTOR : 1);
  b.hit = 0.06;
  if (b.hp <= 0) {
    b.hp = 0;
    b.dying = 0.0001;
    for (const p of b.parts) p.alive = false;
    for (const h of g.hostile) g.events.push({ type: "pop", x: h.x, y: h.y, kind: h.kind });
    g.hostile = [];
    g.events.push({ type: "boss-hit-zero", x: b.x, y: b.y });
  }
}

function stepBoss(g) {
  const b = g.boss;
  const def = b.def;
  b.t += DT;
  if (b.hit > 0) b.hit -= DT;
  for (const p of b.parts) if (p.hit > 0) p.hit -= DT;
  if (b.dying) {
    b.dying += DT;
    b.y += 26 * DT * b.dying;
    if (Math.floor(b.dying * 8) !== Math.floor((b.dying - DT) * 8)) {
      g.events.push({ type: "boss-boom", x: b.x + range(g.rand, -def.w / 2, def.w / 2), y: b.y + range(g.rand, -40, 50) });
    }
    if (b.dying > 2.4) {
      g.events.push({ type: "boss-dead", x: b.x, y: b.y, boss: b.id });
      bumpCombo(g);
      addScore(g, def.score, b.x, b.y, true);
      g.boss = null;
      g.enemies = [];
      g.troops.forEach((tr) => g.events.push({ type: "troop-die", x: tr.x, y: tr.y, how: "flee" }));
      g.troops = [];
      g.status = "clear";
      g.statusT = 0;
      g.supply = null;
    }
    return;
  }
  if (b.entering) {
    b.y += (def.hoverY - b.y) * Math.min(1, DT * 1.4);
    if (Math.abs(b.y - def.hoverY) < 3) { b.entering = false; b.y = def.hoverY; }
    return;
  }
  // track the tank, with a lazy sway
  const want = clamp(g.tank.x + Math.sin(b.t * 0.6) * 160, def.w / 2 - 40, W - def.w / 2 + 40);
  const dv = clamp(want - b.x, -def.speed, def.speed);
  b.vx += (dv - b.vx) * Math.min(1, DT * 2);
  b.x += b.vx * DT;
  b.y = def.hoverY + Math.sin(b.t * 1.3) * 8;
  b.phase = phaseOf(b);

  b.fireT -= DT;
  if (b.fireT <= 0) {
    b.fireT = def.every[b.phase] / g.diff.fire;
    for (const pat of def.phases[b.phase]) firePattern(g, pat, b.x, b.y + 30, b);
  }
  for (const p of b.parts) {
    if (!p.alive) continue;
    p.cd -= DT;
    if (p.cd <= 0) {
      p.cd = p.every / g.diff.fire * (b.phase === 2 ? 0.8 : 1);
      firePattern(g, p.pattern, b.x + p.dx, b.y + p.dy + 8, b);
    }
  }
}

function firePattern(g, pat, x, y, b) {
  const ev = g.events;
  switch (pat) {
    case "aim1": aimedBullet(g, x, y, 0, 240); break;
    case "aim3": for (const s of [-0.12, 0, 0.12]) aimedBullet(g, x, y, s, 240); break;
    case "fan5": for (let i = -2; i <= 2; i++) aimedBullet(g, x, y, i * 0.2, 210); break;
    case "fan7": for (let i = -3; i <= 3; i++) aimedBullet(g, x, y, i * 0.17, 200); break;
    case "ring": {
      for (let i = 0; i < 12; i++) {
        const a = Math.PI * (i / 11) + 0.0;
        const sp = 170 * g.diff.bullet;
        g.hostile.push({ kind: "bullet", x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: 4, dmg: 8, hp: 0, t: 0 });
      }
      break;
    }
    case "stream": {
      for (let i = 0; i < 4; i++) aimedBullet(g, x, y + i * 6, (i - 1.5) * 0.04, 260 + i * 12);
      break;
    }
    case "shell": aimedBullet(g, x, y, 0, 200, "shell"); break;
    case "shellFan": for (const s of [-0.25, 0, 0.25]) aimedBullet(g, x, y, s, 190, "shell"); break;
    case "bombs": for (let i = 0; i < 3; i++) g.hostile.push(makeBomb(g, x + (i - 1) * 18, y + 10, b.vx * 0.6 + (i - 1) * 70, 30)); break;
    case "carpet": {
      for (let i = 0; i < 5; i++) g.hostile.push(makeBomb(g, x, y, (i - 2) * 110, -60 - (i % 2) * 40));
      break;
    }
    case "missile": g.hostile.push(makeMissile(g, x, y, (x < b.x ? -1 : 1) * 80)); break;
    case "troops": spawnTroop(g, x, y); break;
    case "launch": {
      if (g.enemies.length < 6) {
        const e = spawnEnemy(g, "fighter", g.rand() < 0.5 ? "L" : "R");
        e.x = x; e.y = y; e.baseY = range(g.rand, 180, 260);
        e.t = 0;
        g.stageStats.spawned--;
      }
      break;
    }
  }
  ev.push({ type: "boss-fire", pat, x, y });
}

// ------------------------------------------------------------------ stage end

export function stageRank(g) {
  const st = g.stageStats;
  let pts = 0;
  if (st.damage <= 0.001) pts += 2;
  else if (st.damage < g.tank.maxArmor * 0.5) pts += 1;
  if (st.bestCombo >= 25) pts += 2;
  else if (st.bestCombo >= 12) pts += 1;
  if (st.spawned > 0 && st.kills / st.spawned >= 0.9) pts += 1;
  if (g.score - st.startScore >= g.stage.par) pts += 1;
  return pts >= 5 ? "S" : pts >= 3 ? "A" : pts >= 1 ? "B" : "C";
}

const RANK_BONUS = { S: 20000, A: 10000, B: 5000, C: 2000 };

function finishStage(g) {
  const rank = stageRank(g);
  const bonus = RANK_BONUS[rank];
  g.score += bonus;
  g.stageRanks.push({ stage: g.stage.id, rank, bonus, kills: g.stageStats.kills, damage: Math.round(g.stageStats.damage) });
  const last = g.stageIndex === STAGES.length - 1;
  if (last && g.mode === "campaign") {
    g.status = "win";
    g.events.push({ type: "win", score: g.score });
    return;
  }
  g.offers = rollOffers(g.rand, g.tank, g.kit);
  g.status = "upgrade";
  g.events.push({ type: "upgrade", offers: g.offers, rank, bonus });
}

/** Take one workshop offer (or skip with null) and roll into the next stage. */
export function chooseUpgrade(g, id) {
  if (g.status !== "upgrade") return false;
  if (id && g.offers?.includes(id)) applyUpgrade(g.tank, g.kit, id);
  g.tank.armor = Math.min(g.tank.maxArmor, g.tank.armor + g.tank.maxArmor * 0.35);
  let next = g.stageIndex + 1;
  if (next >= STAGES.length) { next = 0; g.loop++; }
  startStage(g, next);
  return true;
}

// ------------------------------------------------------------------ score

function bumpCombo(g) {
  g.combo = g.comboT > 0 ? g.combo + 1 : 1;
  g.comboT = COMBO_WINDOW;
  if (g.combo > g.bestCombo) g.bestCombo = g.combo;
  if (g.combo > g.stageStats.bestCombo) g.stageStats.bestCombo = g.combo;
}

export function comboMultiplier(combo) {
  return 1 + Math.min(combo, 50) * 0.04;
}

function addScore(g, base, x, y, combo) {
  const pts = Math.round(base * (combo ? comboMultiplier(g.combo) : 1));
  g.score += pts;
  g.events.push({ type: "score", x, y, pts });
}

// ------------------------------------------------------------------ helpers

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function dist2(ax, ay, bx, by) {
  return (ax - bx) ** 2 + (ay - by) ** 2;
}

/** Debug: destroy everything in the sky (used by ?debug and by tests). */
export function debugClear(g) {
  for (const e of [...g.enemies]) damageEnemy(g, e, 9999);
  g.queue = [];
  g.cursor = g.stage.script.length - 1;
  g.waitT = 0;
}
