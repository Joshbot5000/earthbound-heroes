// Everything that moves besides the player: traffic, civilians, the Syndicate, police cars,
// officers, the police helicopter, and the wanted system that ties them together.
import * as THREE from 'three';
import { G, clamp, lerp, damp, angDiff, TAU } from './util.js';
import { Geo, BLOCK, CH } from './geo.js';
import { makeRig, animateRig, tintRig, makeHeli, civilianLook, copLook, thugLook } from './rig.js';
import { makeVehicle, dent } from './vehicles.js';
import { City, ROAD_W, DRIVABLE, BASE } from './city.js';
import { region } from './regions.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), out = {};
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]], LANE = 3.4, GRAV = 26;
const CAR_COLORS = [0xb8bcc2, 0x15171a, 0xf1f1ee, 0x8a1b1b, 0x1d3a6b, 0x39424a, 0x6d6f73, 0x1f5a45, 0xc9a227, 0x7a4b2a];
const roadLine = v => Math.round(v / BLOCK) * BLOCK, _o = {}, _p = {};
const DIRS_OK = (R, e) => DRIVABLE(R.cls[e]) && R.cls[e] !== 8 && !(R.flags[e] & 2) && R.len[e] > 8;
const SPEED = [0, 22, 18, 14, 12.5, 11, 8.5, 5, 5];
const PAINT = [0xb8bcc2, 0x15171a, 0xf1f1ee, 0x8a1b1b, 0x1d3a6b, 0x39424a, 0x6d6f73, 0x1f5a45, 0x9a9c9e, 0x7a4b2a, 0x2a4a7a, 0xd8d6d0];

