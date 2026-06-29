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
    sample: 'inline6.mp3', sampleLo: 0.5, sampleHi: 5.277777777777778, sampleGain: 1.7, sampleSub: 0.32, loopPos: 0.4, loopLen: 0.1,
    harmonics: [1, 1.5, 2, 3, 4, 6], gains: [0.8, 0.2, 0.5, 0.4, 0.2, 0.1],
    noise: 0.05, filterBase: 800, drive: 1.2,
    fireMul: 3.0, firePulse: 0.3, subMul: 1.5, subLevel: 0.2, bodyHz: 120,
    hzFn: rpm => rpm / 60 * 3.0,
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
    sample: 'twostroke.mp3', sampleLo: 0.7, sampleHi: 5.54, sampleGain: 1.8, sampleSub: 0.10, loopPos: 0.4, loopLen: 0.08,
    harmonics: [1, 2, 3, 4, 5, 7], gains: [0.6, 0.8, 0.5, 0.4, 0.3, 0.2],
    noise: 0.25, filterBase: 1200, drive: 1.8,
    fireMul: 2.0, firePulse: 0.7, subMul: 1.0, subLevel: 0.1, bodyHz: 300,
    hzFn: rpm => rpm / 60 * 2.0,
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
