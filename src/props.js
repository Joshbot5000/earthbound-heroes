// Street furniture and trees: drawn instanced, solid to people and cars, and breakable. A prop hit
// harder than its break speed becomes a rigid body (four points held by stiff constraints, the
// Verlet method) that topples, tumbles, bounces off the ground and buildings and can be shoved by cars.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G, clamp, lerp, smooth, hash2 } from './util.js';
import { Geo, CH } from './geo.js';
import { region } from './regions.js';
import { insideSolid, nearestWall } from './solid.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _n = {};
// r: collision radius, h: height, m: mass kg, br: speed (m/s) needed to break it free
export const SPEC = {
  1: { r: 0.14, h: 6.5, m: 140, br: 4.5, name: 'lamp' }, 2: { r: 0.8, h: 0.9, m: 70, br: 2.5, box: [1.8, 0.9, 0.62], name: 'bench' },
  3: { r: 0.14, h: 1.0, m: 160, br: 17, name: 'bollard' }, 4: { r: 0.3, h: 1.6, m: 230, br: 8, name: 'postbox' },
  5: { r: 1.3, h: 2.6, m: 320, br: 7, box: [3.2, 2.6, 1.4], name: 'busstop' }, 6: { r: 0.13, h: 4.2, m: 110, br: 5.5, name: 'signal' },
  7: { r: 0.2, h: 0.8, m: 140, br: 15, name: 'hydrant' }, 8: { r: 0.3, h: 1.0, m: 25, br: 1.2, name: 'bin' },
  9: { r: 0.55, h: 2.5, m: 750, br: 9.5, box: [1.0, 2.5, 1.0], name: 'phone' }, 20: { r: 0.3, h: 9, m: 900, br: 9, name: 'tree' },
};
const TREE_SPECIES = ['plane', 'broadleaf', 'conifer', 'palm', 'rain'];

// ---------- geometry helpers ----------
function colored(g, hex) {
  g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv'); if (g.attributes.uv1) g.deleteAttribute('uv1');
  const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g;
}
const at = (g, x, y, z, rx = 0, ry = 0, rz = 0) => { g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };
const cyl = (r0, r1, h, seg = 10) => new THREE.CylinderGeometry(r0, r1, h, seg);
const boxg = (w, h, d) => new THREE.BoxGeometry(w, h, d);
function merge(parts) { return mergeGeometries(parts.map(([g, c]) => colored(g, c))); }
function noisy(g, amp, seed) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + (hash2(Math.round(x * 50) + seed, Math.round(y * 50), Math.round(z * 50)) - 0.5) * amp; p.setXYZ(i, x * k, y * k, z * k); } g.computeVertexNormals(); return g; }

function leafTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  for (let i = 0; i < 260; i++) {
    const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 110, px = 128 + Math.cos(a) * r, py = 128 + Math.sin(a) * r, s = 7 + Math.random() * 9, v = 120 + Math.random() * 110 | 0;
    x.fillStyle = `rgb(${v * 0.75 | 0},${v},${v * 0.55 | 0})`; x.beginPath(); x.ellipse(px, py, s, s * 0.55, Math.random() * 6.28, 0, 6.28); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
function frondTexture() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.strokeStyle = '#6b5a2a'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 0); x.lineTo(32, 256); x.stroke();
  for (let y = 6; y < 250; y += 7) { const L = 30 * Math.sin((y / 256) * Math.PI) + 4, v = 140 + Math.random() * 60 | 0; x.strokeStyle = `rgb(${v * 0.6 | 0},${v},${v * 0.4 | 0})`; x.lineWidth = 3; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(32, y); x.lineTo(32 + s * L, y + 12); x.stroke(); } }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
// foliage cards scattered over a crown
function cards(clumps, n, size) {
  const gs = [];
  for (const [cx, cy, cz, r] of clumps) for (let i = 0; i < n; i++) {
    const g = new THREE.PlaneGeometry(size * r, size * r), u = Math.random() * 6.28, v = Math.acos(2 * Math.random() - 1);
    g.rotateX(Math.random() * 3); g.rotateY(Math.random() * 6.28);
    g.translate(cx + Math.sin(v) * Math.cos(u) * r * 0.7, cy + Math.cos(v) * r * 0.55, cz + Math.sin(v) * Math.sin(u) * r * 0.7); gs.push(g);
  }
  const m = mergeGeometries(gs); const c = new Float32Array(m.attributes.position.count * 3).fill(1); m.setAttribute('color', new THREE.BufferAttribute(c, 3)); return m;
}

