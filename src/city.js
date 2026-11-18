// Real cities. Each hero city is a compact file extracted from Overture Maps / OpenStreetMap
// (tools/overture/extract.py): every building footprint with its height, every street, rivers,
// coastline, parks, trees and street furniture. Loaded on travel, cached for offline play.
import { Geo, CH } from './geo.js';
import { clamp } from './util.js';

const M = 111320;
// Must match tools/overture/extract.py
export const ZONES = [
  { key: 'london', name: 'London', bbox: [-0.163, 51.488, -0.062, 51.523], region: 'uk' },
  { key: 'mumbai', name: 'Mumbai', bbox: [72.800, 18.893, 72.862, 19.030], region: 'india' },
  { key: 'newyork', name: 'New York', bbox: [-74.020, 40.700, -73.965, 40.770], region: 'us' },
  { key: 'paris', name: 'Paris', bbox: [2.280, 48.845, 2.365, 48.875], region: 'france' },
  { key: 'tokyo', name: 'Tokyo', bbox: [139.735, 35.650, 139.790, 35.700], region: 'japan' },
  { key: 'dubai', name: 'Dubai', bbox: [55.250, 25.175, 55.300, 25.215], region: 'gulf' },
  { key: 'sydney', name: 'Sydney', bbox: [151.195, -33.880, 151.225, -33.850], region: 'australia' },
];
for (const z of ZONES) { z.lat0 = (z.bbox[1] + z.bbox[3]) / 2; z.lon0 = (z.bbox[0] + z.bbox[2]) / 2; }
export const ROAD_W = [0, 15, 13, 11.5, 10, 8.5, 7, 6, 4.5, 0, 6, 2.6, 2.6];   // by class
export const DRIVABLE = c => c >= 1 && c <= 8;
export const PROP = { LAMP: 1, BENCH: 2, BOLLARD: 3, POSTBOX: 4, BUSSTOP: 5, SIGNAL: 6, HYDRANT: 7, BIN: 8, PHONE: 9, FOUNTAIN: 10, TREE: 20 };

