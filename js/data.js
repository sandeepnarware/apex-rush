'use strict';
/* Game content: cars, paints, visual themes and track layouts. */

const CARS = [
  { id: 'vortex', name: 'Vortex GT', style: 'gt', top: 1.00, accel: 1.00, handling: 1.00,
    desc: 'Balanced grand tourer. Forgiving and quick everywhere.' },
  { id: 'raptor', name: 'Raptor RS', style: 'super', top: 1.07, accel: 0.93, handling: 0.94,
    desc: 'Mid-engine hypercar. Highest top speed, demands precision.' },
  { id: 'kestrel', name: 'Kestrel S', style: 'hatch', top: 0.95, accel: 1.06, handling: 1.16,
    desc: 'Featherweight hot hatch. Carves corners like a blade.' },
  { id: 'titan', name: 'Titan V8', style: 'muscle', top: 1.01, accel: 1.16, handling: 0.88,
    desc: 'Big-block muscle. Brutal launch, heavy in the bends.' },
];

const PAINTS = ['#e10600', '#ff7a00', '#ffcc00', '#16c172', '#00b4d8', '#2f54ff',
  '#8e44ff', '#ff2e88', '#f2f2f2', '#22242a'];

const RIVALS = ['Nova', 'Blaze', 'Viper', 'Ghost', 'Rogue', 'Comet', 'Falcon', 'Onyx',
  'Jett', 'Raven', 'Storm', 'Kai', 'Zephyr', 'Axel'];

const THEMES = {
  coastal: {
    sky: [[0, '#1460c4'], [0.55, '#6ab8f0'], [1, '#ffe2b8']],
    sun: { x: 0.72, y: 0.16, r: 0.045, color: '#fffbea', glow: 'rgba(255,248,220,0.6)' },
    clouds: true,
    far: { type: 'mountains', top: '#7d9cc4', bottom: '#a7c2de', seed: 3 },
    near: { type: 'hills', top: '#5aa55f', bottom: '#2e7d32', seed: 7 },
    ground: '#3f9b46',
    grass: ['#4caf50', '#46a74a'], rumble: ['#d32f2f', '#f5f5f5'], road: ['#646870', '#5f636b'],
    lane: '#ffffff', edge: '#f5f5f5', fog: '#cfe6f5', fogDensity: 2.4,
    decor: [
      { keys: ['palm'], every: 7, min: 1.25, max: 1.9, chance: 0.9 },
      { keys: ['bush', 'bush', 'palm'], every: 11, min: 2.2, max: 4.2, chance: 0.75 },
    ],
    billboards: ['bb_apex', 'bb_surf', 'bb_turbo'],
    dust: [170, 140, 95],
  },
  desert: {
    sky: [[0, '#1d0b45'], [0.45, '#9e2f6e'], [0.8, '#ff7b4a'], [1, '#ffc677']],
    sun: { x: 0.5, y: 0.33, r: 0.11, color: '#ffd36b', color2: '#ff4f8b', glow: 'rgba(255,140,90,0.5)', stripes: true },
    far: { type: 'mountains', top: '#5b2a6b', bottom: '#8f456f', seed: 11 },
    near: { type: 'dunes', top: '#e39b52', bottom: '#b8692f', seed: 5 },
    ground: '#c98a49',
    grass: ['#d9a35b', '#d09a52'], rumble: ['#ffffff', '#c62828'], road: ['#5e5148', '#594c43'],
    lane: '#fff3d6', edge: '#fff3d6', fog: '#f0a06c', fogDensity: 3,
    decor: [
      { keys: ['cactus'], every: 13, min: 1.3, max: 3.2, chance: 0.65 },
      { keys: ['rock'], every: 19, min: 1.25, max: 4, chance: 0.55 },
    ],
    billboards: ['bb_apex', 'bb_nitro', 'bb_turbo'],
    dust: [220, 160, 100],
  },
  city: {
    night: true,
    sky: [[0, '#03010d'], [0.6, '#160a38'], [1, '#43166e']],
    moon: { x: 0.2, y: 0.14, r: 0.03 },
    stars: true,
    far: { type: 'skyline', color: '#22134a', windows: 'rgba(255,214,140,0.55)', seed: 9 },
    near: { type: 'skyline', color: '#0f0b25', windows: 'rgba(110,230,255,0.75)', seed: 21, tall: true },
    ground: '#14121e',
    grass: ['#1d1b29', '#1a1825'], rumble: ['#ff2bd6', '#26243a'], road: ['#2c2c38', '#292934'],
    lane: '#ffd84d', edge: '#2bf3ff', fog: '#22104a', fogDensity: 3,
    decor: [
      { keys: ['bld0', 'bld1', 'bld2', 'bld3'], every: 5, min: 1.7, max: 2.6, chance: 0.95 },
    ],
    lamps: { every: 12, offset: 0.98 },
    billboards: ['bb_neon1', 'bb_neon2', 'bb_neon3'],
    dust: [90, 90, 110],
  },
  alpine: {
    sky: [[0, '#4f8fd8'], [0.6, '#b6d8f3'], [1, '#eef6fb']],
    sun: { x: 0.28, y: 0.12, r: 0.035, color: '#ffffff', glow: 'rgba(255,255,255,0.7)' },
    clouds: true,
    far: { type: 'mountains', top: '#93a9c4', bottom: '#c3d2e2', seed: 17, snow: true },
    near: { type: 'forest', top: '#2f5d4a', bottom: '#1d3b2f', seed: 4 },
    ground: '#dfe8ef',
    grass: ['#eef3f7', '#e3eaf0'], rumble: ['#c62828', '#fafafa'], road: ['#52575e', '#4d5259'],
    lane: '#ffffff', edge: '#ffffff', fog: '#e8f0f7', fogDensity: 3,
    decor: [
      { keys: ['pine_snow'], every: 4, min: 1.25, max: 2.4, chance: 0.85 },
      { keys: ['pine', 'pine_snow'], every: 6, min: 2.5, max: 5, chance: 0.9 },
      { keys: ['rock_grey'], every: 29, min: 1.3, max: 2.5, chance: 0.5 },
    ],
    billboards: ['bb_apex', 'bb_alps', 'bb_turbo'],
    dust: [235, 240, 245],
  },
};

