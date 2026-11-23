// Four bosses, each with a hull (several hit circles) and parts that can be shot off. While any
// `guard` part is alive the hull is armoured and takes only part of the damage. Phases come
// from the hull's HP fraction: > 66 %, > 33 %, the rest.

export const GUARD_FACTOR = 0.35;

export const BOSSES = {
  vulture: {
    name: "Pháo Đài Bay Kền Kền",
    hp: 1600, score: 15000, hoverY: 118, speed: 70, w: 400,
    hull: [{ dx: 0, dy: 0, r: 52 }, { dx: -120, dy: 4, r: 30 }, { dx: 120, dy: 4, r: 30 }, { dx: -195, dy: 6, r: 18 }, { dx: 195, dy: 6, r: 18 }],
    parts: [
      { id: "gunL", label: "Tháp pháo trái", dx: -105, dy: 34, r: 17, hp: 110, pattern: "aim3", every: 1.9, guard: true },
      { id: "gunR", label: "Tháp pháo phải", dx: 105, dy: 34, r: 17, hp: 110, pattern: "aim3", every: 1.9, guard: true },
      { id: "bay", label: "Khoang bom", dx: 0, dy: 40, r: 21, hp: 160, pattern: "bombs", every: 3.2, guard: true },
    ],
    phases: [["aim1"], ["aim1", "fan5"], ["fan7", "carpet"]],
    every: [2.4, 2.0, 1.7],
  },
  mantis: {
    name: "Trực Thăng Bọ Ngựa",
    hp: 2100, score: 20000, hoverY: 165, speed: 120, w: 340,
    hull: [{ dx: 0, dy: 0, r: 50 }, { dx: -95, dy: -8, r: 30 }, { dx: 95, dy: -8, r: 30 }],
    parts: [
      { id: "chin", label: "Súng máy mũi", dx: 0, dy: 44, r: 16, hp: 140, pattern: "stream", every: 1.6, guard: true },
      { id: "podL", label: "Giàn rocket trái", dx: -74, dy: 26, r: 17, hp: 120, pattern: "missile", every: 3.4, guard: true },
      { id: "podR", label: "Giàn rocket phải", dx: 74, dy: 26, r: 17, hp: 120, pattern: "missile", every: 3.4, guard: true },
    ],
    phases: [["aim3"], ["fan5", "aim3"], ["ring", "fan5"]],
    every: [2.2, 1.8, 1.5],
  },
  whale: {
    name: "Khinh Hạm Cá Voi Thép",
    hp: 3000, score: 26000, hoverY: 120, speed: 45, w: 480,
    hull: [{ dx: 0, dy: 0, r: 62 }, { dx: -110, dy: 0, r: 52 }, { dx: 110, dy: 0, r: 52 }, { dx: -200, dy: 2, r: 34 }, { dx: 200, dy: 0, r: 30 }],
    parts: [
      { id: "t1", label: "Tháp pháo 1", dx: -150, dy: 48, r: 17, hp: 140, pattern: "shell", every: 2.2, guard: true },
      { id: "t2", label: "Tháp pháo 2", dx: 150, dy: 48, r: 17, hp: 140, pattern: "shell", every: 2.2, guard: true },
      { id: "bay", label: "Khoang bom", dx: -40, dy: 62, r: 20, hp: 180, pattern: "bombs", every: 3.0, guard: true },
      { id: "drop", label: "Cửa thả lính", dx: 60, dy: 62, r: 20, hp: 160, pattern: "troops", every: 6.0, guard: false },
    ],
    phases: [["aim3"], ["fan5", "bombs"], ["fan7", "carpet", "aim3"]],
    every: [2.4, 2.1, 1.7],
  },
  phoenix: {
    name: "Mẫu Hạm Phượng Đen",
    hp: 4200, score: 40000, hoverY: 112, speed: 60, w: 520,
    hull: [{ dx: 0, dy: 0, r: 58 }, { dx: -130, dy: 6, r: 40 }, { dx: 130, dy: 6, r: 40 }, { dx: -225, dy: 14, r: 26 }, { dx: 225, dy: 14, r: 26 }],
    parts: [
      { id: "cannon", label: "Pháo chính", dx: 0, dy: 50, r: 22, hp: 220, pattern: "shellFan", every: 2.6, guard: true },
      { id: "rackL", label: "Giàn tên lửa trái", dx: -150, dy: 40, r: 17, hp: 150, pattern: "missile", every: 3.6, guard: true },
      { id: "rackR", label: "Giàn tên lửa phải", dx: 150, dy: 40, r: 17, hp: 150, pattern: "missile", every: 3.6, guard: true },
      { id: "hangar", label: "Hầm máy bay", dx: -60, dy: 46, r: 19, hp: 180, pattern: "launch", every: 7.0, guard: false },
    ],
    phases: [["fan5"], ["fan7", "carpet"], ["ring", "fan7", "carpet"]],
    every: [2.2, 1.8, 1.4],
  },
};

export function phaseOf(boss) {
  const f = boss.hp / boss.maxHp;
  return f > 0.66 ? 0 : f > 0.33 ? 1 : 2;
}
