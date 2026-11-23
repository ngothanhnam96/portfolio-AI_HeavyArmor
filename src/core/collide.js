// A bullet is a point moving a lot per step, so a naive overlap test can pass right through
// a hit box at high speed. Instead we substep: slice the bullet's travel into pieces short
// enough that no piece is longer than the target's radius, then do circle-circle on each.

export function substeps(speed, dt, minRadius) {
  const travel = speed * dt;
  if (travel <= minRadius) return 1;
  return Math.max(1, Math.ceil(travel / Math.max(1, minRadius)));
}

/** Does a bullet moving from `from` to `to` enter a circle (cx, cy, r)? */
export function segmentHitsCircle(from, to, cx, cy, r) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const fx = from.x - cx;
  const fy = from.y - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - r * r;
  if (a === 0) return c <= 0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const s = Math.sqrt(disc);
  const t1 = (-b - s) / (2 * a);
  const t2 = (-b + s) / (2 * a);
  return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

/** Circle-circle test, for spawned entities and pickups. */
export function circlesOverlap(ax, ay, ar, bx, by, br) {
  const dx = ax - bx;
  const dy = ay - by;
  const rr = ar + br;
  return dx * dx + dy * dy <= rr * rr;
}
