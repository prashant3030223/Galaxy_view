// Sound Controller using Web Audio API
class SoundController {
  constructor() {
    this.ctx = null;
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.filter = null;
    this.lfo = null;
    this.masterGain = null;
    this.isEnabled = false;
  }
  
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Master gain
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);
    
    // Low pass filter
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.Q.setValueAtTime(2.0, this.ctx.currentTime);
    this.filter.frequency.setValueAtTime(100, this.ctx.currentTime);
    this.filter.connect(this.masterGain);
    
    // Sawtooth drone (low chord)
    this.droneOsc1 = this.ctx.createOscillator();
    this.droneOsc1.type = "sawtooth";
    this.droneOsc1.frequency.setValueAtTime(55.0, this.ctx.currentTime); // A1 note
    
    // Triangle drone (fifth)
    this.droneOsc2 = this.ctx.createOscillator();
    this.droneOsc2.type = "triangle";
    this.droneOsc2.frequency.setValueAtTime(82.41, this.ctx.currentTime); // E2 note
    
    const gain1 = this.ctx.createGain();
    const gain2 = this.ctx.createGain();
    gain1.gain.setValueAtTime(0.08, this.ctx.currentTime);
    gain2.gain.setValueAtTime(0.12, this.ctx.currentTime);
    
    this.droneOsc1.connect(gain1);
    this.droneOsc2.connect(gain2);
    
    gain1.connect(this.filter);
    gain2.connect(this.filter);
    
    // LFO for filter frequency modulation (breathing effect)
    this.lfo = this.ctx.createOscillator();
    this.lfo.frequency.setValueAtTime(0.06, this.ctx.currentTime); // 16s cycle
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.setValueAtTime(35, this.ctx.currentTime);
    
    this.lfo.connect(lfoGain);
    lfoGain.connect(this.filter.frequency);
    
    // Start oscillators
    this.droneOsc1.start();
    this.droneOsc2.start();
    this.lfo.start();
  }
  
  toggle() {
    if (!this.ctx) this.init();
    
    if (this.isEnabled) {
      // Fade out
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 1.0);
      setTimeout(() => {
        if (!this.isEnabled && this.ctx) this.ctx.suspend();
      }, 1000);
      this.isEnabled = false;
    } else {
      // Fade in
      this.ctx.resume();
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, this.ctx.currentTime);
      this.masterGain.gain.linearRampToValueAtTime(0.4, this.ctx.currentTime + 1.2);
      this.isEnabled = true;
    }
    return this.isEnabled;
  }
  
  playClick() {
    if (!this.ctx || !this.isEnabled) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.05);
  }

  playSelect() {
    if (!this.ctx || !this.isEnabled) return;
    const time = this.ctx.currentTime;
    const notes = [587.33, 739.99, 880.00]; // D5, F#5, A5
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, time + idx * 0.06);
      
      gain.gain.setValueAtTime(0, time + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.04, time + idx * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + idx * 0.06 + 0.2);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(time + idx * 0.06);
      osc.stop(time + idx * 0.06 + 0.2);
    });
  }
}

// Main Application
class SolarSystemApp {
  constructor() {
    this.spaceCanvas = new SpaceCanvas("space-viewport");
    this.sound = new SoundController();

    // Simulation Time