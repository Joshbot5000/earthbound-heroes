// Hand-built landmarks at their real coordinates. Inside real cities they replace the plain map
// footprint they stand on. Big Ben shows the real time in London.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { G } from './util.js';
import { Geo, CH } from './geo.js';
import { City, BASE } from './city.js';
import { moreLandmarks } from './landmarks2.js';

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
  // weathered limestone blocks with darker joints and streaks of grime running down
  const lime = canvas(256, 256, (x, w, h) => { x.fillStyle = '#e4dccb'; x.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let k = -1; k < 6; k++) { const v = 205 + Math.random() * 30 | 0; x.fillStyle = `rgb(${v},${v - 6},${v - 20})`; x.fillRect(k * 48 + (r % 2) * 24 + 1, r * 16 + 1, 46, 14); }
    for (let i = 0; i < 40; i++) { const gx = Math.random() * w; const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(60,55,45,0)'); g.addColorStop(1, 'rgba(60,55,45,0.18)'); x.fillStyle = g; x.fillRect(gx, Math.random() * h * 0.5, 2 + Math.random() * 6, h); } }); lime.repeat.set(6, 6);
  // the White House: painted sandstone, two rows of pedimented windows
  const whw = canvas(256, 128, (x, w, h) => { x.fillStyle = '#f4f2ec'; x.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) { const cx = i * 64 + 32; for (const [y, ph] of [[18, 1], [74, 0]]) { x.fillStyle = '#2a3036'; x.fillRect(cx - 9, y, 18, 32); x.fillStyle = '#c9cfd4'; x.fillRect(cx - 1, y, 2, 32); x.fillRect(cx - 9, y + 15, 18, 2); x.fillStyle = '#e2ded4'; if (ph) { x.beginPath(); x.moveTo(cx - 13, y - 2); x.lineTo(cx, y - 10); x.lineTo(cx + 13, y - 2); x.fill(); } else x.fillRect(cx - 12, y - 5, 24, 4); } } x.fillStyle = '#dcd8cc'; x.fillRect(0, 60, w, 3); }); whw.repeat.set(4, 1);
  // Empire State: limestone piers with recessed window strips and aluminium spandrels; lit windows at night
  const deco = (lit) => canvas(128, 256, (x, w, h) => { x.fillStyle = lit ? '#000' : '#cfc6b4'; x.fillRect(0, 0, w, h); for (let i = 0; i < 8; i++) for (let j = 0; j < 32; j++) { const on = Math.random() < 0.35; x.fillStyle = lit ? (on ? `rgb(255,${200 + Math.random() * 40 | 0},140)` : '#000') : (j % 2 ? '#3a4048' : '#8a9096'); x.fillRect(i * 16 + 5, j * 8 + 1, 7, 6); } });
  const decoT = deco(false), decoL = deco(true); decoT.repeat.set(4, 30); decoL.repeat.copy(decoT.repeat);
  // Doric column fluting
  const flute = canvas(128, 32, (x, w, h) => { for (let i = 0; i < 20; i++) { const g = x.createLinearGradient(i * w / 20, 0, (i + 1) * w / 20, 0); g.addColorStop(0, '#c8b896'); g.addColorStop(0.5, '#efe3c8'); g.addColorStop(1, '#bfae8a'); x.fillStyle = g; x.fillRect(i * w / 20, 0, w / 20, h); } });
  // grey Great Wall brick on a stone base
  const wallT = canvas(128, 128, (x, w, h) => { x.fillStyle = '#7e7a72'; x.fillRect(0, 0, w, h); for (let r = 0; r < 16; r++) for (let k = -1; k < 9; k++) { const v = 105 + Math.random() * 40 | 0; x.fillStyle = `rgb(${v},${v - 3},${v - 10})`; x.fillRect(k * 16 + (r % 2) * 8 + 1, r * 8 + 1, 14, 6); } }); wallT.repeat.set(1, 1);
  // Sagrada Família: rough sandstone with vertical ribs and pierced openings
  const sagT = canvas(128, 256, (x, w, h) => { x.fillStyle = '#c9a982'; x.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(70,50,30,0.35)'; x.fillRect(i * 22 + 4, 0, 4, h); } for (let j = 0; j < 14; j++) for (let i = 0; i < 3; i++) { x.fillStyle = 'rgba(25,18,12,0.85)'; x.beginPath(); x.ellipse(i * 44 + 22, j * 18 + 9, 5, 6, 0, 0, 7); x.fill(); } for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '255,240,210' : '60,40,25'},0.12)`; x.fillRect(Math.random() * w, Math.random() * h, 3, 3); } }); sagT.repeat.set(2, 6);
  const rose = canvas(128, 128, (x, w, h) => { x.fillStyle = '#d8ccb0'; x.fillRect(0, 0, w, h); x.translate(64, 64); x.fillStyle = '#1a1830'; x.beginPath(); x.arc(0, 0, 60, 0, 7); x.fill(); const cols = ['#2a3a9a', '#9a2a3a', '#2a7a5a', '#c8a030']; for (let k = 0; k < 3; k++) for (let i = 0; i < 12 * (k + 1); i++) { const a = i / (12 * (k + 1)) * 6.283; x.fillStyle = cols[(i + k) % 4]; x.beginPath(); x.arc(Math.cos(a) * (14 + k * 16), Math.sin(a) * (14 + k * 16), 5 + k, 0, 7); x.fill(); } x.strokeStyle = '#d8ccb0'; x.lineWidth = 2; for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * 60, Math.sin(a) * 60); x.stroke(); } });
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
    lime: S({ map: lime, roughness: 0.9 }), whiteHouse: S({ map: whw, roughness: 0.75 }), whitePaint: S({ color: 0xf4f2ec, roughness: 0.7 }),
    deco: S({ color: 0xc4bba8, map: decoT, emissiveMap: decoL, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75 }), decoTop: S({ color: 0xd8d2c4, roughness: 0.6, emissive: 0xffd890, emissiveIntensity: 0 }),
    pentelic: S({ color: 0xe8dcc2, roughness: 0.85, map: flute }), pentelicPlain: S({ color: 0xe2d4b6, roughness: 0.9 }), rock: S({ color: 0xb8a68a, roughness: 1, flatShading: true }),
    wallBrick: S({ map: wallT, roughness: 0.95 }), sagrada: S({ map: sagT, roughness: 0.95 }), sagTop: S({ color: 0xe8d8b0, roughness: 0.6 }),
    bridgeGrey: S({ color: 0x737d84, roughness: 0.55, metalness: 0.5 }), granite: S({ color: 0xb5a58a, roughness: 0.9, map: ashlar }), rose: S({ map: rose, roughness: 0.4, emissive: 0x403060, emissiveIntensity: 0 }),
    paintRed: S({ color: 0xb02a2a, roughness: 0.5 }), paintGreen: S({ color: 0x2f8a4a, roughness: 0.5 }), paintBlue: S({ color: 0x2a5aa8, roughness: 0.5 }), paintYellow: S({ color: 0xe0b030, roughness: 0.5 }),
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
  { name: 'CN Tower', lat: 43.64257, lon: -79.38706, hide: 30, pad: { r: 600, h: 78 }, build: () => { const b = new B(), m = MAT(); b.lathe([[14, 0], [8, 60], [5.5, 330], [0.01, 330]], m.concrete, 0, 0, 0, 3); b.lathe([[0.01, 330], [18, 336], [21, 346], [16, 356], [0.01, 358]], m.concrete, 0, 0, 0, 24); b.cyl(2, 0.4, 195, m.white, 0, 358, 0, 8, false); b.solids.push([0, 0, 20, 20, 0, 330, 0], [0, 0, 36, 36, 330, 358, 0]); return b; } },
  { name: 'Space Needle', lat: 47.62051, lon: -122.34931, hide: 25, build: () => { const b = new B(), m = MAT(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2; b.lathe([[1.2, 0], [0.9, 80], [1.0, 150]], m.white, Math.cos(a) * 10, 0, Math.sin(a) * 10, 8); } b.cyl(3, 3, 150, m.white, 0, 0, 0, 12); b.lathe([[0.01, 150], [18, 152], [22, 158], [6, 162], [0.01, 163]], m.white, 0, 0, 0, 32); b.cyl(0.6, 0.2, 22, m.white, 0, 163, 0, 8, false); b.solids.push([0, 0, 40, 40, 150, 162, 0]); return b; } },
  { name: 'Golden Gate Bridge (south tower)', lat: 37.81077, lon: -122.47714, hide: 0, build: () => ggTower() },
  { name: 'Golden Gate Bridge (north tower)', lat: 37.82645, lon: -122.47924, hide: 0, build: () => ggTower() },
  { name: 'Petronas Towers', lat: 3.15785, lon: 101.71165, hide: 70, build: () => { const b = new B(), m = MAT(); for (const s of [-1, 1]) { let y = 0; for (let i = 0; i < 9; i++) { const r = 23 - i * 1.6, h = i < 7 ? 52 : 25; const g = new THREE.CylinderGeometry(r, r + 0.5, h, 16); b.mesh(g, m.glass, s * 29, y + h / 2, 0); b.solids.push([s * 29, 0, r * 1.6, r * 1.6, y, y + h, 0]); y += h; } b.cyl(1.2, 0.3, 70, m.glass, s * 29, y, 0, 8, false); } b.box(30, 6, 4, m.glass, 0, 170, 0); return b; } },
  { name: 'Leaning Tower of Pisa', lat: 43.72298, lon: 10.39659, hide: 12, build: () => { const b = new B(), m = MAT(); const t = new B(); t.cyl(7.8, 7.6, 56, m.arcade, 0, 0, 0, 24); t.cyl(5, 5, 5, m.marble, 0, 56, 0, 20); t.g.rotation.z = 0.069; b.g.add(t.g); b.solids.push([0, 0, 15, 15, 0, 58, 0]); return b; } },
  { name: 'Brandenburg Gate', lat: 52.51628, lon: 13.37770, hide: 30, build: () => { const b = new B(), m = MAT(); for (let i = 0; i < 6; i++) b.cyl(0.9, 0.85, 15, m.stonePlain, -26 + i * 10.4, 0, 0, 16); b.box(65, 5, 11, m.stonePlain, 0, 15, 0); b.box(14, 4, 6, m.stonePlain, 0, 20, 0); b.box(5, 4, 3, m.copper, 0, 24, 0, false); return b; } },
  { name: 'Christ the Redeemer', lat: -22.95194, lon: -43.21048, hide: 0, build: () => { const b = new B(), m = MAT(); b.box(8, 8, 8, m.stonePlain, 0, 0, 0); b.cyl(3, 2.2, 22, m.white, 0, 8, 0, 16); b.box(28, 3.2, 2.4, m.white, 0, 25, 0); b.sphere(1.8, m.white, 0, 31.5, 0); return b; } },
  { name: "St Basil's Cathedral", lat: 55.75253, lon: 37.62308, hide: 30, build: () => { const b = new B(), m = MAT(); b.box(30, 18, 30, m.redsand, 0, 0, 0); b.cyl(5, 5, 18, m.redsand, 0, 18, 0, 8); b.cone(5, 14, m.copper, 0, 36, 0, 8, 0); const c = [0xd02a2a, 0x2a8a3a, 0xe0b020, 0x2a5ac0, 0xd06a20, 0x1a8a8a, 0xc02a8a, 0x8a2ad0]; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 9 : 12; b.cyl(3, 3, 14, m.redsand, Math.cos(a) * r, 18, Math.sin(a) * r, 8); const o = new B(); onion(o, 3, 0, new THREE.MeshStandardMaterial({ color: c[i], roughness: 0.4 }), 0.5); o.g.position.set(Math.cos(a) * r, 32, Math.sin(a) * r); b.g.add(o.g); } return b; } },
  // batch 2
  { name: 'White House', lat: 38.89768, lon: -77.03653, hide: 150, build: whiteHouse },
  { name: 'Great Wall of China (Badaling)', lat: 40.35910, lon: 116.01890, hide: 60, build: greatWall },
  { name: 'Arc de Triomphe', lat: 48.87380, lon: 2.29504, hide: 30, build: arcDeTriomphe },
  { name: 'Empire State Building', lat: 40.74844, lon: -73.98566, hide: 45, build: empireState },
  { name: 'Sagrada Família', lat: 41.40363, lon: 2.17436, hide: 70, rot: 0.785, build: sagrada },
  { name: 'Parthenon (Acropolis)', lat: 37.97153, lon: 23.72575, hide: 170, build: parthenon },
  { name: 'Sydney Harbour Bridge', lat: -33.85224, lon: 151.21082, hide: 40, rot: 0.33, build: harbourBridge },
  { name: 'Notre-Dame de Paris', lat: 48.85297, lon: 2.34989, hide: 50, rot: 0.33, build: notreDame },
];

