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