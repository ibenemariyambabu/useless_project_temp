/**
 * ====================================================================
 * BLINKOS — CANVAS OVERLAY, HUD & EAR OSCILLOSCOPE RENDERER
 * ====================================================================
 */

import { LEFT_EYE_INDICES, RIGHT_EYE_INDICES } from "../lib/config.js";

export class CanvasRenderer {
  constructor(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext("2d");
    this.earHistory = []; // rolling history for oscilloscope: [{ ear, openThresh, closeThresh }]
    this.maxHistoryLength = 90;
    this.blinkPulseTimers = new Map(); // participantId -> timestamp

    // Particle simulation, Floating Reactions & Arcade Combo Overlays
    this.particles = [];
    this.floatingEmojis = [];
    this.arcadeOverlays = [];
  }

  /**
   * Resizes the canvas to match source video dimensions
   */
  syncDimensions(videoElement) {
    if (!videoElement || !videoElement.videoWidth) return;
    
    // Crisp, High-Definition canvas scaling matching display physical pixels
    // Prevents blurry or pixelated upscaling when canvas is stretched to fit video container
    const rect = videoElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round((rect.width || videoElement.videoWidth || 640) * dpr);
    const targetH = Math.round((rect.height || videoElement.videoHeight || 480) * dpr);

    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
  }

  /**
   * Clears the canvas frame
   */
  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Triggers a momentary blink visual pulse on a participant box
   */
  triggerBlinkPulse(participantId) {
    this.blinkPulseTimers.set(participantId, performance.now());
  }

  /**
   * Main render pass
   */
  render({
    participants,
    debugMode = false,
    uiFPS = 60,
    visionFPS = 30,
    timestamp = performance.now()
  }) {
    this.clear();
    const w = this.canvas.width;
    const h = this.canvas.height;
    if (!w || !h) return;

    let primaryParticipant = null;

    // 1. Draw each participant
    for (const p of participants) {
      if (!primaryParticipant) primaryParticipant = p;
      this.drawParticipant(p, w, h, timestamp, debugMode);
    }

    // 2. Update and draw Live EAR Oscilloscope for primary participant
    if (primaryParticipant && primaryParticipant.detectorState && primaryParticipant.calibration) {
      this.updateOscilloscope(
        primaryParticipant.detectorState.ear,
        primaryParticipant.calibration.openThreshold,
        primaryParticipant.calibration.closeThreshold
      );

      if (debugMode) {
        this.drawOscilloscope(w, h, primaryParticipant);
      }
    }

    // 3. Draw Global Debug Telemetry Overlay if enabled
    if (debugMode) {
      this.drawGlobalDebugHUD(participants, uiFPS, visionFPS, w, h);
    }

    // 4. Update & Draw Particles, Floating Reactions & Arcade Combo Overlays
    this.updateAndDrawParticles(w, h, uiFPS);
    this.updateAndDrawFloatingEmojis(w, h);
    this.updateAndDrawArcadeOverlays(w, h);
  }

  /**
   * Draws a single participant's bounding reticle, labels, eye contours, and pupil crosshairs
   */
  drawParticipant(p, w, h, timestamp, debugMode) {
    const { box, palette, landmarks, detectorState, calibration, name } = p;
    if (!box) return;

    // Mirrored coordinates to match video { transform: scaleX(-1) }
    const x = (1 - box.maxX) * w;
    const y = box.minY * h;
    const bw = box.width * w;
    const bh = box.height * h;

    const pulseTime = this.blinkPulseTimers.get(p.id) || 0;
    const isPulsing = (timestamp - pulseTime) < 220;

    this.ctx.save();

    // 1. Cyberpunk Corner Brackets - Crisp vector lines with subtle drop-shadow (no blurry wash)
    this.ctx.strokeStyle = isPulsing ? "#ffffff" : palette.hex;
    this.ctx.lineWidth = isPulsing ? 2.5 : 1.75;
    this.ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
    this.ctx.shadowBlur = isPulsing ? 3 : 1;
    this.ctx.shadowOffsetX = 1;
    this.ctx.shadowOffsetY = 1;

    const cornerLength = Math.min(24, bw * 0.2, bh * 0.2);

    // Top-Left
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + cornerLength);
    this.ctx.lineTo(x, y);
    this.ctx.lineTo(x + cornerLength, y);
    this.ctx.stroke();

