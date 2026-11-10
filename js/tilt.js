'use strict';
/* Tilt steering: hold the phone like a steering wheel and rotate it.
   Uses the gravity vector from `devicemotion`. Steering is measured as the
   rotation *relative to a calibrated centre* in the screen plane, which makes
   it independent of screen orientation and of the platform's axis sign
   convention (Android and iOS report gravity with opposite signs). */
const Tilt = (() => {
  const DEADZONE = 2;                 // degrees around centre that count as straight
  const RANGE = { low: 34, medium: 24, high: 15 }; // degrees for full lock
  let listening = false, ref = null, pendingCal = true;
  let raw = 0, value = 0, lastEvt = 0, range = RANGE.medium, angle = 0;

  function onMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g || g.x == null || g.y == null) return;
    lastEvt = performance.now();
    // Phone lying (nearly) flat: rotation in the screen plane is meaningless.
    if (Math.hypot(g.x, g.y) < 2.5) { raw = 0; return; }
    const theta = Math.atan2(g.y, g.x);
    if (pendingCal || ref === null) { ref = theta; pendingCal = false; }
    const d = Math.atan2(Math.sin(theta - ref), Math.cos(theta - ref)); // wrap to ±π
    // Rotating the phone clockwise makes gravity appear to rotate counter-
    // clockwise in device coordinates (+d), which we map to steering right.
    angle = (d * 180) / Math.PI;
    const a = Math.abs(angle) < DEADZONE ? 0 : angle - Math.sign(angle) * DEADZONE;
    raw = Math.max(-1, Math.min(1, a / (range - DEADZONE)));
  }

  const supported = () => typeof window.DeviceMotionEvent !== 'undefined';

  /* Must be called from a user gesture (tap/click) for iOS permission. */
  async function enable() {
    if (!supported()) return false;
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
      try {
        if ((await DeviceMotionEvent.requestPermission()) !== 'granted') return false;
      } catch (e) { return false; }
    }
    if (!listening) { addEventListener('devicemotion', onMotion); listening = true; }
    return true;
  }
  function disable() {
    if (listening) removeEventListener('devicemotion', onMotion);
    listening = false; raw = 0; value = 0;
  }
  function calibrate() { pendingCal = true; raw = 0; value = 0; }
  function setSensitivity(level) { range = RANGE[level] || RANGE.medium; }
  /* Smoothed steering value in [-1, 1]; call once per frame. */
  function update(dt) { value += (raw - value) * Math.min(1, dt * 14); return value; }

  return {
    enable, disable, calibrate, setSensitivity, update, supported,
    get active() { return listening && performance.now() - lastEvt < 1000; },
    get value() { return value; },
  };
})();