// the rest of the catalogue, built from shared parametric pieces
LANDMARKS.push(...moreLandmarks({ B, MAT, canvas, onion, dome, pediment, archFill, column, pyramid }));
// mountains live in the terrain itself (so they stand on the horizon, and you can climb them); pads give land to landmarks the coarse world map leaves in the water
for (const d of LANDMARKS) { if (d.terrain) Geo.features.push({ lat: d.lat, lon: d.lon, ...d.terrain }); if (d.pad) Geo.features.push({ lat: d.lat, lon: d.lon, r: d.pad.r, pad: d.pad.h }); }

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

// ---------- batch 2: White House, Great Wall, Arc de Triomphe, Empire State, Sagrada Família, Parthenon, Sydney Harbour Bridge, Notre-Dame ----------
// triangular gable (pediment) of width w, height h, depth d, facing along z
function pediment(b, w, h, d, mat, x, y, z, ry = 0) { const sh = new THREE.Shape(); sh.moveTo(-w / 2, 0); sh.lineTo(w / 2, 0); sh.lineTo(0, h); sh.closePath(); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false }); g.translate(0, 0, -d / 2); return b.mesh(g, mat, x, y, z, ry); }
// solid wall above a round-headed opening of width w: fills the spandrels between the arch and a flat top of height h
function archFill(b, w, h, d, mat, x, y, z, ry = 0) { const r = w / 2, sh = new THREE.Shape(); sh.moveTo(-r, 0); sh.lineTo(-r, h); sh.lineTo(r, h); sh.lineTo(r, 0); sh.absarc(0, 0, r, 0, Math.PI, false); const g = new THREE.ExtrudeGeometry(sh, { depth: d, bevelEnabled: false, curveSegments: 20 }); g.translate(0, 0, -d / 2); return b.mesh(g, mat, x, y, z, ry); }
function column(b, r, h, mat, x, y, z, cap = true) { const m = MAT(); b.cyl(r, r * 0.86, h, mat, x, y, z, 20, false); if (cap) b.box(r * 2.6, r * 0.5, r * 2.6, m.pentelicPlain, x, y + h, z, false); }

