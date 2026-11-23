import test from "node:test";
import assert from "node:assert/strict";
import { circlesOverlap, segmentHitsCircle, substeps } from "../src/core/collide.js";

test("segmentHitsCircle finds the hit even when the whole segment crosses the circle", () => {
  assert.equal(segmentHitsCircle({ x: -10, y: 0 }, { x: 10, y: 0 }, 0, 0, 2), true);
});
test("segmentHitsCircle: segment outside misses", () => {
  assert.equal(segmentHitsCircle({ x: -10, y: 20 }, { x: 10, y: 20 }, 0, 0, 2), false);
});
test("segmentHitsCircle: tangent hit at the start", () => {
  assert.equal(segmentHitsCircle({ x: 2, y: 0 }, { x: 10, y: 0 }, 0, 0, 2.01), true);
});
test("substeps() keeps bullet travel within target radius", () => {
  // 2000 units/s over 1/120 s = ~16.7 units; target radius 5 → need at least 4 steps.
  const n = substeps(2000, 1 / 120, 5);
  assert.ok(n >= 4);
  assert.ok((2000 / 120) / n <= 5);
});

test("circlesOverlap is symmetric", () => {
  assert.equal(circlesOverlap(0, 0, 3, 5, 0, 3), true); // r sum = 6, distance 5
  assert.equal(circlesOverlap(0, 0, 3, 7, 0, 3), false);
  assert.equal(circlesOverlap(5, 0, 3, 0, 0, 3), true);
});
