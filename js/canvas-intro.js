/**
 * Canvas Intro Animation Controller
 * Manages the flickering leaves effect for the website introduction
 */

class CanvasIntroController {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.flicker = null;
    this.animationId = null;
    this.startTime = null;
    this.isRunning = false;
    this.pixelSize = 2; // Size of each "pixel" in the effect

    this.init();
  }

  init() {
    this.canvas = document.getElementById("intro-canvas");
    if (!this.canvas) {
      console.error("Canvas element not found");
      return;
    }

    this.ctx = this.canvas.getContext("2d");
    this.setupCanvas();
    this.setupFlickerEffect();
    this.bindEvents();
    this.initializeOverlay();
    this.start();
  }

  initializeOverlay() {
    // Fill canvas with solid covering overlay to completely hide content initially
    this.ctx.fillStyle = "rgba(40, 40, 40, 1.0)";
    this.ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  }

  setupCanvas() {
    // Set canvas size to cover full viewport
    const container = document.getElementById("intro-canvas-container");

    // Set display size to full viewport
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";

    // Set actual canvas resolution
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;

    // Scale context to match device pixel ratio
    this.ctx.scale(dpr, dpr);

    // Make canvas background transparent
    this.ctx.globalCompositeOperation = "source-over";

    // Calculate logical dimensions for the effect
    this.logicalWidth = Math.floor(window.innerWidth / this.pixelSize);
    this.logicalHeight = Math.floor(window.innerHeight / this.pixelSize);
  }

  setupFlickerEffect() {
    const centerX = Math.floor(this.logicalWidth / 2);
    const centerY = Math.floor(this.logicalHeight / 2);

    this.flicker = new FlickerDistribution(
      this.logicalWidth,
      this.logicalHeight,
      centerX,
      centerY
    );
  }

  bindEvents() {
    // Handle window resize
    window.addEventListener("resize", () => {
      this.handleResize();
    });

    // Optional: Add skip button functionality
    const skipButton = document.getElementById("skip-intro");
    if (skipButton) {
      skipButton.addEventListener("click", () => {
        this.stop();
        this.hideCanvas();
      });
    }
  }

  handleResize() {
    // Debounce resize events
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.setupCanvas();
      this.setupFlickerEffect();
      // Reset animation with new dimensions
      if (this.isRunning) {
        this.startTime = performance.now();
      }
    }, 100);
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.startTime = performance.now();
    this.animate();
  }

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  animate() {
    if (!this.isRunning) return;

    const currentTime = performance.now() - this.startTime;

    // Clear canvas to transparent
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Render covering overlay pixels that gradually fade away
    for (let y = 0; y < this.logicalHeight; y++) {
      for (let x = 0; x < this.logicalWidth; x++) {
        const pixelState = this.flicker.getPixelState(x, y, currentTime);

        // Only draw pixels that still have some opacity (covering the content)
        if (pixelState.isActive && pixelState.transparency > 0) {
          this.renderCoveringPixel(x, y, pixelState);
        }
        // When transparency reaches 0, nothing is drawn = content shows through
      }
    }

    // Check if effect is complete
    if (this.flicker.isEffectComplete(currentTime)) {
      this.stop();
      this.onAnimationComplete();
      return;
    }

    // Continue animation
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  renderCoveringPixel(x, y, pixelState) {
    const screenX = x * this.pixelSize;
    const screenY = y * this.pixelSize;

    // Calculate the covering opacity based on pixel transparency
    const coverOpacity = pixelState.transparency;

    if (pixelState.color === 0) {
      // Black flicker - dark covering overlay
      this.ctx.fillStyle = `rgba(20, 20, 20, ${coverOpacity})`;
    } else {
      // White flicker - lighter covering overlay
      this.ctx.fillStyle = `rgba(100, 100, 100, ${coverOpacity})`;
    }

    this.ctx.fillRect(screenX, screenY, this.pixelSize, this.pixelSize);
  }

  onAnimationComplete() {
    // Fade out canvas and show main content
    this.fadeOutCanvas();
  }

  fadeOutCanvas() {
    const canvas = this.canvas;
    const container = document.getElementById("intro-canvas-container");

    // Add fade-out class
    container.style.transition = "opacity 1s ease-out";
    container.style.opacity = "0";

    // Hide completely after fade
    setTimeout(() => {
      container.style.display = "none";
      this.showMainContent();
    }, 1000);
  }

  hideCanvas() {
    const container = document.getElementById("intro-canvas-container");
    container.style.display = "none";
    this.showMainContent();
  }

  showMainContent() {
    // Content is already visible underneath, no need to fade in
    // The canvas overlay removal reveals the content naturally
  }

  // Public method to restart animation
  restart() {
    this.stop();
    this.flicker.reset();

    const container = document.getElementById("intro-canvas-container");
    container.style.display = "block";
    container.style.opacity = "1";

    // Reinitialize the solid overlay
    this.initializeOverlay();
    this.start();
  }
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Only initialize if canvas element exists
  if (document.getElementById("intro-canvas")) {
    window.canvasIntro = new CanvasIntroController();
  }
});
