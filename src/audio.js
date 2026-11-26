// Original procedural PLATWFC soundtrack. It synthesizes its own melody and
// rhythm with Web Audio; it does not contain game soundtrack samples.
export class PLATWFCAudio {
  constructor() {
    this.context = null;
    this.master = null;
    this.timer = null;
    this.step = 0;
    this.playing = false;
    this.mood = "adventure";
    this.bpm = 116;
    this.patterns = {
      adventure: {
        root: 65,
        scale: [0, 2, 4, 7, 9, 11, 14],
        melody: [4, 2, 1, 4, 5, 4, 2, 0, 4, 6, 5, 4, 2, 1, 0, 2],
        bass: [0, 0, 4, 0, 5, 5, 4, 2, 0, 0, 4, 0, 6, 5, 4, 2]
      },
      sunset: {
        root: 60,
        scale: [0, 3, 5, 7, 10, 12, 15],
        melody: [4, 2, 1, 0, 2, 4, 5, 4, 2, 1, 3, 4, 5, 4, 2, 0],
        bass: [0, 0, 3, 3, 5, 5, 3, 2, 0, 0, 3, 3, 5, 4, 2, 0]
      },
      arcade: {
        root: 67,
        scale: [0, 2, 5, 7, 9, 12, 14],
        melody: [0, 2, 4, 5, 4, 2, 5, 6, 0, 2, 4, 6, 5, 4, 2, 0],
        bass: [0, 0, 0, 4, 5, 5, 4, 2, 0, 0, 0, 4, 5, 4, 2, 0]
      }
    };
  }

  async ensureContext() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported in this browser.");
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = 0.22;
      this.master.connect(this.context.destination);
    }
    if (this.context.state === "suspended") await this.context.resume();
  }

  midiFrequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  tone(note, start, duration, wave = "triangle", volume = 0.12, cutoff = 2600) {
    const ctx = this.context;
    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    oscillator.type = wave;
    oscillator.frequency.setValueAtTime(this.midiFrequency(note), start);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.025);
  }

  kick(start) {
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(130, start);
    osc.frequency.exponentialRampToValueAtTime(42, start + 0.13);
    gain.gain.setValueAtTime(0.22, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + 0.18);
  }

  noiseHit(start, duration, frequency, volume) {
    const length = Math.ceil(this.context.sampleRate * duration);
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration);
  }

  scheduleStep() {
    if (!this.playing || !this.context) return;
    const pattern = this.patterns[this.mood] || this.patterns.adventure;
    const beatDuration = 60 / this.bpm;
    const stepDuration = beatDuration / 4;
    const time = this.context.currentTime + 0.035;
    const step = this.step % 16;

    const melodyIndex = pattern.melody[step];
    const melodyNote = pattern.root + pattern.scale[melodyIndex];
    if (step % 2 === 0) this.tone(melodyNote + (step === 8 ? 12 : 0), time, stepDuration * 0.78, "triangle", 0.075, 3200);
    if (step % 4 === 0) {
      const bassNote = pattern.root - 24 + pattern.scale[pattern.bass[step]];
      this.tone(bassNote, time, beatDuration * 0.8, "sine", 0.15, 520);
      this.kick(time);
    }
    if (step === 4 || step === 12) this.noiseHit(time, 0.12, 900, 0.075);
    if (step % 2 === 1) this.noiseHit(time, 0.035, 6500, 0.018);
    if (step === 7 || step === 15) {
      const chord = pattern.root + (step === 7 ? 7 : 9);
      this.tone(chord, time, beatDuration * 0.52, "sine", 0.035, 1800);
    }
    this.step++;
  }

  async start() {
    await this.ensureContext();
    if (this.playing) return;
    this.playing = true;
    this.step = 0;
    this.scheduleStep();
    this.timer = window.setInterval(() => this.scheduleStep(), (60 / this.bpm / 4) * 1000);
  }

  stop() {
    this.playing = false;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  async toggle() {
    if (this.playing) {
      this.stop();
      return false;
    }
    await this.start();
    return true;
  }

  setMood(mood) {
    if (this.patterns[mood]) this.mood = mood;
  }

  setVolume(value) {
    if (this.master) this.master.gain.setTargetAtTime(
      Math.max(0, Math.min(0.5, Number(value) || 0)),
      this.context.currentTime,
      0.04
    );
  }

  dispose() {
    this.stop();
    if (this.context) this.context.close();
    this.context = null;
  }
}
