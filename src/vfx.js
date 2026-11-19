// Visual effects engine for powers and weapons:
//  - textured particles (fire, smoke, sparks, embers, snow, ice, web, toxic, energy) with colour and size over
//    life; additive for light, alpha-blended for smoke and snow
//  - beams: camera-facing ribbons along a polyline with scrolling energy (webs, lightning, frost rays, tracers)
//  - chains: real chain links along a sagging curve (Cinder's hellfire chains)
//  - shockwave domes, an animated fireball shader and fading ground marks (scorch, frost, web, toxic)
import * as THREE from 'three';
import { G, clamp, lerp } from './util.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), _d = V();
// effects brightness: lowered at night, when the bloom filter would otherwise turn every spark into a white haze
const GAIN = { value: 1 };
const TILE = { glow: 0, fire: 1, smoke: 2, spark: 3, snow: 4, ice: 5, web: 6, ring: 7 };

function atlas() {
  const S = 128, c = document.createElement('canvas'); c.width = S * 4; c.height = S * 2; const x = c.getContext('2d');
  const at = (i, f) => { x.save(); x.translate((i % 4) * S, Math.floor(i / 4) * S); x.beginPath(); x.rect(0, 0, S, S); x.clip(); f(S); x.restore(); };
  const radial = (cx, cy, r, stops) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); for (const [o, col] of stops) g.addColorStop(o, col); return g; };
  at(0, S => { x.fillStyle = radial(S / 2, S / 2, S / 2, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.6)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, S, S); });
  // fire: a cluster of soft lobes with a hot core
  at(1, S => { for (let i = 0; i < 16; i++) { const a = Math.random() * 6.28, r = Math.random() * S * 0.22, s = S * (0.14 + Math.random() * 0.2); x.fillStyle = radial(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, s, [[0, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, S, S); } });
  // smoke: lumpy, soft-edged
  at(2, S => { for (let i = 0; i < 26; i++) { const a = Math.random() * 6.28, r = Math.random() * S * 0.26, s = S * (0.12 + Math.random() * 0.18); x.fillStyle = radial(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r, s, [[0, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, S, S); } });
  // spark: a thin bright streak
  at(3, S => { x.fillStyle = radial(S / 2, S / 2, S / 2, [[0, 'rgba(255,255,255,1)'], [0.12, 'rgba(255,255,255,0.8)'], [0.4, 'rgba(255,255,255,0)']]); x.save(); x.translate(S / 2, S / 2); x.scale(1, 0.18); x.translate(-S / 2, -S / 2); x.fillRect(0, 0, S, S); x.restore(); });
  // snowflake
  at(4, S => { x.translate(S / 2, S / 2); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 5; x.lineCap = 'round'; for (let i = 0; i < 6; i++) { x.rotate(Math.PI / 3); x.beginPath(); x.moveTo(0, 0); x.lineTo(0, S * 0.42); x.moveTo(0, S * 0.24); x.lineTo(S * 0.1, S * 0.32); x.moveTo(0, S * 0.24); x.lineTo(-S * 0.1, S * 0.32); x.stroke(); } });
  // ice shard: a faceted diamond
  at(5, S => { x.translate(S / 2, S / 2); x.fillStyle = 'rgba(230,248,255,0.95)'; x.beginPath(); x.moveTo(0, -S * 0.46); x.lineTo(S * 0.16, 0); x.lineTo(0, S * 0.46); x.lineTo(-S * 0.16, 0); x.closePath(); x.fill(); x.fillStyle = 'rgba(160,220,255,0.7)'; x.beginPath(); x.moveTo(0, -S * 0.46); x.lineTo(S * 0.16, 0); x.lineTo(0, 0); x.fill(); });
  // web: radial strands and rings
  at(6, S => { x.translate(S / 2, S / 2); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 2.5; for (let i = 0; i < 10; i++) { const a = i / 10 * 6.283; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * S * 0.48, Math.sin(a) * S * 0.48); x.stroke(); } for (let k = 1; k <= 4; k++) { x.beginPath(); for (let i = 0; i <= 10; i++) { const a = i / 10 * 6.283, r = S * 0.11 * k * (0.9 + 0.1 * Math.cos(i * 3)); i ? x.lineTo(Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); } });
  at(7, S => { x.strokeStyle = 'rgba(255,255,255,1)'; x.lineWidth = 7; x.beginPath(); x.arc(S / 2, S / 2, S * 0.4, 0, 6.283); x.stroke(); x.fillStyle = radial(S / 2, S / 2, S / 2, [[0.7, 'rgba(255,255,255,0)'], [0.82, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]); x.fillRect(0, 0, S, S); });
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

class Particles {
  constructor(scene, tex, N, additive) {
    this.N = N; this.n = 0;
    const g = new THREE.BufferGeometry(), A = (k, s) => { const a = new THREE.BufferAttribute(new Float32Array(N * s), s); a.setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, a); return a.array; };
    this.pos = A('position', 3); this.col = A('aCol', 4); this.sz = A('aSize', 1); this.rot = A('aRot', 1); this.tile = A('aTile', 1);
    this.vel = new Float32Array(N * 3); this.life = new Float32Array(N); this.max = new Float32Array(N); this.grav = new Float32Array(N); this.drag = new Float32Array(N);
    this.c0 = new Float32Array(N * 4); this.c1 = new Float32Array(N * 4); this.s0 = new Float32Array(N); this.s1 = new Float32Array(N); this.spin = new Float32Array(N);
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: { tAtlas: { value: tex }, uScale: { value: 500 }, uGain: GAIN }, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: `attribute vec4 aCol; attribute float aSize, aRot, aTile; uniform float uScale; varying vec4 vC; varying float vR, vT;
        void main(){ vC = aCol; vR = aRot; vT = aTile; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
          // fade particles right in front of the lens and cap their size, so effects never white out the screen
          vC.a *= smoothstep(0.8, 3.5, -mv.z); gl_PointSize = min(aSize * uScale / max(0.5, -mv.z), uScale * 0.45); }`,
      fragmentShader: `uniform sampler2D tAtlas; uniform float uGain; varying vec4 vC; varying float vR, vT;
        void main(){ vec2 p = gl_PointCoord - 0.5; float c = cos(vR), s = sin(vR); p = mat2(c, -s, s, c) * p + 0.5; if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) discard;
          vec2 uv = vec2((mod(vT, 4.0) + p.x) / 4.0, (1.0 - floor(vT / 4.0)) * 0.5 + (1.0 - p.y) * 0.5); vec4 t = texture2D(tAtlas, uv);
          ${additive ? 'gl_FragColor = vec4(vC.rgb * t.a * vC.a * uGain, 1.0);' : 'gl_FragColor = vec4(vC.rgb * t.rgb, t.a * vC.a); if (gl_FragColor.a < 0.01) discard;'} }`,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = additive ? 6 : 5; scene.add(this.points);
  }
  spawn(o) {
    const k = this.n = (this.n + 1) % this.N, { p, v } = o;
    this.pos[k * 3] = p.x; this.pos[k * 3 + 1] = p.y; this.pos[k * 3 + 2] = p.z; this.vel[k * 3] = v.x; this.vel[k * 3 + 1] = v.y; this.vel[k * 3 + 2] = v.z;
    this.life[k] = this.max[k] = o.life; this.grav[k] = o.grav || 0; this.drag[k] = o.drag ?? 1.2; this.s0[k] = o.size; this.s1[k] = o.sizeEnd ?? o.size; this.spin[k] = o.spin || 0;
    this.c0.set(o.c0, k * 4); this.c1.set(o.c1, k * 4); this.rot[k] = Math.random() * 6.283; this.tile[k] = o.tile;
  }
  update(dt) {
    const { pos, vel, life, max, col, sz, rot } = this;
    for (let k = 0; k < this.N; k++) {
      if (life[k] <= 0) { if (sz[k] !== 0) sz[k] = 0; continue; }
      life[k] -= dt; const t = 1 - Math.max(0, life[k]) / max[k], d = Math.max(0, 1 - this.drag[k] * dt);
      vel[k * 3] *= d; vel[k * 3 + 1] = vel[k * 3 + 1] * d - this.grav[k] * dt; vel[k * 3 + 2] *= d;
      pos[k * 3] += vel[k * 3] * dt; pos[k * 3 + 1] += vel[k * 3 + 1] * dt; pos[k * 3 + 2] += vel[k * 3 + 2] * dt;
      for (let j = 0; j < 4; j++) col[k * 4 + j] = this.c0[k * 4 + j] + (this.c1[k * 4 + j] - this.c0[k * 4 + j]) * t;
      // fade in quickly, out smoothly
      col[k * 4 + 3] *= Math.min(1, t * 12);
      sz[k] = this.s0[k] + (this.s1[k] - this.s0[k]) * t; rot[k] += this.spin[k] * dt;
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.aCol.needsUpdate = a.aSize.needsUpdate = a.aRot.needsUpdate = a.aTile.needsUpdate = true;
  }
}

// colour helpers: [r,g,b,a] in linear-ish 0..n (values above 1 glow brighter in additive)
const C = (hex, a = 1, k = 1) => { const c = new THREE.Color(hex); return [c.r * k, c.g * k, c.b * k, a]; };
const PRESET = {
  fire: { tile: 1, add: true, c0: C(0xffd27a, 0.85, 1.6), c1: C(0xff3a08, 0, 1.2), grav: -5, drag: 2, spin: 2 },
  ember: { tile: 0, add: true, c0: C(0xffc060, 1, 2.5), c1: C(0xff4010, 0, 1.5), grav: -2, drag: 0.6 },
  spark: { tile: 0, add: true, c0: C(0xfff0c0, 1, 3), c1: C(0xff8020, 0, 2), grav: 14, drag: 0.8 },
  glow: { tile: 0, add: true, c0: C(0xffffff, 0.9, 1.3), c1: C(0xffffff, 0, 1), grav: 0, drag: 2 },
  smoke: { tile: 2, add: false, c0: C(0x3a3836, 0.75), c1: C(0x6a6a68, 0), grav: -2.2, drag: 1.4, spin: 0.6 },
  steam: { tile: 2, add: false, c0: C(0xe8f4ff, 0.3), c1: C(0xffffff, 0), grav: -1.5, drag: 1.6, spin: 0.5 },
  dust: { tile: 2, add: false, c0: C(0x9a8a74, 0.45), c1: C(0xb0a490, 0), grav: -0.5, drag: 2, spin: 0.4 },
  snow: { tile: 4, add: false, c0: C(0xffffff, 1), c1: C(0xe0f4ff, 0), grav: 1.5, drag: 1.5, spin: 1.5 },
  ice: { tile: 5, add: true, c0: C(0xcff4ff, 1, 1.6), c1: C(0x6fc8ff, 0, 1), grav: 12, drag: 0.6, spin: 6 },
  frost: { tile: 0, add: true, c0: C(0x9fdcff, 0.3, 1), c1: C(0x4aa8ff, 0, 1), grav: 0, drag: 2.5 },
  web: { tile: 6, add: false, c0: C(0xffffff, 0.95), c1: C(0xffffff, 0), grav: 3, drag: 2, spin: 1 },
  toxic: { tile: 2, add: true, c0: C(0x9dff4a, 0.5, 1.1), c1: C(0x1a8a10, 0, 1), grav: -1, drag: 1.5, spin: 1 },
  spore: { tile: 0, add: true, c0: C(0xc8ff60, 1, 2), c1: C(0x40ff20, 0, 1), grav: -0.4, drag: 1.2 },
  electric: { tile: 3, add: true, c0: C(0xdff6ff, 1, 3), c1: C(0x5ab8ff, 0, 2), grav: 0, drag: 3, spin: 20 },
  ring: { tile: 7, add: true, c0: C(0xffffff, 1, 1.5), c1: C(0xffffff, 0, 1), grav: 0, drag: 0 },
};

// beam ribbon: points along a line, faced toward the camera
const beamMats = {};
function beamMat(kind) {
  if (beamMats[kind]) return beamMats[kind];
  const m = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uCol: { value: new THREE.Color() }, uCore: { value: new THREE.Color() }, uA: { value: 1 }, uGain: GAIN }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `attribute vec2 aUv; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uT, uA, uGain; uniform vec3 uCol, uCore; varying vec2 vUv;
      float h(float n){ return fract(sin(n) * 43758.5453); } float n1(float x){ float i = floor(x), f = fract(x); return mix(h(i), h(i + 1.0), f * f * (3.0 - 2.0 * f)); }
      void main(){ float a = abs(vUv.y * 2.0 - 1.0), core = smoothstep(0.35, 0.0, a), edge = smoothstep(1.0, 0.0, a);
        float flow = ${kind === 'web' ? '1.0' : '0.65 + 0.35 * n1(vUv.x * 0.8 - uT * 9.0) + 0.25 * n1(vUv.x * 3.0 + uT * 13.0)'};
        vec3 c = uCol * edge * flow + uCore * core; gl_FragColor = vec4(c * uA * uGain, 1.0); }` });
  return beamMats[kind] = m;
}
export class Beam {
  constructor(scene, kind, n, width, color, core) {
    this.scene = scene; this.n = n; this.width = width; this.pts = Array.from({ length: n }, () => V());
    const g = new THREE.BufferGeometry(); this.posA = new THREE.BufferAttribute(new Float32Array(n * 2 * 3), 3); this.posA.setUsage(THREE.DynamicDrawUsage); g.setAttribute('position', this.posA);
    const uv = new Float32Array(n * 4); for (let i = 0; i < n; i++) { uv.set([i, 0, i, 1], i * 4); } g.setAttribute('aUv', new THREE.BufferAttribute(uv, 2));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = beamMat(kind).clone(); this.mat.uniforms.uGain = GAIN; this.mat.uniforms.uCol.value.set(color); this.mat.uniforms.uCore.value.set(core ?? 0xffffff);
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; scene.add(this.mesh);
  }
  // straight line a->b with optional sag (rope), jitter (lightning) and wave (toxic)
  set(a, b, o = {}) {
    const n = this.n, sag = o.sag || 0, jit = o.jitter || 0, wave = o.wave || 0, t = G.time;
    for (let i = 0; i < n; i++) {
      const f = i / (n - 1), p = this.pts[i].lerpVectors(a, b, f);
      if (sag) p.y -= Math.sin(f * Math.PI) * sag;
      if (jit && i > 0 && i < n - 1) p.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(jit));
      if (wave) { const s = Math.sin(f * 14 - t * 10) * wave * Math.sin(f * Math.PI); p.x += s * 0.7; p.y += Math.cos(f * 11 - t * 8) * wave * Math.sin(f * Math.PI) * 0.7; }
    }
    this.build(o.width ?? this.width);
  }
  setPoints(arr, width) { for (let i = 0; i < this.n; i++) this.pts[i].copy(arr[Math.min(i, arr.length - 1)]); this.build(width ?? this.width); }
  build(w) {
    const cam = G.camera.position, P = this.posA.array;
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[i], q = this.pts[Math.min(this.n - 1, i + 1)], r = this.pts[Math.max(0, i - 1)];
      _b.subVectors(q, r); _c.subVectors(cam, p); _d.crossVectors(_b, _c).normalize().multiplyScalar(w / 2);
      P[i * 6] = p.x - _d.x; P[i * 6 + 1] = p.y - _d.y; P[i * 6 + 2] = p.z - _d.z; P[i * 6 + 3] = p.x + _d.x; P[i * 6 + 4] = p.y + _d.y; P[i * 6 + 5] = p.z + _d.z;
    }
    this.posA.needsUpdate = true; this.mat.uniforms.uT.value = G.time;
  }
  set visible(v) { this.mesh.visible = v; }
  get visible() { return this.mesh.visible; }
  alpha(a) { this.mat.uniforms.uA.value = a; }
  dispose() { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mat.dispose(); }
}

