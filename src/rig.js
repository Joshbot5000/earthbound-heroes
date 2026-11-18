// People: an articulated body built from lathed, tapered shapes (torso, pelvis, limbs, hands, shoes,
// a face with eyes, nose and ears, hair), dressed per role and region. Hero suits use patterned,
// glowing materials. Shared by heroes, civilians, the Syndicate and police.
import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';
import { blobTex } from './vehicles.js';

const V2 = THREE.Vector2;
function lathe(profile, seg = 14) { if (profile[0][1] > profile[profile.length - 1][1]) profile = profile.slice().reverse(); const g = new THREE.LatheGeometry(profile.map(([r, y]) => new V2(Math.max(0.001, r), y)), seg); g.computeVertexNormals(); return g; }
// tapered limb from y=0 down to -L with rounded ends
function limb(r0, r1, L, bulge = 0, at = 0.4) {
  const pts = [[0.001, r0 * 0.9]];
  for (let i = 0; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push([Math.sin(a) * r0, Math.cos(a) * r0 * 0.9]); }
  for (let i = 1; i <= 8; i++) { const t = i / 8, y = -t * L, b = bulge * Math.sin(clamp((t - at + 0.3) / 0.6, 0, 1) * Math.PI); pts.push([lerp(r0, r1, t) + b, y]); }
  for (let i = 1; i <= 6; i++) { const a = i / 6 * Math.PI / 2; pts.push([Math.cos(a) * r1, -L - Math.sin(a) * r1 * 0.9]); }
  return lathe(pts, 14);
}
const G0 = {};
function geos() {
  if (G0.torso) return G0;
  G0.torso = lathe([[0.001, 0.0], [0.13, 0.0], [0.138, 0.06], [0.15, 0.16], [0.172, 0.3], [0.182, 0.38], [0.178, 0.45], [0.16, 0.52], [0.11, 0.57], [0.06, 0.6], [0.001, 0.6]], 18); G0.torso.scale(1, 1, 0.66);
  G0.pelvis = lathe([[0.001, 0.1], [0.135, 0.1], [0.16, 0.03], [0.165, -0.04], [0.15, -0.1], [0.11, -0.14], [0.001, -0.15]], 16); G0.pelvis.scale(1, 1, 0.72);
  G0.upper = limb(0.064, 0.05, 0.27, 0.008, 0.3); G0.fore = limb(0.05, 0.036, 0.25, 0.006, 0.25);
  G0.thigh = limb(0.092, 0.06, 0.39, 0.006, 0.3); G0.shin = limb(0.062, 0.042, 0.39, 0.012, 0.3);
  G0.shoulder = new THREE.SphereGeometry(0.072, 14, 10);
  G0.neck = new THREE.CylinderGeometry(0.048, 0.055, 0.12, 12);
  G0.head = new THREE.SphereGeometry(0.112, 24, 18); G0.head.scale(0.86, 1.06, 0.98);
  G0.jaw = new THREE.SphereGeometry(0.08, 16, 10); G0.jaw.scale(0.95, 0.75, 1);
  G0.nose = new THREE.ConeGeometry(0.018, 0.045, 8); G0.nose.rotateX(Math.PI / 2 + 0.3);
  G0.ear = new THREE.SphereGeometry(0.025, 8, 6); G0.ear.scale(0.4, 1, 0.7);
  G0.eye = new THREE.SphereGeometry(0.014, 10, 8);
  G0.hand = new THREE.SphereGeometry(0.045, 12, 8); G0.hand.scale(0.75, 1.15, 0.5);
  G0.thumb = new THREE.CapsuleGeometry(0.013, 0.03, 3, 6);
  G0.shoe = new THREE.SphereGeometry(0.06, 14, 8); G0.shoe.scale(0.85, 0.62, 2.0);
  G0.sole = new THREE.BoxGeometry(0.1, 0.02, 0.26);
  G0.hair = new THREE.SphereGeometry(0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55); G0.hair.scale(0.9, 1.05, 1.02);
  G0.hairLong = new THREE.SphereGeometry(0.125, 16, 12, Math.PI * 0.15, Math.PI * 1.7, 0, Math.PI * 0.85); G0.hairLong.scale(0.92, 1.1, 1.05);
  G0.bun = new THREE.SphereGeometry(0.05, 10, 8);
  G0.helmet = new THREE.SphereGeometry(0.128, 24, 16); G0.helmet.scale(0.9, 1.07, 1.02);
  G0.lens = new THREE.SphereGeometry(0.03, 12, 8); G0.lens.scale(1.4, 0.65, 0.4);
  G0.custodian = lathe([[0.001, 0.26], [0.04, 0.255], [0.09, 0.22], [0.115, 0.15], [0.125, 0.06], [0.13, 0.0], [0.001, 0.0]], 18);
  G0.cap = new THREE.CylinderGeometry(0.125, 0.12, 0.07, 18); G0.visor = new THREE.CylinderGeometry(0.13, 0.13, 0.012, 18, 1, false, -Math.PI / 2, Math.PI);
  G0.skirt = lathe([[0.001, 0.08], [0.16, 0.08], [0.2, -0.2], [0.26, -0.55], [0.001, -0.55]], 18); G0.skirt.scale(1, 1, 0.8);
  G0.sari = lathe([[0.001, 0.08], [0.16, 0.08], [0.19, -0.3], [0.21, -0.85], [0.001, -0.85]], 18); G0.sari.scale(1, 1, 0.82);
  G0.vest = lathe([[0.001, 0.02], [0.142, 0.02], [0.156, 0.16], [0.178, 0.3], [0.188, 0.4], [0.17, 0.48], [0.001, 0.48]], 18); G0.vest.scale(1, 1, 0.7);
  G0.hood = new THREE.SphereGeometry(0.135, 18, 12, Math.PI * 0.2, Math.PI * 1.6, 0, Math.PI * 0.75); G0.hood.scale(0.95, 1.08, 1.1);
  G0.shadow = new THREE.PlaneGeometry(0.9, 0.9).rotateX(-Math.PI / 2);
  return G0;
}
let shadowMat = null;

