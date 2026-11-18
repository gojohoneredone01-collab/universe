class AudioEngine {
  private ctx: AudioContext | null = null;
  private muted: boolean = false;
  private thrusterOsc: OscillatorNode | null = null;
  private thrusterNoise: AudioBufferSourceNode | null = null;
  private thrusterGain: GainNode | null = null;
  private thrusterActive: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.setThrusterActive(false);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioCtx) return null;
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      if (!this.noiseBuffer && this.ctx) {
        const sampleRate = this.ctx.sampleRate;
        const length = sampleRate * 1.5;
        const buffer = this.ctx.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  public playLaunch(powerRatio: number): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx || this.muted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const startFreq = 110 + powerRatio * 60;
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.24);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.27);

      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(420, now);
        filter.Q.setValueAtTime(1.4, now);

        const nGain = ctx.createGain();
        nGain.gain.setValueAtTime(0.001, now);
        nGain.gain.linearRampToValueAtTime(0.08, now + 0.015);
        nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        noise.connect(filter);
        filter.connect(nGain);
        nGain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.24);
      }
    } catch {
      // Ignore audio errors if blocked by browser policy
    }
  }

  public setThrusterActive(active: boolean): void {
    if (this.muted) active = false;
    if (active === this.thrusterActive) return;
    this.thrusterActive = active;

    try {
      const ctx = this.ctx;
      if (active) {
        const activeCtx = this.ensureContext();
        if (!activeCtx) {
          this.thrusterActive = false;
          return;
        }
        const now = activeCtx.currentTime;

        if (!this.thrusterGain) {
          this.thrusterGain = activeCtx.createGain();
          this.thrusterGain.gain.setValueAtTime(0.0001, now);
          this.thrusterGain.connect(activeCtx.destination);

          const osc = activeCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(64, now);
          const oscGain = activeCtx.createGain();
          oscGain.gain.setValueAtTime(0.45, now);
          osc.connect(oscGain);
          oscGain.connect(this.thrusterGain);
          osc.start(now);
          this.thrusterOsc = osc;

          if (this.noiseBuffer) {
            const noise = activeCtx.createBufferSource();
            noise.buffer = this.noiseBuffer;
            noise.loop = true;
            const filter = activeCtx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(260, now);
            const noiseGain = activeCtx.createGain();
            noiseGain.gain.setValueAtTime(0.4, now);
            noise.connect(filter);
            filter.connect(noiseGain);
            noiseGain.connect(this.thrusterGain);
            noise.start(now);
            this.thrusterNoise = noise;
          }
        }

        this.thrusterGain.gain.cancelScheduledValues(now);
        this.thrusterGain.gain.setValueAtTime(
          Math.max(0.0001, this.thrusterGain.gain.value),
          now
        );
        this.thrusterGain.gain.linearRampToValueAtTime(0.09, now + 0.05);
      } else if (ctx && this.thrusterGain) {
        const now = ctx.currentTime;
        this.thrusterGain.gain.cancelScheduledValues(now);
        this.thrusterGain.gain.setValueAtTime(
          Math.max(0.0001, this.thrusterGain.gain.value),
          now
        );
        this.thrusterGain.gain.linearRampToValueAtTime(0.0001, now + 0.06);
      }
    } catch {
      // Ignore audio errors
    }
  }

  public playDockingPing(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx || this.muted) return;

      const now = ctx.currentTime;
      const freqs = [660, 990];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0.0001, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(idx === 0 ? 0.13 : 0.07, now + idx * 0.06 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.65);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.7);
      });
    } catch {
      // Ignore audio errors
    }
  }

  public playImpactStatic(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx || this.muted) return;

      const now = ctx.currentTime;
      if (this.noiseBuffer) {
        const noise = ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(900, now);
        filter.frequency.exponentialRampToValueAtTime(140, now + 0.28);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start(now);
        noise.stop(now + 0.32);
      }

      const thud = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(95, now);
      thud.frequency.exponentialRampToValueAtTime(32, now + 0.22);
      thudGain.gain.setValueAtTime(0.16, now);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      thud.connect(thudGain);
      thudGain.connect(ctx.destination);
      thud.start(now);
      thud.stop(now + 0.25);
    } catch {
      // Ignore audio errors
    }
  }

  public playUiTick(): void {
    try {
      const ctx = this.ensureContext();
      if (!ctx || this.muted) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // Ignore audio errors
    }
  }

  public dispose(): void {
    this.setThrusterActive(false);
    try {
      this.thrusterOsc?.stop();
      this.thrusterNoise?.stop();
      if (this.ctx && this.ctx.state !== 'closed') {
        void this.ctx.close();
      }
    } catch {
      // Ignore cleanup errors
    }
    this.thrusterOsc = null;
    this.thrusterNoise = null;
    this.thrusterGain = null;
    this.ctx = null;
  }
}

export const audioEngine = new AudioEngine();
