// Guns and launchers. Pick any five for your arsenal; fire from the hip or aim over the shoulder.
// Hitscan weapons trace from the camera through the crosshair (so what you aim at is what you hit),
// then draw the tracer from the muzzle. Projectiles fly, bounce, home and explode for real.
import * as THREE from 'three';
import { G, clamp, lerp, damp, angDiff } from './util.js';
import { Geo } from './geo.js';

const V = () => new THREE.Vector3(), _a = V(), _b = V(), _c = V(), _d = V(), hitW = {};
// stats: dmg per hit, rate per second, mag, reload s, spread (hip, aimed) radians, range m
export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', kind: 'hit', auto: false, dmg: 26, rate: 5, mag: 15, reload: 1.1, spread: [0.022, 0.006], range: 160, recoil: 0.018, knock: 1.5, one: true, sound: 'pistol', blurb: 'Accurate, quick to draw.' },
  { id: 'smg', name: 'SMG', kind: 'hit', auto: true, dmg: 12, rate: 15, mag: 40, reload: 1.5, spread: [0.04, 0.02], range: 120, recoil: 0.008, knock: 0.8, one: true, sound: 'smg', blurb: 'Hoses close range. Works from a car.' },
  { id: 'rifle', name: 'Assault Rifle', kind: 'hit', auto: true, dmg: 21, rate: 10, mag: 30, reload: 1.9, spread: [0.03, 0.007], range: 220, recoil: 0.013, knock: 1.5, sound: 'rifle', blurb: 'All-rounder with real reach.' },
  { id: 'shotgun', name: 'Pump Shotgun', kind: 'hit', auto: false, dmg: 14, pellets: 9, rate: 1.3, mag: 8, reload: 2.6, spread: [0.075, 0.06], range: 55, recoil: 0.06, knock: 9, sound: 'shotgun', blurb: 'Clears a room. Sends people flying.' },
  { id: 'minigun', name: 'Minigun', kind: 'hit', auto: true, dmg: 14, rate: 28, mag: 400, reload: 4, spread: [0.045, 0.03], range: 180, recoil: 0.004, knock: 2.5, spin: 0.55, heavy: 0.62, sound: 'minigun', blurb: 'Spins up, then shreds cars.' },
  { id: 'sniper', name: 'Sniper Rifle', kind: 'hit', auto: false, dmg: 160, rate: 0.9, mag: 5, reload: 2.6, spread: [0.06, 0.0004], range: 600, recoil: 0.09, knock: 7, pierce: 3, zoom: 14, sound: 'sniper', blurb: 'Aim to scope in. Pierces three targets.' },
  { id: 'rocket', name: 'Rocket Launcher', kind: 'rocket', auto: false, dmg: 170, rate: 0.9, mag: 1, reload: 1.5, spread: [0.01, 0.002], speed: 75, blast: 9, recoil: 0.08, sound: 'rocket', blurb: 'One rocket, one very bad day.' },
  { id: 'swarm', name: 'Swarm Launcher', kind: 'swarm', auto: false, dmg: 95, rate: 0.5, mag: 4, reload: 2.8, spread: [0.2, 0.15], speed: 55, blast: 6, recoil: 0.05, sound: 'rocket', blurb: 'Four homing missiles lock onto cars, enemies and the helicopter.' },
  { id: 'grenade', name: 'Grenade Launcher', kind: 'grenade', auto: false, dmg: 130, rate: 1.8, mag: 6, reload: 2.8, spread: [0.02, 0.01], speed: 34, blast: 7.5, recoil: 0.05, sound: 'thump', blurb: 'Bouncing grenades. Bank them round corners.' },
  { id: 'rail', name: 'Railgun', kind: 'rail', auto: false, dmg: 240, rate: 0.7, mag: 4, reload: 2.4, spread: [0.004, 0.0005], range: 500, recoil: 0.12, charge: 0.45, knock: 14, sound: 'rail', blurb: 'Charges, then punches a line through everything.' },
  { id: 'flame', name: 'Flamethrower', kind: 'flame', auto: true, dmg: 42, rate: 30, mag: 250, reload: 3.2, spread: [0.12, 0.1], range: 15, recoil: 0, sound: 'flame', blurb: 'Sets people and cars alight.' },
  { id: 'arc', name: 'Arc Caster', kind: 'arc', auto: false, dmg: 55, rate: 3, mag: 12, reload: 2.2, spread: [0.03, 0.01], range: 45, recoil: 0.02, chain: 5, sound: 'arc', blurb: 'Lightning that jumps between enemies.' },
];
export const BY_ID = Object.fromEntries(WEAPONS.map(w => [w.id, w]));
export const DEFAULT_LOADOUT = ['pistol', 'rifle', 'shotgun', 'rocket', 'minigun'];

