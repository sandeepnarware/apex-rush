'use strict';
/* Procedural art: every sprite, car and background is drawn in code so the
   game needs no image downloads and works fully offline. */
const Art = (() => {
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const TAU = Math.PI * 2;

  function rrect(ctx, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function hexRgb(h) {
    if (h.startsWith('rgb')) return h.match(/\d+/g).slice(0, 3).map(Number);
    h = h.replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexRgb(hex);
    const f = c => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function circle(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }

  /* ---------------------------------------------------------------- cars */
  /* Rear view of a car. Design space is 200 x 120, (cx, by) = bottom centre. */
  function drawCar(ctx, cx, by, w, color, o = {}) {
    const turn = o.turn || 0, style = o.style || 'gt', s = w / 200;
    ctx.save();
    ctx.translate(cx - w / 2, by - 120 * s);
    ctx.scale(s, s);

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(100, 113, 99, 8, 0, 0, TAU); ctx.fill();

    // tyres
    const tw = style === 'muscle' ? 38 : style === 'hatch' ? 30 : 34;
    const tx = turn * 3;
    ctx.fillStyle = '#0c0c0f';
    rrect(ctx, 9 + tx, 72, tw, 42, 7); ctx.fill();
    rrect(ctx, 191 - tw + tx, 72, tw, 42, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(13 + tx, 80 + i * 8, tw - 8, 2);
      ctx.fillRect(195 - tw + tx, 80 + i * 8, tw - 8, 2);
    }

    // lower body
    const top = style === 'super' ? 56 : style === 'hatch' ? 46 : style === 'muscle' ? 52 : 50;
    const g = ctx.createLinearGradient(0, top - 6, 0, 106);
    g.addColorStop(0, shade(color, 0.45));
    g.addColorStop(0.22, color);
    g.addColorStop(0.7, shade(color, -0.3));
    g.addColorStop(1, shade(color, -0.65));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(16, 104);
    ctx.lineTo(3, top + 24);
    ctx.quadraticCurveTo(3, top - 2, 26, top - 4);
    ctx.lineTo(174, top - 4);
    ctx.quadraticCurveTo(197, top - 2, 197, top + 24);
    ctx.lineTo(184, 104);
    ctx.closePath(); ctx.fill();

    // cabin
    const roofY = style === 'super' ? 28 : style === 'hatch' ? 10 : style === 'muscle' ? 20 : 17;
    const rx = turn * 9;
    const inset = style === 'super' ? 12 : 0;
    const cg = ctx.createLinearGradient(0, roofY, 0, top);
    cg.addColorStop(0, shade(color, 0.2));
    cg.addColorStop(1, shade(color, -0.4));
    ctx.fillStyle = cg;
    ctx.beginPath();
    ctx.moveTo(28 + inset, top - 2);
    ctx.lineTo(52 + inset + rx, roofY + 3);
    ctx.quadraticCurveTo(55 + inset + rx, roofY, 62 + inset + rx, roofY);
    ctx.lineTo(138 - inset + rx, roofY);
    ctx.quadraticCurveTo(145 - inset + rx, roofY, 148 - inset + rx, roofY + 3);
    ctx.lineTo(172 - inset, top - 2);
    ctx.closePath(); ctx.fill();

    // rear glass
    const gg = ctx.createLinearGradient(0, roofY + 4, 0, top - 6);
    gg.addColorStop(0, '#34465f'); gg.addColorStop(1, '#06080d');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.moveTo(40 + inset, top - 6);
    ctx.lineTo(60 + inset + rx, roofY + 5);
    ctx.lineTo(140 - inset + rx, roofY + 5);
    ctx.lineTo(160 - inset, top - 6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.beginPath();
    ctx.moveTo(68 + inset + rx, roofY + 5); ctx.lineTo(86 + inset + rx, roofY + 5);
    ctx.lineTo(72 + inset, top - 6); ctx.lineTo(54 + inset, top - 6);
    ctx.closePath(); ctx.fill();

    // body crease highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(26, top - 3); ctx.lineTo(174, top - 3); ctx.stroke();

    // tail lights
    const ly = top + 8;
    ctx.save();
    ctx.shadowColor = '#ff1f2e';
    ctx.shadowBlur = o.brake ? 26 : 10;
    ctx.fillStyle = o.brake ? '#ff3d4a' : '#b30d1a';
    if (style === 'super') {
      rrect(ctx, 8, ly, 184, 7, 3); ctx.fill();
    } else {
      rrect(ctx, 9, ly, 50, 11, 4); ctx.fill();
      rrect(ctx, 141, ly, 50, 11, 4); ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = o.brake ? '#ffe0e0' : '#ff5a66';
    if (style === 'super') { rrect(ctx, 14, ly + 2, 172, 2.5, 1); ctx.fill(); }
    else {
      rrect(ctx, 14, ly + 4, 40, 3, 1.5); ctx.fill();
      rrect(ctx, 146, ly + 4, 40, 3, 1.5); ctx.fill();
    }

    // number plate
    ctx.fillStyle = '#ececec';
    rrect(ctx, 81, ly + 15, 38, 12, 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(o.plate || 'APX-1', 100, ly + 21.5);

    // diffuser
    ctx.fillStyle = '#121419';
    rrect(ctx, 24, 90, 152, 14, 5); ctx.fill();
    ctx.strokeStyle = '#2a2d36'; ctx.lineWidth = 2;
    for (let x = 74; x <= 126; x += 13) { ctx.beginPath(); ctx.moveTo(x, 91); ctx.lineTo(x, 103); ctx.stroke(); }

    // exhausts
    for (const ex of [62, 138]) {
      ctx.fillStyle = '#545964'; circle(ctx, ex, 97, 6);
      ctx.fillStyle = '#08080a'; circle(ctx, ex, 97, 3.8);
    }
    if (style === 'muscle') {
      for (const ex of [48, 152]) {
        ctx.fillStyle = '#545964'; circle(ctx, ex, 97, 5);
        ctx.fillStyle = '#08080a'; circle(ctx, ex, 97, 3);
      }
    }

    // rear wing
    if (style === 'gt' || style === 'super') {
      const wy = style === 'super' ? top - 18 : top - 14;
      ctx.fillStyle = '#16171c';
      ctx.fillRect(54, wy + 4, 6, top - wy - 4);
      ctx.fillRect(140, wy + 4, 6, top - wy - 4);
      const wg = ctx.createLinearGradient(0, wy, 0, wy + 8);
      wg.addColorStop(0, shade(color, 0.1)); wg.addColorStop(1, shade(color, -0.6));
      ctx.fillStyle = wg;
      rrect(ctx, 6, wy, 188, 8, 3); ctx.fill();
      ctx.fillStyle = '#111'; ctx.fillRect(4, wy - 2, 6, 12); ctx.fillRect(190, wy - 2, 6, 12);
    } else if (style === 'hatch') {
      ctx.fillStyle = shade(color, -0.5);
      rrect(ctx, 56, roofY - 3, 88, 6, 3); ctx.fill();
    } else if (style === 'muscle') {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(86, top - 4, 9, 50); ctx.fillRect(105, top - 4, 9, 50);
      ctx.fillRect(86 + rx * 0.5, roofY, 9, top - roofY - 6); ctx.fillRect(105 + rx * 0.5, roofY, 9, top - roofY - 6);
    }
    ctx.restore();
  }
  // exhaust positions in design space (for nitro flames)
  const EXHAUSTS = [[62, 97], [138, 97]];

  const carCache = {};
  function carImage(color, style) {
    const k = color + style;
    if (carCache[k]) return carCache[k];
    const c = mk(240, 150);
    drawCar(c.getContext('2d'), 120, 148, 236, color, { style });
    return (carCache[k] = c);
  }

  /* ------------------------------------------------------------ scenery */
  function palm(seed) {
    const c = mk(440, 660), x = c.getContext('2d'), r = rng(seed);
    const bx = 220, by = 660, tx = 220 + (r() - 0.5) * 90, ty = 175;
    const bez = t => {
      const cx = bx - 30, cy = 400;
      return [(1 - t) * (1 - t) * bx + 2 * (1 - t) * t * cx + t * t * tx,
        (1 - t) * (1 - t) * by + 2 * (1 - t) * t * cy + t * t * ty];
    };
    const n = 16;
    for (let i = 0; i < n; i++) {
      const [x0, y0] = bez(i / n), [x1, y1] = bez((i + 1) / n);
      const w0 = 30 - 14 * (i / n), w1 = 30 - 14 * ((i + 1) / n);
      x.fillStyle = i % 2 ? '#8a6a45' : '#7a5b39';
      x.beginPath();
      x.moveTo(x0 - w0 / 2, y0); x.lineTo(x0 + w0 / 2, y0);
      x.lineTo(x1 + w1 / 2, y1 + 2); x.lineTo(x1 - w1 / 2, y1 + 2);
      x.closePath(); x.fill();
      x.fillStyle = 'rgba(0,0,0,0.18)';
      x.beginPath();
      x.moveTo(x0 + w0 * 0.1, y0); x.lineTo(x0 + w0 / 2, y0);
      x.lineTo(x1 + w1 / 2, y1 + 2); x.lineTo(x1 + w1 * 0.1, y1 + 2);
      x.closePath(); x.fill();
    }
    const leaves = 9;
    for (let k = 0; k < leaves; k++) {
      const ang = -Math.PI + (k / (leaves - 1)) * Math.PI + (r() - 0.5) * 0.35;
      const len = 150 + r() * 45;
      const ex = tx + Math.cos(ang) * len, ey = ty + Math.sin(ang) * len * 0.45 + len * 0.45;
      const cx = tx + Math.cos(ang) * len * 0.55, cy = ty + Math.sin(ang) * len * 0.5 - 30;
      const lg = x.createLinearGradient(tx, ty - 60, ex, ey);
      lg.addColorStop(0, '#2f8a3a'); lg.addColorStop(1, k % 2 ? '#6cc36a' : '#4caf50');
      x.fillStyle = lg;
      x.beginPath();
      x.moveTo(tx, ty);
      x.quadraticCurveTo(cx, cy - 18, ex, ey);
      x.quadraticCurveTo(cx, cy + 16, tx, ty + 6);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(20,70,25,0.6)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(tx, ty + 2); x.quadraticCurveTo(cx, cy, ex, ey); x.stroke();
    }
    x.fillStyle = '#5b3d22';
    circle(x, tx - 9, ty + 12, 9); circle(x, tx + 8, ty + 14, 9); circle(x, tx, ty + 22, 8);
    return c;
  }

  function pine(snow, seed) {
    const c = mk(320, 580), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = 'rgba(0,0,0,0.18)';
    x.beginPath(); x.ellipse(160, 574, 110, 6, 0, 0, TAU); x.fill();
    x.fillStyle = '#5a3d2b'; x.fillRect(148, 470, 24, 108);
    const layers = 5;
    for (let i = 0; i < layers; i++) {
      const yTop = 30 + i * 84, yBot = yTop + 150, hw = 42 + i * 26 + r() * 8;
      const g = x.createLinearGradient(160 - hw, 0, 160 + hw, 0);
      g.addColorStop(0, '#13402c'); g.addColorStop(0.55, '#1f5c3d'); g.addColorStop(1, '#2f7a52');
      x.fillStyle = g;
      x.beginPath(); x.moveTo(160, yTop);
      x.lineTo(160 + hw, yBot);
      const teeth = 6;
      for (let t = teeth; t >= 0; t--) {
        const px = 160 - hw + (2 * hw * t) / teeth;
        x.lineTo(px, yBot - (t % 2 ? 0 : 12));
      }
      x.closePath(); x.fill();
      if (snow) {
        x.fillStyle = '#f5f9fc';
        const sy = yTop + 150 * 0.42, shw = hw * 0.42;
        x.beginPath(); x.moveTo(160, yTop - 2);
        x.lineTo(160 + shw, sy);
        for (let t = 5; t >= 0; t--) x.lineTo(160 - shw + (2 * shw * t) / 5, sy - (t % 2 ? 10 : 0));
        x.closePath(); x.fill();
        x.fillStyle = 'rgba(245,249,252,0.85)';
        x.fillRect(160 - hw * 0.8, yBot - 8, hw * 0.5, 5);
        x.fillRect(160 + hw * 0.25, yBot - 6, hw * 0.45, 5);
      }
    }
    return c;
  }

  function cactus() {
    const c = mk(240, 380), x = c.getContext('2d');
    x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(120, 374, 70, 6, 0, 0, TAU); x.fill();
    const g = x.createLinearGradient(80, 0, 160, 0);
    g.addColorStop(0, '#2e6b33'); g.addColorStop(0.5, '#4f9a49'); g.addColorStop(1, '#2a5e2e');
    x.fillStyle = g;
    rrect(x, 95, 30, 50, 346, 25); x.fill();
    rrect(x, 30, 150, 36, 120, 18); x.fill();
    rrect(x, 30, 236, 80, 32, 16); x.fill();
    rrect(x, 176, 110, 36, 110, 18); x.fill();
    rrect(x, 130, 188, 82, 30, 15); x.fill();
    x.strokeStyle = 'rgba(15,50,20,0.5)'; x.lineWidth = 2;
    for (const px of [108, 120, 132]) { x.beginPath(); x.moveTo(px, 40); x.lineTo(px, 370); x.stroke(); }
    x.fillStyle = '#ff5c8a'; circle(x, 120, 34, 7);
    return c;
  }

  function rock(seed, base) {
    const c = mk(300, 200), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(150, 192, 140, 8, 0, 0, TAU); x.fill();
    const pts = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (i / n) * Math.PI;
      const rad = 0.75 + r() * 0.25;
      pts.push([150 + Math.cos(a) * 140 * rad, 192 + Math.sin(a) * 170 * rad]);
    }
    const g = x.createLinearGradient(0, 20, 0, 195);
    g.addColorStop(0, shade(base, 0.25)); g.addColorStop(1, shade(base, -0.45));
    x.fillStyle = g;
    x.beginPath(); x.moveTo(pts[0][0], 192);
    pts.forEach(p => x.lineTo(p[0], p[1]));
    x.lineTo(pts[n][0], 192); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.18)'; x.lineWidth = 3;
    for (let i = 2; i < n - 1; i += 2) {
      x.beginPath(); x.moveTo(pts[i][0], pts[i][1]); x.lineTo(150 + (pts[i][0] - 150) * 0.3, 190); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,0.12)';
    x.beginPath(); x.moveTo(pts[2][0], pts[2][1]); x.lineTo(pts[3][0], pts[3][1]); x.lineTo(pts[4][0], pts[4][1]);
    x.lineTo(150, 110); x.closePath(); x.fill();
    return c;
  }

  function bush(seed) {
    const c = mk(280, 170), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = 'rgba(0,0,0,0.2)'; x.beginPath(); x.ellipse(140, 164, 125, 6, 0, 0, TAU); x.fill();
    for (let i = 0; i < 14; i++) {
      const px = 40 + r() * 200, py = 70 + r() * 70, rad = 30 + r() * 30;
      const g = x.createRadialGradient(px - rad * 0.3, py - rad * 0.4, 2, px, py, rad);
      g.addColorStop(0, '#7ccf6e'); g.addColorStop(1, '#2d7a32');
      x.fillStyle = g; circle(x, px, Math.min(py, 165 - rad), rad);
    }
    for (let i = 0; i < 6; i++) { x.fillStyle = '#ff7bb0'; circle(x, 50 + r() * 180, 50 + r() * 70, 4); }
    return c;
  }

  function building(seed) {
    const c = mk(360, 900), x = c.getContext('2d'), r = rng(seed);
    const hues = [['#1b1f3a', '#2c2455'], ['#1e2a38', '#14202c'], ['#2a1838', '#1a1026'], ['#20263a', '#111522']];
    const [c1, c2] = hues[Math.floor(r() * hues.length)];
    const top = 40 + r() * 160;
    const g = x.createLinearGradient(0, 0, 360, 0);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    x.fillStyle = g; x.fillRect(10, top, 340, 900 - top);
    x.fillStyle = 'rgba(255,255,255,0.05)'; x.fillRect(10, top, 340, 8);
    const cols = 7, rows = Math.floor((900 - top - 40) / 34);
    const warm = r() > 0.5;
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const v = r();
      if (v < 0.42) continue;
      x.fillStyle = v > 0.9 ? 'rgba(255,255,255,0.85)'
        : warm ? `rgba(255,${190 + Math.floor(r() * 50)},120,${0.45 + r() * 0.4})`
          : `rgba(120,${210 + Math.floor(r() * 40)},255,${0.4 + r() * 0.4})`;
      x.fillRect(28 + j * 46, top + 26 + i * 34, 28, 18);
    }
    if (r() > 0.4) { // neon stripe
      const nc = ['#ff2bd6', '#2bf3ff', '#ffd84d', '#7cff6b'][Math.floor(r() * 4)];
      x.save(); x.shadowColor = nc; x.shadowBlur = 25; x.fillStyle = nc;
      x.fillRect(r() > 0.5 ? 14 : 340, top + 30, 6, 900 - top - 60);
      x.fillRect(10, top - 2, 340, 4);
      x.restore();
    }
    x.fillStyle = '#0b0b14'; x.fillRect(170, top - 60, 4, 60);
    x.fillStyle = '#ff3040'; circle(x, 172, top - 62, 5);
    return c;
  }

  function lamp(side) {
    const c = mk(240, 720), x = c.getContext('2d');
    const px = side === 'L' ? 30 : 210, hx = side === 'L' ? 200 : 40;
    const glow = x.createRadialGradient(hx, 120, 4, hx, 160, 160);
    glow.addColorStop(0, 'rgba(255,240,200,0.75)'); glow.addColorStop(1, 'rgba(255,200,120,0)');
    x.fillStyle = glow; x.fillRect(0, 60, 240, 300);
    x.strokeStyle = '#3a3d4a'; x.lineWidth = 12; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px, 716); x.lineTo(px, 120);
    x.quadraticCurveTo(px, 90, (px + hx) / 2, 92); x.lineTo(hx, 100); x.stroke();
    x.fillStyle = '#2a2c36'; rrect(x, hx - 34, 94, 68, 18, 8); x.fill();
    x.save(); x.shadowColor = '#fff2c4'; x.shadowBlur = 30; x.fillStyle = '#fff8e0';
    rrect(x, hx - 26, 108, 52, 7, 3); x.fill(); x.restore();
    return c;
  }

  function billboard(title, sub, c1, c2, neon) {
    const c = mk(560, 360), x = c.getContext('2d');
    x.fillStyle = '#2b2d33';
    x.fillRect(130, 220, 18, 140); x.fillRect(412, 220, 18, 140);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(280, 354, 220, 6, 0, 0, TAU); x.fill();
    const g = x.createLinearGradient(0, 10, 560, 230);
    g.addColorStop(0, c1); g.addColorStop(1, c2);
    if (neon) {
      x.fillStyle = '#0b0820'; rrect(x, 14, 14, 532, 212, 18); x.fill();
      x.save(); x.shadowColor = c1; x.shadowBlur = 30; x.strokeStyle = c1; x.lineWidth = 7;
      rrect(x, 22, 22, 516, 196, 14); x.stroke(); x.restore();
      x.save(); x.shadowColor = c2; x.shadowBlur = 24; x.fillStyle = '#fff';
      x.font = 'italic 900 92px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(title, 280, 108); x.restore();
      x.fillStyle = c2; x.font = 'bold 28px system-ui, sans-serif'; x.textAlign = 'center';
      x.fillText(sub, 280, 180);
    } else {
      x.fillStyle = '#f4f4f4'; rrect(x, 8, 8, 544, 224, 14); x.fill();
      x.fillStyle = g; rrect(x, 18, 18, 524, 204, 10); x.fill();
      x.fillStyle = 'rgba(255,255,255,0.12)';
      x.beginPath(); x.moveTo(18, 222); x.lineTo(240, 18); x.lineTo(330, 18); x.lineTo(108, 222); x.fill();
      x.fillStyle = '#fff'; x.font = 'italic 900 96px system-ui, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowOffsetY = 4; x.shadowBlur = 6;
      x.fillText(title, 280, 106);
      x.shadowColor = 'transparent';
      x.font = 'bold 28px system-ui, sans-serif'; x.fillText(sub, 280, 182);
    }
    return c;
  }

  function chevron(dir) {
    const c = mk(200, 280), x = c.getContext('2d');
    x.fillStyle = '#3a3a3a'; x.fillRect(94, 120, 12, 160);
    x.fillStyle = '#111'; rrect(x, 4, 4, 192, 130, 10); x.fill();
    x.fillStyle = '#ffcc00'; rrect(x, 12, 12, 176, 114, 6); x.fill();
    x.fillStyle = '#111';
    for (let i = 0; i < 2; i++) {
      const ox = 40 + i * 62;
      x.beginPath();
      if (dir > 0) { x.moveTo(ox, 24); x.lineTo(ox + 26, 24); x.lineTo(ox + 60, 69); x.lineTo(ox + 26, 114); x.lineTo(ox, 114); x.lineTo(ox + 34, 69); }
      else { x.moveTo(ox + 60, 24); x.lineTo(ox + 34, 24); x.lineTo(ox, 69); x.lineTo(ox + 34, 114); x.lineTo(ox + 60, 114); x.lineTo(ox + 26, 69); }
      x.closePath(); x.fill();
    }
    return c;
  }

  function gantry() {
    const c = mk(1400, 560), x = c.getContext('2d');
    const metal = x.createLinearGradient(0, 0, 80, 0);
    metal.addColorStop(0, '#4a4f5a'); metal.addColorStop(0.5, '#9aa1ad'); metal.addColorStop(1, '#3c4049');
    for (const px of [30, 1290]) {
      x.save(); x.translate(px, 0); x.fillStyle = metal; x.fillRect(0, 60, 80, 500); x.restore();
    }
    x.fillStyle = '#111318'; rrect(x, 0, 30, 1400, 170, 10); x.fill();
    const sq = 20;
    for (let i = 0; i < 1400 / sq; i++) for (let j = 0; j < 2; j++) {
      x.fillStyle = (i + j) % 2 ? '#111' : '#f2f2f2';
      x.fillRect(i * sq, 34 + j * sq, sq, sq);
      x.fillStyle = (i + j + 1) % 2 ? '#111' : '#f2f2f2';
      x.fillRect(i * sq, 156 + j * sq, sq, sq);
    }
    const tg = x.createLinearGradient(0, 74, 0, 156);
    tg.addColorStop(0, '#ff3b3b'); tg.addColorStop(1, '#c4001a');
    x.fillStyle = tg; x.fillRect(0, 74, 1400, 82);
    x.fillStyle = '#fff'; x.font = 'italic 900 64px system-ui, sans-serif';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('START  ◆  FINISH', 700, 117);
    return c;
  }

  let spriteSet = null;
  function sprites(ROAD_W) {
    if (spriteSet) return spriteSet;
    const S = {};
    const add = (key, img, w, hit = 0, hitX = 0.5, center = false) => { S[key] = { img, w, hit, hitX, center }; };
    add('palm', palm(11), 1500, 0.08);
    add('palm2', palm(29), 1500, 0.08);
    add('pine', pine(false, 4), 1150, 0.18);
    add('pine_snow', pine(true, 8), 1150, 0.18);
    add('cactus', cactus(), 700, 0.35);
    add('rock', rock(5, '#b5703e'), 1200, 0.7);
    add('rock_grey', rock(13, '#8a8f99'), 1200, 0.7);
    add('bush', bush(3), 950, 0.4);
    for (let i = 0; i < 4; i++) add('bld' + i, building(100 + i * 7), 2600, 0.95);
    add('lampL', lamp('L'), 760, 0.06, 30 / 240);
    add('lampR', lamp('R'), 760, 0.06, 210 / 240);
    add('bb_apex', billboard('APEX', 'RUSH  •  RACING LEAGUE', '#ff3b3b', '#ff9f1c'), 2300, 0.75);
    add('bb_turbo', billboard('TURBO', 'FUEL  •  OIL  •  SPEED', '#1e3cff', '#00c2ff'), 2300, 0.75);
    add('bb_surf', billboard('SURF', 'NEXT EXIT 2 KM', '#00a884', '#45d0ff'), 2300, 0.75);
    add('bb_nitro', billboard('NITRO', 'FEEL THE BOOST', '#8e2de2', '#ff2e88'), 2300, 0.75);
    add('bb_alps', billboard('SUMMIT', 'SKI RESORT  •  12 KM', '#2a6fdb', '#7fd1ff'), 2300, 0.75);
    add('bb_neon1', billboard('NEON', 'OPEN ALL NIGHT', '#ff2bd6', '#2bf3ff', true), 2300, 0.75);
    add('bb_neon2', billboard('APEX', 'NIGHT RACING', '#2bf3ff', '#ffd84d', true), 2300, 0.75);
    add('bb_neon3', billboard('DRIFT', 'CLUB  •  24/7', '#7cff6b', '#ff2bd6', true), 2300, 0.75);
    add('chevR', chevron(1), 520, 0.15);
    add('chevL', chevron(-1), 520, 0.15);
    add('gantry', gantry(), ROAD_W * 2.75, 0, 0.5, true);
    return (spriteSet = S);
  }

  /* -------------------------------------------------------- backgrounds */
  function ridgeFn(seed, terms, ampBase) {
    const r = rng(seed);
    const comps = terms.map((f, i) => ({ f, a: ampBase / (i + 1) ** 0.9 * (0.6 + r() * 0.6), p: r() * TAU }));
    return t => comps.reduce((s, c) => s + c.a * Math.sin(c.f * t * TAU + c.p), 0);
  }

  function mountains(def) {
    const w = 2048, h = 512, c = mk(w, h), x = c.getContext('2d');
    const f = ridgeFn(def.seed, [1, 2, 3, 5, 7, 11, 17], 0.16);
    const ys = [];
    for (let i = 0; i <= w; i += 4) ys.push(h * (0.48 + f(i / w)));
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, def.top); g.addColorStop(1, def.bottom);
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, h);
    ys.forEach((y, i) => x.lineTo(i * 4, y));
    x.lineTo(w, h); x.closePath(); x.fill();
    const snowLine = h * 0.36;
    for (let i = 0; i < ys.length - 1; i++) {
      const slope = ys[i + 1] - ys[i];
      x.fillStyle = slope > 0 ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)';
      x.fillRect(i * 4, ys[i], 4, h - ys[i]);
      if (def.snow && ys[i] < snowLine) {
        x.fillStyle = slope > 0 ? 'rgba(220,232,245,0.95)' : 'rgba(255,255,255,0.97)';
        x.fillRect(i * 4, ys[i], 4, (snowLine - ys[i]) * 0.85 + 3);
      }
    }
    return c;
  }

  function hills(def, kind) {
    const w = 2048, h = 360, c = mk(w, h), x = c.getContext('2d'), r = rng(def.seed);
    const f = ridgeFn(def.seed, kind === 'dunes' ? [1, 2, 3, 4] : [1, 3, 4, 6, 9], 0.14);
    const ys = [];
    for (let i = 0; i <= w; i += 4) ys.push(h * (0.5 + f(i / w)));
    const g = x.createLinearGradient(0, h * 0.2, 0, h);
    g.addColorStop(0, def.top); g.addColorStop(1, def.bottom);
    x.fillStyle = g;
    x.beginPath(); x.moveTo(0, h);
    ys.forEach((y, i) => x.lineTo(i * 4, y));
    x.lineTo(w, h); x.closePath(); x.fill();
    if (kind === 'dunes') {
      for (let i = 0; i < ys.length - 1; i++) {
        const slope = ys[i + 1] - ys[i];
        x.fillStyle = slope > 0 ? 'rgba(90,30,20,0.22)' : 'rgba(255,230,180,0.10)';
        x.fillRect(i * 4, ys[i], 4, h - ys[i]);
      }
      const f2 = ridgeFn(def.seed + 3, [2, 3, 5], 0.08);
      x.fillStyle = shade(def.bottom, -0.08);
      x.beginPath(); x.moveTo(0, h);
      for (let i = 0; i <= w; i += 4) x.lineTo(i, h * (0.78 + f2(i / w)));
      x.lineTo(w, h); x.closePath(); x.fill();
    } else if (kind === 'forest') {
      for (let i = 0; i < 520; i++) {
        const t = r(), px = t * w, base = h * (0.5 + f(t)) + r() * 40;
        const th = 26 + r() * 40, tw = th * 0.45;
        x.fillStyle = r() > 0.5 ? '#1b3f30' : '#244d3b';
        x.beginPath(); x.moveTo(px, base - th); x.lineTo(px + tw, base + 6); x.lineTo(px - tw, base + 6); x.closePath(); x.fill();
        if (px < tw) { x.beginPath(); x.moveTo(px + w, base - th); x.lineTo(px + w + tw, base + 6); x.lineTo(px + w - tw, base + 6); x.fill(); }
        if (px > w - tw) { x.beginPath(); x.moveTo(px - w, base - th); x.lineTo(px - w + tw, base + 6); x.lineTo(px - w - tw, base + 6); x.fill(); }
      }
    } else {
      for (let i = 0; i < 160; i++) {
        const t = r(), px = t * w, py = h * (0.5 + f(t)) + 4 + r() * 60, rad = 6 + r() * 12;
        x.fillStyle = r() > 0.5 ? 'rgba(30,90,40,0.8)' : 'rgba(50,120,55,0.8)';
        circle(x, px, py, rad);
      }
    }
    return c;
  }

  function skyline(def) {
    const w = 2048, h = 512, c = mk(w, h), x = c.getContext('2d'), r = rng(def.seed);
    const blds = [];
    let px = 0;
    while (px < w) {
      const bw = 50 + r() * 110, bh = (def.tall ? 0.35 : 0.2) * h + r() * h * (def.tall ? 0.5 : 0.55);
      blds.push([px, bw, bh]); px += bw + r() * 6;
    }
    for (const [bx, bw, bh] of blds) {
      for (const off of [0, -w]) {
        x.fillStyle = def.color;
        x.fillRect(bx + off, h - bh, bw, bh);
        x.fillStyle = 'rgba(255,255,255,0.03)'; x.fillRect(bx + off, h - bh, 3, bh);
        const rr2 = rng(Math.floor(bx * 13 + bw));
        for (let yy = h - bh + 10; yy < h - 6; yy += 12) for (let xx = bx + 6; xx < bx + bw - 6; xx += 10) {
          if (rr2() > 0.62) { x.fillStyle = def.windows; x.fillRect(xx + off, yy, 4, 5); }
        }
        if (bh > h * 0.55 && rr2() > 0.5) {
          x.fillStyle = def.color; x.fillRect(bx + off + bw / 2 - 2, h - bh - 40, 4, 40);
          x.fillStyle = '#ff3a4a'; circle(x, bx + off + bw / 2, h - bh - 42, 3);
        }
      }
    }
    return c;
  }

  function clouds(seed) {
    const w = 2048, h = 360, c = mk(w, h), x = c.getContext('2d'), r = rng(seed);
    for (let k = 0; k < 9; k++) {
      const cx = r() * w, cy = 60 + r() * 220, sc = 0.6 + r() * 0.9;
      for (const off of [0, -w, w]) {
        for (let i = 0; i < 9; i++) {
          const px = cx + off + (r() - 0.5) * 220 * sc, py = cy + (r() - 0.5) * 30 * sc, rad = (30 + r() * 40) * sc;
          const g = x.createRadialGradient(px, py - rad * 0.4, rad * 0.2, px, py, rad);
          g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.7, 'rgba(240,246,252,0.6)'); g.addColorStop(1, 'rgba(240,246,252,0)');
          x.fillStyle = g; circle(x, px, py, rad);
        }
      }
    }
    return c;
  }

  const themeCache = {};
  function theme(key) {
    if (themeCache[key]) return themeCache[key];
    const T = THEMES[key];
    const layer = def => def.type === 'mountains' ? mountains(def)
      : def.type === 'skyline' ? skyline(def) : hills(def, def.type);
    const layers = [];
    if (T.clouds) layers.push({ img: clouds(key.length * 7), speed: 0.0008, drift: 0.004, bottom: 0.42, h: 0.3 });
    layers.push({ img: layer(T.far), speed: 0.0015, bottom: 0.56, h: T.far.type === 'skyline' ? 0.32 : 0.34 });
    layers.push({ img: layer(T.near), speed: 0.003, bottom: 0.585, h: T.near.type === 'skyline' ? 0.36 : 0.2 });
    return (themeCache[key] = { layers });
  }

  return { drawCar, carImage, sprites, theme, shade, rrect, rng, EXHAUSTS };
})();
