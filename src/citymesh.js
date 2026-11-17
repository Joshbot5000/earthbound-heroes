// Real-city surfaces: every street as a ribbon with the right width and markings for its class and
// country (London's double yellow lines, US double yellow centre lines...), pavements, bridges with
// parapets over the river, and ground coloured by what is really there (parks, plazas, sand, water).
import * as THREE from 'three';
import { City, ROAD_W, DRIVABLE, BASE } from './city.js';
import { CH } from './geo.js';

export function cityMaterials(reg, regionKey) {
  const R = {};
  const asphalt = regionKey === 'india' || reg.dusty ? new THREE.Color(0x4a4744) : new THREE.Color(0x2c2d30);
  R.road = new THREE.MeshStandardMaterial({ color: asphalt, roughness: 0.92, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  const ru = R.road.userData.u = { uWet: { value: 0 }, uMark: { value: regionKey === 'uk' ? 1 : regionKey === 'us' ? 2 : regionKey === 'india' ? 3 : 0 } };
  R.road.onBeforeCompile = s => {
    Object.assign(s.uniforms, ru);
    s.vertexShader = 'attribute vec4 aR; varying vec4 vR; varying vec2 vRU; varying vec3 vRW;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vR = aR; vRU = uv; vRW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = `uniform float uWet, uMark; varying vec4 vR; varying vec2 vRU; varying vec3 vRW;
      float rh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float rn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(rh(i),rh(i+vec2(1,0)),f.x), mix(rh(i+vec2(0,1)),rh(i+vec2(1,1)),f.x), f.y); }
      float ln(float x, float c, float w, float aa){ return 1.0 - smoothstep(w * 0.5 - aa, w * 0.5 + aa, abs(x - c)); }\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float cls = vR.x, len = vR.y, W = vR.z, across = (vRU.x - 0.5) * W, along = vRU.y;
        float n = rn(vRW.xz * 1.7) * 0.5 + rn(vRW.xz * 0.23) * 0.5; diffuseColor.rgb *= 0.82 + 0.3 * n;
        float rpatch = smoothstep(0.62, 0.66, rn(vRW.xz * 0.08 + 3.1)); diffuseColor.rgb *= 1.0 - rpatch * 0.18;
        float aa = fwidth(across) * 1.2 + 0.01, ends = smoothstep(5.0, 7.0, along) * smoothstep(5.0, 7.0, len - along);
        vec3 white = vec3(0.86), yel = vec3(0.86, 0.68, 0.16); float mk = 0.0; vec3 mc = white;
        if (cls < 7.5 && W > 6.0) {
          float dash = step(fract(along / 12.0), 0.4);
          if (uMark > 1.5 && uMark < 2.5 && cls < 6.5) { mk = max(ln(across, -0.18, 0.12, aa), ln(across, 0.18, 0.12, aa)); mc = yel; }
          else mk = ln(across, 0.0, 0.13, aa) * (cls < 2.5 ? 1.0 : dash) * (uMark > 2.5 ? 0.7 : 1.0);
          if (cls < 3.5 && W > 10.0) mk = max(mk, (ln(abs(across), W * 0.25, 0.11, aa)) * step(fract(along / 9.0), 0.33));
          if (uMark < 2.5 && uMark > 0.5) mk = max(mk, ln(abs(across), W * 0.5 - 0.35, 0.1, aa) * (uMark > 1.5 ? 1.0 : 0.0));
          if (uMark > 0.5 && uMark < 1.5 && cls > 3.5) { float yl = max(ln(abs(across), W * 0.5 - 0.3, 0.07, aa), ln(abs(across), W * 0.5 - 0.48, 0.07, aa)); if (yl > mk) { mk = yl; mc = yel; } }
        }
        mk *= ends * (0.75 + 0.25 * rn(vRW.xz * 3.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, mc, mk);
        diffuseColor.rgb *= 1.0 - uWet * 0.35;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.92, 0.22, uWet) - mk * 0.2;');
  };
  R.road.customProgramCacheKey = () => 'road-v1';
  R.pave = new THREE.MeshStandardMaterial({ color: reg.pave, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
  const pu = R.pave.userData.u = { uWet: ru.uWet, uIndia: { value: regionKey === 'india' ? 1 : 0 } };
  R.pave.onBeforeCompile = s => {
    Object.assign(s.uniforms, pu);
    s.vertexShader = 'attribute vec4 aR; varying vec4 vR; varying vec2 vRU; varying vec3 vRW;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vR = aR; vRU = uv; vRW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = `uniform float uWet, uIndia; varying vec4 vR; varying vec2 vRU; varying vec3 vRW; float ph(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        float W = vR.z, across = abs(vRU.x - 0.5) * W, along = vRU.y;
        vec2 q = vec2(across / (uIndia > 0.5 ? 0.25 : 0.6), along / (uIndia > 0.5 ? 0.2 : 0.9)); vec2 id = floor(q), f = fract(q);
        float joint = smoothstep(0.0, 0.04, f.x) * smoothstep(0.0, 0.04, f.y) * smoothstep(1.0, 0.96, f.x) * smoothstep(1.0, 0.96, f.y);
        diffuseColor.rgb *= (0.86 + 0.14 * joint) * (0.92 + 0.12 * ph(id + floor(vRW.xz)));
        if (uIndia > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.55, 0.3, 0.26), 0.35 * step(0.5, fract((id.x + id.y) * 0.5)));
        float kerb = smoothstep(W * 0.5 - 0.35, W * 0.5 - 0.3, across) * step(vR.x, 8.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.72, 0.71, 0.68), kerb);
        diffuseColor.rgb *= 1.0 - uWet * 0.3;`).replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(0.9, 0.35, uWet);');
  };
  R.pave.customProgramCacheKey = () => 'pave-v1';
  R.bridge = new THREE.MeshStandardMaterial({ color: regionKey === 'uk' ? 0x6f6a62 : 0x8a867e, roughness: 0.8 });
  // ground: colours from the 4 m land-use map, blended between cells
  R.ground = new THREE.MeshStandardMaterial({ roughness: 0.95 });
  const gu = R.ground.userData.u = { tMask: { value: null }, uMaskO: { value: new THREE.Vector4() }, uWet: ru.uWet,
    uCols: { value: [new THREE.Color(0x2a3a3a), new THREE.Color(reg.ground), new THREE.Color(reg.grass), new THREE.Color(0xcab88a), new THREE.Color(0x4f8f3a), new THREE.Color(reg.grass).multiplyScalar(0.7), new THREE.Color(reg.pave).multiplyScalar(1.05)] } };
  R.ground.onBeforeCompile = s => {
    Object.assign(s.uniforms, gu);
    s.vertexShader = 'varying vec3 vGW;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vGW = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = `uniform sampler2D tMask; uniform vec4 uMaskO; uniform vec3 uCols[7]; uniform float uWet; varying vec3 vGW;
      float gh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }
      vec3 cc(float k, vec2 p){ int i = int(k + 0.5); vec3 c = uCols[i];
        if (i == 2 || i == 5) c *= 0.8 + 0.35 * gn(p * 0.35) + 0.15 * gn(p * 4.0);
        else if (i == 4) c *= 0.92 + 0.12 * step(0.5, fract(p.x / 6.0));
        else if (i == 1 || i == 6) { vec2 f = fract(p / (i == 6 ? 1.2 : 0.8)); c *= (0.9 + 0.1 * smoothstep(0.0, 0.05, min(f.x, f.y))) * (0.9 + 0.15 * gn(p * 0.5)); }
        else if (i == 3) c *= 0.9 + 0.15 * gn(p * 2.0);
        return c; }\n` + s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec2 mp = (vGW.xz - uMaskO.xy) / uMaskO.z - 0.5; vec2 i0 = floor(mp), t = smoothstep(0.0, 1.0, fract(mp));
        vec2 ts = vec2(textureSize(tMask, 0));
        float a = texture2D(tMask, (i0 + 0.5) / ts).r * 255.0, b = texture2D(tMask, (i0 + vec2(1.5, 0.5)) / ts).r * 255.0;
        float c = texture2D(tMask, (i0 + vec2(0.5, 1.5)) / ts).r * 255.0, d = texture2D(tMask, (i0 + 1.5) / ts).r * 255.0;
        vec2 p = vGW.xz;
        diffuseColor.rgb = mix(mix(cc(a, p), cc(b, p), t.x), mix(cc(c, p), cc(d, p), t.x), t.y);
        diffuseColor.rgb *= 1.0 - uWet * 0.25;`);
  };
  R.ground.customProgramCacheKey = () => 'cityground-v1';
  return R;
}
export function maskTexture(c) {
  const t = new THREE.DataTexture(c.mask, c.mw, c.mh, THREE.RedFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t;
}

// ribbons along a polyline with mitred joins
function ribbon(out, pts, a, b, w, y, aR) {
  const n = b - a; if (n < 2) return;
  const base = out.p.length / 3; let along = 0;
  for (let k = 0; k < n; k++) {
    const j = a + k, x = pts[j * 2], z = pts[j * 2 + 1];
    const px = k > 0 ? pts[j * 2 - 2] : x, pz = k > 0 ? pts[j * 2 - 1] : z, nx2 = k < n - 1 ? pts[j * 2 + 2] : x, nz2 = k < n - 1 ? pts[j * 2 + 3] : z;
    if (k > 0) along += Math.hypot(x - px, z - pz);
    let d1x = x - px, d1z = z - pz, d2x = nx2 - x, d2z = nz2 - z; const l1 = Math.hypot(d1x, d1z) || 1, l2 = Math.hypot(d2x, d2z) || 1;
    d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2; if (k === 0) { d1x = d2x; d1z = d2z; } if (k === n - 1) { d2x = d1x; d2z = d1z; }
    let tx = d1x + d2x, tz = d1z + d2z; const tl = Math.hypot(tx, tz) || 1; tx /= tl; tz /= tl;
    const mx = -tz, mz = tx, dot = Math.max(0.35, mx * -d1z + mz * d1x), hw = w / 2 / dot;
    out.p.push(x - mx * hw, y, z - mz * hw, x + mx * hw, y, z + mz * hw);
    out.uv.push(0, along, 1, along); out.r.push(...aR, ...aR);
  }
  const L = along; for (let k = 0; k < n; k++) { out.r[(base + k * 2) * 4 + 1] = L; out.r[(base + k * 2 + 1) * 4 + 1] = L; }
  for (let k = 0; k < n - 1; k++) { const i = base + k * 2; out.i.push(i, i + 1, i + 2, i + 1, i + 3, i + 2); }
}
function toGeo(o) {
  if (!o.i.length) return null;
  const g = new THREE.BufferGeometry(), n = o.p.length / 3, nrm = new Float32Array(n * 3); for (let i = 0; i < n; i++) nrm[i * 3 + 1] = 1;
  g.setAttribute('position', new THREE.Float32BufferAttribute(o.p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(o.uv, 2)); g.setAttribute('aR', new THREE.Float32BufferAttribute(o.r, 4));
  g.setIndex(o.i); g.computeBoundingSphere(); return g;
}
// meshes for the streets whose middle lies in chunk (cx, cz)
export function streetMeshes(cx, cz, M) {
  const c = City.active, R = c.r, list = c.eHome.get(cx + ',' + cz); if (!list) return [];
  const road = { p: [], uv: [], r: [], i: [] }, pave = { p: [], uv: [], r: [], i: [] }, br = new BridgeBuilder();
  for (const e of list) {
    const cls = R.cls[e], w = ROAD_W[cls]; if (!w || (R.flags[e] & 2)) continue;
    const drive = DRIVABLE(cls), bridge = R.flags[e] & 1, y = BASE + (drive ? 0.06 + (9 - cls) * 0.002 : 0.035);
    if (drive) {
      ribbon(road, R.v, R.ps[e], R.ps[e + 1], w, y, [cls, 0, w, bridge]);
      if (cls !== 1) ribbon(pave, R.v, R.ps[e], R.ps[e + 1], w + 6.4, BASE + 0.03, [cls, 0, w + 6.4, 0]);
    } else ribbon(pave, R.v, R.ps[e], R.ps[e + 1], w, y, [cls, 0, w, 0]);
    if (bridge) br.add(R.v, R.ps[e], R.ps[e + 1], drive ? w + 10 : w + 1.5);
  }
  const out = [], rg = toGeo(road), pg = toGeo(pave), bg = br.geometry();
  if (pg) { const m = new THREE.Mesh(pg, M.pave); m.receiveShadow = true; out.push(m); }
  if (rg) { const m = new THREE.Mesh(rg, M.road); m.receiveShadow = true; out.push(m); }
  if (bg) { const m = new THREE.Mesh(bg, M.bridge); m.receiveShadow = true; m.castShadow = true; out.push(m); }
  return out;
}
class BridgeBuilder {
  constructor() { this.pos = []; this.idx = []; }
  quad(a, b, c, d) { const i = this.pos.length / 3; this.pos.push(...a, ...b, ...c, ...d); this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3); }
  add(pts, a, b, w) {
    for (let j = a; j < b - 1; j++) {
      const x0 = pts[j * 2], z0 = pts[j * 2 + 1], x1 = pts[j * 2 + 2], z1 = pts[j * 2 + 3], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.1) continue;
      const nx = -(z1 - z0) / L * w / 2, nz = (x1 - x0) / L * w / 2, top = BASE + 0.02, bot = BASE - 1.6, par = BASE + 1.15;
      for (const s of [-1, 1]) {
        const ax = x0 + nx * s, az = z0 + nz * s, bx = x1 + nx * s, bz = z1 + nz * s, ix = -nx / (w / 2) * 0.4 * s, iz = -nz / (w / 2) * 0.4 * s;
        this.quad([ax, bot, az], [bx, bot, bz], [bx, par, bz], [ax, par, az]);                      // outer face
        this.quad([bx + ix, top, bz + iz], [ax + ix, top, az + iz], [ax + ix, par, az + iz], [bx + ix, par, bz + iz]);   // inner face of parapet
        this.quad([ax, par, az], [bx, par, bz], [bx + ix, par, bz + iz], [ax + ix, par, az + iz]);  // coping
      }
      this.quad([x0 - nx, bot, z0 - nz], [x0 + nx, bot, z0 + nz], [x1 + nx, bot, z1 + nz], [x1 - nx, bot, z1 - nz]);   // soffit
      this.quad([x1 - nx, BASE + 0.015, z1 - nz], [x1 + nx, BASE + 0.015, z1 + nz], [x0 + nx, BASE + 0.015, z0 + nz], [x0 - nx, BASE + 0.015, z0 - nz]);   // deck
    }
  }
  geometry() {
    if (!this.idx.length) return null; const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3)); g.setIndex(this.idx);
    const ng = g.toNonIndexed(); ng.computeVertexNormals(); return ng;
  }
}
// collision for bridge decks and parapets, bucketed by chunk
export function bridgeSolids(c) {
  const R = c.r, map = new Map();
  for (let e = 0; e < R.E; e++) {
    if (!(R.flags[e] & 1) || (R.flags[e] & 2) || !ROAD_W[R.cls[e]]) continue;
    const w = (DRIVABLE(R.cls[e]) ? ROAD_W[R.cls[e]] + 10 : ROAD_W[R.cls[e]] + 1.5) / 2;
    for (let j = R.ps[e]; j < R.ps[e + 1] - 1; j++) {
      const x0 = R.v[j * 2], z0 = R.v[j * 2 + 1], x1 = R.v[j * 2 + 2], z1 = R.v[j * 2 + 3], L = Math.hypot(x1 - x0, z1 - z0); if (L < 0.2) continue;
      const nx = -(z1 - z0) / L, nz = (x1 - x0) / L, ex = (x1 - x0) / L * 0.3, ez = (z1 - z0) / L * 0.3;
      const mk = (o0, o1, y0, y1) => { const r = new Float32Array([x0 - ex + nx * o0, z0 - ez + nz * o0, x1 + ex + nx * o0, z1 + ez + nz * o0, x1 + ex + nx * o1, z1 + ez + nz * o1, x0 - ex + nx * o1, z0 - ez + nz * o1]);
        let a = 1e9, b = -1e9, cc = 1e9, d = -1e9; for (let k = 0; k < 8; k += 2) { a = Math.min(a, r[k]); b = Math.max(b, r[k]); cc = Math.min(cc, r[k + 1]); d = Math.max(d, r[k + 1]); }
        const s = { minx: a, maxx: b, minz: cc, maxz: d, miny: y0, maxy: y1, rings: [r], bridge: true };
        for (let cx = Math.floor(a / CH); cx <= Math.floor(b / CH); cx++) for (let cz = Math.floor(cc / CH); cz <= Math.floor(d / CH); cz++) { const k = cx + ',' + cz; (map.get(k) || map.set(k, []).get(k)).push(s); } };
      mk(-w, w, BASE - 1.6, BASE);
      mk(-w, -w + 0.4, BASE, BASE + 1.15); mk(w - 0.4, w, BASE, BASE + 1.15);
    }
  }
  return map;
}
