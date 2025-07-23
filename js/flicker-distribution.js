/**
 * FlickerDistribution - Flickering Leaves Effect
 *
 * Creates a beautiful animation effect where leaf-like pixels flicker and gradually
 * fade from center to edges over 30 seconds, simulating light filtering through leaves.
 *
 * Usage:
 * const flicker = new FlickerDistribution(width, height, centerX, centerY);
 * const pixelState = flicker.getPixelState(x, y, currentTime);
 *
 * @author Generated for web implementation
 * @version 1.0
 */

class FlickerDistribution {
  /**
   * @param {number} width - Effect width in logical pixels
   * @param {number} height - Effect height in logical pixels
   * @param {number} centerX - Center point X coordinate
   * @param {number} centerY - Center point Y coordinate
   */
  constructor(width, height, centerX, centerY) {
    this.width = width;
    this.height = height;
    this.centerX = centerX;
    this.centerY = centerY;

    // Effect parameters - customize these for different behaviors
    this.totalDuration = 10000; // 10 seconds total effect time
    this.fadeOutDuration = 2000; // 2 seconds to fade to transparency
    this.irregularityFactor = 0.3; // How much Perlin noise affects boundaries (0-1)
    this.contagionStrength = 0.1; // How much neighbors influence stopping (0-1)
    this.naturalVariation = 0.2; // Random variation in timing (0-1)
    this.borderThickness = 10;

    // Initialize all pixel states
    this.initializePixels();
  }

  /**
   * Initialize each pixel's state with natural variation in flicker rates and timing
   */
  initializePixels() {
    this.pixels = [];
    for (let y = 0; y < this.height; y++) {
      this.pixels[y] = [];
      for (let x = 0; x < this.width; x++) {
        this.pixels[y][x] = {
          isFlickering: true,
          flickerRate: 50 + Math.random() * 100, // 50-150ms natural variation
          transparency: 1.0, // Start fully opaque
          stopTime: this.calculateStopTime(x, y), // When this pixel stops
          lastFlickerTime: 0,
          currentColor: Math.random() > 0.5 ? 1 : 0, // Random start state
          hasStartedFading: false,
          fadeStartTime: 0,
        };
      }
    }
  }

  /**
   * Calculate when each pixel should stop flickering based on distance from center
   * with exponential decay, irregular boundaries, and natural variation
   *
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @returns {number} Time in milliseconds when pixel should stop
   */
  calculateStopTime(x, y) {
    // For a 2-pixel thick border
    const isEdgePixel =
      x < this.borderThickness ||
      x >= this.width - this.borderThickness ||
      y < this.borderThickness ||
      y >= this.height - this.borderThickness;

    if (isEdgePixel) {
      return Infinity; // Edge pixels never stop flickering
    }

    // 1. Calculate base distance from center using Pythagorean theorem
    const baseDistance = Math.sqrt(
      Math.pow(x - this.centerX, 2) + Math.pow(y - this.centerY, 2)
    );

    // 2. Add Perlin noise for irregular, organic boundaries
    const noiseValue = this.perlinNoise(x * 0.02, y * 0.02);
    const irregularDistance =
      baseDistance + noiseValue * this.irregularityFactor * 100;

    // 3. Normalize distance to 0-1 range (0 = center, 1 = furthest edge)
    const maxDistance =
      Math.sqrt(Math.pow(this.width, 2) + Math.pow(this.height, 2)) / 2;
    const normalizedDistance = Math.min(irregularDistance / maxDistance, 1);

    // 4. Apply exponential decay curve - center stops first, edges last
    const exponentialCurve = Math.pow(normalizedDistance, 2.5);

    // 5. Add natural variation (±20% randomness in timing)
    const variation = (Math.random() - 0.5) * this.naturalVariation;
    const baseStopTime = (exponentialCurve + variation) * this.totalDuration;

    // Ensure time is within valid bounds
    return Math.max(0, Math.min(this.totalDuration, baseStopTime));
  }

  /**
   * Simple 2D Perlin-like noise for creating irregular boundaries
   *
   * @param {number} x - X coordinate (scaled)
   * @param {number} y - Y coordinate (scaled)
   * @returns {number} Noise value between -1 and 1
   */
  perlinNoise(x, y) {
    // Simplified noise using multiple sine/cosine waves
    // For production, consider using a full Perlin noise implementation
    return (
      (Math.sin(x * 0.5) * Math.cos(y * 0.3) * 0.5 +
        Math.sin(x * 1.2) * Math.cos(y * 0.8) * 0.3 +
        Math.sin(x * 2.1) * Math.cos(y * 1.7) * 0.2) /
      3
    );
  }

