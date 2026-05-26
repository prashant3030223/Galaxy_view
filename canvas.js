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