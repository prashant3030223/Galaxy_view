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