async function gunzip(buf) {
  if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot unpack city data');
  const s = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function decodeMask(bytes, w, h) {
  const bmp = await createImageBitmap(new Blob([bytes], { type: 'image/png' }), { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(bmp, 0, 0); const d = x.getImageData(0, 0, w, h).data, out = new Uint8Array(w * h);
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4];
  return out;
}

const cache = new Map();
export const City = {
  active: null,
  zoneAt(lat, lon, margin = 0) {
    for (const z of ZONES) {
      const b = z.bbox, mx = margin / (M * Math.cos(z.lat0 * Math.PI / 180)), my = margin / M;
      if (lon > b[0] - mx && lon < b[2] + mx && lat > b[1] - my && lat < b[3] + my) return z;
    }
    return null;
  },
  async load(zone, onProgress) {
    if (cache.has(zone.key)) return cache.get(zone.key);
    const res = await fetch(`cities/${zone.key}.bin.gz`); if (!res.ok) throw new Error('City data missing for ' + zone.name);
    onProgress && onProgress('Unpacking ' + zone.name + '…');
    const u8 = await gunzip(await res.arrayBuffer()), dv = new DataView(u8.buffer);
    const hl = dv.getUint32(4, true), hdr = JSON.parse(new TextDecoder().decode(u8.subarray(8, 8 + hl)));
    let o = 8 + hl; const secs = [];
    for (const sz of hdr.sizes) { o += (4 - (o % 4)) % 4; secs.push([o, sz]); o += sz; }
    const q = 1 / hdr.q, c = { hdr, zone, name: hdr.name, region: hdr.region, drive: hdr.drive, names: hdr.names, w: hdr.w, h: hdr.h };
    // buildings
    { const [s, n] = secs[0]; let p = s; const N = hdr.counts.b;
      const roof = new Uint8Array(N), cls = new Uint8Array(N), hgt = new Float32Array(N), minh = new Float32Array(N), col = new Uint16Array(N), mat = new Uint8Array(N), name = new Uint16Array(N), ringStart = new Uint32Array(N + 1);
      const rings = [], verts = [];
      for (let i = 0; i < N; i++) {
        roof[i] = dv.getUint8(p); cls[i] = dv.getUint8(p + 1); hgt[i] = dv.getUint16(p + 2, true) / 10; minh[i] = dv.getUint16(p + 4, true) / 10; col[i] = dv.getUint16(p + 6, true); mat[i] = dv.getUint8(p + 8);
        const nr = dv.getUint8(p + 9); name[i] = dv.getUint16(p + 10, true); p += 12; ringStart[i] = rings.length / 2;
        for (let r = 0; r < nr; r++) { const nv = dv.getUint16(p, true); p += 2; rings.push(verts.length / 2, nv); for (let k = 0; k < nv; k++) { verts.push(dv.getInt16(p, true) * q, dv.getInt16(p + 2, true) * q); p += 4; } }
      }
      ringStart[N] = rings.length / 2;
      c.b = { N, roof, cls, hgt, minh, col, mat, name, ringStart, rings: Uint32Array.from(rings), local: Float32Array.from(verts) };
    }
    // roads: edges between junctions
    { const [s] = secs[1]; let p = s; const E = hdr.counts.e;
      const cls = new Uint8Array(E), flags = new Uint8Array(E), name = new Uint16Array(E), na = new Uint32Array(E), nb = new Uint32Array(E), ps = new Uint32Array(E + 1), pts = [];
      for (let i = 0; i < E; i++) {
        cls[i] = dv.getUint8(p); flags[i] = dv.getUint8(p + 1); name[i] = dv.getUint16(p + 2, true); na[i] = dv.getUint32(p + 4, true); nb[i] = dv.getUint32(p + 8, true);
        const n = dv.getUint16(p + 12, true); p += 14; ps[i] = pts.length / 2;
        for (let k = 0; k < n; k++) { pts.push(dv.getInt16(p, true) * q, dv.getInt16(p + 2, true) * q); p += 4; }
      }
      ps[E] = pts.length / 2;
      c.r = { E, cls, flags, name, na, nb, ps, local: Float32Array.from(pts), nodes: hdr.counts.n };
    }
    // props
    { const [s, n] = secs[2]; const N = n / 5; const t = new Uint8Array(N), xz = new Float32Array(N * 2);
      for (let i = 0; i < N; i++) { const p = s + i * 5; t[i] = dv.getUint8(p); xz[i * 2] = dv.getInt16(p + 1, true) * q; xz[i * 2 + 1] = dv.getInt16(p + 3, true) * q; }
      c.p = { N, t, local: xz };
    }
    const [ms, mn] = secs[3]; c.mask = await decodeMask(u8.slice(ms, ms + mn), hdr.mask.w, hdr.mask.h); c.mw = hdr.mask.w; c.mh = hdr.mask.h; c.mr = hdr.mask.r;
    this.index(c); cache.set(zone.key, c); return c;
  },
  // per-city structures that do not depend on where the game origin is
  index(c) {
    const B = c.b, R = c.r;
    for (let i = 0; i < B.N; i++) { const n = B.name[i] && c.names[B.name[i]]; if (n && NAME_HEIGHT[n] && B.hgt[i] < NAME_HEIGHT[n]) B.hgt[i] = NAME_HEIGHT[n]; }
    B.box = new Float32Array(B.N * 4);
    for (let i = 0; i < B.N; i++) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; const r0 = B.ringStart[i], o = B.rings[r0 * 2], n = B.rings[r0 * 2 + 1];
      for (let k = 0; k < n; k++) { const x = B.local[(o + k) * 2], z = B.local[(o + k) * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      B.box.set([x0, z0, x1, z1], i * 4);
    }
    // junction graph for traffic and pedestrians
    R.len = new Float32Array(R.E); R.cum = new Float32Array(R.ps[R.E]);
    const adj = Array.from({ length: R.nodes }, () => []);
    for (let e = 0; e < R.E; e++) {
      let L = 0; R.cum[R.ps[e]] = 0;
      for (let k = R.ps[e] + 1; k < R.ps[e + 1]; k++) { L += Math.hypot(R.local[k * 2] - R.local[k * 2 - 2], R.local[k * 2 + 1] - R.local[k * 2 - 1]); R.cum[k] = L; }
      R.len[e] = L;
      if (DRIVABLE(R.cls[e]) && !(R.flags[e] & 2) && L > 0.5) { adj[R.na[e]].push(e); adj[R.nb[e]].push(e); }
    }
    R.adj = adj;
  },
  // place the city in the game frame (call after Geo.setOrigin)
  attach(c) {
    this.active = c;
    if (!c) return;
    c.ox = c.zone.lon0 * M * Geo.cosB - Geo.ox * CH; c.oz = -c.zone.lat0 * M - Geo.oz * CH;
    const mv = (src) => { const d = new Float32Array(src.length); for (let i = 0; i < src.length; i += 2) { d[i] = src[i] + c.ox; d[i + 1] = src[i + 1] + c.oz; } return d; };
    c.b.v = mv(c.b.local); c.r.v = mv(c.r.local); c.p.v = mv(c.p.local);
    c.x0 = c.ox - c.w / 2; c.z0 = c.oz - c.h / 2; c.x1 = c.ox + c.w / 2; c.z1 = c.oz + c.h / 2;
    // chunk buckets
    const B = c.b, R = c.r, P = c.p, k = (x, z) => x + ',' + z;
    c.bOver = new Map(); c.bHome = new Map(); c.eOver = new Map(); c.eHome = new Map(); c.pHome = new Map();
    const add = (m, key, i) => { let a = m.get(key); if (!a) m.set(key, a = []); a.push(i); };
    for (let i = 0; i < B.N; i++) {
      const x0 = B.box[i * 4] + c.ox, z0 = B.box[i * 4 + 1] + c.oz, x1 = B.box[i * 4 + 2] + c.ox, z1 = B.box[i * 4 + 3] + c.oz;
      for (let cx = Math.floor(x0 / CH); cx <= Math.floor(x1 / CH); cx++) for (let cz = Math.floor(z0 / CH); cz <= Math.floor(z1 / CH); cz++) add(c.bOver, k(cx, cz), i);
      add(c.bHome, k(Math.floor((x0 + x1) / 2 / CH), Math.floor((z0 + z1) / 2 / CH)), i);
    }
    for (let e = 0; e < R.E; e++) {
      let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (let j = R.ps[e]; j < R.ps[e + 1]; j++) { const x = R.v[j * 2], z = R.v[j * 2 + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; }
      const pad = ROAD_W[R.cls[e]] / 2 + 4;
      for (let cx = Math.floor((x0 - pad) / CH); cx <= Math.floor((x1 + pad) / CH); cx++) for (let cz = Math.floor((z0 - pad) / CH); cz <= Math.floor((z1 + pad) / CH); cz++) add(c.eOver, k(cx, cz), e);
      const m = (R.ps[e] + R.ps[e + 1]) >> 1; add(c.eHome, k(Math.floor(R.v[m * 2] / CH), Math.floor(R.v[m * 2 + 1] / CH)), e);
    }
    for (let i = 0; i < P.N; i++) add(c.pHome, k(Math.floor(P.v[i * 2] / CH), Math.floor(P.v[i * 2 + 1] / CH)), i);
    c.solids = new Map();
  },
  inside(x, z, pad = 0) { const c = this.active; return !!c && x > c.x0 - pad && x < c.x1 + pad && z > c.z0 - pad && z < c.z1 + pad; },
  chunkInside(cx, cz) { const c = this.active; if (!c) return false; const x0 = cx * CH, z0 = cz * CH; return x0 + CH > c.x0 && x0 < c.x1 && z0 + CH > c.z0 && z0 < c.z1; },
  // ground class from the 4 m map: 0 water, 1 built-up, 2 park, 3 sand, 4 pitch, 5 wood, 6 plaza
  maskAt(x, z) {
    const c = this.active, i = Math.floor((x - c.x0) / c.mr), j = Math.floor((z - c.z0) / c.mr);
    if (i < 0 || j < 0 || i >= c.mw || j >= c.mh) return 1;
    return c.mask[j * c.mw + i];
  },
  // 0..1 how much is land here (bilinear, so banks slope)
  landAt(x, z) {
    const c = this.active, fx = (x - c.x0) / c.mr - 0.5, fz = (z - c.z0) / c.mr - 0.5, i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
    const L = (a, b) => (a < 0 || b < 0 || a >= c.mw || b >= c.mh) ? 1 : (c.mask[b * c.mw + a] ? 1 : 0);
    return (L(i, j) * (1 - tx) + L(i + 1, j) * tx) * (1 - tz) + (L(i, j + 1) * (1 - tx) + L(i + 1, j + 1) * tx) * tz;
  },
  // a collision solid per building (and bridge deck), created on demand
  solid(i) {
    const c = this.active; let s = c.solids.get(i); if (s) return s;
    const B = c.b, rings = [];
    for (let r = B.ringStart[i]; r < B.ringStart[i + 1]; r++) { const o = B.rings[r * 2], n = B.rings[r * 2 + 1]; rings.push(B.v.subarray(o * 2, (o + n) * 2)); }
    const base = BASE + (B.minh[i] > 0.5 ? B.minh[i] : -4);
    s = { minx: B.box[i * 4] + c.ox, minz: B.box[i * 4 + 1] + c.oz, maxx: B.box[i * 4 + 2] + c.ox, maxz: B.box[i * 4 + 3] + c.oz, miny: base, maxy: BASE + B.hgt[i], rings, bid: i };
    c.solids.set(i, s); return s;
  },
  roadName(x, z) {
    const c = this.active, R = c.r, list = c.eOver.get(Math.floor(x / CH) + ',' + Math.floor(z / CH)); if (!list) return '';
    let best = 0, bd = 30 * 30;
    for (const e of list) {
      if (!R.name[e]) continue;
      for (let j = R.ps[e]; j < R.ps[e + 1] - 1; j++) { const d = segD2(x, z, R.v[j * 2], R.v[j * 2 + 1], R.v[j * 2 + 2], R.v[j * 2 + 3]); if (d < bd) { bd = d; best = R.name[e]; } }
    }
    return c.names[best] || '';
  },
  // point and heading at distance s along edge e (dir +1 a->b, -1 b->a), shifted sideways by `side`
  along(e, s, dir, side, out) {
    const R = this.active.r, a = R.ps[e], b = R.ps[e + 1] - 1, L = R.len[e]; let d = dir > 0 ? clamp(s, 0, L) : clamp(L - s, 0, L);
    let j = a; while (j < b - 1 && R.cum[j + 1] < d) j++;
    const x0 = R.v[j * 2], z0 = R.v[j * 2 + 1], x1 = R.v[j * 2 + 2], z1 = R.v[j * 2 + 3], sl = R.cum[j + 1] - R.cum[j] || 1, t = (d - R.cum[j]) / sl;
    let hx = (x1 - x0) / sl, hz = (z1 - z0) / sl; if (dir < 0) { hx = -hx; hz = -hz; }
    out.x = x0 + (x1 - x0) * t - hz * side; out.z = z0 + (z1 - z0) * t + hx * side; out.hx = hx; out.hz = hz; return out;
  },
};
export const BASE = 1.0;
const NAME_HEIGHT = { 'Antilia': 173, 'Buckingham Palace': 24, 'Imperial Towers': 254, 'World One': 280 };   // ground level inside real cities
export function segD2(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz; let t = l ? ((px - ax) * dx + (pz - az) * dz) / l : 0; t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = ax + dx * t - px, z = az + dz * t - pz; return x * x + z * z;
}
