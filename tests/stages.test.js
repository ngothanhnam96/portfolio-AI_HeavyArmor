import test from "node:test";
import assert from "node:assert/strict";
import { BOSSES } from "../src/core/bosses.js";
import { KINDS } from "../src/core/enemies.js";
import { STAGES, scriptSeconds, stageById } from "../src/core/stages.js";

test("four stages with unique ids, a real boss each and the boss last", () => {
  assert.equal(STAGES.length, 4);
  assert.equal(new Set(STAGES.map((s) => s.id)).size, 4);
  for (const s of STAGES) {
    assert.ok(BOSSES[s.boss], `${s.id}: unknown boss ${s.boss}`);
    assert.deepEqual(s.script[s.script.length - 1], ["boss"]);
    assert.equal(stageById(s.id), s);
  }
  assert.equal(new Set(STAGES.map((s) => s.boss)).size, 4);
});

test("every wave names a real enemy kind with a valid side", () => {
  for (const s of STAGES) {
    for (const step of s.script) {
      if (step[0] !== "wave") continue;
      assert.ok(KINDS[step[1]], `${s.id}: unknown kind ${step[1]}`);
      assert.ok(["L", "R", "alt", "rand"].includes(step[4]));
      assert.ok(step[2] >= 1);
    }
  }
});

test("stage scripts run between one and three minutes before the boss", () => {
  for (const s of STAGES) {
    const sec = scriptSeconds(s);
    assert.ok(sec > 60 && sec < 180, `${s.id}: ${sec} s`);
  }
});

test("bosses have hull circles, parts and three phases", () => {
  for (const [id, b] of Object.entries(BOSSES)) {
    assert.ok(b.hull.length >= 3, id);
    assert.ok(b.parts.length >= 3, id);
    assert.equal(b.phases.length, 3, id);
    assert.equal(b.every.length, 3, id);
    assert.ok(b.parts.some((p) => p.guard), `${id}: no guard part`);
  }
});
