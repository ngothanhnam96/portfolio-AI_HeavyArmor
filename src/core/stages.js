// The battlefield and the four stage scripts. A script is a list of steps run in order:
//   ["wait", seconds]                      pause the cursor
//   ["wave", kind, count, gap, from, opts] spawn `count` enemies `gap` seconds apart
//   ["boss"]                               wait for a clear sky, then bring in the stage boss
// `from` is "L", "R", "alt" (alternate sides) or "rand".

export const FIELD_W = 960;
export const FIELD_H = 540;
export const GROUND_Y = 470;

const w = (kind, count, gap, from = "alt", opts = {}) => ["wave", kind, count, gap, from, opts];
const wait = (s) => ["wait", s];

export const STAGES = [
  {
    id: "paddy",
    name: "Đồng Lúa Bình Minh",
    brief: "Đoàn xe thép tiến qua cánh đồng lúa lúc rạng đông. Quạ Sắt đã thả máy bay trinh sát.",
    boss: "vulture",
    par: 30000,
    script: [
      wait(1.5),
      w("fighter", 4, 0.7, "L"),
      wait(5),
      w("fighter", 4, 0.7, "R"),
      wait(5),
      w("heli", 2, 1.5, "alt"),
      wait(8),
      w("fighter", 6, 0.5, "alt"),
      wait(5),
      w("transport", 1, 0, "L"),
      wait(6),
      w("bomber", 1, 0, "R"),
      w("fighter", 3, 0.8, "L"),
      wait(9),
      w("diver", 3, 1.2, "alt"),
      wait(7),
      w("heli", 3, 1.6, "alt"),
      wait(9),
      w("transport", 1, 0, "R"),
      w("fighter", 5, 0.6, "alt"),
      wait(8),
      w("bomber", 2, 3, "alt"),
      wait(8),
      w("diver", 4, 0.9, "alt"),
      w("fighter", 4, 0.6, "R"),
      wait(8),
      ["boss"],
    ],
  },
  {
    id: "dunes",
    name: "Đồi Cát Trắng",
    brief: "Giữa trưa trên đồi cát ven biển. Trực thăng địch núp sau những cồn cát.",
    boss: "mantis",
    par: 50000,
    script: [
      wait(1.5),
      w("fighter", 5, 0.5, "alt"),
      wait(5),
      w("heli", 3, 1.2, "alt"),
      wait(7),
      w("jet", 2, 1.5, "alt"),
      w("fighter", 4, 0.6, "L"),
      wait(7),
      w("transport", 2, 3, "alt"),
      wait(7),
      w("diver", 5, 0.8, "alt"),
      wait(7),
      w("bomber", 2, 2.5, "alt"),
      w("heli", 2, 1.5, "alt"),
      wait(9),
      w("jet", 3, 1.2, "alt"),
      w("fighter", 6, 0.45, "alt"),
      wait(8),
      w("blimp", 1, 0, "R"),
      w("heli", 2, 2, "L"),
      wait(12),
      w("diver", 4, 0.8, "alt"),
      w("transport", 1, 0, "L"),
      wait(9),
      ["boss"],
    ],
  },
  {
    id: "karst",
    name: "Vịnh Đá Hoàng Hôn",
    brief: "Con đường ven vịnh lúc chiều tà. Khinh khí cầu thép lơ lửng giữa núi đá vôi.",
    boss: "whale",
    par: 75000,
    script: [
      wait(1.5),
      w("fighter", 6, 0.45, "alt"),
      wait(5),
      w("blimp", 1, 0, "L"),
      w("heli", 2, 1.5, "R"),
      wait(9),
      w("jet", 4, 1, "alt"),
      wait(6),
      w("transport", 2, 2.5, "alt"),
      w("diver", 3, 1, "alt"),
      wait(8),
      w("bomber", 3, 2.2, "alt"),
      w("fighter", 5, 0.5, "alt"),
      wait(9),
      w("heli", 4, 1.1, "alt"),
      wait(8),
      w("blimp", 2, 5, "alt"),
      w("jet", 3, 1.4, "alt"),
      wait(12),
      w("diver", 6, 0.7, "alt"),
      w("transport", 1, 0, "R"),
      wait(9),
      ["boss"],
    ],
  },
  {
    id: "city",
    name: "Thành Phố Đêm",
    brief: "Trận cuối giữa đô thị rực đèn. Mẫu hạm Phượng Đen đang tới gần.",
    boss: "phoenix",
    par: 100000,
    script: [
      wait(1.5),
      w("jet", 3, 0.9, "alt"),
      w("fighter", 6, 0.4, "alt"),
      wait(6),
      w("heli", 4, 1, "alt"),
      wait(8),
      w("bomber", 3, 1.8, "alt"),
      w("diver", 4, 0.8, "alt"),
      wait(9),
      w("transport", 2, 2, "alt"),
      w("jet", 4, 0.9, "alt"),
      wait(8),
      w("blimp", 2, 4, "alt"),
      w("heli", 3, 1.4, "alt"),
      wait(11),
      w("fighter", 10, 0.3, "alt"),
      w("diver", 4, 0.9, "alt"),
      wait(9),
      w("bomber", 2, 2, "alt"),
      w("jet", 4, 0.8, "alt"),
      w("transport", 1, 0, "L"),
      wait(11),
      ["boss"],
    ],
  },
];

export function stageById(id) {
  return STAGES.find((s) => s.id === id) ?? null;
}

/** Rough script length in seconds before the boss (waits plus the longest wave tail). */
export function scriptSeconds(stage) {
  let t = 0;
  for (const step of stage.script) {
    if (step[0] === "wait") t += step[1];
  }
  return t;
}
