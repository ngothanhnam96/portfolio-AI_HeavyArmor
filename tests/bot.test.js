// Playability proofs. The bot (src/core/bot.js) plays through the real rules: no invulnerability,
// no state edits, only the inputs a player could press.

import test from "node:test";
import assert from "node:assert/strict";
import { createBot } from "../src/core/bot.js";
import { chooseUpgrade, createGame, step } from "../src/core/game.js";

const SEEDS = [1, 7, 42, 123, 2026];

function playStageOne(seed, difficulty) {
  const g = createGame({ seed, difficulty });
  const bot = createBot();
  let ticks = 0;
  let sawBoss = false;
  while (ticks < 240 * 120 && g.status !== "game-over" && g.status !== "upgrade") {
    step(g, bot(g));
    if (g.boss) sawBoss = true;
    ticks++;
  }
  return { g, sawBoss, seconds: ticks / 120 };
}

for (const difficulty of ["easy", "normal"]) {
  test(`the autopilot clears stage 1 and its boss on ${difficulty} (5 seeds)`, { timeout: 120_000 }, () => {
    for (const seed of SEEDS) {
      const { g, sawBoss, seconds } = playStageOne(seed, difficulty);
      const where = `seed ${seed}: ${seconds.toFixed(1)} s, status ${g.status}`;
      assert.ok(sawBoss, `${where}: never reached the boss`);
      assert.equal(g.status, "upgrade", `${where}: boss not defeated`);
      assert.equal(g.stageRanks.length, 1);
      assert.ok(g.lives >= 1);
    }
  });
}

test("the autopilot finishes the whole campaign on normal", { timeout: 120_000 }, () => {
  const g = createGame({ seed: 42, difficulty: "normal" });
  const bot = createBot();
  let ticks = 0;
  while (ticks < 120 * 60 * 12 && g.status !== "game-over" && g.status !== "win") {
    step(g, bot(g));
    if (g.status === "upgrade") chooseUpgrade(g, g.offers[0]);
    ticks++;
  }
  assert.equal(g.status, "win", `ended ${g.status} on stage ${g.stageIndex}`);
  assert.equal(g.stageRanks.length, 4);
});

test("the same seed and bot replay a stage identically", { timeout: 120_000 }, () => {
  const a = playStageOne(7, "easy");
  const b = playStageOne(7, "easy");
  assert.equal(a.seconds, b.seconds);
  assert.equal(a.g.score, b.g.score);
});

test("firing non-stop at an on-screen boss kills it", { timeout: 60_000 }, () => {
  const g = createGame({ seed: 1, difficulty: "easy" });
  g.cursor = g.stage.script.length;
  g.bossPending = true;
  g.queue = [];
  let ticks = 0;
  while (g.status === "playing" && ticks < 120 * 240) {
    g.tank.iframes = 1; // this test is about boss hit points, not dodging
    const b = g.boss;
    const aim = b ? Math.atan2(b.y - 430, b.x - g.tank.x) : -Math.PI / 2;
    step(g, { fire: true, aim, left: b && b.x < g.tank.x - 10, right: b && b.x > g.tank.x + 10 });
    ticks++;
  }
  assert.equal(g.status, "clear", `boss still alive after ${ticks / 120} s`);
});
