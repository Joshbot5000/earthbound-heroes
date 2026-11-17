// Vehicles built from lofted cross-sections: a smooth body, a glass cabin with painted roof and
// pillars, tyres and spoked rims, arches, lights, mirrors, plates. Each car owns its body geometry
// so crashes can dent it where it was hit.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G } from './util.js';

// body stations: [z, halfWidth, bottom, top]; cabin: [z, roofY], belt = body top at that z
const TYPES = {
  sedan: { len: 4.7, w: 1.8, mass: 1450, max: 46, acc: 12, wheel: 0.33, wb: 1.38, track: 0.78,
    body: [[-2.35, 0.8, 0.42, 0.74], [-2.25, 0.88, 0.3, 0.96], [-1.6, 0.9, 0.28, 1.0], [0.6, 0.9, 0.28, 0.98], [1.6, 0.89, 0.3, 0.88], [2.2, 0.85, 0.33, 0.76], [2.36, 0.76, 0.42, 0.62]],
    cab: [[-1.75, 0.0], [-1.25, 0.44], [0.25, 0.47], [1.15, 0.0]], cabW: [0.85, 0.67] },
  hatch: { len: 4.1, w: 1.76, mass: 1200, max: 42, acc: 12, wheel: 0.31, wb: 1.28, track: 0.76,
    body: [[-2.05, 0.82, 0.4, 0.9], [-1.95, 0.87, 0.3, 0.98], [0.5, 0.88, 0.28, 0.98], [1.5, 0.86, 0.3, 0.84], [1.98, 0.8, 0.34, 0.7], [2.06, 0.72, 0.42, 0.6]],
    cab: [[-1.98, 0.0], [-1.7, 0.52], [0.15, 0.56], [1.05, 0.0]], cabW: [0.84, 0.66] },
  suv: { len: 4.8, w: 1.92, mass: 2100, max: 44, acc: 11, wheel: 0.4, wb: 1.42, track: 0.84,
    body: [[-2.4, 0.88, 0.55, 1.15], [-2.3, 0.94, 0.42, 1.24], [0.8, 0.96, 0.4, 1.24], [1.9, 0.95, 0.44, 1.14], [2.35, 0.9, 0.48, 1.0], [2.42, 0.84, 0.56, 0.86]],
    cab: [[-2.3, 0.0], [-2.1, 0.62], [0.5, 0.66], [1.35, 0.0]], cabW: [0.92, 0.76] },
  sport: { len: 4.5, w: 1.95, mass: 1400, max: 76, acc: 22, wheel: 0.34, wb: 1.36, track: 0.84,
    body: [[-2.25, 0.86, 0.36, 0.78], [-2.1, 0.98, 0.26, 0.86], [-0.9, 0.98, 0.24, 0.88], [0.9, 0.96, 0.24, 0.74], [1.9, 0.92, 0.25, 0.6], [2.26, 0.8, 0.3, 0.46]],
    cab: [[-1.6, 0.0], [-0.95, 0.36], [0.05, 0.38], [0.95, 0.0]], cabW: [0.86, 0.64] },
  van: { len: 5.3, w: 2.0, mass: 2600, max: 36, acc: 9, wheel: 0.38, wb: 1.7, track: 0.86,
    body: [[-2.65, 0.98, 0.45, 1.05], [-2.6, 1.0, 0.4, 1.1], [1.6, 1.0, 0.4, 1.1], [2.4, 0.98, 0.42, 1.0], [2.66, 0.9, 0.48, 0.8]],
    cab: [[-2.6, 1.05], [-2.55, 1.15], [1.45, 1.15], [2.1, 0.0]], cabW: [0.99, 0.95], panel: true },
  cab_london: { len: 4.6, w: 1.85, mass: 1950, max: 40, acc: 10, wheel: 0.34, wb: 1.42, track: 0.78, fixedColor: 0x101114, sign: 0xffb020,
    body: [[-2.3, 0.84, 0.42, 0.9], [-2.2, 0.9, 0.32, 1.02], [0.6, 0.92, 0.3, 1.02], [1.7, 0.9, 0.32, 0.94], [2.25, 0.84, 0.36, 0.8], [2.32, 0.78, 0.44, 0.66]],
    cab: [[-2.15, 0.0], [-1.85, 0.8], [0.45, 0.82], [1.3, 0.0]], cabW: [0.86, 0.74] },
  cab_ny: { len: 5.2, w: 1.95, mass: 1800, max: 44, acc: 11, wheel: 0.34, wb: 1.45, track: 0.8, fixedColor: 0xf2b705, sign: 0xfff2c0,
    body: [[-2.6, 0.86, 0.42, 0.78], [-2.5, 0.95, 0.3, 0.98], [-1.7, 0.97, 0.28, 1.0], [0.8, 0.97, 0.28, 0.98], [1.8, 0.96, 0.3, 0.9], [2.5, 0.92, 0.33, 0.8], [2.6, 0.84, 0.42, 0.66]],
    cab: [[-1.85, 0.0], [-1.3, 0.46], [0.35, 0.48], [1.25, 0.0]], cabW: [0.9, 0.72] },
  taxi_mumbai: { len: 4.0, w: 1.55, mass: 950, max: 32, acc: 8, wheel: 0.3, wb: 1.2, track: 0.66, fixedColor: 0x0f1012, roofColor: 0xf2c418,
    body: [[-2.0, 0.66, 0.44, 0.78], [-1.85, 0.76, 0.32, 0.92], [-0.5, 0.78, 0.3, 0.94], [1.0, 0.77, 0.3, 0.9], [1.8, 0.72, 0.34, 0.82], [2.0, 0.62, 0.44, 0.7]],
    cab: [[-1.45, 0.0], [-1.05, 0.52], [0.25, 0.54], [0.85, 0.0]], cabW: [0.72, 0.58] },
  bus_london: { len: 11.2, w: 2.55, mass: 12000, max: 24, acc: 4, wheel: 0.52, wb: 3.2, track: 1.05, fixedColor: 0xc8101a, bus: 2,
    body: [[-5.6, 1.22, 0.4, 4.25], [-5.55, 1.27, 0.32, 4.35], [5.45, 1.27, 0.32, 4.35], [5.6, 1.22, 0.4, 4.25]], cab: null },
  bus_mumbai: { len: 11, w: 2.5, mass: 11000, max: 22, acc: 4, wheel: 0.52, wb: 3.1, track: 1.02, fixedColor: 0xb3141c, stripe: 0xe8dcc0, bus: 1,
    body: [[-5.5, 1.2, 0.45, 3.0], [-5.45, 1.25, 0.38, 3.1], [5.35, 1.25, 0.38, 3.1], [5.5, 1.2, 0.45, 3.0]], cab: null },
  rickshaw: { len: 2.75, w: 1.35, mass: 420, max: 15, acc: 5, wheel: 0.24, wb: 0.95, track: 0.58, fixedColor: 0x161616, roofColor: 0xf0c020, rick: true,
    body: [[-1.3, 0.6, 0.3, 0.75], [-1.2, 0.66, 0.24, 0.9], [0.2, 0.66, 0.24, 0.88], [0.9, 0.42, 0.26, 0.85], [1.35, 0.25, 0.3, 0.9]], cab: null },
};
export const VEHICLE_SPECS = TYPES;

