// Hand-built landmarks at their real coordinates. Inside real cities they replace the plain map
// footprint they stand on. Big Ben shows the real time in London.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G } from './util.js';
import { Geo, CH } from './geo.js';
import { City, BASE } from './city.js';

const M = 111320;
const mats = {};
function canvas(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; }
function MAT() {
  if (mats.stone) return mats;
  const gothic = canvas(128, 256, (x, w, h) => { x.fillStyle = '#d9c9a0'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(80,60,30,0.35)'; for (let i = 8; i < w; i += 20) x.fillRect(i, 0, 3, h); for (let j = 0; j < h; j += 64) { x.fillRect(0, j, w, 4); for (let i = 12; i < w; i += 40) { x.fillStyle = 'rgba(30,25,20,0.7)'; x.fillRect(i, j + 14, 12, 34); x.beginPath(); x.arc(i + 6, j + 14, 6, Math.PI, 0); x.fill(); x.fillStyle = 'rgba(80,60,30,0.35)'; } } });
  gothic.repeat.set(3, 6);
  const lattice = canvas(128, 128, (x, w, h) => { x.clearRect(0, 0, w, h); x.strokeStyle = '#5a4a3a'; x.lineWidth = 7; x.strokeRect(0, 0, w, h); x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, h); x.moveTo(w, 0); x.lineTo(0, h); x.stroke(); x.lineWidth = 2; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, h); x.moveTo(0, h / 2); x.lineTo(w, h / 2); x.stroke(); });
  lattice.repeat.set(6, 30);
  const arcade = canvas(128, 128, (x, w, h) => { x.fillStyle = '#c8b48a'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(20,16,12,1)'; x.fillRect(22, 40, 84, 88); x.beginPath(); x.arc(64, 40, 42, Math.PI, 0); x.fill(); x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, w, 8); });
  const ashlar = canvas(128, 128, (x, w, h) => { x.fillStyle = '#d8b884'; x.fillRect(0, 0, w, h); for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) { const v = 200 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v},${v * 0.86 | 0},${v * 0.62 | 0})`; x.fillRect(k * 32 + (r % 2) * 16 + 1, r * 16 + 1, 30, 14); } }); ashlar.repeat.set(4, 6);
  const tiles = canvas(128, 128, (x, w, h) => { x.fillStyle = '#f2efe6'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(160,150,130,0.5)'; for (let i = 0; i < w; i += 8) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 30, h); x.stroke(); } });
  const curtain = canvas(64, 64, (x, w, h) => { x.fillStyle = '#7d93a6'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(30,40,50,0.8)'; x.fillRect(0, 0, w, 3); x.fillRect(0, 0, 3, h); x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(5, 5, 20, 50); });
  const S = (o) => new THREE.MeshStandardMaterial(o), P = (o) => new THREE.MeshPhysicalMaterial(o);
  Object.assign(mats, {
    stone: S({ color: 0xd8c8a0, roughness: 0.85, map: gothic }), stonePlain: S({ color: 0xd9ccaa, roughness: 0.85 }), portland: S({ color: 0xe6e0d0, roughness: 0.8 }),
    gold: P({ color: 0xe0b040, roughness: 0.22, metalness: 1, clearcoat: 0.5 }), iron: S({ color: 0x2a2e33, roughness: 0.5, metalness: 0.6 }), slate: S({ color: 0x3d4450, roughness: 0.6, metalness: 0.2 }),
    glass: P({ color: 0x8aa4b8, roughness: 0.05, metalness: 0.6, clearcoat: 1, map: curtain }), dark: S({ color: 0x141618, roughness: 0.7 }),
    marble: P({ color: 0xf4f2ec, roughness: 0.35, clearcoat: 0.3 }), copper: S({ color: 0x5fa38a, roughness: 0.55, metalness: 0.3 }),
    basalt: S({ color: 0xe0c08a, roughness: 0.85, map: ashlar }), redtile: S({ color: 0xb8442a, roughness: 0.6 }), lead: S({ color: 0x6a6e70, roughness: 0.5, metalness: 0.4 }),
    lattice: S({ color: 0x8a6a4a, map: lattice, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.3 }),
    redsteel: S({ color: 0xc0362c, roughness: 0.5, metalness: 0.4 }), blue: S({ color: 0x8ab4d8, roughness: 0.5, metalness: 0.3 }), white: S({ color: 0xf2f2ee, roughness: 0.5 }),
    shell: P({ color: 0xf6f3ea, roughness: 0.3, map: tiles, clearcoat: 0.6 }), sand: S({ color: 0xd8b878, roughness: 0.95 }), arcade: S({ map: arcade, roughness: 0.9, color: 0xffffff }),
    concrete: S({ color: 0xbab6ae, roughness: 0.85 }), redsand: S({ color: 0xa8523a, roughness: 0.85 }),
    clock: S({ map: clockTex(), emissiveMap: null, emissive: 0xfff4d8, emissiveIntensity: 0.05, roughness: 0.4 }), flag: S({ map: unionFlag(), side: THREE.DoubleSide, roughness: 0.8 }),
    lens: S({ color: 0xfff4d0, emissive: 0xffe4a0, emissiveIntensity: 0.3 }),
  });
  mats.clock.emissiveMap = mats.clock.map;
  return mats;
}
// the real time in London on Big Ben's four faces
let clockCanvas = null, clockT = null;
function clockTex() {
  clockCanvas = document.createElement('canvas'); clockCanvas.width = clockCanvas.height = 256; clockT = new THREE.CanvasTexture(clockCanvas); clockT.colorSpace = THREE.SRGBColorSpace; drawClock(); return clockT;
}
function drawClock(tz = 'Europe/London') {
  const x = clockCanvas.getContext('2d'), c = 128, ms = G.sky ? G.sky.now() : Date.now();
  let h = 0, m = 0; try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(new Date(ms)); h = +p.find(q => q.type === 'hour').value; m = +p.find(q => q.type === 'minute').value; } catch (e) { const d = new Date(ms); h = d.getUTCHours(); m = d.getUTCMinutes(); }
  x.fillStyle = '#c9a43a'; x.fillRect(0, 0, 256, 256); x.fillStyle = '#16181a'; x.beginPath(); x.arc(c, c, 124, 0, 7); x.fill();
  x.fillStyle = '#f4ecd2'; x.beginPath(); x.arc(c, c, 112, 0, 7); x.fill();
  x.strokeStyle = '#1a1a1a'; x.lineWidth = 2; x.beginPath(); x.arc(c, c, 80, 0, 7); x.stroke();
  for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; x.lineWidth = i % 5 ? 2 : 6; x.beginPath(); x.moveTo(c + Math.sin(a) * 104, c - Math.cos(a) * 104); x.lineTo(c + Math.sin(a) * (i % 5 ? 98 : 86), c - Math.cos(a) * (i % 5 ? 98 : 86)); x.stroke(); }
  x.fillStyle = '#1a1a1a'; x.font = 'bold 15px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((t, i) => { const a = i / 12 * Math.PI * 2; x.save(); x.translate(c + Math.sin(a) * 70, c - Math.cos(a) * 70); x.rotate(a); x.fillText(t, 0, 0); x.restore(); });
  const hand = (a, L, w) => { x.lineWidth = w; x.lineCap = 'round'; x.beginPath(); x.moveTo(c - Math.sin(a) * 12, c + Math.cos(a) * 12); x.lineTo(c + Math.sin(a) * L, c - Math.cos(a) * L); x.stroke(); };
  x.strokeStyle = '#111'; hand(((h % 12) + m / 60) / 12 * Math.PI * 2, 58, 7); hand(m / 60 * Math.PI * 2, 96, 4);
  x.fillStyle = '#111'; x.beginPath(); x.arc(c, c, 7, 0, 7); x.fill();
  if (clockT) clockT.needsUpdate = true;
}
function unionFlag() {
  return canvas(120, 60, (x) => {
    x.fillStyle = '#012169'; x.fillRect(0, 0, 120, 60); x.strokeStyle = '#fff'; x.lineWidth = 12; x.beginPath(); x.moveTo(0, 0); x.lineTo(120, 60); x.moveTo(120, 0); x.lineTo(0, 60); x.stroke();
    x.strokeStyle = '#C8102E'; x.lineWidth = 4; x.beginPath(); x.moveTo(0, 0); x.lineTo(120, 60); x.moveTo(120, 0); x.lineTo(0, 60); x.stroke();
    x.fillStyle = '#fff'; x.fillRect(50, 0, 20, 60); x.fillRect(0, 20, 120, 20); x.fillStyle = '#C8102E'; x.fillRect(54, 0, 12, 60); x.fillRect(0, 24, 120, 12);
  });
}

// ---------- building blocks ----------
class B {
  constructor() { this.g = new THREE.Group(); this.solids = []; }
  mesh(geo, mat, x = 0, y = 0, z = 0, ry = 0, solid = false) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = true; m.receiveShadow = true; this.g.add(m); return m; }
  box(w, h, d, mat, x, y, z, solid = true, ry = 0) { this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y + h / 2, z, ry); if (solid) this.solids.push([x, z, w, d, y, y + h, ry]); return this; }
  cyl(r0, r1, h, mat, x, y, z, seg = 16, solid = true) { this.mesh(new THREE.CylinderGeometry(r1, r0, h, seg), mat, x, y + h / 2, z); if (solid) this.solids.push([x, z, Math.max(r0, r1) * 1.6, Math.max(r0, r1) * 1.6, y, y + h, 0]); return this; }
  cone(r, h, mat, x, y, z, seg = 4, rot = Math.PI / 4) { const g = new THREE.ConeGeometry(r, h, seg); g.rotateY(rot); this.mesh(g, mat, x, y + h / 2, z); return this; }
  sphere(r, mat, x, y, z, sy = 1, half = false) { const g = new THREE.SphereGeometry(r, 24, 16, 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI); g.scale(1, sy, 1); this.mesh(g, mat, x, y, z); return this; }
  lathe(pts, mat, x, y, z, seg = 24) { this.mesh(new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg), mat, x, y, z); return this; }
  pinnacles(w, y, h, mat, n = 4) { for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + Math.PI / 4; this.cone(w * 0.08, h, mat, Math.cos(a) * w * 0.68, y, Math.sin(a) * w * 0.68, 6, 0); } return this; }
}
function clockTower(o) {
  const b = new B(), m = MAT(), W = o.w, st = o.stone || m.stone;
  b.box(W, o.shaft, W, st, 0, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(1.4, o.shaft + 2, 1.4, st, sx * W / 2, 0, sz * W / 2, false);
  const cw = W + 1.2, cy = o.shaft; b.box(cw, o.clockH, cw, st, 0, cy, 0);
  if (o.clock) for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, f = new THREE.Mesh(new THREE.CircleGeometry(o.clockR, 40), m.clock); f.position.set(Math.sin(a) * (cw / 2 + 0.05), cy + o.clockH / 2, Math.cos(a) * (cw / 2 + 0.05)); f.rotation.y = a; b.g.add(f);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(o.clockR + 0.25, 0.25, 8, 40), m.gold); rim.position.copy(f.position); rim.rotation.y = a; b.g.add(rim); }
  const by = cy + o.clockH; b.box(W - 0.6, o.belfry, W - 0.6, m.stonePlain, 0, by, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; for (const k of [-1, 0, 1]) b.box(1.0, o.belfry * 0.7, 0.2, m.dark, Math.sin(a) * (W / 2 - 0.25) + Math.cos(a) * k * 2.4, by + 1, Math.cos(a) * (W / 2 - 0.25) - Math.sin(a) * k * 2.4, false, a); }
  b.pinnacles(W, by + o.belfry, 7, m.gold);
  const sy = by + o.belfry; b.cone(W * 0.62, o.spire, o.spireMat || m.slate, 0, sy, 0, o.oct ? 8 : 4, o.oct ? 0 : Math.PI / 4);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.cone(0.5, 4, m.gold, Math.cos(a) * W * 0.38, sy + o.spire * 0.25, Math.sin(a) * W * 0.38, 4); }
  b.cyl(0.15, 0.15, 4, m.gold, 0, sy + o.spire, 0, 6, false); b.sphere(0.4, m.gold, 0, sy + o.spire + 3.2, 0);
  b.solids.push([0, 0, W * 0.9, W * 0.9, sy, sy + o.spire * 0.6, 0]);
  if (o.clock) b.g.userData.clock = true;
  return b;
}
function dome(b, r, y, mat, drumH, cols, lantern) {
  const m = MAT();
  b.cyl(r * 1.08, r * 1.08, drumH, m.portland, 0, y, 0, 32);
  for (let i = 0; i < cols; i++) { const a = i / cols * Math.PI * 2; b.cyl(0.6, 0.6, drumH * 0.8, m.portland, Math.cos(a) * r * 1.2, y, Math.sin(a) * r * 1.2, 8, false); }
  b.box(0.1, 0.1, 0.1, m.portland, 0, y + drumH, 0, false);
  b.cyl(r * 1.25, r * 1.25, 1.2, m.portland, 0, y + drumH * 0.8, 0, 32, false);
  b.sphere(r, mat, 0, y + drumH, 0, 1.05, true);
  if (lantern) { b.cyl(r * 0.18, r * 0.16, r * 0.6, m.portland, 0, y + drumH + r * 1.0, 0, 12, false); b.cone(r * 0.16, r * 0.5, mat, 0, y + drumH + r * 1.6, 0, 12, 0); b.sphere(r * 0.06, m.gold, 0, y + drumH + r * 2.15, 0); }
  b.solids.push([0, 0, r * 2, r * 2, y, y + drumH + r, 0]);
}
function onion(b, r, y, mat, tip = 0.5) {
  b.lathe([[0.01, 0], [r * 0.9, 0], [r * 1.12, r * 0.45], [r * 1.05, r * 0.9], [r * 0.7, r * 1.35], [r * 0.25, r * 1.75], [r * 0.06, r * 2.0], [0.01, r * (2.0 + tip)]], mat, 0, y, 0);
}

// ---------- the catalogue ----------
export const LANDMARKS = [
  { name: 'Big Ben (Elizabeth Tower)', lat: 51.50073, lon: -0.12463, hide: 11, build: () => clockTower({ w: 12, shaft: 54, clockH: 15, clockR: 3.5, clock: true, belfry: 10, spire: 15 }) },
  { name: 'London Eye', lat: 51.50330, lon: -0.11960, hide: 70, rot: 0, build: londonEye },
  { name: 'Tower Bridge', lat: 51.50546, lon: -0.07537, hide: 45, road: 'Tower Bridge', build: towerBridge },
  { name: 'The Shard', lat: 51.50449, lon: -0.08650, hide: 34, build: () => { const b = new B(), m = MAT(); const g = new THREE.CylinderGeometry(2, 34, 306, 8, 12); g.rotateY(Math.PI / 8); b.mesh(g, m.glass, 0, 153, 0); for (let i = 0; i < 4; i++) { const p = new THREE.ConeGeometry(2.4, 16, 3); b.mesh(p, m.glass, Math.cos(i * 1.6) * 1.8, 312, Math.sin(i * 1.6) * 1.8); } for (let k = 0; k < 6; k++) { const r = 32 - k * 5.4; b.solids.push([0, 0, r * 1.5, r * 1.5, k * 50, (k + 1) * 50, Math.PI / 8]); } return b; } },
  { name: "St Paul's Cathedral", lat: 51.51384, lon: -0.09825, hide: 19, build: () => { const b = new B(), m = MAT(); b.box(36, 30, 36, m.portland, 0, 0, 0); dome(b, 15.5, 30, m.lead, 20, 32, true); return b; } },
  { name: 'The Gherkin', lat: 51.51445, lon: -0.08033, hide: 30, build: () => { const b = new B(), m = MAT(), pts = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * 180, r = 24 + 4.5 * Math.sin(Math.min(1, y / 60) * Math.PI / 2) - Math.max(0, (y - 60) / 120) ** 1.6 * 28; pts.push([Math.max(0.5, r), y]); } pts.push([0.01, 180]); b.lathe(pts, new THREE.MeshPhysicalMaterial({ color: 0x5a7a8a, roughness: 0.08, metalness: 0.7, clearcoat: 1, map: spiralTex() }), 0, 0, 0, 32); for (let k = 0; k < 6; k++) { const r = pts[k * 4][0]; b.solids.push([0, 0, r * 1.7, r * 1.7, k * 30, (k + 1) * 30, 0]); } return b; } },
  { name: "Nelson's Column", lat: 51.50775, lon: -0.12795, hide: 6, build: () => { const b = new B(), m = MAT(); b.box(10, 10, 10, m.portland, 0, 0, 0); b.cyl(1.9, 1.6, 36, m.portland, 0, 10, 0, 20); b.box(4.2, 2.5, 4.2, m.copper, 0, 46, 0, false); b.cyl(0.9, 0.7, 5.5, m.copper, 0, 48.5, 0, 10, false); b.sphere(0.6, m.copper, 0, 54.5, 0); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.box(2, 2, 5, m.iron, Math.cos(a) * 9, 0, Math.sin(a) * 9, true, -a); } return b; } },
  { name: 'Victoria Memorial', lat: 51.50190, lon: -0.14068, hide: 0, build: () => { const b = new B(), m = MAT(); b.cyl(13, 12, 2.5, m.marble, 0, 0, 0, 8); b.cyl(7, 6.5, 6, m.marble, 0, 2.5, 0, 8); b.cyl(3, 2.6, 10, m.marble, 0, 8.5, 0, 8); b.cyl(1.2, 0.8, 3, m.gold, 0, 18.5, 0, 10, false); b.sphere(0.9, m.gold, 0, 22, 0); for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.4), m.gold); w.position.set(s * 1.2, 21.5, -0.2); w.rotation.set(0, s * 0.4, s * 0.5); b.g.add(w); } return b; } },
  { name: 'Buckingham Palace', lat: 51.50140, lon: -0.14220, hide: 0, flag: true, build: () => { const b = new B(), m = MAT(); b.cyl(0.12, 0.08, 10, m.white, 0, 24, 0, 6, false); const f = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5, 8, 1), m.flag); f.position.set(2.55, 32.6, 0); b.g.add(f); b.g.userData.flag = f; return b; } },
  // Mumbai
  { name: 'Gateway of India', lat: 18.92197, lon: 72.83465, hide: 18, rot: 0, build: gatewayOfIndia },
  { name: 'Taj Mahal Palace', lat: 18.92172, lon: 72.83300, hide: 0, build: () => { const b = new B(), m = MAT(); b.cyl(9, 9, 4, m.basalt, 0, 33, 0, 16, false); onion(b, 8, 37, m.redtile, 0.2); b.sphere(0.6, m.gold, 0, 55, 0); for (const s of [-1, 1]) { b.cyl(3, 3, 3, m.basalt, s * 22, 30, 0, 12, false); onion(b, 2.8, 33, m.redtile, 0.3); b.g.children[b.g.children.length - 1].position.x = s * 22; } return b; } },
  { name: 'Chhatrapati Shivaji Maharaj Terminus', lat: 18.94010, lon: 72.83540, hide: 0, build: () => { const b = new B(), m = MAT(); b.cyl(10, 10, 10, m.basalt, 0, 28, 0, 8, false); b.lathe([[0.01, 0], [9.5, 0], [9.6, 4], [8, 10], [5, 14], [1.5, 16.5], [0.01, 17]], m.copper, 0, 38, 0, 8); b.cyl(0.5, 0.3, 6, m.basalt, 0, 55, 0, 8, false); b.sphere(0.8, m.basalt, 0, 61.5, 0); b.pinnacles(20, 38, 8, m.basalt, 8); return b; } },
  { name: 'Rajabai Clock Tower', lat: 18.92925, lon: 72.83085, hide: 9, build: () => clockTower({ w: 9, shaft: 46, clockH: 10, clockR: 2.6, clock: true, belfry: 12, spire: 14, oct: true, stone: MAT().basalt, spireMat: MAT().basalt }) },
  { name: 'Haji Ali Dargah', lat: 18.98276, lon: 72.80899, hide: 0, build: () => { const b = new B(), m = MAT(); b.box(24, 1.5, 20, m.white, 0, -0.5, 0); b.box(14, 11, 14, m.white, 0, 1, 0); onion(b, 6, 12, m.white, 0.4); b.cyl(1.4, 1.1, 26, m.white, 9, 1, 6, 12); b.sphere(1.4, m.white, 9, 27.5, 6); return b; } },
  // around the world
  { name: 'Eiffel Tower', lat: 48.85826, lon: 2.29450, hide: 70, build: eiffel },
  { name: 'Statue of Liberty', lat: 40.68925, lon: -74.04450, hide: 0, build: liberty },
  { name: 'Sydney Opera House', lat: -33.85678, lon: 151.21530, hide: 60, rot: -0.35, build: operaHouse },
  { name: 'Burj Khalifa', lat: 25.19720, lon: 55.27440, hide: 40, build: () => { const b = new B(), m = MAT(); let y = 0; for (let i = 0; i < 27; i++) { const r = 30 * (1 - i / 29) ** 1.15 + 3, h = 24; const g = new THREE.CylinderGeometry(r * 0.97, r, h, 3, 1); g.rotateY(i * 0.35); b.mesh(g, m.glass, 0, y + h / 2, 0); if (i % 4 === 0) b.solids.push([0, 0, r * 1.5, r * 1.5, y, y + h * 4, 0]); y += h; } b.cyl(2.5, 0.5, 180, m.glass, 0, y, 0, 8, false); return b; } },
  { name: 'Taj Mahal', lat: 27.17501, lon: 78.04215, hide: 0, build: tajMahal },
  { name: 'Great Pyramid of Giza', lat: 29.97917, lon: 31.13417, hide: 0, build: () => pyramid(230, 139) },
  { name: 'Pyramid of Khafre', lat: 29.97611, lon: 31.13083, hide: 0, build: () => pyramid(215, 136) },
  { name: 'Pyramid of Menkaure', lat: 29.97250, lon: 31.12833, hide: 0, build: () => pyramid(103, 65) },
  { name: 'Colosseum', lat: 41.89021, lon: 12.49223, hide: 90, build: colosseum },
  { name: 'Tokyo Tower', lat: 35.65858, lon: 139.74543, hide: 40, build: () => latticeTower(80, 333, [[125, 0.35], [223, 0.18]], 0xd8452a) },
  { name: 'CN Tower', lat: 43.64257, lon: -79.38706, hide: 30, build: () => { const b = new B(), m = MAT(); b.lathe([[14, 0], [8, 60], [5.5, 330], [0.01, 330]], m.concrete, 0, 0, 0, 3); b.lathe([[0.01, 330], [18, 336], [21, 346], [16, 356], [0.01, 358]], m.concrete, 0, 0, 0, 24); b.cyl(2, 0.4, 195, m.white, 0, 358, 0, 8, false); b.solids.push([0, 0, 20, 20, 0, 330, 0], [0, 0, 36, 36, 330, 358, 0]); return b; } },
  { name: 'Space Needle', lat: 47.62051, lon: -122.34931, hide: 25, build: () => { const b = new B(), m = MAT(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; b.lathe([[1.2, 0], [0.9, 80], [1.0, 150]], m.white, Math.cos(a) * 10, 0, Math.sin(a) * 10, 8); } b.cyl(3, 3, 150, m.white, 0, 0, 0, 12); b.lathe([[0.01, 150], [18, 152], [22, 158], [6, 162], [0.01, 163]], m.white, 0, 0, 0, 32); b.cyl(0.6, 0.2, 22, m.white, 0, 163, 0, 8, false); b.solids.push([0, 0, 40, 40, 150, 162, 0]); return b; } },
  { name: 'Golden Gate Bridge (south tower)', lat: 37.81077, lon: -122.47714, hide: 0, build: () => ggTower() },
  { name: 'Golden Gate Bridge (north tower)', lat: 37.82645, lon: -122.47924, hide: 0, build: () => ggTower() },
  { name: 'Petronas Towers', lat: 3.15785, lon: 101.71165, hide: 70, build: () => { const b = new B(), m = MAT(); for (const s of [-1, 1]) { let y = 0; for (let i = 0; i < 9; i++) { const r = 23 - i * 1.6, h = i < 7 ? 52 : 25; const g = new THREE.CylinderGeometry(r, r + 0.5, h, 16); b.mesh(g, m.glass, s * 29, y + h / 2, 0); b.solids.push([s * 29, 0, r * 1.6, r * 1.6, y, y + h, 0]); y += h; } b.cyl(1.2, 0.3, 70, m.glass, s * 29, y, 0, 8, false); } b.box(30, 6, 4, m.glass, 0, 170, 0); return b; } },
  { name: 'Leaning Tower of Pisa', lat: 43.72298, lon: 10.39659, hide: 12, build: () => { const b = new B(), m = MAT(); const t = new B(); t.cyl(7.8, 7.6, 56, m.arcade, 0, 0, 0, 24); t.cyl(5, 5, 5, m.marble, 0, 56, 0, 20); t.g.rotation.z = 0.069; b.g.add(t.g); b.solids.push([0, 0, 15, 15, 0, 58, 0]); return b; } },
  { name: 'Brandenburg Gate', lat: 52.51628, lon: 13.37770, hide: 30, build: () => { const b = new B(), m = MAT(); for (let i = 0; i < 6; i++) b.cyl(0.9, 0.85, 15, m.stonePlain, -26 + i * 10.4, 0, 0, 16); b.box(65, 5, 11, m.stonePlain, 0, 15, 0); b.box(14, 4, 6, m.stonePlain, 0, 20, 0); b.box(5, 4, 3, m.copper, 0, 24, 0, false); return b; } },
  { name: 'Christ the Redeemer', lat: -22.95194, lon: -43.21048, hide: 0, build: () => { const b = new B(), m = MAT(); b.box(8, 8, 8, m.stonePlain, 0, 0, 0); b.cyl(3, 2.2, 22, m.white, 0, 8, 0, 16); b.box(28, 3.2, 2.4, m.white, 0, 25, 0); b.sphere(1.8, m.white, 0, 31.5, 0); return b; } },
  { name: "St Basil's Cathedral", lat: 55.75253, lon: 37.62308, hide: 30, build: () => { const b = new B(), m = MAT(); b.box(30, 18, 30, m.redsand, 0, 0, 0); b.cyl(5, 5, 18, m.redsand, 0, 18, 0, 8); b.cone(5, 14, m.copper, 0, 36, 0, 8, 0); const c = [0xd02a2a, 0x2a8a3a, 0xe0b020, 0x2a5ac0, 0xd06a20, 0x1a8a8a, 0xc02a8a, 0x8a2ad0]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 9 : 12; b.cyl(3, 3, 14, m.redsand, Math.cos(a) * r, 18, Math.sin(a) * r, 8); const o = new B(); onion(o, 3, 0, new THREE.MeshStandardMaterial({ color: c[i], roughness: 0.4 }), 0.5); o.g.position.set(Math.cos(a) * r, 32, Math.sin(a) * r); b.g.add(o.g); } return b; } },
];

function spiralTex() { return canvas(256, 256, (x, w, h) => { x.fillStyle = '#5a7a8a'; x.fillRect(0, 0, w, h); x.strokeStyle = 'rgba(20,30,40,0.9)'; x.lineWidth = 10; for (let i = -4; i < 8; i++) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64 + 128, h); x.stroke(); } x.strokeStyle = 'rgba(255,255,255,0.15)'; x.lineWidth = 1; for (let i = 0; i < w; i += 12) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, h); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(w, i); x.stroke(); } }); }
function londonEye() {
  const b = new B(), m = MAT(), R = 60, hubY = 75, wheel = new THREE.Group(); wheel.position.set(0, hubY, 0);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.9, 8, 96), m.white); rim.rotation.y = Math.PI / 2; wheel.add(rim);
  const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R - 3, 0.5, 6, 96), m.white); rim2.rotation.y = Math.PI / 2; wheel.add(rim2);
  const sp = []; for (let i = 0; i < 64; i++) { const a = i / 64 * Math.PI * 2, g = new THREE.CylinderGeometry(0.06, 0.06, R, 3); g.translate(0, R / 2, 0); g.rotateX(a); g.translate(i % 2 ? 2 : -2, 0, 0); sp.push(g); }
  const spokes = new THREE.Mesh(mergeGeometries(sp), m.white); wheel.add(spokes);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 8, 16), m.white); hub.rotation.z = Math.PI / 2; wheel.add(hub);
  const pods = []; const podGeo = new THREE.SphereGeometry(1, 16, 10); podGeo.scale(2.2, 1.6, 4);
  for (let i = 0; i < 32; i++) { const a = i / 32 * Math.PI * 2, p = new THREE.Mesh(podGeo, m.glass); p.position.set(0, Math.cos(a) * (R + 3.5), Math.sin(a) * (R + 3.5)); wheel.add(p); pods.push(p); }
  b.g.add(wheel); b.g.userData.wheel = wheel; b.g.userData.pods = pods;
  for (const s of [-1, 1]) { const L = Math.hypot(hubY, 40), g = new THREE.CylinderGeometry(1.2, 1.6, L, 10); const leg = b.mesh(g, m.white, 20, hubY / 2, s * 10); leg.rotation.set(s * 0.13, 0, Math.atan2(40, hubY)); }
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; b.solids.push([0, Math.sin(a) * R, 4, 6, hubY + Math.cos(a) * R - 2.5, hubY + Math.cos(a) * R + 2.5, 0]); }
  b.solids.push([0, 0, 8, 8, hubY - 3, hubY + 3, 0]);
  return b;
}
function towerBridge() {
  const b = new B(), m = MAT(), span = 61, W = 18, D = 13, H = 65;
  for (const s of [-1, 1]) {
    const z = s * (span / 2 + D / 2);
    b.box(W + 4, 6, D + 6, m.stonePlain, 0, -4, z);
    b.box(W, H - 8, D, m.stone, 0, 2, z);
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) { b.cyl(1.8, 1.8, H - 4, m.stone, cx * (W / 2 - 1), 2, z + cz * (D / 2 - 1), 8, false); b.cone(2.2, 9, m.slate, cx * (W / 2 - 1), H - 2, z + cz * (D / 2 - 1), 8, 0); b.sphere(0.5, m.gold, cx * (W / 2 - 1), H + 7.4, z + cz * (D / 2 - 1)); }
    b.cone(W * 0.62, 12, m.slate, 0, H - 6, z); b.sphere(0.7, m.gold, 0, H + 6.3, z);
    b.box(W - 4, 12, 0.3, m.dark, 0, 10, z - s * (D / 2 + 0.05), false);
    // suspension chains to the banks
    const cg = new THREE.BoxGeometry(1.2, 1.6, 80); const ch = b.mesh(cg, m.blue, W / 2 - 1, 22, s * (span / 2 + D + 38)); ch.rotation.x = s * 0.42; const ch2 = b.mesh(cg, m.blue, -W / 2 + 1, 22, s * (span / 2 + D + 38)); ch2.rotation.x = s * 0.42;
  }
  for (const x of [-W / 2 + 2, W / 2 - 2]) { b.box(3, 4, span + 2, m.blue, x, 42, 0); b.box(3.2, 0.3, span + 2, m.white, x, 46, 0, false); }
  return b;
}
function gatewayOfIndia() {
  const b = new B(), m = MAT(), Wd = 26, D = 15, H = 26;
  // two piers either side of the great arch, a lintel and parapet, four corner turrets
  for (const s of [-1, 1]) b.box(D, H - 6, 8, m.basalt, 0, 0, s * (Wd / 2 - 4));
  b.box(D, 7, Wd, m.basalt, 0, H - 9, 0);
  const arch = new THREE.Mesh(new THREE.TorusGeometry(5, 1.0, 8, 24, Math.PI), m.basalt); arch.position.set(0, H - 11, 0); arch.rotation.y = Math.PI / 2; b.g.add(arch);
  for (const s of [-1, 1]) { const a2 = new THREE.Mesh(new THREE.TorusGeometry(5, 0.4, 6, 24, Math.PI), m.stonePlain); a2.position.set(s * (D / 2 + 0.2), H - 11, 0); a2.rotation.y = Math.PI / 2; b.g.add(a2); }
  for (const cx of [-1, 1]) for (const cz of [-1, 1]) { b.cyl(2.3, 2.3, H + 1, m.basalt, cx * (D / 2), 0, cz * (Wd / 2), 8); b.sphere(2.3, m.basalt, cx * (D / 2), H + 1, cz * (Wd / 2), 1.2, true); b.cone(0.3, 3, m.basalt, cx * (D / 2), H + 3.5, cz * (Wd / 2), 8, 0); }
  for (let i = -5; i <= 5; i++) b.box(0.8, 1.6, 0.8, m.basalt, D / 2 - 0.4, H - 2, i * 2.3, false), b.box(0.8, 1.6, 0.8, m.basalt, -D / 2 + 0.4, H - 2, i * 2.3, false);
  for (const s of [-1, 1]) b.box(10, 9, 10, m.basalt, 0, 0, s * (Wd / 2 + 7));
  b.box(D + 10, 0.5, Wd + 30, m.stonePlain, 0, -0.4, 0, false);
  return b;
}
function eiffel() {
  const b = new B(), m = MAT();
  // four legs to the first floor, then a single tapering shaft; open lattice everywhere
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4, x = Math.cos(a) * 44, z = Math.sin(a) * 44, leg = new THREE.Mesh(new THREE.CylinderGeometry(7, 13, 62, 4, 4, true), m.lattice); leg.position.set(x * 0.72, 30, z * 0.72); leg.rotation.y = a + Math.PI / 4; leg.rotation.z = Math.cos(a) * -0.33; leg.rotation.x = Math.sin(a) * 0.33; leg.castShadow = true; b.g.add(leg); b.solids.push([x, z, 14, 14, 0, 30, 0]); }
  b.box(70, 6, 70, m.lattice, 0, 57, 0, true);
  const pts = []; for (let i = 0; i <= 20; i++) { const y = 63 + i / 20 * 213; pts.push(new THREE.Vector2(Math.max(4, 26 * Math.exp(-(y - 63) / 85)), y)); }
  const sh = new THREE.Mesh(new THREE.LatheGeometry(pts, 4), m.lattice); sh.rotation.y = Math.PI / 4; sh.castShadow = true; b.g.add(sh);
  b.box(36, 3, 36, m.lattice, 0, 115, 0, true); b.box(18, 4, 18, m.iron, 0, 276, 0, true);
  b.cyl(2.5, 1.5, 20, m.iron, 0, 280, 0, 8, false); b.cyl(0.5, 0.3, 30, m.iron, 0, 300, 0, 6, false);
  for (let k = 0; k < 5; k++) b.solids.push([0, 0, 40 - k * 7, 40 - k * 7, 63 + k * 42, 105 + k * 42, Math.PI / 4]);
  return b;
}
function liberty() {
  const b = new B(), m = MAT();
  b.box(60, 8, 60, m.stonePlain, 0, 0, 0); b.box(20, 27, 20, m.stonePlain, 0, 8, 0); b.box(14, 12, 14, m.stonePlain, 0, 35, 0);
  b.lathe([[5, 0], [4.2, 14], [3.0, 26], [1.8, 30], [0.01, 31]], m.copper, 0, 47, 0, 16);
  b.sphere(2.2, m.copper, 0, 80.5, 0, 1.15);
  for (let i = 0; i < 7; i++) { const a = (i / 6 - 0.5) * 2.2; b.cone(0.3, 3.4, m.copper, Math.sin(a) * 2.3, 81.8, Math.cos(a) * 2.3 - 0.3, 6, 0); }
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 13, 8), m.copper); arm.position.set(3.5, 84, 0); arm.rotation.z = -0.25; b.g.add(arm);
  b.cyl(0.9, 1.3, 2.5, m.copper, 5.1, 90, 0, 8, false); b.cone(1.0, 3.2, m.gold, 5.1, 92.4, 0, 8, 0);
  b.box(2.6, 3.4, 0.9, m.copper, -2.5, 66, 2, false);
  b.solids.push([0, 0, 10, 10, 47, 80, 0]);
  return b;
}
function operaHouse() {
  const b = new B(), m = MAT();
  b.box(120, 7, 100, m.redsand, 0, 0, 0);
  const shell = (x, z, s, ry, tilt) => { const g = new THREE.SphereGeometry(75 * s, 20, 12, 0, 0.5, 0, 0.75); g.translate(0, -75 * s * 0.55, 0); const mesh = b.mesh(g, m.shell, x, 7, z, ry); mesh.rotation.x = tilt; mesh.material.side = THREE.DoubleSide; };
  for (const [z, ss] of [[-15, 1], [15, 0.8]]) for (let i = 0; i < 4; i++) shell(-35 + i * 20, z, ss * (1 - i * 0.12), Math.PI / 2 - 0.25, -0.05);
  b.solids.push([0, 0, 110, 70, 7, 50, 0]);
  return b;
}
function tajMahal() {
  const b = new B(), m = MAT();
  b.box(95, 7, 95, m.marble, 0, 0, 0);
  b.box(57, 30, 57, m.marble, 0, 7, 0);
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; b.box(1, 1, 1, m.marble, 0, 0, 0, false); const o = new B(); o.cyl(4.5, 4.5, 5, m.marble, 0, 0, 0, 16, false); onion(o, 4, 5, m.marble, 0.6); o.g.position.set(Math.cos(a) * 20, 37, Math.sin(a) * 20); b.g.add(o.g); }
  b.cyl(14, 14, 8, m.marble, 0, 37, 0, 24); onion(b, 14, 45, m.marble, 0.15); b.cyl(0.4, 0.2, 8, m.gold, 0, 76, 0, 6, false);
  for (const [cx, cz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { b.lathe([[3.2, 0], [2.6, 40], [0.01, 40]], m.marble, cx * 44, 7, cz * 44, 16); b.cyl(3, 3, 2, m.marble, cx * 44, 47, cz * 44, 12, false); onion(b, 2.4, 49, m.marble, 0.5); b.g.children[b.g.children.length - 1].position.set(cx * 44, 49, cz * 44); b.solids.push([cx * 44, cz * 44, 6, 6, 7, 47, 0]); }
  b.solids.push([0, 0, 28, 28, 37, 70, 0]);
  return b;
}
function pyramid(base, h) { const b = new B(), m = MAT(); b.cone(base / Math.SQRT2, h, m.sand, 0, 0, 0, 4, Math.PI / 4); for (let k = 0; k < 6; k++) { const w = base * (1 - k / 6); b.solids.push([0, 0, w, w, k * h / 6, (k + 1) * h / 6, 0]); } return b; }
function colosseum() {
  const b = new B(), m = MAT(), ring = (rx, rz, h, mat, inner) => { const g = new THREE.CylinderGeometry(1, 1, h, 64, 1, true); g.scale(rx, 1, rz); const mm = b.mesh(g, mat, 0, h / 2, 0); if (inner) mm.material = mat.clone(), mm.material.side = THREE.BackSide; };
  const a = m.arcade.clone(); a.map = m.arcade.map.clone(); a.map.repeat.set(80, 4); a.map.needsUpdate = true; ring(94, 78, 48, a); ring(86, 70, 40, a, true);
  for (let i = 0; i < 40; i++) { const t = i / 40 * Math.PI * 2; b.solids.push([Math.cos(t) * 90, Math.sin(t) * 74, 16, 16, 0, 48, 0]); }
  return b;
}
function latticeTower(base, h, decks, col) {
  const b = new B(), m = MAT(), mat = m.lattice.clone(); mat.color = new THREE.Color(col); const pts = []; for (let i = 0; i <= 24; i++) { const y = i / 24 * h; pts.push(new THREE.Vector2(Math.max(2, base / 2 * Math.exp(-y / (h * 0.32))), y)); }
  const sh = new THREE.Mesh(new THREE.LatheGeometry(pts, 4), mat); sh.rotation.y = Math.PI / 4; sh.castShadow = true; b.g.add(sh);
  for (const [y, w] of decks) b.box(base * w * 1.4, 8, base * w * 1.4, m.white, 0, y, 0, true);
  for (let k = 0; k < 5; k++) b.solids.push([0, 0, base * Math.exp(-k * 0.6) * 0.8, base * Math.exp(-k * 0.6) * 0.8, k * h / 5, (k + 1) * h / 5, Math.PI / 4]);
  return b;
}
function ggTower() { const b = new B(), m = MAT(); for (const s of [-1, 1]) b.box(10, 227, 11, m.redsteel, s * 14, 0, 0); for (const y of [70, 120, 165, 205]) b.box(38, 8, 9, m.redsteel, 0, y, 0); b.box(30, 4, 24, m.redsteel, 0, 66, 0); return b; }

// ---------- placement ----------
let cacheKey = null, inst = [];
function instances() {
  const k = Geo.ox + ',' + Geo.oz + ',' + Geo.band; if (k === cacheKey) return inst;
  cacheKey = k; inst = [];
  for (const d of LANDMARKS) {
    let x = d.lon * M * Geo.cosB - Geo.ox * CH, z = -d.lat * M - Geo.oz * CH;
    if (Math.abs(x) > 60000 || Math.abs(z) > 60000) continue;
    inst.push({ d, x, z, cx: Math.floor(x / CH), cz: Math.floor(z / CH), rot: d.rot || 0 });
  }
  return inst;
}
function solidsFor(I, y0) {
  const b = I.built || (I.built = I.d.build()), cs = Math.cos(I.rot), sn = Math.sin(I.rot), out = [];
  for (const [lx, lz, w, d, y1, y2, ry] of b.solids) {
    const cx = I.x + lx * cs + lz * sn, cz = I.z - lx * sn + lz * cs, r = ry + I.rot, c2 = Math.cos(r), s2 = Math.sin(r), ring = new Float32Array(8);
    [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].forEach(([a, bb], i) => { ring[i * 2] = cx + a * c2 + bb * s2; ring[i * 2 + 1] = cz - a * s2 + bb * c2; });
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (let i = 0; i < 8; i += 2) { x0 = Math.min(x0, ring[i]); x1 = Math.max(x1, ring[i]); z0 = Math.min(z0, ring[i + 1]); z1 = Math.max(z1, ring[i + 1]); }
    out.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, miny: y0 + y1, maxy: y0 + y2, rings: [ring], landmark: I.d.name });
  }
  return out;
}
export const Landmarks = {
  inChunk(cx, cz) {
    const out = [];
    for (const I of instances()) {
      if (I.cx !== cx || I.cz !== cz) continue;
      // align with the real road across it where there is one (Tower Bridge)
      if (I.d.road && City.active && !I.aligned) { const R = City.active.r; let best = null, bd = 1e9; for (let e = 0; e < R.E; e++) { if (!City.active.names[R.name[e]].startsWith(I.d.road)) continue; const j = R.ps[e], dx = R.v[j * 2] - I.x, dz = R.v[j * 2 + 1] - I.z, dd = dx * dx + dz * dz; if (dd < bd && R.ps[e + 1] - j > 1) { bd = dd; best = [R.v[j * 2 + 2] - R.v[j * 2], R.v[j * 2 + 3] - R.v[j * 2 + 1]]; } } if (best && bd < 300 * 300) I.rot = Math.atan2(best[0], best[1]); I.aligned = true; }
      const y = City.inside(I.x, I.z) ? BASE : Math.max(0.2, Geo.height(I.x, I.z));
      out.push({ name: I.d.name, x: I.x, z: I.z, solids: solidsFor(I, y), build: () => { const b = I.built || (I.built = I.d.build()); b.g.position.set(I.x, y, I.z); b.g.rotation.y = I.rot; b.g.userData.inst = I; live.add(b.g); return b.g; } });
    }
    return out;
  },
  // real map buildings standing where a landmark model goes
  hiddenBuildings(c) {
    const set = new Set(), B = c.b;
    for (const I of instances()) {
      if (!I.d.hide || !City.inside(I.x, I.z, 200)) continue; const r2 = I.d.hide * I.d.hide;
      for (let i = 0; i < B.N; i++) { const x = (B.box[i * 4] + B.box[i * 4 + 2]) / 2 + c.ox, z = (B.box[i * 4 + 1] + B.box[i * 4 + 3]) / 2 + c.oz; if ((x - I.x) ** 2 + (z - I.z) ** 2 < r2) set.add(i); }
    }
    return set;
  },
  clearAt(ch, x, z, r) { for (const I of instances()) { if (Math.abs(I.cx - ch.cx) > 1 || Math.abs(I.cz - ch.cz) > 1) continue; const R = (I.d.hide || 20) + r; if ((x - I.x) ** 2 + (z - I.z) ** 2 < R * R) return true; } return false; },
  find(name) { for (const I of instances()) if (I.d.name.startsWith(name)) return { x: I.x, z: I.z, y: City.inside(I.x, I.z) ? BASE : Math.max(0.2, Geo.height(I.x, I.z)) }; return null; },
  nearest(x, z, max = 400) { let best = null, bd = max * max; for (const I of instances()) { const d = (I.x - x) ** 2 + (I.z - z) ** 2; if (d < bd) { bd = d; best = I.d.name; } } return best; },
  update(dt) {
    for (const g of live) {
      if (!g.parent) continue;
      const u = g.userData;
      if (u.wheel) { u.wheel.rotation.x += dt * 0.0045 * 60 / 60; for (const p of u.pods) p.rotation.x = -u.wheel.rotation.x; }
      if (u.flag) { const t = G.time; u.flag.rotation.y = Math.sin(t * 1.3) * 0.25; }
    }
    clockAcc += dt; if (clockAcc > 20 && clockT) { clockAcc = 0; drawClock(); }
    if (mats.clock) mats.clock.emissiveIntensity = 0.05 + (G.sky ? G.sky.night : 0) * 2.6;
  },
};
const live = new Set(); let clockAcc = 99;
