/**
 * ====================================================================
 * BLINKOS v2.0 — COMPUTER-VISION OPERATING SYSTEM
 * Modular Orchestrator & Authoritative Blink Event Coordinator
 * ====================================================================
 */

import {
  BLINK_CONFIG,
  PARTICIPANT_PALETTE,
  clamp
} from "../lib/config.js";

import {
  initMediaPipeVision,
  getFaceLandmarker
} from "../cv/vision.js";

import {
  FaceTracker
} from "../cv/faceTracker.js";

import {
  CalibrationEngine
} from "../cv/calibration.js";

import {
  BlinkDetector,
  BLINK_STATES
} from "../cv/blinkDetector.js";

import {
  CanvasRenderer
} from "../cv/renderer.js";

import {
  api,
  BlinkWebSocketClient
} from "../services/api.js";

// ====================================================================
// 1. ACHIEVEMENTS REGISTRY & CHALLENGES
// ====================================================================
const ACHIEVEMENTS = [
  {
    id: "first_blink",
    icon: "👁️",
    title: "FIRST BLINK",
    desc: "First detected blink in the session.",
    condition: (s) => s.totalBlinks >= 1
  },
  {
    id: "first_10",
    icon: "🔟",
    title: "FIRST 10",
    desc: "A participant completed 10 blinks.",
    condition: (s) => s.participants.some(p => p.blinkCount >= 10)
  },
  {
    id: "blink_machine",
    icon: "⚡",
    title: "BLINK MACHINE",
    desc: "50 blinks accumulated by a single participant.",
    condition: (s) => s.participants.some(p => p.blinkCount >= 50)
  },
  {
    id: "speed_blinker",
    icon: "🚀",
    title: "SPEED BLINKER",
    desc: "5 blinks detected within 10 seconds.",
    condition: (s) => s.hasSpeedBlinker
  },
  {
    id: "npc_mode",
    icon: "🗿",
    title: "NPC MODE",
    desc: "A participant went 20+ seconds without blinking.",
    condition: (s) => s.participants.some(p => p.longestStreak >= 20 || (Date.now() - (p.lastBlinkTime || s.sessionStartTime)) >= 20000)
  },
  {
    id: "blink_champion",
    icon: "👑",
    title: "BLINK CHAMPION",
    desc: "Won an optical competition battle.",
    condition: (s) => s.hasCompetitionWinner
  },
  {
    id: "social_blinking",
    icon: "👥",
    title: "SOCIAL BLINKING",
    desc: "Three or more participants detected simultaneously.",
    condition: (s) => s.maxSimultaneousFaces >= 3
  }
];

const RANDOM_CHALLENGES = [
  "Blink 5 times as fast as humanly possible.",
  "Don't blink for 8 seconds (Retina Endurance).",
  "Reach 10 blinks before the other participants.",
  "First person to blink wins the staring tiebreaker.",
  "Blink 3 times within 4 seconds.",
  "Hold eyes wide open for 12 seconds."
];

// ====================================================================
// 2. GLOBAL SYSTEM STATE
// ====================================================================
const state = {
  isVisionReady: false,
  isMonitoring: false,
  stream: null,
  animFrameId: null,

  // Modular Computer Vision Engines
  faceTracker: null,
  renderer: null,

  // Sensitivity Tuning
  earThreshold: 0.21,

  // Multi-Participant Storage
  participants: [], // Array of extended participant entities
  selectedParticipantId: null,
  activeMode: "IDLE", // "IDLE" | "SOLO" | "COMPETITION" | "X-WAY COMPETITION"
  maxSimultaneousFaces: 0,

  // Session Stats
  sessionStartTime: null,
  totalBlinks: 0,

  // Decoupled Performance Telemetry
  uiFPS: 60,
  visionFPS: 30,
  uiFrameCount: 0,
  visionFrameCount: 0,
  lastUiFpsTime: performance.now(),
  lastVisionFpsTime: performance.now(),
  lastVisionInferenceTime: 0,
  lastVideoCurrentTime: -1,
  isInferring: false,
  lastDomUpdateTime: 0,

  // Developer Debug Mode
  debugMode: false,

  // Person Scan Feature
  isScanning: false,
  scanStartTime: 0,

  // Competition Battle Arena
  battle: {
    state: "idle", // "idle" | "running" | "paused" | "finished"
    duration: 60,  // seconds
    remaining: 60,
    timerId: null,
    startBlinks: {},
    winner: null
  },

  // Blink Race Mini-Game
  race: {
    state: "idle", // "idle" | "countdown" | "waiting_blink" | "finished"
    countdownVal: 3,
    countdownTimerId: null,
    blinkStartTime: 0,
    winner: null,
    reactionTimeSec: 0
  },

  // Random Challenge
  challenge: {
    text: RANDOM_CHALLENGES[0],
    status: "IN PROGRESS"
  },

  // Synthesized Audio
  soundEnabled: false,
  audioCtx: null,

  // Blink Hero Rhythm Minigame
  rhythm: {
    isRunning: false,
    difficulty: "casual", // "casual", "cyber", "overclock"
    speed: 2.4,
    spawnInterval: 1200,
    lastSpawnTime: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    totalHits: 0,
    totalNotes: 0,
    notes: [],
    animId: null,
    audioBeatTimer: null,
    beatStep: 0
  },

  // NEO-PET (Tamagotchi Engine)
  pet: {
    name: "NEO-CYBER",
    stage: "CYBER-EGG", // "CYBER-EGG", "NEON SPRITE", "MECHA-FOX", "QUANTUM DRAGON"
    level: 1,
    xp: 0,
    health: 100.0,
    energy: 100.0,
    happiness: 100.0,
    totalBlinksFed: 0,
    lastUpdate: Date.now()
  },

  // Soundboard & Gesture Buffer
  reactions: {
    gestureBuffer: []
  },

  // Achievements
  unlockedAchievements: new Set(),
  hasCompetitionWinner: false,
  hasSpeedBlinker: false
};

// ====================================================================
// 3. DOM ELEMENT REFERENCES (All 91 exact IDs preserved)
// ====================================================================
const DOM = {
  bootScreen: document.getElementById("boot-screen"),
  bootLogs: document.getElementById("boot-logs"),
  bootProgressFill: document.getElementById("boot-progress-fill"),
  bootStatusText: document.getElementById("boot-status-text"),
  blinkFlashOverlay: document.getElementById("blink-flash-overlay"),
  appContainer: document.getElementById("app-container"),
  viewportCard: document.querySelector(".camera-viewport-card"),

  // Header Elements
  presenceBadge: document.getElementById("presence-badge"),
  presenceIcon: document.getElementById("presence-icon"),
  presenceText: document.getElementById("presence-text"),
  modeBadge: document.getElementById("mode-badge"),
  modeText: document.getElementById("mode-text"),
  featuresModalBtn: document.getElementById("features-modal-btn"),
  debugToggleBtn: document.getElementById("debug-toggle-btn"),
  debugLabel: document.getElementById("debug-label"),
  soundToggleBtn: document.getElementById("sound-toggle-btn"),
  soundIcon: document.getElementById("sound-icon"),
  soundLabel: document.getElementById("sound-label"),
  sysStatusIndicator: document.getElementById("system-status-indicator"),
  sysStatusText: document.getElementById("system-status-text"),

  // Hero Actions
  startBtn: document.getElementById("start-btn"),
  startBtnText: document.getElementById("start-btn-text"),
  scanPersonBtn: document.getElementById("scan-person-btn"),
  newSessionBtn: document.getElementById("new-session-btn"),
  exportResultsBtn: document.getElementById("export-results-btn"),
  copyResultsBtn: document.getElementById("copy-results-btn"),

  // Camera Panel & Overlays
  video: document.getElementById("webcam-video"),
  canvas: document.getElementById("vision-canvas"),
  faceCountBadge: document.getElementById("face-count-badge"),
  camStatusBadge: document.getElementById("cam-status-badge"),
  hudTrackingInfo: document.getElementById("hud-tracking-info"),
  hudFpsVal: document.getElementById("hud-fps-val"),
  viewportBlinkTag: document.getElementById("viewport-blink-tag"),
  arcadeAnnouncerBanner: document.getElementById("arcade-announcer-banner"),
  arcadeBannerPill: document.getElementById("arcade-banner-pill"),
  arcadeBannerMultiplier: document.getElementById("arcade-banner-multiplier"),
  arcadeBannerTitle: document.getElementById("arcade-banner-title"),
  arcadeBannerCallout: document.getElementById("arcade-banner-callout"),
  scanTargetOverlay: document.getElementById("scan-target-overlay"),
  scanStatusText: document.getElementById("scan-status-text"),
  cameraPlaceholder: document.getElementById("camera-placeholder"),
  cameraErrorBanner: document.getElementById("camera-error-banner"),
  cameraErrorTitle: document.getElementById("camera-error-title"),
  cameraErrorDesc: document.getElementById("camera-error-desc"),
  cameraRetryBtn: document.getElementById("camera-retry-btn"),

  // Sensitivity Slider
  sensitivitySlider: document.getElementById("sensitivity-slider"),
  sensitivityValText: document.getElementById("sensitivity-val-text"),
  hudTrackMode: document.getElementById("hud-track-mode"),

  // Multi-Line Graph
  chartCanvas: document.getElementById("activity-chart-canvas"),
  chartEmptyMsg: document.getElementById("chart-empty-msg"),
  chartDynamicLegend: document.getElementById("chart-dynamic-legend"),

  // Battle Arena
  battleStatusPill: document.getElementById("battle-status-pill"),
  roundBtnGroup: document.getElementById("round-btn-group"),
  battleStartBtn: document.getElementById("battle-start-btn"),
  battlePauseBtn: document.getElementById("battle-pause-btn"),
  battleResetBtn: document.getElementById("battle-reset-btn"),
  battleClockVal: document.getElementById("battle-clock-val"),
  battleLeaderVal: document.getElementById("battle-leader-val"),
  battleWinnerBanner: document.getElementById("battle-winner-banner"),
  winnerName: document.getElementById("winner-name"),
  winnerStats: document.getElementById("winner-stats"),

  // Participant Cards & Leaderboard
  participantCountIndicator: document.getElementById("participant-count-indicator"),
  participantsList: document.getElementById("participants-list"),
  leaderboardList: document.getElementById("leaderboard-list"),
  hlMostActive: document.getElementById("hl-most-active"),
  hlFastestRate: document.getElementById("hl-fastest-rate"),
  hlLongestStreak: document.getElementById("hl-longest-streak"),

  // Mini-Games Tabs & Views
  tabRaceBtn: document.getElementById("tab-race-btn"),
  tabRhythmBtn: document.getElementById("tab-rhythm-btn"),
  tabPetBtn: document.getElementById("tab-pet-btn"),
  tabReactionsBtn: document.getElementById("tab-reactions-btn"),
  tabChallengeBtn: document.getElementById("tab-challenge-btn"),
  gameRaceView: document.getElementById("game-race-view"),
  gameRhythmView: document.getElementById("game-rhythm-view"),
  gamePetView: document.getElementById("game-pet-view"),
  gameReactionsView: document.getElementById("game-reactions-view"),
  gameChallengeView: document.getElementById("game-challenge-view"),

  // Race Controls
  startRaceBtn: document.getElementById("start-race-btn"),
  raceStatusBig: document.getElementById("race-status-big"),
  raceResultSub: document.getElementById("race-result-sub"),

  // Rhythm View Elements
  rhythmCanvas: document.getElementById("rhythm-canvas"),
  rhythmScore: document.getElementById("rhythm-score"),
  rhythmStreak: document.getElementById("rhythm-streak"),
  rhythmRating: document.getElementById("rhythm-rating"),
  rhythmAcc: document.getElementById("rhythm-acc"),
  startRhythmBtn: document.getElementById("start-rhythm-btn"),
  stopRhythmBtn: document.getElementById("stop-rhythm-btn"),

  // Cyber Pet Elements
  petStageName: document.getElementById("pet-stage-name"),
  petStagePill: document.getElementById("pet-stage-pill"),
  petHealthBar: document.getElementById("pet-health-bar"),
  petHealthVal: document.getElementById("pet-health-val"),
  petEnergyBar: document.getElementById("pet-energy-bar"),
  petEnergyVal: document.getElementById("pet-energy-val"),
  petHappyBar: document.getElementById("pet-happy-bar"),
  petHappyVal: document.getElementById("pet-happy-val"),
  petXpBar: document.getElementById("pet-xp-bar"),
  petXpVal: document.getElementById("pet-xp-val"),
  petLvlNum: document.getElementById("pet-lvl-num"),
  petStatusMsg: document.getElementById("pet-status-msg"),
  petFeedBtn: document.getElementById("pet-feed-btn"),
  petHydrateBtn: document.getElementById("pet-hydrate-btn"),
  petEyeLeft: document.getElementById("pet-eye-left"),
  petEyeRight: document.getElementById("pet-eye-right"),
  petBody: document.getElementById("pet-body"),
  petMouth: document.getElementById("pet-mouth"),

  // Soundboard Elements
  gestureBufferDisplay: document.getElementById("gesture-buffer-display"),

  // Challenge Controls
  newChallengeBtn: document.getElementById("new-challenge-btn"),
  randomChallengeText: document.getElementById("random-challenge-text"),
  randomChallengeStatus: document.getElementById("random-challenge-status"),

  // Achievements
  currentAchIcon: document.getElementById("current-ach-icon"),
  currentAchTitle: document.getElementById("current-ach-title"),
  currentAchDesc: document.getElementById("current-ach-desc"),
  quickBadgesList: document.getElementById("quick-badges-list"),
  viewAllAchievementsBtn: document.getElementById("view-all-achievements-btn"),

  // System Terminal
  systemTerminal: document.getElementById("system-terminal"),
  clearTerminalBtn: document.getElementById("clear-terminal-btn"),

  // Modals
  featuresModal: document.getElementById("features-modal"),
  closeFeaturesModalBtn: document.getElementById("close-features-modal-btn"),
  historyModal: document.getElementById("history-modal"),
  closeHistoryModalBtn: document.getElementById("close-history-modal-btn"),
  historyModalContent: document.getElementById("history-modal-content"),
  achievementsModal: document.getElementById("achievements-modal"),
  closeAchModalBtn: document.getElementById("close-ach-modal-btn"),
  modalAchievementsList: document.getElementById("modal-achievements-list"),
  sessionReportModal: document.getElementById("session-report-modal"),
  closeReportModalBtn: document.getElementById("close-report-modal-btn"),
  sessionReportContent: document.getElementById("session-report-content"),
  modalExportJsonBtn: document.getElementById("modal-export-json-btn"),
  modalCopySummaryBtn: document.getElementById("modal-copy-summary-btn")
};

