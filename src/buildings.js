// Buildings: turns footprints (real or generated) into merged meshes with walls, parapets and
// pitched/hipped/mansard/domed roofs, drawn by one facade shader with procedural windows,
// shopfronts, doors, brick/stone/stucco/concrete detail and lit rooms at night.
import * as THREE from 'three';
import { clamp } from './util.js';

// ---------- surface detail textures (albedo in RGB, height in A) ----------
function tex(draw, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'); draw(x, size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.colorSpace = THREE.NoColorSpace; t.generateMipmaps = true; return t;
}
const R = Math.random;
function heightToAlpha(x, S, fn) {
  const id = x.getImageData(0, 0, S, S), d = id.data;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) d[(j * S + i) * 4 + 3] = fn(i, j, d[(j * S + i) * 4]);
  x.putImageData(id, 0, 0);
}
export function makeFacadeTextures() {
  // brick: 2 m square, stretcher bond
  const brick = tex((x, S) => {
    const bw = S / 9, bh = S / 30; x.fillStyle = 'rgb(200,198,192)'; x.fillRect(0, 0, S, S);
    for (let r = 0; r < 30; r++) for (let k = -1; k < 10; k++) {
      const off = (r % 2) * bw / 2, v = 150 + R() * 70 | 0, t = R() * 18 | 0;
      x.fillStyle = `rgb(${v + t},${v - 4},${v - 10 - t})`; x.fillRect(k * bw + off + 1.5, r * bh + 1.5, bw - 3, bh - 3);
      for (let s = 0; s < 6; s++) { x.fillStyle = `rgba(0,0,0,${R() * 0.12})`; x.fillRect(k * bw + off + R() * bw, r * bh + R() * bh, 2, 2); }
    }
    heightToAlpha(x, S, (i, j) => { const u = (j % bh), w = ((i - ((Math.floor(j / bh) % 2) * bw / 2) + S) % bw); return (u < 1.5 || u > bh - 1.5 || w < 1.5 || w > bw - 1.5) ? 70 : 220 + R() * 30; });
  });
  // stone: ashlar blocks
  const stone = tex((x, S) => {
    x.fillStyle = 'rgb(205,203,196)'; x.fillRect(0, 0, S, S); const bw = S / 4, bh = S / 8;
    for (let r = 0; r < 8; r++) for (let k = -1; k < 5; k++) { const off = (r % 2) * bw / 2, v = 190 + R() * 40 | 0; x.fillStyle = `rgb(${v},${v - 2},${v - 6})`; x.fillRect(k * bw + off + 1, r * bh + 1, bw - 2, bh - 2); }
    for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${R() < 0.5 ? 0 : 255},${R() < 0.5 ? 0 : 255},0,${R() * 0.05})`; x.fillRect(R() * S, R() * S, 2, 2); }
    heightToAlpha(x, S, (i, j) => { const u = j % bh, w = ((i - ((Math.floor(j / bh) % 2) * bw / 2) + S) % bw); return (u < 1.2 || w < 1.2) ? 90 : 230; });
  });
  // plaster / stucco
  const plaster = tex((x, S) => {
    x.fillStyle = 'rgb(222,220,214)'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 26000; i++) { const v = R() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${R() * 0.05})`; x.fillRect(R() * S, R() * S, 1 + R() * 3, 1 + R() * 3); }
    heightToAlpha(x, S, (i, j, r) => 150 + (r - 222) * 3);
  });
  // concrete with formwork joints
  const concrete = tex((x, S) => {
    x.fillStyle = 'rgb(208,206,200)'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 22000; i++) { const v = R() < 0.5 ? 0 : 255; x.fillStyle = `rgba(${v},${v},${v},${R() * 0.06})`; x.fillRect(R() * S, R() * S, 1 + R() * 4, 1 + R() * 4); }
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 2; for (let k = 0; k <= 4; k++) { x.beginPath(); x.moveTo(0, k * S / 4); x.lineTo(S, k * S / 4); x.stroke(); } for (let k = 0; k <= 2; k++) { x.beginPath(); x.moveTo(k * S / 2, 0); x.lineTo(k * S / 2, S); x.stroke(); }
    heightToAlpha(x, S, (i, j, r) => 160 + (r - 208) * 2);
  });
  // roofing: slate/tile courses and flat roof gravel
  const roof = tex((x, S) => {
    x.fillStyle = 'rgb(190,190,190)'; x.fillRect(0, 0, S, S); const h = S / 22, w = S / 10;
    for (let r = 0; r < 22; r++) for (let k = -1; k < 11; k++) { const v = 150 + R() * 70 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(k * w + (r % 2) * w / 2 + 1, r * h + 1, w - 2, h - 2); }
    heightToAlpha(x, S, (i, j) => (j % h) < 2 ? 60 : 160 + (j % h) / h * 90);
  });
  const gravel = tex((x, S) => {
    x.fillStyle = 'rgb(170,170,168)'; x.fillRect(0, 0, S, S);
    for (let i = 0; i < 30000; i++) { const v = 110 + R() * 120 | 0; x.fillStyle = `rgb(${v},${v},${v - 4})`; x.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3); }
    heightToAlpha(x, S, (i, j, r) => r);
  });
  return { brick, stone, plaster, concrete, roof, gravel };
}

