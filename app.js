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