// ================= cars =================
export class Car {
  constructor(type, color, police, regKey) {
    this.m = makeVehicle(type, color, police, regKey); this.type = type; this.police = !!police; this.spec = this.m.spec; this.av = 0; this.pitch = 0; this.roll = 0; this.lastVf = 0;
    this.circ = Math.max(2, Math.ceil(this.spec.len / this.spec.w));
    this.pos = V(); this.vel = V(); this.yaw = 0; this.vf = 0; this.vy = 0; this.hp = 100; this.ai = 'traffic';
    this.dir = 0; this.plan = null; this.sinceTurn = 99; this.cruise = 9 + Math.random() * 5; this.frozen = 0; this.emp = 0; this.infected = 0; this.gen = 0;
    this.dead = false; this.deadT = 0; this.stuck = 0; this.rev = 0; this.grounded = true; this.occupied = true; this.launch = 0;
    this.m.root.rotation.order = 'YXZ'; G.scene.add(this.m.root);
  }
  get fwd() { return _a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  place(x, z, dir) { this.pos.set(x, G.world.groundAt(x, z), z); this.dir = dir; this.yaw = Math.atan2(DIRS[dir][0], DIRS[dir][1]); this.sync(0); }
  // arcade driving model shared by the player and police AI
  drive(dt, throttle, steer, handbrake) {
    const s = this.spec; if (this.frozen > 0 || this.emp > 0 || this.dead) { throttle = 0; steer = 0; if (this.frozen > 0) this.vel.multiplyScalar(Math.exp(-6 * dt)); }
    let fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), vf = this.vel.x * fx + this.vel.z * fz, vs = this.vel.x * -fz + this.vel.z * fx;
    if (this.grounded) {
      if (throttle * vf < -0.5) vf += throttle * 30 * dt; else vf += throttle * (throttle > 0 ? s.acc * (1 - clamp(vf / s.max, 0, 1) * 0.7) : 9) * dt;
      vf -= vf * 0.12 * dt + Math.sign(vf) * Math.min(Math.abs(vf), (throttle ? 0.3 : 2.2) * dt);
      if (handbrake) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 16 * dt);
      vf = clamp(vf, -13, s.max * (this.boost || 1));
      vs *= Math.exp(-(handbrake ? 1.4 : 6.5 - Math.min(3.5, Math.abs(vf) * 0.06)) * dt);
      this.yaw -= steer * (2.4 / (1 + Math.abs(vf) / 24)) * clamp(vf / 5, -1, 1) * dt * (handbrake ? 1.5 : 1) * (this.spec.len > 8 ? 0.55 : 1);
      fx = Math.sin(this.yaw); fz = Math.cos(this.yaw); this.vel.x = fx * vf - fz * vs; this.vel.z = fz * vf + fx * vs;
    }
    this.vf = vf; this.steer = steer; this.physics(dt);
  }
  physics(dt) {
    const p = this.pos, px = p.x, pz = p.z; this.vy -= GRAV * dt; p.x += this.vel.x * dt; p.z += this.vel.z * dt; p.y += this.vy * dt;
    this.yaw += this.av * dt; this.av *= Math.exp(-(this.grounded ? 2.6 : 0.4) * dt);
    // the body is a row of circles nose to tail, so corners clip and spin the car
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), n = this.circ, r = this.spec.w / 2 + 0.05, half = this.spec.len / 2 - r;
    let grounded = false, onTop = -1e9, hitN = null, before = Math.hypot(this.vel.x, this.vel.z);
    for (let i = 0; i < n; i++) {
      const o = n === 1 ? 0 : -half + (2 * half) * i / (n - 1), cx = p.x + fx * o, cz = p.z + fz * o;
      _c.set(cx, p.y, cz); _b.set(this.vel.x + this.av * o * fz, this.vy, this.vel.z - this.av * o * fx);
      G.world.collide(_c, r, 1.4, _b, out, true);
      const dx = _c.x - cx, dz = _c.z - cz;
      if (dx || dz) {
        p.x += dx; p.z += dz; const l = Math.hypot(dx, dz), nx = dx / l, nz = dz / l, vn = this.vel.x * nx + this.vel.z * nz;
        if (vn < 0) { this.vel.x -= vn * nx * 1.15; this.vel.z -= vn * nz * 1.15; const I = this.spec.mass * (this.spec.len ** 2 + this.spec.w ** 2) / 12, J = -vn * this.spec.mass * 1.15; this.av += (o * fz * nx * J - o * fx * nz * J) / I * 0.6; if (!hitN) hitN = [nx, nz, cx - nx * r, cz - nz * r, -vn]; }
      }
      if (out.grounded) grounded = true; if (out.box) onTop = Math.max(onTop, out.box.maxy);
    }
    // the ground under the centre of the car (or the deck/roof it is driving on), not the highest corner
    const g = Math.max(G.world.groundAt(p.x, p.z), onTop); if (p.y < g) { p.y = g; grounded = true; }
    if (hitN) { const loss = hitN[4]; if (loss > 4) { this.damage(loss * 1.5 * (this.spec.mass > 5000 ? 0.3 : 1), hitN[2], hitN[3]); G.audio.crash(p, loss); if (this === G.player.car) G.shake = Math.min(1, loss / 18); } }
    G.props && G.props.carHit(this);
    if (G.world.insideAny(p, 1.4)) { p.x = px; p.z = pz; this.vel.x *= -0.2; this.vel.z *= -0.2; }   // never end inside a building
    if (grounded) { if (this.vy < -6 && this === G.player.car) G.shake = Math.max(G.shake, Math.min(0.5, -this.vy / 30)); this.vy = 0; this.grounded = true; } else if (this.grounded && p.y - g < 0.5 && this.vy <= 0) { p.y = g; this.vy = 0; } else this.grounded = false;
    if (g < -1.2 && p.y < -0.6) { this.vel.multiplyScalar(Math.exp(-3 * dt)); p.y = Math.max(p.y, -1.2); this.vy = Math.max(this.vy, 0); this.grounded = true; }
    this.sync(dt);
  }
  // a hit off-centre sets the car spinning
  spinFrom(x, z, speed) { const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), dx = x - this.pos.x, dz = z - this.pos.z, side = dx * fz - dz * fx, along = dx * fx + dz * fz; this.av += clamp(-side * along * speed * 0.02, -2.5, 2.5); }
  sync(dt) {
    const r = this.m.root, p = this.pos, fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); r.position.copy(p); r.rotation.y = this.yaw;
    if (this.grounded && dt) {
      // body follows the slope of the ground under the wheels, smoothly
      const W = G.world, L = this.spec.wb, T = this.spec.track, hf = W.groundAt(p.x + fx * L, p.z + fz * L), hb = W.groundAt(p.x - fx * L, p.z - fz * L), hl = W.groundAt(p.x - fz * T, p.z + fx * T), hr = W.groundAt(p.x + fz * T, p.z - fx * T);
      r.rotation.x = damp(r.rotation.x, clamp(-Math.atan2(hf - hb, 2 * L), -0.5, 0.5), 8, dt); r.rotation.z = damp(r.rotation.z, clamp(-Math.atan2(hr - hl, 2 * T), -0.4, 0.4), 8, dt);
    } else if (dt) { r.rotation.x += this.launch * dt; }
    if (dt) {
      // suspension: acceleration squat and cornering roll, filtered so frame-to-frame noise never shows
      this.accF = damp(this.accF || 0, clamp((this.vf - this.lastVf) / Math.max(dt, 1 / 30), -12, 12), 4, dt); this.lastVf = this.vf;
      this.pitch = damp(this.pitch, clamp(-this.accF * 0.004, -0.045, 0.045), 5, dt);
      this.roll = damp(this.roll, clamp((this.steer || 0) * this.vf * 0.003 + this.av * this.vf * 0.0015, -0.07, 0.07), 4, dt);
    }
    this.m.tilt.rotation.z = this.roll; this.m.tilt.rotation.x = this.pitch;
    for (const w of this.m.wheels) w.rotation.x += this.vf * (dt || 0) / this.spec.wheel;
    for (const w of this.m.steer) w.rotation.y = -(this.steer || 0) * 0.45;
    if (this.m.beam) this.m.beam.visible = G.sky.night > 0.3 && (this === G.player.car || this.pos.distanceToSquared(G.player.pos) < 3600);
    if (this.m.bar) { const on = this.ai === 'cop' && !this.dead && this.emp <= 0, f = Math.floor(G.time * 6) % 2; this.m.bar[0].visible = on && !f; this.m.bar[1].visible = on && !!f; }
  }
  damage(d, x, z) {
    if (this.dead) return; this.hp -= d * (this.spec.mass > 5000 ? 0.3 : 1);
    if (x !== undefined && d > 3) { const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), dx = x - this.pos.x, dz = z - this.pos.z; dent(this.m, dx * fz - dz * fx, 0.7, dx * fx + dz * fz, Math.min(0.32, d * 0.01)); if (d > 12) G.fx.burst(_c.set(x, this.pos.y + 1, z), 0xcfe8ff, 10, 4, 0.6, 0.5, 14, 0.5); }
    if (this.hp <= 0) this.explode();
  }
  explode() {
    if (this.dead) return; this.dead = true; this.hp = 0; this.ai = 'none'; this.deadT = 0; this.m.paint.color.set(0x111111); this.m.paint.clearcoat = 0; this.m.paint.roughness = 1;
    G.fx.explosion(_c.copy(this.pos).setY(this.pos.y + 1), 1.2); this.vy = 9; this.grounded = false; this.launch = (Math.random() - 0.5) * 6;
    G.ents.blast(this.pos, 9, 70, 12, this); if (G.player.car === this) { G.player.exitCar(true); G.player.damage(45, this.pos); }
  }
  // lane-following traffic
  traffic(dt) {
    const d = DIRS[this.dir], p = this.pos, axisX = d[0] !== 0, a = axisX ? p.x : p.z, sgn = axisX ? d[0] : d[1];
    this.sinceTurn += this.vf * dt;
    if (!this.plan && this.sinceTurn > 30) {
      const I = sgn > 0 ? Math.ceil((a + 0.01) / BLOCK) * BLOCK : Math.floor((a - 0.01) / BLOCK) * BLOCK;
      if (Math.abs(I - a) < 16) {
        const r = Math.random(), order = r < 0.55 ? [0, 1, 3] : r < 0.78 ? [1, 0, 3] : [3, 0, 1]; let nd = (this.dir + 2) % 4;
        const cross = roadLine(axisX ? p.z : p.x), ix = axisX ? I : cross, iz = axisX ? cross : I;
        for (const o of order) { const c = (this.dir + o) % 4, q = DIRS[c]; if (G.world.isRoadChunk(ix + q[0] * 70, iz + q[1] * 70)) { nd = c; break; } }
        const n = DIRS[nd]; this.plan = { nd, at: nd === this.dir ? null : I + (axisX ? -n[1] : n[0]) * LANE, uturn: nd === (this.dir + 2) % 4, cross };
      }
    }
    if (this.plan && this.plan.at !== null && (a - this.plan.at) * sgn >= 0) {
      const pl = this.plan, n = DIRS[pl.nd];
      if (pl.uturn) { if (axisX) p.z = pl.cross + n[0] * LANE; else p.x = pl.cross - n[1] * LANE; } else if (axisX) p.x = pl.at; else p.z = pl.at;
      this.dir = pl.nd; this.plan = null; this.sinceTurn = 0;
    } else if (this.plan && this.plan.at === null && (a - roadLine(a)) * sgn > 8) { this.plan = null; this.sinceTurn = 0; }
    // brake for anything in the lane ahead
    let target = this.plan && this.plan.at !== null ? 5 : this.cruise; const dd = DIRS[this.dir];
    const block = (q, rad) => { const rx = q.x - p.x, rz = q.z - p.z, f = rx * dd[0] + rz * dd[1], l = Math.abs(-rx * dd[1] + rz * dd[0]); if (f > 1 && f < 7 + this.vf * 0.9 && l < rad && Math.abs(q.y - p.y) < 3) target = 0; };
    for (const c of G.ents.cars) if (c !== this) block(c.pos, 2.2);
    if (G.player.mode === 'foot') block(G.player.pos, 1.6);
    for (const n of G.ents.npcs) if (!n.dead) block(n.pos, 1.3);
    if (this.frozen > 0 || this.emp > 0) target = 0;
    this.vf = damp(this.vf, target, target < this.vf ? 4 : 1.2, dt); if (this.frozen > 0) this.vf = 0;
    const e = DIRS[this.dir]; p.x += e[0] * this.vf * dt; p.z += e[1] * this.vf * dt; p.y = G.world.groundAt(p.x, p.z); this.grounded = true;
    this.vel.set(e[0] * this.vf, 0, e[1] * this.vf);
    this.yaw += angDiff(this.yaw, Math.atan2(e[0], e[1])) * Math.min(1, 5 * dt); this.steer = 0; out.box = null; this.sync(dt);
  }
  // traffic on a real street network: follow the edge on the correct side, choose a turn at each junction
  roadInit(e, dir, s) { this.re = e; this.rdir = dir; this.rs = s; this.next = -1; this.ai = 'road'; const R = City.active.r; this.lane = Math.max(1.7, ROAD_W[R.cls[e]] / 4) * (City.active.drive === 'left' ? -1 : 1); this.cruise = [0, 22, 18, 14, 12.5, 11, 8.5, 5, 5][R.cls[e]] * (0.85 + Math.random() * 0.25); City.along(e, s, dir, this.lane, _o); this.pos.set(_o.x, BASE, _o.z); this.yaw = Math.atan2(_o.hx, _o.hz); this.sync(0); }
  road(dt) {
    const C = City.active, R = C.r; if (!C || this.re >= R.E) { this.ai = 'none'; return; }
    const e = this.re, L = R.len[e], end = this.rdir > 0 ? R.nb[e] : R.na[e], left = L - this.rs;
    if (this.next < 0 && left < 25) {
      const opts = R.adj[end].filter(x => x !== e); let best = e, bs = -1e9;
      City.along(e, L - 0.1, this.rdir, 0, _o); const hx = _o.hx, hz = _o.hz;
      for (const x of opts) { const d2 = R.na[x] === end ? 1 : -1; City.along(x, 2, d2, 0, _p); const dot = hx * _p.hx + hz * _p.hz, sc = dot * 1.2 + Math.random() * 1.4 - (R.cls[x] > 7 ? 1.5 : 0); if (sc > bs) { bs = sc; best = x; } }
      this.next = best; this.nextDir = R.na[best] === end ? 1 : -1; this.turn = bs;
    }
    let target = this.cruise * (this.next >= 0 && this.turn < 0.6 && left < 18 ? 0.45 : 1);
    // queue behind anything ahead, give way at junctions
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), look = 6 + this.vf * 1.3, p = this.pos;
    const block = (q, rad) => { const rx = q.x - p.x, rz = q.z - p.z, f = rx * fx + rz * fz, l = Math.abs(rx * fz - rz * fx); if (f > 0.5 && f < look + this.spec.len / 2 && l < rad && Math.abs(q.y - p.y) < 3) target = Math.min(target, Math.max(0, (f - this.spec.len / 2 - 3) * 0.8)); };
    for (const c of G.ents.cars) if (c !== this) block(c.pos, 1.6 + c.spec.w / 2);
    if (G.player.mode === 'foot') block(G.player.pos, 1.5);
    for (const n of G.ents.npcs) if (!n.dead && n.state !== 'walk') block(n.pos, 1.3);
    const res = G.ents.junction;
    if (left < 9) { const holder = res.get(end); if (holder && holder !== this && holder.re !== undefined && G.ents.cars.includes(holder) && holder.pos.distanceToSquared(p) < 900 && (G.time - holder.resT) < 6) target = 0; else { res.set(end, this); this.resT = G.time; } }
    if (this.frozen > 0 || this.emp > 0) target = 0;
    this.vf = damp(this.vf, target, target < this.vf ? 5 : 1.1, dt); if (this.frozen > 0) this.vf = 0;
    this.rs += this.vf * dt;
    if (this.rs >= L) {
      if (res.get(end) === this) res.delete(end);
      if (this.next < 0) { this.rdir = -this.rdir; this.rs = 0; } else { this.rs -= L; this.re = this.next; this.rdir = this.nextDir; this.next = -1; }
      const cls = R.cls[this.re]; this.lane = Math.max(1.7, ROAD_W[cls] / 4) * (C.drive === 'left' ? -1 : 1); this.cruise = [0, 22, 18, 14, 12.5, 11, 8.5, 5, 5][cls] * (0.85 + Math.random() * 0.25);
    }
    City.along(this.re, this.rs, this.rdir, this.lane, _o);
    const k = 1 - Math.exp(-6 * dt); p.x += (_o.x - p.x) * k; p.z += (_o.z - p.z) * k; p.y = G.world.groundAt(p.x, p.z);
    this.grounded = true; this.vel.set(_o.hx * this.vf, 0, _o.hz * this.vf); this.vy = 0;
    this.yaw += angDiff(this.yaw, Math.atan2(_o.hx, _o.hz)) * Math.min(1, 6 * dt); this.steer = 0; this.sync(dt);
  }
  // nearest street to join after a chase or a crash
  joinRoad() {
    const C = City.active; if (!C) return false; const R = C.r; let best = -1, bd = 400, bs = 0;
    for (const e of C.eOver.get(Math.floor(this.pos.x / CH) + ',' + Math.floor(this.pos.z / CH)) || []) { if (!DIRS_OK(R, e)) continue; for (let j = R.ps[e]; j < R.ps[e + 1] - 1; j++) { const ax = R.v[j * 2], az = R.v[j * 2 + 1], bx = R.v[j * 2 + 2], bz = R.v[j * 2 + 3], dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, t = clamp(((this.pos.x - ax) * dx + (this.pos.z - az) * dz) / (l || 1), 0, 1), d = (ax + dx * t - this.pos.x) ** 2 + (az + dz * t - this.pos.z) ** 2; if (d < bd) { bd = d; best = e; bs = R.cum[j] + Math.sqrt(l) * t; } } }
    if (best < 0) return false; const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw); City.along(best, bs, 1, 0, _o); const dir = _o.hx * fx + _o.hz * fz >= 0 ? 1 : -1;
    this.roadInit(best, dir, dir > 0 ? bs : R.len[best] - bs); return true;
  }
  // police pursuit: steer at the target, feel for walls, back out when stuck
  pursue(dt, tgt, speedCap) {
    const p = this.pos, dx = tgt.x - p.x, dz = tgt.z - p.z, dist = Math.hypot(dx, dz);
    let want = Math.atan2(dx, dz), steer = 0, thr = 1;
    for (const s of [-1, 1]) { const a = this.yaw + s * 0.45, L = 9 + this.vf * 0.6; let hit = false; G.world.forBoxes(p.x + Math.sin(a) * L - 0.5, p.z + Math.cos(a) * L - 0.5, p.x + Math.sin(a) * L + 0.5, p.z + Math.cos(a) * L + 0.5, b => { if (b.maxy > p.y + 0.5) hit = true; }); if (hit) want += s * -0.9; }
    const diff = angDiff(this.yaw, want); steer = clamp(-diff * 2, -1, 1);
    if (Math.abs(diff) > 1.2 && this.vf > 12) thr = -0.4;
    if (this.vf > speedCap) thr = 0;
    if (dist < 14 && this.vf > 8) thr = -1;
    if (Math.abs(this.vf) < 1.2) this.stuck += dt; else this.stuck = Math.max(0, this.stuck - dt * 2);
    if (this.stuck > 1.4) { this.rev = 1.3; this.stuck = 0; }
    if (this.rev > 0) { this.rev -= dt; thr = -1; steer = -steer; }
    this.drive(dt, thr, steer, false);
  }
  update(dt) {
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) this.m.paint.emissive.set(0); }
    if (this.emp > 0) this.emp -= dt;
    if (this.infected > 0 && !this.dead) {
      this.infected -= dt; if (Math.random() < dt * 14) { G.vfx.emit('toxic', _c.copy(this.pos).setY(this.pos.y + 1.2), { n: 1, speed: 1.2, life: 1.2, size: 1.1, spread: 2.2 }); G.vfx.emit('electric', _c, { n: 1, speed: 3, life: 0.2, size: 0.3, color: 0x9dff4a, spread: 2 }); }
      if (this.infected <= 0) this.explode();
    }
    if (this.onFire > 0 && !this.dead) { this.onFire -= dt; this.damage(9 * dt); if (Math.random() < dt * 30) G.vfx.emit('fire', _c.copy(this.pos).setY(this.pos.y + 1.1), { n: 1, speed: 1, life: 0.7, size: 1.3, spread: 1.6 }); if (Math.random() < dt * 6) G.vfx.emit('smoke', _c, { n: 1, speed: 0.8, life: 2.5, size: 1, spread: 1 }); }
    if (this.dead) { this.deadT += dt; if (this.deadT < 16) { _c.copy(this.pos).setY(this.pos.y + 1.1); if (this.deadT < 7 && Math.random() < dt * 22) G.vfx.emit('fire', _c, { n: 1, speed: 0.8, life: 0.8, size: 1.5, spread: 1.4 }); if (Math.random() < dt * 9) G.vfx.emit('smoke', _c, { n: 1, speed: 0.7, life: 4, size: 1.3, spread: 1, grav: -2.6 }); } }
    if (this === G.player.car) return;
    if (this.infected > 0 && this.ai !== 'none') {            // hijacked by the virus: drives itself, badly
      this.boost = 1.2; this.drive(dt, 1, Math.sin(G.time * 1.7 + this.gen * 3 + this.pos.x) * 0.8, false);
    } else if (this.ai === 'traffic') this.traffic(dt);
    else if (this.ai === 'road') this.road(dt);
    else if (this.ai === 'cop') G.wanted.driveCop(this, dt);
    else if (this.ai === 'leave' && City.inside(this.pos.x, this.pos.z)) { if (!this.joinRoad()) this.ai = 'none'; }
    else if (this.ai === 'leave') { this.ai = 'traffic'; this.dir = Math.round(((Math.atan2(Math.sin(this.yaw), Math.cos(this.yaw)) / (Math.PI / 2)) % 4 + 4)) % 4; this.dir = [1, 0, 3, 2][this.dir]; this.snapToLane(); }
    else this.drive(dt, 0, 0, this.grounded && !this.occupied && Math.abs(this.vf) < 3);
  }
  snapToLane() { const d = DIRS[this.dir]; if (d[0]) this.pos.z = roadLine(this.pos.z) + d[0] * LANE; else this.pos.x = roadLine(this.pos.x) - d[1] * LANE; this.plan = null; this.sinceTurn = 99; }
  remove() { G.scene.remove(this.m.root); }
}

