/**
 * ====================================================================
 * BLINKOS — CENTRALIZED CONFIGURATION & CONSTANTS
 * ====================================================================
 */

export const BLINK_CONFIG = {
  // Vision & Inference Performance
  inferenceFPS: 30,             // Throttle vision inference to 30 FPS, UI renders at 60 FPS
  maxFaces: 4,                  // Max simultaneous participants tracked

  // Dynamic Ocular Calibration
  calibrationDuration: 2000,    // Mandatory 2.0s startup calibration window
  minCalibrationSamples: 25,    // min samples needed for valid baseline
  defaultBaselineEAR: 0.28,     // fallback baseline if calibration is pending
  closeMultiplier: 0.80,        // trigger blink down-state below openThreshold * 0.80
  openMultiplier: 0.90,         // complete blink event instantly on rising edge above openThreshold * 0.90
  minCloseThreshold: 0.14,      // safety clamp min
  maxCloseThreshold: 0.30,      // safety clamp max
  minOpenThreshold: 0.18,       // safety clamp min
  maxOpenThreshold: 0.38,       // safety clamp max

  // Smoothing & Filtering
  earSmoothingAlpha: 0.85,      // Ultra-responsive EMA alpha (eye closures register in single frame)
  boxSmoothingAlpha: 0.30,      // EMA smoothing for bounding box (0.7 old + 0.3 new)

  // Temporal State Machine & Validation
  minBlinkDuration: 30,         // ms (reject sub-frame noise < 30ms)
  maxBlinkDuration: 1000,       // ms (closures > 1000ms categorized as LONG CLOSURE)
  cooldown: 400,                // ms hardened refractory lockout cooldown between registered blinks (400ms)
  refractoryPeriod: 400,        // ms rigid lockout to eliminate all false multi-counting
  eyeSyncTolerance: 90,         // ms tolerance between left and right eye closure
  countWinkAsBlink: false,      // separate wink detection (default false)
  confidenceThreshold: 0.50,    // robust composite confidence to accept rapid blinks

  // Multi-Person Spatial Tracking
  maxMatchDistance: 0.35,       // normalized centroid distance threshold
  centroidWeight: 0.65,         // tracking score = 0.65 * centroidSim + 0.35 * IoU
  iouWeight: 0.35,
  lostGracePeriod: 2000,        // ms before participant marked as left (prevents ID flapping)

  // Head Pose & Quality Filters
  headPoseMaxYaw: 35,           // degrees (beyond this tracking degrades / confidence drops)
  headPoseMaxPitch: 30,         // degrees
  minFaceQuality: 0.40,         // minimum face quality score for normal blink acceptance

  // History, Combos & Streaks
  maxBlinkHistory: 500,         // bounded per-participant history
  streakTimeout: 8000,          // 8s without blinking resets idle streak
  comboStreakWindowMs: 1500     // 1.5s rolling window for rapid combo streaks
};

// Standard MediaPipe Face Mesh Periocular Landmark Subsets (6-point ocular model)
// Left Eye: vertical pairs [160, 145], [158, 153], horizontal [33, 133]
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 145];
// Right Eye: vertical pairs [385, 380], [387, 373], horizontal [362, 263]
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];

// MediaPipe CDN and Model Assets
export const MEDIAPIPE_WASM_PATH = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
export const FACE_LANDMARKER_MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// Consistent Participant Color Palette
export const PARTICIPANT_PALETTE = [
  { hex: "#00f2fe", rgb: "0, 242, 254", name: "Cyan" },
  { hex: "#10b981", rgb: "16, 185, 129", name: "Emerald" },
  { hex: "#f59e0b", rgb: "245, 158, 11", name: "Amber" },
  { hex: "#ec4899", rgb: "236, 72, 153", name: "Pink" },
  { hex: "#8b5cf6", rgb: "139, 92, 246", name: "Purple" }
];

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