// ---------- models ----------
const gunMat = new THREE.MeshStandardMaterial({ color: 0x1c1e22, roughness: 0.35, metalness: 0.8 }), gunMat2 = new THREE.MeshStandardMaterial({ color: 0x3a3226, roughness: 0.7, metalness: 0.1 }), gunMat3 = new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.6, metalness: 0.3 });
const glowMat = new THREE.MeshStandardMaterial({ color: 0x9fe8ff, emissive: 0x6fd0ff, emissiveIntensity: 2.5 }), flameMat = new THREE.MeshStandardMaterial({ color: 0xff8a20, emissive: 0xff5a10, emissiveIntensity: 1.5 });
function part(g, m, x, y, z, rx = 0) { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; return o; }
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d), cyl = (r, l, s = 10) => new THREE.CylinderGeometry(r, r, l, s).rotateX(Math.PI / 2);
// built pointing along +z, grip at the origin; muzzle position in userData
export function gunModel(id) {
  const g = new THREE.Group(); let muzzle = 0.3;
  const add = (...a) => g.add(part(...a));
  if (id === 'pistol') { add(box(0.035, 0.05, 0.2), gunMat, 0, 0.03, 0.06); add(box(0.032, 0.1, 0.045), gunMat2, 0, -0.03, 0, -0.2); muzzle = 0.17; }
  else if (id === 'smg') { add(box(0.05, 0.07, 0.34), gunMat, 0, 0.03, 0.08); add(box(0.035, 0.16, 0.04), gunMat, 0, -0.07, 0.06); add(cyl(0.015, 0.12), gunMat, 0, 0.04, 0.29); muzzle = 0.35; }
  else if (id === 'rifle') { add(box(0.05, 0.08, 0.5), gunMat, 0, 0.03, 0.12); add(box(0.04, 0.14, 0.05), gunMat, 0, -0.07, 0.17, 0.25); add(box(0.04, 0.09, 0.22), gunMat, 0, 0.0, -0.2); add(cyl(0.014, 0.22), gunMat, 0, 0.04, 0.47); add(box(0.03, 0.04, 0.12), gunMat, 0, 0.1, 0.1); muzzle = 0.58; }
  else if (id === 'shotgun') { add(cyl(0.022, 0.62), gunMat, 0, 0.05, 0.25); add(cyl(0.02, 0.3), gunMat2, 0, 0.0, 0.25); add(box(0.04, 0.09, 0.26), gunMat2, 0, -0.01, -0.16); muzzle = 0.56; }
  else if (id === 'minigun') { const sp = new THREE.Group(); sp.position.set(0, 0.04, 0); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; sp.add(part(cyl(0.012, 0.7), gunMat, Math.cos(a) * 0.04, Math.sin(a) * 0.04, 0.35)); } g.add(sp); add(cyl(0.07, 0.25), gunMat, 0, 0.04, 0.0); add(box(0.14, 0.14, 0.2), gunMat3, 0.1, -0.05, -0.05); muzzle = 0.72; g.userData.spinner = sp; }
  else if (id === 'sniper') { add(box(0.045, 0.07, 0.6), gunMat2, 0, 0.02, 0.1); add(cyl(0.014, 0.55), gunMat, 0, 0.04, 0.6); add(cyl(0.025, 0.28), gunMat, 0, 0.11, 0.12); add(box(0.04, 0.08, 0.2), gunMat2, 0, -0.01, -0.28); muzzle = 0.88; }
  else if (id === 'rocket' || id === 'swarm') { add(cyl(id === 'swarm' ? 0.09 : 0.07, 1.05), id === 'swarm' ? gunMat : gunMat3, 0, 0.12, 0.15); add(box(0.04, 0.12, 0.05), gunMat, 0, -0.03, 0.05); add(box(0.04, 0.06, 0.12), gunMat, 0.07, 0.17, 0.2); muzzle = 0.68; }
  else if (id === 'grenade') { add(cyl(0.05, 0.36), gunMat, 0, 0.05, 0.15); add(cyl(0.065, 0.16), gunMat3, 0, 0.05, 0.0); add(box(0.04, 0.12, 0.05), gunMat, 0, -0.04, 0.0); muzzle = 0.34; }
  else if (id === 'rail') { add(box(0.07, 0.09, 0.7), gunMat, 0, 0.04, 0.2); for (let i = 0; i < 4; i++) add(box(0.09, 0.02, 0.05), glowMat, 0, 0.09, 0.0 + i * 0.13); add(box(0.04, 0.12, 0.05), gunMat, 0, -0.05, 0.0); muzzle = 0.56; g.userData.glow = true; }
  else if (id === 'flame') { add(cyl(0.035, 0.55), gunMat, 0, 0.03, 0.2); add(cyl(0.06, 0.3), flameMat, 0.09, -0.05, -0.05); add(box(0.04, 0.12, 0.05), gunMat, 0, -0.05, 0.05); muzzle = 0.48; }
  else if (id === 'arc') { add(box(0.06, 0.08, 0.3), gunMat, 0, 0.03, 0.08); for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.045, 0.008, 6, 14), glowMat, 0, 0.03, 0.17 + i * 0.05); add(box(0.035, 0.12, 0.04), gunMat, 0, -0.05, 0.0); muzzle = 0.32; }
  g.userData.muzzle = muzzle; return g;
}