// patterned suit textures for the heroes
const suitTex = {};
function suitTexture(kind) {
  if (suitTex[kind]) return suitTex[kind];
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d'), e = document.createElement('canvas'); e.width = e.height = 256; const y = e.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256); y.fillStyle = '#000'; y.fillRect(0, 0, 256, 256);
  if (kind === 'web') { x.strokeStyle = '#666'; y.strokeStyle = '#37f5d6'; for (const z of [x, y]) { z.lineWidth = 2; for (let i = 0; i < 9; i++) { z.beginPath(); z.moveTo(i * 32, 0); z.lineTo(i * 32 + 16, 256); z.stroke(); } for (let j = 0; j < 9; j++) { z.beginPath(); for (let i = 0; i <= 8; i++) z.lineTo(i * 32, j * 32 + Math.sin(i) * 4 + 8); z.stroke(); } } }
  else if (kind === 'magma') { for (let i = 0; i < 60; i++) { let px = Math.random() * 256, py = Math.random() * 256; y.strokeStyle = `rgb(255,${90 + Math.random() * 80 | 0},20)`; x.strokeStyle = '#555'; for (const z of [x, y]) { z.lineWidth = 1 + Math.random() * 2; z.beginPath(); z.moveTo(px, py); } for (let k = 0; k < 6; k++) { px += (Math.random() - 0.5) * 40; py += (Math.random() - 0.5) * 40; x.lineTo(px, py); y.lineTo(px, py); } x.stroke(); y.stroke(); } }
  else if (kind === 'ice') { for (let i = 0; i < 70; i++) { const px = Math.random() * 256, py = Math.random() * 256, s = 10 + Math.random() * 30; x.fillStyle = `rgb(${200 + Math.random() * 55 | 0},${215 + Math.random() * 40 | 0},255)`; x.beginPath(); x.moveTo(px, py - s); x.lineTo(px + s * 0.6, py); x.lineTo(px, py + s); x.lineTo(px - s * 0.6, py); x.fill(); } y.strokeStyle = '#9fe8ff'; y.lineWidth = 1; for (let i = 0; i < 30; i++) { y.beginPath(); y.moveTo(Math.random() * 256, Math.random() * 256); y.lineTo(Math.random() * 256, Math.random() * 256); y.stroke(); } }
  else if (kind === 'circuit') { x.strokeStyle = '#777'; y.strokeStyle = '#7dff3a'; for (let i = 0; i < 40; i++) { let px = Math.floor(Math.random() * 16) * 16, py = Math.floor(Math.random() * 16) * 16; for (const z of [x, y]) { z.lineWidth = 2; z.beginPath(); z.moveTo(px, py); } for (let k = 0; k < 4; k++) { if (Math.random() < 0.5) px += (Math.random() < 0.5 ? -1 : 1) * 32; else py += (Math.random() < 0.5 ? -1 : 1) * 32; x.lineTo(px, py); y.lineTo(px, py); } x.stroke(); y.stroke(); y.fillStyle = '#7dff3a'; y.fillRect(px - 3, py - 3, 6, 6); } }
  const a = new THREE.CanvasTexture(c), b = new THREE.CanvasTexture(e); for (const t of [a, b]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); t.colorSpace = THREE.SRGBColorSpace; }
  return suitTex[kind] = { map: a, emissive: b };
}

