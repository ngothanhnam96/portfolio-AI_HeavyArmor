# 🔥 Thép Lửa — Heavy Armor

An arcade tank-versus-air shooter for the browser. You drive a single heavy tank along the
road and fight off the Iron Crow air wing: fighters, dive bombers, gunship helicopters,
bombers, paratroop transports, missile jets and armoured blimps. Four battlefields across
Vietnam, four multi-part bosses, five weapon systems that stack, shields, nukes and a workshop
between stages.

Zero dependencies, no build step, no image, audio or font files. The tank, aircraft, bosses,
parallax landscapes, explosions and wrecks are drawn in code on a canvas; every sound is
synthesised with WebAudio.

**Live:** https://ngothanhnam96.github.io/portfolio-AI_HeavyArmor/ (once GitHub Pages is on)

## Battlefields

| # | Name | Setting | Boss |
|---|------|---------|------|
| 1 | Đồng Lúa Bình Minh | Rice terraces at dawn, stilt houses, bamboo | Pháo Đài Bay Kền Kền — four-engine flying fortress |
| 2 | Đồi Cát Trắng | White dunes at noon, palms, basket boats | Trực Thăng Bọ Ngựa — twin-rotor gunship |
| 3 | Vịnh Đá Hoàng Hôn | Karst bay at sunset, junk sails | Khinh Hạm Cá Voi Thép — armoured airship |
| 4 | Thành Phố Đêm | Neon city at night, searchlights | Mẫu Hạm Phượng Đen — sky carrier |

Every boss has parts you can shoot off (turrets, bomb bays, rocket racks, hangars). While a
guard part is alive the hull is armoured and takes only 35 % damage.

## Weapons and items

The supply chopper drops crates on parachutes; drive under one to collect it. After each
boss the workshop offers three upgrades to choose from.

| Item | Effect |
|------|--------|
| S — Pháo Chùm | One more cannon barrel (up to 5, fanning out) |
| R — Bắn Nhanh | Faster cannon reload (3 levels) |
| H — Tên Lửa Dò | Homing missiles from hull pods (3 levels) |
| L — Tia Laser | Piercing laser bolt (3 levels) |
| F — Pháo Phòng Không | Flak shell that bursts at the cursor (3 levels) |
| K — Khiên | Absorbs one hit (stacks to 3) |
| N — Bom Hạt Nhân | Clears the sky, hurts bosses |
| + — Sửa Giáp | Repairs 45 armour |
| A — Giáp Dày | +25 max armour (workshop only) |

All systems fire together while the trigger is held. Losing a tank costs one cannon level
and one rapid-fire level.

## Rules

- Armour bar per tank, 3 tanks on Normal (Easy 4, Hard 2). Bombs and missiles can be shot
  down; bullets cannot.
- Paratroopers land and shoot at the tank. Drive over them to crush them.
- Kills within 2.2 s chain a combo (score × up to 3).
- Each stage ends with a rank (S / A / B / C) from damage taken, combo, kill ratio and score.
- Modes: **Chiến Dịch** (four stages) and **Sinh Tồn** (endless loop, enemies get tougher).
- Top-seven high scores with three initials, saved on the device.

## Controls

| | Mouse + keyboard | Keyboard only | Phone |
|-|------------------|---------------|-------|
| Drive | A / D | A / D | ◀ ▶ |
| Aim | mouse | ← → (↑ straight up) | drag on the right side |
| Fire | hold left button | Space / J | touch and hold |
| Nuke | right button / X | X / K | ☢ |
| Pause / sound | P or Esc / M | P / M | ❚❚ |

## Run it

```bash
npm start    # http://127.0.0.1:5173
npm test     # 37 tests, no dependencies
```

Node 20+. URL options: `?debug` exposes `window.__ha`; `?seed=7` fixes the RNG;
`?play=dunes` jumps to a stage (`paddy`, `dunes`, `karst`, `city`); `?autopilot` lets the bot
drive (for demos and screenshots); `?touch` forces the touch controls on.

## What the tests prove

- Same seed + same inputs replay identically; the tank and its aim stay in bounds.
- The cannon follows its cooldown; every weapon system fires once levelled.
- Shields absorb hits, armour runs out, lives end the game; a nuke clears the sky and needs stock.
- Shooting a bomb down saves the armour; troops are crushed under the treads; crates are collected.
- Guard parts really armour the boss hull.
- Stage scripts use real enemies and end on real bosses; upgrades respect their caps.
- An autopilot clears stage 1 on Easy and Normal for five seeds, and the whole campaign on Normal.

## Originality

An original game in the tank-versus-air arcade genre. Title, tank, enemy faction, aircraft,
bosses, stages and sounds were made for this project; nothing is taken from any existing game.

## Docs

[01-SPEC](docs/01-SPEC.md) · [02-DESIGN](docs/02-DESIGN.md) · [03-TASKS](docs/03-TASKS.md) ·
[04-TESTING](docs/04-TESTING.md) · [05-DEPLOY](docs/05-DEPLOY.md) · [Script](Script.md)

## Licence

[MIT](LICENSE)
