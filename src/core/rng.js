// A small seeded PRNG so every game is deterministic from its seed. Mulberry32 — short, fast
// and good enough for a game.

export function rng(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(rand, array) {
  return array[Math.floor(rand() * array.length)];
}

export function range(rand, lo, hi) {
  return lo + (hi - lo) * rand();
}