const chartCtx = DOM.chartCanvas.getContext("2d");

// ====================================================================
// 4. BOOT SEQUENCE ENGINE
// ====================================================================
async function runBootSequence() {
  const bootSteps = [
    { text: "BLINKOS v2.0.0 (x86_64-vision-person-aware)", delay: 120, progress: 15 },
    { text: "INITIALIZING MULTI-PERSON COMPUTER VISION...", delay: 180, progress: 35 },
    { text: "Loading MediaPipe Tasks Vision WebAssembly...", delay: 240, progress: 60 },
    { text: "Compiling Dynamic Ocular Calibration Engine...", delay: 200, progress: 80 },
    { text: "Allocating Independent Telemetry Buffers & Temporal State Machine...", delay: 180, progress: 95 },
    { text: "PERSON-AWARE COMPUTER-VISION OPERATING SYSTEM READY.", delay: 200, progress: 100 }
  ];

  for (const step of bootSteps) {
    await new Promise((resolve) => setTimeout(resolve, step.delay));
    const p = document.createElement("p");
    p.textContent = step.text;
    DOM.bootLogs.appendChild(p);
    DOM.bootProgressFill.style.width = `${step.progress}%`;
    DOM.bootStatusText.textContent = `SYSTEM INITIALIZATION [${step.progress}%]`;
  }

  // Pre-load MediaPipe in background
  initMediaPipeVision((status) => setSystemStatus(status)).catch((err) => {
    console.warn("Vision model preloading:", err);
  });

  await new Promise((resolve) => setTimeout(resolve, 300));
  DOM.bootScreen.classList.add("fade-out");
  document.body.classList.remove("booting");

  logSystemMessage("BlinkOS v2.0 Accurate Computer Vision Engine Loaded.", "emerald");
  logSystemMessage("Dynamic ocular calibration, 4-state machine & spatial tracker ready.", "cyan");
  logSystemMessage("Click START MONITORING to activate optical surveillance.", "dim");
}

// ====================================================================
// 5. WEBCAM & MONITORING LIFECYCLE
// ====================================================================
export async function startMonitoring() {
  if (state.isMonitoring) return;

  setSystemStatus("INITIALIZING");
  DOM.cameraPlaceholder.classList.add("hidden");
  DOM.cameraErrorBanner.classList.add("hidden");

  try {
    let landmarker = getFaceLandmarker();
    if (!landmarker) {
      logSystemMessage("Compiling neural vision models (MediaPipe Tasks Vision)...", "dim");
      landmarker = await initMediaPipeVision((status) => setSystemStatus(status));
    }

    const constraints = {
      audio: false,
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: "user"
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    state.stream = stream;
    DOM.video.srcObject = stream;

    await new Promise((resolve) => {
      DOM.video.onloadedmetadata = () => {
        DOM.video.play();
        resolve();
      };
    });

    state.isMonitoring = true;
    state.sessionStartTime = state.sessionStartTime || Date.now();

    // Initialize FaceTracker & CanvasRenderer
    state.renderer = new CanvasRenderer(DOM.canvas);
    state.faceTracker = new FaceTracker({
      onJoined: (p) => {
        setupParticipantEntity(p);
        logSystemMessage(`[PRESENCE] ${p.name} DETECTED (assigned ${p.palette.name} ${p.palette.hex}).`, "emerald");
        playSynthesizedChime();
      },
      onLeft: (p) => {
        logSystemMessage(`[PRESENCE] ${p.name} LEFT the optical frame.`, "dim");
      },
      onReacquired: (p) => {
        logSystemMessage(`[PRESENCE] ${p.name} reconnected to existing identity.`, "cyan");
      }
    });

    state.renderer.syncDimensions(DOM.video);

    DOM.startBtn.classList.add("monitoring-active");
    DOM.startBtnText.textContent = "STOP MONITORING";
    DOM.camStatusBadge.className = "badge badge-live";
    DOM.camStatusBadge.textContent = "🟢 CAMERA ACTIVE";
    DOM.chartEmptyMsg.classList.add("hidden");
    setSystemStatus("ONLINE");

    logSystemMessage("Optical surveillance active. Watching for human presence.", "emerald");

    state.lastUiFpsTime = performance.now();
    state.lastVisionFpsTime = performance.now();
    state.uiFrameCount = 0;
    state.visionFrameCount = 0;
    state.lastVisionInferenceTime = 0;
    state.lastVideoCurrentTime = -1;

    requestAnimationFrame(renderLoop);

  } catch (err) {
    console.error("Camera access error:", err);
    state.isMonitoring = false;
    DOM.cameraPlaceholder.classList.remove("hidden");
    handleCameraError(err);
  }
}

export function stopMonitoring() {
  if (!state.isMonitoring) return;

  state.isMonitoring = false;

  if (state.stream) {
    state.stream.getTracks().forEach((track) => track.stop());
    state.stream = null;
  }

  if (state.animFrameId) {
    cancelAnimationFrame(state.animFrameId);
    state.animFrameId = null;
  }

  DOM.video.srcObject = null;
  DOM.cameraPlaceholder.classList.remove("hidden");

  if (state.renderer) {
    state.renderer.clear();
  }

  DOM.startBtn.classList.remove("monitoring-active");
  DOM.startBtnText.textContent = "START MONITORING";
  DOM.camStatusBadge.className = "badge badge-offline";
  DOM.camStatusBadge.textContent = "🔴 CAMERA OFF";
  DOM.faceCountBadge.className = "badge badge-idle";
  DOM.faceCountBadge.textContent = "NO HUMAN DETECTED";
  setSystemStatus("CAMERA OFF");

  updatePresenceUI(0);
  logSystemMessage("Monitoring halted. Optical sensor deactivated.", "dim");
}

function handleCameraError(err) {
  setSystemStatus("CAMERA ERROR");
  DOM.cameraErrorBanner.classList.remove("hidden");

  let title = "CAMERA ACCESS ERROR";
  let desc = "BlinkOS encountered an optical access issue.";

  if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
    title = "PERMISSION DENIED";
    desc = "BlinkOS cannot monitor your blinking if camera permission is blocked. Please enable camera permissions in your browser.";
  } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
    title = "NO CAMERA DETECTED";
    desc = "No physical optical sensor was found on your machine.";
  } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
    title = "CAMERA ALREADY IN USE";
    desc = "Another application (Zoom, Teams, Meet, or browser tab) is locking the webcam.";
  }

  DOM.cameraErrorTitle.textContent = title;
  DOM.cameraErrorDesc.textContent = desc;
  logSystemMessage(`CRITICAL: ${title} — ${desc}`, "amber");
}

// ====================================================================
// 6. PARTICIPANT ENTITY INITIALIZATION & EXTENSION
// ====================================================================
function setupParticipantEntity(p) {
  // Add dashboard tracking fields to the faceTracker participant object
  p.color = p.palette.hex;
  p.colorRgb = p.palette.rgb;
  p.blinkCount = 0;
  p.blinkHistory = []; // [{ number, timestamp, intervalMs, duration, confidence, minEAR }]
  p.lastBlinkTime = null;
  p.blinkRate = "0.0";
  p.currentStreak = 0;
  p.longestStreak = 0;
  p.lastStreakBlinkTime = null;
  p.eyeState = "OPEN";
  p.currentEAR = BLINK_CONFIG.defaultBaselineEAR;
  p.leftEAR = BLINK_CONFIG.defaultBaselineEAR;
  p.rightEAR = BLINK_CONFIG.defaultBaselineEAR;
  p.chartBuckets = new Array(60).fill(0);

  // Initialize Dynamic Calibration Engine
  p.calibration = new CalibrationEngine(p.id, (calibResult) => {
    logSystemMessage(`[CALIBRATION] ${p.name} baseline locked at EAR ${calibResult.baselineEAR} (Close: ${calibResult.closeThreshold}, Open: ${calibResult.openThreshold}).`, "cyan");
  });

  // Initialize 4-State Temporal Blink Detector with Combo Recognizer
  p.detector = new BlinkDetector(p.id, p.calibration, {
    onBlink: (blinkEvent) => {
      handleAuthoritativeBlink(p, blinkEvent);
    },
    onWink: (winkEvent) => {
      handleAuthoritativeWink(p, winkEvent);
    },
    onLongClosure: (longClosureEvent) => {
      logSystemMessage(`[FILTER] ${p.name} prolonged eye closure (${Math.round(longClosureEvent.duration)}ms). Normal blink suppressed.`, "dim");
    },
    onCombo: (comboEvent) => {
      handleAuthoritativeCombo(p, comboEvent);
    },
    onComboStreak: (streakEvent) => {
      handleAuthoritativeComboStreak(p, streakEvent);
    },
    onStateChange: (newState, priorState) => {
      p.eyeState = newState;
    }
  });
}

// ====================================================================
// 7. AUTHORITATIVE BLINK EVENT DISPATCHER (Single Source of Truth)
// ====================================================================
function handleAuthoritativeBlink(p, blinkEvent) {
  p.blinkCount++;
  state.totalBlinks++;

  const now = blinkEvent.timestamp;
  const intervalMs = p.lastBlinkTime ? now - p.lastBlinkTime : 0;

  p.blinkHistory.push({
    number: p.blinkCount,
    timestamp: now,
    intervalMs,
    duration: blinkEvent.duration,
    confidence: blinkEvent.confidence,
    minEAR: blinkEvent.minEAR
  });

  if (p.blinkHistory.length > BLINK_CONFIG.maxBlinkHistory) {
    p.blinkHistory.shift();
  }

  p.lastBlinkTime = now;

  // Streak calculation (resets if gap > STREAK_TIMEOUT_MS)
  if (p.lastStreakBlinkTime && (now - p.lastStreakBlinkTime <= BLINK_CONFIG.streakTimeout)) {
    p.currentStreak++;
  } else {
    p.currentStreak = 1;
  }
  p.lastStreakBlinkTime = now;

  if (p.currentStreak > p.longestStreak) {
    p.longestStreak = p.currentStreak;
  }

  // Add to Activity Chart bucket
  p.chartBuckets[p.chartBuckets.length - 1]++;

  // Visual & Audio Feedback
  if (state.renderer) {
    state.renderer.triggerBlinkPulse(p.id);
  }
  triggerBlinkFlash();
  playSynthesizedParticipantTone(p.seq || 1);

  // Viewport Blink Tag
  DOM.viewportBlinkTag.textContent = `⚡ ${p.name} BLINK CONFIRMED (${(blinkEvent.confidence * 100).toFixed(0)}%)`;
  DOM.viewportBlinkTag.style.borderColor = p.palette ? p.palette.hex : p.color;
  DOM.viewportBlinkTag.classList.add("show");
  setTimeout(() => DOM.viewportBlinkTag.classList.remove("show"), 350);

  // Mini-Game: Quick-Draw Blink Race check
  if (state.race.state === "waiting_blink") {
    resolveBlinkRaceWinner(p, now);
  }

  // Mini-Game: Blink Hero Rhythm Input (Lane 1 = Center Blink)
  if (state.rhythm && state.rhythm.isRunning) {
    handleRhythmInput(1);
  }

  // NEO-PET: React to blink
  triggerPetBlinkAnimation("BOTH");
  feedPetOnBlink(p);

  // Soundboard gesture buffer update
  addGestureToBuffer("BLINK");

  // Achievement Check: Speed Blinker (5 blinks in 10s)
  const blinksIn10s = p.blinkHistory.filter(h => now - h.timestamp <= 10000).length;
  if (blinksIn10s >= 5) {
    state.hasSpeedBlinker = true;
  }

  // Monospace Terminal Logging
  if (p.blinkCount % 10 === 0) {
    logSystemMessage(`[MILESTONE] ${p.name} reached ${p.blinkCount} blinks. High endurance optical activity!`, "cyan");
  } else {
    logSystemMessage(
      `[BLINK] ${p.name} blink #${p.blinkCount} validated (${blinkEvent.duration}ms, drop: ${blinkEvent.earDrop}, conf: ${(blinkEvent.confidence * 100).toFixed(0)}%).`,
      "emerald"
    );
  }

  evaluateAchievements();

  // Instant Zero-Debounce WebSocket Broadcast to Room
  if (window.blinkWs) {
    window.blinkWs.sendBlink({
      participant_key: p.name || `PERSON ${p.id}`,
      name: p.name || `PERSON ${p.id}`,
      blink_count: p.blinkCount,
      duration_ms: blinkEvent.duration,
      confidence: blinkEvent.confidence,
      timestamp: now
    });
  }

  // Transmit authoritative blink event to FastAPI backend
  if (window.blinkSessionId) {
    api.recordBlink({
      session_id: window.blinkSessionId,
      participant_key: p.name || `PERSON ${p.id}`,
      timestamp: now,
      duration_ms: blinkEvent.duration,
      ear_drop: parseFloat(blinkEvent.earDrop) || 0.1,
      min_ear: parseFloat(blinkEvent.minEAR) || 0.18,
      confidence: blinkEvent.confidence || 0.95,
      head_pose_yaw: p.headPose ? p.headPose.yaw : 0.0,
      head_pose_pitch: p.headPose ? p.headPose.pitch : 0.0,
      is_wink: false
    }).then(res => {
      if (res && res.id) {
        logSystemMessage(`[BACKEND SYNC] BlinkEvent #${res.id} stored in database.`, "dim");
      }
    }).catch(err => console.warn("Blink sync error", err));
  }
}

