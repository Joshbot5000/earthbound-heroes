// The four playable heroes and their powers. Each hero has their own way of crossing the
// city (hold TRAVERSE) and three abilities on cooldowns that spend energy.
import * as THREE from 'three';
import { G, clamp, damp } from './util.js';
import { Geo } from './geo.js';
import { setRigOpacity } from './rig.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), hit = {};

export const HEROES = [
  { id: 'vesper', name: 'VESPER', title: 'The Weaver', color: '#37f5d6', rope: 0xd8fff8, melee: 1.15,
    blurb: 'Swings between towers on silk lines. Fast, acrobatic, built for the skyline.',
    look: { suit: 0x1a1d24, second: 0x10343a, pattern: 'web', glowK: 1.6, helmet: true, lenses: 0x9ffff0, accent: 0x37f5d6, accentGlow: 2.2, gloves: 0x101214, boots: 0x101214, emblem: true, rough: 0.38 },
    traverse: 'Silk Swing', tip: 'Hold E to swing, steer hard or tap E to turn, Space to launch, hold Space to glide',
    powers: [{ name: 'Zip Line', fn: 'zip', cost: 8, cd: 0.45, icon: '➶' }, { name: 'Web Burst', fn: 'webBurst', cost: 30, cd: 6, icon: '✺' }, { name: 'Silk Storm', fn: 'silkStorm', cost: 60, cd: 16, icon: '❋' }] },
  { id: 'cinder', name: 'CINDER', title: 'Hellfire Warden', color: '#ff7a2a', rope: 0xff8a30, armor: 0.75,
    blurb: 'Flies on jets of flame and drags enemies around on burning chains.',
    look: { suit: 0x1c0d0a, second: 0x121214, pattern: 'magma', glowK: 2.2, helmet: true, helmetMat: 0x1a0c08, lenses: 0xff7a1a, accent: 0xff6a1a, accentGlow: 3, gloves: 0x2a1a14, boots: 0x18100c, emblem: true, scale: 1.06, metal: 0.35 },
    traverse: 'Jet Burst', tip: 'Hold to fly where you are looking',
    powers: [{ name: 'Hellfire Chains', fn: 'chains', cost: 28, cd: 5, icon: '⛓' }, { name: 'Fireball', fn: 'fireball', cost: 18, cd: 1.1, icon: '☄' }, { name: 'Meteor Dive', fn: 'meteor', cost: 55, cd: 14, icon: '✹' }] },
  { id: 'rime', name: 'RIME', title: "Winter's Edge", color: '#9fe8ff', rope: 0xbfeaff, freezesWater: true,
    blurb: 'Skates on ice built out of thin air. Freezes crowds, cars and the sea itself.',
    look: { suit: 0xe6f6ff, second: 0x5aa8d8, pattern: 'ice', glowK: 0.8, helmet: true, helmetMat: 0xdcf1fb, lenses: 0x9fe8ff, accent: 0x9fe8ff, accentGlow: 2, gloves: 0xbfe6ff, boots: 0x3f7fb0, rough: 0.18, metal: 0.35 },
    traverse: 'Ice Slide', tip: 'Hold to skate through the air where you look',
    powers: [{ name: 'Frost Blast', fn: 'frostBlast', cost: 26, cd: 5, icon: '❄' }, { name: 'Glacier Spikes', fn: 'spikes', cost: 30, cd: 6, icon: '▲' }, { name: 'Whiteout', fn: 'whiteout', cost: 65, cd: 22, icon: '☃' }] },
  { id: 'vector', name: 'VECTOR', title: 'Patient Zero', color: '#7dff3a', rope: 0x7dff3a, speed: 1.12, regen: 11,
    blurb: 'Vanishes, blinks through space and seeds a virus that spreads through people and machines.',
    look: { suit: 0x111511, second: 0x182a12, pattern: 'circuit', glowK: 1.8, helmet: true, helmetMat: 0x0c0f0b, lenses: 0x7dff3a, accent: 0x7dff3a, accentGlow: 2.6, gloves: 0x0c0f0b, boots: 0x0c0f0b, emblem: true },
    traverse: 'Blink', tip: 'Tap to teleport forward, hold in the air to glide',
    powers: [{ name: 'Cloak', fn: 'cloak', cost: 30, cd: 14, icon: '◌' }, { name: 'Contagion', fn: 'contagion', cost: 24, cd: 3, icon: '☣' }, { name: 'Blackout', fn: 'blackout', cost: 60, cd: 20, icon: '⚡' }] },
];

