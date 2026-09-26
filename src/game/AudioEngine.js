export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
  }

  unlock() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.24;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone({ freq = 120, duration = 0.08, type = 'square', gain = 0.2, slide = 0 }) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const amp = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), now + duration);
    amp.gain.setValueAtTime(gain, now);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(amp);
    amp.connect(this.master);
    osc.start(now);
    osc.stop(now + duration);
  }

  shot(id) {
    if (id === 'shotgun') {
      this.tone({ freq: 72, duration: 0.16, type: 'sawtooth', gain: 0.42, slide: -30 });
      this.tone({ freq: 210, duration: 0.06, type: 'square', gain: 0.16, slide: -80 });
    } else if (id === 'smg') {
      this.tone({ freq: 130, duration: 0.055, type: 'square', gain: 0.22, slide: -40 });
    } else {
      this.tone({ freq: 100, duration: 0.09, type: 'square', gain: 0.28, slide: -50 });
    }
  }

  hit(headshot = false) {
    this.tone({ freq: headshot ? 980 : 650, duration: 0.04, type: 'sine', gain: 0.11, slide: headshot ? 220 : 60 });
  }

  empty() { this.tone({ freq: 460, duration: 0.025, type: 'square', gain: 0.08, slide: -120 }); }
  reload() { this.tone({ freq: 220, duration: 0.05, type: 'square', gain: 0.08, slide: 110 }); }
  wave() { this.tone({ freq: 320, duration: 0.18, type: 'sine', gain: 0.12, slide: 600 }); }
  damage() { this.tone({ freq: 62, duration: 0.18, type: 'sawtooth', gain: 0.17, slide: -20 }); }
  victory() {
    this.tone({ freq: 330, duration: 0.16, type: 'square', gain: 0.11, slide: 160 });
    setTimeout(() => this.tone({ freq: 520, duration: 0.18, type: 'square', gain: 0.09, slide: 190 }), 130);
    setTimeout(() => this.tone({ freq: 790, duration: 0.36, type: 'sine', gain: 0.08, slide: 170 }), 290);
  }

  destroy() { this.ctx?.close(); }
}