// o: { skin, top, bottom, shoes, hair, hairStyle, sleeves, skirt, sari, scale, suit, glow, pattern, accent, helmet, lenses, headwear, vest, hood }
export function makeRig(o) {
  const g = geos(), mats = [];
  const mk = (color, extra = {}) => { const m = new THREE.MeshPhysicalMaterial({ color, roughness: extra.rough ?? 0.75, metalness: extra.metal ?? 0, sheen: extra.sheen ?? 0.4, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).multiplyScalar(0.6), ...extra.mat }); mats.push(m); return m; };
  const skin = mk(o.skin ?? 0xc68e62, { rough: 0.55, sheen: 0.2 });
  let top, bottom, shoes;
  if (o.suit !== undefined) {
    const t = o.pattern ? suitTexture(o.pattern) : null;
    top = mk(o.suit, { rough: o.rough ?? 0.42, metal: o.metal ?? 0.15, sheen: 0.8, mat: t ? { map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: o.glowK ?? 1.4 } : {} });
    bottom = o.second !== undefined ? mk(o.second, { rough: 0.45, metal: o.metal ?? 0.15, sheen: 0.8, mat: t ? { map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color(0xffffff), emissiveIntensity: (o.glowK ?? 1.4) * 0.7 } : {} }) : top;
    shoes = mk(o.boots ?? 0x18191c, { rough: 0.4, metal: 0.3 });
  } else { top = mk(o.top ?? 0x4a5a7a); bottom = mk(o.bottom ?? 0x2a2e38, { rough: 0.8 }); shoes = mk(o.shoes ?? 0x1c1c1e, { rough: 0.45 }); }
  const accent = mk(o.accent ?? 0x222222, { rough: 0.3, mat: { emissive: new THREE.Color(o.accent ?? 0), emissiveIntensity: o.accentGlow ?? 0 } });
  const hairM = mk(o.hair ?? 0x2a1a10, { rough: 0.5, sheen: 1 });
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body); body.position.y = 0.94;
  const add = (geo, mat, parent, x = 0, y = 0, z = 0, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; parent.add(m); return m; };
  const piv = (p, x, y, z) => { const q = new THREE.Group(); q.position.set(x, y, z); p.add(q); return q; };
  add(g.pelvis, bottom, body);
  if (o.skirt) add(g.skirt, mk(o.skirtCol ?? o.bottom ?? 0x6a2a4a), body, 0, -0.02, 0);
  if (o.sari) add(g.sari, mk(o.sariCol ?? 0xc0306a, { sheen: 1 }), body, 0, -0.02, 0);
  const chest = piv(body, 0, 0.06, 0); add(g.torso, top, chest);
  if (o.vest) add(g.vest, mk(o.vest, { rough: 0.5, mat: { emissive: new THREE.Color(o.vest), emissiveIntensity: 0.15 } }), chest, 0, 0.0, 0.004);
  if (o.emblem) { const e = add(new THREE.CircleGeometry(0.045, 6), accent, chest, 0, 0.38, 0.122); }
  const neck = piv(chest, 0, 0.6, 0); add(g.neck, o.suit !== undefined && o.helmet ? top : skin, neck, 0, 0.02, 0);
  const head = piv(neck, 0, 0.13, 0.008);
  if (o.helmet) {
    add(g.helmet, o.helmetMat ? mk(o.helmetMat, { rough: 0.3, metal: 0.4 }) : top, head, 0, 0.02, 0);
    for (const s of [-1, 1]) { const l = add(g.lens, mk(0xffffff, { rough: 0.1, mat: { emissive: new THREE.Color(o.lenses ?? 0xffffff), emissiveIntensity: 2.5 } }), head, s * 0.045, 0.035, 0.105); l.rotation.z = s * 0.25; l.rotation.y = s * 0.35; }
  } else {
    add(g.head, skin, head); add(g.jaw, skin, head, 0, -0.05, 0.02); add(g.nose, skin, head, 0, 0.0, 0.112);
    for (const s of [-1, 1]) { add(g.ear, skin, head, s * 0.098, 0.005, -0.005); const eye = add(g.eye, mk(0xf4f2ee, { rough: 0.2 }), head, s * 0.036, 0.025, 0.094, false); add(new THREE.SphereGeometry(0.008, 8, 6), mk(0x1a1410, { rough: 0.1 }), eye, 0, 0, 0.009, false); }
    if (o.hood) add(g.hood, top, head, 0, 0.01, -0.01);
    else if (o.hairStyle !== 'bald') { add(o.hairStyle === 'long' ? g.hairLong : g.hair, hairM, head, 0, 0.012, -0.006).rotation.x = -0.12; if (o.hairStyle === 'bun') add(g.bun, hairM, head, 0, 0.06, -0.11); }
    if (o.headwear === 'custodian') { add(g.custodian, mk(0x10141c, { rough: 0.4 }), head, 0, 0.06, -0.005); add(new THREE.CircleGeometry(0.03, 8), mk(0xc0c4c8, { metal: 1, rough: 0.2 }), head, 0, 0.17, 0.112); }
    if (o.headwear === 'cap') { add(g.cap, mk(o.capCol ?? 0x14182a, { rough: 0.6 }), head, 0, 0.1, 0); add(g.visor, mk(0x111111, { rough: 0.3 }), head, 0, 0.07, 0.05); }
    if (o.mask) add(new THREE.SphereGeometry(0.115, 16, 8, -Math.PI * 0.45, Math.PI * 0.9, Math.PI * 0.5, Math.PI * 0.22), mk(o.mask, { rough: 0.6 }), head, 0, 0.0, 0.006);
  }
  const arm = (side) => {
    const sh = piv(chest, side * 0.215, 0.5, 0); add(g.shoulder, top, sh, side * 0.01, 0.0, 0);
    const a = piv(sh, side * 0.02, -0.02, 0); add(g.upper, o.sleeves === 'short' ? (add(new THREE.CylinderGeometry(0.068, 0.06, 0.12, 12), top, a, 0, -0.03, 0), skin) : top, a);
    const f = piv(a, 0, -0.29, 0); add(g.fore, o.sleeves === 'long' || o.suit !== undefined ? top : skin, f);
    const hm = o.gloves !== undefined ? mk(o.gloves, { rough: 0.4, metal: 0.2, mat: { emissive: new THREE.Color(o.accent ?? 0), emissiveIntensity: (o.accentGlow ?? 0) * 0.4 } }) : skin;
    add(g.hand, hm, f, 0, -0.29, 0.005); add(g.thumb, hm, f, side * -0.03, -0.27, 0.025).rotation.z = side * 0.6;
    return [a, f];
  };
  const leg = (side) => {
    const a = piv(body, side * 0.095, -0.05, 0); add(g.thigh, bottom, a);
    const b = piv(a, 0, -0.41, 0); add(g.shin, bottom, b);
    add(g.shoe, shoes, b, 0, -0.43, 0.05); add(g.sole, mk(0xd8d4cc, { rough: 0.9 }), b, 0, -0.465, 0.05, false);
    return [a, b];
  };
  const [armL, foreL] = arm(1), [armR, foreR] = arm(-1), [legL, shinL] = leg(1), [legR, shinR] = leg(-1);
  if (!shadowMat) shadowMat = new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, opacity: 0.7 });
  const shadow = new THREE.Mesh(g.shadow, shadowMat); shadow.position.y = 0.03; shadow.renderOrder = -1; root.add(shadow);
  if (o.scale) root.scale.setScalar(o.scale);
  return { root, body, chest, neck, armL, armR, foreL, foreR, legL, legR, shinL, shinR, mats, phase: Math.random() * 6, pose: {}, shadow };
}
export function setRigOpacity(r, a) { for (const m of r.mats) { m.transparent = a < 1; m.opacity = a; m.depthWrite = a > 0.5; } }
export function tintRig(r, color, k) { for (const m of r.mats) { if (!m.userData.base) m.userData.base = m.emissive.clone(), m.userData.bi = m.emissiveIntensity, m.userData.bm = m.emissiveMap; if (k > 0) { m.emissive.set(color); m.emissiveIntensity = k; m.emissiveMap = null; } else { m.emissive.copy(m.userData.base); m.emissiveIntensity = m.userData.bi; m.emissiveMap = m.userData.bm; } m.needsUpdate = true; } }

