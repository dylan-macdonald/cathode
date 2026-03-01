export class MusicManager {
  private _ctx: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _activeOscillators: OscillatorNode[] = [];
  private _activeGains: GainNode[] = [];

  init(): void {
    if (typeof AudioContext === 'undefined') return;
    try {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.setValueAtTime(0.15, this._ctx.currentTime);
      this._masterGain.connect(this._ctx.destination);
    } catch {
      this._ctx = null;
      this._masterGain = null;
    }
  }

  private _ensureContext(): boolean {
    if (!this._ctx || !this._masterGain) return false;
    // Resume suspended context (browser autoplay policy)
    if (this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {});
    }
    return true;
  }

  private _createOscillator(
    type: OscillatorType,
    frequency: number,
    gainValue: number,
  ): { osc: OscillatorNode; gain: GainNode } | null {
    if (!this._ensureContext() || !this._ctx || !this._masterGain) return null;

    const osc = this._ctx.createOscillator();
    const gain = this._ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, this._ctx.currentTime);
    gain.gain.setValueAtTime(gainValue, this._ctx.currentTime);

    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start();

    this._activeOscillators.push(osc);
    this._activeGains.push(gain);

    return { osc, gain };
  }

  playChannelDrone(channelId: string): void {
    this.stopAll();
    if (!this._ensureContext() || !this._ctx || !this._masterGain) return;

    const now = this._ctx.currentTime;

    if (channelId === 'static') {
      // Low rumble: 55Hz + 82.5Hz sawtooth with slow LFO modulation
      const pair1 = this._createOscillator('sawtooth', 55, 0.4);
      const pair2 = this._createOscillator('sawtooth', 82.5, 0.25);

      if (pair1 && pair2) {
        // Slow LFO on the 55Hz oscillator gain (0.1 Hz rate)
        const lfo = this._ctx.createOscillator();
        const lfoGain = this._ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.setValueAtTime(0.1, now);
        lfoGain.gain.setValueAtTime(0.15, now);
        lfo.connect(lfoGain);
        lfoGain.connect(pair1.gain.gain);
        lfo.start();
        this._activeOscillators.push(lfo);
        this._activeGains.push(lfoGain);
      }
    } else if (channelId === 'test_pattern') {
      // Clean sine tones: 220Hz + 330Hz + 440Hz, very quiet
      this._createOscillator('sine', 220, 0.2);
      this._createOscillator('sine', 330, 0.15);
      this._createOscillator('sine', 440, 0.1);
    } else if (channelId === 'emergency') {
      // Pulsing alarm: 440Hz square wave with rhythmic gain modulation (0.5s on/off)
      const pair = this._createOscillator('square', 440, 0.5);
      if (pair) {
        // Rhythmic gain modulation: on for 0.5s, off for 0.5s, repeat
        const g = pair.gain.gain;
        g.cancelScheduledValues(now);
        g.setValueAtTime(0, now);
        // Schedule 30 seconds of on/off pulses
        for (let i = 0; i < 60; i++) {
          g.setValueAtTime(0.5, now + i);
          g.setValueAtTime(0, now + i + 0.5);
        }
      }
    } else if (channelId === 'late_night') {
      // Warm low hum: 110Hz triangle + 165Hz sine, gentle
      this._createOscillator('triangle', 110, 0.35);
      this._createOscillator('sine', 165, 0.2);
    }
  }

  playBossMusic(): void {
    if (!this._ensureContext() || !this._ctx || !this._masterGain) return;

    const now = this._ctx.currentTime;

    // Add low 55Hz square wave pulse
    const pair = this._createOscillator('square', 55, 0.3);
    if (pair) {
      // Rhythmic pulse: on for 0.25s, off for 0.25s
      const g = pair.gain.gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(0, now);
      for (let i = 0; i < 120; i++) {
        g.setValueAtTime(0.3, now + i * 0.5);
        g.setValueAtTime(0, now + i * 0.5 + 0.25);
      }
    }

    // Slightly increase master gain for intensity
    this._masterGain.gain.linearRampToValueAtTime(0.22, now + 1.0);
  }

  playRepairShopAmbient(): void {
    this.stopAll();
    if (!this._ensureContext() || !this._ctx || !this._masterGain) return;

    const now = this._ctx.currentTime;

    // Warm 60Hz hum
    this._createOscillator('sine', 60, 0.4);

    // Occasional crackle: random noise bursts using brief white noise via buffer source
    this._scheduleRepairCrackles(now);
  }

  private _scheduleRepairCrackles(startTime: number): void {
    if (!this._ctx || !this._masterGain) return;

    const ctx = this._ctx;
    const masterGain = this._masterGain;

    const scheduleCrackle = (time: number): void => {
      const bufferSize = ctx.sampleRate * 0.05; // 50ms crackle
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.3;
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      source.connect(gain);
      gain.connect(masterGain);
      source.start(time);

      // Schedule next crackle at a random interval (1-5 seconds)
      const nextDelay = 1 + Math.random() * 4;
      const nextTime = time + 0.05 + nextDelay;

      // Only schedule if context is still active
      if (ctx.state !== 'closed') {
        setTimeout(() => scheduleCrackle(ctx.currentTime), nextDelay * 1000);
      }
    };

    scheduleCrackle(startTime + 1.5);
  }

  stopAll(): void {
    for (const osc of this._activeOscillators) {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // Already stopped or disconnected
      }
    }
    for (const gain of this._activeGains) {
      try {
        gain.disconnect();
      } catch {
        // Already disconnected
      }
    }
    this._activeOscillators = [];
    this._activeGains = [];

    // Reset master gain to default
    if (this._masterGain && this._ctx) {
      this._masterGain.gain.setValueAtTime(0.15, this._ctx.currentTime);
    }
  }

  crossfade(newChannelId: string, durationMs: number): void {
    if (!this._ensureContext() || !this._ctx || !this._masterGain) return;

    const durationSec = durationMs / 1000;
    const now = this._ctx.currentTime;

    // Fade out current master gain
    this._masterGain.gain.linearRampToValueAtTime(0, now + durationSec * 0.5);

    // After fade-out, stop current and start new channel
    setTimeout(() => {
      this.stopAll();
      if (!this._ctx || !this._masterGain) return;
      // Fade in new channel
      this._masterGain.gain.setValueAtTime(0, this._ctx.currentTime);
      this.playChannelDrone(newChannelId);
      this._masterGain.gain.linearRampToValueAtTime(0.15, this._ctx.currentTime + durationSec * 0.5);
    }, durationMs * 0.5);
  }

  setVolume(v: number): void {
    if (!this._masterGain || !this._ctx) return;
    this._masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), this._ctx.currentTime);
  }
}