function triggerBlinkFlash() {
  DOM.blinkFlashOverlay.classList.add("active");
  setTimeout(() => DOM.blinkFlashOverlay.classList.remove("active"), 120);
}

// ====================================================================
// 7A. AUTHORITATIVE WINK & COMBO REACTION HANDLERS
// ====================================================================
function handleAuthoritativeWink(p, winkEvent) {
  const eye = winkEvent.eye; // "LEFT" | "RIGHT"
  logSystemMessage(`[WINK] ${p.name} ${eye} EYE WINK DETECTED.`, "amber");

  // Viewport Blink Tag
  if (DOM.viewportBlinkTag) {
    DOM.viewportBlinkTag.textContent = `😉 ${p.name} ${eye} WINK`;
    DOM.viewportBlinkTag.style.borderColor = p.palette ? p.palette.hex : p.color;
    DOM.viewportBlinkTag.classList.add("show");
    setTimeout(() => DOM.viewportBlinkTag.classList.remove("show"), 350);
  }

  // Mini-Game: Rhythm Hit (Lane 0 = Left, Lane 2 = Right)
  if (state.rhythm && state.rhythm.isRunning) {
    handleRhythmInput(eye === "LEFT" ? 0 : 2);
  }

  // NEO-PET: Eye wink reaction
  triggerPetBlinkAnimation(eye);

  // Soundboard gesture buffer update
  addGestureToBuffer(eye === "LEFT" ? "WINK_L" : "WINK_R");
}

function handleAuthoritativeCombo(p, comboEvent) {
  logSystemMessage(`[COMBO ACHIEVED] ${p.name} executed ${comboEvent.title} (${comboEvent.emoji})! +XP`, "emerald");

  // Viewport Blink Tag
  if (DOM.viewportBlinkTag) {
    DOM.viewportBlinkTag.textContent = `${comboEvent.emoji} ${comboEvent.title} (${p.name})`;
    DOM.viewportBlinkTag.style.borderColor = "#FFE600";
    DOM.viewportBlinkTag.classList.add("show");
    setTimeout(() => DOM.viewportBlinkTag.classList.remove("show"), 800);
  }

  // Edge-Anchored coordinates on canvas (top-right outer margin to leave face tracking canvas clean)
  const edgeX = DOM.canvas ? DOM.canvas.width - 110 : 530;
  const edgeY = 52;

  // Trigger visual particle explosion on canvas
  if (state.renderer) {
    state.renderer.triggerComboFx(comboEvent.id, edgeX, edgeY);
  }

  // Trigger localized synthesized audio effect
  playComboAudio(comboEvent.id);

  // Highlight combo card on Soundboard view
  const cardBtn = document.querySelector(`.combo-card-btn[data-combo="${comboEvent.id}"]`);
  if (cardBtn) {
    cardBtn.classList.add("active-flash");
    setTimeout(() => cardBtn.classList.remove("active-flash"), 1200);
  }

  // Feed bonus XP to Cyber-Pet!
  let bonusXp = 30;
  if (comboEvent.id === "TRIPLE_BLINK") bonusXp = 50;
  else if (comboEvent.id === "WINK_ALTERNATE") bonusXp = 40;
  awardPetXP(bonusXp, comboEvent.title);

  // Broadcast to WebSocket room
  if (window.blinkWs) {
    window.blinkWs.sendComboReaction({
      combo_type: comboEvent.id,
      emoji: comboEvent.emoji,
      title: comboEvent.title,
      participant_name: p.name || `PERSON ${p.id}`
    });
  }

  // Persist to FastAPI backend
  if (window.blinkSessionId) {
    api.triggerReaction({
      session_id: window.blinkSessionId,
      participant_name: p.name || `PERSON ${p.id}`,
      combo_type: comboEvent.id,
      emoji: comboEvent.emoji,
      title: comboEvent.title,
      timestamp: comboEvent.timestamp
    }).catch(err => console.warn("Reaction sync error:", err));
  }
}

// ====================================================================
// 7B. DYNAMIC ARCADE COMBO STREAK & ANNOUNCER ENGINE
// ====================================================================
function handleAuthoritativeComboStreak(p, streakEvent) {
  // 1. Dynamic Announcer Voice Callout
  speakAnnouncerLine(streakEvent.callout, streakEvent.tier);

  // 2. Synthesized Web Audio Impact Sound
  playArcadeStreakImpact(streakEvent.tier);

  // 3. Screen Shake (heavy for 4+ combos, mild for 2-3)
  triggerScreenShake(streakEvent.count >= 4);

  // 4. Trigger Crisp Vector-Rendered DOM Announcer Banner
  if (DOM.arcadeAnnouncerBanner && DOM.arcadeBannerTitle) {
    DOM.arcadeBannerTitle.textContent = streakEvent.title;
    if (DOM.arcadeBannerCallout) {
      DOM.arcadeBannerCallout.textContent = streakEvent.callout;
    }
    if (DOM.arcadeBannerMultiplier) {
      DOM.arcadeBannerMultiplier.textContent = `${streakEvent.count}X`;
    }
    if (DOM.arcadeBannerPill) {
      DOM.arcadeBannerPill.style.setProperty("--banner-accent", streakEvent.color);
    }
    DOM.arcadeAnnouncerBanner.classList.remove("hidden");
    if (state.arcadeBannerTimer) clearTimeout(state.arcadeBannerTimer);
    state.arcadeBannerTimer = setTimeout(() => {
      if (DOM.arcadeAnnouncerBanner) {
        DOM.arcadeAnnouncerBanner.classList.add("hidden");
      }
    }, 1200);
  }

  // 4B. Trigger Minimalist Canvas Micro-Sparks (Anchored strictly to top-right outer margin)
  const edgeX = DOM.canvas ? DOM.canvas.width - 130 : 510;
  const edgeY = 46;
  if (state.renderer) {
    state.renderer.triggerComboStreakFx(streakEvent, edgeX, edgeY);
  }

  // 5. System Terminal Log
  logSystemMessage(`🔥 [COMBO STREAK] ${p.name} triggered ${streakEvent.title} (${streakEvent.callout})!`, "emerald");

  // 6. Viewport Tag Alert
  if (DOM.viewportBlinkTag) {
    DOM.viewportBlinkTag.textContent = `🔥 ${streakEvent.title} (${streakEvent.count}x)`;
    DOM.viewportBlinkTag.style.borderColor = streakEvent.color;
    DOM.viewportBlinkTag.classList.add("show");
    setTimeout(() => DOM.viewportBlinkTag.classList.remove("show"), 900);
  }

  // 7. Feed bonus XP to Cyber-Pet!
  awardPetXP(streakEvent.count * 15, streakEvent.title);

  // 8. Instant Multiplayer WebSocket Broadcast (Zero-Debounce)
  if (window.blinkWs) {
    window.blinkWs.sendComboStreak({
      participant_id: p.id,
      participant_name: p.name,
      combo_count: streakEvent.count,
      tier: streakEvent.tier,
      title: streakEvent.title,
      callout: streakEvent.callout,
      color: streakEvent.color,
      timestamp: streakEvent.timestamp
    });
  }
}

function speakAnnouncerLine(calloutText, tier) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel(); // Cancel any queued speech to eliminate latency
    const utterance = new SpeechSynthesisUtterance(calloutText);
    utterance.rate = 1.35; // Energetic arcade pace
    let pitch = 1.25;
    if (tier === "TRIPLE") pitch = 1.4;
    else if (tier === "MEGA") pitch = 1.55;
    else if (tier === "PENTA" || tier === "GODLIKE") pitch = 1.7;
    utterance.pitch = pitch;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  } catch (e) {
    console.warn("[Announcer Voice] Error:", e);
  }
}

function playArcadeStreakImpact(tier) {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    if (ctx.state === "suspended") ctx.resume();

    if (tier === "DOUBLE") {
      // Dual harmonic power chord (C5 + G5)
      [523.25, 783.99].forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      });
    } else if (tier === "TRIPLE") {
      // Triple rising chord sweep
      [587.33, 880, 1174.66].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.05);
        gain.gain.setValueAtTime(0.1, ctx.currentTime + i * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.05 + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.05);
        osc.stop(ctx.currentTime + i * 0.05 + 0.22);
      });
    } else if (tier === "MEGA") {
      // Heavy sub-bass drop + resonant laser sweep
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(130, ctx.currentTime);
      sub.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.35);
      subGain.gain.setValueAtTime(0.25, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start();
      sub.stop(ctx.currentTime + 0.38);

      const zap = ctx.createOscillator();
      const zapGain = ctx.createGain();
      zap.type = "sawtooth";
      zap.frequency.setValueAtTime(1400, ctx.currentTime);
      zap.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.25);
      zapGain.gain.setValueAtTime(0.15, ctx.currentTime);
      zapGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      zap.connect(zapGain);
      zapGain.connect(ctx.destination);
      zap.start();
      zap.stop(ctx.currentTime + 0.25);
    } else {
      // PENTA & GODLIKE: Seismic blast + arpeggiated fanfare
      const sub = ctx.createOscillator();
      const subGain = ctx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(160, ctx.currentTime);
      sub.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.5);
      subGain.gain.setValueAtTime(0.32, ctx.currentTime);
      subGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.52);
      sub.connect(subGain);
      subGain.connect(ctx.destination);
      sub.start();
      sub.stop(ctx.currentTime + 0.52);

      [659.25, 830.61, 987.77, 1318.5, 1661.2].forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.04);
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.04 + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.04);
        osc.stop(ctx.currentTime + i * 0.04 + 0.3);
      });
    }
  } catch (e) { }
}

function triggerScreenShake(isHeavy = false) {
  const target = DOM.viewportCard || document.querySelector(".camera-viewport-card") || DOM.appContainer;
  if (!target) return;
  const cls = isHeavy ? "shake-heavy" : "shake-mild";
  target.classList.remove("shake-mild", "shake-heavy");
  void target.offsetWidth; // Force reflow
  target.classList.add(cls);
  setTimeout(() => target.classList.remove(cls), isHeavy ? 420 : 280);
}

function addGestureToBuffer(name) {
  state.reactions.gestureBuffer.push({ name, time: Date.now() });
  if (state.reactions.gestureBuffer.length > 6) {
    state.reactions.gestureBuffer.shift();
  }
  renderGestureBufferUI();
}

function renderGestureBufferUI() {
  if (!DOM.gestureBufferDisplay) return;
  if (state.reactions.gestureBuffer.length === 0) {
    DOM.gestureBufferDisplay.innerHTML = '<span class="buffer-empty">[AWAITING OCULAR GESTURES]</span>';
    return;
  }
  DOM.gestureBufferDisplay.innerHTML = state.reactions.gestureBuffer.map(g =>
    `<span class="buffer-pill">${g.name}</span>`
  ).join("");
}

// ====================================================================
// 8. DECOUPLED RENDER & INFERENCE LOOPS (60 FPS UI / ~30 FPS VISION)
// ====================================================================
function renderLoop(currentTime) {
  if (!state.isMonitoring) return;

  // 1. UI FPS Calculation (60 FPS target)
  state.uiFrameCount++;
  if (currentTime - state.lastUiFpsTime >= 500) {
    state.uiFPS = Math.round((state.uiFrameCount * 1000) / (currentTime - state.lastUiFpsTime));
    DOM.hudFpsVal.textContent = `FPS: ${state.uiFPS}`;
    state.uiFrameCount = 0;
    state.lastUiFpsTime = currentTime;
  }

  const video = DOM.video;
  const landmarker = getFaceLandmarker();

  // 2. Decoupled Asynchronous Vision Inference
  // MediaPipe detectForVideo is dispatched without stalling canvas render passes
  const hasNewVideoFrame = video.currentTime !== state.lastVideoCurrentTime;
  const timeSinceLastInference = currentTime - state.lastVisionInferenceTime;
  if (
    video.readyState >= 2 &&
    landmarker &&
    !state.isInferring &&
    (hasNewVideoFrame || timeSinceLastInference >= 30)
  ) {
    state.isInferring = true;
    state.lastVisionInferenceTime = currentTime;
    state.lastVideoCurrentTime = video.currentTime;

    Promise.resolve().then(() => {
      try {
        const results = landmarker.detectForVideo(video, currentTime);
        const rawLandmarksList = (results.faceLandmarks && results.faceLandmarks.length > 0)
          ? results.faceLandmarks
          : [];

        // Update Spatial Tracker & Participant Identities
        const trackedParticipants = state.faceTracker.update(rawLandmarksList, currentTime);
        state.participants = trackedParticipants;

        // Run Ocular Pipeline for each tracked participant
        for (const p of trackedParticipants) {
          if (!p.calibration) {
            setupParticipantEntity(p);
          }

          if (p.landmarks && p.detector) {
            const detRes = p.detector.processFrame(p.landmarks, p.box, currentTime);
            p.detectorState = detRes;
            p.currentEAR = detRes.ear;
            p.leftEAR = detRes.leftEAR;
            p.rightEAR = detRes.rightEAR;
            p.eyeState = detRes.state;
          }
        }

        // Update System Mode and Presences
        const activeCount = trackedParticipants.filter(p => p.status === "active").length;
        if (activeCount > state.maxSimultaneousFaces) {
          state.maxSimultaneousFaces = activeCount;
        }
        updatePresenceUI(activeCount);
        evaluateAutoMode(activeCount);

        // Vision FPS calculation
        state.visionFrameCount++;
        if (currentTime - state.lastVisionFpsTime >= 1000) {
          state.visionFPS = Math.round((state.visionFrameCount * 1000) / (currentTime - state.lastVisionFpsTime));
          state.visionFrameCount = 0;
          state.lastVisionFpsTime = currentTime;
        }
      } catch (inferErr) {
        console.warn("Vision inference cycle skipped:", inferErr);
      } finally {
        state.isInferring = false;
      }
    });
  }

  // 3. Canvas Rendering Pass (Runs at full UI 60 FPS)
  if (state.renderer) {
    state.renderer.syncDimensions(video);
    state.renderer.render({
      participants: state.participants.filter(p => p.status === "active" || p.status === "lost_grace"),
      debugMode: state.debugMode,
      uiFPS: state.uiFPS,
      visionFPS: state.visionFPS,
      timestamp: currentTime
    });
  }

  // 4. Update Dynamic UI Panels (Throttled to 10 FPS to eliminate layout thrashing)
  if (currentTime - state.lastDomUpdateTime >= 100) {
    state.lastDomUpdateTime = currentTime;
    updateParticipantCardsUI();
    updateLeaderboardUI();
  }

  state.animFrameId = requestAnimationFrame(renderLoop);
}