// civilians dressed for the place
const SKIN = { india: [0x8d5a3a, 0x9a6440, 0x7a4a30, 0xa8724a, 0x6e432a], uk: [0xf1cfae, 0xe8b98f, 0xc68e62, 0x8d5a3a, 0x5a3a26, 0xe0b090], us: [0xf1cfae, 0xe0b090, 0xc68e62, 0x8d5a3a, 0x5a3a26], default: [0xf1cfae, 0xe8b98f, 0xc68e62, 0x8d5a3a, 0xd0a080] };
const pick = a => a[Math.random() * a.length | 0];
export function civilianLook(regKey) {
  const R = Math.random, warm = regKey === 'india' || regKey === 'gulf' || regKey === 'africa' || regKey === 'latam', female = R() < 0.5;
  const tops = regKey === 'uk' ? [0x1c1e24, 0x2a3442, 0x4a3a2c, 0x6a6e74, 0x3a4a3a, 0x7a2a2a, 0x223a5a, 0xc8c2b4] : regKey === 'india' ? [0xf0ece0, 0x6a8ac0, 0xe0c060, 0xc04060, 0x40a080, 0xd87030, 0xf4f4f4, 0x8a4ab0] : [0x2a3442, 0xd8d4cc, 0x6a2a2a, 0x2a5a8a, 0x3a3a3a, 0x8a8a4a, 0xc86a3a, 0x4a6a4a];
  const o = { skin: pick(SKIN[regKey] || SKIN.default), top: pick(tops), bottom: pick([0x1e2430, 0x2a2a2e, 0x3a4a6a, 0x5a4a3a, 0x7a7466, 0x1a1a1a]), shoes: pick([0x1a1a1a, 0x3a2a1a, 0xe8e8e8, 0x6a4a2a]),
    hair: regKey === 'india' || regKey === 'eastasia' || regKey === 'japan' ? pick([0x0e0a08, 0x1a120c, 0x24180e]) : pick([0x1a120c, 0x3a2414, 0x6a4a2a, 0xb08a50, 0x8a8a88, 0x24180e]),
    hairStyle: female ? pick(['long', 'long', 'bun', 'short']) : pick(['short', 'short', 'short', 'bald']), sleeves: warm ? pick(['short', 'short', 'long']) : pick(['long', 'long', 'short']), scale: (female ? 0.93 : 1) * (0.95 + R() * 0.1) };
  if (female && regKey === 'india' && R() < 0.55) { o.sari = true; o.sariCol = pick([0xc0306a, 0xe08a20, 0x2a8a6a, 0x8a2ab0, 0xd0b020, 0x2050c0, 0xc02020]); o.top = new THREE.Color(o.sariCol).multiplyScalar(0.8).getHex(); o.sleeves = 'short'; o.hairStyle = 'bun'; }
  else if (female && R() < 0.35) { o.skirt = true; o.skirtCol = pick([0x2a2a3a, 0x6a2a4a, 0x2a4a6a, 0x8a6a4a]); }
  if (!warm && R() < 0.3) o.top = pick([0x1a1a1a, 0x2a2a30, 0x4a3a2a]);
  return o;
}
export function copLook(regKey) {
  if (regKey === 'uk') return { skin: pick(SKIN.uk), top: 0x0c0e14, bottom: 0x0c0e14, shoes: 0x0a0a0a, vest: 0xd8f020, sleeves: 'long', hairStyle: 'short', headwear: Math.random() < 0.6 ? 'custodian' : 'cap', capCol: 0x0c0e14, hair: 0x2a1a10, gloves: 0x0a0a0a };
  if (regKey === 'india') return { skin: pick(SKIN.india), top: 0xb09a68, bottom: 0xa8925e, shoes: 0x2a1a10, sleeves: 'short', hairStyle: 'short', headwear: 'cap', capCol: 0x1a2a6a, hair: 0x0e0a08 };
  if (regKey === 'us') return { skin: pick(SKIN.us), top: 0x141c30, bottom: 0x141c30, shoes: 0x0a0a0a, sleeves: 'short', hairStyle: 'short', headwear: 'cap', capCol: 0x141c30, hair: 0x2a1a10 };
  return { skin: pick(SKIN.default), top: 0x1a2a4a, bottom: 0x1a2030, shoes: 0x0a0a0a, sleeves: 'long', hairStyle: 'short', headwear: 'cap', capCol: 0x1a2030, hair: 0x2a1a10, vest: Math.random() < 0.4 ? 0xd8f020 : undefined };
}
export function thugLook(heavy) {
  return heavy ? { skin: pick(SKIN.default), top: 0x2a0e12, bottom: 0x141418, shoes: 0x0a0a0a, sleeves: 'long', hood: true, mask: 0x111111, accent: 0xff2a3a, accentGlow: 2, emblem: true, scale: 1.25, gloves: 0x111111 }
    : { skin: pick(SKIN.default), top: pick([0x1a1b20, 0x2a2c30, 0x3a1418]), bottom: 0x16171b, shoes: 0x0a0a0a, sleeves: 'long', hood: Math.random() < 0.6, mask: 0x8a1018, accent: 0xff2a3a, accentGlow: 1.6, emblem: true, hairStyle: 'short', hair: 0x1a120c, scale: 1.02 };
}

