# 04 · Testing

`npm test` runs `node --test`: 37 tests, no dependencies, about 2 seconds.

| Suite | What it proves |
|-------|----------------|
| `game.test.js` | Replays are exact per seed; driving and aim stay in bounds; the cannon keeps its cooldown and gains barrels; laser, flak and missiles fire once levelled; kills score and combo; shields, armour and lives; nukes need stock and clear the sky; bombs hurt, shot-down bombs don't; the tank hit box; troops crushed by treads; crates collected; stage clear → workshop → next stage; campaign win and endless loop; guard parts armour the boss hull |
| `bot.test.js` | The autopilot clears stage 1 and its boss on Easy and Normal for five seeds, finishes the whole campaign on Normal, replays identically, and a boss always dies to sustained fire |
| `stages.test.js` | Unique stages with a real boss last; every wave names a real enemy; script lengths in range; every boss has hull circles, parts, a guard and three phases |
| `weapons.test.js` | Barrel patterns, reload scaling, caps, repair and armour upgrades; crates and workshop offers never give maxed items |
| `collide.test.js` | Segment-vs-circle hits and misses, substep sizing, circle overlap symmetry |
| `scores.test.js` | Initials lose accents and markup; junk saves fall back to defaults; table sorted and capped |
| `text.test.js` | `esc()` neutralises all five HTML-sensitive characters |

The autopilot (`src/core/bot.js`) predicts where every bomb, bullet and missile will reach the
road, scores spots along the road by that danger (plus crates and troops to crush), drives to
the safest one and leads its aim at the most urgent target.

## Browser check

Headless Chrome at 1600 × 900 with `?debug&autopilot&play=<stage>`: no console errors, the
title demo runs, every stage renders its backdrop, enemies spawn and explode, the HUD and boss
bar update. Phone layout checked at 844 × 390 with `?touch`.
