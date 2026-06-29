// ── Boot: event bindings + first paint ───────────────────────────────────────────

// Manual throttle binding (hold the dial to rev — desktop / no accelerometer).
el.tacho.addEventListener('pointerdown', e => { e.preventDefault(); setThrottle(true); });
// Release anywhere (even if the cursor left the dial) so RPM always falls back to idle.
['pointerup', 'pointercancel'].forEach(ev =>
  window.addEventListener(ev, () => setThrottle(false)));

// The audio graph + samples are built lazily on the first Start (inside a user
// gesture), which avoids the browser autoplay warnings. startUp() awaits the decode.
drawTicks();
drawTacho(0);
syncUI();
