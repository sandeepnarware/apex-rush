'use strict';
/* Menus, garage, circuit select, settings, results and PWA wiring. */
(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const D = Store.data, S = D.settings;
  let current = 'menu', prevScreen = 'menu', selTrack = D.track || 0;
  let garageRAF = 0, lastResults = null;

  // ---------------------------------------------------------- navigation
  /* Focus + highlight in one step. The highlight class is set directly because
     focus events are deferred while the browser window itself is unfocused. */
  function focusEl(el, scroll = true) {
    if (!el) return;
    el.focus({ preventScroll: !scroll });
    document.querySelectorAll('.pf').forEach(x => x.classList.remove('pf'));
    el.classList.add('pf');
    if (el.matches('.track-card') && document.body.classList.contains('pad')) selectTrack([...el.parentNode.children].indexOf(el));
  }

  function show(id) {
    if (id !== current) prevScreen = current;
    current = id;
    $$('.screen').forEach(e => e.classList.toggle('active', e.id === id));
    if (id === 'garage') startGarage(); else cancelAnimationFrame(garageRAF);
    if (id === 'tracks') renderTracks();
    if (id === 'menu') renderMenuStats();
    if (id === 'settings') syncSettings();
    document.body.classList.add('menus');
    const first = id === 'tracks' ? $('.track-card.sel') : $(`#${id} .btn.primary, #${id} .btn`);
    if (first && (!Store.isTouch || document.body.classList.contains('pad'))) focusEl(first, id !== 'tracks');
  }
  function hideAll() {
    current = null;
    document.body.classList.remove('menus');
    $$('.screen').forEach(e => e.classList.remove('active'));
    cancelAnimationFrame(garageRAF);
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    Sound.fx.click();
    if (b.dataset.go) show(b.dataset.go);
    if (b.hasAttribute('data-back')) show(Game.paused ? 'pause' : (prevScreen === 'settings' ? 'menu' : prevScreen || 'menu'));
  });

  // first user gesture unlocks audio
  const unlock = () => {
    Sound.init();
    Sound.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });
    if (S.music > 0) Sound.musicStart();
  };
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => addEventListener(ev, unlock, { once: true, capture: true }));

  // keyboard navigation for menus
  addEventListener('keydown', e => {
    if (!current || Game.inRace && !Game.paused) return;
    const btns = $$(`#${current} button:not(.hidden)`).filter(b => b.offsetParent !== null);
    const i = btns.indexOf(document.activeElement);
    if (e.code === 'ArrowDown' || e.code === 'ArrowRight' && !document.activeElement.closest('.seg')) {
      if (current === 'garage' && e.code === 'ArrowRight') { cycleCar(1); return; }
      focusEl(btns[(i + 1) % btns.length]); e.preventDefault();
    } else if (e.code === 'ArrowUp' || e.code === 'ArrowLeft' && !document.activeElement.closest('.seg')) {
      if (current === 'garage' && e.code === 'ArrowLeft') { cycleCar(-1); return; }
      focusEl(btns[(i - 1 + btns.length) % btns.length]); e.preventDefault();
    } else if (e.code === 'Escape' && !Game.inRace && current !== 'menu' && current !== 'results') {
      show(current === 'settings' && Game.paused ? 'pause' : 'menu');
    }
  });

  // ---------------------------------------------------------- menu
  function renderMenuStats() {
    const st = D.stats;
    $('#menu-stats').innerHTML = `<div><b>${st.races}</b>Races</div><div><b>${st.wins}</b>Wins</div><div><b>${st.podiums}</b>Podiums</div>`;
  }

  // ---------------------------------------------------------- tracks
  const previewCache = {};
  function trackPreview(t) {
    if (previewCache[t.id]) return previewCache[t.id];
    const w = 480, h = 270, c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d'), th = THEMES[t.theme], art = Art.theme(t.theme);
    const g = x.createLinearGradient(0, 0, 0, h * 0.6);
    th.sky.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const s = th.sun || th.moon;
    if (s) {
      x.fillStyle = s.color || '#f4f1ff';
      x.beginPath(); x.arc(w * s.x, h * s.y, h * (s.r || 0.03) * 1.3, 0, Math.PI * 2); x.fill();
    }
    art.layers.forEach(l => {
      const lh = h * l.h, lw = lh * l.img.width / l.img.height;
      x.drawImage(l.img, 0, 0, l.img.width * Math.min(1, w / lw), l.img.height, 0, h * l.bottom - lh, Math.min(w, lw), lh);
    });
    x.fillStyle = th.grass[0]; x.fillRect(0, h * 0.56, w, h);
    const road = (wTop, wBot, col) => {
      x.fillStyle = col; x.beginPath();
      x.moveTo(w / 2 - wTop, h * 0.56); x.lineTo(w / 2 + wTop, h * 0.56);
      x.lineTo(w / 2 + wBot, h); x.lineTo(w / 2 - wBot, h); x.fill();
    };
    road(14, w * 0.62, th.rumble[0]);
    road(11, w * 0.52, th.road[0]);
    x.fillStyle = th.lane;
    for (let i = 0; i < 6; i++) {
      const t0 = i / 6, t1 = t0 + 0.07, y0 = h * 0.56 + (h * 0.44) * t0 * t0, y1 = h * 0.56 + (h * 0.44) * t1 * t1;
      x.fillRect(w / 2 - 1 - t0 * 4, y0, 2 + t0 * 8, y1 - y0);
    }
    return (previewCache[t.id] = c);
  }

  function renderTracks() {
    const grid = $('#track-grid');
    grid.innerHTML = '';
    TRACKS.forEach((t, i) => {
      const rec = D.records[t.id] || {};
      const card = document.createElement('button');
      card.className = 'track-card' + (i === selTrack ? ' sel' : '');
      card.innerHTML = `<span class="level ${t.level}">${t.level.toUpperCase()}</span>
        <div class="tc-body"><div class="tc-name">${t.name}</div><div class="tc-tag">${t.tag}</div>
        <div class="tc-meta"><span>BEST LAP <b>${rec.lap ? Game.fmt(rec.lap) : '—'}</b></span><span>BEST POS <b>${rec.pos ? 'P' + rec.pos : '—'}</b></span></div></div>`;
      const cv = trackPreview(t);
      const img = document.createElement('canvas');
      img.width = cv.width; img.height = cv.height;
      img.getContext('2d').drawImage(cv, 0, 0);
      card.prepend(img);
      card.addEventListener('click', () => {
        if (selTrack === i) { startRace(); return; }
        selectTrack(i);
      });
      // with a controller, highlighting a circuit selects it so (A) starts straight away
      card.addEventListener('focus', () => { if (document.body.classList.contains('pad')) selectTrack(i); });
      grid.appendChild(card);
    });
    syncSegs();
  }

  function selectTrack(i) {
    selTrack = (i + TRACKS.length) % TRACKS.length; D.track = selTrack; Store.save();
    $$('.track-card').forEach((c, j) => c.classList.toggle('sel', j === selTrack));
  }

  function startRace() {
    D.track = selTrack; Store.save();
    hideAll();
    document.body.classList.add('racing');
    if (Store.isTouch) {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).then(() => screen.orientation?.lock?.('landscape')).catch(() => {});
      }
    }
    Game.startRace(selTrack);
  }
  $('#btn-start').addEventListener('click', startRace);

  // ---------------------------------------------------------- settings
  function syncSegs() {
    $$('.seg[data-setting]').forEach(seg => {
      const k = seg.dataset.setting;
      seg.querySelectorAll('button').forEach(b => b.classList.toggle('on', String(S[k]) === b.dataset.v));
    });
  }
  function syncSettings() {
    $$('input[data-setting]').forEach(inp => {
      const k = inp.dataset.setting;
      if (inp.type === 'checkbox') inp.checked = !!S[k]; else inp.value = S[k];
    });
    syncSegs();
  }
  $$('.seg[data-setting]').forEach(seg => seg.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const k = seg.dataset.setting;
    S[k] = seg.hasAttribute('data-num') ? Number(b.dataset.v) : b.dataset.v;
    Store.save(); syncSegs();
    if (k === 'quality') Game.resize();
  }));
  $$('input[data-setting]').forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.setting;
    S[k] = inp.type === 'checkbox' ? inp.checked : Number(inp.value);
    Store.save();
    if (['master', 'music', 'sfx'].includes(k)) {
      Sound.setVolumes({ master: S.master, music: S.music, sfx: S.sfx });
      if (k === 'music') { if (S.music > 0) Sound.musicStart(); else Sound.musicStop(); }
    }
    if (k === 'minimap') $('#minimap').classList.toggle('hidden', !S.minimap);
  }));
  $('#btn-fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  });
  let resetArmed = 0;
  $('#btn-reset').addEventListener('click', e => {
    const b = e.currentTarget;
    if (Date.now() - resetArmed < 3000) {
      Store.resetRecords();
      b.classList.remove('confirm'); b.firstElementChild.textContent = 'Records cleared';
      resetArmed = 0;
      setTimeout(() => (b.firstElementChild.textContent = 'Reset Records'), 1800);
    } else {
      resetArmed = Date.now();
      b.classList.add('confirm'); b.firstElementChild.textContent = 'Tap again to confirm';
      setTimeout(() => { b.classList.remove('confirm'); if (resetArmed) b.firstElementChild.textContent = 'Reset Records'; }, 3000);
    }
  });

  // ---------------------------------------------------------- garage
  const gc = $('#garage-canvas'), gx = gc.getContext('2d');
  function cycleCar(d) { D.car = (D.car + d + CARS.length) % CARS.length; Store.save(); renderGarageInfo(); Sound.fx.click(); }
  $('#car-prev').addEventListener('click', () => cycleCar(-1));
  $('#car-next').addEventListener('click', () => cycleCar(1));

  function renderGarageInfo() {
    const car = CARS[D.car];
    $('#car-name').textContent = car.name;
    $('#car-desc').textContent = car.desc;
    const pct = (v, lo, hi) => Math.round(25 + 75 * (v - lo) / (hi - lo));
    $('#car-stats').innerHTML = [
      ['Top speed', pct(car.top, 0.9, 1.1)], ['Acceleration', pct(car.accel, 0.85, 1.2)], ['Handling', pct(car.handling, 0.85, 1.2)],
    ].map(([n, v]) => `<div class="stat"><span>${n}</span><div class="bar"><i style="width:${v}%"></i></div></div>`).join('');
    const sw = $('#swatches');
    if (!sw.children.length) {
      PAINTS.forEach((p, i) => {
        const b = document.createElement('button');
        b.className = 'swatch';
        b.style.background = p;
        b.setAttribute('aria-label', 'Paint ' + p);
        b.addEventListener('click', () => { D.color = i; Store.save(); renderGarageInfo(); });
        sw.appendChild(b);
      });
    }
    [...sw.children].forEach((b, i) => b.classList.toggle('on', i === D.color));
  }

  function startGarage() {
    renderGarageInfo();
    cancelAnimationFrame(garageRAF);
    const loop = t => {
      garageRAF = requestAnimationFrame(loop);
      const w = gc.width, h = gc.height;
      gx.clearRect(0, 0, w, h);
      const bg = gx.createRadialGradient(w / 2, h * 0.35, 20, w / 2, h * 0.5, w * 0.7);
      bg.addColorStop(0, '#2a2f45'); bg.addColorStop(0.6, '#121524'); bg.addColorStop(1, '#07080f');
      gx.fillStyle = bg; gx.fillRect(0, 0, w, h);
      // light beams
      gx.save(); gx.globalCompositeOperation = 'lighter';
      const beam = gx.createLinearGradient(0, 0, 0, h * 0.8);
      beam.addColorStop(0, 'rgba(255,255,255,0.12)'); beam.addColorStop(1, 'rgba(255,255,255,0)');
      gx.fillStyle = beam;
      gx.beginPath(); gx.moveTo(w * 0.42, 0); gx.lineTo(w * 0.58, 0); gx.lineTo(w * 0.85, h * 0.85); gx.lineTo(w * 0.15, h * 0.85); gx.fill();
      gx.restore();
      // floor
      const fy = h * 0.8;
      const fl = gx.createLinearGradient(0, fy, 0, h);
      fl.addColorStop(0, '#1b1f30'); fl.addColorStop(1, '#090a12');
      gx.fillStyle = fl; gx.fillRect(0, fy, w, h - fy);
      gx.strokeStyle = 'rgba(255,255,255,0.05)'; gx.lineWidth = 2;
      for (let i = -10; i <= 10; i++) { gx.beginPath(); gx.moveTo(w / 2 + i * 30, fy); gx.lineTo(w / 2 + i * 160, h); gx.stroke(); }
      const ring = gx.createRadialGradient(w / 2, fy, 10, w / 2, fy, w * 0.4);
      ring.addColorStop(0, 'rgba(255,90,60,0.35)'); ring.addColorStop(1, 'rgba(255,90,60,0)');
      gx.fillStyle = ring; gx.beginPath(); gx.ellipse(w / 2, fy, w * 0.42, h * 0.08, 0, 0, Math.PI * 2); gx.fill();
      const car = CARS[D.car], col = PAINTS[D.color];
      const sway = Math.sin(t / 900) * 0.35, cw = w * 0.62;
      // reflection
      gx.save(); gx.translate(0, fy * 2); gx.scale(1, -1); gx.globalAlpha = 0.18;
      Art.drawCar(gx, w / 2, fy, cw, col, { style: car.style, turn: sway });
      gx.restore();
      Art.drawCar(gx, w / 2, fy + 2, cw, col, { style: car.style, turn: sway, brake: (t / 1500) % 2 < 0.25 });
    };
    garageRAF = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------- pause
  function doPause() {
    if (current === 'results') return;
    if (Game.paused) { resume(); return; }
    if (Game.mode === 'finished') return;
    if (Game.pause()) show('pause');
  }
  function resume() { hideAll(); Game.resume(); }
  Game.on('pauseKey', () => {
    if (current === 'settings' && Game.paused) { show('pause'); return; }
    if (Game.inRace || Game.paused) doPause();
  });
  $('#btn-pause').addEventListener('click', doPause);
  $('#btn-resume').addEventListener('click', resume);
  $('#btn-restart').addEventListener('click', () => { hideAll(); Game.resume(); Game.restart(); });
  $('#btn-quit').addEventListener('click', toMenu);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (Game.inRace && !Game.paused) doPause(); Sound.suspend(true); }
    else Sound.suspend(false);
  });

  function toMenu() {
    document.body.classList.remove('racing');
    Game.resume();
    Game.startAttract();
    show('menu');
  }

  // ---------------------------------------------------------- results
  Game.on('results', r => {
    lastResults = r;
    const id = r.track.id;
    const rec = D.records[id] || {};
    let record = false;
    if (isFinite(r.bestLap) && (!rec.lap || r.bestLap < rec.lap)) { rec.lap = r.bestLap; record = true; }
    const rk = 'race' + r.laps;
    if (!rec[rk] || r.time < rec[rk]) { rec[rk] = r.time; record = true; }
    if (!rec.pos || r.position < rec.pos) rec.pos = r.position;
    D.records[id] = rec;
    D.stats.races++;
    if (r.position === 1) D.stats.wins++;
    if (r.position <= 3) D.stats.podiums++;
    Store.save();

    const suf = ['th', 'st', 'nd', 'rd'][r.position] || 'th';
    $('#res-pos').innerHTML = `${r.position}<sup>${suf}</sup>`;
    $('#res-track').textContent = `${r.track.name} · ${r.laps} lap${r.laps > 1 ? 's' : ''}`;
    $('#res-time').textContent = Game.fmt(r.time);
    $('#res-lap').textContent = Game.fmt(r.bestLap);
    $('#res-record').classList.toggle('hidden', !record);
    $('#res-list').innerHTML = r.list.map((x, i) => `<li class="${x.isPlayer ? 'me' : ''}">
      <span class="p">P${i + 1}</span><span class="dot" style="background:${x.color}"></span>
      <span>${x.name}</span><span class="t">${i === 0 ? Game.fmt(x.time) : '+' + (x.time - r.list[0].time).toFixed(2) + 's'}</span></li>`).join('');
    show('results');
  });
  $('#btn-again').addEventListener('click', () => { hideAll(); Game.startRace(selTrack); });
  $('#btn-next').addEventListener('click', () => {
    selTrack = (selTrack + 1) % TRACKS.length; D.track = selTrack; Store.save();
    hideAll(); Game.startRace(selTrack);
  });
  $('#btn-menu').addEventListener('click', toMenu);

  // ---------------------------------------------------------- PWA
  let deferredPrompt = null;
  addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); deferredPrompt = e;
    $('#btn-install').classList.remove('hidden');
  });
  $('#btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('#btn-install').classList.add('hidden');
  });
  addEventListener('appinstalled', () => $('#btn-install').classList.add('hidden'));
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err)));
  } else if (location.protocol === 'file:') {
    $('#offline-note').textContent = 'Serve over http(s) to enable install & offline mode';
  }

  // ---------------------------------------------------------- controller menus
  /* D-pad / left stick moves focus spatially, (A) selects, (B) goes back,
     LB/RB switch car or circuit, Start resumes / starts. While racing the
     game engine reads the pad itself, so this loop stays idle. */
  $$('.toggle').forEach(l => (l.tabIndex = 0));
  // track the highlighted element with a class (CSS :focus fails when the window itself isn't focused)
  document.addEventListener('focusin', e => {
    document.querySelectorAll('.pf').forEach(el => el.classList.remove('pf'));
    if (e.target.classList) e.target.classList.add('pf');
  });
  const pad = { prev: {}, held: null, next: 0 };
  const notice = $('#notice');
  let noticeTO = 0;
  function showNotice(msg) {
    notice.textContent = msg; notice.classList.add('show');
    clearTimeout(noticeTO); noticeTO = setTimeout(() => notice.classList.remove('show'), 2600);
  }
  function setPadMode(on) {
    if (on === document.body.classList.contains('pad')) return;
    document.body.classList.toggle('pad', on);
    if (on && current && !padFocusables().includes(document.activeElement)) focusFirst();
  }
  addEventListener('mousemove', e => { if (e.movementX || e.movementY) setPadMode(false); });
  addEventListener('pointerdown', () => setPadMode(false));
  addEventListener('gamepadconnected', e => {
    showNotice(`🎮 Controller connected${e.gamepad.id ? ' · ' + e.gamepad.id.split('(')[0].trim().slice(0, 40) : ''}`);
    setPadMode(true);
  });
  addEventListener('gamepaddisconnected', () => showNotice('Controller disconnected'));

  function padFocusables() {
    if (!current) return [];
    return $$(`#${current} button, #${current} input[type=range], #${current} .toggle`)
      .filter(el => el.offsetParent !== null && !el.disabled);
  }
  function focusFirst() {
    const els = padFocusables();
    const pick = current === 'tracks' ? $('.track-card.sel') : els.find(el => el.matches('.btn.primary')) || els[0];
    focusEl(pick);
  }
  function padMove(dx, dy) {
    const els = padFocusables();
    const cur = document.activeElement;
    if (!els.includes(cur)) { focusFirst(); return; }
    if (cur.type === 'range' && dx) {
      cur.value = Number(cur.value) + dx * Number(cur.step || 0.05);
      cur.dispatchEvent(new Event('input', { bubbles: true }));
      Sound.fx.hover();
      return;
    }
    const r = cur.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let best = null, bestScore = Infinity;
    for (const el of els) {
      if (el === cur) continue;
      const q = el.getBoundingClientRect(), ex = q.left + q.width / 2, ey = q.top + q.height / 2;
      const along = (ex - cx) * dx + (ey - cy) * dy;
      if (along <= 4) continue;
      const across = Math.abs(dx ? ey - cy : ex - cx);
      const score = along + across * 2.5;
      if (score < bestScore) { bestScore = score; best = el; }
    }
    if (best) { focusEl(best); best.scrollIntoView({ block: 'nearest' }); Sound.fx.hover(); }
    else if (current === 'garage' && dx) cycleCar(dx);
  }
  function padBack() {
    if (current === 'pause') { resume(); return; }
    if (current === 'menu' || current === 'results') return;
    $(`#${current} .back`)?.click();
  }
  function padLoop() {
    requestAnimationFrame(padLoop);
    const pads = navigator.getGamepads ? [...navigator.getGamepads()] : [];
    const gp = pads.find(p => p && p.connected);
    if (!gp) return;
    const b = i => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
    const st = {
      up: b(12) || ay < -0.55, down: b(13) || ay > 0.55, left: b(14) || ax < -0.55, right: b(15) || ax > 0.55,
      a: b(0), b: b(1), start: b(9), lb: b(4), rb: b(5),
    };
    const prev = pad.prev;
    pad.prev = st; // always track, so a Start press that paused the race doesn't instantly resume it
    const edge = k => st[k] && !prev[k];
    if (!current || (Game.inRace && !Game.paused)) { pad.held = null; return; }
    if (Object.keys(st).some(edge)) setPadMode(true);

    const now = performance.now();
    const dir = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]].find(([k]) => st[k]);
    if (!dir) pad.held = null;
    else if (pad.held !== dir[0]) { pad.held = dir[0]; pad.next = now + 380; padMove(dir[1], dir[2]); }
    else if (now >= pad.next) { pad.next = now + 110; padMove(dir[1], dir[2]); }

    if (edge('a')) {
      const el = document.activeElement;
      if (padFocusables().includes(el)) el.click(); else focusFirst();
    }
    if (edge('b')) padBack();
    if (edge('start')) {
      if (current === 'pause') resume();
      else if (current === 'tracks') startRace();
      else if (current === 'menu') show('tracks');
      else if (current === 'results') $('#btn-again').click();
    }
    if (edge('lb') || edge('rb')) {
      const d = edge('rb') ? 1 : -1;
      if (current === 'garage') cycleCar(d);
      else if (current === 'tracks') { selectTrack(selTrack + d); focusEl($('.track-card.sel')); Sound.fx.hover(); }
    }
  }
  requestAnimationFrame(padLoop);

  // ---------------------------------------------------------- boot
  Game.init();
  Game.startAttract();
  show('menu');
})();