// ray tests against the things you can shoot
function rayCapsule(o, d, x, y0, y1, z, r, max) {
  // closest approach between the ray and the vertical segment
  const wx = o.x - x, wz = o.z - z, a = d.x * d.x + d.z * d.z; if (a < 1e-8) return -1;
  const b = wx * d.x + wz * d.z, c = wx * wx + wz * wz - r * r, disc = b * b - a * c; if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / a; if (t < 0 || t > max) return -1;
  const y = o.y + d.y * t; return y >= y0 && y <= y1 ? t : -1;
}
function rayCar(o, d, c, max) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), px = o.x - c.pos.x, py = o.y - (c.pos.y + 0.8), pz = o.z - c.pos.z;
  const ol = [px * fz - pz * fx, py, px * fx + pz * fz], dl = [d.x * fz - d.z * fx, d.y, d.x * fx + d.z * fz], h = [c.spec.w / 2, c.spec.bus ? 2.1 : 0.8, c.spec.len / 2];
  let t0 = 0, t1 = max;
  for (let i = 0; i < 3; i++) { if (Math.abs(dl[i]) < 1e-9) { if (Math.abs(ol[i]) > h[i]) return -1; continue; } let a = (-h[i] - ol[i]) / dl[i], b = (h[i] - ol[i]) / dl[i]; if (a > b) { const t = a; a = b; b = t; } t0 = Math.max(t0, a); t1 = Math.min(t1, b); if (t0 > t1) return -1; }
  return t0;
}

