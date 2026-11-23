// The tank's kit. Every system has its own level; a supply crate or the between-stage
// workshop raises one of them. All weapons fire together while the trigger is held.

export const MAX = { gun: 5, rapid: 3, homing: 3, laser: 3, flak: 3, shield: 3, nuke: 5 };

export const UPGRADES = {
  spread: { label: "Pháo Chùm", short: "S", color: "#ffcf4a", desc: "Thêm một nòng đạn, bắn tỏa rộng hơn." },
  rapid: { label: "Bắn Nhanh", short: "R", color: "#ff7a3a", desc: "Rút ngắn thời gian nạp đạn." },
  homing: { label: "Tên Lửa Dò", short: "H", color: "#5cd2ff", desc: "Tên lửa tự tìm mục tiêu gần nhất." },
  laser: { label: "Tia Laser", short: "L", color: "#ff4fd8", desc: "Tia xuyên thủng mọi thứ trên đường bay." },
  flak: { label: "Pháo Phòng Không", short: "F", color: "#9dff5c", desc: "Đạn nổ chùm ngay tại điểm ngắm." },
  shield: { label: "Khiên Năng Lượng", short: "K", color: "#7cf7ff", desc: "Chặn một phát trúng. Tích được 3." },
  nuke: { label: "Bom Hạt Nhân", short: "N", color: "#ffffff", desc: "Xóa sạch bầu trời. Nhấn X." },
  repair: { label: "Sửa Giáp", short: "+", color: "#5cff9d", desc: "Hồi 45 giáp." },
  armor: { label: "Giáp Dày", short: "A", color: "#c9d4e6", desc: "+25 giáp tối đa, hồi đầy giáp." },
};

/** Fresh weapon levels for a new tank. */
export function baseKit() {
  return { gun: 1, rapid: 0, homing: 0, laser: 0, flak: 0 };
}

/** Is the upgrade still useful for this tank? */
export function canTake(tank, kit, id) {
  switch (id) {
    case "spread": return kit.gun < MAX.gun;
    case "rapid": case "homing": case "laser": case "flak": return kit[id] < MAX[id];
    case "shield": return tank.shield < MAX.shield;
    case "nuke": return tank.nukes < MAX.nuke;
    case "repair": return tank.armor < tank.maxArmor;
    case "armor": return tank.maxArmor < 200;
    default: return false;
  }
}

/** Apply an upgrade in place. Returns false if it changed nothing. */
export function applyUpgrade(tank, kit, id) {
  if (!canTake(tank, kit, id)) {
    if (id === "repair" || id === "shield" || id === "nuke") return false;
    return false;
  }
  switch (id) {
    case "spread": kit.gun += 1; break;
    case "rapid": case "homing": case "laser": case "flak": kit[id] += 1; break;
    case "shield": tank.shield += 1; break;
    case "nuke": tank.nukes += 1; break;
    case "repair": tank.armor = Math.min(tank.maxArmor, tank.armor + 45); break;
    case "armor": tank.maxArmor += 25; tank.armor = tank.maxArmor; break;
  }
  return true;
}

const CRATE_WEIGHTS = { spread: 3, rapid: 3, homing: 2, laser: 2, flak: 2, shield: 2, nuke: 1.2, repair: 2.4 };

/** Roll a supply crate from the seeded RNG, skipping anything already maxed. */
export function rollCrate(rand, tank, kit) {
  const pool = Object.entries(CRATE_WEIGHTS).filter(([id]) => canTake(tank, kit, id));
  if (!pool.length) return "repair";
  const total = pool.reduce((s, [, wt]) => s + wt, 0);
  let roll = rand() * total;
  for (const [id, wt] of pool) {
    roll -= wt;
    if (roll < 0) return id;
  }
  return pool[pool.length - 1][0];
}

/** Three distinct workshop offers between stages. */
export function rollOffers(rand, tank, kit, count = 3) {
  const pool = ["spread", "rapid", "homing", "laser", "flak", "shield", "nuke", "armor"].filter((id) => canTake(tank, kit, id));
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  if (!out.length) out.push("repair");
  return out;
}

/** Main cannon: angle offsets and side offsets per gun level. */
export function gunPattern(level) {
  switch (Math.max(1, Math.min(MAX.gun, level))) {
    case 1: return [{ a: 0, o: 0 }];
    case 2: return [{ a: 0, o: -5 }, { a: 0, o: 5 }];
    case 3: return [{ a: -0.1, o: 0 }, { a: 0, o: 0 }, { a: 0.1, o: 0 }];
    case 4: return [{ a: -0.16, o: 0 }, { a: -0.05, o: -4 }, { a: 0.05, o: 4 }, { a: 0.16, o: 0 }];
    default: return [{ a: -0.24, o: 0 }, { a: -0.12, o: 0 }, { a: 0, o: 0 }, { a: 0.12, o: 0 }, { a: 0.24, o: 0 }];
  }
}

export const cannonInterval = (rapid) => 0.2 * (1 - 0.16 * rapid);
export const laserInterval = (lvl) => 0.9 - 0.15 * lvl;
export const flakInterval = (lvl) => 1.15 - 0.17 * lvl;
export const homingInterval = (lvl) => 1.5 - 0.25 * lvl;
