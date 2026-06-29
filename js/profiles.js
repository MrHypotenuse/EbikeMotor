// ── Profiles ───────────────────────────────────────────────────────────────────
// Sample profiles use real CC0 recordings (archive.org/details/bike-engine-sounds),
// looped and pitch-shifted by RPM. sampleLo/sampleHi = playback rate at idle / redline
// (lower = deeper). sampleSub = how much sub-octave body to layer underneath.
//
// loopPos/loopLen carve out a short STEADY window of the recording to loop (seconds).
// Some recordings contain their own rev sweep — looping the whole file makes them
// "accelerate" on their own at idle. A short window holds a constant tone that
// playbackRate then pitches by RPM. Omit to loop the entire buffer (steady samples).
const PROFS = {
  // Inline-6 — Honda CBX. Deep, smooth, multi-cylinder wail.
  inline6: {
    idle: 900, max: 9500,
    sample: 'inline6.mp3', sampleLo: 0.5, sampleHi: 1.85, sampleGain: 1.7, sampleSub: 0.32,
    loopPos: 0.4, loopLen: 0.9,
  },
  // V-twin cruiser — Harley Iron 883. Deep, lumpy.
  vtwin: {
    idle: 750, max: 5500,
    sample: 'vtwin.mp3', sampleLo: 0.55, sampleHi: 1.75, sampleGain: 1.7, sampleSub: 0.35,
    // synth fallback if the file can't load:
    harmonics: [1, 2, 3, 4], gains: [0.75, 0.45, 0.22, 0.09],
    noise: 0.10, filterBase: 520, drive: 1.6,
    fireMul: 0.85, firePulse: 0.85, subMul: 0.5, subLevel: 0.35, bodyHz: 90,
    hzFn: rpm => rpm / 60 * 1.0,
  },
  // 2-stroke — Yamaha RD350 LC. Buzzy, ring-ding, revs high.
  twostroke: {
    idle: 1200, max: 9500,
    sample: 'twostroke.mp3', sampleLo: 0.7, sampleHi: 2.4, sampleGain: 1.8, sampleSub: 0.10,
    loopPos: 0.4, loopLen: 0.7,
  },
  // Sport — Suzuki GSX-R 600 inline-4. Real superbike scream.
  sport: {
    idle: 1400, max: 14000,
    sample: 'sport.mp3', sampleLo: 0.75, sampleHi: 2.55, sampleGain: 1.7, sampleSub: 0.08,
    loopPos: 0.4, loopLen: 0.8,
  },
  // Electric — synthesized EV / "Volt bike" gear-whine: a rising tone, no combustion.
  electric: {
    idle: 300, max: 11000,
    harmonics:     [1,    3,    4,    6   ],
    gains:         [0.06, 0.10, 0.5,  0.30],
    noise: 0.012, filterBase: 3600, drive: 0.42,
    fireMul: 8.0, firePulse: 0.0, subMul: 2.0, subLevel: 0.04, bodyHz: 1400,
    hzFn: rpm => rpm / 60 * 5.5,
  },
};

let profKey = 'inline6';
function setProf(k) {
  profKey = k;
  document.querySelectorAll('.prof-btn').forEach(b => b.classList.remove('sel'));
  $('p-' + k).classList.add('sel');
  drawTicks();
  if (!running) { drawTacho(0); return; }
  const p = PROFS[k];
  if (p.sample && !BUFFERS[p.sample]) {
    ensureSample(p.sample).then(() => { if (running && profKey === k) rebuildOscs(); }).catch(() => {});
  } else {
    rebuildOscs();
  }
}
