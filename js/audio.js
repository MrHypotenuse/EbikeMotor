// ── Audio ──────────────────────────────────────────────────────────────────────
let ctx, master, filt, noiseGain, noiseSource, oscBus, shaper, fireLFO, fireDepth, sub, subGain, formant, formantGain;
let oscs = [];

// Sample playback: fetch + decode each file once, exposed as a cached promise so
// startUp() can await the buffer before building the source (no start-up race).
const BUFFERS = {};
const samplePromises = {};
function ensureSample(url) {
  if (BUFFERS[url]) return Promise.resolve(BUFFERS[url]);
  if (samplePromises[url]) return samplePromises[url];
  samplePromises[url] = fetch(url)
    .then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
    .then(ab => ctx.decodeAudioData(ab))
    .then(b => { BUFFERS[url] = b; return b; });
  return samplePromises[url];
}

function makeDriveCurve(k) {
  const n = 1024, c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(k * x); }
  return c;
}

function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
  // Resonant lowpass — the Q peak acts like a throaty formant instead of a flat tone.
  filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 700; filt.Q.value = 3.5;
  filt.connect(master);
  // Soft-clip distortion gives the oscillators grit/rasp instead of a pure synth tone.
  shaper = ctx.createWaveShaper(); shaper.curve = makeDriveCurve(3.2); shaper.oversample = '4x';
  shaper.connect(filt);
  // Parallel high-Q bandpass = the exhaust/pipe resonance ("body") that makes it growl.
  formant = ctx.createBiquadFilter(); formant.type = 'bandpass'; formant.frequency.value = 120; formant.Q.value = 5;
  formantGain = ctx.createGain(); formantGain.gain.value = 0.6;
  shaper.connect(formant); formant.connect(formantGain); formantGain.connect(master);
  oscBus = ctx.createGain(); oscBus.gain.value = 1; oscBus.connect(shaper);
  noiseGain = ctx.createGain(); noiseGain.gain.value = 0; noiseGain.connect(filt);
  // Looping noise buffer
  const N = ctx.sampleRate * 3;
  const buf = ctx.createBuffer(1, N, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < N; i++) d[i] = Math.random() * 2 - 1;
  noiseSource = ctx.createBufferSource();
  noiseSource.buffer = buf; noiseSource.loop = true;
  noiseSource.connect(noiseGain); noiseSource.start();

  // Firing-pulse tremolo: modulates the oscillator bus at the cylinder-firing rate,
  // giving the rhythmic chug/"potato" instead of a flat tone. Adds to oscBus.gain (base 1).
  fireLFO = ctx.createOscillator(); fireLFO.type = 'sawtooth'; fireLFO.frequency.value = 20;
  fireDepth = ctx.createGain(); fireDepth.gain.value = 0;
  fireLFO.connect(fireDepth); fireDepth.connect(oscBus.gain); fireLFO.start();

  // Sub-octave sine for low-end body/thump (shines through car speakers).
  sub = ctx.createOscillator(); sub.type = 'sine'; sub.frequency.value = 30;
  subGain = ctx.createGain(); subGain.gain.value = 0;
  sub.connect(subGain); subGain.connect(filt); sub.start();
}