function buildTypes(regKey) {
  const reg = region(regKey), T = {}, glow = {};
  const lampStyle = reg.lamp;
  if (lampStyle === 'victorian' || lampStyle === 'classic') {
    const c = lampStyle === 'victorian' ? 0x15171a : 0x1d2a22, H = lampStyle === 'victorian' ? 5.2 : 4.6;
    T[1] = merge([[at(cyl(0.2, 0.24, 0.9, 12), 0, 0.45, 0), c], [at(cyl(0.09, 0.12, H - 1.2, 10), 0, H / 2 + 0.3, 0), c], [at(cyl(0.13, 0.13, 0.12, 10), 0, H - 0.8, 0), c],
      [at(boxg(0.9, 0.06, 0.06), 0, H - 0.75, 0), c], [at(cyl(0.05, 0.22, 0.25, 6), 0, H - 0.5, 0), c], [at(cyl(0.24, 0.05, 0.25, 6), 0, H + 0.25, 0), c], [at(cyl(0.02, 0.02, 0.3), 0, H + 0.5, 0), c]]);
    glow[1] = [at(cyl(0.2, 0.2, 0.5, 6), 0, H - 0.1, 0)];
  } else {
    const H = lampStyle === 'tall' ? 10 : 8.5, A = 2.4, c = 0x8a8e92, arm = [];
    for (let i = 0; i < 8; i++) { const t0 = i / 8, t1 = (i + 1) / 8, p0 = [Math.sin(t0 * Math.PI / 2) * A, H - 0.8 + Math.cos(t0 * Math.PI / 2) * 0.8 - 0.8 + 0.8], p1 = [Math.sin(t1 * Math.PI / 2) * A, H + Math.cos(t1 * Math.PI / 2) * 0.8 - 0.8];
      const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]); arm.push([at(cyl(0.05, 0.05, L, 6), (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 0, 0, 0, -Math.atan2(p1[0] - p0[0], p1[1] - p0[1])), c]); }
    T[1] = merge([[at(cyl(0.11, 0.17, H, 10), 0, H / 2, 0), c], ...arm, [at(boxg(0.75, 0.14, 0.32), A + 0.2, H - 0.85, 0), 0x55595e]]);
    glow[1] = [at(boxg(0.6, 0.04, 0.24), A + 0.2, H - 0.93, 0)];
  }
  T[2] = merge([[at(boxg(1.8, 0.05, 0.5), 0, 0.46, 0), 0x6a4a2e], [at(boxg(1.8, 0.4, 0.05), 0, 0.72, -0.24, -0.15), 0x6a4a2e], ...[-0.8, 0.8].map(x => [at(boxg(0.06, 0.46, 0.5), x, 0.23, 0), 0x202224])]);
  const bol = reg.bollard;
  T[3] = merge([[at(cyl(0.11, 0.13, 0.95, 10), 0, 0.475, 0), bol], [at(new THREE.SphereGeometry(0.11, 10, 6, 0, 6.3, 0, 1.6), 0, 0.95, 0), bol], [at(cyl(0.115, 0.115, 0.06, 10), 0, 0.82, 0), regKey === 'uk' ? 0xc8a040 : 0x222222]]);
  T[4] = reg.postbox ? merge([[at(cyl(0.27, 0.29, 1.35, 16), 0, 0.68, 0), 0xc8141a], [at(new THREE.SphereGeometry(0.29, 16, 8, 0, 6.3, 0, 1.4), 0, 1.35, 0), 0xc8141a], [at(cyl(0.31, 0.31, 0.12, 16), 0, 0.06, 0), 0x111111], [at(boxg(0.22, 0.04, 0.05), 0, 1.15, 0.27), 0x111111]])
    : merge([[at(boxg(0.5, 1.1, 0.4), 0, 0.85, 0), regKey === 'us' ? 0x1f3a7a : regKey === 'india' ? 0xb02020 : 0xd8a020], [at(cyl(0.05, 0.05, 0.3), 0, 0.15, 0), 0x333333]]);
  T[5] = merge([[at(boxg(3.2, 0.08, 1.5), 0, 2.55, 0), 0x2c2e30], ...[-1.55, 1.55].map(x => [at(boxg(0.07, 2.5, 0.07), x, 1.25, -0.65), 0x2c2e30]), ...[-1.55, 1.55].map(x => [at(boxg(0.07, 2.5, 0.07), x, 1.25, 0.65), 0x2c2e30]),
    [at(boxg(3.1, 2.2, 0.03), 0, 1.35, -0.68), 0x9fb6c0], [at(boxg(1.6, 0.04, 0.38), 0, 0.5, -0.45), 0x5a5e62], [at(cyl(0.04, 0.04, 3.0), 1.9, 1.5, 0.6), 0x55595c], [at(cyl(0.3, 0.3, 0.05, 20), 1.9, 2.8, 0.6, Math.PI / 2), regKey === 'uk' ? 0xd01818 : 0x2050a0]]);
  glow[5] = [at(boxg(1.0, 1.6, 0.04), 1.2, 1.3, -0.64)];
  T[6] = merge([[at(cyl(0.08, 0.1, 3.6, 8), 0, 1.8, 0), 0x2a2c2e], [at(boxg(0.36, 1.0, 0.28), 0, 3.6, 0.12), 0x161718], [at(boxg(0.5, 1.15, 0.03), 0, 3.6, -0.03), 0x161718]]);
  glow.sig = [0, 1, 2].map(i => at(cyl(0.1, 0.1, 0.05, 12), 0, 3.95 - i * 0.33, 0.27, Math.PI / 2));
  T[7] = merge([[at(cyl(0.12, 0.14, 0.62, 12), 0, 0.31, 0), 0xc01818], [at(new THREE.SphereGeometry(0.13, 12, 6, 0, 6.3, 0, 1.6), 0, 0.62, 0), 0xc01818], [at(cyl(0.05, 0.05, 0.42, 8), 0, 0.42, 0, 0, 0, Math.PI / 2), 0xc8a040]]);
  T[8] = merge([[at(cyl(0.26, 0.22, 0.95, 14), 0, 0.48, 0), regKey === 'uk' ? 0x111214 : 0x3a4a3c], [at(cyl(0.28, 0.28, 0.08, 14), 0, 0.98, 0), regKey === 'uk' ? 0xb08a30 : 0x2a2c2e]]);
  T[9] = merge([[at(boxg(1.0, 2.25, 1.0), 0, 1.125, 0), 0xc4141a], [at(boxg(1.08, 0.2, 1.08), 0, 2.32, 0), 0xc4141a], [at(new THREE.CylinderGeometry(0.55, 0.55, 1.08, 20, 1, false, 0, Math.PI), 0, 2.42, 0, 0, 0, Math.PI / 2), 0xc4141a],
    ...[[0, 0.505], [0, -0.505], [0.505, 0], [-0.505, 0]].map(([x, z]) => [at(boxg(x ? 0.02 : 0.7, 1.4, z ? 0.02 : 0.7), x, 1.25, z), 0x283038]), ...[[0, 0.55], [0, -0.55], [0.55, 0], [-0.55, 0]].map(([x, z]) => [at(boxg(x ? 0.02 : 0.6, 0.14, z ? 0.02 : 0.6), x, 2.18, z), 0xf0f0e8])]);
  glow[9] = [at(boxg(0.92, 0.12, 0.92), 0, 2.18, 0)];
  return { T, glow };
}
function buildTrees() {
  const out = {}, bark = 0x6a5a48;
  const broad = (sp) => {
    const clumps = sp === 'plane' ? [[0, 7.2, 0, 2.6], [1.8, 8.4, 0.6, 2.2], [-1.6, 8.0, -0.8, 2.3], [0.3, 9.6, -0.4, 2.0], [0.6, 6.4, 1.8, 1.8]] : sp === 'rain' ? [[0, 6.2, 0, 2.4], [2.6, 6.0, 0.8, 2.2], [-2.5, 6.1, -0.6, 2.2], [0.6, 6.5, 2.4, 2.0], [-0.5, 6.3, -2.4, 2.0]] : [[0, 6.6, 0, 2.6], [1.3, 7.6, 0.3, 2.0], [-1.1, 7.4, -0.5, 2.1], [0.1, 8.6, 0.2, 1.8]];
    const parts = [[at(cyl(0.2, 0.32, 6, 8), 0, 3, 0), sp === 'plane' ? 0x8f8a70 : bark], [at(cyl(0.08, 0.14, 3, 6), 0.9, 6.0, 0, 0, 0, -0.6), bark], [at(cyl(0.08, 0.13, 3, 6), -0.8, 5.8, -0.3, 0.3, 0, 0.6), bark]];
    for (const [x, y, z, r] of clumps) parts.push([noisy(at(new THREE.IcosahedronGeometry(r * 0.85, 1), x, y, z), 0.35, x * 7), 0x3f6a2c]);
    const far = merge([[at(cyl(0.2, 0.3, 6, 5), 0, 3, 0), bark], [at(new THREE.IcosahedronGeometry(sp === 'rain' ? 3.6 : 3.2, 0), 0, sp === 'rain' ? 6.4 : 7.4, 0).scale(1, sp === 'rain' ? 0.6 : 1, 1), 0x3f6a2c]]);
    return { solid: merge(parts), cards: cards(clumps, 7, 2.1), far };
  };
  out.plane = broad('plane'); out.broadleaf = broad('broadleaf'); out.rain = broad('rain');
  { const parts = [[at(cyl(0.12, 0.3, 9, 7), 0, 4.5, 0), bark]], cl = [];
    for (let i = 0; i < 5; i++) { const y = 3 + i * 1.5, r = 2.6 - i * 0.45; parts.push([noisy(at(new THREE.ConeGeometry(r, 2.6, 9), 0, y + 1, 0), 0.15, i), 0x2a4a2a]); cl.push([0, y + 1, 0, r * 0.7]); }
    out.conifer = { solid: merge(parts), cards: cards(cl, 4, 1.6), far: merge([[at(cyl(0.12, 0.3, 4, 5), 0, 2, 0), bark], [at(new THREE.ConeGeometry(2.6, 8, 6), 0, 6.5, 0), 0x2a4a2a]]) }; }
  { const parts = [], fr = [];
    for (let i = 0; i < 10; i++) { const t0 = i / 10, t1 = (i + 1) / 10, x0 = Math.sin(t0 * 1.3) * 1.2, x1 = Math.sin(t1 * 1.3) * 1.2, L = Math.hypot(x1 - x0, 1.1); parts.push([at(cyl(0.16 - t1 * 0.05, 0.17 - t0 * 0.05, L, 7), (x0 + x1) / 2, (t0 + t1) / 2 * 11, 0, 0, 0, -Math.atan2(x1 - x0, 1.1)), 0x7a6a50]); }
    const top = [Math.sin(1.3) * 1.2, 11];
    for (let i = 0; i < 9; i++) { const g = new THREE.PlaneGeometry(0.9, 4.2, 1, 4), p = g.attributes.position; for (let k = 0; k < p.count; k++) { const y = p.getY(k) + 2.1; p.setXYZ(k, p.getX(k), -0.12 * y * y, y); } g.translate(0, 0, 0.1); g.rotateX(-0.25); g.rotateY(i / 9 * 6.283); g.translate(top[0], top[1], 0); fr.push(g); }
    const cg = mergeGeometries(fr); cg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(cg.attributes.position.count * 3).fill(1), 3));
    parts.push([at(new THREE.SphereGeometry(0.35, 8, 6), top[0], top[1], 0), 0x5a4a28]);
    out.palm = { solid: merge(parts), cards: cg, palm: true, far: merge([[at(cyl(0.14, 0.17, 11, 5), 0.6, 5.5, 0, 0, 0, -0.1), 0x7a6a50], [at(new THREE.ConeGeometry(3, 1.6, 7), top[0], top[1] - 0.3, 0).rotateX(Math.PI), 0x4a7a2a]]) }; }
  return out;
}