function whiteHouse() {
  const b = new B(), m = MAT(), W = 52, D = 26, H = 18;
  b.box(W, H, D, m.whiteHouse, 0, 0, 0);
  b.box(W + 1.2, 1.2, D + 1.2, m.whitePaint, 0, H, 0, false);                                  // cornice
  for (let i = 0; i < 26; i++) for (const s of [-1, 1]) b.box(0.4, 1.1, 0.4, m.whitePaint, -W / 2 + 1 + i * 2, H + 1.2, s * (D / 2 + 0.3), false);   // balustrade
  b.box(W - 4, 2.4, D - 4, m.concrete, 0, H, 0, false); b.box(W - 10, 1.2, D - 10, m.slate, 0, H + 2.4, 0, false);
  for (const cx of [-14, -4, 4, 14]) { b.box(1.4, 3.5, 1.4, m.whitePaint, cx, H + 2, -D / 2 + 4, false); b.box(1.4, 3.5, 1.4, m.whitePaint, cx, H + 2, D / 2 - 4, false); }   // chimneys
  // north portico: a porte-cochère of Ionic columns under a pediment
  for (let i = 0; i < 4; i++) for (const zz of [-D / 2 - 9, -D / 2 - 4]) column(b, 0.65, H - 2, m.whitePaint, -7.5 + i * 5, 0, zz);
  b.box(19, 2, 11, m.whitePaint, 0, H - 2, -D / 2 - 5.5); pediment(b, 20, 4.5, 11, m.whitePaint, 0, H, -D / 2 - 5.5);
  b.box(16, 0.6, 12, m.stonePlain, 0, 0, -D / 2 - 6, false);
  // south portico: the bowed colonnade with its balcony
  for (let i = 0; i < 6; i++) { const a = Math.PI * (0.12 + i / 5 * 0.76); column(b, 0.6, H - 2, m.whitePaint, Math.cos(a) * 10, 0, D / 2 + Math.sin(a) * 6); }
  const bow = new THREE.CylinderGeometry(10.8, 10.8, 1.6, 32, 1, false, 0, Math.PI); bow.scale(1, 1, 0.62); b.mesh(bow, m.whitePaint, 0, H - 1.2, D / 2, Math.PI / 2);
  const bal = new THREE.CylinderGeometry(10.4, 10.4, 1, 32, 1, true, 0, Math.PI); bal.scale(1, 1, 0.6); const bm = b.mesh(bal, m.whitePaint, 0, H - 2 + 9 * 0, D / 2, Math.PI / 2); bm.position.y = 8.5;
  b.solids.push([0, D / 2 + 3, 20, 7, 0, H, 0]);
  // the low colonnades to the East and West Wings, and the wings themselves
  for (const s of [-1, 1]) { b.box(30, 5, 8, m.whitePaint, s * (W / 2 + 15), 0, 4); b.box(26, 8, 22, m.whiteHouse, s * (W / 2 + 43), 0, 0); b.box(26.6, 0.8, 22.6, m.whitePaint, s * (W / 2 + 43), 8, 0, false); }
  b.cyl(0.12, 0.08, 9, m.white, 0, H + 3.6, 0, 6, false);
  const f = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.2, 8, 1), MAT().usFlag || (MAT().usFlag = new THREE.MeshStandardMaterial({ map: usFlag(), side: THREE.DoubleSide, roughness: 0.8 }))); f.position.set(2.05, H + 11.4, 0); b.g.add(f); b.g.userData.flag = f;
  // the lawns and the fountain
  b.box(180, 0.15, 260, new THREE.MeshStandardMaterial({ color: 0x4f7a34, roughness: 1 }), 0, -0.12, 30, false); b.box(10, 0.2, 40, m.stonePlain, 0, -0.05, -D / 2 - 30, false); b.cyl(5, 5, 0.6, m.whitePaint, 0, 0, D / 2 + 45, 24, false);
  return b;
}
function usFlag() { return canvas(120, 64, (x) => { for (let i = 0; i < 13; i++) { x.fillStyle = i % 2 ? '#fff' : '#b22234'; x.fillRect(0, i * 64 / 13, 120, 64 / 13 + 0.5); } x.fillStyle = '#3c3b6e'; x.fillRect(0, 0, 50, 34); x.fillStyle = '#fff'; for (let r = 0; r < 9; r++) for (let c = 0; c < (r % 2 ? 5 : 6); c++) x.fillRect(3 + c * 8 + (r % 2) * 4, 2 + r * 3.6, 1.6, 1.6); }); }

