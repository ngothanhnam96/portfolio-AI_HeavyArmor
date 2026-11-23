// The Iron Crow air wing: seven enemy kinds. Movement and fire live in game.js; this is the
// data a designer tunes. `r` is the hit radius, `fire` the seconds between attacks on Normal.

export const KINDS = {
  fighter: {
    name: "Tiêm Kích Én Sắt",
    hp: 8, r: 20, score: 150, speed: 250, y: [70, 230], fire: 1.6, move: "cross", drop: 0.02,
  },
  diver: {
    name: "Cường Kích Bổ Nhào",
    hp: 12, r: 22, score: 250, speed: 220, y: [50, 90], fire: 0, move: "dive", drop: 0.03,
  },
  heli: {
    name: "Trực Thăng Chuồn Chuồn",
    hp: 30, r: 26, score: 400, speed: 150, y: [150, 270], fire: 2.4, move: "hover", stay: 9, drop: 0.07,
  },
  bomber: {
    name: "Oanh Tạc Cơ Bồ Nông",
    hp: 55, r: 40, score: 700, speed: 70, y: [60, 95], fire: 0.95, move: "bomber", drop: 0.14,
  },
  transport: {
    name: "Vận Tải Cơ Lạc Đà",
    hp: 36, r: 36, score: 500, speed: 95, y: [85, 120], fire: 0, move: "transport", drop: 0.2,
  },
  jet: {
    name: "Phản Lực Mũi Tên",
    hp: 14, r: 20, score: 350, speed: 320, y: [55, 120], fire: 0, move: "jet", drop: 0.04,
  },
  blimp: {
    name: "Khinh Khí Cầu Thép",
    hp: 200, r: 58, score: 2000, speed: 30, y: [120, 150], fire: 3.2, move: "blimp", drop: 1,
  },
};

export const TROOP = { hp: 4, r: 10, score: 100, fall: 52, walk: 34, range: 140, fire: 1.9 };