// ================= people =================
export class NPC {
  constructor(kind, x, z, heavy) {
    this.kind = kind; this.heavy = heavy; this.rig = makeRig(kind === 'ped' ? civilianLook(G.ents.regKey) : kind === 'cop' ? copLook(G.ents.regKey) : thugLook(heavy)); G.scene.add(this.rig.root);
    this.pos = V().set(x, G.world.groundAt(x, z), z); this.vel = V(); this.yaw = Math.random() * TAU; this.hp = this.maxHp = heavy ? 220 : kind === 'ped' ? 40 : kind === 'thug' ? 90 : 80;
    this.state = 'walk'; this.t = 0; this.cool = 1 + Math.random(); this.gun = kind === 'cop' || (kind === 'thug' && !heavy && Math.random() < 0.35);
    this.frozen = 0; this.webbed = 0; this.infected = 0; this.gen = 0; this.burning = 0; this.dead = false; this.deadT = 0; this.punch = 0; this.side = 1; this.grounded = true;
    this.axis = Math.random() < 0.5 ? 0 : 1; this.sgn = Math.random() < 0.5 ? 1 : -1; if (this.gun && G.weapons) G.weapons.armNPC(this); this.hostile = kind === 'thug'; this.gang = null; this.fx = x; this.fz = z + 1; this.shell = null; this.anim = {};
  }
  setShell(color, opacity) {
    if (!color) { if (this.shell) { this.rig.root.remove(this.shell); this.shell.material.dispose(); this.shell = null; } return; }
    if (this.shell) return;
    const ice = color === 0xa8e4ff, web = color === 0xf2f2f2;
    const mat = ice ? new THREE.MeshStandardMaterial({ color: 0xc8f0ff, transparent: true, opacity: 0.62, roughness: 0.04, metalness: 0.25, emissive: 0x2f7fb0, emissiveIntensity: 0.55, flatShading: true })
      : web ? new THREE.MeshStandardMaterial({ color: 0xffffff, map: G.vfx.webTex(), alphaMap: G.vfx.webTex(), transparent: true, opacity: 0.95, roughness: 0.8, side: THREE.DoubleSide, depthWrite: false })
      : new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.15, metalness: 0.1 });
    this.shell = new THREE.Mesh(ice ? ICE_SHELL : SHELL, mat); this.shell.position.y = 0.95; if (ice || web) this.shell.rotation.y = Math.random() * 6.28; this.rig.root.add(this.shell);
    if (ice) G.vfx.emit('frost', _c.copy(this.pos).setY(this.pos.y + 1), { n: 12, speed: 2, life: 0.6, size: 0.9 });
  }
  hit(dmg, dir, knock, src) {
    if (this.dead) return;
    if (this.frozen > 0) { dmg *= 2.2; this.frozen = 0; this.setShell(null); _c.copy(this.pos).setY(this.pos.y + 1); G.vfx.emit('ice', _c, { n: 26, speed: 8, life: 1, size: 0.35, spread: 1 }); G.vfx.emit('frost', _c, { n: 10, speed: 2, life: 0.6, size: 1 }); G.audio.shatter(this.pos); knock = Math.max(knock, 7); }
    this.hp -= dmg; G.vfx.emit('spark', _c.copy(this.pos).setY(this.pos.y + 1.2), { n: 5, speed: 4, life: 0.2, size: 0.08, color: 0xffe0a0 });
    if (src === 'player') { this.fx = G.player.pos.x; this.fz = G.player.pos.z; if (this.kind === 'ped') G.wanted.crime(1.3); else if (this.kind === 'cop') G.wanted.crime(2.2); else this.alert = true; G.ents.panic(this.pos, 22); }
    if (this.hp <= 0) { this.dead = true; this.deadT = 0; knock = Math.max(knock, 5); if (src === 'player' || src === 'virus') G.onDefeat(this); }
    if (knock > 0 || this.dead) { this.state = 'down'; this.t = this.dead ? 99 : 1.6 + Math.random(); this.vel.set((dir ? dir.x : 0) * knock, knock * 0.55 + 2, (dir ? dir.z : 0) * knock); this.grounded = false; this.webbed = Math.min(this.webbed, 0.01); }
    else if (this.state !== 'down') { this.state = 'stagger'; this.t = 0.35; }
  }
  freeze(t) { if (this.dead) return; this.frozen = t; this.setShell(0xa8e4ff, 0.55); this.vel.set(0, this.vel.y, 0); }
  web(t) { if (this.dead) return; this.webbed = t; this.setShell(0xf2f2f2, 0.8); }
  infect(gen) { if (this.dead || this.infected > 0 || gen > 5) return false; this.infected = 14; this.gen = gen; tintRig(this.rig, 0x55ff33, 1.6); G.stats.infected++; return true; }
  moveTo(tx, tz, speed, dt) {
    const dx = tx - this.pos.x, dz = tz - this.pos.z, d = Math.hypot(dx, dz) || 1;
    this.vel.x = damp(this.vel.x, dx / d * speed, 8, dt); this.vel.z = damp(this.vel.z, dz / d * speed, 8, dt);
    if (speed > 0.2) this.yaw += angDiff(this.yaw, Math.atan2(dx, dz)) * Math.min(1, 10 * dt); return d;
  }
  shoot(target, dmg) {
    const from = _a.copy(this.pos).setY(this.pos.y + 1.4), to = _b.copy(target.pos).setY(target.pos.y + 1.1);
    const sp = target.vel ? target.vel.length() : 0, hitc = clamp(0.8 - sp * 0.028, 0.08, 0.8);
    const ok = Math.random() < hitc; if (!ok) to.add(_c.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).multiplyScalar(4));
    G.fx.line(from.clone(), to.clone(), 0xffe9a0, 0.03, 0.09); G.fx.burst(from, 0xffd070, 3, 2, 0.08, 1.4); G.audio.shot(this.pos);
    if (ok) { if (target === G.player) G.player.damage(dmg, this.pos); else target.hit(dmg, null, 0, 'npc'); }
    this.aimT = 0.4;
  }
  fight(target, dt, visible) {              // shared by thugs, police and the infected
    const tp = target.pos, d = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z), dy = tp.y - this.pos.y;
    this.cool -= dt;
    if (this.gun && visible) {
      const keep = d > 22 ? 6 : d < 9 ? -3.5 : 0; this.moveTo(tp.x, tp.z, Math.abs(keep), dt); if (keep < 0) { this.vel.x *= -1; this.vel.z *= -1; }
      this.yaw += angDiff(this.yaw, Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z)) * Math.min(1, 10 * dt);
      if (this.cool <= 0 && d < 70) { this.cool = 0.9 + Math.random() * 1.3; this.shoot(target, this.kind === 'cop' ? 5 + G.wanted.level : 6); }
    } else if (d > 1.7 || Math.abs(dy) > 2.5) this.moveTo(tp.x, tp.z, this.heavy ? 4.6 : 6.2, dt);
    else {
      this.moveTo(tp.x, tp.z, 0, dt); this.yaw = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
      if (this.cool <= 0) { this.cool = this.heavy ? 1.5 : 1 + Math.random() * 0.6; this.punch = 0.001; this.side = -this.side; this.pending = { target, t: 0.22, dmg: this.heavy ? 22 : this.infected > 0 ? 18 : 9 }; }
    }
  }
  update(dt) {
    const p = this.pos, pl = G.player, A = this.anim; A.down = A.flail = A.aim = false; A.punch = 0;
    if (this.punch > 0) { this.punch += dt * 3.2; if (this.punch >= 1) this.punch = 0; A.punch = this.punch; A.punchSide = this.side; }
    if (this.pending) { this.pending.t -= dt; if (this.pending.t <= 0) { const q = this.pending, tg = q.target; this.pending = null; if (!this.dead && this.state !== 'down' && tg.pos.distanceTo(p) < 2.4) { if (tg === pl) pl.damage(q.dmg, p); else { tg.hit(q.dmg, _a.subVectors(tg.pos, p).normalize(), this.heavy ? 6 : 0, this.infected > 0 ? 'virus' : 'npc'); if (this.infected > 0) tg.infect(this.gen + 1); } G.audio.hit(p); } } }
    if (this.aimT > 0) { this.aimT -= dt; A.aim = true; }
    if (this.dead) this.deadT += dt;
    let active = !this.dead && this.state !== 'down';
    if (this.frozen > 0) { this.frozen -= dt; if (this.frozen <= 0) this.setShell(null); active = false; this.vel.x = this.vel.z = 0; }
    else if (this.webbed > 0) { this.webbed -= dt; if (this.webbed <= 0) this.setShell(null); if (!this.dead && this.state !== 'down') { active = false; this.vel.x *= 0.8; this.vel.z *= 0.8; } }
    if (this.burning > 0 && !this.dead) { this.burning -= dt; this.hp -= 11 * dt; A.flail = true; if (Math.random() < dt * 26) G.vfx.emit('fire', _c.copy(p).setY(p.y + 0.6 + Math.random()), { n: 1, speed: 0.6, life: 0.6, size: 0.8, spread: 0.5 }); if (this.hp <= 0) this.hit(1, null, 2, 'player'); }
    if (this.infected > 0 && !this.dead) {
      this.infected -= dt; this.hp -= 4 * dt; if (Math.random() < dt * 9) G.vfx.emit(Math.random() < 0.6 ? 'spore' : 'toxic', _c.copy(p).setY(p.y + 1.3), { n: 1, speed: 0.8, life: 1.1, size: Math.random() < 0.6 ? 0.12 : 0.7, spread: 0.7 });
      if (this.infected <= 0) tintRig(this.rig, 0, 0); if (this.hp <= 0) this.hit(1, null, 0, 'virus');
    }
    if (this.state === 'down') {
      A.down = this.grounded; A.flail = !this.grounded; this.t -= dt;
      if (this.grounded) { this.vel.x *= Math.exp(-5 * dt); this.vel.z *= Math.exp(-5 * dt); }
      if (this.t <= 0 && !this.dead && this.grounded) { this.state = this.kind === 'ped' ? 'flee' : 'walk'; this.t = 6; }
    } else if (this.state === 'stagger') { this.t -= dt; this.vel.x *= 0.85; this.vel.z *= 0.85; if (this.t <= 0) this.state = this.kind === 'ped' ? 'flee' : 'walk'; this.t = this.t <= 0 ? 6 : this.t; }
    else if (active) {
      const dp = Math.hypot(pl.pos.x - p.x, pl.pos.z - p.z), sees = !pl.invisible && dp < 60 && Math.abs(pl.pos.y - p.y) < 45;
      if (this.infected > 0) {                                    // berserk: attack whoever is closest
        const o = G.ents.nearest(p, 30, n => n !== this && n.infected <= 0); if (o) this.fight(o, dt, true); else this.wander(dt, 2);
        const s = G.ents.nearest(p, 3.2, n => n !== this && n.infected <= 0); if (s && Math.random() < dt * 1.5) s.infect(this.gen + 1);
      } else if (this.burning > 0) { this.wander(dt, 6.5); if (Math.random() < dt * 2) this.sgn = -this.sgn; }
      else if (this.kind === 'thug') {
        if (!this.alert && sees && dp < 26) { this.alert = true; if (this.gang) for (const m of this.gang.members) m.alert = true; }
        if (this.alert && (sees || dp < 8)) this.fight(pl, dt, sees && G.world.los(_a.copy(p).setY(p.y + 1.5), _b.copy(pl.pos).setY(pl.pos.y + 1))); else { this.vel.x *= 0.9; this.vel.z *= 0.9; if (this.alert && !sees) this.wander(dt, 2); }
      } else if (this.kind === 'cop') {
        if (G.wanted.level > 0) { const tgt = G.wanted.seen ? pl.pos : G.wanted.last; if (G.wanted.seen) this.fight(pl, dt, this.canSee); else if (this.moveTo(tgt.x, tgt.z, 5.5, dt) < 6) this.wander(dt, 2.5); }
        else this.wander(dt, 1.6);
      } else if (this.state === 'flee') { this.t -= dt; const ax = p.x - this.fx, az = p.z - this.fz, l = Math.hypot(ax, az) || 1; this.moveTo(p.x + ax / l * 10, p.z + az / l * 10, 6.8, dt); A.flail = true; if (this.t <= 0) this.state = 'walk'; }
      else this.wander(dt, 1.5);
    }
    // integrate
    this.vel.y -= GRAV * dt; p.addScaledVector(this.vel, dt); G.world.collide(p, 0.35, 1.8, this.vel, out); this.grounded = out.grounded;
    if (out.wall && this.kind === 'ped' && this.state === 'walk') this.sgn = -this.sgn;
    if (out.ground < -0.8 && p.y < -0.8) { p.y = -0.8; this.vel.y = 0; this.grounded = true; }
    const r = this.rig; r.root.position.copy(p); r.root.rotation.y = this.yaw;
    A.speed = this.frozen > 0 ? 0 : Math.hypot(this.vel.x, this.vel.z); A.air = !this.grounded && this.state !== 'down'; A.vy = this.vel.y;
    if (this.frozen <= 0) animateRig(r, A, dt);
    if (this.dead && this.deadT > 7) r.root.position.y -= (this.deadT - 7) * 0.4;
  }
  // stroll along pavements, turning at corners
  wander(dt, speed) {
    const p = this.pos;
    if (City.active && City.inside(p.x, p.z)) {
      // walk the pavement of a real street, choosing a new street at each corner
      const R = City.active.r;
      if (!this.path || this.path.e >= R.E) { const s = G.ents.cityWalkSpot(0, 25); if (!s) { this.moveTo(p.x, p.z, 0, dt); return; } this.path = { e: s.e, dir: s.dir, s: s.s, side: s.side }; }
      const w = this.path; w.s += speed * dt;
      if (w.s > R.len[w.e]) { const end = w.dir > 0 ? R.nb[w.e] : R.na[w.e], opts = R.adj[end].filter(x => x !== w.e); if (opts.length) { const n = opts[Math.random() * opts.length | 0]; w.dir = R.na[n] === end ? 1 : -1; w.e = n; w.side = Math.sign(w.side) * (ROAD_W[R.cls[n]] / 2 + 1.7); } else w.dir = -w.dir; w.s = 0; }
      City.along(w.e, w.s, w.dir, w.side, _o); this.moveTo(_o.x, _o.z, speed, dt); return;
    }
    const ch = G.world.chunkAt(p.x, p.z);
    if (!ch || !ch.urban) { this.moveTo(p.x + Math.sin(this.yaw) * 5, p.z + Math.cos(this.yaw) * 5, speed, dt); if (Math.random() < dt * 0.3) this.yaw += (Math.random() - 0.5) * 2; return; }
    const ax = this.axis, a = ax ? p.z : p.x, c = ax ? p.x : p.z, line = roadLine(c), side = c >= line ? 1 : -1, want = line + side * 9;
    const tx = ax ? want : a + this.sgn * 6, tz = ax ? a + this.sgn * 6 : want; this.moveTo(tx, tz, speed, dt);
    const m = ((a % BLOCK) + BLOCK) % BLOCK; if ((Math.abs(m - 9) < 0.6 || Math.abs(m - 87) < 0.6) && Math.random() < dt * 3) { if (Math.random() < 0.5) { this.axis = 1 - ax; this.sgn = Math.random() < 0.5 ? 1 : -1; } }
  }
  remove() { G.scene.remove(this.rig.root); for (const m of this.rig.mats) m.dispose(); }
}
const SHELL = new THREE.CapsuleGeometry(0.5, 1.1, 3, 8);
// a jagged block of ice: a stretched, randomly pushed-out icosphere, flat shaded so every facet catches the light
const ICE_SHELL = (() => { const g = new THREE.IcosahedronGeometry(0.62, 1); const a = g.attributes.position, seen = new Map();
  for (let i = 0; i < a.count; i++) { const k = a.getX(i).toFixed(3) + a.getY(i).toFixed(3) + a.getZ(i).toFixed(3); let f = seen.get(k); if (!f) seen.set(k, f = 0.85 + Math.random() * 0.4); a.setXYZ(i, a.getX(i) * f, a.getY(i) * f * 1.75, a.getZ(i) * f); }
  g.computeVertexNormals(); return g; })();

