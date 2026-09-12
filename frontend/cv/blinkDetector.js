/**
 * ====================================================================
 * BLINKOS — 4-STATE TEMPORAL BLINK DETECTOR & VALIDATOR
 * ====================================================================
 */

import {
  BLINK_CONFIG,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  clamp
} from "../lib/config.js";
import {
  calculateEAR,
  extractHeadPose,
  calculateFaceQuality
} from "./vision.js";

export const BLINK_STATES = {
  OPEN: "OPEN",
  CLOSING: "CLOSING",
  CLOSED: "CLOSED",
  OPENING: "OPENING"
};

/**
 * Per-participant temporal state machine and blink validator
 */
export class BlinkDetector {
  constructor(participantId, calibrationEngine, callbacks = {}) {
    this.participantId = participantId;
    this.calibration = calibrationEngine;
    this.callbacks = {
      onBlink: callbacks.onBlink || (() => {}),
      onWink: callbacks.onWink || (() => {}),
      onLongClosure: callbacks.onLongClosure || (() => {}),
      onStateChange: callbacks.onStateChange || (() => {}),
      onCombo: callbacks.onCombo || (() => {}),
      onComboStreak: callbacks.onComboStreak || (() => {})
    };

    this.state = BLINK_STATES.OPEN;
    this.previousState = BLINK_STATES.OPEN;

    // Gesture history buffer for multi-blink combos
    this.gestureHistory = [];
    this.lastComboTriggerTime = -999999;
    this.lastWinkTime = 0;

    // Fast Combo Streak State Machine (1.5s rolling window)
    this.comboStreakCount = 0;
    this.lastStreakBlinkTime = 0;

    // Smoothed EAR tracking
    this.smoothedLeftEAR = BLINK_CONFIG.defaultBaselineEAR;
    this.smoothedRightEAR = BLINK_CONFIG.defaultBaselineEAR;
    this.smoothedCompositeEAR = BLINK_CONFIG.defaultBaselineEAR;

    // Temporal timing
    this.stateStartTime = performance.now();
    this.closeStartTime = 0;
    this.leftCloseStartTime = 0;
    this.rightCloseStartTime = 0;
    this.lastBlinkTime = 0;
    this.refractoryUntil = 0;
    this.minEARDuringClosure = 1.0;
    this.hasReportedLongClosure = false;

    // Recent telemetry
    this.lastConfidence = 1.0;
    this.lastHeadPose = { yaw: 0, pitch: 0, roll: 0, isDegraded: false };
    this.lastFaceQuality = { score: 1.0, label: "HIGH" };
  }