function arcDeTriomphe() {
  const b = new B(), m = MAT(), W = 45, D = 22, H = 50, aw = 14.6, ah = 29.2, tw = 8.4, th = 18.7;
  const pw = (W - aw) / 2, px = aw / 2 + pw / 2;
  const spring = ah - aw / 2;
  for (const s of [-1, 1]) {
    // each pier is pierced by the smaller side arch, running through it east-west
    for (const zz of [-1, 1]) b.box(pw, spring, (D - tw) / 2, m.lime, s * px, 0, zz * (tw / 2 + (D - tw) / 4));
    archFill(b, tw, spring - (th - tw / 2), pw, m.lime, s * px, th - tw / 2, 0, Math.PI / 2);
    b.box(pw, aw / 2 + 0.6, D, m.lime, s * px, spring, 0);
  }
  archFill(b, aw, aw / 2 + 0.6, D, m.lime, 0, ah - aw / 2, 0);
  b.box(W, H - ah - 0.6, D, m.lime, 0, ah + 0.6, 0);
  // cornice, frieze band and attic
  b.box(W + 1.6, 1.4, D + 1.6, m.stonePlain, 0, 38, 0, false); b.box(W + 0.6, 3, D + 0.6, m.stonePlain, 0, 34, 0, false); b.box(W + 1, 1, D + 1, m.stonePlain, 0, H - 1, 0, false);
  for (let i = 0; i < 30; i++) for (const s of [-1, 1]) b.box(0.9, 1.6, 0.4, m.stonePlain, -W / 2 + 1 + i * 1.48, 39.4, s * (D / 2 + 0.6), false);
  // the four sculpture groups on the main faces
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { b.box(8, 11, 1.4, m.stonePlain, sx * px, 3, sz * (D / 2 + 0.7), false); b.box(4, 4, 1.6, m.stonePlain, sx * px, 14, sz * (D / 2 + 0.8), false); }
  // Place Charles de Gaulle around it
  b.cyl(55, 55, 0.12, new THREE.MeshStandardMaterial({ color: 0xa89f90, roughness: 0.95 }), 0, -0.08, 0, 48, false);
  return b;
}

function empireState() {
  const b = new B(), m = MAT();
  for (const [w, d, y0, y1] of [[129, 57, 0, 25], [92, 50, 25, 40], [58, 44, 40, 280], [46, 34, 280, 300], [36, 26, 300, 320]]) b.box(w, y1 - y0, d, y1 - y0 > 30 ? m.deco : m.lime, 0, y0, 0);
  // the four corner wings that step back up the shaft
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.box(10, 210, 8, m.deco, sx * 24, 40, sz * 24, false);
  // mooring mast, observatory lantern and antenna
  b.cyl(9, 7, 22, m.decoTop, 0, 320, 0, 8); b.cyl(6.5, 5, 18, m.decoTop, 0, 342, 0, 8); b.cyl(4.5, 3, 12, m.decoTop, 0, 360, 0, 8); b.cone(3.2, 9, m.decoTop, 0, 372, 0, 8, 0);
  b.cyl(0.8, 0.4, 62, m.iron, 0, 381, 0, 6, false);
  return b;
}

