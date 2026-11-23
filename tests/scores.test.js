import test from "node:test";
import assert from "node:assert/strict";
import { cleanInitials, cleanScores, DEFAULT_SCORES, insertScore, qualifies, TABLE_SIZE } from "../src/core/scores.js";

test("cleanInitials strips accents, non-letters and length", () => {
  assert.equal(cleanInitials("abc"), "ABC");
  assert.equal(cleanInitials("ABCDE"), "ABC");
  assert.equal(cleanInitials("Nàm Ngô"), "NAM");
  assert.equal(cleanInitials("đỗ"), "DO");
  assert.equal(cleanInitials("<b>x"), "BX");
  assert.equal(cleanInitials(""), "???");
  assert.equal(cleanInitials(null), "???");
  assert.equal(cleanInitials("  !!!  "), "???");
});

test("cleanScores returns defaults from nothing or junk", () => {
  assert.deepEqual(cleanScores(null).length, TABLE_SIZE);
  assert.deepEqual(cleanScores("nope").length, TABLE_SIZE);
  assert.deepEqual(cleanScores([{ name: "ZZZ" /* no score */ }]).length, 0);
});

test("cleanScores keeps only valid rows, sorts descending, caps size", () => {
  const raw = [
    { name: "AAA", score: 5 },
    { name: "BBB", score: 10, stage: "city" },
    { score: "nope" },
    null,
    { name: "CCC", score: -1 },
    { name: "DDD", score: 100 },
  ];
  const cleaned = cleanScores(raw);
  assert.deepEqual(cleaned.map((r) => r.name), ["DDD", "BBB", "AAA"]);
  assert.equal(cleaned[1].stage, "city");
});

test("qualifies / insertScore honour the table size", () => {
  const scores = DEFAULT_SCORES.map((s) => ({ ...s }));
  assert.equal(qualifies(scores, 0), false);
  assert.equal(qualifies(scores, 1), false);
  assert.equal(qualifies(scores, 1_000_000), true);
  const added = insertScore(scores, "nnn", 50000, "dunes");
  assert.notEqual(added.place, -1);
  assert.equal(added.scores.length, TABLE_SIZE);
  assert.equal(added.scores[added.place].name, "NNN");
  assert.equal(added.scores[added.place].stage, "dunes");
  // Not mutated.
  assert.notStrictEqual(added.scores, scores);
});