  /**
   * Processes a single frame of landmarks for this participant
   * @param {Array<{x, y, z}>} landmarks - MediaPipe facial landmarks
   * @param {Object} box - Participant bounding box
   * @param {number} timestamp - High-res timestamp (ms)
   */
  processFrame(landmarks, box, timestamp = performance.now()) {
    // 1. Calculate raw EAR for each eye using tilt-invariant Euclidean aspect ratios
    const rawLeftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
    const rawRightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
    const rawCompositeEAR = (rawLeftEAR + rawRightEAR) / 2.0;

    // 2. Head Pose & Quality Metrics
    this.lastHeadPose = extractHeadPose(landmarks);
    this.lastFaceQuality = calculateFaceQuality(box, this.lastHeadPose);

    // 3. Mandatory 2-Second Dynamic Startup Calibration Window
    // Suppresses all premature blink triggers while calculating resting open EAR and closed extremes
    if (!this.calibration.isCalibrated) {
      this.calibration.addSample(rawCompositeEAR, this.lastHeadPose, timestamp);
      this.smoothedLeftEAR = rawLeftEAR;
      this.smoothedRightEAR = rawRightEAR;
      this.smoothedCompositeEAR = rawCompositeEAR;
      return {
        state: "CALIBRATING",
        ear: this.smoothedCompositeEAR,
        leftEAR: this.smoothedLeftEAR,
        rightEAR: this.smoothedRightEAR,
        confidence: 1.0,
        pose: this.lastHeadPose,
        quality: this.lastFaceQuality,
        isCalibrating: true
      };
    }

    // 4. Adaptive Exponential Moving Average (EMA) smoothing
    // Asymmetric dual-rate: instant 0.88 snap on closure plunge, smooth recovery
    const isClosing = rawCompositeEAR < this.smoothedCompositeEAR;
    const alpha = isClosing ? 0.88 : BLINK_CONFIG.earSmoothingAlpha;

    this.smoothedLeftEAR = this.smoothedLeftEAR * (1 - alpha) + rawLeftEAR * alpha;
    this.smoothedRightEAR = this.smoothedRightEAR * (1 - alpha) + rawRightEAR * alpha;
    this.smoothedCompositeEAR = this.smoothedCompositeEAR * (1 - alpha) + rawCompositeEAR * alpha;

    // Dynamic thresholds from calibration engine:
    // Down-state trigger: openThreshold * 0.80
    // Rising-edge trigger: openThreshold * 0.90
    const { closeThreshold, reopenThreshold, openThreshold, baselineEAR } = this.calibration;
    const downThreshold = closeThreshold;      // openThreshold * 0.80
    const upThreshold = reopenThreshold;        // openThreshold * 0.90
    
    // Effective EAR: accounts for instant dips in raw or smoothed values
    const effectiveEAR = Math.min(this.smoothedCompositeEAR, rawCompositeEAR);
    const leftClosed = Math.min(this.smoothedLeftEAR, rawLeftEAR) < downThreshold;
    const rightClosed = Math.min(this.smoothedRightEAR, rawRightEAR) < downThreshold;

    // Track per-eye closure start for synchrony & wink detection
    if (leftClosed && this.leftCloseStartTime === 0) {
      this.leftCloseStartTime = timestamp;
    } else if (!leftClosed) {
      this.leftCloseStartTime = 0;
    }

    if (rightClosed && this.rightCloseStartTime === 0) {
      this.rightCloseStartTime = timestamp;
    } else if (!rightClosed) {
      this.rightCloseStartTime = 0;
    }

    // 5. Hardened Refractory Period Lockout Guard (Minimum 400ms)
    // Once a falling edge registers a valid blink, ignore all incoming triggers for 400ms.
    if (timestamp < this.refractoryUntil) {
      if (this.state === BLINK_STATES.CLOSED && effectiveEAR >= upThreshold) {
        this.setState(BLINK_STATES.OPEN, timestamp);
      }
      return {
        state: this.state,
        ear: this.smoothedCompositeEAR,
        leftEAR: this.smoothedLeftEAR,
        rightEAR: this.smoothedRightEAR,
        confidence: this.lastConfidence,
        pose: this.lastHeadPose,
        quality: this.lastFaceQuality
      };
    }

    // 6. Zero-Lag State Machine with Falling-Edge Blink Registration & Hardened 400ms Lockout
    const priorState = this.state;
    const minRefractoryLock = Math.max(400, BLINK_CONFIG.cooldown || 400);

    switch (this.state) {
      case BLINK_STATES.OPEN:
      case "CALIBRATING":
      case BLINK_STATES.OPENING:
      case BLINK_STATES.CLOSING:
        // Falling Edge: Trigger down-state when EAR drops below openThreshold * 0.8
        if (effectiveEAR < downThreshold) {
          this.closeStartTime = timestamp;
          this.minEARDuringClosure = effectiveEAR;
          this.hasReportedLongClosure = false;
          this.setState(BLINK_STATES.CLOSED, timestamp);

          // Rigid timestamp-based refractory lock: ignore all triggers for minimum 300ms
          this.refractoryUntil = timestamp + minRefractoryLock;

          // Register and emit valid blink immediately on falling edge
          this.validateAndEmitBlink(100, timestamp, openThreshold);
        }
        break;

      case BLINK_STATES.CLOSED: {
        // Track minimum EAR reached during this closure
        if (effectiveEAR < this.minEARDuringClosure) {
          this.minEARDuringClosure = effectiveEAR;
        }

        const closureDuration = timestamp - this.closeStartTime;

        // Long Closure / Sleep Check (> 1000ms)
        if (closureDuration > BLINK_CONFIG.maxBlinkDuration) {
          if (!this.hasReportedLongClosure) {
            this.hasReportedLongClosure = true;
            this.callbacks.onLongClosure({
              participantId: this.participantId,
              duration: closureDuration,
              timestamp
            });
          }
        }

        // Rising Edge: Eye crosses back above reopenThreshold (openThreshold * 0.9)
        if (effectiveEAR >= upThreshold) {
          this.setState(BLINK_STATES.OPEN, timestamp);
        }
        break;
      }
    }

    // 7. Separate Wink Detection (unilateral closure while other eye remains open)
    if (this.state === BLINK_STATES.OPEN) {
      this.checkWink(leftClosed, rightClosed, timestamp);
    }

    if (this.state !== priorState) {
      this.callbacks.onStateChange(this.state, priorState, this.participantId);
    }

    return {
      state: this.state,
      ear: this.smoothedCompositeEAR,
      leftEAR: this.smoothedLeftEAR,
      rightEAR: this.smoothedRightEAR,
      confidence: this.lastConfidence,
      pose: this.lastHeadPose,
      quality: this.lastFaceQuality
    };
  }

