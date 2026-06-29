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
    this.epochStart = Date.now();
    this.simTimeDays = 0; // days since epoch
    this.isPlaying = true;
    
    // Speed multiplier state (days per real-world second)
    // Real rate is 1 second per second = 1 / (24 * 3600) days per second
    const SEC_TO_DAYS = 1 / 86400;
    this.speedRates = [
      0, 
      SEC_TO_DAYS,                // slider 1: 1s/s
      SEC_TO_DAYS,                // slider 2: 1s/s (Real Rate)
      SEC_TO_DAYS * 3600,         // slider 3: 1 hour/s
      1,                          // slider 4: 1 day/s
      7,                          // slider 5: 7 days/s
      30,                         // slider 6: 30 days/s
      365,                        // slider 7: 1 year/s
      3650                        // slider 8: 10 years/s
    ];
    this.speedIndex = 2; // Default to index 2 (REAL RATE)
    
    this.lastTime = performance.now();

    // Planet details mini spinning visualizer
    this.detailCanvas = document.getElementById("detail-planet-canvas");
    this.detailCtx = this.detailCanvas ? this.detailCanvas.getContext("2d") : null;
    this.planetSpinAngle = 0;

    // Init UI and bind event listeners
    this.initUI();
    this.loop();
  }

  initUI() {
    // 1. Play/Pause
    const playPauseBtn = document.getElementById("play-pause-btn");
    if (playPauseBtn) {
      playPauseBtn.addEventListener("click", () => {
        this.sound.playClick();
        this.isPlaying = !this.isPlaying;
        playPauseBtn.innerHTML = this.isPlaying ? "<i>Pause</i>" : "<i>Play</i>";
        playPauseBtn.classList.toggle("paused", !this.isPlaying);
      });
    }

    // 2. Speed Slider Control
    const rateSlider = document.getElementById("rate-slider");
    const rateLabel = document.getElementById("rate-label");
    if (rateSlider) {
      rateSlider.addEventListener("input", (e) => {
        this.sound.playClick();
        const sliderVal = parseInt(e.target.value);
        
        if (sliderVal === 0) {
          this.isPlaying = false;
          rateLabel.textContent = "PAUSED";
        } else {
          this.isPlaying = true;
          const sign = sliderVal < 0 ? -1 : 1;
          const idx = Math.abs(sliderVal);
          
          let displayLabel = "REAL RATE";
          if (idx === 3) {
            displayLabel = "1 HOUR / SEC";
          } else if (idx === 4) {
            displayLabel = "1 DAY / SEC";
          } else if (idx === 5) {
            displayLabel = "7 DAYS / SEC";
          } else if (idx === 6) {
            displayLabel = "30 DAYS / SEC";
          } else if (idx === 7) {
            displayLabel = "1 YEAR / SEC";
          } else if (idx === 8) {
            displayLabel = "10 YEARS / SEC";
          } else if (idx === 1) {
            displayLabel = "1 SEC / SEC";
          }
          
          if (sign < 0) {
            displayLabel = `REVERSE ${displayLabel}`;
          }
          
          rateLabel.textContent = displayLabel;
          // Apply speed index
          this.speedIndex = sliderVal;
        }
      });
    }

    // 3. Date Time Tapping
    const liveIndicator = document.getElementById("live-indicator");
    if (liveIndicator) {
      liveIndicator.addEventListener("click", () => {
        this.sound.playSelect();
        // Reset simulation time to match exact real world time
        this.epochStart = Date.now();
        this.simTimeDays = 0;
        if (rateSlider) rateSlider.value = 2; // reset rate to 2 (real rate)
        if (rateLabel) rateLabel.textContent = "REAL RATE";
        this.speedIndex = 2;
        this.isPlaying = true;
        this.spaceCanvas.resetView();
        this.selectBody(null);
      });
    }

    // 4. Viewport tapping
    this.spaceCanvas.canvas.addEventListener("click", (e) => {
      // If we clicked while dragging, do not select
      if (this.spaceCanvas.isDragging) return;

      const hovered = this.spaceCanvas.hoveredBody;
      if (hovered) {
        this.sound.playSelect();
        this.selectBody(hovered);
      }
    });

    // 5. Sound toggle
    const audioBtn = document.getElementById("audio-toggle-btn");
    if (audioBtn) {
      audioBtn.addEventListener("click", () => {
        const isSoundOn = this.sound.toggle();
        audioBtn.classList.toggle("sound-on", isSoundOn);
        audioBtn.innerHTML = isSoundOn ? "<i>Audio: ON</i>" : "<i>Audio: OFF</i>";
      });
    }

    // 6. Navigation Controls
    const btnZoomIn = document.getElementById("btn-zoom-in");
    const btnZoomOut = document.getElementById("btn-zoom-out");
    const btnReset = document.getElementById("btn-reset");
    const btnDragMode = document.getElementById("btn-drag-mode");

    if (btnZoomIn) {
      btnZoomIn.addEventListener("click", () => {
        this.sound.playClick();
        this.spaceCanvas.targetZoom = Math.min(45.0, this.spaceCanvas.targetZoom * 1.35);
      });
    }
    if (btnZoomOut) {
      btnZoomOut.addEventListener("click", () => {
        this.sound.playClick();
        this.spaceCanvas.targetZoom = Math.max(0.1, this.spaceCanvas.targetZoom / 1.35);
      });
    }
    if (btnReset) {
      btnReset.addEventListener("click", () => {
        this.sound.playClick();
        this.spaceCanvas.resetView();
        this.selectBody(null);
      });
    }
    if (btnDragMode) {
      btnDragMode.addEventListener("click", () => {
        this.sound.playClick();
        const isRotate = this.spaceCanvas.dragMode === "rotate";
        this.spaceCanvas.dragMode = isRotate ? "pan" : "rotate";
        btnDragMode.innerHTML = isRotate ? "<i>Mode: PAN</i>" : "<i>Mode: ROTATE</i>";
        btnDragMode.classList.toggle("mode-pan", !isRotate);
      });
    }

    // 7. Search Bar
    const searchBtn = document.getElementById("search-btn");
    const searchModal = document.getElementById("search-modal");
    const searchInput = document.getElementById("search-input");
    const searchResults = document.getElementById("search-results");

    if (searchBtn && searchModal) {
      searchBtn.addEventListener("click", () => {
        this.sound.playClick();
        searchModal.classList.toggle("open");
        if (searchModal.classList.contains("open") && searchInput) {
          searchInput.value = "";
          searchInput.focus();
          this.renderSearchResults("");
        }
      });
    }

    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.renderSearchResults(e.target.value);
      });
    }

    // Close search modal when clicking outside contents
    if (searchModal) {
      searchModal.addEventListener("click", (e) => {
        if (e.target === searchModal) {
          searchModal.classList.remove("open");
        }
      });
    }

    // 8. Close Planet Details sheet
    const closeDetailsBtn = document.getElementById("close-details-btn");
    if (closeDetailsBtn) {
      closeDetailsBtn.addEventListener("click", () => {
        this.sound.playClick();
        this.selectBody(null);
      });
    }
  }

  // Populate search result items
  renderSearchResults(query) {
    const resultsDiv = document.getElementById("search-results");
    if (!resultsDiv) return;

    resultsDiv.innerHTML = "";
    const cleanQuery = query.toLowerCase().trim();

    // Filter items
    const bodies = [
      SOLAR_SYSTEM_DATA.sun,
      ...SOLAR_SYSTEM_DATA.planets,
      ...SOLAR_SYSTEM_DATA.spacecraft
    ];

    const matches = bodies.filter(b => b.name.toLowerCase().includes(cleanQuery));

    if (matches.length === 0) {
      resultsDiv.innerHTML = `<div class="search-empty">No objects found</div>`;
      return;
    }

    matches.forEach(body => {
      const item = document.createElement("div");
      item.className = "search-item";
      
      let typeLabel = body.type.toUpperCase();
      if (body.id === "sun") typeLabel = "STAR";

      item.innerHTML = `
        <span class="search-item-dot" style="background-color: ${body.color}"></span>
        <div class="search-item-info">
          <div class="search-item-name">${body.name}</div>
          <div class="search-item-type">${typeLabel}</div>
        </div>
      `;

      item.addEventListener("click", () => {
        this.sound.playSelect();
        this.selectBody(body);
        document.getElementById("search-modal").classList.remove("open");
      });

      resultsDiv.appendChild(item);
    });
  }

  // Handle selected celestial body
  selectBody(body) {
    this.spaceCanvas.focusOn(body ? body : SOLAR_SYSTEM_DATA.sun);
    
    // If we passed null, close details sheet
    const sheet = document.getElementById("details-sheet");
    if (!sheet) return;

    if (!body) {
      sheet.classList.remove("open");
      this.spaceCanvas.selectedBody = null;
      return;
    }

    this.spaceCanvas.selectedBody = body;

    // Fill sheet contents
    document.getElementById("detail-name").textContent = body.name.toUpperCase();
    document.getElementById("detail-type").textContent = body.type === "star" ? "YELLOW STAR" : body.type.toUpperCase();
    document.getElementById("detail-type").style.color = body.color;
    document.getElementById("detail-desc").textContent = body.description;

    // Render Stats list
    const statsGrid = document.getElementById("detail-stats");
    statsGrid.innerHTML = "";
    Object.entries(body.stats || {}).forEach(([key, val]) => {
      const row = document.createElement("div");
      row.className = "stat-row";
      row.innerHTML = `
        <span class="stat-name">${key.toUpperCase()}</span>
        <span class="stat-val">${val}</span>
      `;
      statsGrid.appendChild(row);
    });

    // Moons display
    const moonsDiv = document.getElementById("detail-moons-list");
    const moonsSection = document.getElementById("detail-moons-section");
    if (moonsDiv && moonsSection) {
      if (body.moons && body.moons.length > 0) {
        moonsSection.style.display = "block";
        moonsDiv.innerHTML = body.moons.map(m => `<span class="moon-pill">${m.name}</span>`).join("");
      } else {
        moonsSection.style.display = "none";
      }
    }

    // Fun facts
    const factsDiv = document.getElementById("detail-facts-list");
    if (factsDiv) {
      factsDiv.innerHTML = (body.funFacts || []).map(fact => `<li>${fact}</li>`).join("");
    }

    // Slide up sheet
    sheet.classList.add("open");

    // Reset rotating planet angle
    this.planetSpinAngle = 0;
  }

  // Frame update loop
  loop() {
    const now = performance.now();
    const dt = (now - this.lastTime) / 1000; // in seconds
    this.lastTime = now;

    if (this.isPlaying) {
      // Calculate current simulation speed (days per second)
      const sign = this.speedIndex < 0 ? -1 : 1;
      const index = Math.abs(this.speedIndex);
      const daysPerSec = this.speedRates[index] * sign;
      
      // Update simulation time
      this.simTimeDays += daysPerSec * dt;
    }

    // Update Date HUD
    this.updateDateHUD();

    // Render 3D viewport
    this.spaceCanvas.draw(
      this.simTimeDays,
      SOLAR_SYSTEM_DATA.sun,
      SOLAR_SYSTEM_DATA.planets,
      SOLAR_SYSTEM_DATA.spacecraft
    );

    // Draw the detail spinning planet representation
    this.drawDetailPlanet(dt);

    requestAnimationFrame(() => this.loop());
  }

  // Update date/time string in the control bar
  updateDateHUD() {
    const timestamp = this.epochStart + (this.simTimeDays * 24 * 60 * 60 * 1000);
    const date = new Date(timestamp);

    const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = monthNames[date.getMonth()];
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    const timeStr = `${String(hours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;

    // Update values
    const dateSpan = document.getElementById("hud-date");
    const timeSpan = document.getElementById("hud-time");
    
    if (dateSpan) dateSpan.textContent = `${month} ${day}, ${year}`;
    if (timeSpan) timeSpan.textContent = timeStr;
  }

  // Draw a highly polished spinning 2D canvas of the selected planet in the bottom sheet
  drawDetailPlanet(dt) {
    if (!this.detailCtx || !this.spaceCanvas.selectedBody) return;

    const ctx = this.detailCtx;
    const body = this.spaceCanvas.selectedBody;
    const width = this.detailCanvas.width;
    const height = this.detailCanvas.height;

    // Clear detail canvas
    ctx.clearRect(0, 0, width, height);

    this.planetSpinAngle += dt * 0.4; // rotation speed

    const cx = width / 2;
    const cy = height / 2;
    const size = Math.min(width, height) * 0.35;

    ctx.save();

    // Draw planet backdrop glow
    const glowGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, size * 1.4);
    glowGrad.addColorStop(0, body.color);
    glowGrad.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    glowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, size * 1.5, 0, Math.PI * 2);
    ctx.fill();