// ====================================================================
// 9. AUTO-MODE DETECTION (SOLO VS. COMPETITION)
// ====================================================================
function evaluateAutoMode(activeCount) {
  let newMode = "IDLE";

  if (activeCount === 1) {
    newMode = "SOLO";
  } else if (activeCount === 2) {
    newMode = "COMPETITION";
  } else if (activeCount >= 3) {
    newMode = `${activeCount}-WAY COMPETITION`;
  }

  if (newMode !== state.activeMode) {
    state.activeMode = newMode;
    updateModeBadgeUI(newMode, activeCount);
  }
}

function updateModeBadgeUI(mode, count) {
  DOM.modeBadge.className = "mode-badge";

  if (mode === "IDLE") {
    DOM.modeText.textContent = "AWAITING HUMANS";
  } else if (mode === "SOLO") {
    DOM.modeBadge.classList.add("mode-solo");
    DOM.modeText.textContent = "SOLO MODE";
  } else {
    DOM.modeBadge.classList.add("mode-competition");
    DOM.modeText.textContent = `⚡ ${mode} ACTIVATED`;
    logSystemMessage(`⚡ MULTI-PERSON DETECTED: Switched to ${mode}!`, "amber");
    playSynthesizedChime();
  }
}

function updatePresenceUI(count) {
  DOM.presenceText.textContent = `PEOPLE DETECTED: ${count}`;
  if (count > 0) {
    DOM.presenceBadge.classList.add("has-people");
    DOM.presenceIcon.textContent = count > 1 ? "👥" : "👤";
    DOM.faceCountBadge.className = "badge badge-locked";
    DOM.faceCountBadge.textContent = `${count} ${count > 1 ? "PEOPLE" : "PERSON"} LOCKED`;
  } else {
    DOM.presenceBadge.classList.remove("has-people");
    DOM.presenceIcon.textContent = "👤";
    DOM.faceCountBadge.className = "badge badge-idle";
    DOM.faceCountBadge.textContent = "NO HUMAN DETECTED";
  }
  DOM.hudTrackingInfo.textContent = `FACES: ${count} ACTIVE`;
}

function getActiveParticipant() {
  if (state.selectedParticipantId) {
    const found = state.participants.find(p => p.id === state.selectedParticipantId);
    if (found) return found;
  }
  return state.participants[0] || { id: "person-1", name: "Player 1", blinkRate: 15 };
}

// ====================================================================
// 10. DYNAMIC PARTICIPANT CARDS & LEADERBOARD UI
// ====================================================================
function updateParticipantCardsUI() {
  const activeOrGrace = state.participants.filter(p => p.status === "active" || p.status === "lost_grace");
  DOM.participantCountIndicator.textContent = `${activeOrGrace.length} ACTIVE`;

  if (activeOrGrace.length === 0) {
    if (!DOM.participantsList.querySelector(".participant-empty-card")) {
      DOM.participantsList.innerHTML = `
        <div class="participant-empty-card">
          <div class="empty-icon">👥</div>
          <div class="empty-title">NO PARTICIPANTS IN FRAME</div>
          <div class="empty-text">Step in front of the camera to automatically receive a participant identity. Multiple people can join simultaneously!</div>
        </div>
      `;
    }
    return;
  }

  // Remove empty card if present
  const emptyCard = DOM.participantsList.querySelector(".participant-empty-card");
  if (emptyCard) DOM.participantsList.removeChild(emptyCard);

  const now = Date.now();
  const sessionMins = Math.max(0.08, (now - state.sessionStartTime) / 60000);

  activeOrGrace.forEach(p => {
    let card = document.getElementById(`p-card-${p.id}`);
    if (!card) {
      card = document.createElement("div");
      card.id = `p-card-${p.id}`;
      card.className = "participant-card";
      card.style.borderLeftColor = p.color;
      card.addEventListener("click", (e) => {
        if (e.target.closest(".view-p-history-btn")) return;
        state.selectedParticipantId = p.id;
        DOM.participantsList.querySelectorAll(".participant-card").forEach(c => c.classList.remove("selected-actor"));
        card.classList.add("selected-actor");
      });
      DOM.participantsList.appendChild(card);
    }

    if (p.status === "lost_grace") {
      card.classList.add("lost-grace");
    } else {
      card.classList.remove("lost-grace");
    }

    // Calculate BPM
    p.blinkRate = (p.blinkCount / sessionMins).toFixed(1);

    // Calculate Last Blink
    let lastBlinkText = "LAST BLINK: never";
    let isNpc = false;
    if (p.lastBlinkTime) {
      const secAgo = ((now - p.lastBlinkTime) / 1000).toFixed(1);
      if (secAgo > 15) {
        lastBlinkText = `⚠️ ARE YOU STILL ALIVE? (${secAgo}s)`;
        isNpc = true;
      } else {
        lastBlinkText = `LAST BLINK: ${secAgo}s ago`;
      }
    }

    const calibStatus = p.calibration ? p.calibration.getStatus().statusText : "LOCKED";

    card.innerHTML = `
      <div class="p-card-header">
        <div class="p-id-pill" style="color: ${p.color}">
          <span>◉</span>
          <span>${p.name}</span>
        </div>
        <span class="p-status-tag ${p.status === "lost_grace" ? "lost" : ""}">${p.status === "lost_grace" ? "RECONNECTING..." : calibStatus}</span>
      </div>

      <div class="p-card-body">
        <div class="p-stat-block">
          <span class="p-stat-label">BLINKS</span>
          <span class="p-blink-counter" id="p-count-${p.id}">${p.blinkCount}</span>
        </div>
        <div class="p-stat-block">
          <span class="p-stat-label">BLINKS/MIN</span>
          <span class="p-stat-val">${p.blinkRate}</span>
        </div>
        <div class="p-stat-block">
          <span class="p-stat-label">STREAK</span>
          <span class="p-stat-val">🔥 ${p.currentStreak}</span>
        </div>
      </div>

      <div class="p-card-footer">
        <span class="p-last-blink ${isNpc ? "npc-mode" : ""}">${lastBlinkText}</span>
        <button class="mini-btn view-p-history-btn" data-id="${p.id}">VIEW LOG</button>
      </div>
    `;

    const viewBtn = card.querySelector(".view-p-history-btn");
    viewBtn.addEventListener("click", () => openParticipantHistoryModal(p.id));
  });

  // Remove cards for departed participants
  const currentCardEls = DOM.participantsList.querySelectorAll(".participant-card");
  currentCardEls.forEach(cardEl => {
    const cardId = cardEl.id.replace("p-card-", "");
    const exists = activeOrGrace.some(p => p.id === cardId);
    if (!exists) {
      DOM.participantsList.removeChild(cardEl);
    }
  });
}

function updateLeaderboardUI() {
  const eligible = state.participants.filter(p => p.status === "active" || p.status === "lost_grace");
  if (eligible.length === 0) {
    DOM.leaderboardList.innerHTML = '<div class="leaderboard-empty">Leaderboard will automatically rank participants once detected.</div>';
    DOM.hlMostActive.textContent = "--";
    DOM.hlFastestRate.textContent = "--";
    DOM.hlLongestStreak.textContent = "--";
    return;
  }

  // Sort by blinks descending
  const sorted = [...eligible].sort((a, b) => b.blinkCount - a.blinkCount);

  DOM.leaderboardList.innerHTML = "";
  sorted.forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = `leaderboard-row ${idx === 0 ? "rank-1" : ""}`;
    const rankBadge = idx === 0 ? "👑 #1" : `#${idx + 1}`;
    row.innerHTML = `
      <span class="leaderboard-rank">${rankBadge}</span>
      <span class="leaderboard-name" style="color: ${p.color}">
        <span>◉</span> <span>${p.name}</span>
      </span>
      <span class="leaderboard-blinks">${p.blinkCount} blinks</span>
      <span class="leaderboard-rate">${p.blinkRate}/min</span>
    `;
    DOM.leaderboardList.appendChild(row);
  });

  // Highlight Stats
  const mostActive = sorted[0];
  const fastestRate = [...eligible].sort((a, b) => parseFloat(b.blinkRate) - parseFloat(a.blinkRate))[0];
  const longestStreak = [...eligible].sort((a, b) => b.longestStreak - a.longestStreak)[0];

  DOM.hlMostActive.textContent = mostActive ? `${mostActive.name} (${mostActive.blinkCount})` : "--";
  DOM.hlFastestRate.textContent = fastestRate ? `${fastestRate.name} (${fastestRate.blinkRate}/min)` : "--";
  DOM.hlLongestStreak.textContent = longestStreak ? `${longestStreak.name} (${longestStreak.longestStreak} blinks)` : "--";
}

// ====================================================================
// 11. MULTI-LINE ACTIVITY CANVAS CHART
// ====================================================================
setInterval(() => {
  if (state.isMonitoring) {
    state.participants.forEach(p => {
      p.chartBuckets.shift();
      p.chartBuckets.push(0);
    });
    drawMultiLineChart();
  }
}, 1000);

export function drawMultiLineChart() {
  const canvas = DOM.chartCanvas;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) return;

  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    chartCtx.scale(dpr, dpr);
  }

  const w = rect.width;
  const h = rect.height;
  chartCtx.clearRect(0, 0, w, h);

  const activeParticipants = state.participants.filter(p => p.status === "active" || p.status === "lost_grace");

  // Update Dynamic Legend
  if (activeParticipants.length === 0) {
    DOM.chartDynamicLegend.innerHTML = `
      <span class="chart-legend-item">
        <span class="legend-pip" style="background: #64748b;"></span>
        <span>AWAITING PARTICIPANTS</span>
      </span>
    `;
  } else {
    DOM.chartDynamicLegend.innerHTML = activeParticipants.map(p => `
      <span class="chart-legend-item">
        <span class="legend-pip" style="background: ${p.color};"></span>
        <span style="color: #fff; font-weight: 600;">${p.name} (${p.blinkCount})</span>
      </span>
    `).join("");
  }

  // Draw Grid Lines
  chartCtx.strokeStyle = "rgba(56, 189, 248, 0.08)";
  chartCtx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const y = (h / 4) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(w, y);
    chartCtx.stroke();
  }

  if (activeParticipants.length === 0) return;

  // Find max value across all participants
  let maxVal = 3;
  activeParticipants.forEach(p => {
    maxVal = Math.max(maxVal, ...p.chartBuckets);
  });

  // Draw Line and Gradient for each participant
  activeParticipants.forEach(p => {
    const data = p.chartBuckets;
    const step = w / (data.length - 1);

    // Area Fill
    chartCtx.beginPath();
    chartCtx.moveTo(0, h);
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (data[i] / maxVal) * (h - 20) - 10;
      if (i === 0) chartCtx.lineTo(x, y);
      else {
        const prevX = (i - 1) * step;
        const prevY = h - (data[i - 1] / maxVal) * (h - 20) - 10;
        const cpX = (prevX + x) / 2;
        chartCtx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    chartCtx.lineTo(w, h);
    chartCtx.closePath();

    const gradient = chartCtx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, `rgba(${p.colorRgb}, 0.2)`);
    gradient.addColorStop(1, `rgba(${p.colorRgb}, 0.0)`);
    chartCtx.fillStyle = gradient;
    chartCtx.fill();

    // Line Stroke
    chartCtx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const x = i * step;
      const y = h - (data[i] / maxVal) * (h - 20) - 10;
      if (i === 0) chartCtx.moveTo(x, y);
      else {
        const prevX = (i - 1) * step;
        const prevY = h - (data[i - 1] / maxVal) * (h - 20) - 10;
        const cpX = (prevX + x) / 2;
        chartCtx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }
    }
    chartCtx.strokeStyle = p.color;
    chartCtx.lineWidth = 2.2;
    chartCtx.shadowColor = p.color;
    chartCtx.shadowBlur = 8;
    chartCtx.stroke();
    chartCtx.shadowBlur = 0;

    // Point Dots
    data.forEach((val, i) => {
      if (val > 0) {
        const x = i * step;
        const y = h - (val / maxVal) * (h - 20) - 10;
        chartCtx.beginPath();
        chartCtx.arc(x, y, 3.5, 0, Math.PI * 2);
        chartCtx.fillStyle = "#fff";
        chartCtx.fill();
        chartCtx.strokeStyle = p.color;
        chartCtx.stroke();
      }
    });
  });
}

// ====================================================================
// 12. COMPETITION BATTLE ARENA ENGINE
// ====================================================================
function startBattle() {
  const active = state.participants.filter(p => p.status === "active");
  if (active.length === 0) {
    logSystemMessage("Cannot start battle: No active participants detected in frame.", "amber");
    return;
  }

  state.battle.state = "running";
  state.battle.remaining = state.battle.duration;
  state.battle.winner = null;
  DOM.battleWinnerBanner.classList.add("hidden");
  DOM.battleStatusPill.textContent = "BATTLE IN PROGRESS";
  DOM.battleStatusPill.style.background = "rgba(239, 68, 68, 0.2)";
  DOM.battleStatusPill.style.color = "#f87171";
  DOM.battleStartBtn.disabled = true;
  DOM.battlePauseBtn.disabled = false;

  // Snapshot initial blink counts
  state.battle.startBlinks = {};
  active.forEach(p => {
    state.battle.startBlinks[p.id] = p.blinkCount;
  });

  logSystemMessage(`⚔️ BLINK BATTLE COMMENCED (${state.battle.duration}s Round). Rapid blinking authorized!`, "amber");
  playSynthesizedChime();

  if (state.battle.timerId) clearInterval(state.battle.timerId);

  state.battle.timerId = setInterval(() => {
    state.battle.remaining--;
    const mm = String(Math.floor(state.battle.remaining / 60)).padStart(2, "0");
    const ss = String(state.battle.remaining % 60).padStart(2, "0");
    DOM.battleClockVal.textContent = `${mm}:${ss}`;

    // Update Current Leader during battle
    let bestDelta = -1;
    let currentLeader = null;
    active.forEach(p => {
      const delta = p.blinkCount - (state.battle.startBlinks[p.id] || 0);
      if (delta > bestDelta) {
        bestDelta = delta;
        currentLeader = p;
      }
    });
    DOM.battleLeaderVal.textContent = currentLeader ? `${currentLeader.name} (+${bestDelta})` : "TIED";

    if (state.battle.remaining <= 0) {
      endBattle();
    }
  }, 1000);
}