  /**
   * Check how many neighboring pixels have stopped flickering
   * Creates the "contagious" spreading effect
   *
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @returns {number} Percentage of stopped neighbors (0-1)
   */
  getNeighborInfluence(x, y) {
    let stoppedNeighbors = 0;
    let totalNeighbors = 0;

    // Check 3x3 grid around current pixel
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue; // Skip center pixel (self)

        const nx = x + dx;
        const ny = y + dy;

        // Check if neighbor is within bounds
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
          totalNeighbors++;
          if (!this.pixels[ny][nx].isFlickering) {
            stoppedNeighbors++;
          }
        }
      }
    }

    // Return influence factor (0 = no stopped neighbors, 1 = all stopped)
    return totalNeighbors > 0 ? stoppedNeighbors / totalNeighbors : 0;
  }

  /**
   * Update a single pixel's state based on current time
   * Handles flickering logic, stopping conditions, and fading
   *
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {number} currentTime - Current time in milliseconds
   * @returns {Object} Updated pixel object
   */
  updatePixel(x, y, currentTime) {
    const pixel = this.pixels[y][x];

    // 1. Check if pixel should stop flickering
    if (pixel.isFlickering) {
      let adjustedStopTime = pixel.stopTime;

      // Apply neighbor influence - stopped neighbors make this pixel more likely to stop
      const neighborInfluence = this.getNeighborInfluence(x, y);
      const influenceAmount = neighborInfluence * this.contagionStrength * 2000; // Up to 2 seconds earlier
      adjustedStopTime -= influenceAmount;

      // Stop flickering if time has arrived
      if (currentTime >= adjustedStopTime) {
        pixel.isFlickering = false;
        pixel.hasStartedFading = true;
        pixel.fadeStartTime = currentTime;
      }
    }

    // 2. Update flicker state if still active
    if (pixel.isFlickering) {
      if (currentTime - pixel.lastFlickerTime >= pixel.flickerRate) {
        pixel.currentColor = 1 - pixel.currentColor; // Toggle between black (0) and white (1)
        pixel.lastFlickerTime = currentTime;
      }
    }

    // 3. Update transparency (gradual fade after stopping)
    if (pixel.hasStartedFading && !pixel.isFlickering) {
      const fadeProgress =
        (currentTime - pixel.fadeStartTime) / this.fadeOutDuration;
      pixel.transparency = Math.max(0, 1 - fadeProgress);
    }

    return pixel;
  }

  /**
   * Get the current visual state of a pixel for rendering
   * This is the main function to call each frame
   *
   * @param {number} x - Pixel X coordinate
   * @param {number} y - Pixel Y coordinate
   * @param {number} currentTime - Current time in milliseconds since effect start
   * @returns {Object} {color: 0|1, transparency: 0-1, isActive: boolean}
   */
  getPixelState(x, y, currentTime) {
    const pixel = this.updatePixel(x, y, currentTime);

    return {
      color: pixel.currentColor, // 0 = black, 1 = white
      transparency: pixel.transparency, // 0 = invisible, 1 = fully opaque
      isActive: pixel.isFlickering || pixel.transparency > 0,
    };
  }

  /**
   * Check if the entire effect has completed
   *
   * @param {number} currentTime - Current time in milliseconds
   * @returns {boolean} True if effect is completely finished
   */
  isEffectComplete(currentTime) {
    return currentTime >= this.totalDuration + this.fadeOutDuration;
  }

  /**
   * Reset the effect to initial state
   * Useful for restarting the animation
   */
  reset() {
    this.initializePixels();
  }

  /**
   * Get effect progress as percentage
   *
   * @param {number} currentTime - Current time in milliseconds
   * @returns {number} Progress from 0-100
   */
  getProgress(currentTime) {
    const totalTime = this.totalDuration + this.fadeOutDuration;
    return Math.min(100, (currentTime / totalTime) * 100);
  }
}

// Export for use in modules (optional)
if (typeof module !== "undefined" && module.exports) {
  module.exports = FlickerDistribution;
}
