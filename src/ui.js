// Input (keyboard + mouse, touch, gamepad), the HUD, radar, and the tap-anywhere globe map.
import * as THREE from 'three';
import { G, clamp, rad, isTouch } from './util.js';
import { Geo, BLOCK, CH } from './geo.js';
import { HEROES } from './powers.js';
import { City } from './city.js';
import { Landmarks } from './landmarks.js';
import { WEAPONS, BY_ID, DEFAULT_LOADOUT } from './weapons.js';

const $ = id => document.getElementById(id);
const KEYS = { KeyW: 'up', ArrowUp: 'up', KeyS: 'dn', ArrowDown: 'dn', KeyA: 'lf', ArrowLeft: 'lf', KeyD: 'rt', ArrowRight: 'rt', Space: 'jump', ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyE: 'traverse', KeyQ: 'p1', KeyR: 'p2', KeyX: 'p3', KeyC: 'dodge', KeyF: 'interact', Enter: 'interact', KeyV: 'melee', KeyT: 'reload' };
const SLOTKEYS = { Digit0: 0, Backquote: 0, Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5 };
const HELP = [['Move', 'W A S D · left stick'], ['Look', 'Mouse · drag right side'], ['Jump / double jump', 'Space · JUMP'], ['Sprint', 'Shift · push stick fully'],
  ['Swing / traverse (hold)', 'E · HOLD'], ['Change direction mid-swing', 'Steer hard, or tap E again'], ['Swing jump', 'Space while swinging'], ['Web wings (Vesper)', 'Hold Space while falling'],
  ['Fire', 'Left mouse · FIRE'], ['Aim / scope', 'Right mouse · AIM'], ['Choose weapon', '1–5, 0 fists, scroll · GUN'], ['Reload', 'T (automatic when empty)'], ['Melee', 'V · HIT'], ['Arsenal', 'Tab · hold GUN'],
  ['Dodge', 'C · DODGE'], ['Powers', 'Q · R · X'], ['Enter / leave car', 'F · CAR'], ['Wall-run / climb', 'Run or jump into a wall and keep pushing'], ['Switch hero', 'Z · ⇄'], ['World map', 'M · 🌍'], ['Where am I (local map)', 'N · tap the minimap'], ['Pause', 'Esc · Ⅱ']];

