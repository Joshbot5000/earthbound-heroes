// Player controller: running, double-jump, wall-running and climbing, rope swinging on a real
// pendulum constraint, melee, dodging, driving, and the chase camera.
import * as THREE from 'three';
import { G, clamp, lerp, damp, angDiff } from './util.js';
import { Geo } from './geo.js';
import { makeRig, animateRig, setRigOpacity } from './rig.js';
import { nearestWall } from './solid.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), _d = V(), out = {}, hit = {}, _w = {};
const GRAV = 26;

export class Player {
  constructor(heroes) {
    this.pos = V(); this.vel = V(); this.yaw = 0; this.camYaw = 0; this.camPitch = 0.25; this.mode = 'foot'; this.car = null;
    this.grounded = true; this.jumps = 0; this.coyote = 0; this.hp = 100; this.energy = 100; this.iframes = 0; this.invisible = false; this.dead = false;
    this.swing = null; this.zip = null; this.wall = null; this.wallT = 0; this.climbed = false; this.attackT = 0; this.combo = 0; this.comboT = 0; this.pending = null;
    this.dodgeT = 0; this.hurtT = 9; this.lookIdle = 0; this.fov = 62; this.anim = {}; this.punch = 0; this.side = 1; this.override = null; this.camT = V(); this.speed = 0; this.swims = false;
    this.heroes = heroes; this.rigs = heroes.map(h => { const r = makeRig(h.look); r.root.visible = false; G.scene.add(r.root); return r; });
    this.rope = new THREE.Mesh(G.fx.rope, new THREE.MeshBasicMaterial({ color: 0xffffff })); this.rope.visible = false; this.rope.frustumCulled = false; G.scene.add(this.rope);
    this.setHero(0);
  }
  setHero(i) {
    if (this.rig) this.rig.root.visible = false; this.heroIndex = i; this.hero = this.heroes[i]; this.rig = this.rigs[i]; this.rig.root.visible = this.mode === 'foot';
    this.rope.material.color.set(this.hero.rope); this.endSwing(false); this.override = null; G.powers && G.powers.reset();
  }
  get eye() { return _d.copy(this.pos).setY(this.pos.y + 1.5); }
  teleport(x, z, y) { this.pos.set(x, y ?? Math.max(Geo.height(x, z), 0) + 0.2, z); this.vel.set(0, 0, 0); this.endSwing(false); this.zip = null; if (this.car) this.exitCar(true); this.camT.copy(this.pos); }
  aim(max = 160) {                       // where the centre of the screen is pointing
    const c = G.camera; c.getWorldDirection(_a); G.world.raycast(c.position, _a, max + 8, hit);
    return { point: new THREE.Vector3(hit.x, hit.y, hit.z), dir: _a.clone(), hit: hit.hit, ny: hit.ny, box: hit.box };
  }
  damage(d, from) {
    if (this.iframes > 0 || this.dead) return; this.hp -= d * (this.hero.armor || 1); this.hurtT = 0; G.ui.hurt(); G.audio.hit(this.pos);
    if (this.hp <= 0) { this.dead = true; this.respawnT = 3.5; this.endSwing(false); if (this.car) this.exitCar(true); G.ui.toast('Knocked out', 'Getting back up…'); }
  }
  // ---------- swinging ----------
  // Pick a web anchor the way Spider-Man does: ahead of and above you in the direction you want to go,
  // on the nearest building face, tree or lamp. With nothing nearby over a city, the web still catches.
  findAnchor(dir) {
    const p = this.pos, v = this.vel, sp = Math.hypot(v.x, v.z);
    const ahead = clamp(16 + sp * 0.55, 16, 46), up = clamp(24 + sp * 0.18, 22, 40);
    const T = _b.set(p.x + dir.x * ahead, p.y + up, p.z + dir.z * ahead);
    let best = null, bs = 1e9;
    G.world.forBoxes(p.x - 95, p.z - 95, p.x + 95, p.z + 95, b => {
      if (b.maxy < p.y + 7 || b.bridge) return;
      nearestWall(b, T.x, T.z, _w); const x = _w.x, z = _w.z, y = clamp(T.y, Math.max(b.miny + 2, p.y + 8), b.maxy - 0.3);
      const dx = x - p.x, dy = y - p.y, dz = z - p.z, dh = Math.hypot(dx, dz), d = Math.hypot(dh, dy); if (d < 11 || d > 95) return;
      const along = (dx * dir.x + dz * dir.z) / (dh || 1);
      const s = Math.hypot(x - T.x, (y - T.y) * 0.7, z - T.z) + (along < 0.2 ? 45 : along < 0.5 ? 12 : 0) + (dy < 10 ? 18 : 0);
      if (s < bs) { bs = s; best = [x, y, z]; }
    });
    if (!best && G.props) G.props.forNear(T.x, T.z, 40, q => { if (q.h < 6) return; const y = q.y + q.h * 0.9, d = Math.hypot(q.x - p.x, y - p.y, q.z - p.z), along = ((q.x - p.x) * dir.x + (q.z - p.z) * dir.z); if (y < p.y + 4 || d < 9 || along < 0) return; const sc = Math.hypot(q.x - T.x, q.z - T.z) + 30; if (sc < bs) { bs = sc; best = [q.x, y, q.z]; } });
    // open ground with nothing to grab (a park, a wide square): the web still catches, but never above
    // rooftop height, so you cannot climb into the sky - you fall back to the buildings or glide
    const g0 = Math.max(0, Geo.height(p.x, p.z));
    if (!best && Geo.urban(p.x, p.z) > 0.05 && p.y < g0 + 26) best = [T.x, Math.min(T.y + 6, g0 + 40), T.z, 'sky'];
    return best;
  }
  startSwing(wish) {
    const dir = _a.copy(wish); dir.y = 0; if (dir.lengthSq() < 0.05) { dir.set(this.vel.x, 0, this.vel.z); if (dir.lengthSq() < 4) dir.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)); } dir.normalize();
    const a = this.findAnchor(dir); if (!a) return false;
    if (this.grounded) { this.vel.y = 10; this.pos.y += 0.3; this.grounded = false; }
    const anchor = new THREE.Vector3(a[0], a[1], a[2]);
    // never swing into the pavement: cap the rope so the bottom of the arc clears the ground
    const g = Math.max(0, Geo.height(this.pos.x, this.pos.z));
    this.swing = { anchor, len: Math.min(Math.max(10, this.pos.distanceTo(anchor)), anchor.y - g - 3), dir: dir.clone(), age: 0, sky: !!a[3] };
    if (this.vel.x * dir.x + this.vel.z * dir.z < 14) this.vel.addScaledVector(dir, 8);
    this.rope.visible = true; G.audio.thwip(); if (!a[3]) G.fx.burst(anchor, this.hero.rope, 8, 3, 0.3, 1.2); return true;
  }
  endSwing(boost) {
    if (!this.swing) return; const S = this.swing; this.swing = null; this.rope.visible = false; this.jumps = 1;
    if (boost) {
      // release near the top of the arc to be flung up and forward
      const h = Math.hypot(this.vel.x, this.vel.z), rising = this.vel.y > -2;
      if (rising) this.vel.y += 7; if (h < 40) { this.vel.x *= 1.1; this.vel.z *= 1.1; }
      G.audio.whoosh();
    }
    this.lastSwingDir = S.dir;
  }
  // turn hard mid-swing: fire a new web the way you want to go and carry the momentum round with you
  redirect(wish) {
    const v = this.vel, sp = Math.hypot(v.x, v.z), dir = _c.copy(wish).setY(0).normalize();
    if (sp > 1) { const cur = _d.set(v.x / sp, 0, v.z / sp), nd = cur.lerp(dir, 0.8).normalize(), keep = clamp(sp * 0.94, 16, 42); v.x = nd.x * keep; v.z = nd.z * keep; }
    v.y = Math.max(v.y, 3); this.swing = null; this.rope.visible = false;
    if (this.startSwing(dir)) { this.swing.age = 0; G.fx.ring(_c.copy(this.pos).setY(this.pos.y + 1), this.hero.rope, 2.5, 0.25); this.redirectT = 0.5; return true; }
    return false;
  }
  // ---------- cars ----------
  nearestCar() { let best = null, bd = 5.5; for (const c of G.ents.cars) { if (c.dead) continue; const d = c.pos.distanceTo(this.pos); if (d < bd) { bd = d; best = c; } } return best; }
  enterCar(c) {
    this.endSwing(false); this.mode = 'car'; this.car = c; this.rig.root.visible = false; this.override = null;
    if (c.ai === 'traffic' || c.ai === 'leave') { const n = G.ents.addNPC('ped', c.pos.x + Math.cos(c.yaw) * 2.2, c.pos.z - Math.sin(c.yaw) * 2.2); n.state = 'flee'; n.t = 8; n.fx = c.pos.x; n.fz = c.pos.z; G.wanted.crime(G.ents.nearest(c.pos, 70, n => n.kind === 'cop') ? 1.5 : 0.5); }
    if (c.police) G.wanted.crime(2.5);
    c.ai = 'player'; c.occupied = true; c.touched = true; c.vel.y = 0; this.lookIdle = 9; G.audio.door();
  }
  exitCar(force) {
    const c = this.car; if (!c) return; this.mode = 'foot'; this.car = null; c.ai = 'none'; c.occupied = false; this.rig.root.visible = true;
    this.pos.set(c.pos.x - Math.cos(c.yaw) * 2.1, c.pos.y + 0.3, c.pos.z + Math.sin(c.yaw) * 2.1); this.vel.set(c.vel.x, force ? 9 : 0, c.vel.z); this.yaw = c.yaw; this.grounded = false; G.audio.door();
  }
  // ---------- melee ----------
  attack() {
    if (this.attackT > 0.12) return; const E = G.ents, f = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), cf = _b.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    let tgt = null, bs = 1e9;
    E.inRange(this.pos, 8, n => { if (n.state === 'down' && !n.frozen) return; const d = _c.subVectors(n.pos, this.pos), l = d.length(); d.multiplyScalar(1 / (l || 1)); const s = l - (d.dot(cf) + d.dot(f)) * 2.5 - (n.kind !== 'ped' ? 5 : 0) + (Math.abs(d.y * l) > 3 ? 50 : 0); if (s < bs) { bs = s; tgt = n; } });
    this.combo = this.comboT > 0 ? (this.combo + 1) % 3 : 0; this.comboT = 0.9; this.attackT = 0.36; this.punch = 0.001; this.side = this.combo === 2 ? 2 : this.combo ? -1 : 1;
    if (tgt) { this.yaw = Math.atan2(tgt.pos.x - this.pos.x, tgt.pos.z - this.pos.z); const d = this.pos.distanceTo(tgt.pos); if (d > 1.5) { _c.subVectors(tgt.pos, this.pos).setY(0).normalize(); this.vel.x = _c.x * Math.min(34, (d - 1.2) / 0.13); this.vel.z = _c.z * Math.min(34, (d - 1.2) / 0.13); this.lungeT = 0.13; } }
    this.pending = { tgt, t: 0.14 }; G.audio.whoosh(0.5);
  }
  resolveHit() {
    const { tgt } = this.pending; this.pending = null; const f = _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), last = this.combo === 2;
    let dmg = (last ? 42 : 24) * (this.hero.melee || 1); if (this.invisible) { dmg *= 3; G.powers.uncloak(); }
    if (tgt && !tgt.dead && tgt.pos.distanceTo(this.pos) < 2.9) { tgt.hit(dmg, f, last ? 10 : 0, 'player'); G.audio.hit(this.pos, 1); G.shake = Math.max(G.shake, last ? 0.35 : 0.15); if (last) G.fx.ring(_c.copy(tgt.pos).setY(tgt.pos.y + 1), this.hero.rope, 3, 0.25); }
    else if (G.props.punch(this.pos, _c.copy(f).multiplyScalar(1.4), last ? 14 : 8)) G.shake = Math.max(G.shake, 0.2);
    else for (const c of G.ents.cars) { _c.subVectors(c.pos, this.pos); if (_c.length() < 3.4 && _c.dot(f) > 0) { c.vel.addScaledVector(f, last ? 9 : 4); c.damage(last ? 22 : 12); if (c.ai === 'traffic') { c.ai = 'none'; c.touched = true; } G.audio.crash(c.pos, 8); G.wanted.crime(0.4); break; } }
  }
  // ---------- per-frame ----------
  update(dt) {
    const I = G.input, P = G.powers;
    this.camYaw -= I.lookX; this.camPitch = clamp(this.camPitch + I.lookY, -1.25, 1.35); this.lookIdle = (I.lookX || I.lookY) ? 0 : this.lookIdle + dt;
    this.iframes -= dt; this.hurtT += dt; this.comboT -= dt; this.attackT -= dt;
    if (this.hurtT > 4 && this.hp < 100) this.hp = Math.min(100, this.hp + 14 * dt);
    this.energy = Math.min(100, this.energy + (this.hero.regen || 9) * dt);
    if (this.dead) { this.respawnT -= dt; this.anim.down = true; this.vel.x *= 0.9; this.vel.z *= 0.9; if (this.respawnT <= 0) { this.dead = false; this.hp = 100; this.iframes = 3; G.wanted.clearAll(false); } }
    const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), wish = _a.set(fx * I.my + -fz * I.mx, 0, fz * I.my + fx * I.mx), wl = Math.min(1, wish.length());
    if (wl > 1e-3) wish.normalize(); const wishC = wish.clone();
    if (this.mode === 'car') this.updateCar(dt, I); else this.updateFoot(dt, I, P, wishC, this.dead ? 0 : wl);
    const n = G.world.collectOrbs(this.pos); if (n) G.onOrb(n);
    this.updateCamera(dt);
  }
  updateCar(dt, I) {
    const c = this.car; c.drive(dt, I.my, I.mx, I.down.jump); this.pos.copy(c.pos); this.vel.copy(c.vel); this.speed = Math.abs(c.vf); this.grounded = c.grounded;
    if (c.pos.y < -0.9 && Geo.height(c.pos.x, c.pos.z) < -1.2) { G.ui.toast('Car flooded'); this.exitCar(true); return; }
    if (I.hit.interact) this.exitCar(false); else if (I.hit.traverse) { this.exitCar(true); this.vel.y = 13; }
    if (this.lookIdle > 1.2) this.camYaw += angDiff(this.camYaw, c.yaw + Math.PI) * Math.min(1, 3.5 * dt), this.camPitch = damp(this.camPitch, 0.2, 2, dt);
    G.audio.engine(c.vf, I.my);
  }
  updateFoot(dt, I, P, wish, wl) {
    const p = this.pos, v = this.vel, A = this.anim; for (const k in A) A[k] = false; A.punch = 0;
    if (this.punch > 0) { this.punch += dt * 3.4; if (this.punch >= 1) this.punch = 0; A.punch = this.punch; A.punchSide = this.side; }
    if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) this.resolveHit(); }
    if (!this.dead) {
      if (I.hit.melee || (I.hit.attack && !G.weapons.current)) this.attack();
      if (I.hit.interact) { const c = this.nearestCar(); if (c) { this.enterCar(c); return; } }
      if (I.hit.dodge && this.dodgeT <= 0 && !this.swing) { const d = wl > 0.1 ? wish : _b.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); this.dodgeT = 0.3; this.iframes = Math.max(this.iframes, 0.42); v.x = d.x * 19; v.z = d.z * 19; if (this.grounded) v.y = 2.5; G.audio.whoosh(0.7); }
      for (let i = 0; i < 3; i++) if (I.hit['p' + (i + 1)]) P.cast(i);
    }
    this.dodgeT -= dt; this.lungeT = (this.lungeT || 0) - dt;
    // hero-specific traversal (swing / jets / ice slide / blink) may take over this frame
    const took = !this.dead && P.traverse(dt, I, wish, wl);
    let gravity = GRAV;
    if (this.zip) {
      const z = this.zip, d = _b.subVectors(z.to, p), l = d.length(); z.t += dt;
      if (l < 3 || z.t > 3) {
        if (z.perch) { const f = _c.set(d.x, 0, d.z).normalize(); v.set(f.x * 17, 17, f.z * 17); G.fx.ring(_c.copy(p), this.hero.rope, 3, 0.3); G.audio.whoosh(); }   // point launch over the edge
        else { v.copy(d.normalize()).multiplyScalar(24); v.y = Math.max(v.y, 4) + 9; }
        this.zip = null; this.rope.visible = false; this.jumps = 1; }
      else { v.copy(d.multiplyScalar(1 / l)).multiplyScalar(Math.min(78, 30 + z.t * 160)); gravity = 0; this.yaw = Math.atan2(d.x, d.z); A.swing = true; }
    } else if (took) { gravity = this.override && this.override.gravity !== undefined ? this.override.gravity : GRAV; }
    else if (this.swing) {
      const S = this.swing, r = _b.subVectors(p, S.anchor), L = r.length() || 1; r.multiplyScalar(1 / L); S.age += dt; A.swing = true;
      // steering: push sideways against the rope to bend the arc; gentle forward drive otherwise
      const steer = wl > 0.1 ? wish : S.dir; _c.copy(steer).addScaledVector(r, -steer.dot(r)); v.addScaledVector(_c, (wl > 0.1 ? 26 : 8) * dt);
      // keep the swing in its plane: damp sideways drift you are not asking for (no endless circling)
      const side = _d.set(S.dir.z, 0, -S.dir.x), lat = v.dot(side), want = wl > 0.1 ? wish.dot(side) : 0; if (Math.abs(want) < 0.35) v.addScaledVector(side, -lat * Math.min(1, 3 * dt));
      // speed gain through the bottom of the arc
      const low = clamp(-r.y, 0, 1), vs = v.length(); if (vs > 1 && vs < 44) v.multiplyScalar(1 + low * low * 0.3 * dt); if (vs > 48) v.multiplyScalar(1 - 0.6 * dt);
      // reel in so the arc never scrapes the street
      const g = Math.max(0, Geo.height(p.x, p.z)); S.len = Math.min(S.len - 2.5 * dt, S.anchor.y - g - 2.5); if (S.len < 8) S.len = 8;
      // a hard turn (or a second tap) fires a new web that way at once
      this.redirectT = (this.redirectT || 0) - dt;
      const hv = Math.hypot(v.x, v.z), turn = wl > 0.6 && hv > 4 ? (v.x * wish.x + v.z * wish.z) / hv : 1;
      if ((I.hit.traverse || turn < 0.3) && S.age > 0.3 && this.redirectT <= 0) this.redirect(wl > 0.1 ? wish : _d.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw)));
      // holding on: chain to the next web once we swing up past the anchor
      else if (I.down.traverse && ((r.y > 0.2 && v.y > 0 && (r.x * v.x + r.z * v.z) > 0 && S.age > 0.35) || S.age > 1.8)) { this.endSwing(true); this.startSwing(wl > 0.1 ? wish : _d.set(v.x, 0, v.z)); }
      if (this.swing && !I.down.traverse) this.endSwing(true);
    } else if (this.grounded) {
      if (this.dodgeT <= 0 && this.lungeT <= 0) { const W = G.weapons, cw = W.current, sp = (I.down.sprint && !(cw && W.aimK > 0.5) ? 13 : 7.5) * (this.swims ? 0.45 : 1) * (this.hero.speed || 1) * (cw && cw.heavy && W.firedT < 0.5 ? cw.heavy : 1) * (cw && W.aimK > 0.5 ? 0.6 : 1), k = 1 - Math.exp(-(wl > 0.05 ? 11 : 14) * dt); v.x += (wish.x * sp * wl - v.x) * k; v.z += (wish.z * sp * wl - v.z) * k; }
    } else if (wl > 0.05 && this.dodgeT <= 0) {
      const along = v.x * wish.x + v.z * wish.z; if (along < 15) v.addScaledVector(wish, 26 * dt);
    }
    // wall running and climbing
    A.wall = 0;
    if (this.wall && !this.grounded && !this.swing && !this.zip && !took && !this.dead) {
      const n = this.wall, into = -(wish.x * n.x + wish.z * n.z);
      if (wl > 0.2 && (into > 0.55 || this.wallT < 2.6)) {
        this.wallT += dt; this.jumps = 1;
        if (into > 0.55) { v.y = damp(v.y, 13, 10, dt); v.x = -n.x * 2; v.z = -n.z * 2; gravity = 0; this.climbed = true; A.wall = 0.01; this.yaw = Math.atan2(-n.x, -n.z); }
        else { const tx = wish.x + n.x * into, tz = wish.z + n.z * into, tl = Math.hypot(tx, tz) || 1; v.x = tx / tl * 14 - n.x * 2; v.z = tz / tl * 14 - n.z * 2; v.y = Math.max(v.y, 2.2 - this.wallT * 2); gravity = 6; A.wall = (tx * n.z - tz * n.x) > 0 ? 1 : -1; }
        if (Math.random() < dt * 20) G.fx.burst(_c.copy(p).setY(p.y + 0.1), 0xdddddd, 1, 1, 0.3, 0.7);
        if (I.hit.jump) { v.x = n.x * 10 + wish.x * 5; v.z = n.z * 10 + wish.z * 5; v.y = 13; this.wall = null; I.hit.jump = false; G.audio.jump(); }
      }
    } else if (this.climbed && !this.wall && !this.grounded && this.lastWall && wl > 0.2) { v.y = Math.max(v.y, 8); v.x -= this.lastWall.x * 5; v.z -= this.lastWall.z * 5; this.climbed = false; }   // vault over the ledge
    if (this.grounded) { this.wallT = 0; this.climbed = false; }
    // jumping
    this.coyote = this.grounded ? 0.12 : this.coyote - dt;
    if (I.hit.jump && !this.dead && !this.zip) {
      if (this.swing) { const d = this.swing.dir; this.endSwing(true); v.y = Math.max(v.y, 0) + 13; v.x += d.x * 6; v.z += d.z * 6; G.fx.ring(_c.copy(p), this.hero.rope, 3, 0.3); }
      else if (this.coyote > 0) { v.y = 13.5 * (this.hero.jump || 1); this.jumps = 1; this.coyote = 0; this.grounded = false; G.audio.jump(); }
      else if (this.jumps < 2) { v.y = Math.max(v.y, 0) * 0.3 + 12.5; this.jumps = 2; G.fx.ring(_c.copy(p), this.hero.rope, 2.2, 0.3); G.audio.jump(); if (wl > 0.1) { v.x += wish.x * 5; v.z += wish.z * 5; } }
    }
    if (!I.down.jump && v.y > 4 && !this.swing && !took && !this.zip && gravity > 10) v.y -= 22 * dt;
    this.gliding = false;
    if (this.hero.id === 'vesper' && I.down.jump && !this.grounded && !this.swing && !this.zip && v.y < -4 && this.jumps >= 1 && !this.wall) {
      this.gliding = true; v.y = damp(v.y, -4.5, 6, dt); gravity = 4; const f = wl > 0.1 ? wish : _c.set(v.x, 0, v.z).normalize(), hs = Math.hypot(v.x, v.z), tgt = Math.max(hs, 22);
      v.x = damp(v.x, f.x * tgt, 1.6, dt); v.z = damp(v.z, f.z * tgt, 1.6, dt); A.fly = true; if (Math.random() < dt * 8) G.fx.burst(_c.copy(p).setY(p.y + 1), 0xffffff, 1, 1, 0.4, 0.6);
    }
    v.y = Math.max(v.y - gravity * dt, -85);
    // integrate in small steps so fast movement cannot tunnel through walls
    const sp3 = v.length(), steps = Math.min(8, Math.ceil(sp3 * dt / 0.45)) || 1, h = dt / steps; let wall = null, grounded = false;
    for (let s = 0; s < steps; s++) {
      _w.px = p.x; _w.py = p.y; _w.pz = p.z;
      p.addScaledVector(v, h);
      if (this.swing) { const a = this.swing.anchor, d = _b.subVectors(p, a), L = d.length(); if (L > this.swing.len) { d.multiplyScalar(1 / L); p.copy(a).addScaledVector(d, this.swing.len); const vr = v.dot(d); if (vr > 0) v.addScaledVector(d, -vr); } }
      G.world.collide(p, 0.38, 1.8, v, out); if (out.wall) wall = out.wall; grounded = grounded || out.grounded;
      // safety net: never end a step inside a building
      if (G.world.insideAny(p)) { p.set(_w.px, _w.py, _w.pz); v.x *= -0.1; v.z *= -0.1; if (!wall) wall = { x: 0, z: 0, box: null }; }
    }
    if (this.swing && wall) { this.endSwing(false); v.y = Math.max(v.y, 7); this.wallT = 0; }
    else if (this.swing && (grounded || p.y > this.swing.anchor.y - 1.5)) this.endSwing(!grounded);
    if (this.zip && wall) { this.zip = null; this.rope.visible = false; }
    // water: swim at the surface (Rime freezes it instead)
    this.swims = false;
    if (out.ground < -0.5 && p.y <= (this.hero.freezesWater ? 0.02 : -0.75)) { if (this.hero.freezesWater) { p.y = 0.02; if (Math.hypot(v.x, v.z) > 1 && Math.random() < dt * 30) G.fx.burst(p, 0xbfeaff, 1, 0.5, 1.2, 2.2); } else { p.y = -0.75; this.swims = true; if (Math.random() < dt * 10) G.fx.burst(_c.copy(p).setY(0), 0xffffff, 2, 2, 0.5, 1, 5); } if (v.y < 0) v.y = 0; grounded = true; }
    if (grounded && !this.grounded && this.fallV < -24) { G.fx.ring(_c.copy(p).setY(p.y + 0.1), 0xffffff, 4, 0.35); G.shake = Math.max(G.shake, 0.3); G.audio.land(); }
    this.fallV = v.y; this.grounded = grounded; if (grounded) this.jumps = 0; if (wall) this.lastWall = wall; this.wall = wall;
    this.speed = Math.hypot(v.x, v.z);
    // facing and animation
    const Wp = G.weapons, armed = Wp.current && (Wp.aimK > 0.2 || Wp.firedT < 0.8 || I.down.attack);
    if (!this.dead && !A.wall) { if (took && this.override && this.override.yaw !== undefined) this.yaw = this.override.yaw; else if (armed && !this.swing) this.yaw += angDiff(this.yaw, this.camYaw + Math.PI) * Math.min(1, 20 * dt); else if (this.speed > 1.5 && !this.pending && this.attackT < 0.1) this.yaw += angDiff(this.yaw, Math.atan2(v.x, v.z)) * Math.min(1, 14 * dt); }
    A.speed = grounded ? this.speed : 0; A.air = !grounded; A.vy = v.y; A.down = this.dead; if (took && this.override) Object.assign(A, this.override.anim);
    if (armed && !A.swing && !this.dead) { A.aim = true; A.aim2 = !Wp.current.one; A.aimPitch = this.camPitch; }
    const r = this.rig; r.root.position.copy(p); r.root.rotation.y = this.yaw; if (this.swims) r.root.position.y -= 0.35;
    r.root.rotation.z = damp(r.root.rotation.z, this.swing ? clamp(-(v.x * Math.cos(this.yaw) - v.z * Math.sin(this.yaw)) * 0.02, -0.5, 0.5) : 0, 8, dt);
    animateRig(r, A, dt);
    if (this.rope.visible) { const to = this.swing ? this.swing.anchor : this.zip ? this.zip.to : null; if (to) { r.root.updateMatrixWorld(true); r.foreR.localToWorld(_c.set(0, -0.3, 0)); G.fx.place(this.rope, _c, to, 0.03); } else this.rope.visible = false; }
    G.audio.wind(v.length(), grounded);
  }
  updateCamera(dt) {
    if (G.debugCam) { const c = G.debugCam; G.camera.position.set(c[0], c[1], c[2]); G.camera.lookAt(c[3], c[4], c[5]); return; }
    const cam = G.camera, car = this.mode === 'car', sp = this.vel.length(), W = G.weapons, w = W && W.current, aim = w ? W.aimK : 0;
    // recoil kicks the view up, then settles
    if (this.recoil) { this.camPitch = clamp(this.camPitch - this.recoil * 0.6, -1.25, 1.35); this.recoil = 0; }
    // swinging or running fast with no camera input: swing the camera round behind your direction of travel
    if (!car && this.lookIdle > 0.6 && Math.hypot(this.vel.x, this.vel.z) > 12 && !aim) { const h = Math.atan2(this.vel.x, this.vel.z) + Math.PI; this.camYaw += angDiff(this.camYaw, h) * Math.min(1, 2.2 * dt); this.camPitch = damp(this.camPitch, 0.18, 1.5, dt); }
    _a.copy(this.pos).setY(this.pos.y + (car ? 1.5 : 1.6)); this.camT.lerp(_a, 1 - Math.exp(-(car ? 14 : 22) * dt)); if (this.camT.distanceTo(_a) > 12) this.camT.copy(_a);
    const cp = Math.cos(this.camPitch), dir = _b.set(Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), Math.cos(this.camYaw) * cp);
    // armed: look past the right shoulder so the crosshair is clear of your hero
    this.shoulder = damp(this.shoulder || 0, w && !car ? 0.75 : 0, 8, dt);
    const right = _d.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)), pivot = _c.copy(this.camT).addScaledVector(right, this.shoulder);
    let dist = car ? 8.2 + Math.min(5, sp * 0.07) : lerp(5 + Math.min(5, sp * 0.07), w && w.zoom ? 0.6 : 2.4, aim);
    const r0 = pivot.clone(); G.world.raycast(r0, dir, dist + 0.4, hit); if (hit.hit) dist = Math.max(0.7, hit.t - 0.4);
    this.camDist = damp(this.camDist || dist, dist, dist < (this.camDist || 99) ? 30 : 6, dt);
    cam.position.copy(r0).addScaledVector(dir, this.camDist);
    const g = Geo.height(cam.position.x, cam.position.z) + 0.35; if (cam.position.y < g) cam.position.y = g; if (cam.position.y < 0.3) cam.position.y = 0.3;
    G.shake = Math.max(0, (G.shake || 0) - dt * 2.2); if (G.shake > 0) cam.position.add(_a.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(G.shake * 0.7));
    if (this.shoulder > 0.05) cam.lookAt(_a.copy(r0).addScaledVector(dir, -30)); else cam.lookAt(_a.copy(this.camT).setY(this.camT.y + 0.35));
    const fov = lerp(clamp(62 + sp * 0.5, 62, 96), w && w.zoom ? w.zoom : 48, aim); this.fov = damp(this.fov, fov, aim > 0.5 ? 14 : 4, dt); if (Math.abs(cam.fov - this.fov) > 0.05) { cam.fov = this.fov; cam.updateProjectionMatrix(); }
  }
}
export { setRigOpacity };