/* Track builders use segment counts (L), curvature (C) and hill heights (Hh). */
const L = { S: 25, M: 50, L: 100 };
const C = { E: 2, M: 4, H: 6 };
const Hh = { L: 20, M: 40, H: 60 };

const TRACKS = [
  {
    id: 'coastal', name: 'Coastal Highway', theme: 'coastal', tag: 'Sun-soaked sweepers',
    level: 'Easy',
    build(b) {
      b.road(L.S, L.S, L.S, 0, 0);
      b.road(L.M, L.M, L.M, C.E, Hh.L);
      b.road(L.S, L.M, L.S, 0, -Hh.L);
      b.road(L.M, L.M, L.M, C.M, 0);
      b.road(L.S, L.S, L.S, 0, Hh.M);
      b.road(L.M, L.L, L.M, -C.E, 0);
      b.road(L.M, L.M, L.M, C.M, -Hh.M);
      b.bumps();
      b.road(L.M, L.M, L.M, C.E, Hh.L);
      b.road(L.L, L.L, L.L, 0, 0);
      b.road(L.M, L.M, L.M, C.M, -Hh.L);
      b.road(L.M, L.M, L.M, -C.M, 0);
      b.road(L.M, L.L, L.M, C.M, Hh.L);
      b.road(L.S, L.M, L.S, C.E, 0);
    },
  },
  {
    id: 'desert', name: 'Canyon Sunset', theme: 'desert', tag: 'Rolling dunes & blind crests',
    level: 'Medium',
    build(b) {
      b.road(L.S, L.S, L.S, 0, 0);
      b.road(L.M, L.M, L.M, 0, Hh.M);
      b.road(L.M, L.M, L.M, C.M, -Hh.M);
      b.road(L.S, L.S, L.S, 0, Hh.H);
      b.road(L.S, L.S, L.S, 0, -Hh.H);
      b.sCurves();
      b.road(L.M, L.M, L.M, C.H, Hh.L);
      b.road(L.L, L.M, L.M, 0, -Hh.L);
      b.bumps();
      b.road(L.M, L.M, L.M, -C.M, Hh.M);
      b.road(L.M, L.L, L.M, C.M, -Hh.M);
      b.road(L.S, L.S, L.S, 0, Hh.H);
      b.road(L.S, L.S, L.S, 0, -Hh.H);
      b.road(L.M, L.M, L.M, C.H, 0);
      b.road(L.M, L.M, L.M, C.M, 0);
    },
  },
  {
    id: 'city', name: 'Neon Boulevard', theme: 'city', tag: 'Night street circuit',
    level: 'Medium',
    build(b) {
      b.road(L.S, L.M, L.S, 0, 0);
      b.road(L.S, L.S, L.S, C.H, 0);
      b.road(L.S, L.M, L.S, 0, 0);
      b.road(L.S, L.S, L.S, C.H, 0);
      b.road(L.M, L.M, L.M, 0, Hh.L);
      b.sCurves();
      b.road(L.S, L.S, L.S, -C.H, -Hh.L);
      b.road(L.S, L.M, L.S, 0, 0);
      b.road(L.S, L.S, L.S, C.H, 0);
      b.road(L.L, L.L, L.L, 0, 0);
      b.road(L.S, L.S, L.S, C.H, 0);
      b.road(L.S, L.S, L.S, -C.M, 0);
      b.road(L.S, L.S, L.S, C.M, 0);
      b.road(L.M, L.M, L.M, 0, Hh.M);
      b.road(L.S, L.S, L.S, C.H, -Hh.M);
      b.road(L.S, L.M, L.S, 0, 0);
    },
  },
  {
    id: 'alpine', name: 'Alpine Pass', theme: 'alpine', tag: 'Hairpins & big elevation',
    level: 'Hard',
    build(b) {
      b.road(L.S, L.S, L.S, 0, 0);
      b.road(L.M, L.M, L.M, C.M, Hh.H);
      b.road(L.S, L.S, L.S, -C.H, Hh.M);
      b.road(L.S, L.S, L.S, C.H, Hh.L);
      b.road(L.M, L.M, L.M, 0, -Hh.M);
      b.road(L.S, L.M, L.S, C.H, -Hh.H);
      b.sCurves();
      b.road(L.M, L.L, L.M, C.M, Hh.M);
      b.road(L.S, L.S, L.S, -C.H, 0);
      b.road(L.S, L.S, L.S, C.H, -Hh.L);
      b.road(L.L, L.M, L.M, 0, -Hh.M);
      b.bumps();
      b.road(L.M, L.M, L.M, C.H, Hh.L);
      b.road(L.M, L.M, L.M, C.M, 0);
    },
  },
];