export class Weapons {
  constructor() {
    let lo = null; try { lo = JSON.parse(localStorage.getItem('eh.loadout')); } catch (e) { }
    this.loadout = Array.isArray(lo) && lo.length === 5 && lo.every(x => BY_ID[x]) ? lo : DEFAULT_LOADOUT.slice();
    this.slot = 0; this.ammo = {}; for (const w of WEAPONS) this.ammo[w.id] = w.mag;
    this.cool = 0; this.reloadT = 0; this.spinV = 0; this.chargeT = 0; this.bloom = 0; this.aimK = 0; this.firedT = 9; this.projectiles = []; this.models = {}; this.held = null; this.npcGuns = new Map();
    this.decals = new THREE.InstancedMesh(new THREE.CircleGeometry(0.07, 8), new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }), 300);
    this.decals.count = 0; this.decals.frustumCulled = false; this.decalI = 0; G.scene.add(this.decals);
    this.flashMesh = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 7).rotateX(Math.PI / 2).translate(0, 0, 0.17), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flashMesh.visible = false; G.scene.add(this.flashMesh);
    this.rocketGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8).rotateX(Math.PI / 2); this.nadeGeo = new THREE.SphereGeometry(0.09, 10, 8);
  }
  get current() { return this.slot ? BY_ID[this.loadout[this.slot - 1]] : null; }
  setLoadout(lo) { this.loadout = lo.slice(); try { localStorage.setItem('eh.loadout', JSON.stringify(lo)); } catch (e) { } this.select(this.slot); }
  select(i) {
    this.slot = clamp(i, 0, 5); this.reloadT = 0; this.chargeT = 0; this.spinV = 0;
    const w = this.current; this.attachModel(w); G.ui && G.ui.weaponChanged && G.ui.weaponChanged();
    if (w) G.audio.click && G.audio.click();
  }
  cycle(d) { this.select((this.slot + d + 6) % 6); }
  attachModel(w) {
    if (this.held) { this.held.parent && this.held.parent.remove(this.held); this.held = null; }
    if (!w) return; const p = G.player; if (!p || !p.rig) return;
    const m = this.models[w.id] || (this.models[w.id] = gunModel(w.id)); m.rotation.set(Math.PI / 2, 0, 0); m.position.set(0, -0.3, 0.035); p.rig.foreR.add(m); this.held = m;
  }
  // a pistol in the hand of a police officer or armed thug
  armNPC(n) { if (!n.gun || n.gunModel) return; const m = gunModel('pistol'); m.rotation.set(Math.PI / 2, 0, 0); m.position.set(0, -0.3, 0.035); m.scale.setScalar(1 / (n.rig.root.scale.x || 1)); n.rig.foreR.add(m); n.gunModel = m; }
  muzzlePos(out) { const m = this.held; if (!m || G.player.mode !== 'foot') return out.copy(G.player.pos).setY(G.player.pos.y + 1.4); G.player.rig.root.updateMatrixWorld(true); return m.localToWorld(out.set(0, 0.04, m.userData.muzzle)); }
  // ---------- per frame ----------
  update(dt) {
    const I = G.input, p = G.player, w = this.current, firing = !!(I.down.attack && w), canFire = !p.dead && G.state === 'play';
    if (this.held && p.rig && this.held.parent !== p.rig.foreR) this.attachModel(w);
    if (this.held) this.held.visible = p.mode === 'foot';
    this.cool -= dt; this.firedT += dt; this.bloom = Math.max(0, this.bloom - dt * 3);
    this.aimK = damp(this.aimK, w && I.down.aim ? 1 : 0, 12, dt);
    if (I.hit.reload && w && this.ammo[w.id] < w.mag && this.reloadT <= 0) this.startReload(w);
    if (this.reloadT > 0) { this.reloadT -= dt; if (this.reloadT <= 0) { this.ammo[w.id] = w.mag; G.audio.click(); } }
    if (w && w.spin) { this.spinV = damp(this.spinV, firing ? 1 : 0, firing ? 1 / w.spin * 2.5 : 3, dt); if (this.held && this.held.userData.spinner) this.held.userData.spinner.rotation.z += this.spinV * dt * 45; if (firing && this.spinV < 0.85) G.audio.spin && G.audio.spin(); }
    if (w && w.charge) { if (firing && this.ammo[w.id] > 0 && this.reloadT <= 0) { this.chargeT += dt; if (this.held) for (const c of this.held.children) if (c.material === glowMat) c.scale.setScalar(1 + this.chargeT * 2); } else if (this.chargeT >= w.charge && canFire) { this.fire(w); this.chargeT = 0; } else this.chargeT = 0; }
    else if (w && canFire && (w.auto ? firing : I.hit.attack) && this.cool <= 0 && this.reloadT <= 0 && (!w.spin || this.spinV > 0.85)) {
      if (this.ammo[w.id] <= 0) { this.startReload(w); } else this.fire(w);
    }
    this.flashMesh.material.opacity = Math.max(0, this.flashMesh.material.opacity - dt * 30); this.flashMesh.visible = this.flashMesh.material.opacity > 0.01;
    this.updateProjectiles(dt);
  }
  startReload(w) { this.reloadT = w.reload; this.chargeT = 0; G.audio.reload && G.audio.reload(); }
  // the aim ray: from the camera through the crosshair, with spread
  aimRay(w, extra = 0) {
    const cam = G.camera; cam.getWorldDirection(_d);
    const s = lerp(w.spread[0], w.spread[1], this.aimK) + this.bloom * 0.03 + extra;
    if (s > 0) { const u = _a.set(-_d.z, 0, _d.x).normalize(), v = _b.crossVectors(u, _d).normalize(), r = Math.sqrt(Math.random()) * s, t = Math.random() * 6.283; _d.addScaledVector(u, Math.cos(t) * r).addScaledVector(v, Math.sin(t) * r).normalize(); }
    // touch: nudge toward the nearest enemy near the crosshair
    if (G.ui && G.ui.touch) { const t = this.assistTarget(cam.position, _d, 0.12, w.range || 150); if (t) { _c.copy(t.pos).setY(t.pos.y + 1.2).sub(cam.position).normalize(); _d.lerp(_c, 0.75).normalize(); } }
    return { o: cam.position.clone(), d: _d.clone() };
  }
  assistTarget(o, d, cone, range) { let best = null, bs = cone; for (const n of G.ents.npcs) { if (n.dead || n.kind === 'ped') continue; _c.copy(n.pos).setY(n.pos.y + 1.2).sub(o); const l = _c.length(); if (l > range) continue; const a = Math.acos(clamp(_c.dot(d) / l, -1, 1)); if (a < bs) { bs = a; best = n; } } return best; }
  // what does a ray hit first: building/terrain, a person, a car, the helicopter, a prop, the water
  trace(o, d, max, skip) {
    G.world.raycast(o, d, max, hitW); let best = { t: hitW.hit ? hitW.t : max, type: hitW.hit ? 'world' : 'none', n: { x: hitW.nx, y: hitW.ny, z: hitW.nz } };
    for (const n of G.ents.npcs) { if (n.dead || (skip && skip.has(n))) continue; const s = n.rig.root.scale.x; const t = rayCapsule(o, d, n.pos.x, n.pos.y, n.pos.y + 1.8 * s, n.pos.z, 0.42 * s, best.t); if (t >= 0 && t < best.t) best = { t, type: 'npc', ent: n }; }
    for (const c of G.ents.cars) { if (c === G.player.car || (skip && skip.has(c))) continue; if (c.pos.distanceToSquared(o) > (best.t + 8) ** 2) continue; const t = rayCar(o, d, c, best.t); if (t >= 0 && t < best.t) best = { t, type: 'car', ent: c }; }
    const h = G.wanted.heli; if (h && !h.down) { _c.subVectors(h.pos, o); const tc = _c.dot(d); if (tc > 0 && tc < best.t && _c.lengthSq() - tc * tc < 12) best = { t: tc, type: 'heli' }; }
    // water surface
    if (d.y < -1e-3 && o.y > 0) { const tw = -o.y / d.y; if (tw < best.t && Geo.height(o.x + d.x * tw, o.z + d.z * tw) < -0.3) best = { t: tw, type: 'water' }; }
    // props along the ray (lamps, bins, trees)
    if (G.props) { const L = Math.min(best.t, 80); G.props.forNear(o.x + d.x * L / 2, o.z + d.z * L / 2, L / 2 + 2, q => { const t = rayCapsule(o, d, q.x, q.y, q.y + q.h, q.z, Math.max(0.15, q.rad), best.t); if (t >= 0 && t < best.t) best = { t, type: 'prop', ent: q }; }); }
    best.p = new THREE.Vector3().copy(o).addScaledVector(d, best.t); return best;
  }
  // ---------- firing ----------
  fire(w) {
    const p = G.player, muzzle = this.muzzlePos(V());
    this.cool = 1 / w.rate; this.ammo[w.id] -= w.kind === 'swarm' ? w.mag : 1; this.firedT = 0;
    if (w.kind !== 'flame') { this.flashMesh.position.copy(muzzle); this.flashMesh.quaternion.copy(G.camera.quaternion); this.flashMesh.rotateY(Math.PI); this.flashMesh.material.opacity = 1; this.flashMesh.scale.setScalar(w.kind === 'hit' ? (w.pellets ? 1.8 : 1) : 1.5); G.fx.flash(muzzle, 0xffc070, w.pellets ? 60 : 25, 0.06); }
    G.audio.gun && G.audio.gun(w.sound, p.pos);
    p.recoil = (p.recoil || 0) + w.recoil; this.bloom = Math.min(1, this.bloom + w.recoil * 6);
    G.shake = Math.max(G.shake, w.recoil * 3);
    // gunfire is noticed
    if (w.kind !== 'flame' || Math.random() < 0.1) { G.ents.panic(p.pos, 40); if (G.ents.nearest(p.pos, 60, n => n.kind === 'cop')) G.wanted.crime(0.08); }
    if (w.kind === 'hit') {
      const n = w.pellets || 1;
      for (let i = 0; i < n; i++) {
        const r = this.aimRay(w), skip = new Set(); let pierce = w.pierce || 1, o = r.o;
        while (pierce-- > 0) {
          const h = this.trace(o, r.d, w.range, skip); this.impact(w, h, r.d, muzzle, i === 0);
          if (!h.ent || h.type === 'prop') break; skip.add(h.ent); o = h.p;
        }
      }
      // shell casings
      if (w.id !== 'shotgun') G.fx.burst(muzzle, 0xd8b050, 1, 2.5, 0.6, 0.35, 18, 0.05, _c.set(Math.cos(p.yaw) * 2, 2, -Math.sin(p.yaw) * 2));
    } else if (w.kind === 'rail') {
      const r = this.aimRay(w), skip = new Set(); let o = r.o, end = null;
      for (let k = 0; k < 12; k++) { const h = this.trace(o, r.d, w.range, skip); this.impact(w, h, r.d, muzzle, false); end = h.p; if (!h.ent || h.type === 'prop') break; skip.add(h.ent); o = h.p; }
      G.fx.line(muzzle.clone(), end, 0x9fe8ff, 0.12, 0.5); G.fx.line(muzzle.clone(), end, 0xffffff, 0.04, 0.25);
      for (let k = 0; k < 30; k++) G.fx.burst(_c.lerpVectors(muzzle, end, k / 30), 0x9fe8ff, 1, 1.5, 0.6, 1.2, 0, 0.3);
      G.fx.burst(end, 0xbff4ff, 30, 8, 0.5, 1.2); p.vel.addScaledVector(r.d, -6);
    } else if (w.kind === 'rocket' || w.kind === 'grenade') {
      const r = this.aimRay(w), tgt = this.trace(r.o, r.d, 400).p, dir = _c.subVectors(tgt, muzzle).normalize();
      if (w.kind === 'grenade') dir.y += 0.12;
      const m = new THREE.Mesh(w.kind === 'rocket' ? this.rocketGeo : this.nadeGeo, gunMat3); m.position.copy(muzzle); m.castShadow = true; G.scene.add(m);
      this.projectiles.push({ w, m, vel: dir.normalize().multiplyScalar(w.speed).add(w.kind === 'grenade' ? p.vel.clone().multiplyScalar(0.5) : V()), life: w.kind === 'rocket' ? 6 : 2.2, bounces: 0 });
      if (w.kind === 'rocket') G.fx.burst(muzzle, 0xbbbbbb, 20, 3, 1.2, 2.2, -1, 0.3, _c.copy(dir).multiplyScalar(-12));
    } else if (w.kind === 'swarm') {
      const r = this.aimRay(w, 0), targets = [];
      for (const c of G.ents.cars) if (!c.dead && c !== p.car) targets.push(c); for (const n of G.ents.npcs) if (!n.dead && n.kind !== 'ped') targets.push(n); if (G.wanted.heli && !G.wanted.heli.down) targets.push(G.wanted.heli);
      const locked = targets.map(t => { _c.subVectors(t.pos, r.o); const l = _c.length(); return [l < 260 && _c.dot(r.d) / l > 0.82 ? l : 1e9, t]; }).filter(a => a[0] < 1e9).sort((a, b) => a[0] - b[0]).map(a => a[1]);
      for (let i = 0; i < 4; i++) {
        const m = new THREE.Mesh(this.rocketGeo, gunMat); m.scale.setScalar(0.7); m.position.copy(muzzle); G.scene.add(m);
        const spread = _c.set((Math.random() - 0.5) * 0.8, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.8);
        this.projectiles.push({ w, m, vel: r.d.clone().multiplyScalar(w.speed * 0.5).add(spread.multiplyScalar(12)), life: 6, homing: locked.length ? locked[i % locked.length] : null, delay: i * 0.08 });
      }
      G.ui.toast(locked.length ? `Locked ${Math.min(4, locked.length)} target${locked.length > 1 ? 's' : ''}` : 'No lock: firing straight');
    } else if (w.kind === 'flame') {
      const r = this.aimRay(w), d = r.d;
      for (let k = 0; k < 3; k++) G.fx.burst(muzzle, Math.random() < 0.5 ? 0xff8a20 : 0xffc040, 1, 3, 0.55, 2.4, -3, 0.1, _c.copy(d).multiplyScalar(22 + Math.random() * 6).add(p.vel));
      const tip = _c.copy(muzzle);
      G.ents.inRange(muzzle, w.range, n => { _a.subVectors(n.pos, muzzle).setY(0); const l = _a.length() || 1; if (_a.dot(_b.set(d.x, 0, d.z).normalize()) / l > 0.85) { n.hit(w.dmg / w.rate, null, 0, 'player'); n.burning = Math.max(n.burning, 4); } });
      G.ents.carsIn(muzzle, w.range, c => { if (c === p.car) return; _a.subVectors(c.pos, muzzle).setY(0); const l = _a.length() || 1; if (_a.dot(_b.set(d.x, 0, d.z).normalize()) / l > 0.85) { c.damage(w.dmg / w.rate * 0.8); c.onFire = 3; } });
      G.props.blast(tip.addScaledVector(d, 6), 4, 1);
    } else if (w.kind === 'arc') {
      const r = this.aimRay(w), first = this.trace(r.o, r.d, w.range); let from = muzzle.clone(), cur = first.type === 'npc' || first.type === 'car' ? first.ent : null, hit = new Set(), pts = [];
      if (!cur) { this.bolt(from, first.p); G.fx.burst(first.p, 0xbfe8ff, 20, 6, 0.4, 0.8); }
      for (let k = 0; k < w.chain && cur; k++) {
        hit.add(cur); const to = cur.pos.clone().setY(cur.pos.y + 1.1); this.bolt(from, to); G.fx.burst(to, 0xbfe8ff, 16, 5, 0.4, 0.8);
        if (cur.hit) { cur.hit(w.dmg, _a.subVectors(to, from).normalize(), 3, 'player'); cur.stunT = 1.2; if (cur.state !== 'down') { cur.state = 'stagger'; cur.t = 0.8; } this.marker(cur); } else { cur.damage(w.dmg * 0.6, to.x, to.z); cur.emp = Math.max(cur.emp, 3); }
        from = to; let next = null, bd = 18 * 18; for (const n of G.ents.npcs) { if (n.dead || hit.has(n)) continue; const dd = n.pos.distanceToSquared(to); if (dd < bd) { bd = dd; next = n; } } cur = next;
      }
      G.fx.flash(muzzle, 0x9fd8ff, 60, 0.12);
    }
  }
  bolt(a, b) {
    const n = 7, pts = [a.clone()]; for (let i = 1; i < n; i++) pts.push(new THREE.Vector3().lerpVectors(a, b, i / n).add(_c.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(a.distanceTo(b) * 0.06))); pts.push(b.clone());
    for (let i = 0; i < pts.length - 1; i++) { G.fx.line(pts[i], pts[i + 1], 0xbfe8ff, 0.05, 0.18); G.fx.line(pts[i].clone(), pts[i + 1].clone(), 0xffffff, 0.015, 0.12); }
  }
  // what a bullet does when it lands
  impact(w, h, d, muzzle, tracer) {
    this.lastImpact = h.type + ':' + h.t.toFixed(1);
    if (tracer || Math.random() < 0.3) G.fx.line(muzzle.clone(), h.p.clone(), w.id === 'sniper' ? 0xfff4d0 : 0xffd890, w.id === 'sniper' ? 0.05 : 0.025, w.id === 'sniper' ? 0.25 : 0.06);
    const dmg = w.dmg;
    if (h.type === 'npc') {
      const n = h.ent, head = h.p.y > n.pos.y + 1.52 * n.rig.root.scale.x, k = head ? 2.4 : 1;
      n.hit(dmg * k, d, (w.knock || 1) * (n.dead ? 2 : 1), 'player'); G.fx.burst(h.p, 0x8a1010, head ? 14 : 6, 3, 0.4, 0.5, 8, 0.1);
      this.marker(n, head);
    } else if (h.type === 'car') {
      const c = h.ent; c.damage(dmg * 0.45, h.p.x, h.p.z); c.vel.addScaledVector(d, (w.knock || 1) * 0.6 * 1400 / c.spec.mass); if (c.ai === 'traffic' || c.ai === 'road') { c.ai = 'none'; c.touched = true; c.vel.set(Math.sin(c.yaw) * c.vf, 0, Math.cos(c.yaw) * c.vf); }
      G.fx.burst(h.p, 0xffe0a0, 6, 5, 0.25, 0.5, 10, 0.05); G.audio.ping && G.audio.ping(h.p); if (c.police) G.wanted.crime(0.25); G.ui.hitmarker(false, false);
    } else if (h.type === 'heli') { G.wanted.hitHeli(dmg * 0.35); G.fx.burst(h.p, 0xffe0a0, 8, 6, 0.3, 0.6, 10); G.ui.hitmarker(false, false); }
    else if (h.type === 'prop') { const q = h.ent; if (q.m < dmg * 4) G.props.knock(q, _c.copy(d).multiplyScalar(dmg * 0.12), h.p); G.fx.burst(h.p, 0xffe0a0, 5, 4, 0.2, 0.5, 10, 0.05); }
    else if (h.type === 'water') G.fx.burst(h.p, 0xdff0ff, 10, 3, 0.6, 0.9, 12, 0.2, _c.set(0, 5, 0));
    else if (h.type === 'world') {
      G.fx.burst(h.p, 0xcfc4b0, 6, 3, 0.5, 0.7, 10, 0.05); G.fx.burst(h.p, 0xffd890, 3, 4, 0.12, 0.4, 0, 0.05);
      // bullet hole
      const i = this.decalI = (this.decalI + 1) % 300; const nrm = _a.set(h.n.x, h.n.y, h.n.z); if (nrm.lengthSq() < 0.5) nrm.set(0, 1, 0);
      const m = new THREE.Matrix4().lookAt(_b.set(0, 0, 0), nrm, Math.abs(nrm.y) > 0.9 ? _c.set(1, 0, 0) : _c.set(0, 1, 0)); m.setPosition(_d.copy(h.p).addScaledVector(nrm, 0.02));
      const sc = w.pellets ? 0.6 : w.id === 'sniper' || w.id === 'rail' ? 2 : 1; m.scale(_c.set(sc, sc, sc)); this.decals.setMatrixAt(i, m); this.decals.count = Math.max(this.decals.count, i + 1); this.decals.instanceMatrix.needsUpdate = true;
    }
  }
  marker(n, head) { G.ui.hitmarker(n.dead, head); if (n.dead && !n.counted) { n.counted = true; G.ui.killfeed && G.ui.killfeed(n, head); } }
  explode(p, w) {
    G.fx.explosion(p, w.blast / 8); G.ents.blast(p, w.blast, w.dmg, 13, null);
    const h = G.wanted.heli; if (h && h.pos.distanceTo(p) < w.blast + 4) G.wanted.hitHeli(w.dmg);
    if (G.ents.nearest(p, 80, n => n.kind === 'cop')) G.wanted.crime(1);
    const d = G.player.pos.distanceTo(p); if (d < w.blast && G.player.mode === 'foot') { G.player.damage(w.dmg * 0.35 * (1 - d / w.blast)); G.player.vel.addScaledVector(_a.subVectors(G.player.pos, p).normalize(), 12); }
  }
  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const P = this.projectiles[i], m = P.m; P.life -= dt;
      if (P.delay > 0) { P.delay -= dt; m.position.copy(this.muzzlePos(_a)); continue; }
      if (P.homing && P.homing.pos) { const t = P.homing, tp = _a.copy(t.pos).setY(t.pos.y + 1); const want = tp.sub(m.position).normalize().multiplyScalar(P.w.speed); P.vel.lerp(want, 1 - Math.exp(-3.5 * dt)); if (t.dead || t.down) P.homing = null; }
      if (P.w.kind === 'grenade') P.vel.y -= 18 * dt; else if (!P.homing) P.vel.y -= 1.5 * dt;
      const step = P.vel.length() * dt, dir = _b.copy(P.vel).normalize();
      const h = this.trace(m.position, dir, step + 0.3);
      if (h.type !== 'none' || P.life <= 0) {
        if (P.w.kind === 'grenade' && h.type === 'world' && P.life > 0 && P.bounces < 4) {
          // bounce off walls and ground, losing energy
          const n = _c.set(h.n.x, h.n.y, h.n.z); if (n.lengthSq() < 0.5) n.set(0, 1, 0); P.vel.reflect(n).multiplyScalar(0.45); m.position.copy(h.p).addScaledVector(n, 0.12); P.bounces++; G.audio.ping && G.audio.ping(h.p); continue;
        }
        m.position.copy(h.p); this.explode(m.position.clone(), P.w); G.scene.remove(m); this.projectiles.splice(i, 1); continue;
      }
      m.position.addScaledVector(dir, step); m.lookAt(_c.copy(m.position).add(dir));
      if (P.w.kind !== 'grenade') { G.fx.burst(m.position, 0xffb050, 2, 1, 0.15, 1.2, 0, 0.05); G.fx.burst(m.position, 0x999999, 2, 0.8, 1.4, 1.8, -1.5, 0.2); }
    }
  }
}
