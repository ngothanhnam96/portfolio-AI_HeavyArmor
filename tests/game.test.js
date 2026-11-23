import test from "node:test";
import assert from "node:assert/strict";
import {
  AIM_MAX, AIM_MIN, DT, TANK, chooseUpgrade, comboMultiplier, createGame, damageEnemy, hurtTank,
  spawnEnemy, step, tankContains,
} from "../src/core/game.js";
import { GROUND_Y, STAGES } from "../src/core/stages.js";

const run = (g, input, ticks) => {
  const all = [];
  for (let i = 0; i < ticks; i++) all.push(...step(g, input));
  return all;
};

test("same seed and inputs replay identically; different seeds differ", () => {
  const input = { fire: true, aim: -1.2, right: true };
  const a = createGame({ seed: 9 });
  const b = createGame({ seed: 9 });
  const c = createGame({ seed: 10 });
  run(a, input, 120 * 25);
  run(b, input, 120 * 25);
  run(c, input, 120 * 25);
  assert.equal(a.score, b.score);
  assert.equal(a.tank.x, b.tank.x);
  assert.deepEqual(a.enemies.map((e) => e.y), b.enemies.map((e) => e.y));
  assert.notDeepEqual(a.enemies.map((e) => e.y), c.enemies.map((e) => e.y));
});

test("the tank drives, stops at the edges and clamps its aim to the sky", () => {
  const g = createGame({ seed: 1 });
  const x0 = g.tank.x;
  run(g, { right: true }, 60);
  assert.ok(g.tank.x > x0);
  run(g, { right: true }, 120 * 10);
  assert.equal(g.tank.x, TANK.maxX);
  run(g, { left: true }, 120 * 10);
  assert.equal(g.tank.x, TANK.minX);
  step(g, { aim: 1 });
  assert.equal(g.tank.aim, AIM_MAX);
  step(g, { aim: -4 });
  assert.equal(g.tank.aim, AIM_MIN);
});

test("the cannon fires on its cooldown and more barrels mean more shells", () => {
  const g = createGame({ seed: 1 });
  const ev = run(g, { fire: true, aim: -Math.PI / 2 }, 120);
  const fires = ev.filter((e) => e.type === "fire").length;
  assert.ok(fires >= 4 && fires <= 6, `fired ${fires} times in 1 s`);
  const h = createGame({ seed: 1 });
  h.kit.gun = 5;
  step(h, { fire: true, aim: -1.5 });
  assert.equal(h.shots.filter((s) => s.kind === "shell").length, 5);
});

test("extra systems fire alongside the cannon once levelled", () => {
  const g = createGame({ seed: 1 });
  g.kit.laser = 1; g.kit.flak = 1; g.kit.homing = 2;
  step(g, { fire: true, aim: -1.4 });
  const kinds = new Set(g.shots.map((s) => s.kind));
  for (const k of ["shell", "laser", "flak", "missile"]) assert.ok(kinds.has(k), `no ${k}`);
});

test("a shell kills a fighter and builds score and combo", () => {
  const g = createGame({ seed: 1 });
  g.queue = []; g.cursor = 999; g.enemies = [];
  const e = spawnEnemy(g, "fighter", "L", { y: 200 });
  e.x = g.tank.x;
  e.vx = 0;
  run(g, { fire: true, aim: -Math.PI / 2 }, 120);
  assert.equal(g.enemies.includes(e), false);
  assert.ok(g.score > 0);
  assert.ok(g.kills >= 1);
  assert.ok(g.combo >= 1);
  assert.ok(comboMultiplier(10) > comboMultiplier(1));
});

test("shields absorb a hit, armour runs out, lives end the game", () => {
  const g = createGame({ seed: 1, difficulty: "normal" });
  g.tank.shield = 1;
  assert.equal(hurtTank(g, 50), true);
  assert.equal(g.tank.shield, 0);
  assert.equal(g.tank.armor, g.tank.maxArmor);
  g.tank.iframes = 0;
  hurtTank(g, 999);
  assert.equal(g.tank.dead, true);
  assert.equal(g.lives, 2);
  run(g, {}, 120 * 3);
  assert.equal(g.tank.dead, false, "respawned");
  g.lives = 1;
  g.tank.iframes = 0;
  hurtTank(g, 999);
  run(g, {}, 120 * 3);
  assert.equal(g.status, "game-over");
});

test("a nuke clears the sky and needs stock", () => {
  const g = createGame({ seed: 1 });
  for (let i = 0; i < 4; i++) spawnEnemy(g, "bomber", "L").x = 300 + i * 40;
  g.hostile.push({ kind: "bomb", x: 400, y: 200, vx: 0, vy: 0, r: 7, dmg: 24, hp: 1, t: 0 });
  const n0 = g.tank.nukes;
  step(g, { nuke: true });
  assert.equal(g.enemies.length, 0);
  assert.equal(g.hostile.length, 0);
  assert.equal(g.tank.nukes, n0 - 1);
  g.tank.nukes = 0;
  g.tank.nukeCd = 0;
  spawnEnemy(g, "bomber", "L");
  step(g, { nuke: true });
  assert.equal(g.enemies.length, 1);
});