    // Top-Right
    this.ctx.beginPath();
    this.ctx.moveTo(x + bw - cornerLength, y);
    this.ctx.lineTo(x + bw, y);
    this.ctx.lineTo(x + bw, y + cornerLength);
    this.ctx.stroke();

    // Bottom-Left
    this.ctx.beginPath();
    this.ctx.moveTo(x, y + bh - cornerLength);
    this.ctx.lineTo(x, y + bh);
    this.ctx.lineTo(x + cornerLength, y + bh);
    this.ctx.stroke();

    // Bottom-Right
    this.ctx.beginPath();
    this.ctx.moveTo(x + bw - cornerLength, y + bh);
    this.ctx.lineTo(x + bw, y + bh);
    this.ctx.lineTo(x + bw, y + bh - cornerLength);
    this.ctx.stroke();

    // 2. Participant Header Tag
    const tagH = 22;
    const tagText = `${name} [${calibration ? calibration.statusText : 'SYNCING'}]`;
    this.ctx.font = "bold 11px 'JetBrains Mono', monospace";
    const textWidth = this.ctx.measureText(tagText).width;

    this.ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
    this.ctx.fillRect(x, Math.max(0, y - tagH), textWidth + 16, tagH);

    this.ctx.strokeStyle = palette.hex;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, Math.max(0, y - tagH), textWidth + 16, tagH);

    this.ctx.fillStyle = palette.hex;
    this.ctx.fillText(tagText, x + 8, Math.max(14, y - 6));

    // 3. Eye Landmarks & Crosshairs (mirrored X)
    if (landmarks) {
      this.drawEyeContour(landmarks, LEFT_EYE_INDICES, w, h, palette.hex);
      this.drawEyeContour(landmarks, RIGHT_EYE_INDICES, w, h, palette.hex);
    }

    // 4. Per-Participant Mini Telemetry (if debug mode)
    if (debugMode && detectorState && calibration) {
      this.drawParticipantTelemetry(x, y + bh + 4, detectorState, calibration, palette);
    }

    this.ctx.restore();
  }

  /**
   * Draws ocular contour outline and pupil crosshair
   */
  drawEyeContour(landmarks, indices, w, h, color) {
    this.ctx.save();
    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = "rgba(0, 242, 254, 0.04)";
    this.ctx.lineWidth = 1.0;

    this.ctx.beginPath();
    let sumX = 0, sumY = 0;

    for (let i = 0; i < indices.length; i++) {
      const pt = landmarks[indices[i]];
      // Mirrored X coordinate
      const px = (1 - pt.x) * w;
      const py = pt.y * h;
      sumX += px;
      sumY += py;

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.closePath();
    this.ctx.stroke();
    this.ctx.fill();

    // Pupil center crosshair
    const centerX = sumX / indices.length;
    const centerY = sumY / indices.length;
    const crossSize = 3;

    this.ctx.strokeStyle = "#ffffff";
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(centerX - crossSize, centerY);
    this.ctx.lineTo(centerX + crossSize, centerY);
    this.ctx.moveTo(centerX, centerY - crossSize);
    this.ctx.lineTo(centerX, centerY + crossSize);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawParticipantTelemetry(x, y, det, cal, palette) {
    const lines = [
      `STATE: ${det.state} | EAR: ${det.ear.toFixed(3)} (L:${det.leftEAR.toFixed(2)} R:${det.rightEAR.toFixed(2)})`,
      `BASE: ${(cal.restingOpenEAR || cal.baselineEAR).toFixed(3)} | DOWN:${cal.closeThreshold.toFixed(2)} UP:${(cal.reopenThreshold || cal.openThreshold).toFixed(2)}`,
      `CONF: ${(det.confidence * 100).toFixed(0)}% | QUAL: ${det.quality.label} | YAW: ${det.pose.yaw}°`
    ];

    const boxW = 270;
    const boxH = lines.length * 16 + 8;

    this.ctx.fillStyle = "rgba(10, 15, 29, 0.88)";
    this.ctx.fillRect(x, y, boxW, boxH);
    this.ctx.strokeStyle = palette.hex;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x, y, boxW, boxH);

    this.ctx.font = "10px 'JetBrains Mono', monospace";
    this.ctx.fillStyle = "#e2e8f0";

    for (let i = 0; i < lines.length; i++) {
      this.ctx.fillText(lines[i], x + 8, y + 15 + i * 16);
    }
  }

  /**
   * Updates rolling circular buffer for the EAR oscilloscope
   */
  updateOscilloscope(ear, openThresh, closeThresh) {
    this.earHistory.push({ ear, openThresh, closeThresh });
    if (this.earHistory.length > this.maxHistoryLength) {
      this.earHistory.shift();
    }
  }

  /**
   * Draws the Live EAR Oscilloscope Waveform Graph
   */
  drawOscilloscope(canvasW, canvasH, primaryParticipant) {
    if (this.earHistory.length < 2) return;

    const oscW = 240;
    const oscH = 100;
    const posX = canvasW - oscW - 16;
    const posY = canvasH - oscH - 16;

    this.ctx.save();

    // Background panel
    this.ctx.fillStyle = "rgba(8, 12, 22, 0.88)";
    this.ctx.fillRect(posX, posY, oscW, oscH);
    this.ctx.strokeStyle = "rgba(0, 242, 254, 0.4)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(posX, posY, oscW, oscH);

    // Title & live value
    this.ctx.font = "9px 'JetBrains Mono', monospace";
    this.ctx.fillStyle = "#00f2fe";
    const currentEAR = this.earHistory[this.earHistory.length - 1].ear;
    this.ctx.fillText(`EAR OSCILLOSCOPE [CH-01]`, posX + 8, posY + 14);

    this.ctx.fillStyle = "#38bdf8";
    this.ctx.fillText(`CUR: ${currentEAR.toFixed(3)}`, posX + oscW - 65, posY + 14);

    // Graph Area Bounds
    const graphX = posX + 10;
    const graphY = posY + 22;
    const graphW = oscW - 20;
    const graphH = oscH - 30;

    const minVal = 0.05;
    const maxVal = 0.45;
    const valRange = maxVal - minVal;

    const toY = (val) => graphY + graphH - ((val - minVal) / valRange) * graphH;

    // Draw Reference Lines (Open = Green Dashed, Close = Red Dashed)
    const latest = this.earHistory[this.earHistory.length - 1];
    const openY = toY(latest.openThresh);
    const closeY = toY(latest.closeThresh);

    this.ctx.setLineDash([3, 3]);

    // Open threshold line
    this.ctx.strokeStyle = "rgba(16, 185, 129, 0.7)";
    this.ctx.beginPath();
    this.ctx.moveTo(graphX, openY);
    this.ctx.lineTo(graphX + graphW, openY);
    this.ctx.stroke();

    // Close threshold line
    this.ctx.strokeStyle = "rgba(239, 68, 68, 0.7)";
    this.ctx.beginPath();
    this.ctx.moveTo(graphX, closeY);
    this.ctx.lineTo(graphX + graphW, closeY);
    this.ctx.stroke();

    this.ctx.setLineDash([]); // Reset dash

    // Draw EAR Waveform Path
    this.ctx.strokeStyle = primaryParticipant.palette ? primaryParticipant.palette.hex : "#00f2fe";
    this.ctx.lineWidth = 2.0;
    this.ctx.shadowColor = this.ctx.strokeStyle;
    this.ctx.shadowBlur = 4;

    this.ctx.beginPath();
    const stepX = graphW / (this.maxHistoryLength - 1);

    for (let i = 0; i < this.earHistory.length; i++) {
      const item = this.earHistory[i];
      const px = graphX + i * stepX;
      const py = toY(item.ear);

      if (i === 0) {
        this.ctx.moveTo(px, py);
      } else {
        this.ctx.lineTo(px, py);
      }
    }
    this.ctx.stroke();

    this.ctx.restore();
  }

  /**
   * Draws top-level engine telemetry (FPS, latency, participant count)
   */
  drawGlobalDebugHUD(participants, uiFPS, visionFPS, w, h) {
    const text = `UI: ${Math.round(uiFPS)} FPS | VISION: ${Math.round(visionFPS)} FPS | PARTICIPANTS: ${participants.length}`;

    this.ctx.save();
    this.ctx.font = "bold 11px 'JetBrains Mono', monospace";
    const textW = this.ctx.measureText(text).width;

    this.ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
    this.ctx.fillRect(16, 16, textW + 18, 26);
    this.ctx.strokeStyle = "rgba(0, 242, 254, 0.5)";
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(16, 16, textW + 18, 26);

    this.ctx.fillStyle = "#00f2fe";
    this.ctx.fillText(text, 25, 33);
    this.ctx.restore();
  }

  /**
   * Triggers a burst of geometric cyber confetti particles
   */
  triggerConfettiBurst(x, y, colorHex = "#00f2fe", count = 18) {
    const colors = [colorHex, "#ffffff", "#00FF9D", "#FFE600", "#FF0055"];
    const particleCount = Math.min(22, Math.max(10, count));
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 2.5 + Math.random() * 5.0;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.8,
        size: 2.0 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 1.0,
        decay: 0.025 + Math.random() * 0.025,
        rotation: Math.random() * Math.PI * 2,
        vRot: (Math.random() - 0.5) * 0.2,
        isSpark: Math.random() > 0.35
      });
    }
  }

  /**
   * Triggers an animated floating emoji badge
   */
  triggerEmojiFloater(x, y, emoji = "🔥", label = "SUPERNOVA") {
    this.floatingEmojis.push({
      x,
      y,
      vy: -2.2,
      emoji,
      label,
      alpha: 1.0,
      scale: 0.3,
      targetScale: 1.25,
      createdAt: performance.now()
    });
  }

  /**
   * Triggers combo-specific visual spectacle
   */
  /**
   * Triggers combo-specific visual spectacle anchored strictly to top-right outer margin
   */
  triggerComboFx(comboType, x, y) {
    const canvasW = this.canvas ? this.canvas.width : 640;
    // Anchor strictly to outer top-right margin to leave face tracking canvas clean
    const edgeX = (x !== undefined && x !== null && x > canvasW * 0.6) ? x : canvasW - 110;
    const edgeY = 52;

    switch (comboType) {
      case "TRIPLE_BLINK":
        this.triggerConfettiBurst(edgeX, edgeY, "#FF4500", 35);
        this.triggerEmojiFloater(edgeX, edgeY, "🔥", "SUPERNOVA BURST (+50)");
        break;
      case "DOUBLE_WINK_LEFT":
        this.triggerConfettiBurst(edgeX, edgeY, "#00f2fe", 25);
        this.triggerEmojiFloater(edgeX, edgeY, "⚡", "CYAN LIGHTNING (+30)");
        break;
      case "DOUBLE_WINK_RIGHT":
        this.triggerConfettiBurst(edgeX, edgeY, "#FF007F", 25);
        this.triggerEmojiFloater(edgeX, edgeY, "💥", "PLASMA EXPLOSION (+30)");
        break;
      case "WINK_ALTERNATE":
        this.triggerConfettiBurst(edgeX, edgeY, "#9900FF", 30);
        this.triggerEmojiFloater(edgeX, edgeY, "🚀", "HYPERDRIVE WARP (+40)");
        break;
      case "BLINK_WINK_COMBO":
        this.triggerConfettiBurst(edgeX, edgeY, "#00FF9D", 25);
        this.triggerEmojiFloater(edgeX, edgeY, "👁️", "CYBER MATRIX (+25)");
        break;
      default:
        this.triggerConfettiBurst(edgeX, edgeY, "#FFE600", 20);
        this.triggerEmojiFloater(edgeX, edgeY, "✨", "COMBO REACTION");
        break;
    }
  }

  /**
   * Triggers arcade-style 3D floating pop-up text and particle burst.
   * Anchored strictly to the top-right outer margin to keep central face canvas clean.
   */
  triggerComboStreakFx(streakEvent, x, y) {
    const canvasW = this.canvas ? this.canvas.width : 640;
    // Anchor strictly to outer top-right margin
    const edgeX = (x !== undefined && x !== null && x > canvasW * 0.6) ? x : canvasW - 130;
    const edgeY = 46;
    const { count, title, callout, subtext, color } = streakEvent;

    // 1. Queue arcade pop-up banner docked at top-right margin
    this.arcadeOverlays.push({
      title,
      callout,
      subtext,
      color,
      count,
      x: edgeX,
      y: edgeY,
      scale: 1.25,
      targetScale: 1.0,
      alpha: 1.0,
      vy: -0.25
    });

    if (this.arcadeOverlays.length > 3) {
      this.arcadeOverlays.shift();
    }

    // 2. Launch compact micro-particle burst at top-right margin (clean vector sparks, away from face)
    const particleCount = Math.min(16, 8 + count * 2);
    this.triggerConfettiBurst(edgeX, edgeY, color, particleCount);
  }

  /**
   * Updates physics and draws all active particles
   */
  updateAndDrawParticles(w, h, uiFPS = 60) {
    if (this.particles.length === 0) return;

    this.ctx.save();
    this.ctx.shadowBlur = 0; // zero blurry glow wash

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18; // gravity
      p.vx *= 0.96; // atmospheric drag
      p.rotation += p.vRot;
      p.alpha -= p.decay;

      if (p.alpha <= 0 || p.y > h + 30) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = Math.max(0, p.alpha);
      this.ctx.fillStyle = p.color;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);
      this.ctx.rotate(p.rotation);

      if (p.isSpark) {
        this.ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
      } else {
        this.ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      }
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  /**
   * Updates and draws rising animated reaction emojis and badges
   */
  updateAndDrawFloatingEmojis(w, h) {
    if (this.floatingEmojis.length === 0) return;

    this.ctx.save();
    for (let i = this.floatingEmojis.length - 1; i >= 0; i--) {
      const e = this.floatingEmojis[i];
      e.y += e.vy;
      e.vy *= 0.97; // ease upward float
      e.scale += (e.targetScale - e.scale) * 0.15; // spring scale
      e.alpha -= 0.012; // fade out

      if (e.alpha <= 0) {
        this.floatingEmojis.splice(i, 1);
        continue;
      }

      this.ctx.globalAlpha = Math.max(0, e.alpha);
      this.ctx.save();
      this.ctx.translate(e.x, e.y);
      this.ctx.scale(e.scale, e.scale);

      // 1. Emoji Glyph
      this.ctx.font = "38px sans-serif";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
      this.ctx.shadowBlur = 2;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(e.emoji, 0, -18);

      // 2. Cyber Badge Pill
      if (e.label) {
        this.ctx.font = "bold 11px 'JetBrains Mono', monospace";
        const textWidth = this.ctx.measureText(e.label).width;
        const padX = 8;
        const badgeH = 18;

        this.ctx.fillStyle = "rgba(10, 15, 29, 0.92)";
        this.ctx.strokeStyle = "#00f2fe";
        this.ctx.lineWidth = 1;
        this.ctx.shadowColor = "rgba(0, 0, 0, 0.75)";
        this.ctx.shadowBlur = 2;
        this.ctx.shadowOffsetX = 0;
        this.ctx.shadowOffsetY = 1;

        this.ctx.fillRect(-textWidth / 2 - padX, 8, textWidth + padX * 2, badgeH);
        this.ctx.strokeRect(-textWidth / 2 - padX, 8, textWidth + padX * 2, badgeH);

        this.ctx.fillStyle = "#ffffff";
        this.ctx.textBaseline = "middle";
        this.ctx.fillText(e.label, 0, 17);
      }

      this.ctx.restore();
    }
    this.ctx.restore();
  }

  /**
   * Updates and draws rising arcade-style floating pop-up text overlays
   */
  updateAndDrawArcadeOverlays(w, h) {
    if (this.arcadeOverlays.length === 0) return;

    this.ctx.save();
    for (let i = this.arcadeOverlays.length - 1; i >= 0; i--) {
      const o = this.arcadeOverlays[i];
      o.y += o.vy;
      o.vy *= 0.97;
      o.scale += (o.targetScale - o.scale) * 0.22; // Snappy spring pop
      o.alpha -= 0.014;

      if (o.alpha <= 0) {
        this.arcadeOverlays.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0, o.alpha);
      this.ctx.translate(o.x, o.y);
      this.ctx.scale(o.scale, o.scale);

      // Measure text for dynamic glowing pill
      this.ctx.font = "900 24px 'Orbitron', sans-serif";
      const mainWidth = this.ctx.measureText(o.title).width;
      const boxW = Math.max(220, mainWidth + 56);
      const boxH = 48;

      // Outer glowing pill box - crisp vector border and dark translucent backing
      this.ctx.fillStyle = "rgba(6, 10, 22, 0.94)";
      this.ctx.strokeStyle = o.color;
      this.ctx.lineWidth = 1.75;
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 2;

      this.ctx.beginPath();
      this.ctx.roundRect(-boxW / 2, -boxH / 2, boxW, boxH, 6);
      this.ctx.fill();
      this.ctx.stroke();

      // Main arcade title
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillStyle = o.color;
      this.ctx.shadowColor = "rgba(0, 0, 0, 0.85)";
      this.ctx.shadowBlur = 2;
      this.ctx.shadowOffsetX = 0;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(o.title, 0, -7);

      // Callout / subtext
      this.ctx.font = "bold 11px 'JetBrains Mono', monospace";
      this.ctx.fillStyle = "#e2e8f0";
      this.ctx.shadowBlur = 0;
      this.ctx.fillText(`${o.callout} • ${o.subtext}`, 0, 14);

      this.ctx.restore();
    }
    this.ctx.restore();
  }
}