// ================= manager =================
export class Ents {
  constructor(q) { this.q = q; this.npcs = []; this.cars = []; this.gangs = []; this.spawnT = 0; this.gangT = 12; this.junction = new Map(); }
  get regKey() { const ch = G.world.chunkAt(G.player.pos.x, G.player.pos.z); return ch ? ch.regKey : 'europe'; }
  // a random drivable spot in a ring around the player, on a real street
  cityRoadSpot(minR, maxR) {
    const C = City.active, R = C.r, pl = G.player.pos, cx = Math.floor(pl.x / CH), cz = Math.floor(pl.z / CH), r = Math.ceil(maxR / CH);
    if (!this.candKey || this.candKey !== cx + ',' + cz + ',' + r) { this.candKey = cx + ',' + cz + ',' + r; this.cand = []; for (let i = -r; i <= r; i++) for (let j = -r; j <= r; j++) for (const e of C.eHome.get((cx + i) + ',' + (cz + j)) || []) if (DIRS_OK(R, e)) this.cand.push(e); }
    const cand = this.cand; if (!cand.length) return null;
    for (let i = 0; i < 24; i++) {
      const e = cand[Math.random() * cand.length | 0], dir = Math.random() < 0.5 ? 1 : -1, s0 = 4 + Math.random() * (R.len[e] - 8); City.along(e, s0, dir, 0, _o);
      const d = Math.hypot(_o.x - pl.x, _o.z - pl.z); if (d < minR || d > maxR) continue;
      let clear = true; for (const c of this.cars) if (Math.abs(c.pos.x - _o.x) + Math.abs(c.pos.z - _o.z) < 16) clear = false;
      if (clear) return { e, dir, s: s0, x: _o.x, z: _o.z };
    }
    return null;
  }
  cityWalkSpot(minR, maxR) {
    const s = this.cityRoadSpot(minR, maxR); if (!s) return null; const R = City.active.r, side = (Math.random() < 0.5 ? 1 : -1) * (ROAD_W[R.cls[s.e]] / 2 + 1.7);
    City.along(s.e, s.s, s.dir, side, _o); return { x: _o.x, z: _o.z, e: s.e, dir: s.dir, s: s.s, side };
  }
  carType() { const list = region(this.regKey).cars; return list[Math.random() * list.length | 0]; }
  nearest(p, r, filter) { let best = null, bd = r * r; for (const n of this.npcs) { if (n.dead || (filter && !filter(n))) continue; const d = n.pos.distanceToSquared(p); if (d < bd) { bd = d; best = n; } } return best; }
  inRange(p, r, cb) { const r2 = r * r; for (const n of this.npcs) if (!n.dead && n.pos.distanceToSquared(p) < r2) cb(n); }
  carsIn(p, r, cb) { const r2 = r * r; for (const c of this.cars) if (c.pos.distanceToSquared(p) < r2) cb(c); }
  panic(p, r) { this.inRange(p, r, n => { if (n.kind === 'ped' && n.state === 'walk' && n.infected <= 0) { n.state = 'flee'; n.t = 5 + Math.random() * 4; n.fx = p.x; n.fz = p.z; } }); }
  // radial damage and knockback
  blast(p, r, dmg, knock, skipCar, status) {
    this.inRange(p, r, n => { const d = _a.subVectors(n.pos, p); d.y = 0; const l = d.length() || 1; d.multiplyScalar(1 / l); n.hit(dmg * (1 - l / r * 0.6), d, knock, 'player'); if (status === 'burn') n.burning = 5; });
    this.carsIn(p, r, c => { if (c === skipCar || c === G.player.car) return; const d = _a.subVectors(c.pos, p); d.y = 0; d.normalize(); c.vel.addScaledVector(d, knock * 0.9); c.vy = knock * 0.6; c.grounded = false; c.launch = (Math.random() - 0.5) * 5; if (c.ai === 'traffic') c.ai = 'none'; c.damage(dmg * 0.9); });
    G.props && G.props.blast(p, r * 1.2, knock * 1.4);
    this.panic(p, r * 3);
  }
  roadSpot(minR, maxR) {
    const pl = G.player.pos;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU, r = minR + Math.random() * (maxR - minR), x = pl.x + Math.sin(a) * r, z = pl.z + Math.cos(a) * r;
      if (!G.world.isRoadChunk(x, z)) continue;
      const dir = Math.random() * 4 | 0, d = DIRS[dir], pos = d[0] ? { x, z: roadLine(z) + d[0] * LANE } : { x: roadLine(x) - d[1] * LANE, z };
      const m = (((d[0] ? pos.x : pos.z) % BLOCK) + BLOCK) % BLOCK; if (m < 14 || m > BLOCK - 14) continue;
      let clear = true; for (const c of this.cars) if (Math.abs(c.pos.x - pos.x) + Math.abs(c.pos.z - pos.z) < 14) clear = false;
      if (clear) return { ...pos, dir };
    }
    return null;
  }
  walkSpot(minR, maxR) {
    const pl = G.player.pos;
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * TAU, r = minR + Math.random() * (maxR - minR), x = pl.x + Math.sin(a) * r, z = pl.z + Math.cos(a) * r;
      if (!G.world.isRoadChunk(x, z)) continue; const ax = Math.random() < 0.5;
      return ax ? { x: roadLine(x) + (Math.random() < 0.5 ? 9 : -9), z } : { x, z: roadLine(z) + (Math.random() < 0.5 ? 9 : -9) };
    }
    return null;
  }
  addCar(type, color, police, spot) {
    const c = new Car(type, color, police ? region(this.regKey).police : false, this.regKey);
    if (spot.e !== undefined) c.roadInit(spot.e, spot.dir, spot.s); else c.place(spot.x, spot.z, spot.dir);
    this.cars.push(c); return c;
  }
  addNPC(kind, x, z, heavy) { const n = new NPC(kind, x, z, heavy); this.npcs.push(n); return n; }
  spawnGang() {
    const s = this.walkSpot(55, 110); if (!s) return; const g = { members: [], x: s.x, z: s.z }, n = 4 + (Math.random() * 3 | 0);
    for (let i = 0; i < n; i++) { const m = this.addNPC('thug', s.x + (Math.random() - 0.5) * 6, s.z + (Math.random() - 0.5) * 6, i === 0 && Math.random() < 0.7); m.gang = g; m.state = 'idle'; g.members.push(m); }
    this.gangs.push(g); G.ui.toast('Syndicate crew spotted nearby', 'They are marked red on your radar');
  }
  update(dt) {
    const pl = G.player.pos, real = City.inside(pl.x, pl.z, -50), urban = real || G.world.isRoadChunk(pl.x, pl.z);
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.25;
      const traffic = this.cars.filter(c => c.ai === 'traffic' || c.ai === 'road').length, peds = this.npcs.filter(n => n.kind === 'ped').length;
      if (urban && traffic < this.q.cars * (real ? 1.4 : 1)) { const s = real ? this.cityRoadSpot(60, 180) : this.roadSpot(70, 190); if (s) this.addCar(this.carType(), PAINT[Math.random() * PAINT.length | 0], false, s); }
      if (urban && peds < this.q.peds * (real ? 1.5 : 1)) { const s = real ? this.cityWalkSpot(30, 110) : this.walkSpot(35, 120); if (s) { const n = this.addNPC('ped', s.x, s.z); if (s.e !== undefined) n.path = { e: s.e, dir: s.dir, s: s.s, side: s.side }; } }
      for (let i = this.cars.length - 1; i >= 0; i--) { const c = this.cars[i], d = Math.hypot(c.pos.x - pl.x, c.pos.z - pl.z); if (c !== G.player.car && (d > (real ? 230 : 260) || (c.dead && c.deadT > 25) || (c.ai === 'none' && !c.touched && d > 140))) { c.remove(); this.cars.splice(i, 1); } }
      for (let i = this.npcs.length - 1; i >= 0; i--) { const n = this.npcs[i], d = Math.hypot(n.pos.x - pl.x, n.pos.z - pl.z); if (d > (n.kind === 'thug' ? 260 : 190) || (n.dead && n.deadT > 9) || (n.kind === 'cop' && G.wanted.level === 0 && d > 70)) { n.remove(); this.npcs.splice(i, 1); } }
      for (let i = this.gangs.length - 1; i >= 0; i--) { const g = this.gangs[i], alive = g.members.filter(m => !m.dead && this.npcs.includes(m)); if (!alive.length) { if (g.members.some(m => m.dead)) G.onGangCleared(); this.gangs.splice(i, 1); } else { g.x = alive[0].pos.x; g.z = alive[0].pos.z; } }
    }
    this.gangT -= dt; if (this.gangT <= 0 && urban) { this.gangT = 45 + Math.random() * 40; if (!this.gangs.length && G.wanted.level < 3) this.spawnGang(); }
    for (const c of this.cars) c.update(dt);
    for (const n of this.npcs) n.update(dt);
    // car against car, and cars against people
    const cs = this.cars;
    for (let i = 0; i < cs.length; i++) {
      const a = cs[i];
      for (let j = i + 1; j < cs.length; j++) {
        const b = cs[j], reach = (a.spec.len + b.spec.len) / 2 + 0.5; if (Math.abs(b.pos.x - a.pos.x) > reach || Math.abs(b.pos.z - a.pos.z) > reach || Math.abs(a.pos.y - b.pos.y) > 2.2) continue;
        contact(a, b);
      }
      const sp = Math.hypot(a.vel.x, a.vel.z); if (sp < 4) continue;
      for (const n of this.npcs) {
        if (n.dead || n.state === 'down') continue; const dx = n.pos.x - a.pos.x, dz = n.pos.z - a.pos.z; if (dx * dx + dz * dz > 4.2 || Math.abs(n.pos.y - a.pos.y) > 2) continue;
        n.hit(sp * 2.4, _a.set(a.vel.x, 0, a.vel.z).normalize(), sp * 0.6, a === G.player.car ? 'player' : 'npc'); G.audio.hit(n.pos);
      }
      if (a !== G.player.car && G.player.mode === 'foot' && G.player.iframes <= 0) { const dx = pl.x - a.pos.x, dz = pl.z - a.pos.z; if (dx * dx + dz * dz < 4 && Math.abs(pl.y - a.pos.y) < 1.8 && sp > 6) { G.player.damage(sp * 0.9, a.pos); G.player.vel.set(a.vel.x * 0.8, 6, a.vel.z * 0.8); G.player.iframes = 0.6; } }
    }
  }
  clear() { for (const c of this.cars) c.remove(); for (const n of this.npcs) n.remove(); this.cars.length = 0; this.npcs.length = 0; this.gangs.length = 0; }
}

