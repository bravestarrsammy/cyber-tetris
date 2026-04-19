class SoundManager {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    this.initCtx();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    
    gain.gain.setValueAtTime(volume, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playRotate() {
    this.playTone(440, 'sine', 0.1, 0.05);
  }

  playMove() {
    this.playTone(220, 'square', 0.05, 0.02);
  }

  playDrop() {
    this.playTone(110, 'triangle', 0.1, 0.05);
  }

  playLand() {
    this.initCtx();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const duration = 0.15;
    
    // Low frequency thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + duration);
    
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start(now);
    osc.stop(now + duration);

    // Initial click/impact noise
    const noiseOsc = this.ctx.createOscillator();
    const noiseGain = this.ctx.createGain();
    noiseOsc.type = 'square';
    noiseOsc.frequency.setValueAtTime(40, now);
    noiseGain.gain.setValueAtTime(0.05, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
    noiseOsc.connect(noiseGain);
    noiseGain.connect(this.ctx.destination);
    noiseOsc.start(now);
    noiseOsc.stop(now + 0.05);
  }

  playClear() {
    this.initCtx();
    if (!this.ctx) return;
    
    const now = this.ctx.currentTime;
    const duration = 0.5;
    
    // Create noise for explosion
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, now);
    filter.frequency.exponentialRampToValueAtTime(40, now + duration);
    
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);
    
    noise.start(now);
    noise.stop(now + duration);

    // Add a low thud to the explosion
    const thud = this.ctx.createOscillator();
    const thudGain = this.ctx.createGain();
    thud.type = 'triangle';
    thud.frequency.setValueAtTime(100, now);
    thud.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    thudGain.gain.setValueAtTime(0.3, now);
    thudGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    thud.connect(thudGain);
    thudGain.connect(this.ctx.destination);
    thud.start(now);
    thud.stop(now + 0.2);
  }

  playGameOver() {
    this.playTone(110, 'sawtooth', 0.5, 0.1);
  }
}

export const sounds = new SoundManager();