function pauseBattle() {
  if (state.battle.state === "running") {
    state.battle.state = "paused";
    clearInterval(state.battle.timerId);
    DOM.battlePauseBtn.textContent = "▶ RESUME";
    DOM.battleStatusPill.textContent = "BATTLE PAUSED";
    logSystemMessage("Battle timer suspended.", "dim");
  } else if (state.battle.state === "paused") {
    state.battle.state = "running";
    DOM.battlePauseBtn.textContent = "⏸ PAUSE";
    DOM.battleStatusPill.textContent = "BATTLE IN PROGRESS";
    startBattleTimerInterval();
    logSystemMessage("Battle resumed.", "amber");
  }
}

function startBattleTimerInterval() {
  state.battle.timerId = setInterval(() => {
    state.battle.remaining--;
    const mm = String(Math.floor(state.battle.remaining / 60)).padStart(2, "0");
    const ss = String(state.battle.remaining % 60).padStart(2, "0");
    DOM.battleClockVal.textContent = `${mm}:${ss}`;
    if (state.battle.remaining <= 0) endBattle();
  }, 1000);
}

function endBattle() {
  clearInterval(state.battle.timerId);
  state.battle.state = "finished";
  DOM.battleStartBtn.disabled = false;
  DOM.battlePauseBtn.disabled = true;
  DOM.battleStatusPill.textContent = "BATTLE CONCLUDED";

  const active = state.participants.filter(p => p.status === "active" || p.status === "lost_grace");
  let winner = null;
  let maxScore = -1;

  active.forEach(p => {
    const score = p.blinkCount - (state.battle.startBlinks[p.id] || 0);
    if (score > maxScore) {
      maxScore = score;
      winner = p;
    }
  });

  if (winner) {
    state.battle.winner = winner;
    state.hasCompetitionWinner = true;
    DOM.winnerName.textContent = winner.name;
    DOM.winnerName.style.color = winner.color;
    DOM.winnerStats.textContent = `Scored ${maxScore} battle blinks • Overall Total: ${winner.blinkCount} blinks`;
    DOM.battleWinnerBanner.classList.remove("hidden");
    logSystemMessage(`🏆 BATTLE WINNER: ${winner.name} victorious with ${maxScore} blinks!`, "emerald");
    playSynthesizedChime();
    evaluateAchievements();
  }
}

function resetBattle() {
  clearInterval(state.battle.timerId);
  state.battle.state = "idle";
  state.battle.remaining = state.battle.duration;
  const mm = String(Math.floor(state.battle.duration / 60)).padStart(2, "0");
  const ss = String(state.battle.duration % 60).padStart(2, "0");
  DOM.battleClockVal.textContent = `${mm}:${ss}`;
  DOM.battleLeaderVal.textContent = "AWAITING BATTLE";
  DOM.battleStatusPill.textContent = "ROUND READY";
  DOM.battleStatusPill.style.background = "rgba(245, 158, 11, 0.15)";
  DOM.battleStatusPill.style.color = "#fbbf24";
  DOM.battleStartBtn.disabled = false;
  DOM.battlePauseBtn.disabled = true;
  DOM.battlePauseBtn.textContent = "⏸ PAUSE";
  DOM.battleWinnerBanner.classList.add("hidden");
  logSystemMessage("Battle arena clock reset.", "dim");
}

// ====================================================================
// 13. QUICK-DRAW BLINK RACE MINI-GAME
// ====================================================================
function startBlinkRace() {
  if (state.race.state === "countdown" || state.race.state === "waiting_blink") return;

  state.race.state = "countdown";
  state.race.countdownVal = 3;
  DOM.startRaceBtn.disabled = true;
  DOM.raceResultSub.textContent = "Get ready to blink...";

  logSystemMessage("Blink Race Initiated! Stand by for countdown...", "amber");

  const countdownSeq = ["READY...", "3...", "2...", "1...", "BLINK!"];
  let step = 0;

  DOM.raceStatusBig.className = "race-status-big countdown";
  DOM.raceStatusBig.textContent = countdownSeq[step++];

  state.race.countdownTimerId = setInterval(() => {
    if (step < countdownSeq.length) {
      const txt = countdownSeq[step++];
      DOM.raceStatusBig.textContent = txt;
      playSynthesizedParticipantTone(1);

      if (txt === "BLINK!") {
        DOM.raceStatusBig.className = "race-status-big blink-now";
        state.race.state = "waiting_blink";
        state.race.blinkStartTime = performance.now();
        DOM.raceResultSub.textContent = "FIRST PERSON TO BLINK WINS!";
        clearInterval(state.race.countdownTimerId);
      }
    }
  }, 900);
}

function resolveBlinkRaceWinner(winner, now) {
  state.race.state = "finished";
  state.race.winner = winner;
  state.race.reactionTimeSec = ((now - state.race.blinkStartTime) / 1000).toFixed(2);

  DOM.raceStatusBig.className = "race-status-big";
  DOM.raceStatusBig.textContent = `🏆 ${winner.name} WINS!`;
  DOM.raceStatusBig.style.color = winner.color;
  DOM.raceResultSub.textContent = `Reaction time: ${state.race.reactionTimeSec} seconds!`;

  DOM.startRaceBtn.disabled = false;
  DOM.startRaceBtn.textContent = "🎯 PLAY AGAIN";

  logSystemMessage(`🏁 RACE RESULT: ${winner.name} wins in ${state.race.reactionTimeSec}s!`, "emerald");
  playSynthesizedChime();
}

// ====================================================================
// 14. BIOMETRIC PERSON SCAN FEATURE
// ====================================================================
function triggerPersonScan() {
  if (state.isScanning) return;
  state.isScanning = true;
  state.scanStartTime = Date.now();
  DOM.scanTargetOverlay.classList.remove("hidden");
  DOM.scanStatusText.textContent = "LOCKING FACIAL TOPOLOGY...";
  logSystemMessage("Biometric scanner engaged. Recalibrating ocular baselines...", "cyan");
  playSynthesizedChime();

  // Recalibrate active participants
  state.participants.forEach(p => {
    if (p.calibration) p.calibration.recalibrate();
  });

  setTimeout(() => {
    state.isScanning = false;
    DOM.scanTargetOverlay.classList.add("hidden");
    const active = state.participants.filter(p => p.status === "active");
    const name = active.length > 0 ? active[0].name : "ALL DETECTED FACES";
    logSystemMessage(`SCAN COMPLETE: ${name} visual profile calibrated and locked.`, "emerald");
    playSynthesizedChime();
  }, 1600);
}

// ====================================================================
// 15. ACHIEVEMENTS SYSTEM
// ====================================================================
export function evaluateAchievements() {
  const currentStatus = {
    totalBlinks: state.totalBlinks,
    participants: state.participants,
    maxSimultaneousFaces: state.maxSimultaneousFaces,
    hasCompetitionWinner: state.hasCompetitionWinner,
    hasSpeedBlinker: state.hasSpeedBlinker,
    sessionStartTime: state.sessionStartTime
  };

  let newlyUnlocked = null;

  for (const ach of ACHIEVEMENTS) {
    if (!state.unlockedAchievements.has(ach.id) && ach.condition(currentStatus)) {
      state.unlockedAchievements.add(ach.id);
      newlyUnlocked = ach;
      logSystemMessage(`🏆 ACHIEVEMENT UNLOCKED: [${ach.title}] — ${ach.desc}`, "emerald");
      playSynthesizedChime();
    }
  }

  if (newlyUnlocked) {
    DOM.currentAchIcon.textContent = newlyUnlocked.icon;
    DOM.currentAchTitle.textContent = newlyUnlocked.title;
    DOM.currentAchDesc.textContent = newlyUnlocked.desc;
  }

  renderAchievementBadges();
}

function renderAchievementBadges() {
  DOM.quickBadgesList.innerHTML = "";
  DOM.modalAchievementsList.innerHTML = "";

  ACHIEVEMENTS.forEach((ach) => {
    const isUnlocked = state.unlockedAchievements.has(ach.id);

    const pill = document.createElement("span");
    pill.className = `ach-badge-pill ${isUnlocked ? "unlocked" : ""}`;
    pill.innerHTML = `<span>${ach.icon}</span> <span>${ach.title}</span>`;
    DOM.quickBadgesList.appendChild(pill);

    const modalItem = document.createElement("div");
    modalItem.className = `modal-ach-card ${isUnlocked ? "unlocked" : ""}`;
    modalItem.innerHTML = `
      <div class="modal-ach-icon">${ach.icon}</div>
      <div class="modal-ach-info">
        <div class="modal-ach-title">${ach.title} ${isUnlocked ? "✓" : "(LOCKED)"}</div>
        <div class="modal-ach-desc">${ach.desc}</div>
      </div>
    `;
    DOM.modalAchievementsList.appendChild(modalItem);
  });
}

// ====================================================================
// 16. SESSION INTELLIGENCE REPORT, JSON EXPORT & CLIPBOARD
// ====================================================================
export function generateSessionReportData() {
  const now = Date.now();
  const sessionElapsedSec = Math.floor((now - (state.sessionStartTime || now)) / 1000);
  const mm = String(Math.floor(sessionElapsedSec / 60)).padStart(2, "0");
  const ss = String(sessionElapsedSec % 60).padStart(2, "0");

  const participantsData = state.participants.map(p => ({
    id: p.id,
    name: p.name,
    color: p.color,
    blinks: p.blinkCount,
    blinkRate: p.blinkRate,
    longestStreak: p.longestStreak,
    baselineEAR: p.calibration ? p.calibration.baselineEAR : null,
    totalLoggedBlinks: p.blinkHistory.length
  }));

  const sorted = [...state.participants].sort((a, b) => b.blinkCount - a.blinkCount);
  const mostActive = sorted[0] ? sorted[0].name : "N/A";
  const fastestRate = [...state.participants].sort((a, b) => parseFloat(b.blinkRate) - parseFloat(a.blinkRate))[0];
  const longestStreak = [...state.participants].sort((a, b) => b.longestStreak - a.longestStreak)[0];

  return {
    app: "BlinkOS Person-Aware Edition",
    version: "2.0.0",
    engine: "MediaPipe Tasks Vision FaceLandmarker (SIMD/WASM)",
    timestamp: new Date().toISOString(),
    sessionDuration: `${mm}:${ss}`,
    sessionDurationSec: sessionElapsedSec,
    peopleDetected: state.participants.length,
    totalBlinks: state.totalBlinks,
    mostActive,
    fastestBlinkRate: fastestRate ? `${fastestRate.name} (${fastestRate.blinkRate}/min)` : "N/A",
    longestStreak: longestStreak ? `${longestStreak.name} (${longestStreak.longestStreak})` : "N/A",
    competitionWinner: state.battle.winner ? state.battle.winner.name : mostActive,
    averageBlinksPerPerson: state.participants.length > 0 ? (state.totalBlinks / state.participants.length).toFixed(1) : "0",
    participants: participantsData
  };
}

