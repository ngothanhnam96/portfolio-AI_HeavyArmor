import test from "node:test";
import assert from "node:assert/strict";
import { rng } from "../src/core/rng.js";
import {
  MAX, UPGRADES, applyUpgrade, baseKit, canTake, cannonInterval, gunPattern, rollCrate, rollOffers,
} from "../src/core/weapons.js";

const tank = () => ({ armor: 100, maxArmor: 100, shield: 0, nukes: 2 });

test("gun pattern grows from one to five barrels", () => {
  for (let lv = 1; lv <= MAX.gun; lv++) assert.equal(gunPattern(lv).length, lv);
  assert.equal(gunPattern(99).length, MAX.gun);
  assert.equal(gunPattern(0).length, 1);
});

test("rapid fire shortens the cannon interval", () => {
  assert.ok(cannonInterval(3) < cannonInterval(0));
  assert.ok(cannonInterval(3) > 0.05);
});

test("upgrades level up and stop at their cap", () => {
  const t = tank();
  const k = baseKit();
  for (let i = 0; i < 10; i++) applyUpgrade(t, k, "spread");
  assert.equal(k.gun, MAX.gun);
  for (let i = 0; i < 10; i++) applyUpgrade(t, k, "homing");
  assert.equal(k.homing, MAX.homing);
  for (let i = 0; i < 10; i++) applyUpgrade(t, k, "shield");
  assert.equal(t.shield, MAX.shield);
  assert.equal(canTake(t, k, "spread"), false);
  assert.equal(canTake(t, k, "repair"), false, "full armour needs no repair");
  t.armor = 20;
  applyUpgrade(t, k, "repair");
  assert.equal(t.armor, 65);
  applyUpgrade(t, k, "armor");
  assert.equal(t.maxArmor, 125);
  assert.equal(t.armor, 125);
});

test("crates and workshop offers never hand out maxed items", () => {
  const r = rng(5);
  const t = tank();
  const k = { gun: MAX.gun, rapid: MAX.rapid, homing: 0, laser: MAX.laser, flak: MAX.flak };
  for (let i = 0; i < 200; i++) {
    const id = rollCrate(r, t, k);
    assert.ok(UPGRADES[id]);
    assert.ok(!["spread", "rapid", "laser", "flak", "repair"].includes(id), id);
  }
  for (let i = 0; i < 50; i++) {
    const offers = rollOffers(r, t, k);
    assert.equal(new Set(offers).size, offers.length);
    for (const id of offers) assert.ok(canTake(t, k, id), id);
  }
});