function loft(st, K = 20, e = 0.32) {
  const pos = [], idx = [], n = st.length, sp = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
  for (const [z, w, b, t] of st) {
    const mid = (b + t) / 2, hh = (t - b) / 2;
    for (let k = 0; k < K; k++) { const a = k / K * Math.PI * 2; pos.push(w * sp(Math.cos(a), e), mid + hh * sp(Math.sin(a), e), z); }
  }
  for (let i = 0; i < n - 1; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = a + K, d = b + K; idx.push(a, b, c, b, d, c); }
  const cap = (i, flip) => { const ci = pos.length / 3; const [z, , b, t] = st[i]; pos.push(0, (b + t) / 2, z); for (let k = 0; k < K; k++) { const a = i * K + k, b2 = i * K + (k + 1) % K; flip ? idx.push(ci, b2, a) : idx.push(ci, a, b2); } };
  cap(0, true); cap(n - 1, false);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}
function cabinGeo(d) {
  const K = 16, st = [];
  // belt line follows the body top under each cabin station
  const belt = z => { const b = d.body; for (let i = 0; i < b.length - 1; i++) if (z >= b[i][0] && z <= b[i + 1][0]) { const t = (z - b[i][0]) / (b[i + 1][0] - b[i][0]); return b[i][3] + (b[i + 1][3] - b[i][3]) * t; } return b[0][3]; };
  for (let i = 0; i < 9; i++) {
    const t = i / 8, c = d.cab, segs = c.length - 1, f = t * segs, j = Math.min(segs - 1, Math.floor(f)), u = f - j;
    const z = c[j][0] + (c[j + 1][0] - c[j][0]) * u, rise = c[j][1] + (c[j + 1][1] - c[j][1]) * u, by = belt(z) - 0.02;
    st.push([z, by, by + Math.max(0.02, rise)]);
  }
  const pos = [], idx = [], [wb, wt] = d.cabW;
  for (const [z, b, t] of st) for (let k = 0; k < K; k++) {
    const a = k / K * Math.PI * 2, cx = Math.cos(a), sy = Math.sin(a), up = sy > 0 ? 1 : 0, ww = sy > 0 ? wb + (wt - wb) * Math.pow(sy, 0.6) : wb;
    pos.push(ww * Math.sign(cx) * Math.pow(Math.abs(cx), 0.3), b + (t - b) * Math.max(0, Math.sign(sy) * Math.pow(Math.abs(sy), 0.35)), z);
  }
  for (let i = 0; i < st.length - 1; i++) for (let k = 0; k < K; k++) { const a = i * K + k, b = i * K + (k + 1) % K, c = a + K, e = b + K; idx.push(a, b, c, b, e, c); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return { g, st };
}
function wheelGeo(r) {
  const prof = [[r * 0.62, -0.12], [r * 0.9, -0.125], [r * 0.98, -0.1], [r, -0.05], [r, 0.05], [r * 0.98, 0.1], [r * 0.9, 0.125], [r * 0.62, 0.12]].map(([x, y]) => new THREE.Vector2(x, y));
  const tyre = new THREE.LatheGeometry(prof, 22); tyre.rotateZ(Math.PI / 2);
  const rim = [new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.2, 18).rotateZ(Math.PI / 2)];
  const spokes = []; for (let i = 0; i < 5; i++) { const s = new THREE.BoxGeometry(0.03, r * 1.05, 0.07); s.translate(0.115, 0, 0); s.rotateX(i / 5 * Math.PI * 2); spokes.push(s); }
  spokes.push(new THREE.CylinderGeometry(r * 0.16, r * 0.16, 0.25, 10).rotateZ(Math.PI / 2));
  const strip = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
  return { tyre, rim: mergeGeometries([...rim, ...spokes].map(strip)) };
}
const mats = {};
function M() {
  if (mats.glass) return mats;
  mats.glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1218, roughness: 0.04, metalness: 0.2, clearcoat: 1, transparent: true, opacity: 0.88 });
  mats.tyre = new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.92 });
  mats.rim = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, roughness: 0.22, metalness: 0.9 });
  mats.dark = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 0.6, metalness: 0.2 });
  mats.chrome = new THREE.MeshStandardMaterial({ color: 0xd0d4d8, roughness: 0.12, metalness: 1 });
  mats.head = new THREE.MeshStandardMaterial({ color: 0xf4f2ea, emissive: 0xfff2d8, emissiveIntensity: 0.2, roughness: 0.1 });
  mats.tail = new THREE.MeshStandardMaterial({ color: 0x7a0a08, emissive: 0xff1a10, emissiveIntensity: 0.3, roughness: 0.2 });
  mats.plateW = new THREE.MeshStandardMaterial({ color: 0xf0f0ea, roughness: 0.4 }); mats.plateY = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.4 });
  mats.beam = new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.06, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  mats.shadow = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.85 });
  mats.canvas = new THREE.MeshStandardMaterial({ color: 0x2a2c2a, roughness: 0.9, side: THREE.DoubleSide });
  return mats;
}
export function blobTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 31);
  g.addColorStop(0, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
function battenburg(a, b) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d');
  for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) { x.fillStyle = (i + j) % 2 ? a : b; x.fillRect(i * 32, j * 32, 32, 32); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function setVehicleLights(night) { const m = M(); m.head.emissiveIntensity = 0.2 + night * 5; m.tail.emissiveIntensity = 0.3 + night * 2.5; m.beam.opacity = 0.05 * night; }

export function makeVehicle(type, color, police, regKey) {
  const d = TYPES[type] || TYPES.sedan, m = M(), root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const paintCol = police ? (police === 'us' ? 0x111214 : 0xf4f4f0) : d.fixedColor ?? color;
  const dark = new THREE.Color(paintCol).getHSL({}).l < 0.15, paint = new THREE.MeshPhysicalMaterial({ color: paintCol, roughness: dark ? 0.32 : 0.3, metalness: dark ? 0.1 : 0.35, clearcoat: 1, clearcoatRoughness: 0.05 });
  const bodyGeo = loft(d.body, 24, d.bus ? 0.12 : d.rick ? 0.4 : 0.3); const body = new THREE.Mesh(bodyGeo, paint); body.castShadow = true; body.receiveShadow = true; tilt.add(body);
  const add = (g, mat, x, y, z, shadow) => { const o = new THREE.Mesh(g, mat); o.position.set(x, y, z); if (shadow) o.castShadow = true; tilt.add(o); return o; };
  const L = d.len / 2, W = d.w / 2;
  if (d.cab) {
    const { g, st } = cabinGeo(d); add(g, m.glass, 0, 0, 0);
    const roofCol = d.roofColor ?? paintCol, roofMat = d.roofColor ? new THREE.MeshPhysicalMaterial({ color: roofCol, roughness: 0.3, metalness: 0.4, clearcoat: 1 }) : paint;
    // painted roof panel and pillars
    const mid = st[4], top = mid[2]; const zr0 = st[1][0], zr1 = st[7][0];
    const roof = new THREE.BoxGeometry(d.cabW[1] * 2 - 0.04, 0.05, Math.abs(zr1 - zr0) * 0.98); roof.translate(0, top + 0.005, (zr0 + zr1) / 2); add(roof, roofMat, 0, 0, 0, true);
    for (const [i, wd] of [[1, 0.12], [4, 0.09], [7, 0.12]]) { const [z, b, t] = st[i]; for (const s of [-1, 1]) { const p = new THREE.BoxGeometry(0.06, t - b, wd); p.rotateX(i === 1 ? 0.6 : i === 7 ? -0.75 : 0); add(p, roofMat, s * (d.cabW[0] + d.cabW[1]) / 2, (b + t) / 2, z); } }
    if (d.panel) { const p = new THREE.BoxGeometry(d.cabW[0] * 2 + 0.01, 1.0, 3.1); add(p, paint, 0, 1.6, -0.75, true); }
  }
  if (d.bus) {
    // window bands and black skirts
    const hb = d.body[1][3];
    const band = (y0, y1, z0, z1) => { for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, y1 - y0, z1 - z0), m.glass, s * (W + 0.005), (y0 + y1) / 2, (z0 + z1) / 2); };
    if (d.bus === 2) { band(1.25, 2.05, -5.2, 4.6); band(2.75, 3.65, -5.3, 5.3); add(new THREE.BoxGeometry(d.w - 0.1, 0.85, 0.02), m.glass, 0, 3.2, L + 0.005); add(new THREE.BoxGeometry(d.w - 0.3, 1.0, 0.02), m.glass, 0, 1.75, L + 0.005); }
    else { band(1.3, 2.35, -5.0, 4.6); add(new THREE.BoxGeometry(d.w - 0.2, 1.3, 0.02), m.glass, 0, 1.85, L + 0.005); add(new THREE.BoxGeometry(d.w + 0.01, 0.18, d.len - 0.2), new THREE.MeshStandardMaterial({ color: d.stripe, roughness: 0.4 }), 0, 1.05, 0); }
    add(new THREE.BoxGeometry(d.w + 0.02, 0.22, d.len - 0.3), m.dark, 0, 0.5, 0);
    add(new THREE.BoxGeometry(1.4, 0.3, 0.03), new THREE.MeshBasicMaterial({ color: 0xffa020 }), 0, hb - 0.3, L + 0.01);
  }
  if (d.rick) {
    // canopy over the passenger bench, open sides
    const cg = new THREE.CylinderGeometry(0.66, 0.66, 1.9, 16, 1, true, -Math.PI / 2, Math.PI); cg.rotateX(Math.PI / 2); cg.scale(1, 0.55, 1); cg.translate(0, 1.42, -0.2);
    add(cg, new THREE.MeshStandardMaterial({ color: d.roofColor, roughness: 0.6, side: THREE.DoubleSide }), 0, 0, 0, true);
    for (const z of [-1.1, 0.7]) for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.7), m.chrome, s * 0.6, 1.2, z);
    add(new THREE.BoxGeometry(1.15, 0.12, 0.6), m.dark, 0, 0.82, -0.75); add(new THREE.BoxGeometry(1.15, 0.5, 0.1), m.dark, 0, 1.05, -1.05);
    add(new THREE.BoxGeometry(0.6, 0.6, 0.04), m.glass, 0, 1.25, 0.88);
  }
  // lights, grille, mirrors, plates
  const fz = d.body[d.body.length - 1][0], rz = d.body[0][0], fy = d.body[d.body.length - 2][3] - 0.12;
  const lamp = new THREE.SphereGeometry(1, 12, 8); lamp.scale(d.bus ? 0.16 : 0.18, 0.08, 0.06);
  const lights = [];
  for (const s of d.rick ? [0] : [-1, 1]) {
    lights.push(add(lamp, m.head, s * (W - 0.28), d.rick ? 0.95 : fy, fz + 0.02));
    if (!d.rick) add(lamp, m.tail, s * (W - 0.24), d.bus ? 1.0 : d.body[1][3] - 0.12, rz - 0.01);
  }
  if (!d.bus && !d.rick) {
    add(new THREE.BoxGeometry(W * 0.9, 0.16, 0.04), m.dark, 0, fy - 0.12, fz + 0.01);
    const plate = (regKey === 'uk' || regKey === 'india') ? [m.plateW, m.plateY] : [m.plateW, m.plateW];
    add(new THREE.BoxGeometry(0.52, 0.12, 0.02), plate[0], 0, 0.42, fz + 0.03); add(new THREE.BoxGeometry(0.52, 0.12, 0.02), plate[1], 0, 0.5, rz - 0.03);
    if (d.cab) { const cz = d.cab[d.cab.length - 1][0] - 0.25; for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.2, 0.12, 0.08), paint, s * (W + 0.08), d.body[3][3] + 0.08, cz); }
  }
  if (d.sign) { const sg = add(new THREE.BoxGeometry(0.45, 0.14, 0.18), new THREE.MeshStandardMaterial({ color: d.sign, emissive: d.sign, emissiveIntensity: 0.8 }), 0, 0, 0); const top = d.cab ? d.body[3][3] + d.cab[2][1] + 0.08 : 1.6; sg.position.set(0, top, -0.1); }
  // wheels and arches
  const wg = wheelGeo(d.wheel), wheels = [], steer = [];
  const axles = d.rick ? [[0, d.wb], [-1, -d.wb], [1, -d.wb]] : [[-1, d.wb], [1, d.wb], [-1, -d.wb], [1, -d.wb]];
  for (const [s, z] of axles) {
    const piv = new THREE.Group(); piv.position.set(s * (W - (d.rick && s === 0 ? 0 : 0.14)), d.wheel, z); root.add(piv);
    const w = new THREE.Group(); piv.add(w); const t = new THREE.Mesh(wg.tyre, m.tyre); t.castShadow = true; w.add(t, new THREE.Mesh(wg.rim, m.rim));
    if (s < 0) w.rotation.y = Math.PI;
    wheels.push(w); if (z > 0) steer.push(piv);
    if (!d.rick && !d.bus) { const arch = new THREE.TorusGeometry(d.wheel + 0.08, 0.05, 6, 16, Math.PI); add(arch, m.dark, s * (W - 0.02), d.wheel, z).rotation.y = Math.PI / 2; }
  }
  // police markings and light bar
  let bar = null;
  if (police) {
    const bh = d.cab ? d.body[3][3] + d.cab[2][1] + 0.05 : d.body[1][3] + 0.05;
    add(new THREE.BoxGeometry(1.1, 0.1, 0.28), m.dark, 0, bh, -0.1);
    bar = [0xff2030, 0x2060ff].map((col, i) => add(new THREE.BoxGeometry(0.48, 0.1, 0.24), new THREE.MeshBasicMaterial({ color: col }), i ? 0.28 : -0.28, bh + 0.07, -0.1));
    if (police === 'uk') { const t = battenburg('#1840c0', '#f0d020'); for (const s of [-1, 1]) add(new THREE.PlaneGeometry(d.len * 0.85, 0.32), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), s * (W + 0.012), 0.66, 0).rotation.y = s * Math.PI / 2; }
    else if (police === 'us') { for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.45, 2.3), new THREE.MeshPhysicalMaterial({ color: 0xf4f4f0, roughness: 0.3, clearcoat: 1 }), s * (W + 0.005), 0.66, 0.15); }
    else { const col = police === 'india' ? 0x1a3a9a : police === 'gulf' ? 0x1a6a3a : 0x1a3a9a; for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.02, 0.16, d.len * 0.8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4 }), s * (W + 0.006), 0.66, 0); }
  }
  // contact shadow
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(d.w * 1.5, d.len * 1.25), m.shadow); sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.renderOrder = -1; root.add(sh);
  // headlight beams for night driving
  const beam = new THREE.Mesh(new THREE.ConeGeometry(3.2, 16, 14, 1, true).translate(0, -8, 0).rotateX(-Math.PI / 2 - 0.08), m.beam); beam.position.set(0, fy, fz); tilt.add(beam); beam.visible = false;
  return { root, tilt, wheels, steer, paint, bar, spec: d, body, beam, base: bodyGeo.attributes.position.array.slice() };
}
// push the body in around a local impact point
export function dent(v, lx, ly, lz, depth) {
  const p = v.body.geometry.attributes.position, R = 0.85;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), dd = Math.hypot(x - lx, (y - ly) * 1.4, z - lz); if (dd > R) continue;
    const k = depth * (1 - dd / R) ** 2, cx = 0, cy = 0.75, l = Math.hypot(x - cx, y - cy, z) || 1;
    p.setXYZ(i, x - (x - cx) / l * k * 0.6 - Math.sign(z) * k * (Math.abs(z) > v.spec.len / 2 - 0.6 ? 0.8 : 0), y - (y - cy) / l * k * 0.3, z - Math.sign(z) * k * (Math.abs(z) > v.spec.len / 2 - 0.6 ? 0.7 : 0.1));
  }
  p.needsUpdate = true; v.body.geometry.computeVertexNormals();
}
