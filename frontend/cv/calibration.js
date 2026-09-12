/**
 * ====================================================================
 * BLINKOS — DYNAMIC OCULAR CALIBRATION ENGINE
 * ====================================================================
 */

import { BLINK_CONFIG, clamp } from "../lib/config.js";

/**
 * Manages automatic and manual ocular calibration for each participant
 */
export class CalibrationEngine {
  constructor(participantId, onCalibrated = null) {
    this.participantId = participantId;
    this.onCalibrated = onCalibrated;
    this.reset();
  }

  reset() {
    this.samples = [];
    this.startTime = null;
    this.isCalibrated = false;
    this.restingOpenEAR = BLINK_CONFIG.defaultBaselineEAR;
    this.baselineEAR = BLINK_CONFIG.defaultBaselineEAR;
    this.openThreshold = BLINK_CONFIG.defaultBaselineEAR;
    this.closeThreshold = parseFloat((this.openThreshold * BLINK_CONFIG.closeMultiplier).toFixed(3));
    this.reopenThreshold = parseFloat((this.openThreshold * BLINK_CONFIG.openMultiplier).toFixed(3));
    this.closedEARExtreme = 0.15;
    this.openEARExtreme = 0.35;
    this.progress = 0; // 0 to 1
  }

  /**
   * Adds an EAR sample during the mandatory 2-second startup calibration phase
   * @param {number} ear - Current frame calculated EAR
   * @param {Object} pose - Head pose { yaw, pitch, roll, isDegraded }
   * @param {number} timestamp - High-res timestamp (ms)
   */
  addSample(ear, pose, timestamp = performance.now()) {
    if (this.isCalibrated) return;

    if (!this.startTime) {
      this.startTime = timestamp;
    }

    // Filter out degraded or extreme pose samples to avoid biasing the baseline
    if (!pose || (!pose.isDegraded && Math.abs(pose.yaw) < 30 && Math.abs(pose.pitch) < 25)) {
      if (ear > 0.05 && ear < 0.60) {
        this.samples.push(ear);
      }
    }

    const elapsed = timestamp - this.startTime;
    this.progress = clamp(elapsed / BLINK_CONFIG.calibrationDuration, 0, 1);

    if (elapsed >= BLINK_CONFIG.calibrationDuration && this.samples.length >= BLINK_CONFIG.minCalibrationSamples) {
      this.finalize();
    }
  }

  /**
   * Calculates resting open EAR and closed EAR extremes from the 2-second window,
   * setting individual dynamic thresholds instead of relying on hardcoded generic values.
   */
  finalize() {
    if (this.samples.length === 0) {
      this.restingOpenEAR = BLINK_CONFIG.defaultBaselineEAR;
      this.closedEARExtreme = 0.15;
      this.openEARExtreme = 0.35;
    } else {
      // Sort ascending to extract true extremes and resting distribution
      const sorted = [...this.samples].sort((a, b) => a - b);
      this.closedEARExtreme = clamp(parseFloat(sorted[0].toFixed(3)), 0.05, 0.25);
      this.openEARExtreme = clamp(parseFloat(sorted[sorted.length - 1].toFixed(3)), 0.20, 0.50);

      // Resting Open EAR: 75th percentile represents relaxed open-eye state
      const idx75 = Math.floor(sorted.length * 0.75);
      const resting = sorted[idx75] || sorted[Math.floor(sorted.length / 2)];
      this.restingOpenEAR = clamp(parseFloat(resting.toFixed(3)), 0.20, 0.45);
    }

    this.baselineEAR = this.restingOpenEAR;
    this.openThreshold = this.restingOpenEAR;

    // Dynamic Hysteresis Thresholds:
    // Down-state trigger: openThreshold * 0.80
    // Rising-edge event completion: openThreshold * 0.90
    this.closeThreshold = clamp(
      parseFloat((this.openThreshold * BLINK_CONFIG.closeMultiplier).toFixed(3)),
      BLINK_CONFIG.minCloseThreshold,
      BLINK_CONFIG.maxCloseThreshold
    );

    this.reopenThreshold = clamp(
      parseFloat((this.openThreshold * BLINK_CONFIG.openMultiplier).toFixed(3)),
      BLINK_CONFIG.minOpenThreshold,
      BLINK_CONFIG.maxOpenThreshold
    );

    // Ensure strict separation between close and reopen thresholds (hysteresis band)
    if (this.reopenThreshold <= this.closeThreshold + 0.02) {
      this.reopenThreshold = parseFloat((this.closeThreshold + 0.02).toFixed(3));
    }

    this.isCalibrated = true;
    this.progress = 1.0;

    if (this.onCalibrated) {
      this.onCalibrated({
        participantId: this.participantId,
        baselineEAR: this.baselineEAR,
        restingOpenEAR: this.restingOpenEAR,
        closedEARExtreme: this.closedEARExtreme,
        openEARExtreme: this.openEARExtreme,
        openThreshold: this.openThreshold,
        closeThreshold: this.closeThreshold,
        reopenThreshold: this.reopenThreshold
      });
    }
  }

  /**
   * Adjusts thresholds according to user sensitivity setting
   */
  setSensitivity(factor = 1.0) {
    this.sensitivityFactor = factor;
    if (this.openThreshold) {
      this.closeThreshold = clamp(
        parseFloat((this.openThreshold * BLINK_CONFIG.closeMultiplier * factor).toFixed(3)),
        BLINK_CONFIG.minCloseThreshold,
        BLINK_CONFIG.maxCloseThreshold
      );
      this.reopenThreshold = clamp(
        parseFloat((this.openThreshold * BLINK_CONFIG.openMultiplier * factor).toFixed(3)),
        BLINK_CONFIG.minOpenThreshold,
        BLINK_CONFIG.maxOpenThreshold
      );
      if (this.reopenThreshold <= this.closeThreshold + 0.02) {
        this.reopenThreshold = parseFloat((this.closeThreshold + 0.02).toFixed(3));
      }
    }
  }

  /**
   * Triggers manual recalibration
   */
  recalibrate() {
    this.reset();
  }

  getStatus() {
    return {
      isCalibrated: this.isCalibrated,
      statusText: this.isCalibrated ? "LOCKED" : `CALIBRATING ${Math.round(this.progress * 100)}%`,
      progress: this.progress,
      baselineEAR: this.baselineEAR,
      restingOpenEAR: this.restingOpenEAR,
      closedEARExtreme: this.closedEARExtreme,
      openEARExtreme: this.openEARExtreme,
      openThreshold: this.openThreshold,
      closeThreshold: this.closeThreshold,
      reopenThreshold: this.reopenThreshold,
      sampleCount: this.samples.length
    };
  }
}