  setState(newState, timestamp) {
    this.previousState = this.state;
    this.state = newState;
    this.stateStartTime = timestamp;
  }

  /**
   * Evaluates blink validity against all constraints and calculates multi-factor confidence
   */
  validateAndEmitBlink(duration, timestamp, baselineEAR) {
    const minCooldown = Math.max(400, BLINK_CONFIG.cooldown || 400);

    // 1. Cooldown Guard (minimum 400ms)
    if (timestamp - this.lastBlinkTime < minCooldown) {
      return; // Reject double-count within cooldown
    }

    // 2. Reject prolonged closures (> 1000ms) from counting as normal blinks
    if (duration > BLINK_CONFIG.maxBlinkDuration) {
      return;
    }

    // 3. Reject high-frequency noise / optical flicker (< 55ms)
    if (duration < BLINK_CONFIG.minBlinkDuration) {
      return;
    }

    // 4. Two-Eye Synchrony Check (tolerance <= 80ms)
    const eyeSyncDiff = Math.abs(this.leftCloseStartTime - this.rightCloseStartTime);
    const bothEyesSynchronized = (this.leftCloseStartTime > 0 && this.rightCloseStartTime > 0)
      ? eyeSyncDiff <= BLINK_CONFIG.eyeSyncTolerance
      : true; // fallback if one eye was fast

    // 5. Multi-Factor Confidence Scoring (0.0 to 1.0)
    const confidence = this.computeConfidence(duration, baselineEAR, bothEyesSynchronized);
    this.lastConfidence = confidence;

    // 6. Acceptance Threshold (Confidence >= 0.50)
    if (confidence >= BLINK_CONFIG.confidenceThreshold) {
      this.lastBlinkTime = timestamp;
      this.refractoryUntil = timestamp + minCooldown;

      // Update Combo Streak Counter (1500ms rolling window)
      const streakWindow = BLINK_CONFIG.comboStreakWindowMs || 1500;
      if (timestamp - this.lastStreakBlinkTime <= streakWindow) {
        this.comboStreakCount++;
      } else {
        this.comboStreakCount = 1;
      }
      this.lastStreakBlinkTime = timestamp;

      const blinkEvent = {
        id: `blink-${this.participantId}-${Math.floor(timestamp)}`,
        participantId: this.participantId,
        timestamp,
        duration: Math.max(30, Math.round(duration)),
        earDrop: parseFloat((baselineEAR - this.minEARDuringClosure).toFixed(3)),
        minEAR: parseFloat(this.minEARDuringClosure.toFixed(3)),
        confidence: parseFloat(confidence.toFixed(2)),
        headPose: { ...this.lastHeadPose },
        faceQuality: this.lastFaceQuality.label,
        comboStreak: this.comboStreakCount,
        isWink: false,
        isValid: true
      };

      this.callbacks.onBlink(blinkEvent);
      this.recordGesture({ type: "BLINK", timestamp, duration: Math.round(duration) });

      // Trigger Arcade Combo Streak Callouts on 2+ rapid blinks
      if (this.comboStreakCount >= 2) {
        const streakEvent = this.evaluateComboStreak(this.comboStreakCount, timestamp);
        if (streakEvent) {
          this.callbacks.onComboStreak(streakEvent);
        }
      }
    }
  }

