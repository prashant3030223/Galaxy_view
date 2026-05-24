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