function sagrada() {
  const b = new B(), m = MAT();
  // nave and transept with steep roofs, the apse at the far end
  b.box(28, 45, 90, m.sagrada, 0, 0, 0); b.box(60, 45, 26, m.sagrada, 0, 0, -6);
  b.box(14, 10, 90, m.sagrada, -21, 0, 0, false); b.box(14, 10, 90, m.sagrada, 21, 0, 0, false);
  const rf = new THREE.ConeGeometry(17, 16, 4, 1); rf.rotateY(Math.PI / 4); rf.scale(1, 1, 3.6); b.mesh(rf, m.sagTop, 0, 53, 0);
  b.cyl(14, 14, 40, m.sagrada, 0, 0, -45, 16);
  // a spindle tower: a bulging, tapering body, pierced near the top, crowned with a bright finial
  const spindle = (x, z, h, r, col) => {
    const pts = []; for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push([Math.max(0.3, r * (1 + 0.15 * Math.sin(t * Math.PI)) * (1 - t ** 1.8 * 0.92)), t * h]); } pts.push([0.01, h]);
    b.lathe(pts, m.sagrada, x, 0, z, 16); b.sphere(r * 0.42, col || m.sagTop, x, h + r * 0.2, z); b.solids.push([x, z, r * 1.8, r * 1.8, 0, h * 0.7, 0]);
  };
  const cols = [m.paintRed, m.paintYellow, m.paintGreen, m.paintBlue];
  for (const [fx, fz, rot] of [[30, -6, 1], [-30, -6, 1], [0, 46, 0]]) for (let i = 0; i < 4; i++) { const o = (i - 1.5) * 8, h = [98, 112, 112, 98][i]; spindle(fx + (rot ? 0 : o), fz + (rot ? o : 0), h, 4.5, cols[i]); }
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; spindle(Math.cos(a) * 14, -6 + Math.sin(a) * 14, 135, 6.5); }
  spindle(0, -36, 138, 6.5, m.gold);
  spindle(0, -6, 172.5, 9, m.white); b.box(7, 1.6, 1.6, m.white, 0, 176, -6, false); b.box(1.6, 1.6, 7, m.white, 0, 176, -6, false); b.box(1.6, 7, 1.6, m.white, 0, 173, -6, false);
  return b;
}

function parthenon(I) {
  const b = new B(), m = MAT();
  // the Acropolis: a steep limestone outcrop about 70 m above the city, flat on top
  const hill = new THREE.CylinderGeometry(1, 1.35, 1, 28, 6); const a = hill.attributes.position;
  for (let i = 0; i < a.count; i++) { const x = a.getX(i), y = a.getY(i), z = a.getZ(i), n = 0.88 + 0.12 * Math.sin(Math.atan2(z, x) * 5 + 1.3) + 0.06 * Math.sin(Math.atan2(z, x) * 13); a.setXYZ(i, x * n * (y > 0.45 ? 1 : 1 + (Math.random() - 0.5) * 0.05), y, z * n); }
  hill.scale(150, 72, 78); hill.translate(0, 36 - 6, 0); hill.computeVertexNormals(); b.mesh(hill, m.rock, 0, 0, 0);
  for (let k = 0; k < 6; k++) b.solids.push([0, 0, 260 - k * 4, 130 - k * 4, -6, 66, 0]);
  const top = 66, px = 30;   // the Parthenon stands east of centre on the summit
  b.box(80, 0.5, 40, m.pentelicPlain, px, top, 0, false);
  for (let k = 0; k < 3; k++) b.box(72.5 - k * 1.5, 0.55, 33.9 - k * 1.5, m.pentelicPlain, px, top + k * 0.55, 0);
  const sy = top + 1.65, ch = 10.4, L = 69.5, Wd = 30.9;
  // 8 columns on each end, 17 down each side (corners shared)
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) column(b, 0.95, ch, m.pentelic, px + s * (L / 2 - 1.5), sy, -Wd / 2 + 1.5 + i * (Wd - 3) / 7);
  for (let i = 1; i < 16; i++) for (const s of [-1, 1]) { if (i === 6 && s > 0) continue; column(b, 0.95, ch, m.pentelic, px - L / 2 + 1.5 + i * (L - 3) / 16, sy, s * (Wd / 2 - 1.5)); }
  b.box(L - 1, 3.3, Wd - 1, m.pentelicPlain, px, sy + ch + 0.5, 0, false);
  // only the west pediment survives in part; the roof is gone
  pediment(b, Wd - 1, 4.2, 2, m.pentelicPlain, px - L / 2 + 1.5, sy + ch + 3.8, 0, Math.PI / 2);
  pediment(b, (Wd - 1) * 0.55, 2.3, 2, m.pentelicPlain, px + L / 2 - 1.5, sy + ch + 3.8, -(Wd - 1) * 0.2, Math.PI / 2);
  // the ruined cella walls inside
  for (const s of [-1, 1]) b.box(48, 6 + s, 1.6, m.pentelicPlain, px, sy, s * 9.5); b.box(1.6, 8, 19, m.pentelicPlain, px - 24, sy, 0);
  b.solids.push([px, 0, L, Wd, top, sy + ch + 3.8, 0]);
  // the Erechtheion's porch of the maidens, north of the Parthenon, and the Propylaea gateway at the west end
  b.box(23, 9, 12, m.pentelicPlain, px - 35, top, -32); for (let i = 0; i < 3; i++) column(b, 0.5, 5, m.pentelic, px - 44 + i * 2.5, top + 1, -24);
  b.box(28, 12, 18, m.pentelicPlain, -110, top, 0); for (let i = 0; i < 6; i++) column(b, 0.8, 8.5, m.pentelic, -100, top + 0.5, -7.5 + i * 3);
  return b;
}

