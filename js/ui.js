// ── UI ─────────────────────────────────────────────────────────────────────────
const LABELS = { off:'OFF', starting:'CRANKING', idle:'IDLE', running:'RUNNING', stopping:'STOPPING' };
const TEXTS  = { off:'Engine off — tap Start', starting:'Cranking...', idle:'Idling — accelerate to rev', running:'Running', stopping:'Shutting down...' };

function syncUI() {
  el.stLbl.textContent = LABELS[engState] || '';
  el.stText.textContent = TEXTS[engState] || '';
  const live = engState !== 'off';
  el.pip1.classList.toggle('live', live);
  el.pip2.classList.toggle('live', live);
  el.stLbl.classList.toggle('active', engState === 'running');
}

function setHint(t) { el.hint.textContent = t; }

// ── Tachometer Drawing ─────────────────────────────────────────────────────────
const CX = 135, CY = 135, R = 110;
// Geometry shared by the fill arc, tick marks and needle: 0 sits at lower-left
// (-140° from top) and sweeps 280° clockwise to max at lower-right, matching the
// SVG track ring and the needle rotation in drawTacho.
const ARC_START = -140; // degrees from top
const ARC_SWEEP = 280;
const REDLINE = 0.78;   // normalized RPM where the redline begins

function polar(deg, r) {
  r = r || R;
  const rad = (deg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

// SVG arc between two normalized positions (0..1) along the gauge sweep.
function arcSegment(from, to) {
  if (to - from < 0.002) return '';
  const [sx, sy] = polar(ARC_START + ARC_SWEEP * from);
  const [ex, ey] = polar(ARC_START + ARC_SWEEP * to);
  const large = ARC_SWEEP * (to - from) > 180 ? 1 : 0;
  return `M ${sx} ${sy} A ${R} ${R} 0 ${large} 1 ${ex} ${ey}`;
}

const arcPath = norm => arcSegment(0, Math.min(norm, 1));

// ── Tick marks — generated per profile (different max RPMs) ────────────────────
let lastTickProfile = null;
function drawTicks() {
  const p = PROFS[profKey];
  if (lastTickProfile === profKey) return;
  lastTickProfile = profKey;

  const g = el.tickGroup;
  g.innerHTML = '';

  // Determine tick step: use 2000 for very high-rev engines, 1000 otherwise
  const step = p.max > 12000 ? 2000 : 1000;
  const majorCount = Math.floor(p.max / step);

  for (let i = 0; i <= majorCount; i++) {
    const rpm = i * step;
    const norm = rpm / p.max;
    const deg = ARC_START + ARC_SWEEP * norm;

    // Major tick line
    const [ix, iy] = polar(deg, R - 14);
    const [ox, oy] = polar(deg, R - 3);
    const tick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tick.setAttribute('x1', ix); tick.setAttribute('y1', iy);
    tick.setAttribute('x2', ox); tick.setAttribute('y2', oy);

    const inRedline = norm >= REDLINE;
    tick.setAttribute('stroke', inRedline ? '#FF0000' : '#3A3A3A');
    tick.setAttribute('stroke-width', '1.5');
    tick.setAttribute('stroke-linecap', 'round');
    g.appendChild(tick);

    // Label
    const [lx, ly] = polar(deg, R - 24);
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', lx); label.setAttribute('y', ly);
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('fill', inRedline ? '#FF0000' : '#444');
    label.setAttribute('font-size', '9');
    label.setAttribute('font-family', "'JetBrains Mono', monospace");
    label.setAttribute('font-weight', '600');
    label.textContent = rpm / 1000;
    g.appendChild(label);

    // Minor ticks (halfway between majors)
    if (i < majorCount) {
      const midRPM = rpm + step / 2;
      const midNorm = midRPM / p.max;
      const midDeg = ARC_START + ARC_SWEEP * midNorm;
      const [mix, miy] = polar(midDeg, R - 10);
      const [mox, moy] = polar(midDeg, R - 4);
      const minorTick = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      minorTick.setAttribute('x1', mix); minorTick.setAttribute('y1', miy);
      minorTick.setAttribute('x2', mox); minorTick.setAttribute('y2', moy);
      minorTick.setAttribute('stroke', midNorm >= REDLINE ? '#661111' : '#252525');
      minorTick.setAttribute('stroke-width', '1');
      minorTick.setAttribute('stroke-linecap', 'round');
      g.appendChild(minorTick);
    }
  }
}

function drawTacho(rpm) {
  const p = PROFS[profKey];
  const norm = Math.min(rpm / p.max, 1);

  el.rpmNum.textContent = Math.round(rpm / 10) * 10;

  // Needle angle: ARC_START at 0, ARC_START + ARC_SWEEP at max
  const ang = ARC_START + ARC_SWEEP * norm;
  el.needle.setAttribute('transform', `rotate(${ang}, ${CX}, ${CY})`);

  const inRedline = norm > REDLINE;

  // Needle glow intensity
  el.needle.setAttribute('filter', inRedline ? 'url(#needleGlowHot)' : 'url(#needleGlow)');

  // RPM number redline flash
  el.rpmNum.classList.toggle('redline', inRedline);

  // Arc glow (soft bloom behind the main arc)
  el.arcGlowPath.setAttribute('d', arcPath(norm));
  el.arcGlowPath.style.opacity = 0.08 + norm * 0.18;

  if (inRedline) {
    el.arcFill.setAttribute('d', arcPath(REDLINE));
    el.arcRed.setAttribute('d', arcSegment(REDLINE, norm));
    el.arcRed.style.opacity = '1';
    el.needle.setAttribute('stroke', '#FF0000');
  } else {
    el.arcFill.setAttribute('d', arcPath(norm));
    el.arcRed.style.opacity = '0';
    el.needle.setAttribute('stroke', '#FF3800');
  }

  // Ambient glow — RPM-reactive background pulse
  const glowIntensity = Math.pow(norm, 1.5);
  const glowAlpha = glowIntensity * 0.12;
  document.documentElement.style.setProperty('--glow-intensity', glowIntensity.toFixed(3));
  document.documentElement.style.setProperty('--glow-color',
    inRedline
      ? `rgba(255, 30, 0, ${(glowAlpha * 1.5).toFixed(3)})`
      : `rgba(255, 56, 0, ${glowAlpha.toFixed(3)})`
  );
  // (.tacho-glass box-shadow reacts to --glow-intensity directly in CSS)
}