export function exportResultsAsJSON() {
  const report = generateSessionReportData();
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  const dateStr = new Date().toISOString().slice(0, 10);
  const timeStr = new Date().toTimeString().slice(0, 8).replace(/:/g, "-");
  downloadAnchor.setAttribute("download", `blinkos_telemetry_${dateStr}_${timeStr}.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  logSystemMessage("Session telemetry exported as JSON file download.", "emerald");
}

export function copyResultsToClipboard() {
  const r = generateSessionReportData();
  const textSummary = `
========================================
BLINKOS SESSION REPORT (v2.0)
========================================
Duration: ${r.sessionDuration}
People Detected: ${r.peopleDetected}
Total Blinks: ${r.totalBlinks}
Average/Person: ${r.averageBlinksPerPerson}

Most Active: ${r.mostActive}
Fastest Rate: ${r.fastestBlinkRate}
Longest Streak: ${r.longestStreak}
Competition Winner: ${r.competitionWinner}

Participants:
${r.participants.map(p => `• ${p.name}: ${p.blinks} blinks | Rate: ${p.blinkRate}/min | Streak: ${p.longestStreak} | Baseline: ${p.baselineEAR || 'N/A'}`).join("\n")}
========================================
Generated by BlinkOS 100% locally.
`.trim();

  navigator.clipboard.writeText(textSummary).then(() => {
    logSystemMessage("Session summary copied to clipboard.", "emerald");
    if (DOM.copyResultsBtn) {
      DOM.copyResultsBtn.innerHTML = `<span>✓</span><span>COPIED!</span>`;
      setTimeout(() => {
        DOM.copyResultsBtn.innerHTML = `<span>📋</span><span>COPY SUMMARY</span>`;
      }, 2000);
    }
    if (DOM.modalCopySummaryBtn) {
      DOM.modalCopySummaryBtn.textContent = "✓ COPIED TO CLIPBOARD!";
      setTimeout(() => {
        DOM.modalCopySummaryBtn.textContent = "COPY SUMMARY TO CLIPBOARD";
      }, 2000);
    }
  }).catch(() => {
    logSystemMessage("Clipboard write permission blocked.", "amber");
  });
}

function openSessionReportModal() {
  const r = generateSessionReportData();
  DOM.sessionReportContent.innerHTML = `
    <div class="report-grid">
      <div class="report-item">
        <span class="report-label">SESSION DURATION</span>
        <span class="report-val">${r.sessionDuration}</span>
      </div>
      <div class="report-item">
        <span class="report-label">PEOPLE DETECTED</span>
        <span class="report-val">${r.peopleDetected}</span>
      </div>
      <div class="report-item">
        <span class="report-label">TOTAL BLINKS</span>
        <span class="report-val">${r.totalBlinks}</span>
      </div>
      <div class="report-item">
        <span class="report-label">AVG BLINKS/PERSON</span>
        <span class="report-val">${r.averageBlinksPerPerson}</span>
      </div>
      <div class="report-item">
        <span class="report-label">MOST ACTIVE</span>
        <span class="report-val">${r.mostActive}</span>
      </div>
      <div class="report-item">
        <span class="report-label">COMPETITION WINNER</span>
        <span class="report-val">${r.competitionWinner}</span>
      </div>
    </div>
  `;
  DOM.sessionReportModal.classList.remove("hidden");
}

function openParticipantHistoryModal(participantId) {
  const p = state.participants.find(item => item.id === participantId);
  if (!p) return;

  DOM.historyModalContent.innerHTML = `
    <div style="margin-bottom: 0.75rem; font-family: var(--font-display); color: ${p.color}; font-weight: 700;">
      ${p.name} BLINK LOG (${p.blinkHistory.length} total entries)
    </div>
    <div style="display: flex; flex-direction: column; gap: 0.4rem; max-height: 320px; overflow-y: auto;">
      ${p.blinkHistory.length === 0 ? '<div style="color: var(--text-dim);">No blinks recorded yet for this participant.</div>' : ''}
      ${p.blinkHistory.map(h => `
        <div style="display: flex; justify-content: space-between; padding: 0.4rem 0.6rem; background: rgba(2, 5, 14, 0.6); border-radius: 4px; font-family: var(--font-mono); font-size: 0.75rem;">
          <span>Blink #${h.number}</span>
          <span style="color: var(--accent-cyan);">${new Date(h.timestamp).toLocaleTimeString([], { hour12: false, minute: "2-digit", second: "2-digit" })}</span>
          <span style="color: var(--text-muted);">${h.duration ? `${h.duration}ms` : ''}</span>
          <span style="color: var(--text-dim);">${h.confidence ? `${Math.round(h.confidence * 100)}% conf` : ''}</span>
        </div>
      `).reverse().join("")}
    </div>
  `;
  DOM.historyModal.classList.remove("hidden");
}

// ====================================================================
// 17. SESSION RESET
// ====================================================================
export function newSession() {
  if (state.faceTracker) {
    state.faceTracker.clear();
  }
  state.participants = [];
  state.totalBlinks = 0;
  state.sessionStartTime = Date.now();
  state.maxSimultaneousFaces = 0;
  state.hasCompetitionWinner = false;
  state.hasSpeedBlinker = false;
  state.unlockedAchievements.clear();

  resetBattle();

  DOM.participantsList.innerHTML = `
    <div class="participant-empty-card">
      <div class="empty-icon">👥</div>
      <div class="empty-title">NO PARTICIPANTS IN FRAME</div>
      <div class="empty-text">Step in front of the camera to automatically receive a participant identity. Multiple people can join simultaneously!</div>
    </div>
  `;

  DOM.leaderboardList.innerHTML = '<div class="leaderboard-empty">Leaderboard will automatically rank participants once detected.</div>';
  DOM.hlMostActive.textContent = "--";
  DOM.hlFastestRate.textContent = "--";
  DOM.hlLongestStreak.textContent = "--";

  updatePresenceUI(0);
  evaluateAutoMode(0);
  drawMultiLineChart();
  renderAchievementBadges();

  logSystemMessage("New session initiated. All participants, baselines, and counters cleared.", "cyan");
}

// ====================================================================
// 18. SYNTHESIZED WEB AUDIO ENGINE
// ====================================================================
function initAudio() {
  if (!state.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) state.audioCtx = new AudioContextClass();
  }
  if (state.audioCtx && state.audioCtx.state === "suspended") {
    state.audioCtx.resume();
  }
}

function playSynthesizedParticipantTone(participantSeq) {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const baseFreqs = [784, 880, 988, 1046, 1174];
    const freq = baseFreqs[(participantSeq - 1) % baseFreqs.length];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.04);

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) { }
}

function playSynthesizedChime() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const freqs = [523.25, 659.25, 783.99, 1046.50];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(f, ctx.currentTime + idx * 0.05);
      gain.gain.setValueAtTime(0.06, ctx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime + idx * 0.05);
      osc.stop(ctx.currentTime + idx * 0.05 + 0.3);
    });
  } catch (e) { }
}

function playSupernovaSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const freqs = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C E G C E
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.04);
      gain.gain.setValueAtTime(0.08, ctx.currentTime + i * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.04 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.04);
      osc.stop(ctx.currentTime + i * 0.04 + 0.4);
    });
  } catch (e) { }
}

function playLightningSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.14);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.14);
  } catch (e) { }
}

function playPlasmaSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(32, ctx.currentTime + 0.22);
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) { }
}

function playHyperdriveSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  } catch (e) { }
}

function playMatrixSound() {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    [1200, 1600].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(f, ctx.currentTime + i * 0.06);
      gain.gain.setValueAtTime(0.06, ctx.currentTime + i * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.06 + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + i * 0.06);
      osc.stop(ctx.currentTime + i * 0.06 + 0.08);
    });
  } catch (e) { }
}

function playComboAudio(comboType) {
  switch (comboType) {
    case "TRIPLE_BLINK":
      playSupernovaSound();
      break;
    case "DOUBLE_WINK_LEFT":
      playLightningSound();
      break;
    case "DOUBLE_WINK_RIGHT":
      playPlasmaSound();
      break;
    case "WINK_ALTERNATE":
      playHyperdriveSound();
      break;
    case "BLINK_WINK_COMBO":
      playMatrixSound();
      break;
    default:
      playSynthesizedChime();
      break;
  }
}

function playRhythmHitSound(rating) {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    let freq = 880;
    if (rating === "GREAT") freq = 660;
    else if (rating === "OK") freq = 440;
    else if (rating === "MISS") freq = 160;

    osc.type = rating === "MISS" ? "sawtooth" : "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);
  } catch (e) { }
}

function playRhythmBeatStep(step) {
  if (!state.soundEnabled || !state.audioCtx) return;
  try {
    const ctx = state.audioCtx;
    // Kick drum on beat 0 and 2
    if (step % 2 === 0) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(130, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(35, ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.09, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } else {
      // Hi-hat / snare tick on beat 1 and 3
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    }
  } catch (e) { }
}

function toggleSound() {
  initAudio();
  state.soundEnabled = !state.soundEnabled;
  if (state.soundEnabled) {
    DOM.soundToggleBtn.classList.add("active");
    DOM.soundIcon.textContent = "🔊";
    DOM.soundLabel.textContent = "SOUND: ON";
    playSynthesizedParticipantTone(1);
    logSystemMessage("Audio feedback engaged.", "dim");
  } else {
    DOM.soundToggleBtn.classList.remove("active");
    DOM.soundIcon.textContent = "🔇";
    DOM.soundLabel.textContent = "SOUND: OFF";
    logSystemMessage("Audio muted.", "dim");
  }
}

// ====================================================================
// 18B. BLINK HERO — RHYTHM MINIGAME ENGINE
// ====================================================================
const RHYTHM_LANES = [
  { id: 0, name: "LEFT WINK", key: "WINK_L", x: 80, color: "#00f2fe", keyLabel: "😉 LEFT" },
  { id: 1, name: "CENTER BLINK", key: "BLINK", x: 240, color: "#00FF9D", keyLabel: "👁️ BOTH" },
  { id: 2, name: "RIGHT WINK", key: "WINK_R", x: 400, color: "#FF007F", keyLabel: "RIGHT 😉" }
];

const TARGET_HIT_Y = 175;
const rhythmSplashes = [];

function startRhythmGame() {
  if (state.rhythm.isRunning) return;
  initAudio();

  state.rhythm.isRunning = true;
  state.rhythm.score = 0;
  state.rhythm.streak = 0;
  state.rhythm.maxStreak = 0;
  state.rhythm.totalHits = 0;
  state.rhythm.totalNotes = 0;
  state.rhythm.notes = [];
  state.rhythm.lastSpawnTime = performance.now();
  state.rhythm.beatStep = 0;

  if (DOM.rhythmScore) DOM.rhythmScore.textContent = "0";
  if (DOM.rhythmStreak) DOM.rhythmStreak.textContent = "0x";
  if (DOM.rhythmRating) DOM.rhythmRating.textContent = "BEAT ACTIVE";
  if (DOM.rhythmAcc) DOM.rhythmAcc.textContent = "100%";

  logSystemMessage(`[BLINK HERO] Rhythm track started on ${state.rhythm.difficulty.toUpperCase()} difficulty!`, "cyan");

  // Start audio beat generator
  const beatInterval = state.rhythm.difficulty === "overclock" ? 280 : (state.rhythm.difficulty === "cyber" ? 360 : 460);
  state.rhythm.audioBeatTimer = setInterval(() => {
    if (!state.rhythm.isRunning) return;
    playRhythmBeatStep(state.rhythm.beatStep);
    state.rhythm.beatStep = (state.rhythm.beatStep + 1) % 4;
  }, beatInterval);

  rhythmGameLoop();
}

function stopRhythmGame() {
  if (!state.rhythm.isRunning) return;
  state.rhythm.isRunning = false;

  if (state.rhythm.animId) {
    cancelAnimationFrame(state.rhythm.animId);
    state.rhythm.animId = null;
  }
  if (state.rhythm.audioBeatTimer) {
    clearInterval(state.rhythm.audioBeatTimer);
    state.rhythm.audioBeatTimer = null;
  }

  const finalScore = state.rhythm.score;
  const maxCombo = state.rhythm.maxStreak;
  const acc = state.rhythm.totalNotes > 0 ? Math.round((state.rhythm.totalHits / state.rhythm.totalNotes) * 100) : 100;

  logSystemMessage(`[BLINK HERO] Track complete! Final Score: ${finalScore} | Max Streak: ${maxCombo}x | Accuracy: ${acc}%`, "emerald");

  // Save score to backend
  if (window.blinkSessionId) {
    api.submitMinigameScore({
      session_id: window.blinkSessionId,
      participant_name: getActiveParticipant().name || "Player 1",
      game_type: "rhythm",
      score: finalScore,
      accuracy_pct: acc,
      max_combo: maxCombo,
      difficulty: state.rhythm.difficulty
    }).then(res => {
      if (res && res.id) {
        logSystemMessage(`[LEADERBOARD] Rhythm score #${res.id} recorded in high scores!`, "cyan");
      }
    }).catch(err => console.warn("Score submit error:", err));
  }

  // Draw final idle canvas
  drawRhythmHighway();
}

function rhythmGameLoop() {
  if (!state.rhythm.isRunning) return;

  const now = performance.now();

  // 1. Note Spawning based on interval
  if (now - state.rhythm.lastSpawnTime >= state.rhythm.spawnInterval) {
    state.rhythm.lastSpawnTime = now;
    const laneIdx = Math.floor(Math.random() * 3);
    state.rhythm.notes.push({
      id: `note-${Math.floor(now)}-${laneIdx}`,
      lane: laneIdx,
      y: -15,
      hit: false,
      missed: false
    });
    state.rhythm.totalNotes++;
  }

  // 2. Note Position Updates & Miss Detection
  for (let i = state.rhythm.notes.length - 1; i >= 0; i--) {
    const note = state.rhythm.notes[i];
    note.y += state.rhythm.speed;

    // Miss detection when passing below strike line
    if (!note.hit && !note.missed && note.y > TARGET_HIT_Y + 35) {
      note.missed = true;
      state.rhythm.streak = 0;
      if (DOM.rhythmStreak) DOM.rhythmStreak.textContent = "0x";
      if (DOM.rhythmRating) {
        DOM.rhythmRating.textContent = "MISS!";
        DOM.rhythmRating.style.color = "#ef4444";
      }
      playRhythmHitSound("MISS");
    }

    // Remove offscreen notes
    if (note.y > 240) {
      state.rhythm.notes.splice(i, 1);
    }
  }

  // 3. Render Canvas
  drawRhythmHighway();

  state.rhythm.animId = requestAnimationFrame(rhythmGameLoop);
}

function handleRhythmInput(laneIdx) {
  if (!state.rhythm.isRunning) return;

  const laneNotes = state.rhythm.notes.filter(n => n.lane === laneIdx && !n.hit && !n.missed);
  if (laneNotes.length === 0) return;

  // Closest note to target
  let closest = laneNotes[0];
  let minDiff = Math.abs(closest.y - TARGET_HIT_Y);

  for (let i = 1; i < laneNotes.length; i++) {
    const diff = Math.abs(laneNotes[i].y - TARGET_HIT_Y);
    if (diff < minDiff) {
      minDiff = diff;
      closest = laneNotes[i];
    }
  }

  const lane = RHYTHM_LANES[laneIdx];

  // Evaluate Accuracy
  let rating = null;
  let points = 0;

  if (minDiff <= 20) {
    rating = "PERFECT!";
    points = 100;
  } else if (minDiff <= 38) {
    rating = "GREAT!";
    points = 65;
  } else if (minDiff <= 58) {
    rating = "OK";
    points = 35;
  }

  if (rating) {
    closest.hit = true;
    state.rhythm.totalHits++;
    state.rhythm.streak++;
    if (state.rhythm.streak > state.rhythm.maxStreak) {
      state.rhythm.maxStreak = state.rhythm.streak;
    }

    // Streak Multiplier
    const mult = state.rhythm.streak >= 20 ? 4 : (state.rhythm.streak >= 10 ? 3 : (state.rhythm.streak >= 5 ? 2 : 1));
    state.rhythm.score += points * mult;

    // Splash particle effect
    rhythmSplashes.push({
      x: lane.x,
      y: TARGET_HIT_Y,
      color: rating === "PERFECT!" ? "#FFE600" : (rating === "GREAT!" ? "#00f2fe" : "#00FF9D"),
      radius: 8,
      alpha: 1.0,
      label: rating
    });

    playRhythmHitSound(rating);

    // Update UI
    if (DOM.rhythmScore) DOM.rhythmScore.textContent = state.rhythm.score;
    if (DOM.rhythmStreak) DOM.rhythmStreak.textContent = `${state.rhythm.streak}x`;
    if (DOM.rhythmRating) {
      DOM.rhythmRating.textContent = `${rating} (+${points * mult})`;
      DOM.rhythmRating.style.color = rating === "PERFECT!" ? "#FFE600" : "#00f2fe";
    }
    const acc = Math.round((state.rhythm.totalHits / state.rhythm.totalNotes) * 100);
    if (DOM.rhythmAcc) DOM.rhythmAcc.textContent = `${acc}%`;

    // Award pet XP for rhythmic hits
    awardPetXP(2, "Rhythm Hit");

    // Broadcast over WebSocket
    if (window.blinkWs) {
      window.blinkWs.sendRhythmScore({
        participant_name: getActiveParticipant().name || "Player",
        score: state.rhythm.score,
        combo: state.rhythm.streak,
        accuracy: rating
      });
    }
  }
}