  /**
   * Computes composite confidence across 5 weighted factors:
   *   1. Landmark & Face Quality (25%)
   *   2. EAR Drop Magnitude (35%)
   *   3. Duration Realism (20%)
   *   4. Two-Eye Agreement (10%)
   *   5. Head Pose Stability (10%)
   */
  computeConfidence(duration, baselineEAR, bothEyesSynchronized) {
    // Factor 1: Face Quality
    const qualityScore = Math.max(0.5, this.lastFaceQuality.score);

    // Factor 2: EAR Drop Magnitude relative to baseline (30%+ drop gets high confidence)
    const drop = Math.max(0, baselineEAR - this.minEARDuringClosure);
    const dropRatio = drop / Math.max(0.05, baselineEAR);
    const dropScore = clamp(dropRatio / 0.32, 0, 1);

    // Factor 3: Duration Realism (smooth curve, accepting 35ms to 600ms)
    let durationScore = 1.0;
    if (duration < 60) {
      durationScore = Math.max(0.6, (duration - BLINK_CONFIG.minBlinkDuration) / (60 - BLINK_CONFIG.minBlinkDuration));
    } else if (duration > 400) {
      durationScore = Math.max(0.4, 1.0 - ((duration - 400) / 600));
    }

    // Factor 4: Two-Eye Agreement & Synchrony
    let eyeAgreementScore = bothEyesSynchronized ? 1.0 : 0.7;
    const eyeDiff = Math.abs(this.smoothedLeftEAR - this.smoothedRightEAR);
    if (eyeDiff > 0.08) {
      eyeAgreementScore *= 0.85;
    }

    // Factor 5: Head Pose Stability
    let poseScore = 1.0;
    if (this.lastHeadPose.isDegraded) {
      poseScore = 0.6;
    } else {
      const anglePenalty = (Math.abs(this.lastHeadPose.yaw) / 40 + Math.abs(this.lastHeadPose.pitch) / 35) / 2;
      poseScore = clamp(1.0 - anglePenalty * 0.4, 0.6, 1.0);
    }

    // Weighted composite
    const composite = (
      qualityScore * 0.20 +
      dropScore * 0.40 +
      durationScore * 0.20 +
      eyeAgreementScore * 0.10 +
      poseScore * 0.10
    );

    return clamp(composite, 0.0, 1.0);
  }

  /**
   * Checks for unilateral eye closure (winking)
   */
  checkWink(leftClosed, rightClosed, timestamp) {
    const isWinkLeft = leftClosed && !rightClosed && (this.smoothedRightEAR >= this.calibration.reopenThreshold);
    const isWinkRight = rightClosed && !leftClosed && (this.smoothedLeftEAR >= this.calibration.reopenThreshold);

    if (isWinkLeft || isWinkRight) {
      if (timestamp - this.lastWinkTime > 300 && timestamp - this.lastBlinkTime > BLINK_CONFIG.cooldown) {
        this.lastWinkTime = timestamp;
        const eye = isWinkLeft ? "LEFT" : "RIGHT";
        this.recordGesture({ type: `WINK_${eye}`, eye, timestamp });
        this.callbacks.onWink({
          participantId: this.participantId,
          eye,
          timestamp
        });
      }
    }
  }

  /**
   * Stores recent gestures in temporal buffer and checks for combo triggers
   */
  recordGesture(gesture) {
    this.gestureHistory.push(gesture);
    const cutoff = gesture.timestamp - 2000;
    this.gestureHistory = this.gestureHistory.filter(g => g.timestamp >= cutoff);
    this.evaluateCombos(gesture.timestamp);
  }