export class UI {
  constructor() {
    const I = G.input = { mx: 0, my: 0, lookX: 0, lookY: 0, down: {}, hit: {} }; this.keys = {}; this.touch = isTouch(); this.stick = { id: -1, x: 0, y: 0 }; this.lookId = -1; this.tAcc = 0; this.toasts = [];
    document.body.classList.toggle('touch', this.touch);
    const press = (k, v) => { if (v && !I.down[k]) I.hit[k] = true; I.down[k] = v; };
    this.press = press;
    addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return; const k = KEYS[e.code];
      if (k) { if (!e.repeat) { this.keys[k] = true; press(k, true); } e.preventDefault(); }
      if (e.repeat) return;
      if (e.code === 'KeyM') G.state === 'map' ? G.closeMap() : G.state === 'play' && G.openMap();
      if (e.code === 'KeyN' || (e.code === 'Escape' && G.state === 'lmap')) G.state === 'lmap' ? G.closeLocal() : G.state === 'play' && G.openLocal();
      if (e.code === 'KeyZ' && G.state === 'play') G.cycleHero();
      if ((e.code === 'KeyP' || e.code === 'Escape') && (G.state === 'play' || G.state === 'pause')) G.setPause(G.state === 'play');
      else if (e.code === 'Escape' && G.state === 'arsenal') this.closeArsenal();
      if (e.code === 'Tab') { e.preventDefault(); if (G.state === 'play') this.openArsenal(); else if (G.state === 'arsenal') this.closeArsenal(); }
      if (SLOTKEYS[e.code] !== undefined && G.state === 'play' && G.weapons) G.weapons.select(SLOTKEYS[e.code]);
    });
    addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) { this.keys[k] = false; press(k, false); } });
    addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; for (const k in I.down) I.down[k] = false; });
    const cv = $('c');
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('pointerdown', e => {
      if (G.state !== 'play') return;
      if (e.pointerType !== 'mouse') { if (!this.touchEvents && !e.__stick && e.pointerId !== this.stick.id && this.lookId === -1) { this.lookId = e.pointerId; this.lx = e.clientX; this.ly = e.clientY; } return; }
      if (!document.pointerLockElement && cv.requestPointerLock) { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { }); }
      if (e.button === 0) press('attack', true); if (e.button === 2) press('aim', true); this.drag = true;
    });
    addEventListener('pointerup', e => { if (!this.touchEvents && e.pointerId === this.lookId) this.lookId = -1; if (e.pointerType !== 'touch') { if (e.button === 0) press('attack', false); if (e.button === 2) press('aim', false); this.drag = false; } });
    addEventListener('wheel', e => { if (G.state === 'play' && G.weapons && Math.abs(e.deltaY) > 4) { const now = performance.now(); if (now - (this.wheelT || 0) > 120) { this.wheelT = now; G.weapons.cycle(e.deltaY > 0 ? 1 : -1); } } }, { passive: true });
    addEventListener('pointercancel', e => { if (!this.touchEvents && e.pointerId === this.lookId) this.lookId = -1; });
    addEventListener('pointermove', e => {
      if (G.state !== 'play') return;
      if (e.pointerType !== 'mouse') { if (!this.touchEvents && e.pointerId === this.lookId) { I.lookX += (e.clientX - this.lx) * 0.0052; I.lookY += (e.clientY - this.ly) * 0.0042; this.lx = e.clientX; this.ly = e.clientY; } return; }
      if (document.pointerLockElement === cv || this.drag) { I.lookX += e.movementX * 0.0024; I.lookY += e.movementY * 0.0021; }
    });
    // virtual stick appears wherever the left thumb lands
    // movement stick: any touch that starts on the left half of the screen (and not on a button) drives it,
    // so it works wherever your thumb lands; it rests visibly at bottom-left
    const st = $('stick'), nub = st.firstElementChild;
    const stickStart = (id, x, y, target) => {
      if (G.state !== 'play' || this.stick.id !== -1 || x > innerWidth * 0.5 || y < 70 || (target && target.closest && target.closest('button'))) return false;
      this.stick.id = id; this.sx = x; this.sy = y; st.classList.add('on'); st.style.left = x + 'px'; st.style.top = y + 'px'; return true;
    };
    const stickMove = (id, x, y) => { if (id !== this.stick.id) return; let dx = (x - this.sx) / 52, dy = (y - this.sy) / 52; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } this.stick.x = dx; this.stick.y = dy; nub.style.transform = `translate(${dx * 38}px,${dy * 38}px)`; };
    const stickEnd = id => { if (id !== this.stick.id) return; this.stick.id = -1; this.stick.x = this.stick.y = 0; st.classList.remove('on'); st.style.left = ''; st.style.top = ''; nub.style.transform = ''; };
    // Phones (iPhone Safari especially) get classic touch events for the stick and camera: they are the most
    // reliable input there. Buttons keep pointer events. Desktop mice never go through this path.
    this.touchEvents = 'ontouchstart' in window;
    if (this.touchEvents) {
      const blocked = el => el && el.closest && el.closest('button, input, #arsenal, #pause, #title, #mapScreen, #lmap, #mini');
      addEventListener('touchstart', e => {
        if (G.state !== 'play') return; let used = false;
        for (const t of e.changedTouches) {
          const el = document.elementFromPoint(t.clientX, t.clientY) || t.target; if (blocked(el)) continue;
          const id = 't' + t.identifier;
          if (stickStart(id, t.clientX, t.clientY, el)) { used = true; continue; }
          if (this.lookId === -1) { this.lookId = id; this.lx = t.clientX; this.ly = t.clientY; used = true; }
        }
        if (used && e.cancelable) e.preventDefault();   // stop Safari treating the drag as scroll or zoom
      }, { passive: false, capture: true });
      addEventListener('touchmove', e => {
        let used = false;
        for (const t of e.changedTouches) {
          const id = 't' + t.identifier;
          if (id === this.stick.id) { stickMove(id, t.clientX, t.clientY); used = true; }
          else if (id === this.lookId) { G.input.lookX += (t.clientX - this.lx) * 0.0052; G.input.lookY += (t.clientY - this.ly) * 0.0042; this.lx = t.clientX; this.ly = t.clientY; used = true; }
        }
        if (used && e.cancelable) e.preventDefault();
      }, { passive: false, capture: true });
      const tEnd = e => { for (const t of e.changedTouches) { const id = 't' + t.identifier; stickEnd(id); if (id === this.lookId) this.lookId = -1; } };
      addEventListener('touchend', tEnd, { capture: true }); addEventListener('touchcancel', tEnd, { capture: true });
    } else if (window.PointerEvent) {
      addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse' && stickStart(e.pointerId, e.clientX, e.clientY, e.target)) { e.__stick = true; e.preventDefault(); } }, true);
      addEventListener('pointermove', e => stickMove(e.pointerId, e.clientX, e.clientY), true);
      addEventListener('pointerup', e => stickEnd(e.pointerId), true); addEventListener('pointercancel', e => stickEnd(e.pointerId), true);
    }
    const hold = (el, k) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); el.classList.add('dn'); press(k, true); el.setPointerCapture(e.pointerId); }); const up = () => { el.classList.remove('dn'); press(k, false); }; el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); };
    hold($('t-jump'), 'jump'); hold($('t-trav'), 'traverse'); hold($('t-atk'), 'melee'); hold($('t-dodge'), 'dodge'); hold($('t-use'), 'interact'); hold($('t-fire'), 'attack');
    $('t-aim').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); this.touchAim = !this.touchAim; $('t-aim').classList.toggle('on', this.touchAim); press('aim', this.touchAim); });
    // GUN: tap to cycle weapons, hold to open the arsenal
    { const b = $('t-wpn'); let t = 0, tm = null; b.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); t = performance.now(); tm = setTimeout(() => { tm = null; this.openArsenal(); }, 550); });
      b.addEventListener('pointerup', () => { if (tm) { clearTimeout(tm); tm = null; G.weapons && G.weapons.cycle(1); } }); b.addEventListener('pointercancel', () => { if (tm) clearTimeout(tm); tm = null; }); }
    this.slotBtns = [0, 1, 2, 3, 4, 5].map(i => { const b = document.createElement('button'); b.className = 'glass'; $('slots').appendChild(b); b.onclick = () => G.weapons && G.weapons.select(i); return b; });
    $('ars-done').onclick = () => this.closeArsenal(); $('ars-reset').onclick = () => { G.weapons.setLoadout(DEFAULT_LOADOUT); this.renderArsenal(); };
    $('p-ars').onclick = () => { G.setPause(false); this.openArsenal(); };
    // HUD skeleton
    $('stars').innerHTML = '<i>★</i>'.repeat(5);
    this.pw = [0, 1, 2].map(i => { const b = document.createElement('button'); b.className = 'pw glass'; b.innerHTML = `<kbd>${'QRX'[i]}</kbd><b></b><small></small><u></u>`; $('powers').appendChild(b); hold(b, 'p' + (i + 1)); return b; });
    $('keys').innerHTML = HELP.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`).join('');
    $('b-map').onclick = () => G.openMap(); $('b-pause').onclick = () => G.setPause(true); $('b-hero').onclick = () => G.cycleHero();
    $('p-resume').onclick = () => G.setPause(false); $('p-map').onclick = () => { G.setPause(false); G.openMap(); };
    $('p-mute').onclick = e => { G.muted = !G.muted; G.audio.mute(G.muted); e.target.textContent = 'Sound: ' + (G.muted ? 'Off' : 'On'); };
    $('p-q').textContent = 'Graphics: ' + G.qName; $('p-q').onclick = () => { const o = ['Auto', 'Low', 'Medium', 'High'], n = o[(o.indexOf(G.qName) + 1) % 4]; try { localStorage.setItem('eh.q', n); } catch (e) { } location.reload(); };
    $('heroes').innerHTML = HEROES.map((h, i) => `<button class="hero glass" data-i="${i}" style="--c:${h.color}"><b>${h.name}</b><i>${h.title}</i><span>${h.blurb}</span></button>`).join('');
    $('heroes').onclick = e => { const b = e.target.closest('.hero'); if (b) G.setHero(+b.dataset.i); };
    this.mini = $('mini').getContext('2d'); this.map = new GlobeMap();
    $('mini').style.cursor = 'pointer'; $('mini').addEventListener('pointerup', e => { e.stopPropagation(); if (G.state === 'play') G.openLocal(); });
  }
  setHero(h, i) {
    document.documentElement.style.setProperty('--hero', h.color);
    $('heroName').innerHTML = `${h.name}<span>${h.traverse}</span>`; $('t-trav').textContent = h.traverse.split(' ').pop().toUpperCase();
    h.powers.forEach((p, k) => { this.pw[k].children[1].textContent = p.icon; this.pw[k].children[2].textContent = p.name; });
    document.querySelectorAll('.hero').forEach((b, k) => b.classList.toggle('sel', k === i));
  }
  toast(title, sub) {
    const d = document.createElement('div'); d.className = 'toast glass'; d.innerHTML = `<b>${title}</b>` + (sub ? `<span>${sub}</span>` : ''); const box = $('toasts'); box.appendChild(d);
    while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 3600);
  }
  weaponChanged() {
    const W = G.weapons; if (!W) return; const w = W.current; $('wname').textContent = w ? w.name : 'Fists';
    this.slotBtns.forEach((b, i) => { const id = i ? W.loadout[i - 1] : null; b.innerHTML = `${i}<br>${id ? BY_ID[id].name.split(' ')[0].slice(0, 6) : 'Fists'}`; b.classList.toggle('on', i === W.slot); });
    $('t-fire').style.display = w ? 'grid' : 'none'; $('t-aim').style.display = w ? 'grid' : 'none'; $('t-wpn').textContent = w ? w.name.split(' ')[0].slice(0, 5).toUpperCase() : 'GUN';
  }
  hitmarker(kill, head) { const h = $('hitm'); h.classList.toggle('kill', !!kill); h.style.opacity = 1; clearTimeout(this.hmT); this.hmT = setTimeout(() => h.style.opacity = 0, kill ? 260 : 120); G.audio.hitmark && G.audio.hitmark(kill); }
  killfeed(n, head) { const d = document.createElement('div'); d.className = 'glass'; d.innerHTML = `${n.kind === 'cop' ? 'Officer down' : n.kind === 'thug' ? (n.heavy ? '<b>Syndicate heavy</b> down' : '<b>Syndicate</b> down') : 'Civilian down'}${head ? ' · headshot' : ''}`; const f = $('feed'); f.prepend(d); while (f.children.length > 4) f.lastChild.remove(); setTimeout(() => d.remove(), 3500); }
  openArsenal() { if (G.state !== 'play' && G.state !== 'pause') return; this.arsSel = this.arsSel || 1; this.renderArsenal(); G.setState('arsenal'); }
  closeArsenal() { G.setState('play'); }
  renderArsenal() {
    const W = G.weapons, lo = W.loadout, max = k => Math.max(...WEAPONS.map(w => k(w)));
    const dps = w => w.dmg * (w.pellets || 1) * w.rate * (w.kind === 'swarm' ? 4 : 1), rng = w => w.range || (w.kind === 'grenade' ? 120 : 300);
    $('arsSlots').innerHTML = lo.map((id, i) => `<button class="glass ${this.arsSel === i + 1 ? 'sel' : ''}" data-s="${i + 1}"><small>Slot ${i + 1}</small>${BY_ID[id].name}</button>`).join('');
    $('arsSlots').onclick = e => { const b = e.target.closest('button'); if (b) { this.arsSel = +b.dataset.s; this.renderArsenal(); } };
    const bar = (v, m) => `<u><s style="width:${Math.round(Math.min(1, v / m) * 100)}%"></s></u>`;
    $('arsGrid').innerHTML = WEAPONS.map(w => `<button class="wcard glass ${lo.includes(w.id) ? 'in' : ''}" data-w="${w.id}"><b>${w.name}</b><i>${w.blurb}</i><div class="st"><span>Damage</span>${bar(w.dmg * (w.pellets || 1), 240)}<span>Fire rate</span>${bar(w.rate, 28)}<span>Firepower</span>${bar(dps(w), 600)}<span>Range</span>${bar(rng(w), 500)}</div></button>`).join('');
    $('arsGrid').onclick = e => { const b = e.target.closest('.wcard'); if (!b) return; const lo2 = W.loadout.slice(), id = b.dataset.w, at = lo2.indexOf(id); if (at >= 0) lo2[at] = lo2[this.arsSel - 1]; lo2[this.arsSel - 1] = id; W.setLoadout(lo2); this.arsSel = this.arsSel % 5 + 1; this.renderArsenal(); };
  }
  hurt() { const h = $('hurt'); h.style.opacity = 1; clearTimeout(this.hT); this.hT = setTimeout(() => h.style.opacity = 0, 180); }
  poll() {
    const I = G.input, k = this.keys; let mx = (k.rt ? 1 : 0) - (k.lf ? 1 : 0), my = (k.up ? 1 : 0) - (k.dn ? 1 : 0);
    if (this.stick.id !== -1) { mx = this.stick.x; my = -this.stick.y; I.down.sprint = Math.hypot(mx, my) > 0.88; }
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
    if (gp) {
      const dz = v => Math.abs(v) < 0.16 ? 0 : v; if (dz(gp.axes[0]) || dz(gp.axes[1])) { mx = dz(gp.axes[0]); my = -dz(gp.axes[1]); }
      I.lookX += dz(gp.axes[2]) * 0.05; I.lookY += dz(gp.axes[3]) * 0.035;
      const map = { 0: 'jump', 1: 'dodge', 2: 'melee', 3: 'interact', 7: 'attack', 6: 'aim', 5: 'traverse', 4: 'p1', 12: 'p2', 13: 'p3', 10: 'sprint', 11: 'reload' };
      if (gp.buttons[14] && gp.buttons[14].pressed && !this.gpL) G.weapons && G.weapons.cycle(-1); this.gpL = gp.buttons[14] && gp.buttons[14].pressed;
      if (gp.buttons[15] && gp.buttons[15].pressed && !this.gpR) G.weapons && G.weapons.cycle(1); this.gpR = gp.buttons[15] && gp.buttons[15].pressed;
      this.gpd = this.gpd || {}; for (const b in map) { const v = gp.buttons[b] && gp.buttons[b].pressed; if (v !== !!this.gpd[b]) { this.gpd[b] = v; this.press(map[b], v); } }
    }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; } I.mx = mx; I.my = my;
  }
  frame(dt) {
    const p = G.player, w = G.wanted; this.tAcc += dt;
    const W = G.weapons, cw = W && W.current;
    if (W) {
      const scoped = cw && cw.zoom && W.aimK > 0.8 && p.mode === 'foot';
      $('scope').style.display = scoped ? 'block' : 'none'; $('cross').style.display = cw ? 'none' : ''; const xh = $('xhair'); xh.style.display = cw && !scoped ? 'block' : 'none';
      if (cw) { const g = 4 + (cw.spread[0] * (1 - W.aimK) + cw.spread[1] * W.aimK + W.bloom * 0.03) * 380; const [a, b2, c2, d2] = xh.children; a.style.top = (-g - 9) + 'px'; b2.style.top = g + 'px'; c2.style.left = (-g - 9) + 'px'; d2.style.left = g + 'px'; }
      $('wpn').style.display = cw ? 'block' : 'none';
      if (cw) { $('wammo').innerHTML = W.reloadT > 0 ? 'Reloading' : `${W.ammo[cw.id]}<small> / ${cw.mag}</small>`; $('wrl').style.width = (W.reloadT > 0 ? (1 - W.reloadT / cw.reload) * 100 : cw.charge ? Math.min(1, W.chargeT / cw.charge) * 100 : 0) + '%'; }
    }
    $('hp').firstChild.style.width = clamp(p.hp, 0, 100) + '%'; $('en').firstChild.style.width = p.energy + '%';
    p.hero.powers.forEach((d, i) => { const c = G.powers.cd[i]; this.pw[i].lastChild.style.height = (c > 0 ? c / d.cd * 100 : p.energy < d.cost ? 100 : 0) + '%'; });
    if (this.tAcc < 0.2) return; this.tAcc = 0;
    const st = $('stars'); for (let i = 0; i < 5; i++) st.children[i].className = i < w.level ? 'on' : ''; st.className = w.state === 'search' ? 'search' : ''; st.style.display = w.level ? 'flex' : 'none';
    const car = p.mode === 'car'; $('speedo').style.display = car ? 'block' : 'none'; if (car) $('speedo').firstChild.textContent = Math.round(Math.abs(p.car.vf) * 3.6);
    const near = !car && p.nearestCar(), pr = $('prompt'); $('t-use').style.display = (near || car) ? 'grid' : 'none'; $('t-use').textContent = car ? 'EXIT' : 'CAR';
    pr.style.display = (near || car) && !this.touch ? 'block' : 'none'; pr.textContent = car ? 'F · Leave car    E · Leap out' : 'F · Drive';
    const lat = Geo.toLat(p.pos.z), lon = Geo.toLon(p.pos.x), nc = Geo.nearestCity(lat, lon), c = nc.city, sea = Geo.land(lat, lon) < 0.5;
    const inCity = c && nc.km < Geo.cityRadiusKm(c[3]);
    const real = City.inside(p.pos.x, p.pos.z), street = real ? City.roadName(p.pos.x, p.pos.z) : '', lm = Landmarks.nearest(p.pos.x, p.pos.z, 160);
    $('place').textContent = real ? `${lm || street || (City.maskAt(p.pos.x, p.pos.z) === 0 ? 'River' : City.active.name)} · ${City.active.name}` : !c ? (sea ? 'Open ocean' : 'Wilderness') : inCity ? `${lm ? lm + ' · ' : ''}${c[0]}, ${c[4]}` : `${sea ? 'At sea · ' : ''}${nc.km < 10 ? nc.km.toFixed(1) : Math.round(nc.km)} km from ${c[0]}`;
    const wx = G.sky.override ? { label: 'Whiteout', temp: -12 } : G.sky.w;
    $('meta').textContent = `${G.sky.localTime(lon)} local · ${wx.label} ${wx.temp}°C${G.sky.w.live ? '' : ' (est.)'} · ${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`;
    this.radar();
  }
  radar() { const p = G.player; this.paint(this.mini, 264, 264, p.pos.x, p.pos.z, 264 / 340, true); }
  // draws the area around (cx, cz) at k pixels per metre: water, parks, streets, buildings, people, the player.
  // round = the HUD minimap (clipped circle, north up, heading cone); else the full-screen local map with labels
  paint(x, W, H, cx, cz, k, round) {
    const p = G.player, px = p.pos.x, pz = p.pos.z, Rx = W / 2 / k, Rz = H / 2 / k, R = Math.max(Rx, Rz), T = (wx, wz) => [W / 2 + (wx - cx) * k, H / 2 + (wz - cz) * k];
    x.clearRect(0, 0, W, H); x.save(); if (round) { x.beginPath(); x.arc(W / 2, H / 2, W / 2, 0, 7); x.clip(); }
    const real = City.active && City.inside(cx, cz), ch = G.world.chunkAt(cx, cz), urban = ch && ch.urban;
    x.fillStyle = Geo.height(cx, cz) < 0 ? '#0d2a44' : real || urban ? '#3b3f47' : '#22301f'; x.fillRect(0, 0, W, H);
    if (!real && !round) { // open land: shade by height so hills and coast read
      const st = Math.max(6, 10 / k); for (let gz = -Rz; gz < Rz; gz += st) for (let gx = -Rx; gx < Rx; gx += st) { const h = Geo.height(cx + gx, cz + gz); x.fillStyle = h < 0 ? '#0f3352' : `hsl(${100 - Math.min(60, h / 30)},${Math.max(10, 28 - h / 80)}%,${Math.min(40, 16 + h / 60)}%)`; x.fillRect(W / 2 + gx * k, H / 2 + gz * k, st * k + 0.8, st * k + 0.8); } }
    if (real) {
      const C = City.active, st = Math.max(3, 2.2 / k); for (let gz = -Rz; gz < Rz; gz += st) for (let gx = -Rx; gx < Rx; gx += st) { const m = City.maskAt(cx + gx, cz + gz); if (m === 1 || m === 6) continue; x.fillStyle = m === 0 ? '#163a5a' : m === 3 ? '#8a7a50' : '#2f5a2a'; x.fillRect(W / 2 + gx * k, H / 2 + gz * k, st * k + 0.6, st * k + 0.6); }
      const Rr = C.r; x.strokeStyle = round ? '#6a6f78' : '#9aa0aa'; x.lineCap = 'round'; x.lineJoin = 'round';
      for (let gx = Math.floor((cx - Rx) / 192); gx <= Math.floor((cx + Rx) / 192); gx++) for (let gz = Math.floor((cz - Rz) / 192); gz <= Math.floor((cz + Rz) / 192); gz++) for (const e of C.eHome.get(gx + ',' + gz) || []) { const w = [0, 15, 13, 11.5, 10, 8.5, 7, 6, 4.5, 0, 6, 2.6, 2.6][Rr.cls[e]]; if (!w) continue; x.lineWidth = Math.max(1, w * k); x.beginPath(); for (let j = Rr.ps[e]; j < Rr.ps[e + 1]; j++) { const [a, b] = T(Rr.v[j * 2], Rr.v[j * 2 + 1]); j === Rr.ps[e] ? x.moveTo(a, b) : x.lineTo(a, b); } x.stroke(); }
    } else if (urban || (!round && Geo.urban(cx, cz) > 0.2)) { x.fillStyle = '#23262c'; for (let gx = Math.floor((cx - Rx) / BLOCK); gx <= Math.ceil((cx + Rx) / BLOCK); gx++) for (let gz = Math.floor((cz - Rz) / BLOCK); gz <= Math.ceil((cz + Rz) / BLOCK); gz++) { if (!round && Geo.urban(gx * BLOCK, gz * BLOCK) < 0.2) continue; const [a, b] = T(gx * BLOCK + 7, gz * BLOCK + 7); x.fillRect(a, b, (BLOCK - 14) * k, (BLOCK - 14) * k); } }
    // buildings: a soft drop shadow, then the footprint shaded by height (taller = lighter), with a crisp outline on the big map
    const bldg = (dx, dz, shade) => G.world.forBoxes(cx - Rx, cz - Rz, cx + Rx, cz + Rz, b => { if (b.bridge) return; const h = b.maxy - b.miny; x.fillStyle = shade ? 'rgba(0,0,0,0.35)' : `hsl(220,${round ? 10 : 12}%,${Math.min(78, 50 + h * 0.35)}%)`;
      if (b.rings) { x.beginPath(); for (const r of b.rings) for (let i = 0; i < r.length; i += 2) { const [a, c] = T(r[i], r[i + 1]); i ? x.lineTo(a + dx, c + dz) : x.moveTo(a + dx, c + dz); } x.fill('evenodd'); if (!round && !shade && k > 0.5) { x.strokeStyle = 'rgba(255,255,255,0.25)'; x.lineWidth = 1; x.stroke(); } return; }
      const [a, c] = T(b.minx, b.minz); x.fillRect(a + dx, c + dz, (b.maxx - b.minx) * k, (b.maxz - b.minz) * k); });
    if (!round) bldg(Math.max(1.5, 3 * k), Math.max(1.5, 3 * k), true); bldg(0, 0, false);
    const dot = (wx, wz, col, r) => { const [a, b] = T(wx, wz); x.fillStyle = col; x.beginPath(); x.arc(a, b, r, 0, 7); x.fill(); };
    for (const c of G.ents.cars) if (!c.dead && c !== p.car) dot(c.pos.x, c.pos.z, c.ai === 'cop' ? '#4f8dff' : '#e9edf3', c.ai === 'cop' ? 5 : 3);
    for (const n of G.ents.npcs) if (!n.dead && n.kind !== 'ped') dot(n.pos.x, n.pos.z, n.kind === 'cop' ? '#4f8dff' : '#ff4455', 4);
    for (const c of G.world.chunks.values()) for (const o of c.orbs) if (Math.abs(o[0] - cx) < Rx && Math.abs(o[2] - cz) < Rz) dot(o[0], o[2], '#66f6ff', 3);
    for (const g of G.ents.gangs) { const dx = g.x - px, dz = g.z - pz, d = Math.hypot(dx, dz), m = round ? Math.min(d, R - 8) : d; const [a, b] = T(px + dx / (d || 1) * m, pz + dz / (d || 1) * m); x.strokeStyle = '#ff4455'; x.lineWidth = 3; x.beginPath(); x.arc(a, b, 9 + Math.sin(G.time * 5) * 2, 0, 7); x.stroke(); }
    if (G.bases) for (const b of G.bases.markers(cx, cz, R * 1.4)) { const [a, c] = T(b.x, b.z); const inR = round ? Math.hypot(a - W / 2, c - H / 2) < W / 2 - 6 : true; const [ax, az] = inR ? [a, c] : [W / 2 + (a - W / 2) / Math.hypot(a - W / 2, c - H / 2) * (W / 2 - 10), H / 2 + (c - H / 2) / Math.hypot(a - W / 2, c - H / 2) * (W / 2 - 10)];
      x.fillStyle = b.cleared ? '#7a8a6a' : '#e8c040'; x.strokeStyle = '#000'; x.lineWidth = 2; x.beginPath(); x.rect(ax - 6, az - 6, 12, 12); x.fill(); x.stroke(); x.fillStyle = '#000'; x.font = '900 10px system-ui'; x.textAlign = 'center'; x.fillText('★', ax, az + 4);
      if (!round) { x.font = '600 13px system-ui'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(b.cleared ? 'Military base (cleared)' : 'Military base', ax, az - 12); x.fillStyle = '#ffe9a0'; x.fillText(b.cleared ? 'Military base (cleared)' : 'Military base', ax, az - 12); } }
    if (!round) { // landmark labels
      x.font = '600 13px system-ui'; x.textAlign = 'center';
      for (const L of Landmarks.within(cx, cz, R * 1.2)) { const [a, b] = T(L.x, L.z); if (a < -60 || b < -20 || a > W + 60 || b > H + 20) continue; x.fillStyle = '#ffd24a'; x.beginPath(); x.moveTo(a, b - 9); x.lineTo(a + 6, b); x.lineTo(a, b + 9); x.lineTo(a - 6, b); x.fill(); x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.65)'; x.strokeText(L.name, a, b - 14); x.fillStyle = '#fff'; x.fillText(L.name, a, b - 14); }
    }
    const [ax, az] = T(px, pz); x.translate(ax, az);
    x.rotate(-p.camYaw); x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.moveTo(0, 0); x.arc(0, 0, round ? W / 2 : 70, -Math.PI / 2 - 0.5, -Math.PI / 2 + 0.5); x.fill(); x.rotate(p.camYaw);
    if (!round) { const pulse = 14 + (G.realTime || 0) % 1.2 * 18; x.strokeStyle = p.hero.color; x.globalAlpha = 1 - ((G.realTime || 0) % 1.2) / 1.2; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, pulse, 0, 7); x.stroke(); x.globalAlpha = 1; }
    x.rotate(Math.PI - (p.mode === 'car' ? p.car.yaw : p.yaw)); const s = round ? 1 : 1.3; x.fillStyle = p.hero.color; x.strokeStyle = '#fff'; x.lineWidth = round ? 0 : 2; x.beginPath(); x.moveTo(0, -11 * s); x.lineTo(8 * s, 9 * s); x.lineTo(0, 4 * s); x.lineTo(-8 * s, 9 * s); x.closePath(); x.fill(); if (!round) x.stroke(); x.restore();
    if (!round) { x.font = '700 14px system-ui'; x.textAlign = 'left'; x.lineWidth = 4; x.strokeStyle = 'rgba(0,0,0,.7)'; x.strokeText('You are here', ax + 16, az + 5); x.fillStyle = '#fff'; x.fillText('You are here', ax + 16, az + 5);
      // scale bar
      const m = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000].find(v => v * k > 70) || 5000; x.fillStyle = '#fff'; x.fillRect(16, H - 28, m * k, 4); x.font = '600 12px system-ui'; x.fillText(m >= 1000 ? m / 1000 + ' km' : m + ' m', 16, H - 34); }
    x.fillStyle = '#fff'; x.font = '700 18px system-ui'; x.textAlign = 'center'; x.fillText('N', W / 2, round ? 20 : 26);
  }
  // ---------- full-screen local map ----------
  openLocal() {
    const el = $('lmap'), cv = $('lmapC'); this.lm = this.lm || { k: 0.9, ox: 0, oz: 0, ptr: new Map() }; const L = this.lm; L.ox = L.oz = 0;
    if (!L.wired) {
      L.wired = true; const fit = () => { const d = Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * d; cv.height = innerHeight * d; L.d = d; }; fit(); addEventListener('resize', fit);
      const zoom = f => { L.k = clamp(L.k * f, 0.05, 6); };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); L.ptr.set(e.pointerId, [e.clientX, e.clientY]); });
      cv.addEventListener('pointermove', e => { const q = L.ptr.get(e.pointerId); if (!q) return; if (L.ptr.size === 2) { const o = [...L.ptr.entries()].find(a => a[0] !== e.pointerId)[1], d0 = Math.hypot(q[0] - o[0], q[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); zoom(d1 / Math.max(1, d0)); } else { L.ox -= (e.clientX - q[0]) / L.k; L.oz -= (e.clientY - q[1]) / L.k; } L.ptr.set(e.pointerId, [e.clientX, e.clientY]); });
      const up = e => L.ptr.delete(e.pointerId); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('wheel', e => { zoom(Math.exp(-e.deltaY * 0.0015)); e.preventDefault(); }, { passive: false });
      $('lm-in').onclick = () => zoom(1.6); $('lm-out').onclick = () => zoom(1 / 1.6); $('lm-me').onclick = () => { L.ox = L.oz = 0; };
      $('lm-close').onclick = () => G.closeLocal(); $('lm-world').onclick = () => { G.closeLocal(); G.openMap(); };
    }
    const p = G.player, lat = Geo.toLat(p.pos.z), lon = Geo.toLon(p.pos.x);
    $('lm-name').textContent = $('place').textContent; $('lm-sub').textContent = `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'} · ${G.sky.localTime(lon)} local`;
  }
  drawLocal() { const L = this.lm, cv = $('lmapC'), x = cv.getContext('2d'), p = G.player; x.setTransform(L.d, 0, 0, L.d, 0, 0); this.paint(x, cv.width / L.d, cv.height / L.d, p.pos.x + L.ox, p.pos.z + L.oz, L.k, false); }
}