function harbourBridge() {
  const b = new B(), m = MAT(), span = 503, half = span / 2, deck = 49, apex = 134, xs = 15;
  // granite pylons at both ends
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) { b.box(17, 89, 22, m.granite, sx * 27, 0, sz * (half + 14)); b.box(19, 3, 24, m.granite, sx * 27, 86, sz * (half + 14), false); }
  // two arch trusses: an upper and a lower chord joined by a web of steel
  const chord = (yf) => { const pts = []; for (let i = 0; i <= 40; i++) { const z = -half + i / 40 * span; pts.push(new THREE.Vector3(0, yf(z), z)); } return pts; };
  const up = z => apex - (apex - deck - 8) * (z / half) ** 2, lo = z => (apex - 18) * (1 - (z / half) ** 2) + 4;
  const tube = (pts, r, mat, x) => { const c = new THREE.CatmullRomCurve3(pts); const g = new THREE.TubeGeometry(c, 80, r, 6, false); g.translate(x, 0, 0); b.mesh(g, mat); };
  const webMat = m.lattice.clone(); webMat.color = new THREE.Color(0x737d84); webMat.map = m.lattice.map.clone(); webMat.map.repeat.set(40, 2); webMat.map.needsUpdate = true;
  for (const sx of [-1, 1]) {
    tube(chord(up), 1.4, m.bridgeGrey, sx * xs); tube(chord(lo), 1.8, m.bridgeGrey, sx * xs);
    // the truss web between the chords as a lattice ribbon
    const P = [], N = 60; for (let i = 0; i <= N; i++) { const z = -half + i / N * span; P.push(sx * xs, up(z), z, sx * xs, Math.min(up(z), lo(z)), z); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); const uv = []; for (let i = 0; i <= N; i++) uv.push(i / N, 1, i / N, 0); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const idx = []; for (let i = 0; i < N; i++) idx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2); g.setIndex(idx); g.computeVertexNormals(); b.mesh(g, webMat);
  }
  // cross bracing between the two arches and hangers down to the deck
  for (let i = 1; i < 20; i++) { const z = -half + i / 20 * span, y = up(z); if (y > deck + 6) b.box(xs * 2, 1.2, 1.2, m.bridgeGrey, 0, y - 1, z, false); const yl = lo(z); if (yl > deck + 2) for (const sx of [-1, 1]) b.box(0.5, yl - deck, 0.5, m.bridgeGrey, sx * xs, deck, z, false); }
  // the deck: eight traffic lanes, rail tracks and footways, 49 m above the water
  b.box(49, 2.5, span + 56, m.concrete, 0, deck - 2.5, 0); b.box(46, 0.1, span + 56, new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.9 }), 0, deck, 0, false);
  for (const sx of [-1, 1]) b.box(0.4, 1.2, span + 56, m.bridgeGrey, sx * 24, deck, 0, false);
  for (let k = 0; k < 10; k++) { const z0 = -half + k * span / 10, z1 = z0 + span / 10, zm = (z0 + z1) / 2; for (const sx of [-1, 1]) b.solids.push([sx * xs, zm, 4, span / 10, Math.min(lo(z0), lo(z1)) - 2, Math.max(up(z0), up(z1)), 0]); }
  return b;
}

