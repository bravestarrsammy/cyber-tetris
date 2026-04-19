class SoundManager {
  private ctx: AudioContext | null = null;
  private sfxEnabled: boolean = true;
  private musicEnabled: boolean = true;

  setSFXEnabled(enabled: boolean) {
    this.sfxEnabled = enabled;
  }

  setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    }
  }

  getSettings() {
    return { sfx: this.sfxEnabled, music: this.musicEnabled };
  }

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if it's suspended (required by many browsers after a user gesture)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Globally resume audio on any user interaction to keep the context alive
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public playTone(freq: number, type: OscillatorType, duration: number, volume: number = 0.1) {
    if (!this.sfxEnabled) return;
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
    if (!this.sfxEnabled) return;
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
    if (!this.sfxEnabled) return;
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
    if (!this.sfxEnabled) return;
    this.stopMusic();
    this.initCtx();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const duration = 1.0;

    // A low, descending dissonant tone
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';

    osc1.frequency.setValueAtTime(110, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + duration);

    osc2.frequency.setValueAtTime(115, now); // Dissonance
    osc2.frequency.exponentialRampToValueAtTime(45, now + duration);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.linearRampToValueAtTime(0, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  private musicSource: OscillatorNode | null = null;
  private musicGain: GainNode | null = null;
  private musicInterval: any = null;

  startMenuMusic() {
    if (!this.musicEnabled) return;
    this.stopMusic();
    this.initCtx();
    if (!this.ctx) return;

    const tempo = 120;
    const noteLength = 60 / tempo;
    const scale = [110, 130.81, 146.83, 164.81, 196, 220]; 

    let step = 0;
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      if (this.ctx.state !== 'running') {
        this.ctx.resume();
        return;
      }
      const now = this.ctx.currentTime;
      
      const freq = scale[Math.floor(Math.random() * scale.length)] * (step % 2 === 0 ? 1 : 2);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq / 2, now + 0.1);
      
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1200 + Math.sin(now) * 600, now);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.2);

      if (step % 4 === 0) {
        const bassOsc = this.ctx.createOscillator();
        const bassGain = this.ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(55, now);
        bassGain.gain.setValueAtTime(0.08, now);
        bassGain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        bassOsc.connect(bassGain);
        bassGain.connect(this.ctx.destination);
        bassOsc.start(now);
        bassOsc.stop(now + 0.5);
      }
      step++;
    }, noteLength * 500);
  }

  startGameMusic(level: number = 1) {
    if (!this.musicEnabled) return;
    this.stopMusic();
    this.initCtx();
    if (!this.ctx) return;

    // Tempo scales from 85 to 125 based on level (caps at level 10)
    const baseTempo = 85;
    const levelBonus = Math.min(level - 1, 9) * 4.4; 
    const tempo = baseTempo + levelBonus; 
    const beatLength = 60 / tempo;
    
    // Atmospheric minor/phrygian feel
    const scale = [130.81, 138.59, 155.56, 174.61, 196, 207.65]; 

    let step = 0;
    this.musicInterval = setInterval(() => {
      if (!this.ctx) return;
      if (this.ctx.state !== 'running') {
        this.ctx.resume();
        return;
      }
      const now = this.ctx.currentTime;
      
      // Mellow rhythmic synth
      const freq = scale[Math.floor(Math.random() * scale.length)];
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle'; // Mellower than sawtooth
      osc.frequency.setValueAtTime(freq, now);
      
      gain.gain.setValueAtTime(0.025, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);
      filter.Q.setValueAtTime(1, now);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.3);

      // Soft Thud (Kick) on every 4th step
      if (step % 4 === 0) {
        const kickOsc = this.ctx.createOscillator();
        const kickGain = this.ctx.createGain();
        kickOsc.type = 'sine';
        kickOsc.frequency.setValueAtTime(100, now);
        kickOsc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
        
        kickGain.gain.setValueAtTime(0.08, now);
        kickGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        kickOsc.connect(kickGain);
        kickGain.connect(this.ctx.destination);
        kickOsc.start(now);
        kickOsc.stop(now + 0.2);
      }

      // Subtle atmospheric noise on steps 2 and 4
      if (step % 4 === 2) {
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = this.ctx.createGain();
        const noiseFilter = this.ctx.createBiquadFilter();
        
        noiseFilter.type = 'highpass';
        noiseFilter.frequency.setValueAtTime(8000, now);
        
        noiseGain.gain.setValueAtTime(0.01, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        
        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);
        noise.start(now);
      }

      step++;
    }, beatLength * 250); 
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
  }
}

export const sounds = new SoundManager();