// car against car: each body is a row of circles; resolve the deepest overlap with an impulse
// that respects both masses and the lever arm, so glancing blows spin cars and buses barely notice hatchbacks
function contact(a, b) {
  const fa = [Math.sin(a.yaw), Math.cos(a.yaw)], fb = [Math.sin(b.yaw), Math.cos(b.yaw)], ra = a.spec.w / 2, rb = b.spec.w / 2;
  let best = null;
  for (let i = 0; i < a.circ; i++) {
    const oa = a.circ === 1 ? 0 : -(a.spec.len / 2 - ra) + (a.spec.len - 2 * ra) * i / (a.circ - 1), ax = a.pos.x + fa[0] * oa, az = a.pos.z + fa[1] * oa;
    for (let j = 0; j < b.circ; j++) {
      const ob = b.circ === 1 ? 0 : -(b.spec.len / 2 - rb) + (b.spec.len - 2 * rb) * j / (b.circ - 1), bx = b.pos.x + fb[0] * ob, bz = b.pos.z + fb[1] * ob;
      const dx = bx - ax, dz = bz - az, d2 = dx * dx + dz * dz, rr = ra + rb; if (d2 >= rr * rr) continue;
      const d = Math.sqrt(d2) || 0.01, pen = rr - d; if (!best || pen > best.pen) best = { pen, nx: dx / d, nz: dz / d, cx: ax + dx / d * ra, cz: az + dz / d * ra };
    }
  }
  if (!best) return;
  const { pen, nx, nz, cx, cz } = best, ma = a.spec.mass * (a === G.player.car ? 1.6 : 1), mb = b.spec.mass * (b === G.player.car ? 1.6 : 1), sa = mb / (ma + mb);
  a.pos.x -= nx * pen * sa; a.pos.z -= nz * pen * sa; b.pos.x += nx * pen * (1 - sa); b.pos.z += nz * pen * (1 - sa);
  for (const c of [a, b]) if (c.ai === 'traffic' || c.ai === 'road') { c.ai = 'none'; c.touched = true; c.vel.set(Math.sin(c.yaw) * c.vf, 0, Math.cos(c.yaw) * c.vf); }
  const rax = cx - a.pos.x, raz = cz - a.pos.z, rbx = cx - b.pos.x, rbz = cz - b.pos.z;
  const vax = a.vel.x + a.av * raz, vaz = a.vel.z - a.av * rax, vbx = b.vel.x + b.av * rbz, vbz = b.vel.z - b.av * rbx;
  const rel = (vax - vbx) * nx + (vaz - vbz) * nz; if (rel <= 0) return;
  const Ia = ma * (a.spec.len ** 2 + a.spec.w ** 2) / 12, Ib = mb * (b.spec.len ** 2 + b.spec.w ** 2) / 12, ca = raz * nx - rax * nz, cb = rbz * nx - rbx * nz;
  const J = (1 + 0.25) * rel / (1 / ma + 1 / mb + ca * ca / Ia + cb * cb / Ib);
  a.vel.x -= J * nx / ma; a.vel.z -= J * nz / ma; b.vel.x += J * nx / mb; b.vel.z += J * nz / mb;
  a.av -= J * ca / Ia; b.av += J * cb / Ib;
  if (rel > 4) {
    a.damage(J / ma * 1.6 * (a === G.player.car ? 0.6 : 1), cx, cz); b.damage(J / mb * 1.6 * (b === G.player.car ? 0.6 : 1), cx, cz); G.audio.crash(a.pos, rel);
    G.fx.burst(_c.set(cx, a.pos.y + 0.8, cz), 0xffd890, Math.min(30, rel * 2) | 0, rel * 0.5, 0.35, 0.6, 14, 0.4);
    if (a === G.player.car || b === G.player.car) { G.shake = Math.min(1, rel / 16); const o = a === G.player.car ? b : a; if (o.police) G.wanted.crime(0.6); else if (rel > 7) G.wanted.crime(0.3); }
  }
  if (a.infected > 0 && b.infected <= 0 && a.gen < 5) { b.infected = 9; b.gen = a.gen + 1; G.stats.infected++; } else if (b.infected > 0 && a.infected <= 0 && b.gen < 5) { a.infected = 9; a.gen = b.gen + 1; G.stats.infected++; }
}