function notreDame() {
  const b = new B(), m0 = MAT(), L = 128, m = Object.assign({}, m0, { stone: m0.lime, stonePlain: m0.lime });
  // twin west towers and the facade between them, with the rose window
  for (const s of [-1, 1]) { b.box(15, 69, 15, m.stone, -L / 2 + 7.5, 0, s * 13); b.box(16, 1.2, 16, m.stonePlain, -L / 2 + 7.5, 69, s * 13, false); }
  b.box(12, 46, 11, m.stone, -L / 2 + 7.5, 0, 0);
  const rw = new THREE.Mesh(new THREE.CircleGeometry(4.8, 40), m.rose); rw.position.set(-L / 2 - 0.05, 30, 0); rw.rotation.y = -Math.PI / 2; b.g.add(rw);
  for (const zz of [-6, 0, 6]) b.box(0.6, 9, 4, m.dark, -L / 2 - 0.2, 0, zz, false);
  b.box(0.6, 3, 26, m.stonePlain, -L / 2 - 0.3, 20, 0, false);   // gallery of kings
  // nave, aisles, transept and the round apse
  b.box(L - 15, 33, 13, m.stone, 7.5, 0, 0); for (const s of [-1, 1]) b.box(L - 25, 20, 9, m.stone, 6, 0, s * 11);
  const roof = new THREE.ConeGeometry(9.3, 10, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(1, 1, (L - 15) / 13); roof.rotateY(Math.PI / 2); b.mesh(roof, m.lead, 7.5, 38, 0);
  b.box(14, 33, 48, m.stone, 14, 0, 0); const tr = new THREE.ConeGeometry(9.3, 10, 4, 1); tr.rotateY(Math.PI / 4); tr.scale(1, 1, 48 / 13); b.mesh(tr, m.lead, 14, 38, 0);
  for (const s of [-1, 1]) { const rr = new THREE.Mesh(new THREE.CircleGeometry(4.2, 32), m.rose); rr.position.set(14, 24, s * 24.05); if (s < 0) rr.rotation.y = Math.PI; b.g.add(rr); }
  const apse = new THREE.CylinderGeometry(6.5, 6.5, 33, 20, 1, false, 0, Math.PI); b.mesh(apse, m.stone, L / 2 - 1, 16.5, 0, 0);
  // flying buttresses along both flanks
  for (let i = 0; i < 12; i++) for (const s of [-1, 1]) { const x = -40 + i * 8.5; b.box(1.6, 22, 1.6, m.stonePlain, x, 0, s * 19, false); const fb = b.mesh(new THREE.BoxGeometry(0.9, 11, 1.1), m.stonePlain, x, 26, s * 12.5); fb.rotation.x = s * 0.95; b.cone(0.6, 4, m.stonePlain, x, 22, s * 19, 6, 0); }
  // the spire over the crossing, rebuilt as Viollet-le-Duc designed it
  b.cyl(2.6, 2.6, 8, m.lead, 14, 43, 0, 8, false); b.cone(2.6, 45, m.lead, 14, 51, 0, 8, 0); b.sphere(0.5, m.gold, 14, 96.5, 0);
  b.box(140, 0.12, 60, new THREE.MeshStandardMaterial({ color: 0xb3aa98, roughness: 0.95 }), -20, -0.08, 0, false);
  return b;
}

// a stretch of the wall near Badaling, laid along the real ground: sloped walkway, battlements, beacon towers
function greatWall(I) {
  const b = new B(), m = MAT(), y0 = Geo.height(I.x, I.z), parts = [], crens = [], towers = [];
  const pts = []; let x = 0, z = 0, a = 0.9; const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  for (let i = 0; i < 150; i++) { pts.push([x, z, Geo.height(I.x + x, I.z + z) - y0]); a += (rnd() - 0.5) * 0.35 + Math.sin(i * 0.07) * 0.06; x += Math.sin(a) * 7; z += Math.cos(a) * 7; }
  // centre the stretch on the landmark's own position, then lay it on the ground
  const mid = pts[pts.length >> 1]; for (const q of pts) { q[0] -= mid[0]; q[1] -= mid[1]; q[2] = Geo.height(I.x + q[0], I.z + q[1]) - y0; }
  const Wd = 6.5, Hh = 7.5, M4 = new THREE.Matrix4();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, z0, g0] = pts[i], [x1, z1, g1] = pts[i + 1], dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz), nx = -dz / len * Wd / 2, nz = dx / len * Wd / 2;
    // a sloped prism: top follows the ground +Hh, bottom sinks well into the hill
    const v = [[x0 - nx, g0 - 6, z0 - nz], [x0 + nx, g0 - 6, z0 + nz], [x1 + nx, g1 - 6, z1 + nz], [x1 - nx, g1 - 6, z1 - nz], [x0 - nx, g0 + Hh, z0 - nz], [x0 + nx, g0 + Hh, z0 + nz], [x1 + nx, g1 + Hh, z1 + nz], [x1 - nx, g1 + Hh, z1 - nz]];
    const F = [[4, 5, 6, 7], [0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]], P = [], U = [];
    for (const f of F) { const q = [v[f[0]], v[f[1]], v[f[2]], v[f[3]]]; for (const k of [0, 1, 2, 0, 2, 3]) P.push(...q[k]); U.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U.map((u, k) => k % 2 ? u * (Hh + 6) / 4 : u * len / 4), 2)); g.computeVertexNormals(); parts.push(g);
    const ry = Math.atan2(dx, dz); b.solids.push([(x0 + x1) / 2, (z0 + z1) / 2, Wd, len + 0.4, Math.min(g0, g1) - 6, (g0 + g1) / 2 + Hh, ry]);
    // battlements on the outer side, a low parapet on the inner
    for (let k = 0; k < len; k += 2.4) { const f = k / len, cx = x0 + dx * f, cz = z0 + dz * f, cy = g0 + (g1 - g0) * f + Hh; const cg = new THREE.BoxGeometry(0.6, 1.6, 1.3); M4.makeRotationY(ry).setPosition(cx + nx * 0.92, cy + 0.8, cz + nz * 0.92); cg.applyMatrix4(M4); crens.push(cg.toNonIndexed()); }
    const pg = new THREE.BoxGeometry(0.5, 0.9, len); M4.makeRotationY(ry).setPosition((x0 + x1) / 2 - nx * 0.92, (g0 + g1) / 2 + Hh + 0.45, (z0 + z1) / 2 - nz * 0.92); pg.applyMatrix4(M4); crens.push(pg.toNonIndexed());
    if (i % 26 === 13) towers.push([x0, z0, g0, ry]);
  }
  b.mesh(mergeGeometries(parts), m.wallBrick); b.mesh(mergeGeometries(crens), m.wallBrick);
  for (const [tx, tz, tg, ry] of towers) {
    b.box(11, Hh + 6, 11, m.wallBrick, tx, tg - 4, tz, true, ry);
    for (let k = 0; k < 4; k++) { const aa = ry + k * Math.PI / 2; for (const o of [-3.5, 0, 3.5]) b.box(1.2, 1.5, 0.6, m.wallBrick, tx + Math.sin(aa) * 5.2 + Math.cos(aa) * o, tg + Hh + 2, tz + Math.cos(aa) * 5.2 - Math.sin(aa) * o, false, aa); }
    b.box(1.6, 2.6, 0.3, m.dark, tx + Math.sin(ry) * 5.6, tg + Hh - 1, tz + Math.cos(ry) * 5.6, false, ry);
  }
  return b;
}