export class VFX {
  constructor(scene) {
    this.scene = scene; const tex = atlas();
    this.add = new Particles(scene, tex, 5000, true); this.alpha = new Particles(scene, tex, 2500, false);
    this.items = [];
    // chain link (shared) and fireball shader
    const link = new THREE.TorusGeometry(0.11, 0.035, 6, 12); link.scale(1, 1.7, 1); this.linkGeo = link;
    this.chainMat = new THREE.MeshStandardMaterial({ color: 0x2a1208, emissive: 0xff5a10, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.35 });
    this.fireMat = new THREE.ShaderMaterial({ uniforms: { uT: { value: 0 }, uGain: GAIN }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vP; void main(){ vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uT, uGain; varying vec3 vN, vP; float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
        float n3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y), mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y), f.z); }
        void main(){ float n = n3(vP * 3.0 + vec3(0.0, -uT * 4.0, uT)) * 0.6 + n3(vP * 7.0 - vec3(0.0, uT * 6.0, 0.0)) * 0.4; float rim = pow(1.0 - abs(vN.z), 1.5);
          vec3 c = mix(vec3(3.0, 2.2, 1.0), vec3(2.2, 0.6, 0.1), smoothstep(0.3, 0.8, n + rim * 0.5)); gl_FragColor = vec4(c * (0.55 + n * 0.7) * (1.0 - rim * 0.6) * mix(1.0, uGain, 0.8), 1.0); }` });
    this.shockMat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uA: { value: 1 }, uGain: GAIN }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN, vV; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform vec3 uCol; uniform float uA, uGain; varying vec3 vN, vV; void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uCol * f * uA * 0.75 * uGain, 1.0); }` });
    this.marks = {}; this.markGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }
  // ---------- particles ----------
  emit(type, p, o = {}) {
    const P = PRESET[type], sys = P.add ? this.add : this.alpha, n = o.n || 1, sp = o.speed ?? 2, spread = o.spread ?? 0.2, dir = o.dir;
    const c0 = o.color ? C(o.color, P.c0[3], P.add ? 2 : 1) : P.c0, c1 = o.color2 ? C(o.color2, P.c1[3], 1) : o.color ? C(o.color, 0, 1) : P.c1;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, y = Math.random() * 2 - 1, r = Math.sqrt(1 - y * y), s = sp * (0.3 + Math.random() * 0.7);
      _a.set(p.x + (Math.random() - 0.5) * spread, p.y + (Math.random() - 0.5) * spread, p.z + (Math.random() - 0.5) * spread);
      _b.set(Math.cos(a) * r * s, y * s, Math.sin(a) * r * s); if (dir) _b.add(dir);
      const life = (o.life ?? 1) * (0.6 + Math.random() * 0.6), size = (o.size ?? 1) * (0.7 + Math.random() * 0.6);
      sys.spawn({ p: _a, v: _b, life, size, sizeEnd: size * (o.grow ?? (type === 'smoke' || type === 'steam' || type === 'dust' ? 3 : type === 'fire' ? 0.4 : 1)), c0, c1, grav: o.grav ?? P.grav, drag: o.drag ?? P.drag, spin: (Math.random() - 0.5) * 2 * (o.spin ?? P.spin ?? 0), tile: P.tile });
    }
  }
  // ---------- timed items ----------
  timed(life, fn, done) { this.items.push({ age: 0, life, fn, done }); }
  beam(kind, a, b, o = {}) {
    const B = new Beam(this.scene, kind, o.n || (o.jitter || o.wave ? 12 : 2), o.width || 0.1, o.color ?? 0xffffff, o.core);
    B.set(a, b, o); const life = o.life ?? 0.2;
    this.timed(life, (t, dt) => { if (o.follow) { const r = o.follow(); if (r) B.set(r[0], r[1], o); } else if (o.jitter) B.set(a, b, o); B.alpha(o.fade === false ? 1 : 1 - t * t); }, () => B.dispose());
    return B;
  }
  // a bright streak that races from a to b (bullet tracer), then a spark where it lands
  tracer(a, b, color = 0xffc870, width = 0.04) {
    const A = a.clone(), Bp = b.clone(), L = A.distanceTo(Bp), seg = Math.min(L, 5), dur = Math.max(0.03, L / 600);
    const B = new Beam(this.scene, 'energy', 2, width, color, 0xffffff), s = V(), e = V();
    this.timed(dur + 0.03, t => { const f = Math.min(1, t * (dur + 0.03) / dur), head = f * L; e.lerpVectors(A, Bp, head / L || 0); s.lerpVectors(A, Bp, Math.max(0, head - seg) / L || 0); B.set(s, e); B.alpha(f < 1 ? 1 : 0.4); }, () => B.dispose());
  }
  shock(p, o = {}) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, o.dome ? Math.PI / 2 : Math.PI), this.shockMat.clone()); m.material.uniforms.uGain = GAIN; m.material.uniforms.uCol.value.set(o.color ?? 0xffffff);
    m.position.copy(p); this.scene.add(m); const R = o.radius || 8;
    this.timed(o.life || 0.6, t => { const e = 1 - (1 - t) ** 3; m.scale.setScalar(0.3 + R * e); if (o.flat) m.scale.y *= 0.25; m.material.uniforms.uA.value = (1 - t) ** 1.5 * (G.camera.position.distanceTo(m.position) < m.scale.x ? 0.35 : 1); }, () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); });
  }
  fireball(p, r, life, grow = 1) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), this.fireMat); m.position.copy(p); this.scene.add(m);
    this.timed(life, t => { m.scale.setScalar(r * (0.4 + 0.6 * Math.min(1, t * 4)) * (1 + t * grow)); m.position.y += 0.02; }, () => { this.scene.remove(m); m.geometry.dispose(); });
    return m;
  }
  // a mark on the ground (or a wall): scorch, frost, web, toxic
  mark(kind, p, size, life = 20, normal = null) {
    if (!this.marks[kind]) {
      const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
      const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
      if (kind === 'scorch') { g.addColorStop(0, 'rgba(8,6,4,0.95)'); g.addColorStop(0.55, 'rgba(20,14,10,0.7)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); for (let i = 0; i < 40; i++) { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; const a = Math.random() * 6.28; x.beginPath(); x.moveTo(S / 2, S / 2); x.lineTo(S / 2 + Math.cos(a) * S * 0.48, S / 2 + Math.sin(a) * S * 0.48); x.stroke(); } }
      else if (kind === 'frost') { g.addColorStop(0, 'rgba(220,245,255,0.95)'); g.addColorStop(0.6, 'rgba(180,230,255,0.6)'); g.addColorStop(1, 'rgba(180,230,255,0)'); x.fillStyle = g; x.fillRect(0, 0, S, S); x.strokeStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 60; i++) { const a = Math.random() * 6.28, r = Math.random() * S * 0.45; x.lineWidth = 1 + Math.random() * 2; x.beginPath(); x.moveTo(S / 2 + Math.cos(a) * r * 0.3, S / 2 + Math.sin(a) * r * 0.3); x.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r); x.stroke(); } }
      else if (kind === 'toxic') { for (let i = 0; i < 30; i++) { const px = S / 2 + (Math.random() - 0.5) * S * 0.6, py = S / 2 + (Math.random() - 0.5) * S * 0.6, gg = x.createRadialGradient(px, py, 0, px, py, S * 0.2); gg.addColorStop(0, 'rgba(120,255,60,0.6)'); gg.addColorStop(1, 'rgba(40,120,20,0)'); x.fillStyle = gg; x.fillRect(0, 0, S, S); } }
      else { x.translate(S / 2, S / 2); x.strokeStyle = 'rgba(255,255,255,0.95)'; x.lineWidth = 3; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * S * 0.48, Math.sin(a) * S * 0.48); x.stroke(); } for (let k = 1; k <= 5; k++) { x.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283, r = S * 0.09 * k; i ? x.quadraticCurveTo(Math.cos(a - 0.26) * r * 0.85, Math.sin(a - 0.26) * r * 0.85, Math.cos(a) * r, Math.sin(a) * r) : x.moveTo(Math.cos(a) * r, Math.sin(a) * r); } x.stroke(); } }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      this.marks[kind] = new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, blending: kind === 'frost' || kind === 'toxic' ? THREE.AdditiveBlending : THREE.NormalBlending });
    }
    const m = new THREE.Mesh(this.markGeo, this.marks[kind].clone()); m.position.copy(p); m.position.y += 0.03; m.scale.set(size, 1, size); m.rotation.y = Math.random() * 6.28; m.renderOrder = 3;
    if (normal && Math.abs(normal.y) < 0.7) { m.lookAt(_a.copy(m.position).add(normal)); m.rotateX(Math.PI / 2); m.position.addScaledVector(normal, 0.03); }
    this.scene.add(m); this.timed(life, t => { m.material.opacity = t < 0.8 ? 1 : (1 - t) / 0.2; }, () => { this.scene.remove(m); m.material.dispose(); });
    return m;
  }
  // a silk texture for cocoons and webbed cars
  webTex() {
    if (this._web) return this._web; const S = 256, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.strokeStyle = '#fff'; x.lineCap = 'round';
    for (let i = 0; i < 70; i++) { x.lineWidth = 0.8 + Math.random() * 2.2; x.globalAlpha = 0.5 + Math.random() * 0.5; const y0 = Math.random() * S, y1 = y0 + (Math.random() - 0.5) * S * 0.8; x.beginPath(); x.moveTo(0, y0); x.bezierCurveTo(S * 0.33, y0 + (Math.random() - 0.5) * 60, S * 0.66, y1 + (Math.random() - 0.5) * 60, S, y1); x.stroke(); }
    for (let i = 0; i < 40; i++) { x.lineWidth = 0.7 + Math.random() * 1.2; x.globalAlpha = 0.4 + Math.random() * 0.4; const xx = Math.random() * S; x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx + (Math.random() - 0.5) * 60, S); x.stroke(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); return this._web = t;
  }
  // hot chain links strung along a sagging curve from a to b
  chain(getEnds, life, links = 26) {
    const im = new THREE.InstancedMesh(this.linkGeo, this.chainMat, links); im.frustumCulled = false; im.castShadow = true; this.scene.add(im);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), s = V().set(1, 1, 1), up = V().set(0, 1, 0);
    const pts = []; for (let i = 0; i <= links; i++) pts.push(V());
    this.timed(life, (t, dt) => {
      const ends = getEnds(); if (!ends) return; const [a, b] = ends, L = a.distanceTo(b), sag = Math.max(0.2, L * 0.08) * (1 - Math.min(1, t * 3)), extend = Math.min(1, t * life / 0.12);
      for (let i = 0; i <= links; i++) { const f = i / links * extend; pts[i].lerpVectors(a, b, f); pts[i].y -= Math.sin(f * Math.PI) * sag; pts[i].x += Math.sin(G.time * 30 + i) * 0.02; }
      for (let i = 0; i < links; i++) { const d = _a.subVectors(pts[i + 1], pts[i]); const len = d.length() || 1e-3; q.setFromUnitVectors(up, d.multiplyScalar(1 / len)); q2.setFromAxisAngle(up, i % 2 ? Math.PI / 2 : 0); q.multiply(q2); s.set(1, len / 0.3, 1); m.compose(_b.lerpVectors(pts[i], pts[i + 1], 0.5), q, s); im.setMatrixAt(i, m); }
      im.instanceMatrix.needsUpdate = true; this.chainMat.emissiveIntensity = 2 + Math.sin(G.time * 25) * 0.6;
      if (Math.random() < 0.5) this.emit('ember', pts[(Math.random() * links) | 0], { n: 1, speed: 1.5, life: 0.5, size: 0.25 });
    }, () => { this.scene.remove(im); im.dispose(); });
  }
  // the big bang: fireball, shock dome, flames, smoke column, sparks, debris, scorch
  explosion(p, s = 1) {
    this.fireball(p, 1.8 * s, 0.4, 1.4); this.shock(p, { radius: 8 * s, color: 0xff8a30, life: 0.4 });
    this.emit('fire', p, { n: Math.round(30 * s), speed: 9 * s, life: 0.8, size: 1.8 * s, spread: 1.5 * s });
    this.emit('spark', p, { n: Math.round(40 * s), speed: 22 * s, life: 0.9, size: 0.18, spread: 0.5 });
    this.emit('smoke', _a.copy(p).setY(p.y + 1), { n: Math.round(26 * s), speed: 3 * s, life: 3.5, size: 2.4 * s, spread: 2 * s, grav: -3 });
    this.emit('dust', p, { n: Math.round(16 * s), speed: 8 * s, life: 1.4, size: 1.6 * s, spread: 1, grav: 1 });
    const gy = G.world.groundAt(p.x, p.z); if (p.y - gy < 3) this.mark('scorch', _a.set(p.x, gy, p.z), 6 * s, 40);
  }
  update(dt) {
    // particle size is in metres: convert to pixels for the current screen height and field of view
    if (G.renderer && G.camera) { const h = G.renderer.getDrawingBufferSize(this._v2 || (this._v2 = new THREE.Vector2())).y; this.add.points.material.uniforms.uScale.value = this.alpha.points.material.uniforms.uScale.value = h / (2 * Math.tan(G.camera.fov * Math.PI / 360)); }
    GAIN.value = 1 - 0.5 * (G.sky ? G.sky.night : 0);
    this.add.update(dt); this.alpha.update(dt); this.fireMat.uniforms.uT.value = G.time;
    for (let i = this.items.length - 1; i >= 0; i--) { const it = this.items[i]; it.age += dt; const t = Math.min(1, it.age / it.life); it.fn && it.fn(t, dt); if (it.age >= it.life) { it.done && it.done(); this.items.splice(i, 1); } }
  }
}