const ICE_N = 260;
// a cluster of hexagonal ice crystals, tallest in the middle, leaning outward; unit height
function crystalCluster() {
  const parts = [], add = (r, h, x, z, tx, tz) => { const c = new THREE.CylinderGeometry(0, r, h * 0.28, 6, 1).translate(0, h * 0.86, 0), b = new THREE.CylinderGeometry(r, r * 1.08, h * 0.72, 6, 1).translate(0, h * 0.36, 0);
    for (const q of [c, b]) { q.rotateZ(tx); q.rotateX(tz); q.translate(x, 0, z); parts.push(q.toNonIndexed()); } };
  add(0.62, 1, 0, 0, 0, 0); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283 + Math.random() * 0.5, d = 0.55 + Math.random() * 0.25; add(0.28 + Math.random() * 0.18, 0.4 + Math.random() * 0.35, Math.cos(a) * d, Math.sin(a) * d, -Math.cos(a) * 0.45, Math.sin(a) * 0.45); }
  let n = 0; for (const q of parts) n += q.attributes.position.count; const pos = new Float32Array(n * 3); let o = 0; for (const q of parts) { pos.set(q.attributes.position.array, o); o += q.attributes.position.array.length; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
export class Powers {
  constructor() {
    this.cd = [0, 0, 0]; this.timers = []; this.shots = []; this.zones = []; this.cloakT = 0; this.blackoutT = 0; this.blizzard = null; this.met = null; this.retry = 0; this.iceI = 0; this.iceD = 0; this.jetS = 0;
    // ice path: a faceted slab, thicker in the middle, so it reads as carved ice rather than a box
    const g = new THREE.CylinderGeometry(1, 1, 0.16, 6, 1); g.scale(0.95, 1, 1.45);
    this.iceMat = new THREE.MeshStandardMaterial({ color: 0xcdf2ff, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.72, emissive: 0x3a8fc0, emissiveIntensity: 0.6, flatShading: true });
    this.ice = new THREE.InstancedMesh(g, this.iceMat, ICE_N); this.ice.frustumCulled = false; this.iceUntil = new Float32Array(ICE_N); this.iceM = new THREE.Matrix4();
    const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < ICE_N; i++) this.ice.setMatrixAt(i, z); G.scene.add(this.ice);
    this.spikeGeo = crystalCluster();
    this.ballGeo = new THREE.SphereGeometry(0.55, 12, 8);
  }
  get pl() { return G.player; }
  reset() { this.uncloak(); this.met = null; if (this.blizzard) { this.blizzard = null; G.sky.override = null; } }
  after(t, fn) { this.timers.push({ t, fn }); }
  cast(i) {
    const p = this.pl, d = p.hero.powers[i]; if (this.cd[i] > 0 || p.zip || this.met) return;
    if (p.energy < d.cost) { G.ui.toast('Not enough energy'); G.audio.deny(); return; }
    if (this[d.fn]() === false) return; p.energy -= d.cost; this.cd[i] = d.cd; G.audio.power(p.heroIndex, i);
  }
  camF(flat) { G.camera.getWorldDirection(_a); if (flat) { _a.y = 0; _a.normalize(); } return _a.clone(); }
  hand() { return this.pl.pos.clone().setY(this.pl.pos.y + 1.5); }

  // ---------- traversal ----------
  traverse(dt, I, wish, wl) {
    const p = this.pl, v = p.vel, id = p.hero.id; this.retry -= dt;
    if (this.met) return this.meteorStep(dt);
    if (id === 'vesper') {
      if (I.down.traverse && !p.swing && !p.zip && (I.hit.traverse || !p.grounded) && this.retry <= 0) {
        if (!p.startSwing(wish)) { this.retry = 0.2; if (I.hit.traverse && p.grounded) { v.y = 15; v.addScaledVector(wl > 0.1 ? wish : this.camF(true), 9); p.grounded = false; p.pos.y += 0.2; G.audio.jump(); } }
      }
      return false;
    }
    if (id === 'cinder') {
      if (!I.down.traverse || p.energy < 2) { this.jetS = 0; return false; }
      p.endSwing(false); p.energy -= 17 * dt; const d = this.camF(false); if (p.grounded) { d.y = Math.max(d.y, 0.45); d.normalize(); p.pos.y += 0.15; p.grounded = false; }
      this.jetS = damp(this.jetS || Math.max(14, v.length()), 46, 1.2, dt); v.lerp(d.multiplyScalar(this.jetS), 1 - Math.exp(-4 * dt));
      // twin jets of flame from the boots and hands: blue-white at the nozzle, orange flame, then heat haze and smoke
      for (const s of [-0.18, 0.18]) {
        const q = _b.copy(p.pos).add(_c.set(Math.cos(p.yaw) * s, 0.1, -Math.sin(p.yaw) * s)), back = _c.copy(v).normalize().multiplyScalar(-14).add(_a.set(0, -6, 0));
        G.vfx.emit('fire', q, { n: 2, speed: 1, life: 0.32, size: 0.55, grow: 2.2, dir: back, drag: 3, spread: 0.08 });
        G.vfx.emit('glow', q, { n: 1, speed: 0, life: 0.05, size: 0.5, color: 0x9ac8ff });
        if (Math.random() < 0.3) G.vfx.emit('ember', q, { n: 1, speed: 2, life: 0.6, size: 0.1, dir: back });
      }
      if (Math.random() < 0.25) G.vfx.emit('smoke', _b.copy(p.pos), { n: 1, speed: 0.5, life: 1.6, size: 0.6, grav: -0.5 });
      if (Math.random() < dt * 12) G.fx.flash(p.pos, 0xff8a30, 18, 0.12);
      p.override = { gravity: 0, yaw: Math.atan2(v.x, v.z), anim: { fly: true, air: false } }; G.audio.jet(true); return true;
    }
    if (id === 'rime') {
      if (!I.down.traverse || p.energy < 2) { this.iceS = 0; return false; }
      p.endSwing(false); p.energy -= 13.5 * dt; const d = this.camF(false); d.y = clamp(d.y, -0.5, 0.5); d.normalize();
      const g = Geo.height(p.pos.x, p.pos.z); if (p.pos.y < Math.max(g, 0) + 0.7) { d.y = Math.max(d.y, 0.12); d.normalize(); p.pos.y = Math.max(p.pos.y, Math.max(g, 0) + 0.25); }
      this.iceS = damp(this.iceS || Math.max(12, v.length()), 33, 1.4, dt); v.lerp(d.multiplyScalar(this.iceS), 1 - Math.exp(-7 * dt)); p.grounded = false;
      this.iceD += this.iceS * dt;
      if (this.iceD > 1.9) {
        this.iceD = 0; const i = this.iceI = (this.iceI + 1) % ICE_N; _b.copy(p.pos).setY(p.pos.y - 0.12);
        this.iceM.lookAt(_b, _c.copy(_b).add(v), THREE.Object3D.DEFAULT_UP); this.iceM.setPosition(_b); this.ice.setMatrixAt(i, this.iceM); this.iceUntil[i] = G.time + 5; this.ice.instanceMatrix.needsUpdate = true;
        G.vfx.emit('frost', _b, { n: 3, speed: 1.2, life: 0.7, size: 0.9, spread: 1.2 }); G.vfx.emit('ice', _b, { n: 2, speed: 3, life: 0.8, size: 0.2, spread: 1 });
      }
      // powder and glitter thrown up by the skates
      if (Math.random() < 0.7) G.vfx.emit('snow', _b.copy(p.pos).setY(p.pos.y + 0.05), { n: 1, speed: 1.5, life: 0.9, size: 0.12, dir: _c.copy(v).multiplyScalar(-0.15) });
      if (Math.random() < 0.5) G.vfx.emit('glow', _b.copy(p.pos).setY(p.pos.y + 0.1), { n: 1, speed: 0.4, life: 0.5, size: 0.12, color: 0xbfefff, spread: 1 });
      p.override = { gravity: 0, yaw: Math.atan2(v.x, v.z), anim: { slide: true, air: false } }; G.audio.jet(true, 1); return true;
    }
    if (id === 'vector') {
      if (I.hit.traverse) {
        if (p.energy < 8) { G.audio.deny(); return false; }
        p.energy -= 8; const d = this.camF(false), from = this.hand(); G.world.raycast(from, d, 36, hit); const dist = hit.hit ? Math.max(0, hit.t - 1.3) : 34;
        p.pos.addScaledVector(d, dist); const g = Geo.height(p.pos.x, p.pos.z); if (p.pos.y < g) p.pos.y = g + 0.1;
        const sp = Math.max(18, v.length()); v.copy(d).multiplyScalar(sp); v.y = Math.max(v.y, 4); p.jumps = 1; p.iframes = Math.max(p.iframes, 0.3); p.grounded = false;
        this.blinkFx(from, this.hand()); G.audio.blink();
      } else if (I.down.traverse && !p.grounded && v.y < -3.5) { v.y = damp(v.y, -3.5, 8, dt); if (wl > 0.1) v.addScaledVector(wish, 14 * dt); }
      return false;
    }
    return false;
  }

  // ---------- Vesper ----------
  zip() {
    const p = this.pl, a = p.aim(170);
    // nothing to grab: a web-zip dash in the direction you are looking
    if (!a.hit) { p.endSwing(false); const d = a.dir; p.vel.set(d.x * 30, Math.max(d.y * 30, 3), d.z * 30); p.grounded = false; G.audio.thwip(); G.vfx.shock(p.pos.clone().setY(p.pos.y + 1), { radius: 2.5, color: p.hero.rope, life: 0.3 }); return; }
    p.endSwing(false); const to = a.point.clone().addScaledVector(a.dir, -0.9); to.y += a.ny > 0.5 ? 0.6 : 1.2;
    // aimed at (or just below) a rooftop edge: arrive on the edge and catapult over it
    const perch = a.ny > 0.5 || (a.box && a.point.y > a.box.maxy - 4); if (perch && a.box) to.y = Math.max(to.y, a.box.maxy + 0.8);
    p.zip = { to, t: 0, perch }; p.rope.visible = true; p.webShoot = 0; p.hand = -p.hand; if (p.grounded) { p.pos.y += 0.3; p.grounded = false; } G.audio.thwip(); this.webHit(a.point, a.ny > 0.5 ? null : _b.set(a.nx || 0, a.ny || 0, a.nz || 0));
  }
  // web lands: a splat stuck to the surface and a puff of silk
  webHit(pt, normal) { G.vfx.mark('web', pt, 1.6, 6, normal); G.vfx.emit('web', pt, { n: 3, speed: 2, life: 0.4, size: 0.5 }); }
  // a silk line that shoots out from the hand and pins the target
  webShot(from, to, life = 0.5, width = 0.05) { const a = from.clone(), b = to.clone(), B = G.vfx.beam('web', a, a, { width, color: 0xdfe8e8, core: 0xffffff, life, n: 10, fade: false });
    G.vfx.timed(life, t => { const k = Math.min(1, t * life / 0.09); B.set(a, _c.lerpVectors(a, b, k), { sag: (1 - k) * 0.4 + 0.05, width }); B.alpha(t > 0.7 ? (1 - t) / 0.3 : 1); }); }
  webBurst() {
    const p = this.pl, f = this.camF(true), h = this.hand(); let n = 0;
    G.ents.inRange(p.pos, 26, e => { _b.subVectors(e.pos, p.pos).setY(0).normalize(); if (_b.dot(f) < 0.3) return; e.web(8); n++; const t = e.pos.clone().setY(e.pos.y + 1.1); this.webShot(h, t, 0.6); this.after(0.09, () => { G.vfx.mark('web', _c.copy(e.pos), 2.6, 8); G.vfx.emit('web', t, { n: 4, speed: 2.5, life: 0.5, size: 0.7 }); }); });
    G.ents.carsIn(p.pos, 22, c => { _b.subVectors(c.pos, p.pos).setY(0).normalize(); if (_b.dot(f) < 0.3 || c === p.car) return; c.emp = 6; c.vel.multiplyScalar(0.2); for (let k = 0; k < 3; k++) this.webShot(h, c.pos.clone().add(_c.set((Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 2)), 0.7, 0.07); this.after(0.09, () => G.vfx.mark('web', _c.copy(c.pos), 5, 8)); });
    // a fan of web balls that open into nets as they fly
    for (let i = 0; i < 26; i++) { const sp = _b.copy(f).multiplyScalar(18 + Math.random() * 10).add(_c.set((Math.random() - 0.5) * 12, Math.random() * 5, (Math.random() - 0.5) * 12)); G.vfx.emit('web', h, { n: 1, speed: 0.5, life: 0.8, size: 0.25, grow: 6, dir: sp, drag: 2.2, grav: 4 }); }
    G.vfx.shock(h, { radius: 3, color: 0xffffff, life: 0.25 });
    G.ents.panic(p.pos, 20);
  }
  silkStorm() {
    const p = this.pl, c = p.pos.clone().addScaledVector(this.camF(true), 5).setY(p.pos.y + 5), list = [];
    G.ents.inRange(p.pos, 22, e => { list.push(e); e.state = 'down'; e.t = 2.6; e.grounded = false; e.vel.subVectors(c, e.pos).multiplyScalar(2.1); e.vel.y += 6; this.webShot(this.hand(), e.pos.clone().setY(e.pos.y + 1), 0.55); });
    // a whirling funnel of silk strands that winds everyone up into a ball over the centre
    const strands = []; for (let i = 0; i < 9; i++) strands.push({ B: G.vfx.beam('web', c, c, { width: 0.06, color: 0xe8f0f0, core: 0xffffff, life: 0.6, n: 14, fade: false }), a: i / 9 * 6.283, h: 1 + (i % 3) * 1.2 });
    const pts = Array.from({ length: 14 }, () => new THREE.Vector3());
    G.vfx.timed(0.6, t => { for (const s of strands) { for (let j = 0; j < 14; j++) { const f = j / 13, r = (1 - t) * 12 * f + 0.6, an = s.a + t * 9 + f * 2.4; pts[j].set(c.x + Math.cos(an) * r, c.y - 4 + s.h * f * 3 + t * 2, c.z + Math.sin(an) * r); } s.B.setPoints(pts, 0.06); s.B.alpha(1 - t * t); } if (Math.random() < 0.6) G.vfx.emit('web', c, { n: 1, speed: 6, life: 0.4, size: 0.6 }); });
    G.ents.carsIn(p.pos, 16, k => { if (k === p.car) return; k.vel.subVectors(c, k.pos).setY(0).multiplyScalar(1.2); k.vy = 8; k.grounded = false; k.launch = 3; if (k.ai === 'traffic') k.ai = 'none'; k.touched = true; });
    this.after(0.55, () => { for (const e of list) { _b.subVectors(e.pos, c).setY(0).normalize(); e.hit(58, _b, 9, 'player'); e.vel.y = -14; } const gp = c.clone().setY(G.world.groundAt(c.x, c.z)); G.vfx.shock(gp, { radius: 16, color: 0xffffff, life: 0.5, dome: true, flat: true }); G.vfx.mark('web', gp, 14, 12); G.vfx.emit('web', c, { n: 18, speed: 14, life: 0.7, size: 0.9 }); G.vfx.emit('dust', gp, { n: 14, speed: 8, life: 1.2, size: 1.6, spread: 3 }); G.shake = 0.7; G.audio.boom(c, 0.5); });
  }

  // ---------- Cinder ----------
  chains() {
    const p = this.pl, f = this.camF(true), h = this.hand(), tg = [];
    G.ents.inRange(p.pos, 30, e => { _b.subVectors(e.pos, p.pos).setY(0).normalize(); if (_b.dot(f) > 0 && tg.length < 5) tg.push(e); });
    const cars = []; G.ents.carsIn(p.pos, 26, c => { _b.subVectors(c.pos, p.pos).setY(0).normalize(); if (_b.dot(f) > 0.2 && cars.length < 2 && c !== p.car && !c.dead) cars.push(c); });
    // real chain links, glowing hot, lashing out from the hand and dragging the target back; fire licks along them
    const chain = to => { const A = V(), B = V(); G.vfx.chain(() => { A.copy(this.hand()); B.copy(to).setY(to.y + 1); return [A, B]; }, 0.7, 30);
      G.vfx.timed(0.7, () => { if (Math.random() < 0.7) G.vfx.emit('fire', _b.copy(to).setY(to.y + 1), { n: 1, speed: 1.5, life: 0.4, size: 0.9 }); if (Math.random() < 0.5) G.vfx.emit('fire', _b.lerpVectors(this.hand(), _c.copy(to).setY(to.y + 1), Math.random()), { n: 1, speed: 0.5, life: 0.3, size: 0.45 }); }); };
    G.vfx.emit('fire', h, { n: 10, speed: 3, life: 0.4, size: 0.7 }); G.fx.flash(h, 0xff6a1a, 60, 0.4);
    for (const e of tg) { chain(e.pos); e.state = 'stagger'; e.t = 0.5; }
    for (const c of cars) chain(c.pos);
    if (!tg.length && !cars.length) {
      // nothing to grab: the chains whirl round in a burning circle
      const C0 = p.pos.clone(); for (let k = 0; k < 2; k++) { const A = V(), B = V(), ph = k * Math.PI; G.vfx.chain(() => { A.copy(this.hand()); const an = ph + G.time * 14; B.set(C0.x + Math.cos(an) * 8, C0.y + 1.2, C0.z + Math.sin(an) * 8); return [A, B]; }, 0.55, 26); }
      G.vfx.shock(C0.clone().setY(C0.y + 0.4), { radius: 10, color: 0xff6a1a, life: 0.5, flat: true }); G.vfx.emit('fire', C0, { n: 40, speed: 9, life: 0.6, size: 1.2, spread: 2, dir: _b.set(0, 1, 0) }); G.ents.blast(p.pos, 9, 30, 6, null, 'burn'); return;
    }
    this.after(0.32, () => {
      const side = _c.set(-f.z, 0, f.x);
      for (const e of tg) { e.hit(40, _b.copy(side).multiplyScalar(Math.random() < 0.5 ? 1 : -1).addScaledVector(f, 0.6).normalize(), 14, 'player'); e.burning = 5; }
      for (const c of cars) { c.vel.addScaledVector(f, 16).addScaledVector(side, (Math.random() - 0.5) * 20); c.vy = 13; c.grounded = false; c.launch = (Math.random() - 0.5) * 8; if (c.ai !== 'cop') c.ai = 'none'; c.touched = true; c.damage(70); G.wanted.crime(0.5); }
      G.shake = 0.5; G.audio.boom(p.pos, 0.4);
    });
  }
  fireball() {
    // a churning ball of hellfire with a white-hot core, trailing flame, embers and smoke
    const d = this.camF(false), m = new THREE.Mesh(this.fireGeo || (this.fireGeo = new THREE.IcosahedronGeometry(0.6, 3)), G.vfx.fireMat), core = new THREE.Mesh(this.ballGeo, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    core.scale.setScalar(0.55); m.add(core); m.position.copy(this.hand()).addScaledVector(d, 1.2); G.scene.add(m);
    G.vfx.emit('fire', m.position, { n: 12, speed: 3, life: 0.35, size: 0.8 }); G.fx.flash(m.position, 0xff8a30, 50, 0.2);
    this.shots.push({ m, vel: d.multiplyScalar(72), life: 4 });
  }
  explodeFire(pt, big) {
    G.fx.explosion(pt, big); G.vfx.emit('ember', pt, { n: 30 * big, speed: 12 * big, life: 1.6, size: 0.15, spread: 1 }); G.ents.blast(pt, 9 * big, 78 * big, 11 * big, null, 'burn'); this.zones.push({ p: pt.clone(), r: 4.5 * big, t: 5, tick: 0 });
    const h = G.wanted.heli; if (h && h.pos.distanceTo(pt) < 12 * big) G.wanted.hitHeli(130);
  }
  meteor() {
    const p = this.pl, a = p.aim(130); p.endSwing(false); this.met = { to: a.point.clone(), t: 0, down: false };
    if (p.grounded) { p.pos.y += 0.3; p.grounded = false; } p.vel.set(0, 40, 0); p.iframes = 3;
  }
  meteorStep(dt) {
    const p = this.pl, m = this.met, v = p.vel; m.t += dt;
    // wrapped in a comet of fire: a hellfire shell around the hero, a long burning tail and smoke
    if (!m.ball) { m.ball = new THREE.Mesh(this.fireGeo || (this.fireGeo = new THREE.IcosahedronGeometry(0.6, 3)), G.vfx.fireMat); G.scene.add(m.ball); }
    m.ball.position.copy(p.pos).setY(p.pos.y + 0.9); m.ball.scale.setScalar((m.down ? 2.6 : 1.6) * (1 + Math.sin(G.time * 30) * 0.06)); m.ball.rotation.y += dt * 6;
    _b.copy(p.pos).setY(p.pos.y + 0.9); G.vfx.emit('fire', _b, { n: m.down ? 6 : 3, speed: 2, life: 0.5, size: m.down ? 2 : 1.3, spread: 1, dir: _c.copy(v).multiplyScalar(-0.15) });
    G.vfx.emit('ember', _b, { n: 2, speed: 4, life: 0.9, size: 0.15, spread: 1 }); if (Math.random() < 0.6) G.vfx.emit('smoke', _b, { n: 1, speed: 1, life: 2.4, size: 1.6, spread: 1 });
    if (!m.down) { if (m.t > 0.5) { m.down = true; m.t = 0; } p.override = { gravity: 30, anim: { fly: false, air: true } }; return true; }
    _b.subVectors(m.to, p.pos); const l = _b.length();
    if (l < 3.5 || p.grounded || m.t > 2.5) {
      if (m.ball) G.scene.remove(m.ball);
      this.met = null; v.set(0, 0, 0); const pt = p.pos.clone().setY(p.pos.y + 0.5); this.explodeFire(pt, 2.1);
      // impact: a molten crater, a ground-hugging ring of flame and rubble thrown out
      const gp = _c.set(pt.x, G.world.groundAt(pt.x, pt.z), pt.z); G.vfx.shock(gp, { radius: 26, color: 0xff6a1a, life: 0.7, flat: true, dome: true }); G.vfx.mark('scorch', gp, 16, 50);
      for (let k = 0; k < 36; k++) { const an = k / 36 * 6.283; G.vfx.emit('fire', _b.set(gp.x + Math.cos(an) * 2, gp.y + 0.5, gp.z + Math.sin(an) * 2), { n: 1, speed: 1, life: 0.9, size: 2.2, dir: _a.set(Math.cos(an) * 22, 2, Math.sin(an) * 22), drag: 2.5 }); }
      G.vfx.emit('dust', gp, { n: 30, speed: 16, life: 2.2, size: 2.4, spread: 4, grav: 2 }); G.vfx.emit('spark', gp, { n: 40, speed: 24, life: 1.2, size: 0.2, dir: _b.set(0, 10, 0) });
      this.zones.push({ p: gp.clone(), r: 9, t: 6, tick: 0 }); G.shake = 1; return false;
    }
    v.copy(_b.multiplyScalar(1 / l)).multiplyScalar(100); p.override = { gravity: 0, yaw: Math.atan2(v.x, v.z), anim: { fly: true, air: false } }; return true;
  }

  // ---------- Rime ----------
  frostBlast() {
    const p = this.pl, f = this.camF(false), h = this.hand();
    G.ents.inRange(p.pos, 34, e => { _b.subVectors(e.pos, p.pos).normalize(); if (_b.dot(f) > 0.55) e.freeze(9); });
    G.ents.carsIn(p.pos, 34, c => { _b.subVectors(c.pos, p.pos).normalize(); if (_b.dot(f) > 0.5 && c !== p.car) this.freezeCar(c, 9); });
    // a widening cone of freezing mist and ice shards, with a glowing frost ray down the middle
    const end = _c.copy(h).addScaledVector(f, 30).clone(); G.vfx.beam('energy', h, end, { width: 0.18, color: 0x4aa8ff, core: 0xdff6ff, life: 0.3, n: 2 });
    for (let i = 0; i < 26; i++) { const sp = _b.copy(f).multiplyScalar(26 + Math.random() * 14).add(_a.set((Math.random() - 0.5) * 9, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 9)); G.vfx.emit(i % 3 ? 'frost' : 'ice', _a.copy(h).addScaledVector(f, 1.5), { n: 1, speed: 0.6, life: 1, size: i % 3 ? 0.8 : 0.35, grow: i % 3 ? 3 : 1, dir: sp, drag: 1.6, grav: i % 3 ? 0 : 3 }); }
    for (let i = 0; i < 7; i++) G.vfx.emit('steam', _b.copy(h).addScaledVector(f, 4 + i * 2), { n: 1, speed: 1, life: 1.8, size: 0.8 + i * 0.15, dir: _a.copy(f).multiplyScalar(5) });
    for (let i = 0; i < 16; i++) G.vfx.emit('snow', _b.copy(h).addScaledVector(f, 2 + i * 1.8), { n: 1, speed: 2, life: 1.5, size: 0.2, spread: 2 });
    this.after(0.2, () => { for (let i = 1; i <= 4; i++) { const q = _b.copy(p.pos).addScaledVector(_a.set(f.x, 0, f.z).normalize(), i * 6); q.y = G.world.groundAt(q.x, q.z); G.vfx.mark('frost', q, 5 + i * 1.5, 10); } });
    G.fx.flash(h, 0x9fe8ff, 50, 0.3);
  }
  freezeCar(c, t) { c.frozen = t; c.m.paint.emissive.set(0x2f6f96); c.vel.multiplyScalar(0.1); if (c.ai === 'traffic') c.touched = true; }
  spikes() {
    const p = this.pl, f = this.camF(true), o = p.pos.clone();
    for (let i = 0; i < 9; i++) this.after(i * 0.055, () => {
      const x = o.x + f.x * (4.5 + i * 3.4), z = o.z + f.z * (4.5 + i * 3.4), y = Math.max(Geo.height(x, z), 0), ht = 4.5 + i * 0.35 + Math.random() * 1.5;
      const m = new THREE.Mesh(this.spikeGeo, this.spikeMat || (this.spikeMat = new THREE.MeshStandardMaterial({ color: 0xd8f4ff, roughness: 0.03, metalness: 0.3, transparent: true, opacity: 0.85, emissive: 0x3f9fd8, emissiveIntensity: 0.75, flatShading: true }))); m.position.set(x, y - 0.3, z); m.scale.set(1.4, 0.01, 1.4); m.rotation.y = Math.random() * 6; m.castShadow = true; G.scene.add(m);
      G.world.dyn.push({ minx: x - 0.9, maxx: x + 0.9, minz: z - 0.9, maxz: z + 0.9, miny: y - 1, maxy: y + ht * 0.8, until: G.time + 9, mesh: m, solid: true, grow: ht, born: G.time });
      _b.set(x, y, z); G.vfx.emit('ice', _b, { n: 14, speed: 9, life: 0.9, size: 0.4, spread: 1.2, dir: _c.set(0, 6, 0) }); G.vfx.emit('frost', _b, { n: 4, speed: 3, life: 0.6, size: 0.9, spread: 1.5 }); G.vfx.emit('dust', _b, { n: 5, speed: 4, life: 1, size: 1.2, spread: 1.5 }); G.vfx.mark('frost', _b, 5, 9);
      G.ents.inRange(_b, 3.6, e => { e.hit(36, f, 6, 'player'); e.vel.y = 15; });
      G.ents.carsIn(_b, 4.2, c => { if (c === p.car) return; c.vy = 14; c.grounded = false; c.launch = (Math.random() - 0.5) * 7; c.vel.addScaledVector(f, 5); c.damage(45); if (c.ai === 'traffic') c.ai = 'none'; c.touched = true; });
      G.audio.shatter(_b);
    });
  }
  whiteout() {
    const p = this.pl.pos; this.blizzard = { t: 13, tick: 0 }; G.sky.override = { snow: 1, cloud: 1, fog: 0.22, wind: 14 };
    G.vfx.shock(p.clone().setY(p.y + 0.5), { radius: 34, color: 0x9fe8ff, life: 1, flat: true, dome: true }); G.vfx.mark('frost', _b.set(p.x, G.world.groundAt(p.x, p.z), p.z), 40, 14);
    G.vfx.emit('frost', p, { n: 40, speed: 18, life: 1.2, size: 2, spread: 2, dir: _b.set(0, 2, 0) }); G.fx.flash(p, 0xbfeaff, 200, 0.6);
  }

  // ---------- Vector ----------
  cloak() { const p = this.pl; this.cloakT = 12; p.invisible = true; setRigOpacity(p.rig, 0.12); const c = p.pos.clone().setY(p.pos.y + 1); G.vfx.shock(c, { radius: 2.2, color: 0x7dff3a, life: 0.45 }); G.vfx.emit('glow', c, { n: 40, speed: 3, life: 0.7, size: 0.15, color: 0x9dff6a, spread: 1.2 }); G.vfx.emit('electric', c, { n: 10, speed: 3, life: 0.3, size: 0.4, color: 0x9dff6a }); }
  blinkFx(a, b) {
    a = a.clone(); b = b.clone(); G.vfx.beam('energy', a, b, { n: 12, wave: 0.15, width: 0.9, color: 0x2a9f10, core: 0xcfff8a, life: 0.35 });
    const L = a.distanceTo(b); for (let k = 0, N = Math.min(40, L * 1.5); k < N; k++) G.vfx.emit(k % 2 ? 'glow' : 'electric', _c.lerpVectors(a, b, k / N), { n: 1, speed: 1.5, life: 0.5, size: k % 2 ? 0.2 : 0.35, color: 0x9dff6a, spread: 0.8 });
    for (const q of [a, b]) { G.vfx.shock(q, { radius: 2, color: 0x7dff3a, life: 0.3 }); G.vfx.emit('glow', q, { n: 20, speed: 4, life: 0.4, size: 0.18, color: 0x9dff6a }); }
  }
  uncloak() { const p = this.pl; if (!p || !p.invisible) return; this.cloakT = 0; G.vfx.emit('glow', p.pos.clone().setY(p.pos.y + 1), { n: 30, speed: 2, life: 0.6, size: 0.15, color: 0x9dff6a, spread: 1 }); p.invisible = false; setRigOpacity(p.rig, 1); }
  contagion() {
    const p = this.pl, f = this.camF(false), from = G.camera.position; let best = null, bs = 0.9, car = null;
    for (const e of G.ents.npcs) { if (e.dead || e.infected > 0) continue; _b.subVectors(e.pos, from).setY(e.pos.y + 1 - from.y); const l = _b.length(); if (l > 60) continue; const s = _b.dot(f) / l - l * 0.0015; if (s > bs) { bs = s; best = e; car = null; } }
    for (const c of G.ents.cars) { if (c.dead || c.infected > 0 || c === p.car) continue; _b.subVectors(c.pos, from); const l = _b.length(); if (l > 70) continue; const s = _b.dot(f) / l - l * 0.0015; if (s > bs) { bs = s; car = c; best = null; } }
    if (!best && !car) best = G.ents.nearest(p.pos, 22, e => e.infected <= 0);
    if (!best && !car) { G.ui.toast('No host in range'); return false; }
    // a writhing stream of virus that snakes to the host, then a bloom of spores
    const to = (best || car).pos.clone().setY((best || car).pos.y + 1), h = this.hand();
    G.vfx.beam('energy', h, to, { n: 18, wave: 0.5, width: 0.22, color: 0x3fdf20, core: 0xd8ff9a, life: 0.5, follow: () => [this.hand(), to] }); G.vfx.beam('energy', h, to, { n: 14, wave: 0.25, width: 0.06, color: 0x9dff4a, core: 0xffffff, life: 0.35 });
    for (let k = 0; k < 10; k++) G.vfx.emit('spore', _b.lerpVectors(h, to, k / 10), { n: 1, speed: 1, life: 0.9, size: 0.15 });
    this.after(0.1, () => { G.vfx.emit('toxic', to, { n: 14, speed: 4, life: 1.2, size: 1.4 }); G.vfx.emit('spore', to, { n: 24, speed: 6, life: 1.4, size: 0.14 }); G.vfx.mark('toxic', _b.set(to.x, G.world.groundAt(to.x, to.z), to.z), 4, 10); });
    if (best) best.infect(0); else { car.infected = 11; car.gen = 0; car.touched = true; G.stats.infected++; if (car.ai === 'none') car.ai = 'traffic'; }
  }
  blackout() {
    // an EMP: a crackling dome races out across the district, arcs leap to every engine, the lights die
    const p = this.pl, c0 = p.pos.clone().setY(p.pos.y + 1); this.blackoutT = 11; G.fx.flash(this.hand(), 0xaaffcc, 500, 0.4); G.shake = 0.5;
    G.vfx.shock(c0, { radius: 75, color: 0x7dffb0, life: 1.1, dome: true }); G.vfx.shock(c0, { radius: 40, color: 0xbfffe0, life: 0.6, flat: true });
    G.vfx.emit('electric', c0, { n: 50, speed: 16, life: 0.5, size: 0.6, color: 0xbfffe0 }); G.vfx.emit('glow', c0, { n: 8, speed: 1, life: 0.3, size: 3, color: 0x7dffb0 });
    G.ents.carsIn(p.pos, 80, c => { if (c === p.car) return; c.emp = 11; const d = c.pos.distanceTo(p.pos); this.after(d / 75 * 1.1, () => { const q = c.pos.clone().setY(c.pos.y + 1); G.vfx.emit('electric', q, { n: 12, speed: 5, life: 0.4, size: 0.5, color: 0xbfffe0 }); G.vfx.emit('smoke', q, { n: 3, speed: 1, life: 2, size: 1 }); if (d < 40) G.weapons.bolt(c0, q); }); });
    G.ents.inRange(p.pos, 40, e => { if (e.state !== 'down') { e.state = 'stagger'; e.t = 2.8; } });
    G.wanted.hitHeli(999); G.wanted.unseen = Math.max(G.wanted.unseen, 3);
  }

  update(dt) {
    const p = this.pl; for (let i = 0; i < 3; i++) this.cd[i] = Math.max(0, this.cd[i] - dt);
    for (let i = this.timers.length - 1; i >= 0; i--) { const t = this.timers[i]; t.t -= dt; if (t.t <= 0) { this.timers.splice(i, 1); t.fn(); } }
    if (this.cloakT > 0) { this.cloakT -= dt; if (this.cloakT <= 0) this.uncloak(); else if (Math.random() < dt * (p.speed > 2 ? 30 : 8)) G.vfx.emit('glow', _b.copy(p.pos).add(_c.set((Math.random() - 0.5) * 0.7, 0.2 + Math.random() * 1.6, (Math.random() - 0.5) * 0.7)), { n: 1, speed: 0.2, life: 0.5, size: 0.06, color: 0x9dff6a }); }
    this.blackoutT = Math.max(0, this.blackoutT - dt);
    if (p.hero.id !== 'cinder' && p.hero.id !== 'rime' || !G.input.down.traverse) G.audio.jet(false);
    // fireballs
    for (let i = this.shots.length - 1; i >= 0; i--) {
      const s = this.shots[i], m = s.m; s.life -= dt; s.vel.y -= 5 * dt; const l = s.vel.length() * dt; _a.copy(s.vel).normalize();
      G.world.raycast(m.position, _a, l, hit); let boom = hit.hit || s.life <= 0; m.position.addScaledVector(_a, hit.hit ? hit.t : l);
      if (!boom) { if (G.ents.nearest(m.position, 2, null)) boom = true; else for (const c of G.ents.cars) if (c !== p.car && c.pos.distanceTo(m.position) < 2.6) boom = true; const h = G.wanted.heli; if (h && h.pos.distanceTo(m.position) < 7) boom = true; }
      m.rotation.x += dt * 7; m.rotation.y += dt * 5; m.scale.setScalar(1 + Math.sin(G.time * 40) * 0.08);
      G.vfx.emit('fire', m.position, { n: 3, speed: 1.2, life: 0.45, size: 1.1, spread: 0.5, dir: _b.copy(s.vel).multiplyScalar(-0.05) });
      G.vfx.emit('ember', m.position, { n: 1, speed: 3, life: 0.8, size: 0.12, spread: 0.6 });
      if (Math.random() < 0.5) G.vfx.emit('smoke', m.position, { n: 1, speed: 0.5, life: 1.6, size: 0.7, spread: 0.4 });
      if (boom) { this.explodeFire(m.position.clone(), 1); G.scene.remove(m); m.children[0].material.dispose(); this.shots.splice(i, 1); }
    }
    // burning ground
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i]; z.t -= dt; z.tick -= dt; if (z.t <= 0) { this.zones.splice(i, 1); continue; }
      const fade = Math.min(1, z.t / 1.5);
      for (let k = 0; k < 3; k++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * z.r; _b.set(z.p.x + Math.cos(a) * r, 0, z.p.z + Math.sin(a) * r); _b.y = G.world.groundAt(_b.x, _b.z) + 0.2; G.vfx.emit('fire', _b, { n: 1, speed: 0.5, life: 0.9, size: (1.2 + Math.random()) * fade, grav: -4 }); }
      if (Math.random() < 0.4) G.vfx.emit('smoke', _b, { n: 1, speed: 0.6, life: 3, size: 1.4, grav: -2.2 }); if (Math.random() < 0.3) G.vfx.emit('ember', _b, { n: 1, speed: 2, life: 1.2, size: 0.1 });
      if (z.tick <= 0) { z.tick = 0.4; G.ents.inRange(z.p, z.r, e => { e.burning = Math.max(e.burning, 3); }); }
    }
    if (this.blizzard) {
      const b = this.blizzard; b.t -= dt; b.tick -= dt;
      // a swirling storm centred on Rime: flakes and drifting snow-mist circle round you
      for (let k = 0; k < 8; k++) { const a = Math.random() * 6.28, r = 3 + Math.random() * 30; _b.set(p.pos.x + Math.cos(a) * r, p.pos.y + Math.random() * 10, p.pos.z + Math.sin(a) * r); _c.set(-Math.sin(a) * 16, -2, Math.cos(a) * 16).addScaledVector(_a.set(-Math.cos(a), 0, -Math.sin(a)), 3); G.vfx.emit('snow', _b, { n: 1, speed: 0.5, life: 1.6, size: 0.18, dir: _c, drag: 0.3, grav: 0 }); }
      if (Math.random() < 0.6) { const a = Math.random() * 6.28, r = 6 + Math.random() * 24; G.vfx.emit('steam', _b.set(p.pos.x + Math.cos(a) * r, p.pos.y + 1 + Math.random() * 3, p.pos.z + Math.sin(a) * r), { n: 1, speed: 0.5, life: 2.5, size: 4, dir: _c.set(-Math.sin(a) * 9, 0, Math.cos(a) * 9), drag: 0.3 }); }
      if (b.tick <= 0) { b.tick = 0.5; G.ents.inRange(p.pos, 34, e => { if (e.frozen <= 0) e.freeze(6); }); G.ents.carsIn(p.pos, 34, c => { if (c !== p.car && c.frozen <= 0) this.freezeCar(c, 6); }); }
      if (b.t <= 0) { this.blizzard = null; G.sky.override = null; }
    }
    // melt old ice, grow fresh spikes
    let ch = false; for (let i = 0; i < ICE_N; i++) if (this.iceUntil[i] && this.iceUntil[i] < G.time) { this.iceUntil[i] = 0; this.iceM.makeScale(0, 0, 0); this.ice.setMatrixAt(i, this.iceM); ch = true; }
    if (ch) this.ice.instanceMatrix.needsUpdate = true;
    for (const d of G.world.dyn) if (d.grow) { const a = clamp((G.time - d.born) / 0.14, 0, 1), e = clamp((d.until - G.time) / 0.6, 0, 1); d.mesh.scale.y = d.grow * a * e + 0.01; }
  }
}