// ---------- placement ----------
// build once, then merge the many small parts into one mesh per material: far fewer draw calls on phones.
// Parts that animate (the London Eye wheel, flags, windmill sails) are left alone.
// weathering for every landmark surface: large-scale colour variation, rain streaks running down walls and
// darker, damper stone near the ground, all in world space so nothing tiles and no textures are needed
const weathered = new WeakSet(), FLOOD = { value: 0 };
function weather(m) {
  if (!m || weathered.has(m) || !m.isMeshStandardMaterial || m.transparent || m.blending !== THREE.NormalBlending) return; weathered.add(m);
  const prev = m.onBeforeCompile;
  const flood = !m.vertexColors;
  m.onBeforeCompile = (sh, r) => { prev && prev.call(m, sh, r); sh.uniforms.uFlood = FLOOD;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLW; varying float vLY;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = (modelMatrix * vec4(transformed, 1.0)).xyz; vLY = vLW.y - modelMatrix[3].y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      uniform float uFlood; varying vec3 vLW; varying float vLY; float wh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(wh(i), wh(i + vec2(1, 0)), f.x), mix(wh(i + vec2(0, 1)), wh(i + vec2(1, 1)), f.x), f.y); }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
      { float big = wn(vLW.xz * 0.04 + vLW.y * 0.02) * 0.6 + wn(vLW.xz * 0.15 + vLW.y * 0.1) * 0.4;
        float streak = wn(vec2((vLW.x + vLW.z) * 1.7, vLW.y * 0.06)) * smoothstep(0.2, 0.9, wn(vec2((vLW.x - vLW.z) * 0.35, vLW.y * 0.02)));
        float base = 1.0 - smoothstep(0.0, 4.0, vLY);
        diffuseColor.rgb *= (0.9 + big * 0.2) * (1.0 - streak * 0.16);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.7, 0.66), base * 0.5); }`)
      // floodlighting at night: warm light washing up the walls from the ground, fading with height
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (flood ? 'totalEmissiveRadiance += diffuseColor.rgb * uFlood * (0.12 + 0.6 * (1.0 - smoothstep(0.0, 90.0, vLY))) * vec3(1.0, 0.84, 0.62) * (0.7 + 0.3 * abs(normal.y < 0.5 ? 1.0 : 0.4));' : ''));
  };
  const k = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.customProgramCacheKey = () => k() + '|lmw';
  m.needsUpdate = true;
}
function built(I) {
  if (I.built) return I.built; const b = I.built = I.d.build(I), keep = new Set();
  b.g.traverse(o => { if (o.isMesh) weather(o.material); });
  for (const v of Object.values(b.g.userData)) if (v && v.isObject3D) v.traverse(o => keep.add(o));
  for (const o of b.g.children) if (o.isGroup && !o.children.every(c => c.isMesh)) o.traverse(c => keep.add(c));
  const groups = new Map(); b.g.updateMatrixWorld(true);
  b.g.traverse(o => { if (!o.isMesh || keep.has(o) || o === b.g) return; const k = o.material.uuid; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); });
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const geos = list.map(o => { let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k); if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); if (!g.attributes.normal) g.computeVertexNormals(); return g; });
    const hasCol = geos.some(g => g.attributes.color); if (hasCol && !geos.every(g => g.attributes.color)) continue;
    let merged; try { merged = mergeGeometries(geos); } catch (e) { merged = null; } if (!merged) continue;
    const m = new THREE.Mesh(merged, list[0].material); m.castShadow = m.receiveShadow = true;
    for (const o of list) o.parent.remove(o); b.g.add(m);
  }
  return b;
}
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
  const b = built(I), cs = Math.cos(I.rot), sn = Math.sin(I.rot), out = [];
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
      out.push({ name: I.d.name, x: I.x, z: I.z, solids: solidsFor(I, y), build: () => { const b = built(I); b.g.position.set(I.x, y, I.z); b.g.rotation.y = I.rot; b.g.userData.inst = I; live.add(b.g); return b.g; } });
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
  clearAt(ch, x, z, r) { for (const I of instances()) { const span = 1 + Math.ceil((I.d.hide || 20) / CH); if (Math.abs(I.cx - ch.cx) > span || Math.abs(I.cz - ch.cz) > span) continue; const R = (I.d.hide || 20) + r; if ((x - I.x) ** 2 + (z - I.z) ** 2 < R * R) return true; } return false; },
  find(name) { for (const I of instances()) if (I.d.name.startsWith(name)) return { x: I.x, z: I.z, y: City.inside(I.x, I.z) ? BASE : Math.max(0.2, Geo.height(I.x, I.z)) }; return null; },
  defs: LANDMARKS, _built: built,
  within(x, z, r) { const out = []; for (const I of instances()) if (Math.abs(I.x - x) < r && Math.abs(I.z - z) < r) out.push({ name: I.d.name, x: I.x, z: I.z }); return out; },
  nearest(x, z, max = 400) { let best = null, bd = max * max; for (const I of instances()) { const d = (I.x - x) ** 2 + (I.z - z) ** 2; if (d < bd) { bd = d; best = I.d.name; } } return best; },
  update(dt) {
    for (const g of live) {
      if (!g.parent) continue;
      const u = g.userData;
      if (u.wheel) { u.wheel.rotation.x += dt * 0.0045 * 60 / 60; for (const p of u.pods) p.rotation.x = -u.wheel.rotation.x; }
      if (u.glow || u.sail) { const n = G.sky ? G.sky.night : 0; if (u.glow) { u.glow.emissiveIntensity = n * 2.2; u.glow.emissive.setHSL((G.time * 0.05) % 1, 0.8, 0.5); } if (u.sail) u.sail.emissiveIntensity = n * 0.8; }
      if (u.flag) { const t = G.time; u.flag.rotation.y = Math.sin(t * 1.3) * 0.25; }
    }
    clockAcc += dt; if (clockAcc > 20 && clockT) { clockAcc = 0; drawClock(); }
    FLOOD.value = G.sky ? Math.max(0, G.sky.night - 0.25) * 1.3 : 0;
    if (mats.deco) { const n = G.sky ? G.sky.night : 0; mats.deco.emissiveIntensity = n * 1.1; mats.decoTop.emissiveIntensity = n * 1.6; mats.rose.emissiveIntensity = n * 1.2; }
    if (mats.clock) mats.clock.emissiveIntensity = 0.05 + (G.sky ? G.sky.night : 0) * 2.6;
  },
};
const live = new Set(); let clockAcc = 99;
