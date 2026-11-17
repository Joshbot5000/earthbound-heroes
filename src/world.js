// Streaming world. Inside a real city (London, Mumbai...) every chunk is built from map data: real
// building footprints and heights, streets, river banks, parks, trees and street furniture. Elsewhere
// cities are generated at real city locations in the architecture of their region.
import * as THREE from 'three';
import { G, clamp, lerp, smooth, hash2, rng, fbm } from './util.js';
import { Geo, CH, BLOCK } from './geo.js';
import { City, BASE } from './city.js';
import { region, regionFor } from './regions.js';
import { makeFacadeTextures, facadeMaterial, MeshBuilder } from './buildings.js';
import { cityMaterials, maskTexture, streetMeshes, bridgeSolids } from './citymesh.js';
import { insideSolid, nearestWall, rayPrism } from './solid.js';
import { Landmarks } from './landmarks.js';

const key = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
const ROAD = 7, WALK = 4, INSET = ROAD + WALK;

function canvasTex(size, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = size; draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t;
}
function speckle(x, S, n, a) { for (let i = 0; i < n; i++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * a})`; x.fillRect(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 1 + Math.random() * 3); } }
function gridTexture(lot, reg) {
  return canvasTex(1024, (x, S) => {
    const m = S / BLOCK, r = ROAD * m, w = WALK * m;
    x.fillStyle = reg.dusty ? '#4a4744' : '#2b2d30'; x.fillRect(0, 0, S, S); speckle(x, S, 9000, 0.07);
    x.fillStyle = '#' + reg.pave.toString(16).padStart(6, '0'); x.fillRect(r, r, S - 2 * r, S - 2 * r);
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 1;
    for (let i = r; i < S - r; i += 1.2 * m) { x.beginPath(); x.moveTo(i, r); x.lineTo(i, r + w); x.moveTo(i, S - r - w); x.lineTo(i, S - r); x.moveTo(r, i); x.lineTo(r + w, i); x.moveTo(S - r - w, i); x.lineTo(S - r, i); x.stroke(); }
    x.strokeStyle = '#c4c2bb'; x.lineWidth = 3; x.strokeRect(r, r, S - 2 * r, S - 2 * r);
    x.fillStyle = lot; x.fillRect(r + w, r + w, S - 2 * (r + w), S - 2 * (r + w));
    x.save(); x.beginPath(); x.rect(r + w, r + w, S - 2 * (r + w), S - 2 * (r + w)); x.clip(); speckle(x, S, 14000, 0.06); x.restore();
    x.fillStyle = reg.drive === 'left' ? '#e8e8e4' : '#d9b846';
    for (let i = r + 6 * m; i < S - r - 6 * m; i += 6 * m) { x.fillRect(0, i, 1.6, 3 * m); x.fillRect(S - 1.6, i, 1.6, 3 * m); x.fillRect(i, 0, 3 * m, 1.6); x.fillRect(i, S - 1.6, 3 * m, 1.6); }
    x.fillStyle = '#d6d6d2';
    for (const e of [r + 0.6 * m, S - r - 3.2 * m]) for (let i = 0.8 * m; i < r - 2; i += 1.3 * m) {
      x.fillRect(i, e, 0.6 * m, 2.6 * m); x.fillRect(S - i - 0.6 * m, e, 0.6 * m, 2.6 * m); x.fillRect(e, i, 2.6 * m, 0.6 * m); x.fillRect(e, S - i - 0.6 * m, 2.6 * m, 0.6 * m);
    }
  });
}

export class World {
  constructor(scene, q) {
    this.scene = scene; this.q = q; this.chunks = new Map(); this.dyn = []; this.queue = []; this.stamp = 0;
    this.collected = new Set(); try { this.collected = new Set(JSON.parse(localStorage.getItem('eh.orbs') || '[]')); } catch (e) { }
    const detail = canvasTex(256, (x, S) => { x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, S, S); speckle(x, S, 9000, 0.16); });
    this.matRural = new THREE.MeshStandardMaterial({ vertexColors: true, map: detail, roughness: 0.95, metalness: 0 });
    this.matFar = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    this.T = makeFacadeTextures(); this.facades = {}; this.grids = {}; this.cityMats = null;
    this.orbMat = new THREE.MeshBasicMaterial({ color: 0x66f6ff }); this.orbGeo = new THREE.OctahedronGeometry(0.9, 0);
    // ocean with moving normals and sky reflections
    const wn = canvasTex(256, (x, S) => {
      const id = x.createImageData(S, S), H = (u, v) => { let h = 0; for (let k = 1; k <= 6; k++) h += Math.sin((u * k * 1.0 + v * (7 - k)) * 6.283 + k * 1.7) / k + Math.sin((u * (k + 2) - v * k * 2) * 6.283 + k) / (k + 1); return h; };
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const u = i / S, v = j / S, e = 1 / S, dx = (H(u + e, v) - H(u - e, v)) * 0.9, dy = (H(u, v + e) - H(u, v - e)) * 0.9, o = (j * S + i) * 4;
        id.data[o] = 128 + clamp(dx * 127, -127, 127); id.data[o + 1] = 128 + clamp(dy * 127, -127, 127); id.data[o + 2] = 255; id.data[o + 3] = 255;
      } x.putImageData(id, 0, 0);
    }, false);
    wn.repeat.set(1100, 1100); const wn2 = wn.clone(); wn2.repeat.set(380, 380); wn2.needsUpdate = true;
    this.waterMat = new THREE.MeshPhysicalMaterial({ color: 0x0a2c40, roughness: 0.06, metalness: 0.0, normalMap: wn, normalScale: new THREE.Vector2(0.45, 0.45), clearcoat: 1, clearcoatRoughness: 0.08, clearcoatNormalMap: wn2, clearcoatNormalScale: new THREE.Vector2(0.3, 0.3), transparent: true, opacity: 0.94, ior: 1.33 });
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), this.waterMat);
    this.water.rotation.x = -Math.PI / 2; this.water.receiveShadow = true; scene.add(this.water);
    // distant terrain
    const N = q.farCells; this.farN = N;
    const fg = new THREE.PlaneGeometry(N * CH, N * CH, N, N); fg.rotateX(-Math.PI / 2);
    fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N + 1) * (N + 1) * 3), 3));
    this.far = new THREE.Mesh(fg, this.matFar); this.far.frustumCulled = false; scene.add(this.far);
    this.cc = { x: 1e9, z: 1e9 };
  }
  facade(regKey) {
    if (!this.facades[regKey]) { const r = region(regKey); this.facades[regKey] = facadeMaterial(this.T, { weathered: !!r.weathered, dusty: !!r.dusty }); }
    return this.facades[regKey];
  }
  grid(regKey, lot) { const k = regKey + lot; if (!this.grids[k]) this.grids[k] = new THREE.MeshStandardMaterial({ map: gridTexture(lot, region(regKey)), roughness: 0.88 }); return this.grids[k]; }
  // called after travel: switch the real-city layer on or off
  setCity(c) {
    if (c) {
      const reg = region(c.region); this.cityMats = cityMaterials(reg, c.region); this.cityMats.ground.userData.u.tMask.value = maskTexture(c);
      this.cityMats.ground.userData.u.uMaskO.value.set(c.x0, c.z0, c.mr, 0);
      c.bridges = bridgeSolids(c); c.hidden = Landmarks.hiddenBuildings(c);
    } else this.cityMats = null;
  }

  // ---------- generation ----------
  groundColor(x, z, h, slope, out) {
    const lat = Geo.toLat(z), lon = Geo.toLon(x); Geo.color(lat, lon, out);
    const n = 0.86 + 0.28 * fbm((Geo.ox * CH + x) / 140, (Geo.oz * CH + z) / 140, 3);
    out[0] = out[0] * 1.35 * n + 0.03; out[1] = out[1] * 1.3 * n + 0.035; out[2] = out[2] * 1.2 * n + 0.02;
    const rock = smooth(0.55, 1.1, slope), sand = (1 - smooth(0.4, 3.2, h)) * (h > -4 ? 1 : 0.3), snow = smooth(0, 500, h - (4700 - Math.abs(lat) * 62));
    const mix = (r, g, b, t) => { out[0] = lerp(out[0], r, t); out[1] = lerp(out[1], g, t); out[2] = lerp(out[2], b, t); };
    mix(0.36, 0.34, 0.32, rock); mix(0.74, 0.68, 0.5, sand); mix(0.93, 0.95, 0.98, snow * (1 - rock * 0.5));
    return out;
  }
  genChunk(cx, cz) {
    const x0 = cx * CH, z0 = cz * CH, mid = Geo.urbanLL(Geo.toLat(z0 + CH / 2), Geo.toLon(x0 + CH / 2));
    const ax = Geo.ox + cx, az = Geo.oz + cz, R = rng((hash2(ax, az, Math.round(Geo.band * 1000)) * 4294967296) | 0);
    const inCity = City.chunkInside(cx, cz);
    const regKey = inCity ? City.active.region : regionFor(mid.city ? mid.city[4] : '', Geo.toLat(z0));
    const ch = { cx, cz, x0, z0, u: mid.u, tier: mid.tier, city: mid.city, urban: inCity || mid.u > 0.1, real: inCity, regKey, boxes: [], foot: [], props: [], orbs: [], marks: [], ground: null, bmesh: null, extra: [] };
    for (const L of Landmarks.inChunk(cx, cz)) ch.marks.push(L);
    if (inCity) this.genCity(ch, R);
    else if (ch.urban) this.genGrid(ch, R, mid);
    else this.genRural(ch, R);
    for (const L of ch.marks) for (const s of L.solids) ch.boxes.push(s);
    return ch;
  }
  genRural(ch, R) {
    const col = [0, 0, 0]; Geo.color(Geo.toLat(ch.z0 + CH / 2), Geo.toLon(ch.x0 + CH / 2), col);
    const green = clamp((col[1] - Math.max(col[0], col[2])) * 9 + 0.25 - Math.max(0, col[0] - 0.35) * 2, 0, 1), lat = Math.abs(Geo.toLat(ch.z0));
    const n = Math.round(green * this.q.treeDensity * (0.5 + R()));
    for (let i = 0; i < n; i++) {
      const tx = ch.x0 + R() * CH, tz = ch.z0 + R() * CH, h = Geo.height(tx, tz); if (h < 1.5 || h > 3600) continue;
      ch.props.push({ t: 20, x: tx, z: tz, s: 0.8 + R() * 0.9, sp: lat > 48 || h > 1500 || R() < 0.15 ? 'conifer' : lat < 20 && R() < 0.4 ? 'palm' : 'broadleaf', r: R() });
    }
  }
  // generated city on the block grid, in the style of the region
  genGrid(ch, R, mid) {
    const reg = region(ch.regKey), euro = ['uk', 'europe', 'france'].includes(ch.regKey), ax = Geo.ox + ch.cx, az = Geo.oz + ch.cz;
    const pick = (list) => { let t = 0; for (const w of list) t += w[3]; let r = R() * t; for (const w of list) { r -= w[3]; if (r <= 0) return w; } return list[0]; };
    const add = (x0, z0, x1, z1, h, wall, opts = {}) => {
      if (Landmarks.clearAt(ch, (x0 + x1) / 2, (z0 + z1) / 2, Math.max(x1 - x0, z1 - z0) / 2)) return;
      const g = Geo.height((x0 + x1) / 2, (z0 + z1) / 2); if (g < 0.6) return;
      const col = new THREE.Color(wall[2][Math.floor(R() * wall[2].length)]).multiplyScalar(0.92 + R() * 0.16);
      let roof = 0; if (h < 16 && R() < reg.pitched) roof = R() < 0.6 ? 1 : 2; if (reg.mansard && h > 14 && h < 30 && R() < 0.85) roof = 5;
      ch.foot.push({ rings: [[x0, z0, x1, z0, x1, z1, x0, z1]], y0: g - 4, y1: g + h, g, col, roofCol: new THREE.Color(reg.roofs[Math.floor(R() * reg.roofs.length)]), style: wall[0], tex: wall[1], seed: R(), shop: opts.shop, roof });
      ch.boxes.push({ minx: x0, maxx: x1, minz: z0, maxz: z1, miny: g - 4, maxy: g + h + (roof ? 3 : 0.9) });
      return ch.boxes[ch.boxes.length - 1];
    };
    for (let b = 0; b < 4; b++) {
      const bx = ch.x0 + (b & 1) * BLOCK, bz = ch.z0 + (b >> 1) * BLOCK, mx = bx + BLOCK / 2, mz = bz + BLOCK / 2;
      if (Geo.height(mx, mz) < 0.8) continue;
      const u = clamp(Geo.urban(mx, mz) + (R() - 0.5) * 0.12, 0, 1);
      for (const [lx, lz] of [[bx + ROAD + 1.2, bz + ROAD + 1.2], [bx + BLOCK - ROAD - 1.2, bz + BLOCK - ROAD - 1.2]]) ch.props.push({ t: 1, x: lx, z: lz, r: R() });
      const s0 = bx + INSET, s1 = bx + BLOCK - INSET, t0 = bz + INSET, t1 = bz + BLOCK - INSET, span = s1 - s0;
      if (R() < 0.07 + (u < 0.3 ? 0.08 : 0)) {          // park
        for (let i = 0; i < 12; i++) ch.props.push({ t: 20, x: s0 + R() * span, z: t0 + R() * span, s: 0.8 + R() * 0.6, sp: reg.trees, r: R() });
        for (let i = 0; i < 3; i++) ch.props.push({ t: 2, x: s0 + 4 + R() * (span - 8), z: t0 + 4 + R() * (span - 8), rot: R() * 6, r: R() });
        continue;
      }
      const maxH = 9 + Math.pow(mid.tier, 1.5) * 360 * Math.pow(u, 2.3);
      if (euro) {
        // perimeter block: a continuous street wall of narrow buildings around a courtyard
        const n0 = ch.foot.length, fw = ch.regKey === 'uk' ? 6 : 13, depth = ch.regKey === 'uk' ? 11 : 15, base = ch.regKey === 'france' ? 18 + R() * 6 : ch.regKey === 'uk' ? (u > 0.6 ? 15 : 11) : (u > 0.5 ? 17 + R() * 5 : 12 + R() * 4), wall = pick(reg.walls);
        for (let side = 0; side < 4; side++) {
          let s = s0 + (side % 2 ? depth : 0); const end = s1 - (side % 2 ? depth : 0);
          while (s < end - 3) {
            const w = Math.min(fw * (0.8 + R() * 0.5), end - s), h = Math.max(6, base + (R() - 0.5) * 5 + (R() < 0.08 ? 6 : 0));
            const ww = R() < 0.25 ? pick(reg.walls) : wall, shop = u > 0.4 && R() < 0.55;
            const k0 = ch.foot.length;
            if (side === 0) add(s, t0, s + w, t0 + depth, h, ww, { shop }); else if (side === 2) add(s, t1 - depth, s + w, t1, h, ww, { shop });
            else if (side === 1) add(s1 - depth, s, s1, s + w, h, ww, { shop }); else add(s0, s, s0 + depth, s + w, h, ww, { shop });
            if (ch.foot.length > k0) ch.foot[ch.foot.length - 1].perim = true;
            s += w;
          }
        }
        // distant version: each side of the block as one building of average height
        const side = ch.foot.slice(n0); if (!ch.footFar) ch.footFar = [];
        if (side.length) { const avg = side.reduce((a, f) => a + f.y1 - f.g, 0) / side.length, f0 = side[0], g = f0.g;
          for (const [x0, z0, x1, z1] of [[s0, t0, s1, t0 + depth], [s0, t1 - depth, s1, t1], [s1 - depth, t0 + depth, s1, t1 - depth], [s0, t0 + depth, s0 + depth, t1 - depth]]) ch.footFar.push({ ...f0, rings: [[x0, z0, x1, z0, x1, z1, x0, z1]], y1: g + avg, roof: 0, shop: false }); }
        if (R() < 0.6) for (let i = 0; i < 2; i++) ch.props.push({ t: 20, x: mx + (R() - 0.5) * 20, z: mz + (R() - 0.5) * 20, s: 0.7 + R() * 0.4, sp: reg.trees, r: R() });
        continue;
      }
      const n = u > 0.72 ? (R() < 0.45 ? 1 : 2) : u > 0.36 ? 2 : ch.regKey === 'india' ? 3 : 3, ls = span / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        if (R() < 0.06) continue;
        const lx = s0 + (i + 0.5) * ls, lz = t0 + (j + 0.5) * ls;
        if (n === 3 && ch.regKey !== 'india') {
          const w = 8 + R() * 5, d = 8 + R() * 4, h = 3.2 + (R() < 0.4 ? 3 : 0);
          add(lx - w / 2, lz - d / 2, lx + w / 2, lz + d / 2, h, pick(reg.walls));
          if (R() < 0.7) ch.props.push({ t: 20, x: lx + (R() - 0.5) * (ls - 4), z: lz + ls * 0.38, s: 0.6 + R() * 0.4, sp: reg.trees, r: R() });
          continue;
        }
        const pad = 1.5 + R() * 3, w = ls - pad * 2 - R() * 4, d = ls - pad * 2 - R() * 4;
        let h = (ch.regKey === 'india' ? 10 : 9) + maxH * Math.pow(R(), n === 1 ? 1.3 : 2.4); h = Math.round(h / 3.3) * 3.3;
        const wall = h > 45 ? pick(reg.tall) : pick(reg.walls), shop = h < 40 && u > 0.35 && R() < 0.6;
        if (h > 70 && R() < 0.6) {   // setback tower
          let y = 0; const tiers = [[w, d, h * 0.6], [w * 0.76, d * 0.76, h * 0.26], [w * 0.5, d * 0.5, h * 0.14]];
          for (const [tw, td, th] of tiers) { const bx2 = add(lx - tw / 2, lz - td / 2, lx + tw / 2, lz + td / 2, y + th, wall, { shop: !y && shop }); if (bx2 && y) { const f = ch.foot[ch.foot.length - 1]; f.y0 = f.g + y; bx2.miny = f.g + y; } y += th; }
        } else add(lx - w / 2, lz - d / 2, lx + w / 2, lz + d / 2, h, wall, { shop });
        if (h > 55 && R() < 0.3) { const id = ax + '.' + az + '.' + b + i + j, bb = ch.boxes[ch.boxes.length - 1]; if (bb && !this.collected.has(id)) ch.orbs.push([lx, bb.maxy + 2.2, lz, id]); }
      }
      if (u < 0.75) for (let i = 0; i < 3; i++) if (R() < 0.6) ch.props.push({ t: 20, x: bx + ROAD + 1.6, z: bz + 20 + i * 26, s: 0.7 + R() * 0.3, sp: reg.trees, r: R() });
    }
  }
  // chunk of a real city
  genCity(ch, R) {
    const c = City.active, k = ch.cx + ',' + ch.cz, B = c.b, reg = region(c.region);
    for (const i of c.bOver.get(k) || []) if (!c.hidden.has(i)) ch.boxes.push(City.solid(i));
    for (const s of c.bridges.get(k) || []) ch.boxes.push(s);
    // real street furniture and trees
    const P = c.p, lamps = [];
    for (const i of c.pHome.get(k) || []) { const t = P.t[i], x = P.v[i * 2], z = P.v[i * 2 + 1]; if (t === 1) lamps.push(x, z); ch.props.push({ t, x, z, s: 0.75 + R() * 0.5, sp: reg.trees, r: R(), real: true }); }
    // fill in lamps along streets where the map has none, on the correct side for driving
    const Rr = c.r; const near = (x, z, d) => { for (let i = 0; i < lamps.length; i += 2) if ((lamps[i] - x) ** 2 + (lamps[i + 1] - z) ** 2 < d * d) return true; return false; };
    for (const e of c.eHome.get(k) || []) {
      const cls = Rr.cls[e]; if (cls < 1 || cls > 7 || (Rr.flags[e] & 2) || Rr.len[e] < 12) continue;
      const w = [0, 15, 13, 11.5, 10, 8.5, 7, 6][cls], o = {}, step = cls <= 3 ? 26 : 32;
      for (let s = 8, side = 1; s < Rr.len[e] - 6; s += step, side = -side) {
        City.along(e, s, 1, side * (w / 2 + 0.9), o); if (near(o.x, o.z, 14)) continue;
        if (City.maskAt(o.x, o.z) === 0) continue; lamps.push(o.x, o.z); ch.props.push({ t: 1, x: o.x, z: o.z, rot: Math.atan2(-o.hz * side, o.hx * side) + Math.PI / 2, r: R() });
      }
    }
    // traffic signals stand at the kerb, not in the middle of the junction
    for (const p of ch.props) if (p.t === 6) { let best = null, bd = 1e9; for (const e of c.eOver.get(k) || []) { if (Rr.cls[e] > 8 || !Rr.cls[e]) continue; for (let j = Rr.ps[e]; j < Rr.ps[e + 1] - 1; j++) { const ax = Rr.v[j * 2], az = Rr.v[j * 2 + 1], bx = Rr.v[j * 2 + 2], bz = Rr.v[j * 2 + 3], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = clamp(((p.x - ax) * dx + (p.z - az) * dz) / (l || 1), 0, 1), qx = ax + dx * t, qz = az + dz * t, d = (qx - p.x) ** 2 + (qz - p.z) ** 2; if (d < bd) { bd = d; const L = Math.sqrt(l) || 1; best = { qx, qz, nx: -dz / L, nz: dx / L, w: [0, 15, 13, 11.5, 10, 8.5, 7, 6, 4.5][Rr.cls[e]] }; } } } if (best && bd < 400) { const sgn = ((p.x - best.qx) * best.nx + (p.z - best.qz) * best.nz) >= 0 ? 1 : -1; p.x = best.qx + best.nx * sgn * (best.w / 2 + 0.6); p.z = best.qz + best.nz * sgn * (best.w / 2 + 0.6); p.rot = Math.atan2(best.nx * sgn, best.nz * sgn); } }
    // trees fill parks and woods
    for (let i = 0; i < 26; i++) {
      const x = ch.x0 + R() * CH, z = ch.z0 + R() * CH, m = City.maskAt(x, z);
      if ((m === 2 && R() < 0.45) || m === 5) { let blocked = false; for (const b of ch.boxes) if (x > b.minx - 2 && x < b.maxx + 2 && z > b.minz - 2 && z < b.maxz + 2 && insideSolid(b, x, z)) { blocked = true; break; } if (!blocked) ch.props.push({ t: 20, x, z, s: 0.8 + R() * 0.6, sp: reg.trees, r: R() }); }
    }
    // signal shards on some of the taller rooftops
    for (const i of c.bHome.get(k) || []) if (B.hgt[i] > 45 && hash2(i, 7, 3) < 0.25 && !c.hidden.has(i)) { const id = c.zone.key + i; if (!this.collected.has(id)) ch.orbs.push([(B.box[i * 4] + B.box[i * 4 + 2]) / 2 + c.ox, BASE + B.hgt[i] + 2.2, (B.box[i * 4 + 1] + B.box[i * 4 + 3]) / 2 + c.oz, id]); }
  }
  // merged mesh of every building in the chunk
  buildBuildings(ch, far) {
    const mb = new MeshBuilder(); let n = 0; const tops = [];
    if (ch.real) {
      const c = City.active, B = c.b, reg = region(c.region), k = ch.cx + ',' + ch.cz;
      for (const i of c.bHome.get(k) || []) {
        if (c.hidden.has(i)) continue;
        const rings = []; for (let r = B.ringStart[i]; r < B.ringStart[i + 1]; r++) { const o = B.rings[r * 2], m = B.rings[r * 2 + 1]; rings.push(B.v.subarray(o * 2, (o + m) * 2)); }
        const look = this.realLook(c, reg, i);
        mb.building({ rings, y0: BASE + (B.minh[i] > 0.5 ? B.minh[i] : -4), y1: BASE + B.hgt[i], g: BASE, col: look.col, roofCol: look.roof, style: look.style, tex: look.tex, seed: hash2(i, 3, 1), shop: look.shop, roof: B.roof[i], parapet: !far });
        n++;
        if (!far && reg.tanks && B.hgt[i] < 45 && !B.roof[i]) { const w = B.box[i * 4 + 2] - B.box[i * 4], d = B.box[i * 4 + 3] - B.box[i * 4 + 1], k = Math.floor(Math.min(3, w * d / 120)); for (let t = 0; t < k; t++) { const tx = B.box[i * 4] + c.ox + w * (0.3 + 0.4 * hash2(i, t, 1)), tz = B.box[i * 4 + 1] + c.oz + d * (0.3 + 0.4 * hash2(i, t, 2)); if (rings.length === 1 && insideSolid({ rings }, tx, tz)) tops.push([tx, BASE + B.hgt[i], tz, 0]); } }
        if (!far && c.region === 'uk' && B.roof[i] && B.hgt[i] < 20) { const cx2 = (B.box[i * 4] + B.box[i * 4 + 2]) / 2 + c.ox, cz2 = (B.box[i * 4 + 1] + B.box[i * 4 + 3]) / 2 + c.oz; if (hash2(i, 5, 5) < 0.8) tops.push([cx2 + (hash2(i, 1, 9) - 0.5) * 3, BASE + B.hgt[i] + 1.2, cz2 + (hash2(i, 2, 9) - 0.5) * 3, 1]); }
      }
    } else {
      // far chunks: merged perimeter blocks plus any detached buildings
      const list = far && ch.footFar ? ch.footFar.concat(ch.foot.filter(f => !f.perim)) : ch.foot;
      for (const f of list) { mb.building({ ...f, parapet: !far && f.parapet }); n++; }
    }
    if (!n || mb.empty) return null;
    const m = new THREE.Mesh(mb.geometry(), this.facade(ch.regKey)); m.castShadow = true; m.receiveShadow = true;
    if (tops.length) {
      if (!this.topGeo) { this.topGeo = [new THREE.CylinderGeometry(0.75, 0.8, 1.5, 14).translate(0, 0.75, 0), new THREE.BoxGeometry(0.7, 2.4, 1.4).translate(0, 1.2, 0)]; this.topMat = [new THREE.MeshStandardMaterial({ color: 0x1a1b1c, roughness: 0.5 }), new THREE.MeshStandardMaterial({ color: 0x7a4a3a, roughness: 0.9 })]; }
      for (const kind of [0, 1]) { const list = tops.filter(t => t[3] === kind); if (!list.length) continue; const im = new THREE.InstancedMesh(this.topGeo[kind], this.topMat[kind], list.length), mx = new THREE.Matrix4(); list.forEach((t, j) => { mx.makeTranslation(t[0], t[1], t[2]); im.setMatrixAt(j, mx); }); im.castShadow = true; im.computeBoundingSphere(); m.add(im); }
    }
    return m;
  }
  // how a real building should look: its mapped colour/material where known, else typical for the city
  realLook(c, reg, i) {
    const B = c.b, h = B.hgt[i], cls = B.cls[i], mat = B.mat[i], r = hash2(i, 11, 5), r2 = hash2(i, 13, 9);
    const area = (B.box[i * 4 + 2] - B.box[i * 4]) * (B.box[i * 4 + 3] - B.box[i * 4 + 1]);
    const list = h > 42 || (cls === 4 && h > 24) ? reg.tall : reg.walls;
    let t = 0; for (const w of list) t += w[3]; let x = r * t, wall = list[0]; for (const w of list) { x -= w[3]; if (x <= 0) { wall = w; break; } }
    let style = wall[0], tex = wall[1], col = new THREE.Color(wall[2][Math.floor(r2 * wall[2].length)]);
    if (mat === 1) { tex = 0; if (style > 1) style = c.region === 'india' ? 4 : 0; col.setHex([0x8a5a44, 0x9b6b4f, 0x7a4d3a, 0xa88a6a][Math.floor(r2 * 4)]); }
    else if (mat === 2) { tex = 1; if (style === 0 || style === 2) style = 1; col.setHex([0xd9d2c0, 0xcfc6b0, 0xc9b896][Math.floor(r2 * 3)]); }
    else if (mat === 3) { tex = 2; if (style === 2) style = 1; }
    else if (mat === 5) { style = 2; tex = 4; }
    else if (mat === 4) { tex = 3; if (style === 0) style = 3; }
    if (B.col[i]) { const v = B.col[i]; col.setRGB(((v >> 11) & 31) / 31, ((v >> 5) & 63) / 63, (v & 31) / 31, THREE.SRGBColorSpace); }
    const nm = B.name[i] ? c.names[B.name[i]] : '';
    if (nm && /Palace|Parliament|Abbey|Cathedral|Museum|Gallery|Terminus|Station|Town Hall|University|High Court|Library|Admiralty|Treasury|Foreign/.test(nm) && h < 60) { style = c.region === 'india' ? 5 : 1; tex = 1; col.setHex(c.region === 'india' ? 0xc9a77a : 0xe2dccb); }
    if (cls === 5) { style = 7; tex = 1; }
    if (cls === 6 && h < 40 && (c.region === 'uk' || c.region === 'india')) { style = c.region === 'india' ? 5 : 1; tex = 1; }
    if (cls === 7) style = 6;
    if (cls === 8 || h < 5) style = 8;
    if (c.region === 'india' && area < 70 && h < 8) { style = 8; col.setHex([0x8a8f96, 0x5f7a9a, 0xb0a890, 0x9a6a5a, 0x7a8a9a][Math.floor(r2 * 5)]); tex = 3; }
    col.multiplyScalar(0.92 + r * 0.16);
    const roof = new THREE.Color(B.roof[i] ? reg.roofs[Math.floor(r * reg.roofs.length)] : (c.region === 'india' ? 0x8a8478 : 0x6a6a68));
    return { style, tex, col, roof, shop: cls === 3 || (h < 30 && h > 7 && r2 < (c.region === 'india' ? 0.55 : 0.3) && cls !== 1 && cls !== 5) };
  }
  buildGround(ch) {
    const real = ch.real, N = real ? 24 : this.q.groundSeg, g = new THREE.PlaneGeometry(CH, CH, N, N); g.rotateX(-Math.PI / 2);
    const p = g.attributes.position, uv = g.attributes.uv, col = new Float32Array(p.count * 3), c = [0, 0, 0];
    for (let i = 0; i < p.count; i++) {
      const lx = p.getX(i) + CH / 2, lz = p.getZ(i) + CH / 2, x = ch.x0 + lx, z = ch.z0 + lz, h = Geo.height(x, z);
      p.setXYZ(i, lx, h, lz); uv.setXY(i, lx / BLOCK, -lz / BLOCK);
      if (!ch.urban) { const s = Math.abs(Geo.height(x + 6, z) - h) / 6 + Math.abs(Geo.height(x, z + 6) - h) / 6; this.groundColor(x, z, h, s, c); col.set(c, i * 3); }
    }
    if (!ch.urban) { g.setAttribute('color', new THREE.BufferAttribute(col, 3)); for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 8, uv.getY(i) * 8); }
    g.computeVertexNormals();
    const mat = real ? this.cityMats.ground : ch.urban ? this.grid(ch.regKey, ch.u > 0.36 ? '#7a7870' : '#56703f') : this.matRural;
    const m = new THREE.Mesh(g, mat); m.position.set(ch.x0, 0, ch.z0); m.receiveShadow = true; g.computeBoundingSphere();
    ch.ground = m; this.scene.add(m);
    if (real) for (const s of streetMeshes(ch.cx, ch.cz, this.cityMats)) { ch.extra.push(s); this.scene.add(s); }
  }
  dropGround(ch) {
    if (ch.ground) { this.scene.remove(ch.ground); ch.ground.geometry.dispose(); ch.ground = null; }
    for (const m of ch.extra) { this.scene.remove(m); m.geometry.dispose(); } ch.extra.length = 0;
  }
  dropBuildings(ch) { if (ch.bmesh) { this.scene.remove(ch.bmesh); ch.bmesh.geometry.dispose(); ch.bmesh = null; } if (ch.orbMesh) { this.scene.remove(ch.orbMesh); ch.orbMesh = null; } for (const L of ch.marks) if (L.group) this.scene.remove(L.group); }

  // ---------- streaming ----------
  update(px, pz, budgetMs = 6) {
    const cx = Math.floor(px / CH), cz = Math.floor(pz / CH), Rb = this.q.buildR, Rg = this.q.groundR;
    if (cx !== this.cc.x || cz !== this.cc.z) {
      this.cc = { x: cx, z: cz }; this.queue.length = 0;
      for (const [k, ch] of this.chunks) {
        const d = Math.max(Math.abs(ch.cx - cx), Math.abs(ch.cz - cz));
        if (d > Rb + 1) { this.dropGround(ch); this.dropBuildings(ch); G.props && G.props.dropChunk(ch); this.chunks.delete(k); }
        else { if (d > Rg + 1) this.dropGround(ch); if (ch.bmesh && (d > 3) !== ch.farMesh) { this.dropBuildings(ch); ch.built = false; } }
      }
      for (let r = 0; r <= Rb; r++) for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) {
        if (Math.max(Math.abs(i), Math.abs(j)) !== r) continue;
        const ch = this.chunks.get(key(cx + i, cz + j)); if (!ch || !ch.built || (r <= Rg && !ch.ground)) this.queue.push([cx + i, cz + j, r]);
      }
      this.updateFar(cx, cz); G.props && G.props.recenter(cx, cz);
    }
    const t0 = performance.now();
    while (this.queue.length && performance.now() - t0 < budgetMs) {
      const [x, z, r] = this.queue.shift(), k = key(x, z); let ch = this.chunks.get(k);
      if (!ch) { ch = this.genChunk(x, z); this.chunks.set(k, ch); G.props && G.props.addChunk(ch, r); }
      if (!ch.built) {
        ch.built = true; ch.farMesh = r > 3; ch.bmesh = this.buildBuildings(ch, ch.farMesh); if (ch.bmesh) this.scene.add(ch.bmesh);
        for (const L of ch.marks) { if (!L.group) L.group = L.build(); this.scene.add(L.group); }
        if (ch.orbs.length) this.buildOrbs(ch);
      }
      if (r <= Rg && !ch.ground) this.buildGround(ch);
    }
    this.water.position.set(Math.round(px / 36.4) * 36.4, 0, Math.round(pz / 36.4) * 36.4);
    for (let i = this.dyn.length - 1; i >= 0; i--) if (this.dyn[i].until < G.time) { const d = this.dyn[i]; if (d.mesh) { this.scene.remove(d.mesh); } this.dyn.splice(i, 1); }
  }
  buildOrbs(ch) {
    if (ch.orbMesh) this.scene.remove(ch.orbMesh);
    const m = new THREE.InstancedMesh(this.orbGeo, this.orbMat, ch.orbs.length), mx = new THREE.Matrix4();
    ch.orbs.forEach((o, i) => { mx.makeTranslation(o[0], o[1], o[2]); m.setMatrixAt(i, mx); }); m.frustumCulled = false; ch.orbMesh = m; this.scene.add(m);
  }
  loadAll(px, pz) { this.cc = { x: 1e9, z: 1e9 }; this.update(px, pz, 1e9); }
  reset() { for (const ch of this.chunks.values()) { this.dropGround(ch); this.dropBuildings(ch); } G.props && G.props.clear(); this.chunks.clear(); this.queue.length = 0; this.cc = { x: 1e9, z: 1e9 }; for (const d of this.dyn) if (d.mesh) this.scene.remove(d.mesh); this.dyn.length = 0; }
  updateFar(cx, cz) {
    const N = this.farN, g = this.far.geometry, p = g.attributes.position, col = g.attributes.color, c = [0, 0, 0], Rg = this.q.groundR;
    this.far.position.set((cx + 0.5) * CH - CH / 2, 0, (cz + 0.5) * CH - CH / 2);
    const ox = this.far.position.x, oz = this.far.position.z;
    for (let i = 0; i < p.count; i++) {
      const x = ox + p.getX(i), z = oz + p.getZ(i), h = Geo.height(x, z), u = Geo.urban(x, z);
      const near = Math.max(Math.abs(x / CH - cx - 0.5), Math.abs(z / CH - cz - 0.5)) < Rg - 0.6;
      p.setY(i, near ? h - 60 : h - 1.5);
      this.groundColor(x, z, h, 0, c); const t = smooth(0.1, 0.4, u);
      col.setXYZ(i, lerp(c[0], 0.36, t), lerp(c[1], 0.36, t), lerp(c[2], 0.36, t));
    }
    p.needsUpdate = true; col.needsUpdate = true; g.computeVertexNormals();
  }
  setLighting(night, blackout) {
    const on = blackout ? 0 : 1, wet = G.sky.wet || 0;
    for (const m of Object.values(this.facades)) { const u = m.userData.u; u.uLit.value = on * lerp(0.05, 0.45, night); u.uGlow.value = on * lerp(0.0, 2.2, night); u.uWet.value = wet; }
    if (this.cityMats) this.cityMats.road.userData.u.uWet.value = wet;
    for (const m of Object.values(this.grids)) m.roughness = lerp(0.88, 0.3, wet);
    this.waterMat.normalMap.offset.set(G.time * 0.004, G.time * 0.0027); this.waterMat.clearcoatNormalMap.offset.set(-G.time * 0.006, G.time * 0.0041);
    for (const ch of this.chunks.values()) if (ch.orbMesh) ch.orbMesh.rotation.y = 0;
    G.props && G.props.setLighting(night, blackout);
  }

  // ---------- queries ----------
  chunkAt(x, z) { return this.chunks.get(key(Math.floor(x / CH), Math.floor(z / CH))); }
  isRoadChunk(x, z) { const c = this.chunkAt(x, z); return !!(c && c.urban && !c.real && Geo.height(x, z) > 0.8); }
  forBoxes(minx, minz, maxx, maxz, cb) {
    const st = ++this.stamp;
    for (let cx = Math.floor(minx / CH); cx <= Math.floor(maxx / CH); cx++) for (let cz = Math.floor(minz / CH); cz <= Math.floor(maxz / CH); cz++) {
      const ch = this.chunks.get(key(cx, cz)); if (!ch) continue;
      for (const b of ch.boxes) if (b._q !== st && b.maxx > minx && b.minx < maxx && b.maxz > minz && b.minz < maxz) { b._q = st; cb(b); }
    }
    for (const b of this.dyn) if (b.solid && b.maxx > minx && b.minx < maxx && b.maxz > minz && b.minz < maxz) cb(b);
  }
  // Move a vertical cylinder out of buildings, street furniture and onto the ground. Mutates p and v.
  collide(p, r, h, v, out, noProps) {
    out.grounded = false; out.wall = null; out.box = null; out.water = false;
    this.forBoxes(p.x - r, p.z - r, p.x + r, p.z + r, b => {
      if (p.y >= b.maxy || p.y + h <= b.miny) return;
      const inside = insideSolid(b, p.x, p.z), d2 = nearestWall(b, p.x, p.z, _n);
      if (!inside && d2 >= r * r) return;
      if (p.y > b.maxy - 0.7 - Math.max(0, -v.y) * 0.035 && v.y <= 0.5 && (inside || d2 < r * r * 0.25)) { p.y = b.maxy; if (v.y < 0) v.y = 0; out.grounded = true; out.box = b; return; }
      let ox = p.x - _n.x, oz = p.z - _n.z; const d = Math.sqrt(d2) || 1e-6; ox /= d; oz /= d;
      if (inside) { ox = -ox; oz = -oz; p.x = _n.x + ox * r; p.z = _n.z + oz * r; } else { p.x = _n.x + ox * r; p.z = _n.z + oz * r; }
      const vn = v.x * ox + v.z * oz; if (vn < 0) { v.x -= vn * ox; v.z -= vn * oz; }
      out.wall = { x: ox, z: oz, box: b };
    });
    if (G.props && !noProps) G.props.collide(p, r, h, v, out);
    const g = Geo.height(p.x, p.z);
    if (p.y <= g) { p.y = g; if (v.y < 0) v.y = 0; out.grounded = true; }
    out.ground = g; return out;
  }
  // First hit along a ray against buildings and terrain.
  raycast(o, d, max, hit = {}) {
    let best = max, nx = 0, ny = 0, nz = 0, box = null;
    const ex = o.x + d.x * max, ez = o.z + d.z * max;
    this.forBoxes(Math.min(o.x, ex), Math.min(o.z, ez), Math.max(o.x, ex), Math.max(o.z, ez), b => {
      if (b.rings) { const t = rayPrism(b, o, d, best, _rn); if (t >= 0 && t < best) { best = t; nx = _rn.x; ny = _rn.y; nz = _rn.z; box = b; } return; }
      let t0 = 0, t1 = best, ax = -1, sg = 0;
      for (let a = 0; a < 3; a++) {
        const oo = a === 0 ? o.x : a === 1 ? o.y : o.z, dd = a === 0 ? d.x : a === 1 ? d.y : d.z, mn = a === 0 ? b.minx : a === 1 ? b.miny : b.minz, mx = a === 0 ? b.maxx : a === 1 ? b.maxy : b.maxz;
        if (Math.abs(dd) < 1e-8) { if (oo < mn || oo > mx) return; continue; }
        let ta = (mn - oo) / dd, tb = (mx - oo) / dd, s = -1; if (ta > tb) { const t = ta; ta = tb; tb = t; s = 1; }
        if (ta > t0) { t0 = ta; ax = a; sg = s; } if (tb < t1) t1 = tb; if (t0 > t1) return;
      }
      if (ax >= 0 && t0 < best) { best = t0; nx = ax === 0 ? sg : 0; ny = ax === 1 ? sg : 0; nz = ax === 2 ? sg : 0; box = b; }
    });
    let t = 0, step = 3, prev = 0;
    while (t < best) {
      if (o.y + d.y * t < Geo.height(o.x + d.x * t, o.z + d.z * t)) {
        let a = prev, b2 = t; for (let i = 0; i < 6; i++) { const m = (a + b2) / 2; if (o.y + d.y * m < Geo.height(o.x + d.x * m, o.z + d.z * m)) b2 = m; else a = m; }
        best = b2; nx = 0; ny = 1; nz = 0; box = null; break;
      }
      prev = t; t += step; step = Math.min(step * 1.15, 14);
    }
    hit.hit = best < max; hit.t = best; hit.x = o.x + d.x * best; hit.y = o.y + d.y * best; hit.z = o.z + d.z * best; hit.nx = nx; hit.ny = ny; hit.nz = nz; hit.box = box;
    return hit;
  }
  los(a, b) { const d = _d.set(b.x - a.x, b.y - a.y, b.z - a.z), l = d.length(); if (l < 0.01) return true; d.multiplyScalar(1 / l); return !this.raycast(a, d, l - 0.5, _h).hit; }
  collectOrbs(p) {
    const ch = this.chunkAt(p.x, p.z); if (!ch) return 0; let n = 0;
    for (let i = ch.orbs.length - 1; i >= 0; i--) { const o = ch.orbs[i]; if (Math.abs(o[0] - p.x) < 3 && Math.abs(o[2] - p.z) < 3 && Math.abs(o[1] - p.y - 1) < 4) { this.collected.add(o[3]); ch.orbs.splice(i, 1); n++; } }
    if (n) { if (ch.orbs.length) this.buildOrbs(ch); else if (ch.orbMesh) { this.scene.remove(ch.orbMesh); ch.orbMesh = null; } try { localStorage.setItem('eh.orbs', JSON.stringify([...this.collected].slice(-4000))); } catch (e) { } }
    return n;
  }
}
const _d = new THREE.Vector3(), _h = {}, _n = {}, _rn = {};
