// Geometry tests for solids: an axis-aligned box, or a vertical prism over polygon rings
// (real building footprints, bridge decks). Rings are flat [x0, z0, x1, z1, ...] arrays.
export function insideRings(rings, x, z) {
  let c = false;
  for (const r of rings) {
    const n = r.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[i * 2], zi = r[i * 2 + 1], xj = r[j * 2], zj = r[j * 2 + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
  }
  return c;
}
// nearest point on the boundary: writes out.x, out.z, returns squared distance
export function nearestOnRings(rings, x, z, out) {
  let best = 1e18;
  for (const r of rings) {
    const n = r.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = r[j * 2], az = r[j * 2 + 1], bx = r[i * 2], bz = r[i * 2 + 1], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz;
      let t = l ? ((x - ax) * dx + (z - az) * dz) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const px = ax + dx * t, pz = az + dz * t, d = (px - x) * (px - x) + (pz - z) * (pz - z);
      if (d < best) { best = d; out.x = px; out.z = pz; }
    }
  }
  return best;
}
// nearest point on a solid's walls to (x, z); for boxes clamps then pushes to a face
export function nearestWall(b, x, z, out) {
  if (b.rings) return nearestOnRings(b.rings, x, z, out);
  let px = Math.min(Math.max(x, b.minx), b.maxx), pz = Math.min(Math.max(z, b.minz), b.maxz);
  if (px > b.minx && px < b.maxx && pz > b.minz && pz < b.maxz) {
    const a = px - b.minx, c = b.maxx - px, e = pz - b.minz, f = b.maxz - pz, m = Math.min(a, c, e, f);
    if (m === a) px = b.minx; else if (m === c) px = b.maxx; else if (m === e) pz = b.minz; else pz = b.maxz;
  }
  out.x = px; out.z = pz; return (px - x) * (px - x) + (pz - z) * (pz - z);
}
export function insideSolid(b, x, z) { return b.rings ? insideRings(b.rings, x, z) : x > b.minx && x < b.maxx && z > b.minz && z < b.maxz; }
// ray (o, d) against a prism: returns t or -1, writes normal to n
export function rayPrism(b, o, d, tmax, n) {
  let best = tmax, hit = false;
  // roof
  if (d.y < -1e-6 && o.y > b.maxy) { const t = (b.maxy - o.y) / d.y; if (t < best && insideRings(b.rings, o.x + d.x * t, o.z + d.z * t)) { best = t; n.x = 0; n.y = 1; n.z = 0; hit = true; } }
  for (const r of b.rings) {
    const m = r.length / 2;
    for (let i = 0, j = m - 1; i < m; j = i++) {
      const ax = r[j * 2], az = r[j * 2 + 1], ex = r[i * 2] - ax, ez = r[i * 2 + 1] - az;
      const den = d.x * ez - d.z * ex; if (Math.abs(den) < 1e-9) continue;
      const wx = ax - o.x, wz = az - o.z, t = (wx * ez - wz * ex) / den, s = (wx * d.z - wz * d.x) / den;
      if (t < 0 || t >= best || s < 0 || s > 1) continue;
      const y = o.y + d.y * t; if (y < b.miny || y > b.maxy) continue;
      let nx = ez, nz = -ex; const l = Math.hypot(nx, nz); nx /= l; nz /= l; if (nx * d.x + nz * d.z > 0) { nx = -nx; nz = -nz; }
      best = t; n.x = nx; n.y = 0; n.z = nz; hit = true;
    }
  }
  return hit ? best : -1;
}
