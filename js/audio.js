'use strict';

// ─── Web Audio API ────────────────────────────────────────────────────────────

let audioCtx      = null;
let masterGain    = null;   // trvalý výstupní uzel — přes něj teče veškerý zvuk
let activeNodes   = [];
let masterVolume  = 0.7;

function getCtx() {
  if (!audioCtx) {
    audioCtx   = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function stopAll() {
  for (const node of activeNodes) {
    try { node.stop(); } catch (_) {}
  }
  activeNodes = [];
}

function isPlaying() {
  return activeNodes.length > 0;
}

// Okamžitá změna hlasitosti — funguje i za přehrávání
function setVolume(v) {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain) {
    masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.02);
  }
}

function removeNode(node) {
  const i = activeNodes.indexOf(node);
  if (i >= 0) activeNodes.splice(i, 1);
}

// ─── Interní generátory tónů ─────────────────────────────────────────────────

function makeOrganNote(ctx, freq, startTime, duration) {
  const harmonics = [1, 2, 3, 4, 6, 8];
  const amplitudes = [1, 0.5, 0.25, 0.2, 0.1, 0.05];
  const noteGain = ctx.createGain();
  noteGain.gain.setValueAtTime(0.25, startTime);
  noteGain.gain.setTargetAtTime(0, startTime + duration * 0.7, duration * 0.15);
  noteGain.connect(masterGain);

  harmonics.forEach((h, i) => {
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * h;
    g.gain.value = amplitudes[i];
    osc.connect(g).connect(noteGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.2);
    activeNodes.push(osc);
    osc.onended = () => removeNode(osc);
  });
}

function makeSineNote(ctx, freq, startTime, duration) {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.7, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain).connect(masterGain);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
  activeNodes.push(osc);
  osc.onended = () => removeNode(osc);
}

// ─── Veřejné přehrávací funkce ────────────────────────────────────────────────

function playNote(midi, timbre = 'sine', duration = 1.5, delay = 0) {
  const ctx   = getCtx();
  const freq  = Theory.midiToFreq(midi);
  const start = ctx.currentTime + delay;
  if (timbre === 'organ') makeOrganNote(ctx, freq, start, duration);
  else                    makeSineNote(ctx, freq, start, duration);
}

function playChord(midiNotes, timbre, duration = 2.5) {
  stopAll();
  midiNotes.forEach(midi => playNote(midi, timbre, duration, 0));
}

function playScale(midiNotes, timbre, noteDuration = 1.0) {
  stopAll();
  const step = 0.6;
  midiNotes.forEach((midi, i) => playNote(midi, timbre, noteDuration, i * step));
}

// Trvale znějící akord — bez útlumu, zastaví stopAll()
function playSustained(midiNotes, timbre) {
  stopAll();
  const ctx = getCtx();
  midiNotes.forEach(midi => {
    const freq = Theory.midiToFreq(midi);
    if (timbre === 'organ') {
      const harmonics  = [1, 2, 3, 4, 6, 8];
      const amplitudes = [1, 0.5, 0.25, 0.2, 0.1, 0.05];
      const noteGain = ctx.createGain();
      noteGain.gain.setValueAtTime(0.18, ctx.currentTime);
      noteGain.connect(masterGain);
      harmonics.forEach((h, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq * h;
        g.gain.value = amplitudes[i];
        osc.connect(g).connect(noteGain);
        osc.start();
        activeNodes.push(osc);
        osc.onended = () => removeNode(osc);
      });
    } else {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.45, ctx.currentTime);
      osc.connect(gain).connect(masterGain);
      osc.start();
      activeNodes.push(osc);
      osc.onended = () => removeNode(osc);
    }
  });
}

function isContextReady() {
  return audioCtx && audioCtx.state === 'running';
}

const Audio = {
  playNote,
  playChord,
  playScale,
  playSustained,
  stopAll,
  isPlaying,
  setVolume,
  isContextReady,
  getCtx,
};