// s: { speed, air, swing, wall, punch (0..1), punchSide, down, sit, fly, slide, aim, flail, vy }
export function animateRig(r, s, dt) {
  const sp = s.speed || 0, run = clamp(sp / 9, 0, 1.25); r.phase += dt * (4 + sp * 1.25) * (sp > 0.3 ? 1 : 0);
  const ph = r.phase, sn = Math.sin(ph), cs = Math.cos(ph), idle = sp < 0.3 ? Math.sin(r.phase * 0.5 + performance.now() * 0.0015) : 0;
  let T = { bodyX: run * 0.22, bodyY: 0.94 - Math.abs(cs) * 0.035 * run + idle * 0.004, bodyZ: 0, chestX: -idle * 0.02, chestY: sn * 0.14 * run,
    aLx: -sn * 0.9 * run, aRx: sn * 0.9 * run, aLz: 0.1 + 0.02 * idle, aRz: -0.1 - 0.02 * idle, fL: -0.2 - run * 0.95, fR: -0.2 - run * 0.95,
    lLx: sn * 0.95 * run, lRx: -sn * 0.95 * run, sL: Math.max(0, cs) * 1.5 * run + 0.05, sR: Math.max(0, -cs) * 1.5 * run + 0.05, rootX: 0, headX: 0 };
  if (s.air) { const up = clamp((s.vy || 0) / 12, -1, 1); Object.assign(T, { bodyX: 0.15 - up * 0.2, aLx: -0.4 + up * 1.2, aRx: -0.4 + up * 1.2, aLz: 0.8, aRz: -0.8, fL: -0.4, fR: -0.4, lLx: 0.5 + up * 0.3, lRx: -0.35, sL: 1.1, sR: 0.5 }); }
  if (s.swing) Object.assign(T, { bodyX: 0.25, aLx: -2.9, aRx: -2.6, aLz: 0.25, aRz: -0.1, fL: -0.15, fR: -0.5, lLx: 0.75, lRx: -0.25, sL: 1.25, sR: 0.45, chestY: 0.2 });
  if (s.fly) Object.assign(T, { bodyX: 1.25, aLx: 0.5, aRx: 0.5, aLz: 0.35, aRz: -0.35, fL: -0.1, fR: -0.1, lLx: 0.12, lRx: -0.08, sL: 0.15, sR: 0.25, headX: -0.9 });
  if (s.slide) Object.assign(T, { bodyX: 0.35, bodyY: 0.8, aLx: -0.9, aRx: 0.7, aLz: 1.0, aRz: -0.9, fL: -0.3, fR: -0.3, lLx: 0.75, lRx: -0.55, sL: 0.9, sR: 0.75, chestY: 0.5 });
  if (s.wall) Object.assign(T, { bodyX: 0.5, bodyZ: s.wall * 0.3 });
  if (s.sit) Object.assign(T, { bodyX: -0.1, bodyY: 0.55, aLx: -1.1, aRx: -1.1, fL: -0.5, fR: -0.5, lLx: -1.4, lRx: -1.4, sL: 1.3, sR: 1.3, aLz: 0.1, aRz: -0.1 });
  if (s.aim) { const pt = clamp(s.aimPitch || 0, -1, 1) * 0.9;
    Object.assign(T, { aRx: -1.5 + pt, fR: -0.05, aRz: 0, chestY: -0.25 });
    if (s.aim2) Object.assign(T, { aLx: -1.3 + pt, aLz: 0.62, fL: -0.6, chestY: -0.38 }); }
  if (s.flail) { T.aLx = -2.4 + Math.sin(ph * 2.2) * 0.8; T.aRx = -2.4 + Math.cos(ph * 2.5) * 0.8; }
  if (s.punch > 0) { const k = Math.sin(clamp(s.punch, 0, 1) * Math.PI), R = s.punchSide > 0;
    if (s.punchSide === 2) Object.assign(T, { lRx: -1.7 * k, sR: 0.2, bodyX: -0.35 * k, chestY: 0.5 * k });
    else Object.assign(T, R ? { aRx: -1.55 * k - 0.2, fR: -1.6 * (1 - k), chestY: -0.6 * k } : { aLx: -1.55 * k - 0.2, fL: -1.6 * (1 - k), chestY: 0.6 * k }); T.bodyX += 0.2 * k; }
  if (s.down) Object.assign(T, { rootX: -1.5, bodyX: 0, bodyY: 0.2, aLx: -2.6, aRx: -0.4, aLz: 0.9, aRz: -0.7, lLx: 0.25, lRx: -0.2, sL: 0.3, sR: 0.1, fL: -0.2, fR: -0.4 });
  const P = r.pose, k = s.snap ? 1 : 1 - Math.exp(-14 * dt);
  for (const n in T) P[n] = P[n] === undefined ? T[n] : P[n] + (T[n] - P[n]) * k;
  r.body.rotation.x = P.bodyX; r.body.position.y = P.bodyY; r.body.rotation.z = P.bodyZ; r.chest.rotation.y = P.chestY; r.chest.rotation.x = P.chestX; r.neck.rotation.x = P.headX;
  r.armL.rotation.set(P.aLx, 0, P.aLz); r.armR.rotation.set(P.aRx, 0, P.aRz); r.foreL.rotation.x = P.fL; r.foreR.rotation.x = P.fR;
  r.legL.rotation.x = -P.lLx; r.legR.rotation.x = -P.lRx; r.shinL.rotation.x = P.sL; r.shinR.rotation.x = P.sR;
  r.root.rotation.x = P.rootX; r.shadow.visible = !s.down;
}

