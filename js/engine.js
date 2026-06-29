// ── Engine State ───────────────────────────────────────────────────────────────
let running = false, engState = 'off';
let curRPM = 0, targRPM = 0, raf = null;

async function toggleEngine() {
  if (engState === 'off' || engState === 'stopping') await startUp();
  else shutDown();
}

async function startUp() {
  // Request motion permission FIRST, while the tap's user activation is still alive.
  // Awaiting ctx.resume() before this makes iOS drop the gesture and skip the prompt
  // until a second tap — so order matters here.
  const motion = await askMotion();
  if (!ctx) initAudio();
  if (ctx.state === 'suspended') await ctx.resume();
  const MOTION_MSG = {
    granted:  'Motion active — accelerate to rev!',
    denied:   'Motion blocked — enable Settings ▸ Safari ▸ Motion & Orientation Access, then reload',
    insecure: 'Open the https:// link (motion needs a secure site) — hold the dial to rev for now',
    none:     'No accelerometer here — hold the dial to rev',
  };

  engState = 'starting'; running = true; syncUI();
  el.startBtn.textContent = 'Stop Engine';
  el.startBtn.classList.add('on');

  const p = PROFS[profKey];
  // Make sure the recording is decoded before building the source — this removes the
  // intermittent "no sound on start" race.
  if (p.sample && !BUFFERS[p.sample]) {
    setHint('Loading engine…');
    try { await ensureSample(p.sample); } catch {}
    if (!running) return; // user pressed Stop while it was loading
  }

  rebuildOscs();
  const t0 = ctx.currentTime;
  // Crank: ramp from 0 to idle-overshoot then settle
  master.gain.setValueAtTime(0, t0);
  master.gain.linearRampToValueAtTime(0.7, t0 + 0.25);

  oscs.forEach(o => {
    if (o.isSample) {
      // Crank: spin the recording up from a slow rate to idle pitch.
      const idleRate = p.sampleLo;
      o.src.playbackRate.setValueAtTime(idleRate * 0.4, t0);
      o.src.playbackRate.linearRampToValueAtTime(idleRate * 1.4, t0 + 0.7);
      o.src.playbackRate.linearRampToValueAtTime(idleRate, t0 + 1.5);
      return;
    }
    const { osc, h } = o;
    osc.frequency.setValueAtTime(p.hzFn(120) * h, t0);
    osc.frequency.linearRampToValueAtTime(p.hzFn(p.idle * 1.45) * h, t0 + 0.7);
    osc.frequency.linearRampToValueAtTime(p.hzFn(p.idle) * h, t0 + 1.5);
  });
  curRPM = 120; targRPM = p.idle;

  setHint(MOTION_MSG[motion]);

  setTimeout(() => { engState = 'idle'; syncUI(); loop(); }, 1700);
}

function shutDown() {
  engState = 'stopping'; syncUI();
  if (raf) cancelAnimationFrame(raf); raf = null;
  window.removeEventListener('devicemotion', onMotion);
  throttle = false;

  const p = PROFS[profKey];
  const t = ctx.currentTime;
  oscs.forEach(o => {
    if (o.isSample) {
      o.src.playbackRate.cancelScheduledValues(t);
      o.src.playbackRate.setValueAtTime(o.src.playbackRate.value, t);
      o.src.playbackRate.linearRampToValueAtTime(p.sampleLo * 0.4, t + 0.7);
      return;
    }
    const { osc, h } = o;
    osc.frequency.cancelScheduledValues(t);
    osc.frequency.setValueAtTime(osc.frequency.value, t);
    osc.frequency.linearRampToValueAtTime(p.hzFn(p.idle * 0.4) * h, t + 0.7);
  });
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0, t + 0.9);

  el.startBtn.textContent = 'Start Engine';
  el.startBtn.classList.remove('on');
  setHint('Tap Start — allow motion on mobile, or hold the dial to rev');

  setTimeout(() => {
    engState = 'off'; running = false; curRPM = 0; pseudoV = 0;
    // Free sources while silent (saves battery); startUp rebuilds them.
    oscs.forEach(o => { try { (o.osc || o.src).stop(); } catch(_){} });
    oscs = [];
    syncUI(); drawTacho(0);
  }, 1000);
}

function loop() {
  if (!running) return;
  const p = PROFS[profKey];

  // ── FIX: Always decay pseudoV when throttle is released. ──
  // Previously gated by `!motionSeen`, which skipped the decay on any device
  // that fires even one devicemotion event (laptops with accelerometers, etc.),
  // leaving RPM permanently pegged at max.
  if (throttle) pseudoV = Math.min(100, pseudoV + 1.0);
  else pseudoV = Math.max(0, pseudoV * 0.93 - 0.4);

  targRPM = p.idle + (pseudoV / 100) * (p.max - p.idle);
  // Higher factor = snappier throttle response (less lag between motion and revs).
  curRPM += (targRPM - curRPM) * 0.18;
  curRPM = Math.max(p.idle * 0.94, Math.min(p.max, curRPM));
  if (curRPM > p.idle * 1.05) engState = 'running';
  else if (running) engState = 'idle';
  applySound(curRPM);
  drawTacho(curRPM);
  raf = requestAnimationFrame(loop);
}
