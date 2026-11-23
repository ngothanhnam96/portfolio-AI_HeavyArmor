# 01 · Spec

## Goal

An arcade tank-versus-air shooter for the web that looks like a commercial casual game: one
heavy tank on the road, a sky full of aircraft, chunky explosions, falling wrecks and a clear
HUD. Theme: the Thép Lửa armoured column fighting the Iron Crow air wing across four
Vietnamese landscapes. No image, audio or font files; runs on desktop and phone with no install.

## Game loop

1. The title screen runs a live demo game behind a glass menu (the autopilot plays).
2. A banner names the stage; the stage script sends waves of aircraft.
3. Drive, aim, hold fire. Shoot down bombs and missiles, crush paratroopers, catch supply
   crates. Losing all armour costs a tank; the next one rolls in with 2.6 s of protection.
4. Hazard bars and a warning banner bring in the boss. Shoot off its parts, then the hull.
5. A rank card and the workshop: pick one of three upgrades, armour is partly repaired.
6. Clearing stage 4 wins the campaign (endless mode loops with tougher enemies). No tanks
   left is game over. A top-seven score asks for three initials.

## Requirements

| # | Requirement |
|---|-------------|
| R1 | Fixed 1/120 s step; segment-vs-circle collision so fast shells never tunnel |
| R2 | 4 stages with their own parallax backdrop and a multi-part boss with 3 phases |
| R3 | Tank: drive, free aim over the upper half-plane, hold fire, nuke stock, armour, lives |
| R4 | 5 stacking weapon systems + shield, nuke, repair, armour upgrades |
| R5 | 7 aircraft kinds plus paratroopers; shootable bombs and homing missiles |
| R6 | Supply chopper crates, between-stage workshop with 3 offers |
| R7 | Combo multiplier, per-stage rank, top-seven table with escaped initials |
| R8 | Campaign and endless modes; Easy / Normal / Hard |
| R9 | Mouse, keyboard-only and touch controls; reduced motion respected |
| R10 | Rules pure and seeded in `src/core` so tests and the demo replay games exactly |

## Out of scope (for now)

- Online leaderboards, co-op, gamepad, mid-stage save.