function drawRhythmHighway() {
  if (!DOM.rhythmCanvas) return;
  const canvas = DOM.rhythmCanvas;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Background Grid Lines
  ctx.strokeStyle = "rgba(0, 242, 254, 0.08)";
  ctx.lineWidth = 1;
  for (let ly = 0; ly < h; ly += 25) {
    ctx.beginPath();
    ctx.moveTo(0, ly);
    ctx.lineTo(w, ly);
    ctx.stroke();
  }

  // 3 Lanes
  RHYTHM_LANES.forEach((lane) => {
    // Lane track glow
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lane.x - 50, 0);
    ctx.lineTo(lane.x - 50, h);
    ctx.moveTo(lane.x + 50, 0);
    ctx.lineTo(lane.x + 50, h);
    ctx.stroke();

    // Key labels at bottom
    ctx.font = "bold 10px 'JetBrains Mono', monospace";
    ctx.fillStyle = lane.color;
    ctx.textAlign = "center";
    ctx.fillText(lane.keyLabel, lane.x, h - 8);

    // Strike receptor ring
    ctx.strokeStyle = lane.color;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(lane.x, TARGET_HIT_Y, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
  });

  // Strike Line
  ctx.strokeStyle = "rgba(0, 242, 254, 0.4)";
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, TARGET_HIT_Y);
  ctx.lineTo(w, TARGET_HIT_Y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw Scrolling Notes
  state.rhythm.notes.forEach(note => {
    if (note.hit) return;
    const lane = RHYTHM_LANES[note.lane];
    ctx.save();
    ctx.fillStyle = lane.color;
    ctx.shadowColor = lane.color;
    ctx.shadowBlur = 12;

    // Diamond note shape
    ctx.beginPath();
    ctx.moveTo(lane.x, note.y - 14);
    ctx.lineTo(lane.x + 16, note.y);
    ctx.lineTo(lane.x, note.y + 14);
    ctx.lineTo(lane.x - 16, note.y);
    ctx.closePath();
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(lane.x, note.y, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });

  // Draw Hit Splashes
  for (let i = rhythmSplashes.length - 1; i >= 0; i--) {
    const s = rhythmSplashes[i];
    s.radius += 2.5;
    s.alpha -= 0.05;
    if (s.alpha <= 0) {
      rhythmSplashes.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 15;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = "bold 13px 'Orbitron', sans-serif";
    ctx.fillStyle = s.color;
    ctx.textAlign = "center";
    ctx.fillText(s.label, s.x, s.y - s.radius - 6);
    ctx.restore();
  }
}

// ====================================================================
// 18C. NEO-PET — BIOMETRIC CYBER TAMAGOTCHI ENGINE
// ====================================================================
let petLoopTimer = null;

function initPetEngine() {
  if (petLoopTimer) clearInterval(petLoopTimer);
  petLoopTimer = setInterval(updatePetVitals, 1500);

  // Load existing session pet if available
  if (window.blinkSessionId) {
    api.fetchPetState(window.blinkSessionId).then(res => {
      if (res && res.pet_name) {
        state.pet.name = res.pet_name;
        state.pet.stage = res.evolution_stage || "CYBER-EGG";
        state.pet.level = res.level || 1;
        state.pet.xp = res.xp || 0;
        state.pet.health = res.health !== undefined ? res.health : 100;
        state.pet.energy = res.energy !== undefined ? res.energy : 100;
        state.pet.happiness = res.happiness !== undefined ? res.happiness : 100;
        state.pet.totalBlinksFed = res.total_blinks_fed || 0;
        renderPetUI();
        logSystemMessage(`[NEO-PET] Familiar '${state.pet.name}' loaded from memory (Stage: ${state.pet.stage}, Lv.${state.pet.level}).`, "cyan");
      }
    }).catch(e => console.warn("Pet init error:", e));
  }

  renderPetUI();
}

function updatePetVitals() {
  // Read active participant blink rate
  const p = getActiveParticipant();
  const bpm = p ? parseFloat(p.blinkRate) || 0 : 15;

  let statusMsg = "RATE: CALIBRATING...";

  // Evaluate BPM Telemetry Health
  if (bpm >= 12 && bpm <= 24) {
    // Sweet spot: thriving!
    state.pet.health = Math.min(100, state.pet.health + 1.2);
    state.pet.happiness = Math.min(100, state.pet.happiness + 2.0);
    state.pet.energy = Math.min(100, state.pet.energy + 1.0);
    state.pet.xp += 3;
    statusMsg = `RATE: ${bpm.toFixed(1)} BPM (IDEAL ZONE — THRIVING ✨)`;
    if (DOM.petMouth) DOM.petMouth.setAttribute("d", "M 70 100 Q 80 112 90 100");
  } else if (bpm > 26) {
    // Excessive / rapid blinking: drains energy, jittery
    state.pet.energy = Math.max(8, state.pet.energy - 2.5);
    state.pet.happiness = Math.max(10, state.pet.happiness - 0.5);
    statusMsg = `RATE: ${bpm.toFixed(1)} BPM (OVERCLOCKED / JITTERY ⚡)`;
    if (DOM.petMouth) DOM.petMouth.setAttribute("d", "M 72 105 Q 80 100 88 105");
  } else if (bpm < 6 && (Date.now() - (state.sessionStartTime || Date.now())) > 12000) {
    // Low rate / staring contest: eye strain penalty!
    state.pet.health = Math.max(12, state.pet.health - 1.5);
    state.pet.energy = Math.max(15, state.pet.energy - 1.0);
    statusMsg = `RATE: ${bpm.toFixed(1)} BPM (RETINA STRAIN / DROOPY 💤)`;
    if (DOM.petMouth) DOM.petMouth.setAttribute("d", "M 72 106 L 88 106");
  } else {
    statusMsg = `RATE: ${bpm.toFixed(1)} BPM (BALANCED RELAXATION)`;
    state.pet.xp += 1;
  }

  if (DOM.petStatusMsg) DOM.petStatusMsg.textContent = statusMsg;

  checkPetEvolution();
  renderPetUI();
}

function checkPetEvolution() {
  const curXp = state.pet.xp;
  let newStage = "CYBER-EGG";
  let newLvl = 1;

  if (curXp >= 700) {
    newStage = "QUANTUM DRAGON";
    newLvl = 4;
  } else if (curXp >= 300) {
    newStage = "MECHA-FOX";
    newLvl = 3;
  } else if (curXp >= 100) {
    newStage = "NEON SPRITE";
    newLvl = 2;
  }

  if (newStage !== state.pet.stage) {
    const priorStage = state.pet.stage;
    state.pet.stage = newStage;
    state.pet.level = newLvl;

    logSystemMessage(`🌟 [EVOLUTION] Familiar evolved from ${priorStage} ➔ ${newStage}! Level ${newLvl} achieved.`, "emerald");
    playSupernovaSound();

    if (state.renderer) {
      state.renderer.triggerConfettiBurst(DOM.canvas ? DOM.canvas.width / 2 : 320, 180, "#FFE600", 60);
      state.renderer.triggerEmojiFloater(DOM.canvas ? DOM.canvas.width / 2 : 320, 150, "✨", `EVOLVED: ${newStage}`);
    }

    savePetStateToBackend();
  }
}

function feedPetOnBlink(p) {
  state.pet.totalBlinksFed++;
  state.pet.happiness = Math.min(100, state.pet.happiness + 0.4);
  state.pet.xp += 1;
  checkPetEvolution();
  renderPetUI();
}

function awardPetXP(amount, reason = "Combo") {
  state.pet.xp += amount;
  state.pet.happiness = Math.min(100, state.pet.happiness + 10);
  logSystemMessage(`[NEO-PET] +${amount} XP awarded for [${reason}].`, "cyan");
  checkPetEvolution();
  renderPetUI();
  savePetStateToBackend();
}

function feedPetManual() {
  initAudio();
  state.pet.happiness = Math.min(100, state.pet.happiness + 18);
  state.pet.energy = Math.min(100, state.pet.energy + 12);
  state.pet.xp += 15;
  logSystemMessage(`[NEO-PET] Fed familiar delicious cyber-ramen. Happiness & energy boosted!`, "emerald");
  playSynthesizedParticipantTone(3);
  triggerPetBlinkAnimation("BOTH");
  checkPetEvolution();
  renderPetUI();
  savePetStateToBackend();
}

function hydratePetManual() {
  initAudio();
  state.pet.health = Math.min(100, state.pet.health + 25);
  state.pet.energy = Math.min(100, state.pet.energy + 10);
  logSystemMessage(`[NEO-PET] Ocular hydration mist administered. Retina strain cleared!`, "cyan");
  playSynthesizedChime();
  triggerPetBlinkAnimation("BOTH");
  renderPetUI();
  savePetStateToBackend();
}

function triggerPetBlinkAnimation(eye = "BOTH") {
  if (eye === "LEFT" || eye === "BOTH") {
    if (DOM.petEyeLeft) {
      DOM.petEyeLeft.setAttribute("ry", "1");
      setTimeout(() => DOM.petEyeLeft.setAttribute("ry", "6"), 160);
    }
  }
  if (eye === "RIGHT" || eye === "BOTH") {
    if (DOM.petEyeRight) {
      DOM.petEyeRight.setAttribute("ry", "1");
      setTimeout(() => DOM.petEyeRight.setAttribute("ry", "6"), 160);
    }
  }
}

function renderPetUI() {
  if (DOM.petStageName) DOM.petStageName.textContent = state.pet.stage;
  if (DOM.petLvlNum) DOM.petLvlNum.textContent = state.pet.level;

  if (DOM.petHealthVal) DOM.petHealthVal.textContent = `${Math.round(state.pet.health)}%`;
  if (DOM.petHealthBar) DOM.petHealthBar.style.width = `${Math.round(state.pet.health)}%`;

  if (DOM.petEnergyVal) DOM.petEnergyVal.textContent = `${Math.round(state.pet.energy)}%`;
  if (DOM.petEnergyBar) DOM.petEnergyBar.style.width = `${Math.round(state.pet.energy)}%`;

  if (DOM.petHappyVal) DOM.petHappyVal.textContent = `${Math.round(state.pet.happiness)}%`;
  if (DOM.petHappyBar) DOM.petHappyBar.style.width = `${Math.round(state.pet.happiness)}%`;

  // XP Progress calculation
  let stageMin = 0;
  let stageMax = 100;
  if (state.pet.stage === "NEON SPRITE") { stageMin = 100; stageMax = 300; }
  else if (state.pet.stage === "MECHA-FOX") { stageMin = 300; stageMax = 700; }
  else if (state.pet.stage === "QUANTUM DRAGON") { stageMin = 700; stageMax = 1500; }

  const xpInStage = Math.max(0, state.pet.xp - stageMin);
  const stageRange = stageMax - stageMin;
  const xpPct = Math.min(100, Math.round((xpInStage / stageRange) * 100));

  if (DOM.petXpVal) DOM.petXpVal.textContent = `${state.pet.xp} / ${stageMax} XP (${xpPct}%)`;
  if (DOM.petXpBar) DOM.petXpBar.style.width = `${xpPct}%`;

  // Update SVG Creature Color / Details by Stage
  if (DOM.petBody) {
    if (state.pet.stage === "CYBER-EGG") {
      DOM.petBody.setAttribute("r", "44");
    } else if (state.pet.stage === "NEON SPRITE") {
      DOM.petBody.setAttribute("r", "48");
    } else if (state.pet.stage === "MECHA-FOX") {
      DOM.petBody.setAttribute("r", "50");
    } else if (state.pet.stage === "QUANTUM DRAGON") {
      DOM.petBody.setAttribute("r", "52");
    }
  }
}

function savePetStateToBackend() {
  if (!window.blinkSessionId) return;
  api.updatePetState(window.blinkSessionId, {
    pet_name: state.pet.name,
    species: "CYBER_FAMILIAR",
    level: state.pet.level,
    xp: state.pet.xp,
    health: state.pet.health,
    energy: state.pet.energy,
    happiness: state.pet.happiness,
    evolution_stage: state.pet.stage,
    total_blinks_fed: state.pet.totalBlinksFed,
    avg_bpm: parseFloat(getActiveParticipant().blinkRate) || 15
  }).catch(e => console.warn("Pet save error:", e));
}

function syncPetFromRemote(remotePet) {
  if (!remotePet) return;
  if (remotePet.name) state.pet.name = remotePet.name;
  if (remotePet.level) state.pet.level = remotePet.level;
  if (remotePet.stage) state.pet.stage = remotePet.stage;
  if (remotePet.xp !== undefined) state.pet.xp = remotePet.xp;
  if (remotePet.health !== undefined) state.pet.health = remotePet.health;
  if (remotePet.energy !== undefined) state.pet.energy = remotePet.energy;
  if (remotePet.happiness !== undefined) state.pet.happiness = remotePet.happiness;
  renderPetUI();
}

// ====================================================================
// 19. SYSTEM TERMINAL & STATUS
// ====================================================================
export function logSystemMessage(text, colorClass = "dim") {
  const line = document.createElement("div");
  line.className = `terminal-line ${colorClass}`;
  const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  line.textContent = `[${timestamp}] > ${text}`;

  DOM.systemTerminal.appendChild(line);
  DOM.systemTerminal.scrollTop = DOM.systemTerminal.scrollHeight;

  if (DOM.systemTerminal.children.length > 120) {
    DOM.systemTerminal.removeChild(DOM.systemTerminal.firstChild);
  }
}

function setSystemStatus(status) {
  DOM.sysStatusText.textContent = status;
  DOM.sysStatusIndicator.className = "system-status";
  switch (status) {
    case "ONLINE":
      DOM.sysStatusIndicator.classList.add("status-online");
      break;
    case "INITIALIZING":
      DOM.sysStatusIndicator.classList.add("status-initializing");
      break;
    case "CAMERA ERROR":
      DOM.sysStatusIndicator.classList.add("status-error");
      break;
    default:
      DOM.sysStatusIndicator.classList.add("status-offline");
      break;
  }
}

// ====================================================================
// 20. EVENT LISTENERS SETUP
// ====================================================================
function setupEventListeners() {
  // Start / Stop Monitoring
  DOM.startBtn.addEventListener("click", () => {
    initAudio();
    if (state.isMonitoring) stopMonitoring();
    else startMonitoring();
  });

  // Scan Person
  DOM.scanPersonBtn.addEventListener("click", () => {
    if (!state.isMonitoring) {
      startMonitoring().then(() => triggerPersonScan());
    } else {
      triggerPersonScan();
    }
  });

  // New Session / Reset
  DOM.newSessionBtn.addEventListener("click", newSession);

  // Export Results JSON
  DOM.exportResultsBtn.addEventListener("click", exportResultsAsJSON);
  DOM.modalExportJsonBtn.addEventListener("click", exportResultsAsJSON);

  // Copy Summary
  DOM.copyResultsBtn.addEventListener("click", copyResultsToClipboard);
  DOM.modalCopySummaryBtn.addEventListener("click", copyResultsToClipboard);

  // Retry Camera
  DOM.cameraRetryBtn.addEventListener("click", () => {
    DOM.cameraErrorBanner.classList.add("hidden");
    startMonitoring();
  });

  // Sensitivity Slider: dynamically tunes sensitivity or triggers recalibration
  DOM.sensitivitySlider.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value);
    state.earThreshold = val;
    let label = "NORMAL";
    if (val <= 0.18) label = "STRICT / LOW";
    else if (val >= 0.23) label = "SENSITIVE / HIGH";
    DOM.sensitivityValText.textContent = `${val.toFixed(2)} (${label})`;
    logSystemMessage(`Ocular sensitivity adjusted to ${val.toFixed(2)} (${label}). Updating thresholds...`, "dim");

    // Dynamically adjust calibration thresholds for all participants
    const factor = val / 0.21;
    state.participants.forEach(p => {
      if (p.calibration) p.calibration.setSensitivity(factor);
    });
  });

  // Developer Debug Mode Toggle
  DOM.debugToggleBtn.addEventListener("click", () => {
    state.debugMode = !state.debugMode;
    DOM.debugToggleBtn.classList.toggle("active", state.debugMode);
    DOM.debugLabel.textContent = state.debugMode ? "DEBUG: ON" : "DEBUG: OFF";
    logSystemMessage(`Computer-Vision Debug HUD & Waveform Oscilloscope: ${state.debugMode ? "ACTIVE" : "DISABLED"}`, "cyan");
  });

  // Sound Toggle
  DOM.soundToggleBtn.addEventListener("click", toggleSound);

  // Battle Arena Controls
  DOM.roundBtnGroup.addEventListener("click", (e) => {
    if (e.target.classList.contains("round-btn")) {
      DOM.roundBtnGroup.querySelectorAll(".round-btn").forEach(b => b.classList.remove("active"));
      e.target.classList.add("active");
      state.battle.duration = parseInt(e.target.dataset.sec);
      resetBattle();
    }
  });

  DOM.battleStartBtn.addEventListener("click", startBattle);
  DOM.battlePauseBtn.addEventListener("click", pauseBattle);
  DOM.battleResetBtn.addEventListener("click", resetBattle);

  // Mini-Games Tabs (Race, Rhythm, Neo-Pet, Reactions/Soundboard, Challenge)
  const gameTabs = [
    { btn: DOM.tabRaceBtn, view: DOM.gameRaceView },
    { btn: DOM.tabRhythmBtn, view: DOM.gameRhythmView },
    { btn: DOM.tabPetBtn, view: DOM.gamePetView },
    { btn: DOM.tabReactionsBtn, view: DOM.gameReactionsView },
    { btn: DOM.tabChallengeBtn, view: DOM.gameChallengeView }
  ];

  function switchGameTab(targetTab) {
    gameTabs.forEach(({ btn, view }) => {
      if (btn && view) {
        const isActive = (btn === targetTab.btn);
        btn.classList.toggle("active", isActive);
        view.classList.toggle("hidden", !isActive);
      }
    });
    if (targetTab.btn === DOM.tabRhythmBtn) {
      drawRhythmHighway();
    }
  }

  gameTabs.forEach(tab => {
    if (tab.btn) {
      tab.btn.addEventListener("click", () => switchGameTab(tab));
    }
  });

  // Blink Race Controls
  if (DOM.startRaceBtn) DOM.startRaceBtn.addEventListener("click", startBlinkRace);

  // Rhythm Minigame Controls
  if (DOM.startRhythmBtn) DOM.startRhythmBtn.addEventListener("click", startRhythmGame);
  if (DOM.stopRhythmBtn) DOM.stopRhythmBtn.addEventListener("click", stopRhythmGame);

  // Rhythm Difficulty Selectors
  document.querySelectorAll(".diff-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      state.rhythm.difficulty = btn.dataset.diff || "casual";
      logSystemMessage(`[BLINK HERO] Difficulty set to ${state.rhythm.difficulty.toUpperCase()}`, "cyan");
    });
  });

  // Rhythm Keyboard Controls (ArrowLeft/A: Left Wink, Space/ArrowDown/S: Center Blink, ArrowRight/D: Right Wink)
  window.addEventListener("keydown", (e) => {
    if (!state.rhythm.isRunning) return;
    if (e.key === "ArrowLeft" || e.code === "KeyA") {
      e.preventDefault();
      handleRhythmInput(0);
    } else if (e.key === " " || e.key === "Spacebar" || e.key === "ArrowDown" || e.code === "KeyS") {
      e.preventDefault();
      handleRhythmInput(1);
    } else if (e.key === "ArrowRight" || e.code === "KeyD") {
      e.preventDefault();
      handleRhythmInput(2);
    }
  });

  // Cyber Neo-Pet Controls
  if (DOM.petFeedBtn) DOM.petFeedBtn.addEventListener("click", feedPetManual);
  if (DOM.petHydrateBtn) DOM.petHydrateBtn.addEventListener("click", hydratePetManual);

  // Soundboard Reaction Buttons Preview/Manual Trigger
  document.querySelectorAll(".combo-card-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      initAudio();
      const comboId = btn.dataset.combo;
      const comboMap = {
        "TRIPLE_BLINK": { title: "SUPERNOVA BURST", emoji: "🔥" },
        "DOUBLE_WINK_LEFT": { title: "CYAN LIGHTNING", emoji: "⚡" },
        "DOUBLE_WINK_RIGHT": { title: "PLASMA EXPLOSION", emoji: "💥" },
        "WINK_ALTERNATE": { title: "HYPERDRIVE WARP", emoji: "🚀" },
        "BLINK_WINK_COMBO": { title: "CYBER MATRIX", emoji: "👁️" }
      };
      const info = comboMap[comboId] || { title: "REACTION FX", emoji: "✨" };
      const p = getActiveParticipant();
      handleAuthoritativeCombo(p, { id: comboId, ...info });
    });
  });

  DOM.newChallengeBtn.addEventListener("click", () => {
    const nextIdx = Math.floor(Math.random() * RANDOM_CHALLENGES.length);
    state.challenge.text = RANDOM_CHALLENGES[nextIdx];
    DOM.randomChallengeText.textContent = `"${state.challenge.text}"`;
    DOM.randomChallengeStatus.textContent = "STATUS: IN PROGRESS";
    logSystemMessage(`New objective issued: ${state.challenge.text}`, "cyan");
  });

  // Clear Terminal
  DOM.clearTerminalBtn.addEventListener("click", () => {
    DOM.systemTerminal.innerHTML = "";
    logSystemMessage("Terminal cleared by operator.", "dim");
  });

  // Features Modal
  DOM.featuresModalBtn.addEventListener("click", () => {
    DOM.featuresModal.classList.remove("hidden");
  });
  DOM.closeFeaturesModalBtn.addEventListener("click", () => {
    DOM.featuresModal.classList.add("hidden");
  });

  // Achievements Modal
  DOM.viewAllAchievementsBtn.addEventListener("click", () => {
    DOM.achievementsModal.classList.remove("hidden");
  });
  DOM.closeAchModalBtn.addEventListener("click", () => {
    DOM.achievementsModal.classList.add("hidden");
  });

  // History Modal
  DOM.closeHistoryModalBtn.addEventListener("click", () => {
    DOM.historyModal.classList.add("hidden");
  });

  // Session Report Modal
  DOM.closeReportModalBtn.addEventListener("click", () => {
    DOM.sessionReportModal.classList.add("hidden");
  });

  // Close modals on backdrop click
  [DOM.featuresModal, DOM.historyModal, DOM.achievementsModal, DOM.sessionReportModal].forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m) m.classList.add("hidden");
    });
  });

  // Window Resize
  window.addEventListener("resize", () => {
    if (state.renderer && DOM.video) {
      state.renderer.syncDimensions(DOM.video);
    }
    drawMultiLineChart();
  });
}