export function makeHeli() {
  const root = new THREE.Group(), m = new THREE.MeshPhysicalMaterial({ color: 0x151a22, roughness: 0.35, metalness: 0.6, clearcoat: 1 }), stripe = new THREE.MeshStandardMaterial({ color: 0xe8c020, roughness: 0.4 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(1.4, 20, 14).scale(1, 0.95, 2.1), m); b.castShadow = true; root.add(b);
  const glass = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(0.95, 0.8, 1).rotateX(1.1).translate(0, 0.1, 1.6), new THREE.MeshPhysicalMaterial({ color: 0x0b1218, roughness: 0.05, metalness: 0.3, clearcoat: 1 })); root.add(glass);
  const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.4, 5.2, 10).rotateX(Math.PI / 2), m); tail.position.set(0, 0.45, -4.6); root.add(tail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.8), stripe); fin.position.set(0, 1.0, -7); root.add(fin);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.41, 1.41, 0.25, 20).rotateX(Math.PI / 2).scale(1, 0.95, 1), stripe); band.position.z = -0.4; root.add(band);
  for (const s of [-1, 1]) { const sk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3.6, 6).rotateX(Math.PI / 2), m); sk.position.set(s * 1.0, -1.45, 0.2); root.add(sk); }
  const rotor = new THREE.Group(); rotor.position.y = 1.55; root.add(rotor);
  for (let i = 0; i < 4; i++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.04, 0.3).translate(2.8, 0, 0), m); bl.rotation.y = i * Math.PI / 2; rotor.add(bl); }
  const beam = new THREE.Mesh(new THREE.ConeGeometry(9, 60, 20, 1, true), new THREE.MeshBasicMaterial({ color: 0xcfe4ff, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  beam.geometry.translate(0, -30, 0); root.add(beam);
  const nav = new THREE.Mesh(new THREE.SphereGeometry(0.15), new THREE.MeshBasicMaterial({ color: 0xff3030 })); nav.position.set(0, -1.3, 0.5); root.add(nav);
  return { root, rotor, beam };
}
