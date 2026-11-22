// Military bases out in open country: a fenced compound with watchtowers, barracks, a hangar, sandbag posts,
// parked armour and patrolling soldiers. Walk in uninvited and the base goes on alert; clear it for renown.
// Placement is deterministic on a 4 km world grid, so a base is always in the same place.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, hash2, freeTree } from './util.js';
import { Geo, CH } from './geo.js';
import { City } from './city.js';

const CELL = 4000, M = 111320;
let mats = null;
function MATS() {
  if (mats) return mats;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); x.strokeStyle = '#9aa0a4'; x.lineWidth = 2; for (let i = -64; i < 128; i += 10) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 64, 64); x.moveTo(i + 64, 0); x.lineTo(i, 64); x.stroke(); }
  const wire = new THREE.CanvasTexture(c); wire.wrapS = wire.wrapT = THREE.RepeatWrapping;
  const S = (col, r = 0.85, m = 0.1) => new THREE.MeshStandardMaterial({ color: col, roughness: r, metalness: m });
  mats = { olive: S(0x5a6340), concrete: S(0x9a9a94, 0.9), tin: S(0x7f8a7a, 0.5, 0.5), sand: S(0xb8a67e, 1), dark: S(0x2a2c28, 0.8), post: S(0x55595c, 0.5, 0.6), white: S(0xe8e8e0, 0.6),
    fence: new THREE.MeshStandardMaterial({ map: wire, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.5, metalness: 0.6, color: 0xb8bcc0 }), wire };
  return mats;
}