// Bootstrap Application
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
  renderAchievementBadges();
  drawMultiLineChart();
  runBootSequence();
  initPetEngine();
  drawRhythmHighway();

  // Connect to FastAPI Backend
  api.createSession("standard").then(sess => {
    if (sess && sess.id) {
      window.blinkSessionId = sess.id;
      window.blinkSessionCode = sess.session_code;
      logSystemMessage(`[FASTAPI] Active session registered: ${sess.session_code} [ID: ${sess.id.slice(0, 8)}]`, "cyan");
      
      // Load saved pet state from backend
      api.fetchPetState(sess.id).then(res => {
        if (res && res.pet_name) {
          state.pet.name = res.pet_name;
          state.pet.stage = res.evolution_stage || "CYBER-EGG";
          state.pet.level = res.level || 1;
          state.pet.xp = res.xp || 0;
          state.pet.health = res.health !== undefined ? res.health : 100;
          state.pet.energy = res.energy !== undefined ? res.energy : 100;
          state.pet.happiness = res.happiness !== undefined ? res.happiness : 100;
          state.pet.totalBlinksFed = res.total_blinks_fed || 0;
          renderPetUI();
          logSystemMessage(`[NEO-PET] Familiar '${state.pet.name}' loaded from server (Stage: ${state.pet.stage}, Lv.${state.pet.level}).`, "cyan");
        }
      }).catch(e => console.warn("Pet fetch error:", e));

      // Connect WebSocket room
      window.blinkWs = new BlinkWebSocketClient(sess.id, (msg) => {
        if (msg.type === "BLINK_EVENT") {
          logSystemMessage(`[WS SYNC] Remote blink: ${msg.blink.name || msg.blink.participant_key} (#${msg.blink.blink_count})`, "emerald");
        } else if (msg.type === "ACHIEVEMENT_UNLOCKED") {
          logSystemMessage(`[ACHIEVEMENT] ${msg.achievement.title} unlocked!`, "cyan");
        } else if (msg.type === "COMBO_REACTION") {
          const r = msg.reaction || {};
          logSystemMessage(`[NET FX] ${r.participant_name || "Peer"} triggered ${r.title || r.combo_type}!`, "cyan");
          if (state.renderer) {
            state.renderer.triggerComboFx(r.combo_type, DOM.canvas ? DOM.canvas.width - 110 : 530, 52);
          }
          playComboAudio(r.combo_type);
        } else if (msg.type === "COMBO_STREAK") {
          const s = msg.streak_data || {};
          logSystemMessage(`🔥 [NET COMBO] ${s.participant_name || "Peer"} HIT ${s.title || "COMBO"} (${s.combo_count || 2}x)!`, "emerald");
          speakAnnouncerLine(s.callout || s.title, s.tier);
          playArcadeStreakImpact(s.tier);
          triggerScreenShake(s.combo_count >= 4);
          if (state.renderer) {
            state.renderer.triggerComboStreakFx({
              count: s.combo_count || 2,
              tier: s.tier || "DOUBLE",
              title: s.title || "DOUBLE BLINK!",
              callout: s.callout || "DOUBLE KILL!",
              subtext: `${s.participant_name || "PEER"} • ${s.combo_count}X STREAK`,
              color: s.color || "#00f2fe"
            }, DOM.canvas ? DOM.canvas.width / 2 : 320, 140);
          }
        } else if (msg.type === "RHYTHM_SCORE_UPDATE") {
          const s = msg.score_data || {};
          logSystemMessage(`[RHYTHM LEADERBOARD] Peer scored ${s.score || 0} pts (${s.accuracy || 0}% acc) on ${s.difficulty || "casual"}!`, "magenta");
        } else if (msg.type === "PET_UPDATE") {
          syncPetFromRemote(msg.pet);
        }
      });
    }
  }).catch(err => {
    console.warn("[FASTAPI] Backend running in standalone mode or connecting...", err);
  });
});
