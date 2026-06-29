// ── Input: motion (mobile) + manual throttle (desktop / no accelerometer) ────────
let pseudoV = 0, lastT = Date.now(), motionSeen = false, throttle = false;

function onMotion(e) {
  const a = e.acceleration || e.accelerationIncludingGravity;
  if (!a) return;
  motionSeen = true;
  const now = Date.now();
  const dt = Math.min((now - lastT) / 1000, 0.1); lastT = now;
  const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2);
  if (mag > 0.05) pseudoV += mag * dt * 45;
  pseudoV *= Math.pow(0.95, dt * 60);
  pseudoV = Math.max(0, Math.min(100, pseudoV));
}

// Returns 'granted' | 'denied' | 'insecure' | 'none'
async function askMotion() {
  // Motion sensors only work on a secure origin (https:// or localhost).
  if (!window.isSecureContext) return 'insecure';

  // iOS 13+ : must request permission from a user gesture (the Start tap).
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const r = await DeviceMotionEvent.requestPermission();
      if (r === 'granted') { window.addEventListener('devicemotion', onMotion); return 'granted'; }
      return 'denied';
    } catch { return 'denied'; }
  }

  // Android / other: devicemotion fires without a prompt when a sensor exists.
  if (typeof DeviceMotionEvent !== 'undefined') {
    window.addEventListener('devicemotion', onMotion);
    return 'granted';
  }
  return 'none'; // no motion API (desktop) — manual throttle only
}

function setThrottle(on) { throttle = on; }
