'use strict';
/* Apex Rush race engine: pseudo-3D segment renderer, car physics, AI rivals,
   lap/position tracking, HUD and input (keyboard, touch, gamepad). */
const Game = (() => {
  // ------------------------------------------------------------ constants
  const SEG = 200, RUMBLE = 3, ROAD_W = 2000, LANES = 3, CAM_H = 1000, FOV = 100;
  const CAM_DEPTH = 1 / Math.tan((FOV / 2) * Math.PI / 180);
  const PLAYER_Z = CAM_H * CAM_DEPTH;
  const MAX_SPEED = 12000, CAR_W = 620, CAR_LEN = SEG * 1.3, CENTRIFUGAL = 0.22;
  const KMH = 0.025, NUM_RACERS = 8, TAU = Math.PI * 2;
  const GEARS = [0.12, 0.25, 0.4, 0.57, 0.76, 1.0, 1.5];

  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d', { alpha: false });
  const $ = id => document.getElementById(id);

  // ---------------------------------------------------------------- state
  let W = 0, H = 0, KX = 0, KY = 0, drawDistance = 300;
  let SPR = null, T = null, TA = null, trackIdx = 0;
  let segments = [], trackLen = 0, startIdx = 14, startZ = 0;
  let racers = [], player = null, carDef = CARS[0];
  let mode = 'idle'; // idle | attract | countdown | race | finished
  let paused = false, raceTime = 0, countdown = 0, lastCount = 0, laps = 3;
  let bgOff = [0, 0, 0, 0], particles = [], shake = 0, crashCool = 0;
  let finishTimer = 0, finishSent = false, lastPos = 0, time = 0, lastT = 0;
  let skyCanvas = null, vignette = null, mmBase = null, mmPts = null;
  let carScreen = { cx: 0, by: 0, w: 0 };
  const usedSegs = [];
  const listeners = {};
  const on = (e, f) => (listeners[e] = listeners[e] || []).push(f);
  const emit = (e, d) => (listeners[e] || []).forEach(f => f(d));

  // ---------------------------------------------------------------- utils
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const mod = (a, n) => ((a % n) + n) % n;
  const easeIn = (a, b, p) => a + (b - a) * p * p;
  const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
  const overlap = (x1, w1, x2, w2) => Math.abs(x1 - x2) < (w1 + w2) / 2;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const findSeg = z => segments[Math.floor(mod(z, trackLen) / SEG) % segments.length];
  function fmt(t) {
    if (!isFinite(t)) return '--:--.--';
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s < 10 ? '0' : ''}${s.toFixed(2)}`;
  }
  function vibrate(ms) {
    if (!Store.data.settings.vibration) return;
    try { navigator.vibrate && navigator.vibrate(ms); } catch (e) { /* unsupported */ }
    const gp = activePad();
    try { gp && gp.vibrationActuator && gp.vibrationActuator.playEffect('dual-rumble', { duration: ms, strongMagnitude: 0.8, weakMagnitude: 0.5 }); } catch (e) { /* unsupported */ }
  }

  // ---------------------------------------------------------- track build
  function buildTrack(def) {
    segments = [];
    const lastY = () => segments.length ? segments[segments.length - 1].p2.world.y : 0;
    const add = (curve, y) => {
      const n = segments.length;
      segments.push({
        index: n, curve, sprites: [], cars: [], dark: Math.floor(n / RUMBLE) % 2 === 1, fog: 0,
        p1: { world: { y: lastY(), z: n * SEG }, camera: {}, screen: {} },
        p2: { world: { y, z: (n + 1) * SEG }, camera: {}, screen: {} },
      });
    };
    const b = {
      road(enter, hold, leave, curve = 0, hill = 0) {
        const sy = lastY(), ey = sy + hill * SEG, tot = enter + hold + leave;
        for (let i = 0; i < enter; i++) add(easeIn(0, curve, i / enter), easeInOut(sy, ey, i / tot));
        for (let i = 0; i < hold; i++) add(curve, easeInOut(sy, ey, (enter + i) / tot));
        for (let i = 0; i < leave; i++) add(easeInOut(curve, 0, i / leave), easeInOut(sy, ey, (enter + hold + i) / tot));
      },
      sCurves() {
        this.road(L.M, L.M, L.M, -C.E, 0);
        this.road(L.M, L.M, L.M, C.M, Hh.M);
        this.road(L.M, L.M, L.M, C.E, -Hh.L);
        this.road(L.M, L.M, L.M, -C.E, Hh.M);
        this.road(L.M, L.M, L.M, -C.M, -Hh.M);
      },
      bumps() {
        [5, -2, -5, 8, 5, -7, 5, -2].forEach(h => this.road(10, 10, 10, 0, h));
      },
    };
    def.build(b);
    b.road(L.M, L.M, L.M, 0, -lastY() / SEG); // return to ground level
    b.road(L.S, L.M, L.S, 0, 0);              // start/finish straight + grid
    trackLen = segments.length * SEG;
    startIdx = 14;
    startZ = startIdx * SEG;
    segments[startIdx].start = segments[startIdx + 1].start = true;
  }

  function decorate(def) {
    const r = Art.rng(def.id.length * 977 + def.id.charCodeAt(0));
    const n = segments.length;
    const put = (i, key, offset) => { if (i >= 0 && i < n && SPR[key]) segments[i].sprites.push({ key, offset }); };
    for (const rule of T.decor) {
      for (let i = 0; i < n; i += rule.every) {
        for (const side of [-1, 1]) {
          if (r() > rule.chance) continue;
          const idx = i + Math.floor(r() * rule.every);
          if (Math.abs(idx - startIdx) < 5) continue;
          put(idx, rule.keys[Math.floor(r() * rule.keys.length)], side * (rule.min + r() * (rule.max - rule.min)));
        }
      }
    }
    if (T.lamps) {
      for (let i = 0; i < n; i += T.lamps.every) {
        put(i, 'lampL', -T.lamps.offset);
        put(i + (T.lamps.every >> 1), 'lampR', T.lamps.offset);
      }
    }
    const bbs = T.billboards;
    put(startIdx + 30, bbs[0], -1.3);
    put(startIdx + 60, bbs[1], 1.3);
    let k = 2;
    for (let i = startIdx + 170; i < n - 60; i += 150 + Math.floor(r() * 90)) put(i, bbs[k++ % bbs.length], (r() > 0.5 ? 1 : -1) * 1.3);
    put(startIdx, 'gantry', 0);
    // warning chevrons on the outside of sharp bends
    for (let i = 1; i < n; i++) {
      if (Math.abs(segments[i - 1].curve) < 0.001 && Math.abs(segments[i].curve) >= 0.001) {
        let maxC = 0;
        for (let j = i; j < Math.min(n, i + 60); j++) if (Math.abs(segments[j].curve) > Math.abs(maxC)) maxC = segments[j].curve;
        if (Math.abs(maxC) >= 3.5) {
          for (let j = i - 8; j < i + 46; j += 7) put(j, maxC > 0 ? 'chevR' : 'chevL', maxC > 0 ? -1.12 : 1.12);
        }
      }
    }
  }

  function buildMinimap() {
    let sum = 0;
    segments.forEach(s => (sum += s.curve));
    const k = Math.abs(sum) > 60 ? TAU / Math.abs(sum) : 0.006;
    let hd = 0, x = 0, y = 0;
    const pts = [];
    for (const s of segments) { pts.push([x, y]); hd += s.curve * k; x += Math.sin(hd); y -= Math.cos(hd); }
    const n = pts.length;
    pts.forEach((p, i) => { p[0] -= (x * i) / n; p[1] -= (y * i) / n; });
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(([px, py]) => { minX = Math.min(minX, px); maxX = Math.max(maxX, px); minY = Math.min(minY, py); maxY = Math.max(maxY, py); });
    const S = 300, pad = 26, sc = (S - pad * 2) / Math.max(maxX - minX, maxY - minY, 1);
    const ox = (S - (maxX - minX) * sc) / 2, oy = (S - (maxY - minY) * sc) / 2;
    mmPts = pts.map(([px, py]) => [ox + (px - minX) * sc, oy + (py - minY) * sc]);
    mmBase = mk(S, S);
    const c = mmBase.getContext('2d');
    c.lineJoin = c.lineCap = 'round';
    const path = () => { c.beginPath(); mmPts.forEach(([px, py], i) => (i ? c.lineTo(px, py) : c.moveTo(px, py))); c.closePath(); };
    path(); c.strokeStyle = 'rgba(0,0,0,0.55)'; c.lineWidth = 16; c.stroke();
    path(); c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 7; c.stroke();
    const [sx, sy] = mmPts[startIdx];
    c.fillStyle = '#ff3b3b'; c.fillRect(sx - 7, sy - 7, 14, 14);
    c.fillStyle = '#fff'; c.fillRect(sx - 7, sy - 7, 7, 7); c.fillRect(sx, sy, 7, 7);
  }

  // ------------------------------------------------------------- racers
  function makeRacer(o) {
    return Object.assign({
      total: 0, offset: 0, speed: 0, lapIdx: -1, lapStart: 0, bestLap: Infinity, lastLap: 0,
      finished: false, finishTime: 0, targetOffset: 0, wander: 2, nitro: 1, nitroOn: false,
      steer: 0, gas: 0, braking: false, rev: 0, percent: 0, skill: 1, accel: 1, skid: 0,
    }, o);
  }

  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function setup(idx, attract) {
    trackIdx = idx;
    const def = TRACKS[idx];
    T = THEMES[def.theme];
    TA = Art.theme(def.theme);
    SPR = Art.sprites(ROAD_W);
    buildTrack(def);
    decorate(def);
    buildMinimap();
    buildSky();
    const st = Store.data.settings;
    laps = st.laps;
    carDef = CARS[Store.data.car] || CARS[0];
    const pColor = PAINTS[Store.data.color] || PAINTS[0];
    const others = shuffle(PAINTS.filter(p => p !== pColor));
    const names = shuffle(RIVALS.slice());
    const base = { easy: 0.8, normal: 0.885, hard: 0.95 }[st.difficulty] || 0.885;
    racers = [];
    for (let i = 0; i < NUM_RACERS; i++) {
      const row = Math.floor(i / 2), col = i % 2;
      const isP = i === NUM_RACERS - 1;
      const style = isP ? carDef.style : CARS[Math.floor(Math.random() * CARS.length)].style;
      const r = makeRacer({
        name: isP ? 'You' : names[i], isPlayer: isP,
        color: isP ? pColor : others[i % others.length], style,
        total: -(SEG * 2 + row * SEG * 3.5 + col * SEG * 1.2),
        offset: col ? 0.5 : -0.5,
      });
      if (!isP) {
        r.skill = base + Math.random() * 0.06 - (i / NUM_RACERS) * 0.03;
        r.accel = 0.8 + Math.random() * 0.4;
        r.img = Art.carImage(r.color, style);
        r.targetOffset = r.offset;
        r.wander = 3 + Math.random() * 4;
      }
      if (attract) { r.total = i * SEG * 9 + Math.random() * SEG * 3; r.speed = MAX_SPEED * 0.6; }
      racers.push(r);
      if (isP) player = r;
    }
    raceTime = 0; particles = []; shake = 0; crashCool = 0;
    finishSent = false; finishTimer = 0; paused = false; bgOff = [0, 0, 0, 0];
    lastPos = NUM_RACERS;
    hudCache = {};
  }

  function startRace(idx) {
    setup(idx, false);
    padPausePrev = true; // the button that started the race must be released before it can pause
    mode = 'countdown';
    countdown = 3.999; lastCount = 4;
    showHud(true);
    setLights(0);
    $('countdown').classList.add('show');
  }
  function startAttract() {
    setup(Math.floor(Math.random() * TRACKS.length), true);
    mode = 'attract';
    showHud(false);
    $('countdown').classList.remove('show');
  }

  // --------------------------------------------------------------- input
  const keys = {};
  const touch = { left: 0, right: 0, gas: 0, brake: 0, nitro: 0 };
  const input = { steer: 0, gas: 0, brake: 0, nitro: false };
  let padPausePrev = false;
  addEventListener('keydown', e => {
    keys[e.code] = true;
    if (mode !== 'idle' && mode !== 'attract' && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if ((e.code === 'Escape' || e.code === 'KeyP') && !e.repeat) emit('pauseKey');
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  function bindTouch(el, key) {
    const down = e => { touch[key] = 1; el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } e.preventDefault(); };
    const up = () => { touch[key] = 0; el.classList.remove('on'); };
    el.addEventListener('pointerdown', down);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(ev => el.addEventListener(ev, up));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }
  function activePad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }
  function readInput() {
    let steer = 0, gas = 0, brake = 0, nitro = false;
    if (keys.ArrowLeft || keys.KeyA) steer -= 1;
    if (keys.ArrowRight || keys.KeyD) steer += 1;
    if (keys.ArrowUp || keys.KeyW) gas = 1;
    if (keys.ArrowDown || keys.KeyS) brake = 1;
    if (keys.Space || keys.ShiftLeft || keys.ShiftRight || keys.KeyN) nitro = true;
    steer += touch.right - touch.left;
    gas = Math.max(gas, touch.gas);
    brake = Math.max(brake, touch.brake);
    nitro = nitro || !!touch.nitro;
    const gp = activePad();
    if (gp) {
      const ax = gp.axes[0] || 0;
      if (Math.abs(ax) > 0.12) steer += ax;
      const b = i => gp.buttons[i] ? gp.buttons[i].value || (gp.buttons[i].pressed ? 1 : 0) : 0;
      if (b(14)) steer -= 1;
      if (b(15)) steer += 1;
      gas = Math.max(gas, b(7), b(0));
      brake = Math.max(brake, b(6), b(1));
      nitro = nitro || b(2) > 0.5 || b(5) > 0.5;
      const p = b(9) > 0.5;
      if (p && !padPausePrev) emit('pauseKey');
      padPausePrev = p;
    }
    if (Store.data.settings.autoGas && brake < 0.1) gas = Math.max(gas, 1);
    input.steer = clamp(steer, -1, 1); input.gas = gas; input.brake = brake; input.nitro = nitro;
  }

  // -------------------------------------------------------------- update
  function update(dt) {
    time += dt;
    if (mode === 'countdown') {
      countdown -= dt;
      const c = Math.ceil(countdown);
      if (c !== lastCount) {
        lastCount = c;
        if (c >= 1 && c <= 3) { Sound.fx.beep(false); setLights(4 - c); }
        else if (c <= 0) {
          Sound.fx.beep(true); setLights(4);
          mode = 'race'; raceTime = 0;
          setTimeout(() => $('countdown').classList.remove('show'), 900);
        }
      }
    }
    if (mode === 'race' || mode === 'finished') raceTime += dt;
    const frozen = mode === 'countdown';
    readInput();
    updatePlayer(dt, frozen);
    updateAI(dt, frozen);
    if (!frozen) collideCars();
    if (mode === 'race' || mode === 'finished') racers.forEach(checkLap);
    if (mode === 'race') {
      const pos = standing();
      if (pos < lastPos) Sound.fx.overtake();
      lastPos = pos;
    }
    if (mode === 'finished' && !finishSent) {
      finishTimer -= dt;
      if (finishTimer <= 0) { finishSent = true; emit('results', results()); }
    }
    // parallax
    const seg = findSeg(startZ + player.total);
    const dSeg = (player.speed * dt) / SEG;
    TA.layers.forEach((l, i) => { bgOff[i] = mod(bgOff[i] + l.speed * seg.curve * dSeg + (l.drift || 0) * dt, 1); });
    // particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.size += p.grow * dt;
    }
    shake = Math.max(0, shake - dt * 40);
    crashCool -= dt;
    updateAudio(dt);
  }

  function updatePlayer(dt, frozen) {
    const auto = mode === 'attract' || mode === 'finished';
    const pz = startZ + player.total;
    const seg = findSeg(pz);
    const sp = player.speed / MAX_SPEED;
    let steer, gas, brake, nitro;
    if (auto) {
      const look = findSeg(pz + SEG * 10);
      const target = clamp(-look.curve * 0.07, -0.55, 0.55) + Math.sin(time * 0.35) * 0.2;
      steer = clamp((target - player.offset) * 3, -1, 1);
      for (const r of racers) {
        if (r === player) continue;
        const d = r.total - player.total;
        if (d > 0 && d < SEG * 14 && Math.abs(r.offset - player.offset) < 0.45) steer = r.offset > player.offset ? -1 : 1;
      }
      gas = sp < (mode === 'attract' ? 0.8 : 0.7) ? 1 : 0; brake = 0; nitro = false;
    } else {
      ({ steer, gas, brake, nitro } = input);
    }
    player.steer += (steer - player.steer) * Math.min(1, dt * 7);
    player.gas = gas; player.braking = brake > 0.1;
    if (frozen) {
      player.rev = lerp(player.rev, gas ? 0.9 : 0.12, Math.min(1, dt * (gas ? 5 : 3)));
      return;
    }

    // nitro
    const wasOn = player.nitroOn;
    player.nitroOn = nitro && player.nitro > 0.01 && gas > 0 && mode === 'race';
    if (player.nitroOn) {
      player.nitro = Math.max(0, player.nitro - dt * 0.32);
      if (!wasOn) { Sound.fx.nitro(); vibrate(30); }
    } else {
      player.nitro = Math.min(1, player.nitro + dt * 0.045);
    }
    const top = MAX_SPEED * carDef.top * (player.nitroOn ? 1.25 : 1);

    // steering + centrifugal drift
    const dx = dt * 2.7 * Math.min(sp, 1.1);
    player.offset += dx * player.steer * carDef.handling;
    player.offset -= dx * sp * seg.curve * CENTRIFUGAL;

    // throttle / brakes
    if (gas > 0) {
      const a = (MAX_SPEED / 4.2) * carDef.accel * Math.max(0.15, 1 - 0.72 * (player.speed / top) ** 2);
      player.speed += a * gas * dt;
    } else {
      player.speed -= (MAX_SPEED / 7) * dt;
    }
    if (player.nitroOn) player.speed += MAX_SPEED * 0.35 * dt;
    if (brake > 0) player.speed -= MAX_SPEED * 0.95 * brake * dt;
    const offroad = Math.abs(player.offset) > 1.08;
    if (offroad && player.speed > MAX_SPEED * 0.28) player.speed -= MAX_SPEED * 0.65 * dt;
    if (player.speed > top) player.speed = Math.max(top, player.speed - MAX_SPEED * 0.35 * dt);
    player.speed = Math.max(0, player.speed);

    // roadside collisions (check current + next segment so nothing is skipped)
    if (crashCool <= 0 && Math.abs(player.offset) > 0.9) {
      const pw = (CAR_W / ROAD_W) * 0.8;
      outer: for (const s2 of [seg, findSeg(pz + SEG)]) {
        for (const s of s2.sprites) {
          const d = SPR[s.key];
          if (!d.hit) continue;
          const sw = d.w / ROAD_W;
          const left = d.center ? s.offset - sw / 2 : (s.offset < 0 ? s.offset - sw : s.offset);
          if (overlap(player.offset, pw, left + sw * d.hitX, sw * d.hit)) { crash(); break outer; }
        }
      }
    }
    player.offset = clamp(player.offset, -2.8, 2.8);
    player.total += player.speed * dt;

    // tyre smoke / dust
    const sp2 = player.speed / MAX_SPEED;
    player.skid = (!offroad && sp2 > 0.55 && Math.abs(player.steer) > 0.6 && Math.abs(seg.curve) > 2.5)
      ? Math.min(1, (Math.abs(seg.curve) / 6) * sp2) : (player.braking && sp2 > 0.4 ? 0.5 : 0);
    if (carScreen.w) {
      const wx = carScreen.w * 0.38, wy = carScreen.by - carScreen.w * 0.03;
      if (offroad && sp2 > 0.08) {
        const [r, g, b] = T.dust;
        for (const sx of [-1, 1]) spawn(carScreen.cx + sx * wx, wy, `${r},${g},${b}`, 0.6, carScreen.w);
      } else if (player.skid > 0.3 && Math.random() < player.skid) {
        for (const sx of [-1, 1]) spawn(carScreen.cx + sx * wx, wy, '220,220,225', 0.45, carScreen.w);
      }
    }
  }

  function spawn(x, y, rgb, alpha, w) {
    particles.push({
      x: x + (Math.random() - 0.5) * w * 0.05, y,
      vx: (Math.random() - 0.5) * w * 0.6, vy: -(Math.random() * w * 0.15),
      size: w * 0.03, grow: w * 0.25, life: 0.5 + Math.random() * 0.3, max: 0.8, rgb, alpha,
    });
    if (particles.length > 160) particles.shift();
  }

  function crash() {
    const i = player.speed / MAX_SPEED;
    if (i > 0.12) {
      Sound.fx.crash(Math.min(1, i + 0.2));
      shake = 22 * i;
      vibrate(90);
      if (carScreen.w) for (let k = 0; k < 10; k++) spawn(carScreen.cx, carScreen.by - carScreen.w * 0.1, '120,120,120', 0.6, carScreen.w);
    }
    player.speed *= 0.15;
    player.offset *= 0.94;
    crashCool = 0.6;
  }

  function updateAI(dt, frozen) {
    if (frozen) return;
    for (const r of racers) {
      if (r.isPlayer) continue;
      const ahead = findSeg(startZ + r.total + SEG * 8);
      const ac = Math.abs(ahead.curve);
      let target = MAX_SPEED * r.skill;
      if (ac > 4.5) target *= 0.86; else if (ac > 3) target *= 0.95;
      if (mode === 'race') {
        const gap = player.total - r.total;
        if (gap > SEG * 30) target *= 1 + Math.min(0.08, gap / (SEG * 1500));
        else if (gap < -SEG * 50) target *= 0.95;
      }
      if (r.finished) target *= 0.8;
      r.speed += clamp(target - r.speed, -MAX_SPEED * 0.6 * dt, MAX_SPEED * 0.2 * r.accel * dt);

      r.wander -= dt;
      if (r.wander <= 0) { r.wander = 2 + Math.random() * 5; r.targetOffset = Math.random() * 1.5 - 0.75; }
      for (const o of racers) {
        if (o === r) continue;
        const d = o.total - r.total;
        if (d > 0 && d < SEG * 10 && Math.abs(o.offset - r.offset) < 0.42 && o.speed < r.speed) {
          let dir = o.offset > r.offset ? -1 : 1;
          if (Math.abs(o.offset + dir * 0.6) > 0.85) dir = -dir;
          r.targetOffset = clamp(o.offset + dir * 0.6, -0.85, 0.85);
          if (d < CAR_LEN * 1.3) r.speed = Math.min(r.speed, o.speed);
          break;
        }
      }
      r.offset += clamp(r.targetOffset - r.offset, -dt * 0.8, dt * 0.8);
      r.total += r.speed * dt;
    }
  }

  function collideCars() {
    const pw = CAR_W / ROAD_W;
    for (const r of racers) {
      if (r === player) continue;
      const d = r.total - player.total;
      const dx = Math.abs(r.offset - player.offset);
      if (dx > pw * 0.9 || Math.abs(d) > CAR_LEN) continue;
      if (d >= 0 && player.speed > r.speed) {
        const imp = (player.speed - r.speed) / MAX_SPEED;
        player.speed = r.speed * 0.9;
        player.total = r.total - CAR_LEN;
        r.speed += imp * MAX_SPEED * 0.25;
        hit(imp);
      } else if (d < 0 && r.speed > player.speed) {
        const imp = (r.speed - player.speed) / MAX_SPEED;
        r.speed = player.speed * 0.9;
        r.total = player.total - CAR_LEN;
        player.speed += imp * MAX_SPEED * 0.2;
        hit(imp * 0.6);
      } else {
        const push = (pw * 0.9 - dx) * 0.5, s = player.offset < r.offset ? -1 : 1;
        player.offset += s * push; r.offset -= s * push; r.targetOffset = r.offset;
      }
    }
  }
  function hit(i) {
    if (crashCool > 0) return;
    Sound.fx.bump(Math.min(1, 0.3 + i * 3));
    shake = Math.max(shake, 6 + i * 30);
    vibrate(40);
    crashCool = 0.25;
  }

  function checkLap(r) {
    const idx = Math.floor(r.total / trackLen);
    if (idx <= r.lapIdx) return;
    if (idx >= 1) {
      const lt = raceTime - r.lapStart;
      r.lastLap = lt;
      if (lt < r.bestLap) r.bestLap = lt;
      r.lapStart = raceTime;
      if (r.isPlayer && idx < laps) {
        Sound.fx.lap();
        toast(idx === laps - 1 ? `FINAL LAP · ${fmt(lt)}` : `LAP ${idx + 1}/${laps} · ${fmt(lt)}`);
      }
    }
    r.lapIdx = idx;
    if (idx >= laps && !r.finished) {
      r.finished = true;
      r.finishTime = raceTime;
      if (r.isPlayer) {
        mode = 'finished';
        Sound.fx.finish();
        finishTimer = 2.4;
        toast(`FINISHED · P${standing()}`, 2400);
      }
    }
  }

  function order() {
    return [...racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.total - a.total;
    });
  }
  const standing = () => order().indexOf(player) + 1;

  function results() {
    const goal = laps * trackLen;
    const list = racers.map(r => ({
      name: r.name, color: r.color, isPlayer: r.isPlayer, best: r.bestLap,
      time: r.finished ? r.finishTime : raceTime + (goal - r.total) / Math.max(r.speed, MAX_SPEED * 0.4),
    })).sort((a, b) => a.time - b.time);
    return {
      track: TRACKS[trackIdx], trackIdx, list, laps,
      position: list.findIndex(x => x.isPlayer) + 1,
      time: player.finishTime, bestLap: player.bestLap,
    };
  }

  // --------------------------------------------------------------- audio
  function updateAudio(dt) {
    if (!Sound.ready) return;
    if (paused || mode === 'idle' || mode === 'attract') { Sound.silence(); return; }
    const sp = player.speed / MAX_SPEED;
    let rpm;
    if (mode === 'countdown') rpm = player.rev;
    else {
      let g = GEARS.findIndex(x => sp <= x);
      if (g < 0) g = GEARS.length - 1;
      const lo = g ? GEARS[g - 1] : 0;
      rpm = 0.2 + 0.8 * clamp((sp - lo) / (GEARS[g] - lo), 0, 1);
      player.gear = g + 1;
    }
    Sound.engine(rpm, player.gas, true);
    Sound.wind(sp);
    Sound.skid(player.skid || 0);
  }

  // ------------------------------------------------------------- render
  function resize() {
    const q = Store.data.settings.quality;
    const ratio = q === 'low' ? 0.6 : q === 'medium' ? Math.min(devicePixelRatio || 1, 1) : Math.min(devicePixelRatio || 1, 2);
    drawDistance = q === 'low' ? 160 : q === 'medium' ? 240 : 320;
    W = Math.max(2, Math.round(innerWidth * ratio));
    H = Math.max(2, Math.round(innerHeight * ratio));
    cvs.width = W; cvs.height = H;
    KY = H / 2;
    KX = Math.min(W / 2, H * 0.8);
    buildSky();
    vignette = mk(W, H);
    const v = vignette.getContext('2d');
    const g = v.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    v.fillStyle = g; v.fillRect(0, 0, W, H);
  }

  function buildSky() {
    if (!T || !W) return;
    const sh = Math.ceil(H * 0.62);
    skyCanvas = mk(W, sh);
    const x = skyCanvas.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, sh);
    T.sky.forEach(([o, c]) => g.addColorStop(o, c));
    x.fillStyle = g; x.fillRect(0, 0, W, sh);
    if (T.stars) {
      const r = Art.rng(42);
      for (let i = 0; i < 280; i++) {
        const s = r() < 0.1 ? 2 : 1;
        x.fillStyle = `rgba(255,255,255,${0.3 + r() * 0.7})`;
        x.fillRect(r() * W, r() * sh * 0.75, s * (W / 1200 + 0.5), s * (W / 1200 + 0.5));
      }
    }
  }

  function project(p, camX, camY, camZ) {
    p.camera.x = -camX;
    p.camera.y = p.world.y - camY;
    p.camera.z = p.world.z - camZ;
    const s = (p.screen.scale = CAM_DEPTH / p.camera.z);
    p.screen.x = Math.round(W / 2 + s * p.camera.x * KX);
    p.screen.y = Math.round(H / 2 - s * p.camera.y * KY);
    p.screen.w = Math.round(s * ROAD_W * KX);
  }

  function poly(x1, y1, x2, y2, x3, y3, x4, y4, c) {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
    ctx.closePath(); ctx.fill();
  }

  function drawSegment(seg) {
    const a = seg.p1.screen, b = seg.p2.screen, d = seg.dark ? 1 : 0;
    const x1 = a.x, y1 = a.y, w1 = a.w, x2 = b.x, y2 = b.y, w2 = b.w;
    ctx.fillStyle = T.grass[d];
    ctx.fillRect(0, y2, W, y1 - y2 + 1);
    const r1 = w1 / 6, r2 = w2 / 6;
    poly(x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, T.rumble[d]);
    poly(x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, T.rumble[d]);
    poly(x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, T.road[d]);
    if (seg.start) {
      const n = 14;
      for (let k = 0; k < n; k++) {
        const u = k / n, v = (k + 1) / n;
        poly(x1 - w1 + 2 * w1 * u, y1, x1 - w1 + 2 * w1 * v, y1, x2 - w2 + 2 * w2 * v, y2, x2 - w2 + 2 * w2 * u, y2,
          (k + seg.index) % 2 ? '#141414' : '#f2f2f2');
      }
    } else {
      const e1 = w1 / 40, e2 = w2 / 40;
      poly(x1 - w1 + e1, y1, x1 - w1 + e1 * 2, y1, x2 - w2 + e2 * 2, y2, x2 - w2 + e2, y2, T.edge);
      poly(x1 + w1 - e1, y1, x1 + w1 - e1 * 2, y1, x2 + w2 - e2 * 2, y2, x2 + w2 - e2, y2, T.edge);
      if (!seg.dark) {
        const l1 = w1 / 34, l2 = w2 / 34, lw1 = (w1 * 2) / LANES, lw2 = (w2 * 2) / LANES;
        for (let lane = 1; lane < LANES; lane++) {
          const lx1 = x1 - w1 + lw1 * lane, lx2 = x2 - w2 + lw2 * lane;
          poly(lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, T.lane);
        }
      }
    }
    if (seg.fog > 0.004) {
      ctx.globalAlpha = seg.fog;
      ctx.fillStyle = T.fog;
      ctx.fillRect(0, y2, W, y1 - y2 + 1);
      ctx.globalAlpha = 1;
    }
  }

  function drawImg(img, worldW, scale, x, y, alignX, alpha) {
    const dw = worldW * scale * KX;
    if (dw < 1) return;
    const dh = (dw * img.height) / img.width;
    const dx = x + dw * alignX, dy = y - dh;
    if (dx > W || dx + dw < 0 || dy > H) return;
    if (alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(img, dx, dy, dw, dh);
    if (alpha < 1) ctx.globalAlpha = 1;
  }

  function drawCarOnRoad(r, seg) {
    const p1 = seg.p1, p2 = seg.p2, t = r.percent;
    const cz = lerp(p1.camera.z, p2.camera.z, t);
    if (cz < 60) return;
    const scale = CAM_DEPTH / cz;
    const x = lerp(p1.screen.x, p2.screen.x, t) + scale * r.offset * ROAD_W * KX;
    const y = lerp(p1.screen.y, p2.screen.y, t);
    drawImg(r.img, CAR_W, scale, x, y, -0.5, 1 - seg.fog * 0.8);
  }

  function drawBackground() {
    ctx.drawImage(skyCanvas, 0, 0);
    ctx.fillStyle = T.ground;
    ctx.fillRect(0, skyCanvas.height - 1, W, H);
    const far = TA.layers[TA.layers.length - 2];
    const farW = (H * far.h * far.img.width) / far.img.height;
    const farOff = bgOff[TA.layers.length - 2] * farW;
    if (T.sun) drawSun(T.sun, farOff);
    if (T.moon) drawMoon(T.moon, farOff);
    TA.layers.forEach((l, i) => {
      let dh = H * l.h, dw = (dh * l.img.width) / l.img.height;
      if (dw < W) { dh *= W / dw; dw = W; }
      const y = H * l.bottom - dh;
      for (let x = -bgOff[i] * dw; x < W; x += dw) ctx.drawImage(l.img, Math.floor(x), y, Math.ceil(dw) + 1, dh);
    });
  }
  function celestialX(sx, off) { return mod(sx * W - off * 0.5 + W * 0.3, W * 1.6) - W * 0.3; }
  function drawSun(s, off) {
    const x = celestialX(s.x, off), y = H * s.y, r = H * s.r * 1.25;
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 4.5);
    g.addColorStop(0, s.glow); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    if (s.stripes) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
      const sg = ctx.createLinearGradient(0, y - r, 0, y + r);
      sg.addColorStop(0, s.color); sg.addColorStop(1, s.color2);
      ctx.fillStyle = sg;
      ctx.fillRect(x - r, y - r, r * 2, r * 1.05);
      let yy = y + r * 0.05, gap = r * 0.035;
      while (yy < y + r) { const bh = r * 0.13; ctx.fillRect(x - r, yy + gap, r * 2, bh); yy += bh + gap; gap += r * 0.022; }
      ctx.restore();
    } else {
      ctx.fillStyle = s.color;
      ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    }
  }
  function drawMoon(m, off) {
    const x = celestialX(m.x, off), y = H * m.y, r = H * m.r * 1.2;
    const g = ctx.createRadialGradient(x, y, r, x, y, r * 5);
    g.addColorStop(0, 'rgba(200,190,255,0.35)'); g.addColorStop(1, 'rgba(200,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    ctx.fillStyle = '#f4f1ff'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(160,150,200,0.35)';
    [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [-0.05, 0.4, 0.12]].forEach(([a, b, c]) => {
      ctx.beginPath(); ctx.arc(x + a * r, y + b * r, c * r, 0, TAU); ctx.fill();
    });
  }

  function render() {
    if (!segments.length || !skyCanvas) return;
    const n = segments.length;
    const pz = startZ + player.total;
    const position = mod(pz - PLAYER_Z, trackLen);
    const base = findSeg(position);
    const basePct = (position % SEG) / SEG;
    const pSeg = findSeg(pz);
    const pPct = (mod(pz, trackLen) % SEG) / SEG;
    const playerY = lerp(pSeg.p1.world.y, pSeg.p2.world.y, pPct);

    ctx.save();
    if (shake > 0.3) {
      const k = (shake * W) / 1400;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    drawBackground();

    // place AI cars into their segments
    for (const s of usedSegs) s.cars.length = 0;
    usedSegs.length = 0;
    const behind = [];
    for (const r of racers) {
      if (r.isPlayer) continue;
      const rel = mod(r.total - player.total + trackLen / 2, trackLen) - trackLen / 2;
      const z = mod(startZ + r.total, trackLen);
      const s = segments[Math.floor(z / SEG) % n];
      r.percent = (z % SEG) / SEG;
      r.seg = s;
      if (rel < 0) { if (rel > -PLAYER_Z) behind.push(r); continue; }
      s.cars.push(r); usedSegs.push(s);
    }

    // project near -> far
    const camY = playerY + CAM_H, camX = player.offset * ROAD_W;
    let x = 0, dx = -(base.curve * basePct);
    const dd = drawDistance;
    for (let i = 0; i < dd; i++) {
      const seg = segments[(base.index + i) % n];
      seg.looped = seg.index < base.index;
      const f = i / dd;
      seg.fog = 1 - 1 / Math.exp(f * f * T.fogDensity);
      const camZ = position - (seg.looped ? trackLen : 0);
      project(seg.p1, camX - x, camY, camZ);
      project(seg.p2, camX - x - dx, camY, camZ);
      x += dx; dx += seg.curve;
    }

    // draw far -> near (painter's algorithm handles hill occlusion)
    for (let i = dd - 1; i >= 0; i--) {
      const seg = segments[(base.index + i) % n];
      const a = seg.p1, b = seg.p2;
      if (a.camera.z > CAM_DEPTH && b.screen.y < a.screen.y) drawSegment(seg);
      if (a.camera.z > CAM_DEPTH && i > 0) {
        const alpha = 1 - seg.fog * 0.85;
        for (const s of seg.sprites) {
          const def = SPR[s.key];
          const sx = a.screen.x + a.screen.scale * s.offset * ROAD_W * KX;
          drawImg(def.img, def.w, a.screen.scale, sx, a.screen.y, def.center ? -0.5 : (s.offset < 0 ? -1 : 0), alpha);
        }
      }
      for (const r of seg.cars) drawCarOnRoad(r, seg);
    }

    drawPlayer();
    for (const r of behind) drawCarOnRoad(r, r.seg);
    drawParticles();
    if (player.nitroOn || player.speed > MAX_SPEED * 1.05) drawSpeedLines();
    ctx.restore();
    ctx.drawImage(vignette, 0, 0);
  }

  function drawPlayer() {
    const sc = CAM_DEPTH / PLAYER_Z;
    const w = CAR_W * sc * KX;
    const sp = player.speed / MAX_SPEED;
    const offroad = Math.abs(player.offset) > 1.08 && sp > 0.05;
    let by = H * 0.985 + Math.sin(time * 34) * w * 0.003 * sp;
    if (offroad) by += (Math.random() - 0.5) * w * 0.025;
    const cx = W / 2 + player.steer * w * 0.03;
    carScreen = { cx, by, w };
    const turn = clamp(player.steer * Math.min(1, sp * 2.5), -1, 1);
    ctx.save();
    ctx.translate(cx, by);
    ctx.rotate(turn * 0.025);
    Art.drawCar(ctx, 0, 0, w, player.color, { turn, brake: player.braking || mode === 'countdown', style: player.style, plate: 'YOU' });
    if (player.nitroOn) {
      const s = w / 200;
      ctx.globalCompositeOperation = 'lighter';
      for (const [ex, ey] of Art.EXHAUSTS) {
        const X = -w / 2 + ex * s, Y = -120 * s + ey * s, len = (14 + Math.random() * 12) * s;
        const g = ctx.createRadialGradient(X, Y, 0, X, Y + len * 0.3, len);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.3, 'rgba(120,200,255,0.9)');
        g.addColorStop(0.65, 'rgba(70,90,255,0.5)');
        g.addColorStop(1, 'rgba(40,40,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(X, Y + len * 0.3, len * 0.6, len, 0, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = p.alpha * Math.max(0, p.life / p.max);
      ctx.fillStyle = `rgba(${p.rgb},${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
  }

  function drawSpeedLines() {
    const cx = W / 2, cy = H * 0.5, R = Math.max(W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = Math.max(1, W / 900);
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * TAU, r1 = R * (0.35 + Math.random() * 0.2), r2 = r1 + R * (0.1 + Math.random() * 0.25);
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1 * 0.7);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2 * 0.7);
    }
    ctx.stroke();
  }

  // ----------------------------------------------------------------- HUD
  const hud = {
    root: $('hud'), pos: $('hud-pos'), posOf: $('hud-posof'), lap: $('hud-lap'), time: $('hud-time'),
    best: $('hud-best'), nitro: $('nitro-fill'), nitroWrap: $('nitro'), toast: $('toast'),
    speedo: $('speedo'), mm: $('minimap'),
  };
  const sctx = hud.speedo.getContext('2d'), mctx = hud.mm.getContext('2d');
  let hudCache = {}, toastTO = 0;
  const setText = (k, el, v) => { if (hudCache[k] !== v) { hudCache[k] = v; el.textContent = v; } };

  function showHud(b) {
    hud.root.classList.toggle('hidden', !b);
    $('touch').classList.toggle('hidden', !b || !Store.isTouch);
    $('btn-pause').classList.toggle('hidden', !b);
    hud.mm.classList.toggle('hidden', !Store.data.settings.minimap);
  }
  function toast(msg, ms = 2000) {
    hud.toast.textContent = msg;
    hud.toast.classList.add('show');
    clearTimeout(toastTO);
    toastTO = setTimeout(() => hud.toast.classList.remove('show'), ms);
  }
  function setLights(k) {
    document.querySelectorAll('#countdown .light').forEach((el, i) => {
      el.classList.toggle('red', k >= i + 1 && k < 4);
      el.classList.toggle('green', k === 4);
    });
    $('cd-text').textContent = k === 4 ? 'GO!' : k === 0 ? 'GET READY' : String(4 - k);
    $('countdown').classList.toggle('go', k === 4);
  }

  function updateHud() {
    if (mode === 'idle' || mode === 'attract') return;
    setText('pos', hud.pos, String(standing()));
    setText('posOf', hud.posOf, '/' + NUM_RACERS);
    setText('lap', hud.lap, `${clamp(player.lapIdx + 1, 1, laps)}/${laps}`);
    const lapT = mode === 'countdown' ? 0 : (player.finished ? player.lastLap : raceTime - player.lapStart);
    setText('time', hud.time, fmt(mode === 'finished' ? player.finishTime : raceTime));
    setText('best', hud.best, `LAP ${fmt(lapT)}  ·  BEST ${fmt(player.bestLap)}`);
    const nw = Math.round(player.nitro * 100);
    if (hudCache.nitro !== nw) { hudCache.nitro = nw; hud.nitro.style.transform = `scaleX(${player.nitro})`; }
    hud.nitroWrap.classList.toggle('active', player.nitroOn);
    drawSpeedo();
    if (Store.data.settings.minimap) drawMinimap();
  }

  function drawSpeedo() {
    const c = sctx, s = hud.speedo.width;
    c.clearRect(0, 0, s, s);
    const mph = Store.data.settings.units === 'mph';
    const maxV = mph ? 240 : 380;
    const v = player.speed * KMH * (mph ? 0.621371 : 1);
    const cx = s / 2, cy = s / 2, R = s * 0.4, a0 = Math.PI * 0.75, a1 = Math.PI * 2.25;
    c.lineCap = 'round';
    c.lineWidth = s * 0.055;
    c.strokeStyle = 'rgba(255,255,255,0.1)';
    c.beginPath(); c.arc(cx, cy, R, a0, a1); c.stroke();
    const frac = clamp(v / maxV, 0, 1);
    if (frac > 0.002) {
      const g = c.createLinearGradient(0, s, s, 0);
      g.addColorStop(0, '#2be3ff'); g.addColorStop(0.6, '#ffb02e'); g.addColorStop(1, '#ff3b3b');
      c.strokeStyle = g;
      c.beginPath(); c.arc(cx, cy, R, a0, a0 + (a1 - a0) * frac); c.stroke();
    }
    c.lineWidth = s * 0.008; c.lineCap = 'butt';
    c.fillStyle = 'rgba(255,255,255,0.55)';
    c.font = `600 ${s * 0.052}px system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let i = 0; i <= maxV; i += 20) {
      const a = a0 + ((a1 - a0) * i) / maxV, big = i % (mph ? 40 : 60) === 0;
      c.strokeStyle = big ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.3)';
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * (big ? 0.76 : 0.82), cy + Math.sin(a) * R * (big ? 0.76 : 0.82));
      c.lineTo(cx + Math.cos(a) * R * 0.88, cy + Math.sin(a) * R * 0.88);
      c.stroke();
      if (big) c.fillText(String(i), cx + Math.cos(a) * R * 0.62, cy + Math.sin(a) * R * 0.62);
    }
    c.fillStyle = '#fff';
    c.font = `italic 800 ${s * 0.2}px system-ui, sans-serif`;
    c.fillText(String(Math.round(v)), cx, cy + s * 0.02);
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.font = `700 ${s * 0.055}px system-ui, sans-serif`;
    c.fillText(mph ? 'MPH' : 'KM/H', cx, cy + s * 0.14);
    c.fillStyle = player.nitroOn ? '#2be3ff' : '#ffb02e';
    c.font = `italic 800 ${s * 0.09}px system-ui, sans-serif`;
    c.fillText(mode === 'countdown' ? 'N' : String(player.gear || 1), cx, cy + R * 0.92);
  }

  function drawMinimap() {
    const c = mctx;
    c.clearRect(0, 0, 300, 300);
    c.drawImage(mmBase, 0, 0);
    const n = mmPts.length;
    const dot = r => {
      const z = mod(startZ + r.total, trackLen) / SEG;
      const i = Math.floor(z) % n, j = (i + 1) % n, t = z - Math.floor(z);
      return [lerp(mmPts[i][0], mmPts[j][0], t), lerp(mmPts[i][1], mmPts[j][1], t)];
    };
    for (const r of racers) {
      if (r.isPlayer) continue;
      const [x, y] = dot(r);
      c.fillStyle = r.color; c.strokeStyle = 'rgba(0,0,0,0.7)'; c.lineWidth = 3;
      c.beginPath(); c.arc(x, y, 8, 0, TAU); c.fill(); c.stroke();
    }
    const [x, y] = dot(player);
    c.fillStyle = '#fff'; c.strokeStyle = '#ff3b3b'; c.lineWidth = 5;
    c.beginPath(); c.arc(x, y, 12, 0, TAU); c.fill(); c.stroke();
  }

  // ------------------------------------------------------------ main loop
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
    lastT = t;
    if (mode === 'idle') return;
    if (!paused) update(dt);
    render();
    if (!paused) updateHud();
  }

  function init() {
    resize();
    addEventListener('resize', resize);
    document.querySelectorAll('[data-touch]').forEach(el => bindTouch(el, el.dataset.touch));
    requestAnimationFrame(frame);
  }

  return {
    init, on, startRace, startAttract, resize,
    restart() { startRace(trackIdx); },
    pause() { if (mode === 'countdown' || mode === 'race' || mode === 'finished') { paused = true; Sound.silence(); return true; } return false; },
    resume() { paused = false; lastT = performance.now(); padPausePrev = true; },
    get mode() { return mode; },
    get paused() { return paused; },
    get inRace() { return mode === 'countdown' || mode === 'race'; },
    get debug() { return { player, racers, findSeg, startZ, trackLen }; },
    fmt,
  };
})();
