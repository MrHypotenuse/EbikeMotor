// ── Input: motion (mobile) + manual throttle (desktop / no accelerometer) ────────
let pseudoV = 0, lastT = Date.now(), motionSeen = false, throttle = false;

// ── GPS speed governor ───────────────────────────────────────────────────────
// GPS speed (m/s) caps pseudoV so vibrations at low speed don't cause full revs.
// maxBikeSpeed = top speed of the e-bike in m/s (~30 mph ≈ 13.4 m/s).
let gpsSpeed = -1;  // -1 = no GPS data yet (don't cap until we have a reading)
let gpsWatchId = null;
const MAX_BIKE_SPEED = 13.4; // m/s (~30 mph)

function startGPS() {
  if (!navigator.geolocation) return;
  gpsWatchId = navigator.geolocation.watchPosition(
    pos => {
      // pos.coords.speed is m/s (null if unavailable, 0 if stationary)
      if (pos.coords.speed != null) {
        gpsSpeed = Math.max(0, pos.coords.speed);
      }
    },
    () => {}, // silently ignore errors — accelerometer still works
    { enableHighAccuracy: true, maximumAge: 1000 }
  );
}

function stopGPS() {
  if (gpsWatchId != null) {
    navigator.geolocation.clearWatch(gpsWatchId);
    gpsWatchId = null;
  }
  gpsSpeed = -1;
}

function onMotion(e) {
  const a = e.acceleration || e.accelerationIncludingGravity;
  if (!a) return;
  motionSeen = true;
  const now = Date.now();
  const dt = Math.min((now - lastT) / 1000, 0.1); lastT = now;
  const mag = Math.sqrt((a.x||0)**2 + (a.y||0)**2);
  if (mag > 0.05) pseudoV += mag * dt * 55;
  pseudoV *= Math.pow(0.97, dt * 60);

  // GPS speed governor: cap pseudoV based on actual travel speed.
  // At 0 mph → cap at 5 (gentle idle rumble from vibration is ok).
  // At max speed → no cap (full 100).
  if (gpsSpeed >= 0) {
    const speedNorm = Math.min(1, gpsSpeed / MAX_BIKE_SPEED);
    const maxV = 5 + speedNorm * 95;
    pseudoV = Math.min(pseudoV, maxV);
  }

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
