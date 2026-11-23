# 02 · Design

## Layout

```
src/core/rng.js        seeded PRNG (mulberry32)
src/core/collide.js    segment-vs-circle, circle-vs-circle, substeps
src/core/stages.js     field size (960 × 540, ground at 470) and 4 stage scripts
src/core/enemies.js    7 aircraft kinds + paratrooper stats
src/core/bosses.js     4 bosses: hull circles, parts, phases, patterns
src/core/weapons.js    upgrade table, caps, crate and workshop rolls, fire intervals
src/core/game.js       createGame() / step() / chooseUpgrade(): the whole simulation
src/core/bot.js        predictive autopilot used by tests and the title demo
src/core/scores.js     high-score table, initials cleaning
src/core/text.js       esc() for markup
src/ui/art.js          tank, aircraft, bosses, troops, crates, projectiles, backdrops
src/ui/render.js       parallax, particles, wrecks, decals, lights, shake, reticle
src/ui/audio.js        synthesised effects and a march loop (menu / battle / boss)
src/ui/fx/             shared post-processing (bloom, grade, flash) and menu styling
src/ui/storage.js      safe localStorage (prefix `heavyarmor:`)
src/main.js            screens, HUD, input, loop, debug hooks
```

## Simulation

`step(game, input)` advances 1/120 s and returns that step's events (`fire`, `kill`, `pop`,
`ground-hit`, `pickup`, `boss-start`, `part-die`, `nuke`, `upgrade`, …). The UI turns events
into sound and particles; it never changes rules.

- **Script.** `wait` pauses the cursor, `wave` queues enemies with gaps and sides, `boss`
  waits for a clear sky (or 14 s) and brings in the boss.
- **Tank.** 250 u/s with acceleration, aim clamped to (−π+0.1, −0.1). Hit box: hull band
  ±40 u plus the turret dome. Short i-frames after a hit, 2.6 s after a respawn.
- **Weapons.** Cannon 900 u/s, 1–5 barrels, interval 0.2 s × (1 − 0.16 × rapid). Laser
  pierces at 2100 u/s. Flak bursts at the aim distance. Homing missiles steer at 6 rad/s.
- **Hostiles.** Bullets (not shootable), bombs (gravity, splash on the road), homing missiles
  (2 HP), rifle shots, boss shells.
- **Troops.** Fall under a chute, walk toward the tank, shoot from 140 u, die under the treads.
- **Supply.** A friendly chopper every 22–30 s drops a crate rolled from what is still useful.
- **Combo.** A kill within 2.2 s adds one; multiplier 1 + 0.04 × combo, capped at ×3.
- **Nuke.** Kills every aircraft and troop, clears projectiles, 40 % to each boss part and 8 %
  to the hull, 1.4 s protection.

## Bosses

Bosses descend, then track the tank with a lazy sway. Phase by hull HP (> 66 %, > 33 %,
rest) picks the hull patterns (aimed, fans, rings, carpet bombing). Parts fire their own
pattern (aimed bursts, chaingun stream, shells, bombs, missiles, paratroopers, fighter
launches). While any guard part lives the hull takes 35 % damage. Death: 2.4 s of explosions.

## Rank

No damage +2 (under half armour +1), best combo ≥ 25 +2 (≥ 12 +1), kills ≥ 90 % of spawns +1,
stage score above par +1. 5+ S, 3+ A, 1+ B, else C. Bonus 20 000 / 10 000 / 5 000 / 2 000.

## Rendering

Canvas 2D at a fixed 960 × 540 field scaled to fit. Each stage's sky and four parallax layers
(clouds, far, mid, near) plus the road are pre-rendered once into tileable 1920-wide canvases.
Live layers: searchlights at night, boss ground shadow, scorch decals that scroll with the
road, entities, additive shots, particles (fire, smoke, sparks, debris that bounces, rings,
flashes, dust), falling wrecks trailing smoke that explode on impact, ground light from
explosions, floaters, low-armour vignette, nuke whiteout. The fx kit adds bloom, light
spill, vignette, grain and screen flashes. Shake and particle counts drop with reduced motion.