export class Bases {
  constructor() { this.live = new Map(); this.t = 0; this.cleared = new Set(); try { this.cleared = new Set(JSON.parse(localStorage.getItem('eh.bases') || '[]')); } catch (e) { } this.near = null; }
  // the base (if any) in a 4 km world cell: lat/lon-anchored, so it does not move when the local origin does
  site(i, j) {
    const h = hash2(i, j, 991); if (h > 0.42) return null;
    const lat = -(j + 0.2 + hash2(i, j, 17) * 0.6) * CELL / M, lon = (i + 0.2 + hash2(i, j, 31) * 0.6) * CELL / (M * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    const x = lon * M * Geo.cosB - Geo.ox * CH, z = -lat * M - Geo.oz * CH;
    if (Math.abs(x) > 40000 || Math.abs(z) > 40000) return null;
    if (City.active && City.inside(x, z, 600)) return null;
    const g = Geo.height(x, z); if (g < 2 || Geo.urban(x, z) > 0.12) return null;
    // flat enough for a compound
    for (const [dx, dz] of [[80, 0], [-80, 0], [0, 80], [0, -80]]) if (Math.abs(Geo.height(x + dx, z + dz) - g) > 9) return null;
    return { key: i + ',' + j, x, z, g };
  }
  // every base within r metres of (x, z)
  sitesNear(x, z, r) {
    const out = [], lat = Geo.toLat(z), lon = Geo.toLon(x), ci = Math.floor(lon * M * Math.max(0.2, Math.cos(lat * Math.PI / 180)) / CELL), cj = Math.floor(-lat * M / CELL), n = Math.ceil(r / CELL) + 1;
    for (let i = ci - n; i <= ci + n; i++) for (let j = cj - n; j <= cj + n; j++) { const s = this.site(i, j); if (s && Math.hypot(s.x - x, s.z - z) < r) out.push(s); }
    return out;
  }
  build(s) {
    const m = MATS(), g = new THREE.Group(), parts = new Map(), solids = [], H = 80;
    const put = (geo, mat, x, y, z, ry = 0, solid = true) => { geo.rotateY(ry); geo.translate(x, y, z); if (!parts.has(mat)) parts.set(mat, []); parts.get(mat).push(geo.index ? geo.toNonIndexed() : geo);
      if (solid) { geo.computeBoundingBox(); const b = geo.boundingBox; solids.push({ minx: s.x + b.min.x, maxx: s.x + b.max.x, minz: s.z + b.min.z, maxz: s.z + b.max.z, miny: s.g + b.min.y, maxy: s.g + b.max.y, solid: true, until: 1e12, base: s.key }); } };
    const box = (w, h, d, mat, x, y, z, ry, solid) => put(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry, solid);
    // pad, perimeter fence with posts, gate
    box(2 * H + 20, 0.3, 2 * H + 20, m.concrete, 0, -0.25, 0, 0, false);
    for (const [ax, az, bx, bz] of [[-H, -H, H, -H], [H, -H, H, H], [H, H, 12, H], [-12, H, -H, H], [-H, H, -H, -H]]) { const len = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
      const f = new THREE.PlaneGeometry(len, 3.2); f.rotateY(ry + Math.PI / 2); f.translate((ax + bx) / 2, 1.6, (az + bz) / 2); const uv = f.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 2.5, uv.getY(k) * 1.3); parts.has(m.fence) || parts.set(m.fence, []); parts.get(m.fence).push(f.toNonIndexed());
      for (let k = 0; k <= len; k += 4) box(0.12, 3.6, 0.12, m.post, ax + (bx - ax) * k / len, 0, az + (bz - az) * k / len, 0, false);
      solids.push({ minx: s.x + Math.min(ax, bx) - 0.3, maxx: s.x + Math.max(ax, bx) + 0.3, minz: s.z + Math.min(az, bz) - 0.3, maxz: s.z + Math.max(az, bz) + 0.3, miny: s.g - 1, maxy: s.g + 3.2, solid: true, until: 1e12, base: s.key }); }
    box(1.2, 1.2, 1.2, m.white, -12, 0, H + 1, 0, false); box(1.2, 1.2, 1.2, m.white, 12, 0, H + 1, 0, false); box(24, 0.2, 0.3, m.white, 0, 1.0, H + 1, 0, false);
    // watchtowers at the corners
    for (const [x, z] of [[-H + 4, -H + 4], [H - 4, -H + 4], [H - 4, H - 4], [-H + 4, H - 4]]) { for (const [a, b] of [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]]) box(0.3, 9, 0.3, m.post, x + a, 0, z + b, 0, false); box(4.4, 0.3, 4.4, m.olive, x, 9, z); box(4.4, 1.1, 0.2, m.olive, x, 9.3, z - 2.1, 0, false); box(4.4, 1.1, 0.2, m.olive, x, 9.3, z + 2.1, 0, false); box(4.6, 0.25, 4.6, m.tin, x, 11.8, z, 0, false); solids.push({ minx: s.x + x - 2, maxx: s.x + x + 2, minz: s.z + z - 2, maxz: s.z + z + 2, miny: s.g, maxy: s.g + 9.3, solid: true, until: 1e12, base: s.key }); }
    // barracks, command block, a hangar with a curved roof, fuel tanks, sandbag posts, a helipad
    for (let i = 0; i < 3; i++) { box(30, 4.5, 10, m.olive, -40, 0, -50 + i * 18); const r = new THREE.CylinderGeometry(5.4, 5.4, 30, 12, 1, false, -Math.PI / 2, Math.PI); r.rotateZ(Math.PI / 2); r.scale(1, 0.35, 1); put(r, m.tin, -40, 4.5, -50 + i * 18, 0, false); }
    box(22, 8, 16, m.concrete, 35, 0, -50); box(6, 4, 6, m.concrete, 35, 8, -50); box(0.3, 6, 0.3, m.post, 38, 12, -52, 0, false);
    const hg = new THREE.CylinderGeometry(14, 14, 36, 20, 1, true, -Math.PI / 2, Math.PI); hg.rotateX(Math.PI / 2); hg.scale(1, 0.9, 1); put(hg, m.tin, 40, 0, 30, 0, false); box(28, 12, 0.4, m.tin, 40, 0, 12, 0, false);
    solids.push({ minx: s.x + 26, maxx: s.x + 54, minz: s.z + 12, maxz: s.z + 48, miny: s.g + 11, maxy: s.g + 12.6, solid: true, until: 1e12, base: s.key });
    for (const x of [-60, -52]) put(new THREE.CylinderGeometry(3, 3, 6, 16), m.white, x, 3, 55, 0, true);
    for (const [x, z] of [[-20, 60], [20, 60], [0, -20]]) for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 1.5; box(1.4, 0.5, 0.7, m.sand, x + Math.cos(a) * 3, (k % 2) * 0.5, z + Math.sin(a) * 3, -a, false); box(1.4, 0.5, 0.7, m.sand, x + Math.cos(a) * 3, 0.5 + (k % 2) * 0.5, z + Math.sin(a) * 3, -a, false); }
    put(new THREE.CylinderGeometry(9, 9, 0.2, 24), m.concrete, -10, 0.1, 25, 0, false);
    box(0.15, 12, 0.15, m.post, 0, 0, H - 8, 0, false);
    for (const [mat, list] of parts) { const mesh = new THREE.Mesh(mergeGeometries(list), mat); mesh.castShadow = mesh.receiveShadow = true; g.add(mesh); }
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.8), new THREE.MeshStandardMaterial({ color: 0x4a5a3a, side: THREE.DoubleSide })); flag.position.set(1.55, 11, H - 8); g.add(flag);
    g.position.set(s.x, s.g, s.z); G.scene.add(g); for (const b of solids) G.world.dyn.push(b);
    // the garrison: soldiers on patrol and in the towers, armour parked by the hangar
    const units = [], cars = [];
    if (!this.cleared.has(s.key)) {
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, n = G.ents.addNPC('cop', s.x + Math.cos(a) * 35, s.z + Math.sin(a) * 35, 'soldier'); n.state = 'idle'; n.base = s.key; n.home = { x: n.pos.x, z: n.pos.z }; units.push(n); }
      for (const [x, z, t, ry] of [[40, 30, 'tank', Math.PI], [10, -30, 'army_truck', 0.4], [-15, -35, 'army_truck', 0.4]]) { const c = G.ents.addCar(t, 0x4a5532, false, { x: s.x + x, z: s.z + z, dir: 0 }); c.ai = 'none'; c.yaw = ry; c.occupied = false; c.base = s.key; c.hp = t === 'tank' ? 1400 : 400; c.parked = true; cars.push(c); }
    }
    return { s, g, solids, units, cars, alerted: false };
  }
  drop(B) {
    G.scene.remove(B.g); freeTree(B.g); G.world.dyn = G.world.dyn.filter(d => d.base !== B.s.key);
    for (const n of B.units) if (!n.dead) { const i = G.ents.npcs.indexOf(n); if (i >= 0) { G.ents.npcs.splice(i, 1); n.remove(); } }
    for (const c of B.cars) { const i = G.ents.cars.indexOf(c); if (i >= 0 && c !== G.player.car) { G.ents.cars.splice(i, 1); c.remove(); } }
  }
  update(dt) {
    if (!G.player) return; const p = G.player.pos; this.t -= dt;
    if (this.t <= 0) {
      this.t = 1.5; const near = this.sitesNear(p.x, p.z, 1300), keys = new Set(near.map(s => s.key));
      for (const [k, B] of this.live) if (!keys.has(k) || Math.hypot(B.s.x - p.x, B.s.z - p.z) > 1500) { this.drop(B); this.live.delete(k); }
      for (const s of near) if (!this.live.has(s.key) && Math.hypot(s.x - p.x, s.z - p.z) < 900) this.live.set(s.key, this.build(s));
      const closest = near.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
      if (closest && closest.key !== this.near && !this.cleared.has(closest.key)) { this.near = closest.key; G.ui.toast('Military base nearby', 'Restricted area: expect armed resistance'); }
    }
    for (const B of this.live.values()) {
      const inside = Math.abs(p.x - B.s.x) < 82 && Math.abs(p.z - B.s.z) < 82;
      if (inside && !B.alerted && !this.cleared.has(B.s.key)) { B.alerted = true; G.ui.toast('Intruder alert!', 'The base is on alert'); G.wanted.crime(7.5); G.audio.siren && G.audio.siren(true); for (const c of B.cars) if (c.m.tank && !c.dead) { c.ai = 'cop'; c.occupied = true; } }
      if (B.alerted && !this.cleared.has(B.s.key) && B.units.every(n => n.dead)) { this.cleared.add(B.s.key); try { localStorage.setItem('eh.bases', JSON.stringify([...this.cleared])); } catch (e) { } G.ui.toast('Base neutralised', '+500 renown'); if (G.stats) { G.stats.renown = (G.stats.renown || 0) + 500; G.stats.crews++; } }
      const fl = B.g.children[B.g.children.length - 1]; if (fl) fl.rotation.y = Math.sin(G.time * 1.4) * 0.25;
    }
  }
  // for the radar and local map
  markers(x, z, r) { const out = []; for (const s of this.sitesNear(x, z, r)) out.push({ x: s.x, z: s.z, cleared: this.cleared.has(s.key) }); return out; }
}