// ================= wanted =================
export class Wanted {
  constructor() { this.heat = 0; this.level = 0; this.state = 'none'; this.seen = false; this.unseen = 0; this.searchT = 0; this.last = V(); this.checkT = 0; this.spawnT = 0; this.heli = null; }
  crime(p) {
    const before = this.level; this.heat = Math.min(26, this.heat + p); const T = [1.2, 3.5, 7, 12, 19]; let l = 0; for (const t of T) if (this.heat >= t) l++;
    if (l > this.level) { this.level = l; if (!before) G.ui.toast('Police alerted', 'Break line of sight to lose them'); G.audio.siren(true); }
    if (this.level > 0) { this.last.copy(G.player.pos); this.unseen = Math.min(this.unseen, 2); if (this.state !== 'pursuit') { this.state = 'pursuit'; this.searchT = 0; } }
  }
  clearAll(msg = true) {
    if (this.level && msg) G.ui.toast('You lost them', 'Wanted level cleared'); this.heat = 0; this.level = 0; this.state = 'none'; this.seen = false; G.audio.siren(false);
    for (const c of G.ents.cars) if (c.ai === 'cop') c.ai = G.world.isRoadChunk(c.pos.x, c.pos.z) || City.inside(c.pos.x, c.pos.z) ? 'leave' : 'none';
    if (this.heli) this.heli.leave = true;
  }
  driveCop(c, dt) {
    const pl = G.player, tgt = this.seen ? pl.pos : this.last, d = c.pos.distanceTo(tgt);
    if (pl.mode === 'foot' && d < 16 && Math.abs(c.vf) < 7 && c.occupied) {         // officers get out
      c.occupied = false; c.ai = 'none'; c.touched = true;
      for (const s of [-1, 1]) { const n = G.ents.addNPC('cop', c.pos.x + Math.cos(c.yaw) * 1.8 * s, c.pos.z - Math.sin(c.yaw) * 1.8 * s); n.canSee = true; }
      return;
    }
    c.pursue(dt, tgt, this.state === 'search' ? 14 : 30 + this.level * 5);
  }
  update(dt) {
    const pl = G.player, E = G.ents;
    if (this.level === 0) { if (this.heat > 0) this.heat = Math.max(0, this.heat - dt * 0.05); if (this.heli) this.updateHeli(dt); return; }
    this.checkT -= dt;
    if (this.checkT <= 0) {
      this.checkT = 0.3; let seen = false; const eye = _b.copy(pl.pos).setY(pl.pos.y + 1.2);
      if (!pl.invisible) {
        for (const n of E.npcs) { if (n.kind !== 'cop' || n.dead) continue; n.canSee = n.pos.distanceTo(pl.pos) < 95 && n.frozen <= 0 && G.world.los(_a.copy(n.pos).setY(n.pos.y + 1.6), eye); seen = seen || n.canSee; }
        for (const c of E.cars) if (c.ai === 'cop' && c.emp <= 0 && c.pos.distanceTo(pl.pos) < 130 && G.world.los(_a.copy(c.pos).setY(c.pos.y + 1.4), eye)) seen = true;
        if (this.heli && !this.heli.down && this.heli.pos.distanceTo(pl.pos) < 260 && G.world.los(this.heli.pos, eye)) seen = true;
      } else for (const n of E.npcs) n.canSee = false;
      this.seen = seen;
    }
    if (this.seen) { this.state = 'pursuit'; this.unseen = 0; this.searchT = 0; this.last.copy(pl.pos); }
    else { this.unseen += dt; if (this.unseen > 5) { this.state = 'search'; this.searchT += dt; if (this.searchT > 16 + this.level * 4) { this.clearAll(); return; } } }
    // reinforcements arrive by road, out of sight where possible
    this.spawnT -= dt; const units = E.cars.filter(c => c.ai === 'cop').length + E.npcs.filter(n => n.kind === 'cop' && !n.dead).length / 2;
    if (this.spawnT <= 0 && units < this.level + (this.level > 2 ? 1 : 0)) {
      this.spawnT = 3.5; let s = City.inside(pl.pos.x, pl.pos.z) ? E.cityRoadSpot(110, 190) : E.roadSpot(110, 190);
      if (!s) { const a = Math.random() * TAU; s = { x: pl.pos.x + Math.sin(a) * 150, z: pl.pos.z + Math.cos(a) * 150, dir: 0 }; if (Geo.height(s.x, s.z) < 0.5) s = null; }
      if (s) { const reg = E.regKey, c = E.addCar(this.level > 3 ? 'sport' : reg === 'india' || reg === 'gulf' ? 'suv' : reg === 'uk' ? 'hatch' : 'sedan', 0xf4f4f0, true, s); c.ai = 'cop'; c.hp = 140; c.yaw = Math.atan2(pl.pos.x - s.x, pl.pos.z - s.z); }
    }
    if (this.level >= 4 && !this.heli) this.spawnHeli();
    if (this.heli) this.updateHeli(dt);
  }
  spawnHeli() { const h = makeHeli(); G.scene.add(h.root); this.heli = { m: h, pos: h.root.position, vel: V(), cool: 2, down: false, leave: false, hp: 120 }; this.heli.pos.copy(G.player.pos).add(_a.set(200, 120, 200)); }
  updateHeli(dt) {
    const h = this.heli, pl = G.player; h.m.rotor.rotation.y += dt * 30;
    if (h.down) { h.vel.y -= 14 * dt; h.pos.addScaledVector(h.vel, dt); h.m.root.rotation.y += dt * 5; h.m.root.rotation.z += dt; if (h.pos.y < Geo.height(h.pos.x, h.pos.z) + 1) { G.fx.explosion(h.pos.clone(), 2); G.ents.blast(h.pos, 14, 80, 14); G.scene.remove(h.m.root); this.heli = null; } return; }
    const tgt = _a.copy(this.seen ? pl.pos : this.last); tgt.y = Math.max(tgt.y + 55, Geo.height(tgt.x, tgt.z) + 70); if (h.leave) tgt.set(h.pos.x + 400, h.pos.y + 200, h.pos.z);
    _b.subVectors(tgt, h.pos); const d = _b.length(); h.vel.lerp(_b.multiplyScalar(Math.min(1, 34 / (d || 1))), 1 - Math.exp(-1.2 * dt)); h.pos.addScaledVector(h.vel, dt);
    h.m.root.rotation.y = Math.atan2(pl.pos.x - h.pos.x, pl.pos.z - h.pos.z); h.m.beam.lookAt(pl.pos); h.m.beam.rotateX(Math.PI / 2); h.m.beam.visible = G.sky.night > 0.3;
    G.audio.heli(h.pos.distanceTo(pl.pos));
    if (h.leave && h.pos.distanceTo(pl.pos) > 500) { G.scene.remove(h.m.root); this.heli = null; G.audio.heli(1e9); return; }
    h.cool -= dt; if (!h.leave && this.level >= 5 && this.seen && h.cool <= 0) { h.cool = 0.25 + (Math.random() < 0.2 ? 2 : 0); NPC.prototype.shoot.call({ pos: h.pos, kind: 'cop' }, pl, 4); }
  }
  hitHeli(dmg) { const h = this.heli; if (!h || h.down) return; h.hp -= dmg; if (h.hp <= 0) { h.down = true; G.fx.explosion(h.pos.clone(), 1); G.ui.toast('Helicopter down'); this.crime(3); } }
}
