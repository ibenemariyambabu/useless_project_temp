/**
 * ====================================================================
 * BLINKOS — MULTI-PERSON SPATIAL TRACKER & ASSOCIATION
 * ====================================================================
 */

import { BLINK_CONFIG, PARTICIPANT_PALETTE, clamp } from "../lib/config.js";

/**
 * Extracts a normalized bounding box from facial landmarks
 */
export function extractFaceBoundingBox(landmarks) {
  let minX = 1.0, maxX = 0.0;
  let minY = 1.0, maxY = 0.0;

  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }

  // Add slight padding around facial features
  const padX = (maxX - minX) * 0.05;
  const padY = (maxY - minY) * 0.05;

  const bMinX = clamp(minX - padX, 0, 1);
  const bMaxX = clamp(maxX + padX, 0, 1);
  const bMinY = clamp(minY - padY, 0, 1);
  const bMaxY = clamp(maxY + padY, 0, 1);

  const width = bMaxX - bMinX;
  const height = bMaxY - bMinY;

  return {
    minX: bMinX,
    maxX: bMaxX,
    minY: bMinY,
    maxY: bMaxY,
    width,
    height,
    centerX: bMinX + width / 2,
    centerY: bMinY + height / 2
  };
}

/**
 * Calculates Intersection over Union (IoU) between two 2D boxes
 */
export function calculateIoU(box1, box2) {
  const interMinX = Math.max(box1.minX, box2.minX);
  const interMaxX = Math.min(box1.maxX, box2.maxX);
  const interMinY = Math.max(box1.minY, box2.minY);
  const interMaxY = Math.min(box1.maxY, box2.maxY);

  const interWidth = Math.max(0, interMaxX - interMinX);
  const interHeight = Math.max(0, interMaxY - interMinY);
  const interArea = interWidth * interHeight;

  if (interArea <= 0) return 0;

  const area1 = box1.width * box1.height;
  const area2 = box2.width * box2.height;
  const unionArea = area1 + area2 - interArea;

  return unionArea > 0 ? interArea / unionArea : 0;
}

/**
 * Multi-person face tracker with persistent identities, EMA smoothing,
 * and 2000ms disconnect grace periods.
 */
export class FaceTracker {
  constructor(callbacks = {}) {
    this.participants = new Map(); // id -> participant object
    this.nextParticipantSeq = 1;
    this.callbacks = {
      onJoined: callbacks.onJoined || (() => {}),
      onLeft: callbacks.onLeft || (() => {}),
      onReacquired: callbacks.onReacquired || (() => {})
    };
  }

  /**
   * Matches raw detected faces against existing participant identities
   * @param {Array<Array<{x, y, z}>>} rawLandmarksList - List of landmark sets from MediaPipe
   * @param {number} timestamp - Current high-res timestamp (ms)
   * @returns {Array<Object>} List of currently tracked participant objects
   */
  update(rawLandmarksList, timestamp = performance.now()) {
    const detections = rawLandmarksList.map(landmarks => ({
      landmarks,
      box: extractFaceBoundingBox(landmarks)
    }));

    const existingList = Array.from(this.participants.values());
    const matchedExistingIds = new Set();
    const matchedDetectionIndices = new Set();

    // 1. Calculate similarity matrix between existing participants and new detections
    // Score = 0.65 * CentroidSim + 0.35 * IoU
    const candidatePairs = [];

    for (let d = 0; d < detections.length; d++) {
      const det = detections[d];
      for (const participant of existingList) {
        const centroidDist = Math.hypot(
          participant.box.centerX - det.box.centerX,
          participant.box.centerY - det.box.centerY
        );

        if (centroidDist > BLINK_CONFIG.maxMatchDistance) continue;

        const centroidSim = Math.max(0, 1 - (centroidDist / BLINK_CONFIG.maxMatchDistance));
        const iou = calculateIoU(participant.box, det.box);
        const score = (BLINK_CONFIG.centroidWeight * centroidSim) + (BLINK_CONFIG.iouWeight * iou);

        if (score > 0.25) {
          candidatePairs.push({
            detectionIdx: d,
            participantId: participant.id,
            score
          });
        }
      }
    }

    // 2. Sort candidate pairs by match score descending (Greedy Bipartite Matching)
    candidatePairs.sort((a, b) => b.score - a.score);

    for (const pair of candidatePairs) {
      if (matchedDetectionIndices.has(pair.detectionIdx) || matchedExistingIds.has(pair.participantId)) {
        continue;
      }

      const participant = this.participants.get(pair.participantId);
      const det = detections[pair.detectionIdx];

      // Coordinate EMA Smoothing: smoothed = old * 0.7 + new * 0.3
      const alpha = BLINK_CONFIG.boxSmoothingAlpha;
      participant.box = {
        minX: participant.box.minX * (1 - alpha) + det.box.minX * alpha,
        maxX: participant.box.maxX * (1 - alpha) + det.box.maxX * alpha,
        minY: participant.box.minY * (1 - alpha) + det.box.minY * alpha,
        maxY: participant.box.maxY * (1 - alpha) + det.box.maxY * alpha,
        width: participant.box.width * (1 - alpha) + det.box.width * alpha,
        height: participant.box.height * (1 - alpha) + det.box.height * alpha,
        centerX: participant.box.centerX * (1 - alpha) + det.box.centerX * alpha,
        centerY: participant.box.centerY * (1 - alpha) + det.box.centerY * alpha
      };

      participant.landmarks = det.landmarks;
      participant.lastSeen = timestamp;

      if (participant.status === "lost_grace") {
        participant.status = "active";
        this.callbacks.onReacquired(participant);
      }

      matchedDetectionIndices.add(pair.detectionIdx);
      matchedExistingIds.add(pair.participantId);
    }

    // 3. Create new participants for unmatched detections (capped at maxFaces)
    for (let d = 0; d < detections.length; d++) {
      if (matchedDetectionIndices.has(d)) continue;
      if (this.participants.size >= BLINK_CONFIG.maxFaces) continue;

      const det = detections[d];
      const seq = this.nextParticipantSeq++;
      const id = `person-${seq}`;
      const colorIndex = (seq - 1) % PARTICIPANT_PALETTE.length;
      const palette = PARTICIPANT_PALETTE[colorIndex];

      const newParticipant = {
        id,
        seq,
        name: `PERSON ${seq}`,
        palette,
        box: det.box,
        landmarks: det.landmarks,
        firstSeen: timestamp,
        lastSeen: timestamp,
        status: "active", // "active" | "lost_grace" | "left"
        // Dynamic Calibration State
        calibration: null,
        // Detector & Temporal State Machine
        detectorState: null
      };

      this.participants.set(id, newParticipant);
      this.callbacks.onJoined(newParticipant);
    }

    // 4. Handle missing participants (disconnect grace period)
    const participantsToRemove = [];

    for (const participant of this.participants.values()) {
      if (!matchedExistingIds.has(participant.id) && participant.lastSeen !== timestamp) {
        const timeSinceSeen = timestamp - participant.lastSeen;
        if (timeSinceSeen <= BLINK_CONFIG.lostGracePeriod) {
          participant.status = "lost_grace";
        } else {
          participant.status = "left";
          participantsToRemove.push(participant.id);
          this.callbacks.onLeft(participant);
        }
      }
    }

    // Purge departed participants
    for (const removeId of participantsToRemove) {
      this.participants.delete(removeId);
    }

    return Array.from(this.participants.values());
  }

  getParticipant(id) {
    return this.participants.get(id) || null;
  }

  getAll() {
    return Array.from(this.participants.values());
  }

  clear() {
    this.participants.clear();
  }
}
