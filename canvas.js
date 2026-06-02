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