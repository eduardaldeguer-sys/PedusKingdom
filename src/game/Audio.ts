import { clamp } from './utils';

// Web Audio API based sound system
export class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicVolume: number = 0.3;
  private sfxVolume: number = 0.5;
  private isInitialized: boolean = false;
  private currentMusic: OscillatorNode | null = null;
  private musicInterval: number | null = null;
  private ambientSounds: Map<string, { osc: OscillatorNode; gain: GainNode }> = new Map();

  initialize(): void {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);
      this.masterGain.gain.value = 0.7;

      this.musicGain = this.audioContext.createGain();
      this.musicGain.connect(this.masterGain);
      this.musicGain.gain.value = this.musicVolume;

      this.sfxGain = this.audioContext.createGain();
      this.sfxGain.connect(this.masterGain);
      this.sfxGain.gain.value = this.sfxVolume;

      this.isInitialized = true;
      this.startAmbientMusic();
    } catch (e) {
      console.warn('Web Audio API not available');
    }
  }

  private startAmbientMusic(): void {
    if (!this.audioContext || !this.musicGain) return;

    // Create procedural ambient music
    const playNote = () => {
      if (!this.audioContext || !this.musicGain) return;

      const notes = [261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
      const note = notes[Math.floor(Math.random() * notes.length)];
      const octave = Math.random() > 0.5 ? 1 : 0.5;
      
      const osc = this.audioContext.createOscillator();
      const gain = this.audioContext.createGain();
      
      osc.type = Math.random() > 0.5 ? 'sine' : 'triangle';
      osc.frequency.value = note * octave;
      
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.1, this.audioContext.currentTime + 0.5);
      gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 3);
      
      osc.connect(gain);
      gain.connect(this.musicGain);
      
      osc.start();
      osc.stop(this.audioContext.currentTime + 3);
    };

    // Play initial notes
    playNote();
    setTimeout(playNote, 1000);
    setTimeout(playNote, 2000);

    // Continue playing
    this.musicInterval = window.setInterval(() => {
      if (Math.random() > 0.3) playNote();
    }, 2000 + Math.random() * 2000);
  }

  playSFX(type: 'hit' | 'collect' | 'levelup' | 'damage' | 'magic' | 'footstep' | 'death' | 'quest'): void {
    if (!this.audioContext || !this.sfxGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    switch (type) {
      case 'hit':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, this.audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.15);
        break;

      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1047, this.audioContext.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
        
        // Second tone
        const osc2 = this.audioContext.createOscillator();
        const gain2 = this.audioContext.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.1);
        osc2.frequency.exponentialRampToValueAtTime(1318, this.audioContext.currentTime + 0.2);
        gain2.gain.setValueAtTime(0.15, this.audioContext.currentTime + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
        osc2.connect(gain2);
        gain2.connect(this.sfxGain);
        osc2.start(this.audioContext.currentTime + 0.1);
        osc2.stop(this.audioContext.currentTime + 0.3);
        break;

      case 'levelup':
        // Ascending arpeggio
        const levelNotes = [523, 659, 784, 1047];
        levelNotes.forEach((freq, i) => {
          const o = this.audioContext!.createOscillator();
          const g = this.audioContext!.createGain();
          o.type = 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, this.audioContext!.currentTime + i * 0.15);
          g.gain.linearRampToValueAtTime(0.2, this.audioContext!.currentTime + i * 0.15 + 0.05);
          g.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + i * 0.15 + 0.4);
          o.connect(g);
          g.connect(this.sfxGain!);
          o.start(this.audioContext!.currentTime + i * 0.15);
          o.stop(this.audioContext!.currentTime + i * 0.15 + 0.4);
        });
        break;

      case 'damage':
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, this.audioContext.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.2);
        break;

      case 'magic':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(300, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.3);
        osc.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.5);
        break;

      case 'footstep':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(80 + Math.random() * 40, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, this.audioContext.currentTime + 0.05);
        gain.gain.setValueAtTime(0.05, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 0.05);
        break;

      case 'death':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, this.audioContext.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, this.audioContext.currentTime + 1);
        gain.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 1);
        break;

      case 'quest':
        // Fanfare
        const questNotes = [392, 523, 659, 784, 1047];
        questNotes.forEach((freq, i) => {
          const o = this.audioContext!.createOscillator();
          const g = this.audioContext!.createGain();
          o.type = i < 3 ? 'triangle' : 'sine';
          o.frequency.value = freq;
          g.gain.setValueAtTime(0, this.audioContext!.currentTime + i * 0.12);
          g.gain.linearRampToValueAtTime(0.15, this.audioContext!.currentTime + i * 0.12 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.01, this.audioContext!.currentTime + i * 0.12 + 0.5);
          o.connect(g);
          g.connect(this.sfxGain!);
          o.start(this.audioContext!.currentTime + i * 0.12);
          o.stop(this.audioContext!.currentTime + i * 0.12 + 0.5);
        });
        break;
    }
  }

  playAmbientSound(type: 'wind' | 'rain' | 'birds' | 'crickets' | 'thunder'): void {
    if (!this.audioContext || !this.musicGain) return;

    // Stop existing ambient of same type
    const existing = this.ambientSounds.get(type);
    if (existing) {
      existing.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 1);
      existing.osc.stop(this.audioContext.currentTime + 1);
      this.ambientSounds.delete(type);
    }

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    const filter = this.audioContext.createBiquadFilter();

    switch (type) {
      case 'wind':
        // White noise filtered
        const bufferSize = this.audioContext.sampleRate * 2;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = (Math.random() * 2 - 1) * 0.3;
        }
        const noise = this.audioContext.createBufferSource();
        noise.buffer = buffer;
        noise.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        gain.gain.value = 0.05;
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        noise.start();
        this.ambientSounds.set(type, { osc: noise as any, gain });
        return;

      case 'rain':
        const rainBuffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 2, this.audioContext.sampleRate);
        const rainData = rainBuffer.getChannelData(0);
        for (let i = 0; i < rainData.length; i++) {
          rainData[i] = (Math.random() * 2 - 1) * 0.2;
          if (Math.random() > 0.99) rainData[i] *= 3; // Random drops
        }
        const rainNoise = this.audioContext.createBufferSource();
        rainNoise.buffer = rainBuffer;
        rainNoise.loop = true;
        filter.type = 'highpass';
        filter.frequency.value = 2000;
        gain.gain.value = 0.08;
        rainNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicGain);
        rainNoise.start();
        this.ambientSounds.set(type, { osc: rainNoise as any, gain });
        return;

      case 'birds':
        osc.type = 'sine';
        osc.frequency.value = 2000 + Math.random() * 2000;
        gain.gain.value = 0.02;
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        this.ambientSounds.set(type, { osc, gain });
        break;

      case 'crickets':
        osc.type = 'sine';
        osc.frequency.value = 4000;
        gain.gain.value = 0.01;
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        this.ambientSounds.set(type, { osc, gain });
        break;

      case 'thunder':
        osc.type = 'sawtooth';
        osc.frequency.value = 40;
        gain.gain.setValueAtTime(0, this.audioContext.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, this.audioContext.currentTime + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 2);
        osc.connect(gain);
        gain.connect(this.musicGain);
        osc.start();
        osc.stop(this.audioContext.currentTime + 2);
        break;
    }
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume, 0, 1);
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  setSFXVolume(volume: number): void {
    this.sfxVolume = clamp(volume, 0, 1);
    if (this.sfxGain) {
      this.sfxGain.gain.value = this.sfxVolume;
    }
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = clamp(volume, 0, 1);
    }
  }

  stopAllAmbient(): void {
    this.ambientSounds.forEach((sound) => {
      if (this.audioContext) {
        sound.gain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
        sound.osc.stop(this.audioContext.currentTime + 0.5);
      }
    });
    this.ambientSounds.clear();
  }

  updateAmbientForWeather(weather: string, isDay: boolean): void {
    this.stopAllAmbient();
    
    switch (weather) {
      case 'rain':
        this.playAmbientSound('rain');
        break;
      case 'storm':
        this.playAmbientSound('rain');
        this.playAmbientSound('wind');
        break;
      case 'sandstorm':
        this.playAmbientSound('wind');
        break;
      default:
        if (isDay) {
          this.playAmbientSound('birds');
        } else {
          this.playAmbientSound('crickets');
        }
        this.playAmbientSound('wind');
    }
  }

  dispose(): void {
    this.stopAllAmbient();
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
    }
    if (this.audioContext) {
      this.audioContext.close();
    }
    this.isInitialized = false;
  }
}

// Singleton instance
let audioInstance: AudioSystem | null = null;

export function getAudioSystem(): AudioSystem {
  if (!audioInstance) {
    audioInstance = new AudioSystem();
  }
  return audioInstance;
}