function rebuildOscs() {
  oscs.forEach(o => { try { (o.osc || o.src).stop(); } catch(_){} });
  oscs = [];
  const p = PROFS[profKey];

  // Sample-based profile: loop the recording, pitch it with playbackRate (clean path).
  if (p.sample) {
    if (BUFFERS[p.sample]) {
      const src = ctx.createBufferSource();
      src.buffer = BUFFERS[p.sample];
      src.loop = true;
      // Loop only a short steady window if the profile defines one, so recordings
      // that contain their own rev sweep don't "accelerate" on their own at idle.
      if (p.loopLen) {
        const dur = src.buffer.duration;
        const start = Math.min(dur * (p.loopPos || 0), Math.max(0, dur - p.loopLen));
        src.loopStart = Math.max(0, start);
        src.loopEnd = Math.min(dur, src.loopStart + p.loopLen);
      }
      const g = ctx.createGain(); g.gain.value = p.sampleGain || 1;
      src.connect(g); g.connect(master);
      src.start(0, src.loopStart || 0);
      oscs.push({ src, gain: g, isSample: true });
      return;
    }
    // Buffer still decoding. With no synth fallback, stay silent for now —
    // startUp()/setProf() await ensureSample() and rebuild once it's ready.
    if (!p.harmonics) return;
  }

  p.harmonics.forEach((h, i) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = p.hzFn(p.idle) * h;
    osc.detune.value = (Math.random() * 2 - 1) * 9; // slight detune → beating/growl
    g.gain.value = p.gains[i] * 0.28;
    osc.connect(g); g.connect(oscBus); osc.start();
    oscs.push({ osc, gain: g, h, baseGain: p.gains[i] });
  });
}

function applySound(rpm) {
  if (!ctx || oscs.length === 0) return;
  const p = PROFS[profKey];
  const norm = Math.max(0, (rpm - p.idle) / (p.max - p.idle));
  const t = ctx.currentTime;

  // Overall loudness rises with revs/speed: audible idle, loud under acceleration.
  master.gain.setTargetAtTime(0.3 + Math.pow(norm, 0.7) * 0.66, t, 0.06);

  // Sample profile: pitch the loop with RPM (sampleLo→sampleHi range, lower = deeper),
  // plus a sub-octave sine underneath for extra low-end chest. Other synth layers stay off.
  if (oscs[0].isSample) {
    const rate = p.sampleLo + norm * (p.sampleHi - p.sampleLo);
    oscs[0].src.playbackRate.setTargetAtTime(rate, t, 0.07);
    noiseGain.gain.setTargetAtTime(0, t, 0.05);
    fireDepth.gain.setTargetAtTime(0, t, 0.05);
    sub.frequency.setTargetAtTime(34 + norm * 44, t, 0.06);
    subGain.gain.setTargetAtTime((p.sampleSub || 0) * (1 + norm * 0.5), t, 0.06);
    return;
  }

  // Synth-only path below (sample profiles returned above and have no hzFn).
  const hz = p.hzFn(rpm);
  oscs.forEach(({ osc, gain, h, baseGain }) => {
    osc.frequency.setTargetAtTime(hz * h, t, 0.04);
    const hiBoost = h > 2 ? 0.4 + norm * 0.9 : 1;
    gain.gain.setTargetAtTime(baseGain * hiBoost * 0.28, t, 0.05);
  });
  filt.frequency.setTargetAtTime(p.filterBase + norm * 3200, t, 0.1);
  noiseGain.gain.setTargetAtTime(p.noise * (0.4 + norm * 0.9), t, 0.06);

  // Drive harder into the soft-clip as you rev → more grit/aggression up top.
  // Per-profile drive keeps Electric clean while V-Twin/Sport get gritty.
  oscBus.gain.setTargetAtTime(p.drive * (0.8 + norm * 0.8), t, 0.05);
  // Exhaust resonance opens up slightly with RPM.
  formant.frequency.setTargetAtTime(p.bodyHz + norm * 140, t, 0.1);

  // Firing pulses: rate climbs with RPM, depth eases off, plus per-update jitter so
  // combustion sounds organic/irregular rather than a sterile tone.
  const jitter = 0.95 + Math.random() * 0.1;
  fireLFO.frequency.setTargetAtTime(Math.max(4, rpm / 60 * p.fireMul * jitter), t, 0.02);
  fireDepth.gain.setTargetAtTime(p.firePulse * (1 - norm * 0.5) * jitter, t, 0.04);
  // Sub-octave body/thump.
  sub.frequency.setTargetAtTime(hz * p.subMul, t, 0.04);
  subGain.gain.setTargetAtTime(p.subLevel * (0.7 + norm * 0.5), t, 0.06);
}