  /**
   * Evaluates gesture sequences to trigger high-energy combo reactions
   */
  evaluateCombos(timestamp) {
    if (timestamp - this.lastComboTriggerTime < 800) return;

    const len = this.gestureHistory.length;
    if (len < 2) return;

    const last = this.gestureHistory[len - 1];
    const prev1 = this.gestureHistory[len - 2];
    const prev2 = len >= 3 ? this.gestureHistory[len - 3] : null;

    // 1. TRIPLE BLINK -> SUPERNOVA BURST (🔥)
    if (prev2 && prev2.type === "BLINK" && prev1.type === "BLINK" && last.type === "BLINK") {
      if (last.timestamp - prev2.timestamp <= 1400) {
        this.triggerCombo({
          id: "TRIPLE_BLINK",
          title: "SUPERNOVA BURST",
          emoji: "🔥",
          desc: "Triple Rapid Blink Combo",
          timestamp
        });
        return;
      }
    }

    // 2. DOUBLE WINK LEFT -> CYAN LIGHTNING (⚡)
    if (prev1.type === "WINK_LEFT" && last.type === "WINK_LEFT") {
      if (last.timestamp - prev1.timestamp <= 1200) {
        this.triggerCombo({
          id: "DOUBLE_WINK_LEFT",
          title: "CYAN LIGHTNING",
          emoji: "⚡",
          desc: "Double Left-Eye Wink",
          timestamp
        });
        return;
      }
    }

    // 3. DOUBLE WINK RIGHT -> PLASMA BURST (💥)
    if (prev1.type === "WINK_RIGHT" && last.type === "WINK_RIGHT") {
      if (last.timestamp - prev1.timestamp <= 1200) {
        this.triggerCombo({
          id: "DOUBLE_WINK_RIGHT",
          title: "PLASMA BURST",
          emoji: "💥",
          desc: "Double Right-Eye Wink",
          timestamp
        });
        return;
      }
    }

    // 4. WINK ALTERNATE -> HYPERDRIVE WARP (🚀)
    if ((prev1.type === "WINK_LEFT" && last.type === "WINK_RIGHT") ||
        (prev1.type === "WINK_RIGHT" && last.type === "WINK_LEFT")) {
      if (last.timestamp - prev1.timestamp <= 1100) {
        this.triggerCombo({
          id: "WINK_ALTERNATE",
          title: "HYPERDRIVE WARP",
          emoji: "🚀",
          desc: "Alternating Eye Wink",
          timestamp
        });
        return;
      }
    }

    // 5. BLINK + WINK COMBO -> CYBER MATRIX (👁️)
    if (prev1.type === "BLINK" && (last.type === "WINK_LEFT" || last.type === "WINK_RIGHT")) {
      if (last.timestamp - prev1.timestamp <= 850) {
        this.triggerCombo({
          id: "BLINK_WINK_COMBO",
          title: "CYBER MATRIX",
          emoji: "👁️",
          desc: "Blink Followed by Wink",
          timestamp
        });
        return;
      }
    }
  }

  triggerCombo(combo) {
    this.lastComboTriggerTime = combo.timestamp;
    this.gestureHistory = []; // Reset after firing combo
    combo.participantId = this.participantId;
    this.callbacks.onCombo(combo);
  }

  evaluateComboStreak(count, timestamp) {
    let tier = "DOUBLE";
    let title = "DOUBLE BLINK!";
    let callout = "DOUBLE KILL!";
    let color = "#00f2fe";
    let subtext = "2X RAPID COMBO";

    if (count === 3) {
      tier = "TRIPLE";
      title = "TRIPLE BLINK!";
      callout = "TRIPLE BLINK!";
      color = "#00FF9D";
      subtext = "3X FRENZY";
    } else if (count === 4) {
      tier = "MEGA";
      title = "MEGA BLINK!";
      callout = "MEGA BLINK!";
      color = "#FFE600";
      subtext = "4X ULTRA VELOCITY";
    } else if (count === 5) {
      tier = "PENTA";
      title = "PENTA BLINK!";
      callout = "PENTA BLINK!";
      color = "#FF007F";
      subtext = "5X RAMPAGE";
    } else if (count >= 6) {
      tier = "GODLIKE";
      title = "GODLIKE!";
      callout = "UNSTOPPABLE! GODLIKE!";
      color = "#a855f7";
      subtext = `${count}X UNSTOPPABLE`;
    }

    return {
      participantId: this.participantId,
      count,
      tier,
      title,
      callout,
      color,
      subtext,
      timestamp
    };
  }

  reset() {
    this.state = BLINK_STATES.OPEN;
    this.closeStartTime = 0;
    this.lastBlinkTime = 0;
    this.lastWinkTime = 0;
    this.lastComboTriggerTime = 0;
    this.comboStreakCount = 0;
    this.lastStreakBlinkTime = 0;
    this.gestureHistory = [];
    this.minEARDuringClosure = 1.0;
  }
}