// ---------- globe ----------
const ll2v = (lat, lon, r = 1) => { const ph = rad(lon + 180), th = rad(90 - lat); return new THREE.Vector3(-Math.cos(ph) * Math.sin(th) * r, Math.cos(th) * r, Math.sin(ph) * Math.sin(th) * r); };
class GlobeMap {
  constructor() {
    this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(40, 1, 0.01, 50); this.lat = 30; this.lon = 0; this.dist = 3.1; this.sel = null; this.ptr = new Map(); this.moved = 0;
    const day = new THREE.Texture(Geo.dayImage), night = new THREE.Texture(Geo.nightImage); for (const t of [day, night]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; }
    this.mat = new THREE.ShaderMaterial({ uniforms: { uDay: { value: day }, uNight: { value: night }, uSun: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv=uv; vN=normalize(position); vec4 w=modelMatrix*vec4(position,1.); vV=normalize(cameraPosition-w.xyz); gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D uDay,uNight; uniform vec3 uSun; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
        void main(){ float d=dot(vN,uSun); float k=smoothstep(-0.12,0.22,d); vec3 day=texture2D(uDay,vUv).rgb*(0.35+0.95*max(d,0.)); vec3 nt=texture2D(uNight,vUv).rgb*1.6+texture2D(uDay,vUv).rgb*0.05;
          vec3 c=mix(nt,day,k); float rim=pow(1.-max(dot(vN,vV),0.),3.); c+=vec3(.3,.55,1.)*rim*(0.25+0.75*k); gl_FragColor=vec4(c,1.);
#include <colorspace_fragment>
        }` });
    this.globe = new THREE.Mesh(new THREE.SphereGeometry(1, 128, 80), this.mat); this.scene.add(this.globe);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 64, 40), new THREE.ShaderMaterial({ side: THREE.BackSide, transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`, fragmentShader: `varying vec3 vN; void main(){ float a=pow(0.72-dot(vN,vec3(0,0,1.)),3.); gl_FragColor=vec4(.35,.6,1.,clamp(a,0.,1.)*1.4); }` })); this.scene.add(halo);
    const pin = c => { const g = new THREE.Group(), m = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), new THREE.MeshBasicMaterial({ color: c })), r = new THREE.Mesh(new THREE.RingGeometry(0.014, 0.019, 32), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); g.add(m, r); g.visible = false; this.scene.add(g); return g; };
    this.pinSel = pin(0xffd24a); this.pinMe = pin(0x37f5d6); this.ray = new THREE.Raycaster();
    this.labels = Array.from({ length: 46 }, () => { const s = document.createElement('span'); $('labels').appendChild(s); return s; });
    const el = $('mapScreen');
    el.addEventListener('pointerdown', e => { if (e.target.closest('button,input,#mapInfo,#results')) return; this.ptr.set(e.pointerId, [e.clientX, e.clientY]); this.moved = 0; $('search').blur(); });
    el.addEventListener('pointermove', e => {
      const p = this.ptr.get(e.pointerId); if (!p) return; const dx = e.clientX - p[0], dy = e.clientY - p[1];
      if (this.ptr.size === 2) { const o = [...this.ptr.entries()].find(q => q[0] !== e.pointerId)[1], d0 = Math.hypot(p[0] - o[0], p[1] - o[1]), d1 = Math.hypot(e.clientX - o[0], e.clientY - o[1]); this.zoom(d0 / Math.max(1, d1)); this.moved = 99; }
      else { const k = (this.dist - 1) * 0.13; this.lon -= dx * k; this.lat = clamp(this.lat + dy * k, -85, 85); this.moved += Math.abs(dx) + Math.abs(dy); }
      p[0] = e.clientX; p[1] = e.clientY;
    });
    const up = e => { if (!this.ptr.delete(e.pointerId)) return; if (this.moved < 9 && e.type === 'pointerup') this.pick(e.clientX, e.clientY); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { this.zoom(Math.exp(e.deltaY * 0.0012)); e.preventDefault(); }, { passive: false });
    $('m-close').onclick = () => G.closeMap(); $('m-go').onclick = () => this.sel && G.travel(this.sel.lat, this.sel.lon);
    $('m-city').onclick = () => this.sel && this.sel.city && G.travel(this.sel.city[1], this.sel.city[2]);
    const sr = $('search'), res = $('results');
    sr.oninput = () => { const q = sr.value.trim().toLowerCase(); if (q.length < 2) { res.style.display = 'none'; return; } const m = []; for (const c of Geo.cities) { const n = c[0].toLowerCase(); if (n.startsWith(q)) m.unshift(c); else if (n.includes(q)) m.push(c); if (m.length > 60) break; }
      m.sort((a, b) => (b[0].toLowerCase().startsWith(q) - a[0].toLowerCase().startsWith(q)) || b[3] - a[3]); res.innerHTML = ''; m.slice(0, 7).forEach(c => { const b = document.createElement('button'); b.innerHTML = `${c[0]}<span>${c[4]}</span>`; b.onclick = () => { this.select(c[1], c[2]); this.lat = c[1]; this.lon = c[2]; this.dist = Math.min(this.dist, 1.5); res.style.display = 'none'; sr.value = ''; sr.blur(); }; res.appendChild(b); }); res.style.display = m.length ? 'block' : 'none'; };
  }
  zoom(f) { this.dist = clamp(1 + (this.dist - 1) * f, 1.035, 4.2); }
  open(lat, lon) { this.lat = lat; this.lon = lon; this.dist = Math.max(this.dist, 1.6); this.me = { lat, lon }; this.place(this.pinMe, lat, lon); }
  place(pin, lat, lon) { pin.position.copy(ll2v(lat, lon, 1.002)); pin.lookAt(0, 0, 0); pin.visible = true; }
  pick(cx, cy) {
    this.ray.setFromCamera(new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1), this.cam); const h = this.ray.intersectObject(this.globe)[0]; if (!h) return;
    this.select(h.uv.y * 180 - 90, h.uv.x * 360 - 180);
  }
  select(lat, lon) {
    const nc = Geo.nearestCity(lat, lon), c = nc.city, sea = Geo.land(lat, lon) < 0.5; this.sel = { lat, lon, city: c && nc.km < 400 ? c : null }; this.place(this.pinSel, lat, lon);
    const inCity = c && nc.km < Geo.cityRadiusKm(c[3]);
    $('mi-t').textContent = inCity ? `${c[0]}, ${c[4]}` : sea ? 'Open ocean' : c && nc.km < 400 ? `${Math.round(nc.km)} km from ${c[0]}` : 'Wilderness';
    $('mi-s').textContent = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}` + (sea ? ' · you will land on the water' : '') + (c && !inCity && nc.km < 400 ? ` · nearest city: ${c[0]}, ${c[4]}` : '');
    $('m-go').style.display = ''; const mc = $('m-city'); mc.style.display = c && !inCity && nc.km < 400 ? '' : 'none'; if (c) mc.textContent = `Go to ${c[0]}`;
  }
  render(renderer) {
    const now = new Date(G.sky.now()), h = now.getUTCHours() + now.getUTCMinutes() / 60, doy = (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - Date.UTC(now.getUTCFullYear(), 0, 0)) / 864e5;
    this.mat.uniforms.uSun.value.copy(ll2v(-23.44 * Math.cos(6.283 * (doy + 10) / 365), -(h - 12) * 15));
    this.cam.aspect = innerWidth / innerHeight; this.cam.fov = this.cam.aspect < 1 ? 58 : 40; this.cam.updateProjectionMatrix(); this.cam.position.copy(ll2v(this.lat, this.lon, this.dist)); this.cam.lookAt(0, 0, 0);
    const s = (this.dist - 1) * 1.6 + 0.12; this.pinSel.scale.setScalar(s); this.pinMe.scale.setScalar(s);
    const exp = renderer.toneMappingExposure, tm = renderer.toneMapping; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x02040a); renderer.render(this.scene, this.cam); renderer.toneMapping = tm; renderer.toneMappingExposure = exp;
    // label the biggest cities facing the camera
    const N = clamp(Math.round(14 / Math.pow(this.dist - 1, 1.3)), 14, 900), cd = this.cam.position.clone().normalize(), lim = Math.cos(Math.acos(1 / this.dist) * 0.92), v = new THREE.Vector3(); let k = 0;
    for (let i = 0; i < N && k < this.labels.length; i++) { const c = Geo.cities[i]; v.copy(ll2v(c[1], c[2])); if (v.dot(cd) < lim) continue; v.project(this.cam); if (Math.abs(v.x) > 0.96 || Math.abs(v.y) > 0.9) continue; const s2 = this.labels[k++]; s2.style.display = ''; s2.style.left = ((v.x + 1) / 2 * innerWidth) + 'px'; s2.style.top = ((1 - v.y) / 2 * innerHeight) + 'px'; if (s2.textContent !== c[0]) s2.textContent = c[0]; }
    for (; k < this.labels.length; k++) this.labels[k].style.display = 'none';
  }
}
