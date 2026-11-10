'use strict';
/* Persistent storage (localStorage) for settings, garage choice and records. */
const Store = (() => {
  const KEY = 'apexrush.v1';
  const isTouch = matchMedia('(pointer: coarse)').matches;
  const defaults = {
    settings: {
      master: 0.8, music: 0.5, sfx: 0.9,
      quality: 'high', units: 'kmh',
      laps: 3, difficulty: 'normal',
      autoGas: isTouch, vibration: true, minimap: true,
      tilt: isTouch, tiltSens: 'medium',
    },
    car: 0, color: 0, track: 0,
    records: {},
    stats: { races: 0, wins: 0, podiums: 0 },
  };
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { data = {}; }
  const base = JSON.parse(JSON.stringify(defaults));
  data = Object.assign(base, data);
  data.settings = Object.assign({}, defaults.settings, data.settings);
  data.stats = Object.assign({}, defaults.stats, data.stats);

  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* private mode */ } }
  function resetRecords() { data.records = {}; data.stats = { races: 0, wins: 0, podiums: 0 }; save(); }
  return { data, save, resetRecords, isTouch };
})();
