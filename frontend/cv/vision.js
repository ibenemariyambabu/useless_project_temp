/**
 * ====================================================================
 * BLINKOS — VISION & MATHEMATICAL LANDMARK ENGINE
 * ====================================================================
 */

import {
  BLINK_CONFIG,
  MEDIAPIPE_WASM_PATH,
  FACE_LANDMARKER_MODEL_URL,
  clamp
} from "../lib/config.js";

let faceLandmarkerInstance = null;
let isVisionReady = false;

/**
 * Initializes MediaPipe Tasks Vision FaceLandmarker
 */
export async function initMediaPipeVision(onStatusUpdate) {
  if (faceLandmarkerInstance) return faceLandmarkerInstance;

  if (onStatusUpdate) onStatusUpdate("INITIALIZING");

  if (!window.FilesetResolver || !window.FaceLandmarker) {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("MediaPipe script load timeout")), 8000);
      window.addEventListener("mediapipe-ready", () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  const filesetResolver = await window.FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_PATH);

  // Attempt GPU delegate, gracefully fallback to CPU if WebGL fails
  try {
    faceLandmarkerInstance = await window.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: "GPU"
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: BLINK_CONFIG.maxFaces
    });
  } catch (gpuErr) {
    console.warn("GPU delegate unavailable, falling back to CPU delegate:", gpuErr);
    faceLandmarkerInstance = await window.FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: FACE_LANDMARKER_MODEL_URL,
        delegate: "CPU"
      },
      outputFaceBlendshapes: false,
      runningMode: "VIDEO",
      numFaces: BLINK_CONFIG.maxFaces
    });
  }

  isVisionReady = true;
  return faceLandmarkerInstance;
}

export function getFaceLandmarker() {
  return faceLandmarkerInstance;
}

/**
 * 2D Normalized Euclidean Distance
 */
export function euclideanDistance(p1, p2) {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.hypot(dx, dy);
}

/**
 * Calculates Eye Aspect Ratio (EAR) across standard 6-point ocular model
 * Formula:
 *   EAR = (dist(p2, p6) + dist(p3, p5)) / (2 * dist(p1, p4))
 * Note: Euclidean distance Math.hypot(dx, dy) is strictly rotation-invariant,
 * so in-plane head tilt/roll does not skew the vertical-to-horizontal aspect ratio.
 */
export function calculateEAR(landmarks, indices) {
  if (!landmarks || !indices || indices.length < 6) return 0;
  const p1 = landmarks[indices[0]]; // corner 1 (33 or 362)
  const p2 = landmarks[indices[1]]; // upper eyelid 1 (160 or 385)
  const p3 = landmarks[indices[2]]; // upper eyelid 2 (158 or 387)
  const p4 = landmarks[indices[3]]; // corner 2 (133 or 263)
  const p5 = landmarks[indices[4]]; // lower eyelid 2 (153 or 373)
  const p6 = landmarks[indices[5]]; // lower eyelid 1 (145 or 380)

  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6) return 0;

  const vertical1 = euclideanDistance(p2, p6);
  const vertical2 = euclideanDistance(p3, p5);
  const horizontal = euclideanDistance(p1, p4);

  if (horizontal < 0.000001) return 0;
  return (vertical1 + vertical2) / (2.0 * horizontal);
}

/**
 * Robust Left Eye EAR:
 * Vertical pairs [160, 145] and [158, 153] divided by 2 * horizontal [33, 133].
 * Invariant to head tilt due to 2D Euclidean distance preservation.
 */
export function calculateLeftEyeEAR(landmarks) {
  if (!landmarks) return 0;
  const p160 = landmarks[160], p145 = landmarks[145];
  const p158 = landmarks[158], p153 = landmarks[153];
  const p33 = landmarks[33], p133 = landmarks[133];
  if (!p160 || !p145 || !p158 || !p153 || !p33 || !p133) return 0;

  const v1 = euclideanDistance(p160, p145);
  const v2 = euclideanDistance(p158, p153);
  const h = euclideanDistance(p33, p133);
  return h > 0.000001 ? (v1 + v2) / (2.0 * h) : 0;
}

/**
 * Robust Right Eye EAR:
 * Vertical pairs [385, 380] and [387, 373] divided by 2 * horizontal [362, 263].
 * Invariant to head tilt due to 2D Euclidean distance preservation.
 */
