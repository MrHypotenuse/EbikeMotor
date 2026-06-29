// ── DOM refs (cached — drawTacho/syncUI run every frame) ─────────────────────────
const $ = id => document.getElementById(id);
const el = {
  rpmNum: $('rpmNum'), stLbl: $('stLbl'), stText: $('stText'),
  pip1: $('pip1'), pip2: $('pip2'), hint: $('hint'),
  startBtn: $('startBtn'), needle: $('needle'),
  arcFill: $('arcFill'), arcRed: $('arcRed'), tacho: $('tachoWrap'),
  arcGlowPath: $('arcGlowPath'), tickGroup: $('tickGroup'),
  ambientGlow: $('ambientGlow'),
};
