# Apex Rush — Arcade Racing PWA

A pseudo-3D arcade racer that runs entirely in the browser. No server logic, no build step,
no dependencies, no downloaded assets: every car, tree, skyline and sound is generated in code.

## Run
Any static file server works (a service worker requires http/https or localhost):

    python3 -m http.server 8080      # then open http://localhost:8080

Opening `index.html` directly via `file://` also plays, but install/offline mode is disabled.
To deploy, upload the folder to any static host (GitHub Pages, Netlify, S3, …).

## Features
- 4 circuits (Coastal, Desert Sunset, Neon City night, Alpine snow) with hills, bends, parallax skies
- 4 cars with distinct stats + 10 paint colours, 7 AI rivals with overtaking/avoidance, 3 difficulty levels
- Nitro, tyre smoke, off-road dust, collisions, start lights, lap timing, live positions, minimap
- Keyboard, touch (with auto-accelerate), tilt steering (rotate the phone like a wheel) and gamepad (with rumble) controls
- Full controller support: drive with triggers/stick, and navigate every menu with
  D-pad/stick + A (select), B (back), LB/RB (switch car/circuit), Start (pause/resume)
- Synthesised engine/tyre/wind audio and a procedural synthwave soundtrack
- Saved settings, best laps, best race times and win stats (localStorage)
- Installable PWA, fully offline after first load

## Files
- `js/game.js` – renderer, physics, AI, HUD, input
- `js/art.js` – procedural sprites & backgrounds
- `js/audio.js` – Web Audio engine & music
- `js/data.js` – cars, themes, track layouts (edit here to add circuits)
- `js/tilt.js` – motion-sensor (tilt) steering
- `js/ui.js` – menus, garage, settings, results, PWA install
- `sw.js` – offline cache (bump `CACHE` when you change files)