export function calculateRightEyeEAR(landmarks) {
  if (!landmarks) return 0;
  const p385 = landmarks[385], p380 = landmarks[380];
  const p387 = landmarks[387], p373 = landmarks[373];
  const p362 = landmarks[362], p263 = landmarks[263];
  if (!p385 || !p380 || !p387 || !p373 || !p362 || !p263) return 0;

  const v1 = euclideanDistance(p385, p380);
  const v2 = euclideanDistance(p387, p373);
  const h = euclideanDistance(p362, p263);
  return h > 0.000001 ? (v1 + v2) / (2.0 * h) : 0;
}

/**
 * Robust Composite EAR across both eyes
 */
export function calculateCompositeEAR(landmarks) {
  return (calculateLeftEyeEAR(landmarks) + calculateRightEyeEAR(landmarks)) / 2.0;
}

/**
 * Estimates 3D Head Pose (Yaw, Pitch, Roll in degrees) from key facial landmarks
 * Landmarks:
 *   1 = Nose tip
 *   10 = Forehead center
 *   152 = Chin
 *   234 = Left face edge / tragion
 *   454 = Right face edge / tragion
 *   33 = Left eye outer corner
 *   263 = Right eye outer corner
 */
export function extractHeadPose(landmarks) {
  const nose = landmarks[1];
  const forehead = landmarks[10];
  const chin = landmarks[152];
  const leftEdge = landmarks[234];
  const rightEdge = landmarks[454];
  const leftEyeOuter = landmarks[33];
  const rightEyeOuter = landmarks[263];

  if (!nose || !forehead || !chin || !leftEdge || !rightEdge) {
    return { yaw: 0, pitch: 0, roll: 0, isDegraded: false };
  }

  // 1. Yaw: horizontal deviation of nose tip relative to face width midpoint
  const faceMidX = (leftEdge.x + rightEdge.x) / 2;
  const halfFaceWidth = Math.max(0.01, (rightEdge.x - leftEdge.x) / 2);
  const yawRatio = (nose.x - faceMidX) / halfFaceWidth;
  const yaw = clamp(yawRatio * 50, -90, 90);

  // 2. Pitch: vertical deviation of nose tip relative to face height midpoint
  const faceMidY = (forehead.y + chin.y) / 2;
  const halfFaceHeight = Math.max(0.01, (chin.y - forehead.y) / 2);
  const pitchRatio = (nose.y - faceMidY) / halfFaceHeight;
  const pitch = clamp(pitchRatio * 45, -90, 90);

  // 3. Roll: angular tilt between eye corners
  const dx = rightEyeOuter.x - leftEyeOuter.x;
  const dy = rightEyeOuter.y - leftEyeOuter.y;
  const roll = (Math.atan2(dy, dx) * (180 / Math.PI));

  // Determine if pose degrades optical EAR accuracy
  const isDegraded = Math.abs(yaw) > BLINK_CONFIG.headPoseMaxYaw || Math.abs(pitch) > BLINK_CONFIG.headPoseMaxPitch;

  return {
    yaw: parseFloat(yaw.toFixed(1)),
    pitch: parseFloat(pitch.toFixed(1)),
    roll: parseFloat(roll.toFixed(1)),
    isDegraded
  };
}

/**
 * Calculates Face Quality metric (0.0 to 1.0) and classification (HIGH / MEDIUM / LOW)
 */
export function calculateFaceQuality(box, pose) {
  let score = 1.0;

  // Penalty for small face size (< 2% of frame area is too far)
  const area = box.width * box.height;
  if (area < 0.02) {
    score -= 0.4;
  } else if (area < 0.05) {
    score -= 0.15;
  }

  // Penalty for being cut off near frame boundaries
  if (box.minX < 0.03 || box.maxX > 0.97 || box.minY < 0.03 || box.maxY > 0.97) {
    score -= 0.25;
  }

  // Penalty for excessive head rotation
  const absYaw = Math.abs(pose.yaw);
  const absPitch = Math.abs(pose.pitch);
  if (absYaw > 25) score -= (absYaw - 25) * 0.015;
  if (absPitch > 20) score -= (absPitch - 20) * 0.015;

  const finalScore = clamp(parseFloat(score.toFixed(2)), 0.0, 1.0);

  let label = "HIGH";
  if (finalScore < 0.45) {
    label = "LOW";
  } else if (finalScore < 0.75) {
    label = "MEDIUM";
  }

  return { score: finalScore, label };
}
