'use strict';
/* All audio is synthesised with the Web Audio API: engine, tyres, wind,
   effects and a procedural synthwave soundtrack. No audio files needed. */
const Sound = (() => {
  let ac = null, master, sfxBus, musicBus, noiseBuf;
  let eng = null, skidG = null, windG = null;
  const vol = { master: 0.8, music: 0.5, sfx: 0.9 };
  let musicTimer = null, musicStep = 0, nextNote = 0, musicPlaying = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ac.createGain(); master.connect(comp); comp.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    applyVolumes();
    buildEngine();
    buildLoops();
  }

  function setVolumes(v) { Object.assign(vol, v); applyVolumes(); }
  function applyVolumes() {
    if (!ac) return;
    const t = ac.currentTime;
    master.gain.setTargetAtTime(vol.master, t, 0.05);
    sfxBus.gain.setTargetAtTime(vol.sfx, t, 0.05);
    musicBus.gain.setTargetAtTime(vol.music * 0.55, t, 0.05);
  }

  function distCurve(k) {
    const n = 1024, c = new Float32Array(n);
    for (let i = 0; i < n; i++) { const x = (i * 2) / n - 1; c[i] = ((1 + k) * x) / (1 + k * Math.abs(x)); }
    return c;
  }

  function buildEngine() {
    const o1 = ac.createOscillator(); o1.type = 'sawtooth';
    const o2 = ac.createOscillator(); o2.type = 'square';
    const o3 = ac.createOscillator(); o3.type = 'sine';
    const m1 = ac.createGain(); m1.gain.value = 0.5;
    const m2 = ac.createGain(); m2.gain.value = 0.22;
    const m3 = ac.createGain(); m3.gain.value = 0.6;
    const shaper = ac.createWaveShaper(); shaper.curve = distCurve(6);
    const filt = ac.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 600; filt.Q.value = 3;
    const g = ac.createGain(); g.gain.value = 0;
    o1.connect(m1); o2.connect(m2); o3.connect(m3);
    m1.connect(shaper); m2.connect(shaper); m3.connect(shaper);
    shaper.connect(filt); filt.connect(g); g.connect(sfxBus);
    [o1, o2, o3].forEach(o => o.start());
    eng = { o1, o2, o3, filt, g };
  }

  function noiseSrc() { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s; }

  function buildLoops() {
    const n1 = noiseSrc(), bp = ac.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 2.5;
    skidG = ac.createGain(); skidG.gain.value = 0;
    n1.connect(bp); bp.connect(skidG); skidG.connect(sfxBus); n1.start();
    const n2 = noiseSrc(), lp = ac.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420;
    windG = ac.createGain(); windG.gain.value = 0;
    n2.connect(lp); lp.connect(windG); windG.connect(sfxBus); n2.start();
  }

  /* rpm 0..1, load 0..1 */
  function engine(rpm, load, on) {
    if (!ac || !eng) return;
    const t = ac.currentTime;
    const f = 34 + rpm * 120;
    eng.o1.frequency.setTargetAtTime(f, t, 0.03);
    eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.03);
    eng.o3.frequency.setTargetAtTime(f * 0.25, t, 0.03);
    eng.filt.frequency.setTargetAtTime(260 + rpm * 1700 + load * 700, t, 0.05);
    eng.g.gain.setTargetAtTime(on ? 0.045 + load * 0.05 + rpm * 0.02 : 0, t, 0.06);
  }
  function skid(a) { if (skidG) skidG.gain.setTargetAtTime(Math.min(1, a) * 0.16, ac.currentTime, 0.05); }
  function wind(a) { if (windG) windG.gain.setTargetAtTime(Math.min(1.3, a) * 0.11, ac.currentTime, 0.1); }
  function silence() { engine(0, 0, false); skid(0); wind(0); }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(freq, dur, type = 'square', peak = 0.15, bus = sfxBus, when = 0, slideTo = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, 0.005, peak, dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseHit(dur, filterType, freq, peak, when = 0, bus = sfxBus, slideTo = 0) {
    if (!ac) return;
    const t = ac.currentTime + when;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = filterType; f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ac.createGain(); env(g, t, 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(bus);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  const fx = {
    click() { tone(1400, 0.05, 'triangle', 0.07); },
    hover() { tone(900, 0.03, 'triangle', 0.03); },
    beep(hi) { tone(hi ? 880 : 440, hi ? 0.6 : 0.25, 'square', 0.12); },
    crash(i = 1) {
      noiseHit(0.5, 'lowpass', 1400, 0.6 * i, 0, sfxBus, 200);
      tone(90, 0.35, 'sine', 0.5 * i, sfxBus, 0, 35);
    },
    bump(i = 0.5) { noiseHit(0.18, 'lowpass', 900, 0.35 * i); tone(120, 0.15, 'sine', 0.3 * i, sfxBus, 0, 60); },
    nitro() { noiseHit(0.7, 'bandpass', 300, 0.35, 0, sfxBus, 3200); },
    lap() { tone(660, 0.15, 'triangle', 0.15); tone(990, 0.3, 'triangle', 0.15, sfxBus, 0.12); },
    finish() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.15, sfxBus, i * 0.12)); },
    overtake() { tone(740, 0.08, 'sine', 0.08); tone(988, 0.12, 'sine', 0.08, sfxBus, 0.07); },
  };

  /* ---------------------------------------------------------- music */
  const BPM = 112, STEP = 60 / BPM / 4;
  const prog = [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']]; // Am F C G
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  let delayIn = null;

  function musicChain() {
    if (delayIn) return;
    delayIn = ac.createGain(); delayIn.gain.value = 1;
    const dl = ac.createDelay(1); dl.delayTime.value = STEP * 3;
    const fb = ac.createGain(); fb.gain.value = 0.35;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
    delayIn.connect(musicBus); delayIn.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(musicBus);
  }

  function voice(freq, t, dur, type, peak, cutoff, dest) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = type; o.frequency.value = freq;
    f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.3), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function kick(t) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.15);
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.35);
  }
  function snare(t) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ac.createGain(); g.gain.setValueAtTime(0.4, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    s.connect(f); f.connect(g); g.connect(delayIn); s.start(t, Math.random()); s.stop(t + 0.25);
  }
  function hat(t, open) {
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ac.createGain(); g.gain.setValueAtTime(open ? 0.12 : 0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + (open ? 0.18 : 0.05));
    s.connect(f); f.connect(g); g.connect(musicBus); s.start(t, Math.random()); s.stop(t + 0.2);
  }

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 16) % 4, s = step % 16;
    const [root, q] = prog[bar];
    const iv = q === 'm' ? [0, 3, 7, 12] : [0, 4, 7, 12];
    const section = Math.floor(step / 64) % 4; // vary intensity
    if (s % 4 === 0) kick(t);
    if (s === 4 || s === 12) snare(t);
    if (s % 2 === 1 || section > 1) hat(t, s % 4 === 2);
    if (s % 2 === 0) voice(midi(root + (s % 8 === 6 ? 12 : 0)), t, STEP * 1.8, 'sawtooth', 0.22, 700, musicBus);
    if (section !== 0) {
      const arp = [0, 1, 2, 3, 2, 1, 2, 3];
      voice(midi(root + 24 + iv[arp[s % 8]]), t, STEP * 0.9, 'square', 0.06, 2600, delayIn);
    }
    if (s === 0) iv.slice(0, 3).forEach(i => voice(midi(root + 12 + i), t, STEP * 15, 'triangle', 0.05, 1800, musicBus));
  }

  function tick() {
    while (nextNote < ac.currentTime + 0.12) {
      scheduleStep(musicStep, nextNote);
      musicStep++; nextNote += STEP;
    }
  }
  function musicStart() {
    if (!ac || musicPlaying) return;
    musicChain();
    musicPlaying = true;
    nextNote = ac.currentTime + 0.1;
    musicTimer = setInterval(tick, 25);
  }
  function musicStop() {
    musicPlaying = false;
    if (musicTimer) clearInterval(musicTimer);
    musicTimer = null;
  }
  function suspend(b) { if (!ac) return; if (b) ac.suspend(); else ac.resume(); }

  return { init, setVolumes, engine, skid, wind, silence, fx, musicStart, musicStop, suspend,
    get ready() { return !!ac; }, get musicPlaying() { return musicPlaying; } };
})();
