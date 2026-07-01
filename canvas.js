class SpaceCanvas {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext("2d");

    // Camera settings
    this.zoom = 1.0;
    this.targetZoom = 1.0;
    this.panX = 0;
    this.panY = 0;
    this.targetPanX = 0;
    this.targetPanY = 0;
    this.pitch = 1.1; // Tilt angle (X-axis rotation) in radians
    this.targetPitch = 1.1;
    this.yaw = 0.5;   // Rotation angle (Y-axis rotation) in radians
    this.targetYaw = 0.5;

    this.cameraDistance = 800; // Distance for perspective calculation
    this.selectedBody = null; // Currently selected planet/spacecraft
    this.hoveredBody = null;  // Body under mouse cursor

    // Background Stars (3D coordinates)
    this.stars = [];
    this.generateStars(250);

    // Interaction states
    this.isDragging = false;
    this.dragMode = "rotate"; // "rotate" or "pan"
    this.lastMouseX = 0;
    this.lastMouseY = 0;

    // Resize handler
    this.resize();
    window.addEventListener("resize", () => this.resize());

    // Bind interaction events
    this.setupEvents();
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.scale(dpr, dpr);
  }

  generateStars(count) {
    this.stars = [];
    for (let i = 0; i < count; i++) {
      // Generate points uniformly on a sphere of radius 1200
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const r = 1000 + Math.random() * 500;

      this.stars.push({
        x: r * Math.sin(phi) * Math.cos(theta),
        y: r * Math.sin(phi) * Math.sin(theta),
        z: r * Math.cos(phi),
        brightness: 0.3 + Math.random() * 0.7,
        size: 0.5 + Math.random() * 1.5
      });
    }
  }

  // 3D coordinate rotation based on Pitch (X-axis) and Yaw (Y-axis)
  project(x, y, z) {
    // 1. Rotate around Y axis (Yaw)
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;
    const y1 = y;

    // 2. Rotate around X axis (Pitch)
    const cosX = Math.cos(this.pitch);
    const sinX = Math.sin(this.pitch);
    const x2 = x1;
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;

    // 3. Perspective Projection
    const scale = this.cameraDistance / (this.cameraDistance + z2);
    const finalZoom = this.zoom * scale;

    const screenX = (this.canvas.width / (2 * (window.devicePixelRatio || 1))) + (x2 * finalZoom) + this.panX;
    const screenY = (this.canvas.height / (2 * (window.devicePixelRatio || 1))) + (y2 * finalZoom) + this.panY;

    return {
      x: screenX,
      y: screenY,
      z: z2,
      scale: scale,
      visible: z2 > -this.cameraDistance // Clip points behind the camera
    };
  }

  // Calculate planetary position in 3D using Keplerian elements approximation
  // time parameter represents elapsed days in the simulation
  getBodyPosition(body, time) {
    if (body.id === "sun") {
      return { x: 0, y: 0, z: 0 };
    }

    const o = body.orbit;
    
    // Mean anomaly M (linear with time)
    // 360 / period in days = degrees per day. In radians: (2 * PI) / period
    const M = (time * (2 * Math.PI / o.period)) + (body.id === "mercury" ? 1.0 : body.id === "venus" ? 2.5 : body.id === "earth" ? 4.0 : 0.0);

    // Solve Kepler's equation equation of center approximation for eccentric anomaly
    // true anomaly nu
    const e = o.eccentricity;
    const nu = M + (2 * e - 0.25 * Math.pow(e, 3)) * Math.sin(M) + 
               1.25 * Math.pow(e, 2) * Math.sin(2 * M) + 
               (13 / 12) * Math.pow(e, 3) * Math.sin(3 * M);

    // Orbit radius
    const r = (o.semiMajorAxis * (1 - Math.pow(e, 2))) / (1 + e * Math.cos(nu));

    // Coordinates in the orbital plane (z' is perpendicular to the orbit plane)
    const xp = r * Math.cos(nu);
    const yp = r * Math.sin(nu);

    // Rotate to include inclination (i) and longitude of ascending node (Omega)
    const inc = o.inclination * Math.PI / 180;
    const node = o.longitudeOfAscendingNode * Math.PI / 180;
    const arg = o.argumentOfPerihelion * Math.PI / 180;

    // Standard rotation equations for Keplerian elements
    const cosNode = Math.cos(node);
    const sinNode = Math.sin(node);
    const cosArgInc = Math.cos(arg) * Math.cos(inc);
    const sinArgInc = Math.sin(arg) * Math.cos(inc);
    const sinInc = Math.sin(inc);

    // 3D position where Sun is at (0,0,0) and orbit plane is tilted
    const x = xp * (cosNode * Math.cos(arg) - sinNode * sinArgInc) - yp * (cosNode * Math.sin(arg) + sinNode * cosArgInc);
    const z = xp * (sinNode * Math.cos(arg) + cosNode * sinArgInc) - yp * (sinNode * Math.sin(arg) - cosNode * cosArgInc);
    const y = xp * (Math.sin(arg) * sinInc) + yp * (Math.cos(arg) * sinInc);

    return { x, y, z };
  }

  // Draw full scene
  draw(time, sunData, planets, spacecraft) {
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Smooth camera movements (lerp)
    this.zoom += (this.targetZoom - this.zoom) * 0.1;
    this.pitch += (this.targetPitch - this.pitch) * 0.1;
    this.yaw += (this.targetYaw - this.yaw) * 0.1;

    // Camera target tracking
    if (this.selectedBody) {
      let targetPos = { x: 0, y: 0, z: 0 };
      if (this.selectedBody.id !== "sun") {
        targetPos = this.getBodyPosition(this.selectedBody, time);
      }
      
      // Calculate target screen position and interpolate pan
      const proj = this.project(targetPos.x, targetPos.y, targetPos.z);
      
      // We want this projected point to be at the center of the canvas
      // screenX = width/2 + rotatedX * zoom * scale + panX = width/2
      // rotatedX * zoom * scale + panX = 0 => panX = -rotatedX * zoom * scale
      
      // Rotate the coordinate manually to get the pan targets
      const cosY = Math.cos(this.yaw);
      const sinY = Math.sin(this.yaw);
      const x1 = targetPos.x * cosY - targetPos.z * sinY;
      const z1 = targetPos.x * sinY + targetPos.z * cosY;
      const y1 = targetPos.y;

      const cosX = Math.cos(this.pitch);
      const sinX = Math.sin(this.pitch);
      const x2 = x1;
      const y2 = y1 * cosX - z1 * sinX;
      const z2 = y1 * sinX + z1 * cosX;

      const scale = this.cameraDistance / (this.cameraDistance + z2);

      this.targetPanX = -x2 * this.zoom * scale;
      this.targetPanY = -y2 * this.zoom * scale;
    }

    this.panX += (this.targetPanX - this.panX) * 0.1;
    this.panY += (this.targetPanY - this.panY) * 0.1;

    // Clear canvas
    this.ctx.fillStyle = "#030712"; // Deep space background
    this.ctx.fillRect(0, 0, width, height);

    // Draw Stars
    this.drawStars();

    // Prepare list of all renderable bodies
    const renderList = [];

    // Add Sun
    const sunProj = this.project(0, 0, 0);
    renderList.push({
      body: sunData,
      proj: sunProj,
      x: 0, y: 0, z: 0,
      radius: sunData.radius,
      drawOrder: sunProj.z
    });

    // Calculate planets and spacecraft positions
    const activeBodies = [...planets, ...spacecraft];
    activeBodies.forEach(body => {
      const pos = this.getBodyPosition(body, time);
      const proj = this.project(pos.x, pos.y, pos.z);
      
      // Draw orbits BEFORE drawing planets so they lie underneath
      this.drawOrbit(body, time);

      renderList.push({
        body: body,
        proj: proj,
        x: pos.x, y: pos.y, z: pos.z,
        radius: body.radius,
        drawOrder: proj.z
      });
    });

    // Sort by z-depth (draw from back to front)
    renderList.sort((a, b) => b.drawOrder - a.drawOrder);

    // Draw bodies
    this.hoveredBody = null;
    renderList.forEach(item => {
      if (item.proj.visible) {
        this.drawBody(item, time);
      }
    });
  }

  // Draw 3D background stars
  drawStars() {
    this.stars.forEach(star => {
      const proj = this.project(star.x, star.y, star.z);
      if (proj.visible && proj.scale > 0) {
        const opacity = star.brightness * (0.8 + 0.2 * Math.sin(Date.now() * 0.003 + star.x));
        this.ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, star.size * proj.scale, 0, Math.PI * 2);
        this.ctx.fill();
      }
    });
  }

  // Draw orbital ellipses
  drawOrbit(body, time) {
    if (!body.orbit) return;

    this.ctx.beginPath();
    const steps = 180;
    
    for (let i = 0; i <= steps; i++) {
      // Calculate position at angle theta
      const theta = (i / steps) * Math.PI * 2;
      const pos = this.getOrbitPoint3D(body, theta);
      const proj = this.project(pos.x, pos.y, pos.z);

      if (proj.visible) {
        if (i === 0) {
          this.ctx.moveTo(proj.x, proj.y);
        } else {
          this.ctx.lineTo(proj.x, proj.y);
        }
      }
    }

    // Styling the orbit path
    const isSelected = this.selectedBody && this.selectedBody.id === body.id;
    const isHovered = this.hoveredBody && this.hoveredBody.id === body.id;
    
    this.ctx.strokeStyle = body.orbit.color || "rgba(255,255,255,0.15)";
    this.ctx.lineWidth = isSelected ? 1.8 : isHovered ? 1.2 : 0.8;
    
    // Add subtle glow if selected
    if (isSelected) {
      this.ctx.shadowColor = body.color;
      this.ctx.shadowBlur = 6;
    }
    
    this.ctx.stroke();
    this.ctx.shadowBlur = 0; // reset
  }

  // Helper to get 3D coordinates of a specific orbit angle (theta)
  getOrbitPoint3D(body, theta) {
    const o = body.orbit;
    const e = o.eccentricity;
    
    // Orbit radius at true anomaly theta
    const r = (o.semiMajorAxis * (1 - Math.pow(e, 2))) / (1 + e * Math.cos(theta));

    // Orbital plane coords
    const xp = r * Math.cos(theta);
    const yp = r * Math.sin(theta);

    const inc = o.inclination * Math.PI / 180;
    const node = o.longitudeOfAscendingNode * Math.PI / 180;
    const arg = o.argumentOfPerihelion * Math.PI / 180;

    const cosNode = Math.cos(node);
    const sinNode = Math.sin(node);
    const cosArgInc = Math.cos(arg) * Math.cos(inc);
    const sinArgInc = Math.sin(arg) * Math.cos(inc);
    const sinInc = Math.sin(inc);

    const x = xp * (cosNode * Math.cos(arg) - sinNode * sinArgInc) - yp * (cosNode * Math.sin(arg) + sinNode * cosArgInc);
    const z = xp * (sinNode * Math.cos(arg) + cosNode * sinArgInc) - yp * (sinNode * Math.sin(arg) - cosNode * cosArgInc);
    const y = xp * (Math.sin(arg) * sinInc) + yp * (Math.cos(arg) * sinInc);

    return { x, y, z };
  }

  // Draw Sun, Planets, Spacecraft
  drawBody(item, time) {
    const { body, proj, radius } = item;
    const isSelected = this.selectedBody && this.selectedBody.id === body.id;
    const isHovered = this.hoveredBody && this.hoveredBody.id === body.id;

    // Check hovered
    if (this.lastMouseX && this.lastMouseY) {
      const sizeOnScreen = Math.max(radius * proj.scale * this.zoom, 10);
      const dist = Math.hypot(this.lastMouseX - proj.x, this.lastMouseY - proj.y);
      if (dist < sizeOnScreen + 6) {
        this.hoveredBody = body;
      }
    }

    this.ctx.save();

    if (body.type === "star") {
      // Glow effect for Sun
      const grad = this.ctx.createRadialGradient(
        proj.x, proj.y, 1,
        proj.x, proj.y, radius * proj.scale * this.zoom * 2.2
      );
      grad.addColorStop(0, "#fffde7");
      grad.addColorStop(0.2, body.color);
      grad.addColorStop(0.5, "rgba(255, 143, 0, 0.45)");
      grad.addColorStop(0.8, "rgba(255, 143, 0, 0.1)");
      grad.addColorStop(1, "rgba(255, 87, 34, 0)");

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, radius * proj.scale * this.zoom * 2.5, 0, Math.PI * 2);
      this.ctx.fill();

      // Core Sun
      this.ctx.fillStyle = "#ffffff";
      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, radius * proj.scale * this.zoom, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Standard Planet drawing
      const size = Math.max(radius * proj.scale * this.zoom * 0.7, 3.5);
      
      // Draw selection ring
      if (isSelected) {
        this.ctx.strokeStyle = "#ffffff";
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, size + 6, 0, Math.PI * 2);
        this.ctx.stroke();

        // Crosshairs or target lines
        this.ctx.strokeStyle = "rgba(255,255,255,0.4)";
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(proj.x - size - 12, proj.y);
        this.ctx.lineTo(proj.x - size - 4, proj.y);
        this.ctx.moveTo(proj.x + size + 4, proj.y);
        this.ctx.lineTo(proj.x + size + 12, proj.y);
        this.ctx.moveTo(proj.x, proj.y - size - 12);
        this.ctx.lineTo(proj.x, proj.y - size - 4);
        this.ctx.moveTo(proj.x, proj.y + size + 4);
        this.ctx.lineTo(proj.x, proj.y + size + 12);
        this.ctx.stroke();
      }

      // Draw hover indicator
      if (isHovered && !isSelected) {
        this.ctx.strokeStyle = body.color || "rgba(255, 255, 255, 0.5)";
        this.ctx.lineWidth = 1.0;
        this.ctx.setLineDash([2, 2]);
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, size + 5, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset dash
      }

      // Ring for Saturn
      if (body.hasRings) {
        this.drawSaturnRings(proj.x, proj.y, size);
      }

      // Draw planet sphere with shading (pseudo-3D lighting from Sun)
      // Light source comes from center of screen (Sun)
      const lightAngle = Math.atan2(proj.y - (this.canvas.height / (2 * (window.devicePixelRatio || 1)) + this.panY), proj.x - (this.canvas.width / (2 * (window.devicePixelRatio || 1)) + this.panX)) + Math.PI;

      const grad = this.ctx.createRadialGradient(
        proj.x + Math.cos(lightAngle) * size * 0.3,
        proj.y + Math.sin(lightAngle) * size * 0.3,
        1,
        proj.x, proj.y, size
      );
      grad.addColorStop(0, body.bodyColor || body.color);
      grad.addColorStop(0.7, this.adjustBrightness(body.bodyColor || body.color, -50));
      grad.addColorStop(1, "#030712"); // shadow side fade

      this.ctx.fillStyle = grad;
      this.ctx.beginPath();
      this.ctx.arc(proj.x, proj.y, size, 0, Math.PI * 2);
      this.ctx.fill();

      // If it is Earth, draw a faint atmosphere glow
      if (body.id === "earth") {
        this.ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
        this.ctx.lineWidth = 1.5;
        this.ctx.beginPath();
        this.ctx.arc(proj.x, proj.y, size + 0.5, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      // Draw planet moons if zoomed in close enough
      if (body.moons && body.moons.length > 0 && this.zoom > 1.8) {
        this.drawMoons(body, proj.x, proj.y, size, time);
      }

      // Draw Text Label
      const showLabel = this.zoom > 0.45 || isSelected || isHovered;
      if (showLabel) {
        this.ctx.fillStyle = isSelected ? "#ffffff" : isHovered ? body.color : "rgba(255,255,255,0.7)";
        this.ctx.font = isSelected ? "bold 11px Outfit, Inter, sans-serif" : "9px Outfit, Inter, sans-serif";
        this.ctx.textAlign = "left";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(body.name.toUpperCase(), proj.x + size + 6, proj.y);
      }
    }

    this.ctx.restore();
  }

  // Draw Saturn's ring system in 3D tilted plane
  drawSaturnRings(cx, cy, size) {
    this.ctx.save();
    
    // Ring tilt matches overall pitch visually but squashed
    const scaleY = Math.abs(Math.sin(this.pitch));
    this.ctx.translate(cx, cy);
    this.ctx.scale(1, scaleY);
    this.ctx.rotate(-this.yaw * 0.1); // rotate ring slightly based on yaw

    // Outer Ring
    this.ctx.strokeStyle = "rgba(215, 204, 200, 0.45)";
    this.ctx.lineWidth = size * 0.3;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 1.9, 0, Math.PI * 2);
    this.ctx.stroke();

    // Inner Ring gap divider
    this.ctx.strokeStyle = "rgba(3, 7, 18, 0.9)";
    this.ctx.lineWidth = size * 0.05;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 1.7, 0, Math.PI * 2);
    this.ctx.stroke();

    // Inner Ring
    this.ctx.strokeStyle = "rgba(255, 224, 130, 0.55)";
    this.ctx.lineWidth = size * 0.45;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 1.45, 0, Math.PI * 2);
    this.ctx.stroke();

    this.ctx.restore();
  }

  // Draw moons orbiting a planet
  drawMoons(parent, px, py, parentSize, time) {
    parent.moons.forEach(moon => {
      // Moons orbit circular in the planet's equator plane
      const angle = time * moon.speed;
      const radius = moon.distance * this.zoom * 0.35 + parentSize;
      
      // simple 2D orbit squashed by canvas pitch
      const cosP = Math.abs(Math.sin(this.pitch));
      const mx = px + Math.cos(angle) * radius;
      const my = py + Math.sin(angle) * radius * cosP;

      // Draw orbit path
      this.ctx.strokeStyle = "rgba(255,255,255,0.06)";
      this.ctx.lineWidth = 0.5;
      this.ctx.beginPath();
      
      this.ctx.save();
      this.ctx.translate(px, py);
      this.ctx.scale(1, cosP);
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();

      // Draw Moon body
      this.ctx.fillStyle = moon.color || "#cfd8dc";
      this.ctx.beginPath();
      this.ctx.arc(mx, my, Math.max(moon.radius * this.zoom * 0.4, 1), 0, Math.PI * 2);
      this.ctx.fill();
    });
  }

  // Adjust color brightness helper
  adjustBrightness(hex, percent) {
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = parseInt(R * (100 + percent) / 100);
    G = parseInt(G * (100 + percent) / 100);
    B = parseInt(B * (100 + percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    R = (R > 0) ? R : 0;
    G = (G > 0) ? G : 0;
    B = (B > 0) ? B : 0;

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  }

  // Interactive mouse/touch gesture bindings
  setupEvents() {
    // Mouse Down
    this.canvas.addEventListener("mousedown", (e) => {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
    });

    // Mouse Move
    window.addEventListener("mousemove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this.lastMouseX = e.clientX - rect.left;
      this.lastMouseY = e.clientY - rect.top;

      if (!this.isDragging) return;

      const deltaX = e.clientX - this.lastMouseX - rect.left; // use standard clients
      const deltaXRaw = e.movementX;
      const deltaYRaw = e.movementY;

      if (this.dragMode === "rotate") {
        this.targetYaw += deltaXRaw * 0.007;
        this.targetPitch = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, this.targetPitch + deltaYRaw * 0.007));
      } else {
        // Pan mode
        this.targetPanX += deltaXRaw * 0.8;
        this.targetPanY += deltaYRaw * 0.8;
        this.selectedBody = null; // Un-track body on manual pan
      }

      this.lastMouseX = e.clientX - rect.left;
      this.lastMouseY = e.clientY - rect.top;
    });

    // Mouse Up
    window.addEventListener("mouseup", () => {
      this.isDragging = false;
    });

    // Mouse Scroll (Zoom)
    this.canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const zoomFactor = 1.15;
      if (e.deltaY < 0) {
        this.targetZoom = Math.min(45.0, this.targetZoom * zoomFactor);
      } else {
        this.targetZoom = Math.max(0.1, this.targetZoom / zoomFactor);
      }
    }, { passive: false });

    // Touch support (Mobile)
    let touchStartDist = 0;
    this.canvas.addEventListener("touchstart", (e) => {
      this.isDragging = true;
      const rect = this.canvas.getBoundingClientRect();
      
      if (e.touches.length === 1) {
        this.lastMouseX = e.touches[0].clientX - rect.left;
        this.lastMouseY = e.touches[0].clientY - rect.top;
      } else if (e.touches.length === 2) {
        // Pinch start
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        touchStartDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      }
    });

    this.canvas.addEventListener("touchmove", (e) => {
      const rect = this.canvas.getBoundingClientRect();
      
      if (e.touches.length === 1 && this.isDragging) {
        const clientX = e.touches[0].clientX - rect.left;
        const clientY = e.touches[0].clientY - rect.top;
        
        const deltaX = clientX - this.lastMouseX;
        const deltaY = clientY - this.lastMouseY;

        if (this.dragMode === "rotate") {