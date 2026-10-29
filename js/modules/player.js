/** Musical gestures and cancellable sequences, independent of the rendered grid. */
export class Player {
  constructor(audio, { options = () => ({}), onNote = () => {}, onSequence = () => {} } = {}) {
    this.audio = audio;
    this.options = options;
    this.onNote = onNote;
    this.onSequence = onSequence;
    this.latched = new Map();
    this.shiftHeld = new Map();
    this.timers = new Set();
    this.generation = 0;
  }
  play(note, kind = 'pulse') {
    if (note.frequency < 20 || note.frequency > 16000) return null;
    const held = kind === 'latch' ? this.latched : kind === 'shift' ? this.shiftHeld : null;
    this.pruneHeld();
    if (held?.has(note.key)) {
      if (kind === 'latch') { this.audio.release(held.get(note.key)); held.delete(note.key); }
      return null;
    }
    // A pulse on a sustained pitch should not double its volume.
    if (!held && (this.latched.has(note.key) || this.shiftHeld.has(note.key))) return null;
    const opts = { ...this.options() };
    if (kind === 'pulse') opts.duration = opts.wave === 'warm' ? 320 : 180;
    const id = this.audio.play(note.key, note.frequency, opts);
    if (id !== null) {
      held?.set(note.key, id);
      this.onNote(note);
    }
    return id;
  }
  pruneHeld() {
    // A failed start or a stolen voice must be playable again on the next gesture.
    for (const map of [this.latched, this.shiftHeld]) {
      for (const [key, id] of map) if (this.audio.hasVoice && !this.audio.hasVoice(id)) map.delete(key);
    }
  }
  releaseHeld(kind) {
    const held = kind === 'latch' ? this.latched : this.shiftHeld;
    for (const id of held.values()) this.audio.release(id);
    held.clear();
  }
  chord(notes, kind = 'pulse') {
    this.pruneHeld();
    const unique = [...new Map(notes.map(n => [n.key, n])).values()];
    if (kind === 'latch' && unique.every(n => this.latched.has(n.key))) {
      unique.forEach(n => { this.audio.release(this.latched.get(n.key)); this.latched.delete(n.key); });
    } else {
      unique.forEach(n => { if (kind !== 'latch' || !this.latched.has(n.key)) this.play(n, kind); });
    }
  }
  sequence(notes, bpm) {
    this.cancelSequence();
    const generation = this.generation;
    const step = 60000 / bpm / 2;
    const playable = notes.filter(n => n.frequency >= 20 && n.frequency <= 16000);
    if (!playable.length) return;
    this.onSequence(true);
    const schedule = (callback, delay) => {
      const id = setTimeout(() => {
        this.timers.delete(id);
        if (generation === this.generation) callback();
      }, delay);
      this.timers.add(id);
    };
    // Begin inside the gesture so the first note can unlock audio.
    this.play(playable[0]);
    playable.slice(1).forEach((note, i) => schedule(() => this.play(note), (i + 1) * step));
    schedule(() => this.onSequence(false), playable.length * step);
  }
  cancelSequence() {
    this.generation++;
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.onSequence(false);
  }
  stop() {
    this.cancelSequence();
    this.latched.clear();
    this.shiftHeld.clear();
    this.audio.stopAll();
  }
}
