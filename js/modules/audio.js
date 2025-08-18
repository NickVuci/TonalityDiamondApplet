/**
 * Audio engine module for Tonality Diamond Applet
 * Handles AudioContext setup, sound generation, and audio state management
 */

// Module state
let actx = null;
let master = null;
let compressor = null;
const active = new Map();

// DOM elements
let audioBanner;
let audioBannerMsg;
let enableAudioBtn;

/**
 * Initialize the audio module
 */
export function initAudio() {
  audioBanner = document.getElementById('audioBanner');
  audioBannerMsg = document.getElementById('audioBannerMsg');
  enableAudioBtn = document.getElementById('enableAudio');
  
  // Attach audio event listeners
  const gestureResume = () => { 
    if (!actx || actx.state !== 'running') {
      ensureAudio();
    }
  };

  // Volume slider
  const volumeSlider = document.getElementById('volume');
  if (volumeSlider) {
    volumeSlider.addEventListener('input', (e) => {
      if (master) master.gain.value = parseFloat(e.target.value);
    });
  }
  
  document.addEventListener('pointerdown', gestureResume, true);
  document.addEventListener('keydown', gestureResume, true);
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopAll();
    } else {
      if (!actx || actx.state !== 'running')
        showAudioBanner('Audio disabled — tap anywhere or click Enable.');
    }
  });
  
  enableAudioBtn.addEventListener('click', () => {
    ensureAudio();
  });
}

/**
 * Show audio banner with optional message
 */
export function showAudioBanner(msg) {
  if (msg) audioBannerMsg.textContent = msg;
  audioBanner.classList.remove('hidden');
}

/**
 * Hide audio banner
 */
export function hideAudioBanner() {
  audioBanner.classList.add('hidden');
}

/**
 * Check if parameter has setTargetAtTime method
 */
function hasTarget(param) {
  return param && typeof param.setTargetAtTime === "function";
}

/**
 * Ensure audio context is initialized and running
 */
export async function ensureAudio() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) {
    showAudioBanner('Audio not supported in this browser.');
    return null;
  }

  if (!actx) {
    try {
      actx = new Ctor();
    } catch (err) {
      console.error('AudioContext creation failed', err);
      showAudioBanner('Audio failed to initialize.');
      return null;
    }

    try {
      master = actx.createGain();
      master.gain.value = 0.18;

      // Create and configure compressor/limiter
      compressor = actx.createDynamicsCompressor();
      compressor.threshold.value = -3;    // dB, start limiting just below 0
      compressor.knee.value = 0;          // Hard knee for limiter behavior
      compressor.ratio.value = 20;        // High ratio for limiting
      compressor.attack.value = 0.003;    // Fast attack
      compressor.release.value = 0.250;   // Reasonable release

      master.connect(compressor);
      compressor.connect(actx.destination);

      // Dummy nodes to prime audio context
      const o = actx.createOscillator();
      const g = actx.createGain();
      g.gain.value = 0;
      o.connect(g);
      g.connect(master);
      o.start();
      o.stop(actx.currentTime);
    } catch (err) {
      console.error('Audio node graph failed', err);
      showAudioBanner('Audio failed to initialize.');
      return null;
    }

    actx.onstatechange = () => {
      if (actx.state === 'running') hideAudioBanner();
      else showAudioBanner('Audio disabled — tap anywhere or click Enable.');
    };
  }

  if (actx.state === 'suspended') {
    try {
      await actx.resume();
    } catch (e) {
      /* user gesture required */
    }
  }
  
  if (actx.state !== 'running')
    showAudioBanner('Audio disabled — tap anywhere or click Enable.');
  else
    hideAudioBanner();
    
  return actx;
}

/**
 * Convert ratio to frequency
 */
export function rtof(r) {
  const ref = parseFloat(document.getElementById('refHz').value || '392');
  return ref * r;
}

/**
 * Start playing a note
 */
export async function noteOn(key, f) {
  await ensureAudio();
  if (!actx) return;
  if (active.has(key)) return;

  const o = actx.createOscillator();
  const g = actx.createGain();

  o.type = document.getElementById('wave').value;
  o.frequency.value = f;

  g.gain.value = 0.0001;
  o.connect(g);
  g.connect(master);

  const att = Math.max(0, parseFloat(document.getElementById('attack').value || '5')) / 1000;
  const rel = Math.max(0.01, parseFloat(document.getElementById('release').value || '250')) / 1000;
  const now = actx.currentTime;

  // Smooth attack
  g.gain.setValueAtTime(0.0001, now);
  g.gain.linearRampToValueAtTime(1.0, now + att);

  o.start();
  active.set(key, { o, g, rel });
  hideAudioBanner();
}

export function noteOff(key) {
  const s = active.get(key);
  if (!s) return;

  const now = actx.currentTime;
  const rel = Math.max(0.05, s.rel || 0.25); // Ensure minimum release

  // Smooth release
  s.g.gain.cancelScheduledValues(now);
  s.g.gain.setValueAtTime(s.g.gain.value, now);
  s.g.gain.linearRampToValueAtTime(0.00001, now + rel);

  // Stop oscillator after release
  s.o.stop(now + rel);

  // Disconnect nodes after oscillator stops
  s.o.onended = () => {
    s.o.disconnect();
    s.g.disconnect();
  };

  active.delete(key);
}

/**
 * Stop all playing notes
 */
export function stopAll() {
  for (const k of Array.from(active.keys())) noteOff(k);
  if (window._stopAllSustain) window._stopAllSustain();
}

/**
 * Check if a note is currently active
 */
export function isNoteActive(key) {
  return active.has(key);
}

/**
 * Get the count of currently active notes
 */
export function getActiveNoteCount() {
  return active.size;
}
