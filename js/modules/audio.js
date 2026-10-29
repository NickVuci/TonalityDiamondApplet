/** Each note owns its envelope and cancellation token, including while audio wakes up. */
export class AudioEngine {
  constructor({ contextFactory, onChange = () => {}, onStatus = () => {} } = {}) {
    this.contextFactory = contextFactory || (() => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!Context) throw new Error('Web Audio is unavailable.');
      return new Context();
    });
    this.onChange = onChange;
    this.onStatus = onStatus;
    this.context = null;
    this.master = null;
    this.warmWave = null;
    this.volume = 0.25;
    this.voices = new Map();
    this.fading = new Set();
    this.nextId = 0;
    this.resumeAttempt = null;
  }
  resume(retry) {
    if (this.context.state === 'running') {
      this.resumeAttempt?.finish(true);
      return Promise.resolve(true);
    }
    let attempt = this.resumeAttempt;
    const fresh = !attempt;
    if (fresh) {
      const ctx = this.context;
      attempt = { done: false };
      attempt.promise = new Promise(resolve => {
        attempt.finish = ready => {
          if (attempt.done) return;
          attempt.done = true;
          clearTimeout(attempt.timer);
          if (this.resumeAttempt === attempt) this.resumeAttempt = null;
          resolve(ready);
        };
      });
      // Safari can leave resume() pending when the first call was outside activation.
      attempt.timer = setTimeout(() => attempt.finish(ctx.state === 'running'), 1500);
      this.resumeAttempt = attempt;
    }
    if (fresh || retry) {
      const ctx = this.context;
      try {
        // Invoke synchronously during the new tap, even if an older call is pending.
        Promise.resolve(ctx.resume()).then(() => attempt.finish(ctx.state === 'running'), () => attempt.finish(false));
      } catch { attempt.finish(false); }
    }
    return attempt.promise;
  }
  async ensure(retry = false) {
    try {
      if (!this.context) {
        // A musical instrument needs media playback, including on iPhones in Silent Mode.
        try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; } catch { /* Optional on older Safari. */ }
        const ctx = this.contextFactory();
        const master = ctx.createGain();
        master.gain.value = this.volume * 0.55;
        // Harmonic partials only: no detuning or chorus to blur the JI relationships.
        const warmWave = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.18, 0.065, 0.025, 0.01]));
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 18;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.012;
        compressor.release.value = 0.3;
        master.connect(compressor);
        compressor.connect(ctx.destination);
        this.context = ctx; this.master = master; this.warmWave = warmWave;
        ctx.onstatechange = () => {
          if (ctx !== this.context) return;
          if (ctx.state === 'running') this.resumeAttempt?.finish(true);
          else this.onStatus('Audio paused. Tap Enable or a note to restart sound.', true);
        };
      }
      if (!await this.resume(retry)) throw new Error('Audio needs a tap to start.');
      this.onStatus('Audio ready', false);
      return true;
    } catch {
      this.onStatus('Audio paused. Tap Enable or a note to restart sound.', true);
      return false;
    }
  }
  hasVoice(id) { return this.voices.has(id); }
  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0.25));
    this.balance();
  }
  balance() {
    if (!this.master) return;
    const count = [...this.voices.values()].filter(v => v.oscillator).length + this.fading.size;
    const target = this.volume * 0.55 / Math.pow(Math.max(1, count), 0.65);
    this.master.gain.setTargetAtTime(target, this.context.currentTime, 0.03);
  }
  notify() {
    const keys = new Set([...this.voices.values()].filter(v => v.oscillator).map(v => v.key));
    this.balance();
    this.onChange(keys);
  }
  play(key, frequency, options = {}) {
    if (!Number.isFinite(frequency) || frequency < 20 || frequency > 16000) return null;
    if (this.voices.size >= 32) this.release(this.voices.keys().next().value, true);
    const id = ++this.nextId;
    this.voices.set(id, { key, frequency, options, timer: null });
    void this.start(id);
    return id;
  }
  async start(id) {
    const ready = await this.ensure();
    const voice = this.voices.get(id);
    if (!voice) return; // Stop, keyup, or a new grid may have cancelled a pending start.
    if (!ready) { this.voices.delete(id); this.notify(); return; }
    try {
      const ctx = this.context;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      Object.assign(voice, { oscillator, gain, started: ctx.currentTime });
      const warm = !voice.options.wave || voice.options.wave === 'warm';
      voice.attack = Math.max(0.001, Math.min(1, (voice.options.attack ?? 60) / 1000));
      voice.peak = 0.65 * (warm ? Math.min(1, Math.pow(900 / voice.frequency, 0.6)) : 1);
      if (warm) {
        oscillator.setPeriodicWave(this.warmWave);
        voice.filter = ctx.createBiquadFilter();
        voice.filter.type = 'lowpass';
        voice.filter.frequency.value = Math.min(2800, Math.max(900, voice.frequency * 3));
        voice.filter.Q.value = 0.5;
      } else oscillator.type = ['sine', 'triangle', 'square', 'sawtooth'].includes(voice.options.wave) ? voice.options.wave : 'sine';
      oscillator.frequency.value = voice.frequency;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(voice.peak, ctx.currentTime + voice.attack);
      if (voice.filter) { oscillator.connect(voice.filter); voice.filter.connect(gain); }
      else oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.onended = () => {
        oscillator.disconnect(); voice.filter?.disconnect(); gain.disconnect(); this.fading.delete(voice); this.balance();
      };
      oscillator.start();
      if (Number.isFinite(voice.options.duration)) {
        voice.timer = setTimeout(() => this.release(id), voice.options.duration);
      }
      this.notify();
    } catch {
      this.release(id, true);
      this.onStatus('This note could not be played. Try again.', true);
    }
  }
  release(id, fast = false) {
    const voice = this.voices.get(id);
    if (!voice) return;
    clearTimeout(voice.timer);
    this.voices.delete(id);
    if (voice.oscillator) {
      const now = this.context.currentTime;
      const gain = voice.gain.gain;
      const release = fast ? 0.025 : Math.max(0.03, Math.min(3, (voice.options.release ?? 900) / 1000));
      if (typeof gain.cancelAndHoldAtTime === 'function') {
        gain.cancelAndHoldAtTime(now);
      } else {
        // The only scheduled segment before release is our linear attack.
        const current = voice.peak * Math.min(1, Math.max(0, (now - voice.started) / voice.attack));
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(current, now);
      }
      gain.setTargetAtTime(0, now, release / 5);
      gain.setValueAtTime(0, now + release);
      voice.oscillator.stop(now + release + 0.01);
      this.fading.add(voice);
    }
    this.notify();
  }
  stopAll() {
    for (const id of [...this.voices.keys()]) this.release(id, true);
    // Also cut long release tails from notes that have already been released.
    for (const voice of this.fading) {
      const now = this.context.currentTime;
      const gain = voice.gain.gain;
      if (typeof gain.cancelAndHoldAtTime === 'function') gain.cancelAndHoldAtTime(now);
      else { gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now); }
      gain.linearRampToValueAtTime(0, now + 0.025);
      voice.oscillator.stop(now + 0.035);
    }
  }
}