export class Props {
  constructor(scene, q) {
    this.scene = scene; this.q = q; this.chunks = new Set(); this.dynamic = []; this.center = { x: 0, z: 0 }; this.dirty = true; this.sigT = 0; this.regKey = null;
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
    this.treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
    this.leafMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.85 });
    this.frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: frondTexture(), alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    this.glowMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    this.sigMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.trees = buildTrees(); this.meshes = []; this.byRegion = {};
    this.lights = []; for (let i = 0; i < (q.lampLights || 6); i++) { const l = new THREE.PointLight(0xffc88a, 0, 26, 1.7); l.castShadow = false; scene.add(l); this.lights.push(l); } this.lightT = 0; this.night = 0;
  }
  types(regKey) { return this.byRegion[regKey] || (this.byRegion[regKey] = buildTypes(regKey)); }
  // seasonal foliage tint for the real date and hemisphere
  foliage() {
    const d = new Date(G.sky.now()), m = d.getUTCMonth() + d.getUTCDate() / 31, south = Geo.toLat(G.player ? G.player.pos.z : 0) < 0, mm = south ? (m + 6) % 12 : m, trop = Math.abs(Geo.toLat(G.player ? G.player.pos.z : 0)) < 23;
    const autumn = trop ? 0 : smooth(8.3, 10.2, mm) * (1 - smooth(11.2, 12, mm)), winter = trop ? 0 : Math.max(smooth(11, 12, mm), 1 - smooth(1.5, 3.2, mm));
    return new THREE.Color().setRGB(lerp(0.36, 0.78, autumn) * lerp(1, 0.75, winter), lerp(0.58, 0.48, autumn) * lerp(1, 0.75, winter), lerp(0.24, 0.12, autumn));
  }
  addChunk(ch, r) {
    for (const p of ch.props) {
      const S = SPEC[p.t]; if (!S) continue;
      p.alive = true; p.y = Geo.height(p.x, p.z); p.chunk = ch;
      if (p.t === 20) { if (p.sp === 'tropical') p.sp = p.r < 0.45 ? 'palm' : 'rain'; if (!TREE_SPECIES.includes(p.sp)) p.sp = 'broadleaf'; p.s = p.s || 1; p.rad = S.r * p.s * (p.sp === 'palm' ? 0.7 : 1); p.br = p.s < 0.85 && p.sp !== 'palm' ? 9 : 60; p.m = S.m * p.s * p.s; p.h = (p.sp === 'palm' ? 11 : 9) * p.s; }
      else { p.rad = S.r; p.br = S.br; p.m = S.m; p.h = S.h; }
      if (p.rot === undefined) p.rot = (p.r || 0) * 6.283;
      if (p.y < 0.2 && p.t !== 20) p.alive = false;
    }
    // London: K6 phone boxes beside some pillar boxes
    if (ch.regKey === 'uk') for (const p of ch.props.slice()) if (p.t === 4 && p.r < 0.35) ch.props.push({ t: 9, x: p.x + Math.cos(p.rot) * 1.6, z: p.z + Math.sin(p.rot) * 1.6, rot: p.rot, r: p.r, alive: true, y: p.y, chunk: ch, rad: SPEC[9].r, br: SPEC[9].br, m: SPEC[9].m, h: SPEC[9].h });
    this.chunks.add(ch); this.dirty = true;
  }
  dropChunk(ch) { this.chunks.delete(ch); this.dirty = true; }
  clear() { this.chunks.clear(); for (const d of this.dynamic) this.scene.remove(d.mesh); this.dynamic.length = 0; this.dirty = true; }
  recenter(cx, cz) { this.center = { x: cx, z: cz }; this.dirty = true; }
  // instanced draw of every intact prop near the player
  rebuild() {
    this.dirty = false; for (const m of this.meshes) this.scene.remove(m); this.meshes.length = 0;
    const R = this.q.propR || 3, groups = new Map(), add = (k, geo, mat, p, sc, shadow) => { let g = groups.get(k); if (!g) groups.set(k, g = { geo, mat, list: [], shadow }); g.list.push([p, sc]); };
    const fol = this.foliage(); this.sigs = [];
    for (const ch of this.chunks) {
      const d = Math.max(Math.abs(ch.cx - this.center.x), Math.abs(ch.cz - this.center.z)); if (d > R) continue;
      const types = this.types(ch.regKey);
      for (const p of ch.props) {
        if (!p.alive) continue; if (ch.hgt && !p.snapped) { p.y = G.world.groundAt(p.x, p.z); p.snapped = true; }
        if (p.t === 20) {
          const tr = this.trees[p.sp]; if (d <= 1) { add('ts' + p.sp, tr.solid, this.treeMat, p, p.s, true); add('tc' + p.sp, tr.cards, tr.palm ? this.frondMat : this.leafMat, p, p.s, true); } else add('tf' + p.sp, tr.far, this.treeMat, p, p.s, false);
          continue;
        }
        const geo = types.T[p.t]; if (!geo) continue; add(ch.regKey + p.t, geo, this.mat, p, 1, d <= 1);
        const gl = types.glow[p.t]; if (gl) for (let i = 0; i < gl.length; i++) add('g' + ch.regKey + p.t + i, gl[i], this.glowMat, p, 1, false);
        if (p.t === 6) this.sigs.push(p);
      }
    }
    for (const [k, g] of groups) {
      const m = new THREE.InstancedMesh(g.geo, g.mat, g.list.length); m.castShadow = g.shadow; m.receiveShadow = true;
      const tree = k[0] === 't', col = new THREE.Color();
      g.list.forEach(([p, sc], i) => {
        _m.compose(_a.set(p.x, p.y - (tree ? 0.15 : 0), p.z), _q.setFromAxisAngle(_b.set(0, 1, 0), p.rot), _s.set(sc, sc, sc)); m.setMatrixAt(i, _m);
        if (tree) { const v = 0.85 + hash2(Math.round(p.x), Math.round(p.z), 4) * 0.3; m.setColorAt(i, k[1] === 'c' || k[1] === 'f' ? col.copy(p.sp === 'palm' ? new THREE.Color(0.5, 0.65, 0.3) : fol).multiplyScalar(v) : col.setRGB(v, v, v)); }
      });
      m.computeBoundingSphere(); this.scene.add(m); this.meshes.push(m);
    }
    // traffic lights: one lens per signal, recoloured on a cycle
    const types = this.types(this.regKey || 'europe');
    if (this.sigs.length) { this.sigMesh = new THREE.InstancedMesh(types.glow.sig[0], this.sigMat, this.sigs.length); this.sigMesh.frustumCulled = false; this.scene.add(this.sigMesh); this.meshes.push(this.sigMesh); this.sigT = 0; }
  }
  setLighting(night, blackout) {
    this.night = blackout ? 0 : smooth(0.3, 0.75, night);
    this.glowMat.color.setRGB(1, 0.86, 0.62).multiplyScalar(blackout ? 0.05 : lerp(0.35, 3.2, smooth(0.25, 0.7, night)));
  }
  update(dt) {
    if (G.world && G.world.cityMats !== undefined) this.regKey = (G.world.chunkAt(G.player.pos.x, G.player.pos.z) || {}).regKey;
    if (this.dirty) this.rebuild();
    // signals: 22 s cycle, staggered by junction
    this.sigT -= dt;
    if (this.sigMesh && this.sigT <= 0) {
      this.sigT = 0.5; const c = new THREE.Color(), off = G.powers && G.powers.blackoutT > 0;
      this.sigs.forEach((p, i) => {
        const ph = ((G.time + hash2(Math.round(p.x / 30), Math.round(p.z / 30), 1) * 22) % 22), st = ph < 10 ? 0 : ph < 12 ? 1 : ph < 21 ? 2 : 1;
        _m.compose(_a.set(p.x, p.y - st * 0.33, p.z), _q.setFromAxisAngle(_b.set(0, 1, 0), p.rot), _s.set(1, 1, 1)); this.sigMesh.setMatrixAt(i, _m);
        this.sigMesh.setColorAt(i, off ? c.setRGB(0.02, 0.02, 0.02) : st === 0 ? c.setRGB(3, 0.15, 0.1) : st === 1 ? c.setRGB(3, 1.6, 0.1) : c.setRGB(0.1, 3, 0.8));
      });
      this.sigMesh.instanceMatrix.needsUpdate = true; if (this.sigMesh.instanceColor) this.sigMesh.instanceColor.needsUpdate = true;
    }
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 0.4; const P = G.player.pos, near = [];
      if (this.night > 0.01) this.forNear(P.x, P.z, 70, q => { if (q.t === 1) near.push([(q.x - P.x) ** 2 + (q.z - P.z) ** 2, q]); });
      near.sort((a, b) => a[0] - b[0]);
      this.lights.forEach((l, i) => { const n = near[i]; if (!n) { l.intensity = 0; return; } const q = n[1], reg = q.chunk.regKey, white = reg === 'us' || reg === 'eastasia' || reg === 'japan' || reg === 'gulf';
        l.position.set(q.x + (q.lampArm || 0), q.y + 6.2, q.z); l.color.setHex(white ? 0xe8eeff : reg === 'india' ? 0xffb060 : 0xffd4a0); l.intensity = this.night * 60; });
    }
    this.simulate(dt);
  }
  // ---------- queries ----------
  forNear(x, z, r, cb) {
    for (let cx = Math.floor((x - r) / CH); cx <= Math.floor((x + r) / CH); cx++) for (let cz = Math.floor((z - r) / CH); cz <= Math.floor((z + r) / CH); cz++) {
      const ch = G.world.chunkAt(cx * CH + 1, cz * CH + 1); if (!ch) continue;
      for (const p of ch.props) if (p.alive && Math.abs(p.x - x) < r + p.rad && Math.abs(p.z - z) < r + p.rad) cb(p);
    }
  }
  // characters bump into intact props
  collide(p, r, h, v, out) {
    this.forNear(p.x, p.z, r + 1.5, q => {
      if (p.y > q.y + q.h || p.y + h < q.y) return;
      const dx = p.x - q.x, dz = p.z - q.z, rr = r + q.rad, d2 = dx * dx + dz * dz; if (d2 >= rr * rr) return;
      if (q.h < 1.2 && p.y > q.y + q.h - 0.5 && v.y <= 0.5) { p.y = q.y + q.h; if (v.y < 0) v.y = 0; out.grounded = true; return; }
      const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d; p.x = q.x + nx * rr; p.z = q.z + nz * rr;
      const vn = v.x * nx + v.z * nz; if (vn < 0) { v.x -= vn * nx; v.z -= vn * nz; }
      if (!out.wall && q.h > 3) out.wall = { x: nx, z: nz, box: null };
    });
  }
  // a car (oriented box) against props: snap them off or stop dead
  carHit(car) {
    const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw), hl = car.spec.len / 2, hw = car.spec.w / 2, sp = Math.hypot(car.vel.x, car.vel.z);
    let res = null;
    this.forNear(car.pos.x, car.pos.z, hl + 1, q => {
      const dx = q.x - car.pos.x, dz = q.z - car.pos.z, lf = dx * fx + dz * fz, ls = dx * fz - dz * fx;
      if (Math.abs(lf) > hl + q.rad || Math.abs(ls) > hw + q.rad || car.pos.y > q.y + q.h || car.pos.y + 1.6 < q.y) return;
      const vrel = car.vel.x * (dx) + car.vel.z * (dz), toward = vrel / (Math.hypot(dx, dz) || 1);
      if (sp > q.br && toward > 0) {
        // break it free and carry the momentum exchange
        const m = car.spec.mass, k = m / (m + q.m * 0.6);
        car.vel.multiplyScalar(k); this.knock(q, _a.set(car.vel.x, 0, car.vel.z).multiplyScalar(1.15 / k), car.pos);
        car.damage(q.m / 40 * (1 - k) * 20 + 2, q.x, q.z); G.audio.crash(q, Math.min(20, sp)); if (car === G.player.car) G.shake = Math.max(G.shake, Math.min(0.6, q.m / 900));
        if (q.t === 7) G.fx.burst(_c.set(q.x, q.y + 0.5, q.z), 0xbfe4ff, 40, 9, 1.5, 1.4, 14, 0.3, _b.set(0, 12, 0));
      } else {
        // solid: push the car out along the shallower side and absorb the impact
        const pf = hl + q.rad - Math.abs(lf), ps = hw + q.rad - Math.abs(ls);
        let nx, nz; if (pf < ps) { const s = Math.sign(lf); nx = -fx * s; nz = -fz * s; car.pos.x += nx * pf; car.pos.z += nz * pf; } else { const s = Math.sign(ls); nx = -fz * s; nz = fx * s; car.pos.x += nx * ps; car.pos.z += nz * ps; }
        const vn = car.vel.x * nx + car.vel.z * nz; if (vn < 0) { car.vel.x -= vn * nx * 1.3; car.vel.z -= vn * nz * 1.3; if (-vn > 3) { car.damage(-vn * 2.2, q.x, q.z); G.audio.crash(q, -vn); if (car === G.player.car) G.shake = Math.min(1, -vn / 14); car.spinFrom(q.x, q.z, -vn); } }
        res = { x: nx, z: nz };
      }
    });
    return res;
  }
  // punches and explosions
  blast(p, r, force) {
    this.forNear(p.x, p.z, r, q => { const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz); if (d > r || q.br > force * 1.5 + 4) return; const k = force * (1 - d / r * 0.5) / Math.max(1, d); this.knock(q, _a.set(dx * k, force * 0.35, dz * k), p); });
  }
  punch(p, dir, force) { let hit = false; this.forNear(p.x + dir.x, p.z + dir.z, 1.4, q => { if (hit || q.br > force + 3) return; hit = true; this.knock(q, _a.copy(dir).multiplyScalar(force).setY(2), p); G.audio.crash(q, 8); }); return hit; }
  // ---------- rigid bodies ----------
  knock(q, vel, from) {
    q.alive = false; this.dirty = true;
    const types = this.types(q.chunk.regKey), tree = q.t === 20;
    const grp = new THREE.Group();
    if (tree) { const tr = this.trees[q.sp]; grp.add(new THREE.Mesh(tr.solid, this.treeMat), new THREE.Mesh(tr.cards, tr.palm ? this.frondMat : this.leafMat)); grp.children[1].material = grp.children[1].material.clone(); grp.children[1].material.color = this.foliage(); grp.scale.setScalar(q.s); }
    else { grp.add(new THREE.Mesh(types.T[q.t], this.mat)); const gl = types.glow[q.t]; if (gl) for (const g of gl) grp.add(new THREE.Mesh(g, this.glowMat)); }
    grp.traverse(o => { o.castShadow = true; }); this.scene.add(grp);
    const h = q.h, w = Math.max(0.35, q.rad), y0 = q.y, cs = Math.cos(q.rot), sn = Math.sin(q.rot);
    // local frame points: base, top, +x, +z (scaled for trees)
    const L = [[0, 0, 0], [0, h, 0], [w * 1.4, h * 0.3, 0], [0, h * 0.3, w * 1.4]];
    const pts = L.map(([x, y, z]) => { const wx = q.x + x * cs + z * sn, wz = q.z - x * sn + z * cs; return { p: V().set(wx, y0 + y, wz), o: V(), m: 1 }; });
    // the hit point moves with the car; the rest lags behind and topples
    pts.forEach((pt, i) => { const lag = i === 1 ? 0.25 : i === 0 ? 1 : 0.6; pt.o.copy(pt.p).addScaledVector(vel, -lag / 120); if (i === 1) pt.o.y -= 0.02; });
    const cons = []; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) cons.push([i, j, pts[i].p.distanceTo(pts[j].p)]);
    const body = { mesh: grp, pts, cons, L, life: 90, rest: 0, tree, q, scale: tree ? q.s : 1, h };
    this.dynamic.push(body);
    if (this.dynamic.length > 40) { const old = this.dynamic.shift(); this.scene.remove(old.mesh); }
    G.fx.burst(_c.set(q.x, y0 + 1, q.z), tree ? 0x6a8a3a : 0xdddddd, tree ? 30 : 12, 5, 0.8, tree ? 1.5 : 0.8, 8, 1);
    if (q.t === 1 || q.t === 6) G.fx.burst(_c.set(q.x, y0 + h, q.z), 0xffd070, 20, 6, 0.5, 0.7, 14, 0.4);
  }
  simulate(dt) {
    const steps = 2, h = Math.min(dt, 0.033) / steps, g = -24 * h * h;
    for (const b of this.dynamic) {
      if (b.rest > 1.5) continue;
      for (let s = 0; s < steps; s++) {
        let moved = 0;
        for (const pt of b.pts) {
          const vx = (pt.p.x - pt.o.x) * 0.995, vy = (pt.p.y - pt.o.y) * 0.995, vz = (pt.p.z - pt.o.z) * 0.995; pt.o.copy(pt.p); pt.p.x += vx; pt.p.y += vy + g; pt.p.z += vz; moved += Math.abs(vx) + Math.abs(vy) + Math.abs(vz);
        }
        for (let it = 0; it < 5; it++) {
          for (const [i, j, L] of b.cons) { const A = b.pts[i].p, B = b.pts[j].p, d = _a.subVectors(B, A), l = d.length() || 1e-6, k = (l - L) / l * 0.5; A.addScaledVector(d, k); B.addScaledVector(d, -k); }
          for (const pt of b.pts) {
            const gy = G.world.groundAt(pt.p.x, pt.p.z) + 0.05;
            if (pt.p.y < gy) { pt.p.y = gy; const fr = 0.55; pt.o.x = pt.p.x - (pt.p.x - pt.o.x) * fr; pt.o.z = pt.p.z - (pt.p.z - pt.o.z) * fr; if (pt.o.y < pt.p.y) pt.o.y = pt.p.y + (pt.p.y - pt.o.y) * 0.25; }
            G.world.forBoxes(pt.p.x - 0.1, pt.p.z - 0.1, pt.p.x + 0.1, pt.p.z + 0.1, s2 => { if (pt.p.y > s2.maxy || pt.p.y < s2.miny || !insideSolid(s2, pt.p.x, pt.p.z)) return; if (pt.p.y > s2.maxy - 0.6) { pt.p.y = s2.maxy; return; } nearestWall(s2, pt.p.x, pt.p.z, _n); pt.p.x = _n.x; pt.p.z = _n.z; });
          }
        }
        b.rest = moved < 0.004 * 4 ? b.rest + h : 0;
      }
      // cars shove debris out of the way
      for (const c of G.ents.cars) { if (c.pos.distanceToSquared(b.pts[0].p) > 64) continue; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
        for (const pt of b.pts) { const dx = pt.p.x - c.pos.x, dz = pt.p.z - c.pos.z, lf = dx * fx + dz * fz, ls = dx * fz - dz * fx; if (Math.abs(lf) < c.spec.len / 2 && Math.abs(ls) < c.spec.w / 2 && pt.p.y < c.pos.y + 1.4) { const s = Math.sign(ls) || 1; pt.p.x += fz * s * 0.08 + c.vel.x * h; pt.p.z += -fx * s * 0.08 + c.vel.z * h; pt.p.y += 0.03; b.rest = 0; } } }
      // pose the mesh from the four points
      const P = b.pts, yx = _a.subVectors(P[1].p, P[0].p).normalize(), xx = _b.subVectors(P[2].p, P[0].p); xx.addScaledVector(yx, -xx.dot(yx)).normalize();
      const zz = _c.crossVectors(xx, yx);
      _m.makeBasis(xx, yx, zz); b.mesh.quaternion.setFromRotationMatrix(_m); b.mesh.position.copy(P[0].p);
      b.life -= dt;
    }
    for (let i = this.dynamic.length - 1; i >= 0; i--) { const b = this.dynamic[i]; if (b.life <= 0 || b.pts[0].p.distanceToSquared(G.player.pos) > 400 * 400) { this.scene.remove(b.mesh); this.dynamic.splice(i, 1); } }
  }
}