// ---------- the facade material ----------
export function facadeMaterial(T, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.0 });
  const u = m.userData.u = { uLit: { value: 0 }, uGlow: { value: 0 }, uWet: { value: 0 }, uWeather: { value: opts.weathered ? 1 : 0 }, uDusty: { value: opts.dusty ? 1 : 0 },
    tBrick: { value: T.brick }, tStone: { value: T.stone }, tPlaster: { value: T.plaster }, tConcrete: { value: T.concrete }, tRoof: { value: T.roof }, tGravel: { value: T.gravel } };
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, u);
    s.vertexShader = 'attribute vec4 aB; attribute vec2 uv1; varying vec4 vB; varying vec2 vF; varying vec2 vE; varying vec3 vWN; varying vec3 vWP;\n' + s.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n vB = aB; vF = uv; vE = uv1; vWN = normalize(mat3(modelMatrix) * normal); vWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    s.fragmentShader = `uniform float uLit, uGlow, uWet, uWeather, uDusty; uniform sampler2D tBrick, tStone, tPlaster, tConcrete, tRoof, tGravel;
      varying vec4 vB; varying vec2 vF; varying vec2 vE; varying vec3 vWN; varying vec3 vWP;
      float h1(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h1(i),h1(i+vec2(1,0)),f.x), mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x), f.y); }
      vec4 detail(float t, vec2 p){ return t < 0.5 ? texture2D(tBrick, p / 2.0) : t < 1.5 ? texture2D(tStone, p / 3.2) : t < 2.5 ? texture2D(tPlaster, p / 3.0) : t < 3.5 ? texture2D(tConcrete, p / 4.8) : texture2D(tPlaster, p / 6.0); }
      // style -> bay, floor, win w, win h | sill, ground floor, frame, arch
      void sp(float s, out vec4 A, out vec4 B){
        if (s < 0.5) { A = vec4(3.4, 3.2, 1.05, 1.85); B = vec4(0.85, 3.5, 0.07, 0.0); }
        else if (s < 1.5) { A = vec4(3.6, 3.6, 1.3, 2.3); B = vec4(0.7, 4.4, 0.06, 0.0); }
        else if (s < 2.5) { A = vec4(1.5, 3.8, 1.44, 3.15); B = vec4(0.32, 5.0, 0.03, 0.0); }
        else if (s < 3.5) { A = vec4(3.0, 3.2, 1.8, 1.6); B = vec4(0.9, 4.0, 0.05, 0.0); }
        else if (s < 4.5) { A = vec4(3.2, 3.0, 1.3, 1.35); B = vec4(0.9, 3.4, 0.05, 0.0); }
        else if (s < 5.5) { A = vec4(4.0, 4.6, 1.5, 2.7); B = vec4(0.8, 5.2, 0.08, 1.0); }
        else if (s < 6.5) { A = vec4(6.0, 6.0, 4.0, 1.2); B = vec4(3.8, 6.0, 0.06, 0.0); }
        else if (s < 7.5) { A = vec4(5.0, 14.0, 1.8, 6.0); B = vec4(2.5, 14.0, 0.1, 1.0); }
        else if (s < 8.5) { A = vec4(4.0, 3.0, 1.2, 1.4); B = vec4(0.9, 3.0, 0.07, 0.0); }
        else if (s < 9.5) { A = vec4(3.0, 3.3, 1.25, 2.4); B = vec4(0.35, 4.6, 0.06, 0.0); }
        else if (s < 10.5) { A = vec4(3.2, 3.1, 2.4, 1.5); B = vec4(0.9, 3.8, 0.04, 0.0); }
        else { A = vec4(3.6, 3.4, 1.4, 1.6); B = vec4(0.9, 4.0, 0.05, 1.0); }
      }
      float box(vec2 p, vec2 a, vec2 b, vec2 w){ vec2 s = smoothstep(a - w, a + w, p) * (1.0 - smoothstep(b - w, b + w, p)); return s.x * s.y; }
      \n` + s.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float fGlass = 0.0, fLit = 0.0, fSign = 0.0, fRough = 0.85, fMetal = 0.0, fH = 0.5;
        vec3 sCol = vec3(0.0);
        float kind = vB.w, style = vB.x, seed = vB.y, texId = vB.z;
        vec2 fw = fwidth(vF) + 1e-4;
        if (kind > 1.5 && kind < 3.5) {                 // roofs
          vec4 rt = kind < 2.5 ? texture2D(tGravel, vWP.xz / 4.0) : texture2D(tRoof, vF / vec2(4.0, 3.0));
          diffuseColor.rgb *= rt.r * 1.15; fH = rt.a; fRough = kind < 2.5 ? 0.95 : 0.7;
        } else if (kind > 3.5) {                        // parapet inner face / gable end
          vec4 dt = detail(texId, vF); fH = dt.a; diffuseColor.rgb *= (kind < 4.5 ? 0.75 : 1.0) * dt.r * 1.18;
        } else {
          vec4 A, B; sp(style, A, B);
          float H = vE.y, L = vE.x, v = vF.y, u = vF.x;
          vec4 dt = detail(texId, vec2(u, v)); fH = dt.a;
          float curtain = step(1.5, style) * step(style, 2.5);
          diffuseColor.rgb *= mix(dt.r * 1.02, 0.9, curtain * 0.7) * 0.9;
          // window grid, centred on each wall so corners stay solid
          float n = floor((L - 0.6) / A.x); float off = (L - n * A.x) * 0.5;
          float fl = floor((v - B.y) / A.y), fv = v - B.y - fl * A.y;
          float bay = floor((u - off) / A.x), fu = u - off - bay * A.x;
          float inBays = step(0.0, bay) * step(bay, n - 1.0) * step(B.y, v) * step(v, H - 1.2);
          float aaw = max(fw.x, fw.y);
          float far = smoothstep(0.08, 0.35, aaw);
          vec2 wa = vec2((A.x - A.z) * 0.5, B.x), wb = vec2((A.x + A.z) * 0.5, B.x + A.w);
          float win = box(vec2(fu, fv), wa, wb, vec2(aaw));
          // the glass sits 16 cm behind the wall: parallax-shift it so each window has a visible reveal
          vec3 dpx = dFdx(vWP), dpy = dFdy(vWP); vec3 Tw = dpx * dFdy(vF.y) - dpy * dFdx(vF.y); Tw = Tw / (length(Tw) + 1e-6);
          vec3 Vw = normalize(cameraPosition - vWP); vec3 Nw = normalize(vWN);
          vec2 par = vec2(dot(Vw, Tw), Vw.y) / max(dot(Vw, Nw), 0.3) * 0.16;
          float winIn = box(vec2(fu, fv) - par, wa + 0.03, wb - 0.03, vec2(aaw));
          float reveal = clamp(win - winIn, 0.0, 1.0) * (1.0 - curtain);
          win = mix(win * winIn, win, curtain);
          if (B.w > 0.5) { vec2 c = vec2(A.x * 0.5, B.x + A.w - A.z * 0.5); float arch = 1.0 - smoothstep(A.z * 0.5 - aaw, A.z * 0.5 + aaw, length((vec2(fu, fv) - c) * vec2(1.0, 1.0))); win = max(box(vec2(fu, fv), wa, vec2(wb.x, c.y), vec2(aaw)), arch * step(c.y, fv)); }
          float frame = box(vec2(fu, fv), wa - B.z * 1.6, wb + B.z * 1.6, vec2(aaw)) - win;
          float wid = h1(vec2(bay + seed * 91.0, fl + seed * 37.0));
          win *= inBays; frame *= inBays;
          if (curtain > 0.5) { win = inBays * (1.0 - box(vec2(fu, fv), vec2(-1.0, B.x + A.w), vec2(A.x + 1.0, A.y + 1.0), vec2(aaw))) ; frame = inBays * (1.0 - box(vec2(fu, fv), vec2(B.z, -1.0), vec2(A.x - B.z, A.y + 1.0), vec2(aaw))) * 0.8; }
          win = mix(win, A.z * A.w / (A.x * A.y) * inBays * (curtain > 0.5 ? 1.6 : 1.0), far);
          // per-region extras
          if (style > 3.5 && style < 4.5) {                       // Indian flats: grilles and balcony slabs
            float bars = step(0.6, fract(fu / 0.12)) * win; win *= 1.0 - bars * 0.7; diffuseColor.rgb *= 1.0 - bars * 0.5;
            float slab = inBays * box(vec2(fu, fv), vec2(0.0, -0.05), vec2(A.x, 0.18), vec2(aaw)); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.12 + 0.05, slab);
          }
          if (style > 8.5 && style < 9.5) {                       // Haussmann iron balconies on the 2nd and 5th floors
            float rail = step(0.5, fract(fu / 0.16)) * box(vec2(fu, fv), vec2(0.0, 0.2), vec2(A.x, 1.15), vec2(aaw)) * (step(abs(fl - 1.0), 0.1) + step(abs(fl - 4.0), 0.1)) * inBays;
            diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05), rail * 0.85);
          }
          if (style > 9.5 && style < 10.5) { float rail = box(vec2(fu, fv), vec2(0.0, 0.0), vec2(A.x, 1.0), vec2(aaw)) * inBays; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.8 + 0.1, rail * 0.6); }
          // floor bands and cornice
          if (style > 0.5 && style < 1.5 || style > 8.5 && style < 9.5 || style > 4.5 && style < 5.5) { float band = 1.0 - smoothstep(0.0, 0.25 + aaw, abs(fv - A.y + 0.15)); diffuseColor.rgb *= 1.0 - band * 0.2 * step(B.y, v); }
          float corn = smoothstep(H - 1.0, H - 0.8, v) * (1.0 - smoothstep(H - 0.35, H - 0.15, v)); diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.15 + 0.04, corn * (1.0 - curtain));
          // ground floor: shopfront or door
          float shop = step(0.5, kind) * step(kind, 1.5);
          if (v < B.y) {
            if (shop > 0.5) {
              float sb = box(vec2(u, v), vec2(0.4, 0.25), vec2(L - 0.4, B.y - 1.0), vec2(aaw));
              float mull = (1.0 - step(0.08, fract(u / 2.4) * 2.4)) * sb;
              float sign = box(vec2(u, v), vec2(0.4, B.y - 0.9), vec2(L - 0.4, B.y - 0.25), vec2(aaw));
              float sh = h1(vec2(floor(u / 9.0), seed * 17.0));
              sCol = 0.55 + 0.45 * cos(6.2831 * (sh + vec3(0.0, 0.33, 0.67)));
              diffuseColor.rgb = mix(diffuseColor.rgb, sCol * 0.8, sign); fSign = sign;
              win = sb - mull; frame = mull; wid = sh;
            } else {
              float door = box(vec2(fract((u - off) / (A.x * 2.0)) * A.x * 2.0, v), vec2(A.x - 0.6, 0.0), vec2(A.x + 0.6, 2.4), vec2(aaw)) * step(0.5, n) * step(style, 1.5);
              vec3 dc = vec3[4](vec3(0.45, 0.06, 0.06), vec3(0.06, 0.12, 0.3), vec3(0.03), vec3(0.08, 0.25, 0.12))[int(h1(vec2(floor((u - off) / (A.x * 2.0)), seed * 7.0)) * 3.99)];
              diffuseColor.rgb = mix(diffuseColor.rgb, dc, door); fRough = mix(fRough, 0.3, door);
              if (style > 3.5 && style < 4.5) { float sh = box(vec2(u, v), vec2(0.4, 0.0), vec2(L - 0.4, B.y - 0.6), vec2(aaw)) * step(0.4, h1(vec2(floor(u / 4.0), seed))); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.33, 0.34) * (0.8 + 0.2 * step(0.5, fract(v / 0.12))), sh); }
            }
          }
          vec3 frameCol = style < 0.5 || style > 7.5 && style < 8.5 ? vec3(0.92) : style > 1.5 && style < 2.5 ? diffuseColor.rgb * 0.35 : style > 3.5 && style < 4.5 ? vec3(0.15) : vec3(0.6, 0.6, 0.58);
          diffuseColor.rgb = mix(diffuseColor.rgb, frameCol, clamp(frame, 0.0, 1.0) * (1.0 - far * 0.7));
          vec3 glass = mix(vec3(0.05, 0.07, 0.09), vec3(0.18, 0.2, 0.22), wid * 0.6);
          if (curtain > 0.5) glass = mix(glass, vColor.rgb * 0.45, 0.6);
          if (wid > 0.82 && curtain < 0.5) glass = mix(glass, vec3(0.55, 0.5, 0.42), 0.5);          // curtains drawn
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.5, reveal * inBays * (1.0 - far));
          fGlass = win; fLit = win * step(wid, uLit) * (0.35 + wid);
          // weather: grime at street level, monsoon streaks in tropical cities, rain darkening
          diffuseColor.rgb *= 1.0 - 0.28 * exp(-v / 1.6);
          if (uWeather > 0.5) { float st = vn(vec2(u * 1.7, v * 0.06 + seed * 13.0)) * smoothstep(0.0, 4.0, H - v + 2.0) * (1.0 - win); diffuseColor.rgb *= 1.0 - 0.38 * smoothstep(0.45, 0.85, st); diffuseColor.rgb *= 0.92 + 0.08 * vn(vec2(u * 0.4, v * 0.3)); }
          if (uDusty > 0.5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.56, 0.47), 0.12 * (1.0 - win));
          fRough = mix(mix(0.88, 0.55, curtain), 0.14, win * (1.0 - far * 0.75));
          fMetal = win * 0.75 * (1.0 - far * 0.8);
        }
        diffuseColor.rgb *= 1.0 - uWet * 0.25 * (1.0 - fGlass);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n roughnessFactor = mix(fRough, 0.15, uWet * 0.6);')
      .replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\n metalnessFactor = fMetal;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        { vec3 nW = normalize(vWN); float k = (1.0 - fGlass) * 0.9;
          vec2 g = vec2(dFdx(fH), dFdy(fH)) * k;
          vec3 dpx = dFdx(vWP), dpy = dFdy(vWP);
          vec3 r1 = cross(dpy, nW), r2 = cross(nW, dpx); float det = dot(dpx, r1);
          vec3 grad = (g.x * r1 + g.y * r2) / (abs(det) + 1e-6) * sign(det);
          nW = normalize(nW - grad * 0.012);
          normal = normalize(mat3(viewMatrix) * nW); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += fLit * uGlow * mix(vec3(1.0, 0.76, 0.45), vec3(0.8, 0.9, 1.0), step(0.55, fract(seed * 13.0 + vF.x * 0.01)));
        totalEmissiveRadiance += fSign * uGlow * sCol * 1.6;`);
  };
  m.customProgramCacheKey = () => 'facade-v1';
  return m;
}

// ---------- geometry ----------
const AREA = (r) => { let a = 0; for (let i = 0, n = r.length / 2; i < n; i++) { const j = (i + 1) % n; a += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; } return a / 2; };
// minimum-area bounding rectangle: centre, long axis, half sizes
function obb(r) {
  const n = r.length / 2; let best = null;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, dx = r[j * 2] - r[i * 2], dz = r[j * 2 + 1] - r[i * 2 + 1], l = Math.hypot(dx, dz); if (l < 0.5) continue;
    const ux = dx / l, uz = dz / l; let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9;
    for (let k = 0; k < n; k++) { const a = r[k * 2] * ux + r[k * 2 + 1] * uz, b = -r[k * 2] * uz + r[k * 2 + 1] * ux; if (a < a0) a0 = a; if (a > a1) a1 = a; if (b < b0) b0 = b; if (b > b1) b1 = b; }
    const area = (a1 - a0) * (b1 - b0);
    if (!best || area < best.area) best = { area, ux, uz, ca: (a0 + a1) / 2, cb: (b0 + b1) / 2, ha: (a1 - a0) / 2, hb: (b1 - b0) / 2 };
  }
  if (!best) return null;
  let { ux, uz, ca, cb, ha, hb } = best;
  const cx = ca * ux - cb * uz, cz = ca * uz + cb * ux;
  if (hb > ha) { const t = ha; ha = hb; hb = t; const ox = ux; ux = -uz; uz = ox; }
  return { cx, cz, ux, uz, ha, hb, area: best.area };
}

export class MeshBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.uv1 = []; this.c = []; this.b = []; this.i = []; }
  v(x, y, z, nx, ny, nz, u, w, e, h, col, B) { this.p.push(x, y, z); this.n.push(nx, ny, nz); this.uv.push(u, w); this.uv1.push(e, h); this.c.push(col.r, col.g, col.b); this.b.push(B[0], B[1], B[2], B[3]); return this.p.length / 3 - 1; }
  tri(a, b, c) { this.i.push(a, b, c); }
  // footprint rings (flat [x,z,...] arrays, first = outer), y0..y1 with ground level g
  building(o) {
    const { rings, y0, g, col, roofCol, style, tex, seed, shop } = o, y1 = o.y1 + seed * 0.06, H = y1 - g; const B = [style, seed, tex, 0];
    const outer = rings[0], a0 = AREA(outer);
    let roof = o.roof || 0, ob = null;
    if (roof) { ob = rings.length === 1 ? obb(outer) : null; if (!ob || Math.abs(a0) / ob.area < 0.82 || ob.hb < 2.5) roof = 0; }
    const parapet = !roof && H > 7 && o.parapet !== false ? 0.9 : 0;
    rings.forEach((r, ri) => {
      const n = r.length / 2, sg = (AREA(r) > 0 ? 1 : -1) * (ri ? -1 : 1);
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ax = r[i * 2], az = r[i * 2 + 1], bx = r[j * 2], bz = r[j * 2 + 1], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); if (L < 0.05) continue;
        const nx = sg * dz / L, nz = -sg * dx / L, top = y1 + parapet;
        B[3] = shop && !ri ? 1 : 0;
        const A1 = this.v(ax, y0, az, nx, 0, nz, 0, y0 - g, L, H, col, B), B1 = this.v(bx, y0, bz, nx, 0, nz, L, y0 - g, L, H, col, B), C1 = this.v(bx, top, bz, nx, 0, nz, L, top - g, L, H, col, B), D1 = this.v(ax, top, az, nx, 0, nz, 0, top - g, L, H, col, B);
        if ((-dz * nx + dx * nz) > 0) { this.tri(A1, B1, C1); this.tri(A1, C1, D1); } else { this.tri(A1, C1, B1); this.tri(A1, D1, C1); }
        if (parapet) {     // inner face of the parapet
          B[3] = 4; const a = this.v(ax, y1, az, -nx, 0, -nz, 0, 0, L, H, col, B), b = this.v(bx, y1, bz, -nx, 0, -nz, L, 0, L, H, col, B), c = this.v(bx, top, bz, -nx, 0, -nz, L, parapet, L, H, col, B), d = this.v(ax, top, az, -nx, 0, -nz, 0, parapet, L, H, col, B);
          if ((-dz * nx + dx * nz) > 0) { this.tri(a, c, b); this.tri(a, d, c); } else { this.tri(a, b, c); this.tri(a, c, d); }
        }
      }
    });
    if (!roof) { this.flat(rings, y1, roofCol, B); return; }
    B[3] = 3; const { cx, cz, ux, uz, ha, hb } = ob, ov = 0.35, A2 = ha + ov, Bh = hb + ov, P = (a, b, y) => [cx + ux * a - uz * b, y, cz + uz * a + ux * b];
    const rh = Math.min(hb * (roof === 5 ? 1.1 : 0.85), roof === 4 ? hb : 8), top = y1 + rh;
        if (roof === 1) {        // gabled
      const r0 = P(-A2, 0, top), r1 = P(A2, 0, top);
      this.poly([P(-A2, -Bh, y1), P(A2, -Bh, y1), r1, r0], roofCol, B); this.poly([P(A2, Bh, y1), P(-A2, Bh, y1), r0, r1], roofCol, B);
      B[3] = 5; this.poly([P(-ha, Bh - ov, y1), P(-ha, -Bh + ov, y1), P(-ha, 0, top)], col, B, [-ux, -uz]); this.poly([P(ha, -Bh + ov, y1), P(ha, Bh - ov, y1), P(ha, 0, top)], col, B, [ux, uz]);
    } else if (roof === 2 || roof === 5) {   // hipped (mansard = steep hipped with a flat top)
      const k = roof === 5 ? 0.72 : 1, ins = Bh * k, t2 = roof === 5 ? y1 + Math.min(4, rh) : top;
      const q0 = P(-A2 + ins, roof === 5 ? -Bh + ins : 0, t2), q1 = P(A2 - ins, roof === 5 ? -Bh + ins : 0, t2), q2 = P(A2 - ins, roof === 5 ? Bh - ins : 0, t2), q3 = P(-A2 + ins, roof === 5 ? Bh - ins : 0, t2);
      const e0 = P(-A2, -Bh, y1), e1 = P(A2, -Bh, y1), e2 = P(A2, Bh, y1), e3 = P(-A2, Bh, y1);
      this.poly([e0, e1, q1, q0], roofCol, B); this.poly([e1, e2, q2, q1], roofCol, B); this.poly([e2, e3, q3, q2], roofCol, B); this.poly([e3, e0, q0, q3], roofCol, B);
      if (roof === 5) { B[3] = 2; this.poly([q0, q1, q2, q3], roofCol, B); }
    } else if (roof === 3) {  // pyramidal
      const ap = P(0, 0, top), e = [P(-A2, -Bh, y1), P(A2, -Bh, y1), P(A2, Bh, y1), P(-A2, Bh, y1)];
      for (let i = 0; i < 4; i++) this.poly([e[i], e[(i + 1) % 4], ap], roofCol, B);
    } else {                  // dome
      this.flat(rings, y1, roofCol, B); B[3] = 3; const rr = hb * 0.95, seg = 14, ring = 6;
      for (let j = 0; j < ring; j++) for (let i = 0; i < seg; i++) {
        const pt = (ii, jj) => { const a = ii / seg * Math.PI * 2, e = jj / ring * Math.PI / 2; return [cx + Math.cos(a) * Math.cos(e) * rr, y1 + Math.sin(e) * rr * 0.95, cz + Math.sin(a) * Math.cos(e) * rr]; };
        this.poly([pt(i, j), pt(i, j + 1), pt(i + 1, j + 1), pt(i + 1, j)], roofCol, B);
      }
    }
  }
  // arbitrary planar polygon (convex), normal from winding; wall polygons get facade uvs
  poly(pts, col, B, hint) {
    const a = pts[0], b = pts[1], c = pts[2]; let nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]), ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]), nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    if ((hint ? nx * hint[0] + nz * hint[1] : ny) < 0) { nx = -nx; ny = -ny; nz = -nz; pts = pts.slice().reverse(); }
    let tx = -nz, tz = nx, tl = Math.hypot(tx, tz); if (tl < 1e-3) { tx = 1; tz = 0; tl = 1; } tx /= tl; tz /= tl;
    const bx = ny * tz, by = nz * tx - nx * tz, bz = -ny * tx;
    const idx = pts.map(p => this.v(p[0], p[1], p[2], nx, ny, nz, p[0] * tx + p[2] * tz, p[0] * bx + p[1] * by + p[2] * bz, 1e3, 1e3, col, B));
    for (let i = 1; i < idx.length - 1; i++) this.tri(idx[0], idx[i], idx[i + 1]);
  }
  flat(rings, y, col, Bs) {
    const B = [Bs[0], Bs[1], Bs[2], 2], V2 = THREE.Vector2, outer = [], holes = [];
    const pts = r => { const a = []; for (let i = 0; i < r.length; i += 2) a.push(new V2(r[i], r[i + 1])); return a; };
    rings.forEach((r, i) => i ? holes.push(pts(r)) : outer.push(...pts(r)));
    let tris = null; try { tris = THREE.ShapeUtils.triangulateShape(outer, holes); } catch (e) { tris = null; }
    // never leave a building without a roof: fall back to the outline alone, then to a fan
    if (!tris || !tris.length) { try { tris = THREE.ShapeUtils.triangulateShape(outer, []); holes.length = 0; } catch (e) { tris = null; } }
    if (!tris || !tris.length) { tris = []; holes.length = 0; for (let i = 1; i < outer.length - 1; i++) tris.push([0, i, i + 1]); }
    const all = outer.concat(...holes), base = all.map(p => this.v(p.x, y, p.y, 0, 1, 0, p.x, p.y, 1e3, 1e3, col, B));
    for (const t of tris) {
      const [a, b, c] = t, A = all[a], Bp = all[b], C = all[c], cr = (Bp.x - A.x) * (C.y - A.y) - (Bp.y - A.y) * (C.x - A.x);
      if (cr < 0) this.tri(base[a], base[b], base[c]); else this.tri(base[a], base[c], base[b]);
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2)); g.setAttribute('uv1', new THREE.Float32BufferAttribute(this.uv1, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3)); g.setAttribute('aB', new THREE.Float32BufferAttribute(this.b, 4));
    g.setIndex(this.p.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(this.i, 1) : new THREE.Uint16BufferAttribute(this.i, 1));
    g.computeBoundingSphere(); g.computeBoundingBox(); return g;
  }
  get empty() { return this.i.length === 0; }
}