test("bombs hurt the tank on impact; shooting one down saves the armour", () => {
  const g = createGame({ seed: 1 });
  g.cursor = 999; g.queue = []; g.supplyT = 999;
  g.hostile.push({ kind: "bomb", x: g.tank.x, y: GROUND_Y - 120, vx: 0, vy: 0, r: 7, dmg: 24, hp: 1, t: 0, splash: 52 });
  run(g, {}, 120);
  assert.ok(g.tank.armor < g.tank.maxArmor);
  const h = createGame({ seed: 1 });
  h.cursor = 999; h.queue = []; h.supplyT = 999;
  h.hostile.push({ kind: "bomb", x: h.tank.x, y: 150, vx: 0, vy: 0, r: 7, dmg: 24, hp: 1, t: 0, splash: 52 });
  run(h, { fire: true, aim: -Math.PI / 2 }, 120 * 2);
  assert.equal(h.tank.armor, h.tank.maxArmor);
});

test("tankContains covers hull and turret but not the sky", () => {
  const t = { x: 400 };
  assert.ok(tankContains(t, 400, GROUND_Y - 10));
  assert.ok(tankContains(t, 430, GROUND_Y - 10));
  assert.ok(tankContains(t, 400, GROUND_Y - 44));
  assert.equal(tankContains(t, 400, GROUND_Y - 120), false);
  assert.equal(tankContains(t, 500, GROUND_Y - 10), false);
});

test("troops land, walk in and get crushed under the treads", () => {
  const g = createGame({ seed: 1 });
  g.cursor = 999; g.queue = []; g.supplyT = 999;
  const tr = spawnEnemy(g, "transport", "L");
  tr.drops = [];
  g.troops.push({ id: 999, x: g.tank.x + 200, y: GROUND_Y - 30, vy: 52, state: "fall", hp: 4, t: 0, fireT: 1, dir: 1, hit: 0 });
  run(g, {}, 120 * 2);
  assert.notEqual(g.troops[0]?.state, "fall");
  const ev = run(g, { right: true }, 120 * 3);
  assert.ok(ev.some((e) => e.type === "troop-die" && e.how === "squash"));
});

test("supply crates land and are picked up by driving over them", () => {
  const g = createGame({ seed: 1 });
  g.crates.push({ x: g.tank.x, y: 300, vy: 66, type: "spread", landed: false, t: 0 });
  const ev = run(g, {}, 120 * 3);
  assert.ok(ev.some((e) => e.type === "pickup" && e.item === "spread"));
  assert.equal(g.kit.gun, 2);
});

test("a cleared stage offers upgrades, a choice starts the next stage", () => {
  const g = createGame({ seed: 1 });
  g.status = "clear";
  g.statusT = 0;
  run(g, {}, 120 * 4);
  assert.equal(g.status, "upgrade");
  assert.equal(g.offers.length, 3);
  assert.equal(g.stageRanks.length, 1);
  assert.equal(chooseUpgrade(g, g.offers[0]), true);
  assert.equal(g.stageIndex, 1);
  assert.equal(g.status, "playing");
});

test("clearing the last stage wins the campaign; endless loops harder", () => {
  const g = createGame({ seed: 1, stage: STAGES.length - 1 });
  g.status = "clear"; g.statusT = 0;
  run(g, {}, 120 * 4);
  assert.equal(g.status, "win");
  const e = createGame({ seed: 1, mode: "endless", stage: STAGES.length - 1 });
  e.status = "clear"; e.statusT = 0;
  run(e, {}, 120 * 4);
  chooseUpgrade(e, null);
  assert.equal(e.stageIndex, 0);
  assert.equal(e.loop, 1);
});

test("guard parts armour the boss hull until they are destroyed", () => {
  const g = createGame({ seed: 1 });
  g.cursor = g.stage.script.length; g.bossPending = true; g.queue = [];
  step(g, {});
  const b = g.boss;
  assert.ok(b, "boss spawned");
  b.entering = false; b.y = b.def.hoverY;
  const shootHull = () => {
    const before = b.hp;
    // a shell straight into the hull centre, clear of the parts below it
    g.shots.push({ kind: "shell", x: b.x, y: b.y - 60, vx: 0, vy: 900, dmg: 10, r: 3, life: 1 });
    step(g, {});
    return before - b.hp;
  };
  const armoured = shootHull();
  for (const p of b.parts) if (p.guard) p.alive = false;
  const bare = shootHull();
  assert.ok(armoured > 0 && bare > armoured * 2, `armoured ${armoured}, bare ${bare}`);
  assert.ok(DT > 0);
  void damageEnemy;
});
