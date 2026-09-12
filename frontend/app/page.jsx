"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Header from "../components/Header";
import CameraHUD from "../components/CameraHUD";
import ParticipantCards from "../components/ParticipantCards";
import Leaderboard from "../components/Leaderboard";
import BattleArena from "../components/BattleArena";
import BlinkRace from "../components/BlinkRace";
import BlinkHero from "../components/BlinkHero";
import NeoPet from "../components/NeoPet";
import SoundboardReactions from "../components/SoundboardReactions";
import ActivityChart from "../components/ActivityChart";
import SystemTerminal from "../components/SystemTerminal";
import {
  FeaturesModal,
  HistoryModal,
  AchievementsModal,
  SessionReportModal
} from "../components/Modals";
import { api, BlinkWebSocketClient } from "../services/api";
import { FaceTracker } from "../cv/faceTracker.js";

// Sound synthesizer using Web Audio API
class AudioSynth {
  constructor() {
    this.ctx = null;
  }
  init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) this.ctx = new AudioContext();
    }
  }
  playBlinkSound(freq = 660, type = "sine") {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio error:", e);
    }
  }
  playBattleBeep(high = false) {
    if (!this.ctx) return;
    try {
      if (this.ctx.state === "suspended") this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.setValueAtTime(high ? 880 : 440, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.15);
    } catch (e) {}
  }
}

const PARTICIPANT_COLORS = ["#00f2fe", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export default function BlinkOSDashboard() {
  // --- Refs ---
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const oscCanvasRef = useRef(null);
  const synthRef = useRef(null);
  const wsClientRef = useRef(null);
  const animFrameIdRef = useRef(null);
  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);

  // --- States ---
  const [isRunning, setIsRunning] = useState(false);
  const [fps, setFps] = useState(0);
  const [resolution, setResolution] = useState("1280x720");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState("INITIALIZING...");
  const [peopleCount, setPeopleCount] = useState(0);
  const [mode, setMode] = useState("IDLE MODE");

  // Participants & Leaderboard
  const [participants, setParticipants] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [historyEvents, setHistoryEvents] = useState([]);
  const [terminalLogs, setTerminalLogs] = useState([
    { time: new Date().toLocaleTimeString(), text: "BlinkOS Cyber-Vision Kernel Loaded.", type: "sys" },
    { time: new Date().toLocaleTimeString(), text: "FastAPI REST & WebSocket sync ready.", type: "sys" }
  ]);

  // Modals
  const [showFeatures, setShowFeatures] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [sessionReport, setSessionReport] = useState(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState(["FIRST_BLINK"]);

  // Battle Arena State
  const [battleActive, setBattleActive] = useState(false);
  const [battleDuration, setBattleDuration] = useState(30);
  const [battleTimeLeft, setBattleTimeLeft] = useState(30);
  const [battleScores, setBattleScores] = useState({});
  const [battleWinner, setBattleWinner] = useState(null);

  // Blink Race State
  const [raceState, setRaceState] = useState("IDLE");
  const [raceCountdown, setRaceCountdown] = useState(3);
  const [raceWinner, setRaceWinner] = useState(null);
  const [raceReactionTime, setRaceReactionTime] = useState(null);
  const raceStartTimeRef = useRef(0);

  // Minigame Tabs, Pet Data & Screen Shake
  const [activeGameTab, setActiveGameTab] = useState("battle");
  const [petData, setPetData] = useState({ pet_name: "CYBER-LUMEN", evolution_stage: "CYBER-EGG", level: 1, xp: 0 });
  const [screenShakeClass, setScreenShakeClass] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState(null);

  // Oscilloscope Ring Buffer, Multi-Person FaceTracker & Blink State Machine
  const earBufferRef = useRef(new Array(100).fill(0.28));
  const refractoryTimersRef = useRef({});
  const closureStartTimesRef = useRef({});
  const calibrationDataRef = useRef({});
  const stateMachineRef = useRef({});
  const faceTrackerRef = useRef(null);
  const sessionStartTimeRef = useRef(Date.now());

  // Add Log Helper
  const addLog = useCallback((text, type = "info") => {
    setTerminalLogs((prev) => [
      ...prev.slice(-99),
      { time: new Date().toLocaleTimeString(), text, type }
    ]);
  }, []);

  // --- Session & WebSocket Initialization ---
  useEffect(() => {
    synthRef.current = new AudioSynth();

    async function initSession() {
      const sess = await api.createSession("standard");
      if (sess && sess.id) {
        setSessionId(sess.id);
        setSessionCode(sess.session_code || "BLINK-LIVE");
        addLog(`Backend Session Established: ${sess.session_code} [ID: ${sess.id.slice(0, 8)}]`, "success");

        // Connect WebSocket
        wsClientRef.current = new BlinkWebSocketClient(sess.id, (msg) => {
          handleIncomingWsMessage(msg);
        });
      }
    }
    initSession();

    return () => {
      if (wsClientRef.current) wsClientRef.current.destroy();
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [addLog]);

  // Handle Incoming WebSocket Messages from Room
  const handleIncomingWsMessage = (msg) => {
    if (!msg || !msg.type) return;

    if (msg.type === "BLINK_EVENT") {
      const b = msg.blink || {};
      const targetId = b.participant_id || b.participant_key || b.participantId;
      const targetName = b.name || b.participant_name || targetId;

      setParticipants((prev) => {
        const match = prev.some((p) => p.id === targetId || p.key === targetId);
        if (!match && targetId) {
          return [
            ...prev,
            {
              id: targetId,
              key: targetId,
              participantId: targetId,
              name: targetName,
              color: PARTICIPANT_COLORS[prev.length % PARTICIPANT_COLORS.length],
              blinkCount: b.blink_count || 1,
              blinkRate: 1.0,
              currentStreak: 1,
              longestStreak: 1,
              baselineEar: 0.28,
              currentEar: 0.28,
              status: "BLINKING",
              lastBlinkTime: b.timestamp || Date.now(),
              isRemote: true
            }
          ];
        }
        return prev.map((p) => {
          if (p.id === targetId || p.key === targetId || p.name === targetName) {
            const count = b.blink_count !== undefined ? b.blink_count : (p.blinkCount || 0) + 1;
            const elapsedMins = Math.max(0.1, (Date.now() - (sessionStartTimeRef.current || Date.now())) / 60000);
            const rate = parseFloat((count / elapsedMins).toFixed(1));
            return {
              ...p,
              blinkCount: count,
              blinkRate: rate,
              status: "BLINKING",
              lastBlinkTime: b.timestamp || Date.now()
            };
          }
          return p;
        });
      });

      setTimeout(() => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === targetId || p.key === targetId || p.name === targetName
              ? { ...p, status: "TRACKING" }
              : p
          )
        );
      }, 300);

      addLog(`[WS] ${targetName} blinked (${Math.round(b.duration_ms || 120)}ms) • Total: ${b.blink_count || 1}`, "blink");
      if (soundEnabled && synthRef.current) {
        synthRef.current.playBlinkSound(750, "sine");
      }
    } else if (msg.type === "BATTLE_ACTION") {
      if (msg.action === "start") {
        setBattleActive(true);
        setBattleTimeLeft(msg.duration || 30);
        setBattleScores({});
        setBattleWinner(null);
        setMode("BATTLE ARENA");
        addLog("Optical Battle Round Started via multiplayer sync!", "warn");
      } else if (msg.action === "pause") {
        setBattleActive(false);
      } else if (msg.action === "reset") {
        setBattleActive(false);
        setBattleTimeLeft(msg.duration || 30);
        setBattleScores({});
        setBattleWinner(null);
      }
    } else if (msg.type === "ACHIEVEMENT_UNLOCKED") {
      addLog(`🎖️ Achievement Unlocked: ${msg.achievement.title}`, "success");
      setUnlockedAchievements((prev) => [...new Set([...prev, msg.achievement.key])]);
    } else if (msg.type === "COMBO_REACTION") {
      const r = msg.reaction || {};
      addLog(`💥 [REACTION] ${r.participant_name || "Peer"} triggered ${r.title || r.combo_type}!`, "success");
    } else if (msg.type === "COMBO_STREAK") {
      const s = msg.streak_data || {};
      addLog(`🔥 [STREAK] ${s.participant_name || "Peer"} hit ${s.title || "COMBO"} (${s.combo_count || 2}x)!`, "success");
      if (typeof window !== "undefined" && window.speechSynthesis) {
        try {
          window.speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(s.callout || s.title || "Combo!");
          utter.rate = 1.35;
          window.speechSynthesis.speak(utter);
        } catch (e) {}
      }
      setScreenShakeClass(s.combo_count >= 4 ? "shake-heavy" : "shake-mild");
      setTimeout(() => setScreenShakeClass(""), 450);
    } else if (msg.type === "RHYTHM_SCORE_UPDATE") {
      const s = msg.score_data || {};
      addLog(`🎵 [RHYTHM] Peer scored ${s.score || 0} pts (${s.accuracy || 0}% acc) on ${s.difficulty || "casual"}!`, "info");
    } else if (msg.type === "PET_UPDATE") {
      if (msg.pet) setPetData(msg.pet);
    } else if (msg.type === "SESSION_CONCLUDED") {
      setSessionReport(msg.report);
      setShowReport(true);
      addLog("Session concluded and final report received.", "sys");
    }
  };

  // --- Battle Timer Loop ---
  useEffect(() => {
    let timer = null;
    if (battleActive && battleTimeLeft > 0) {
      timer = setInterval(() => {
        setBattleTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setBattleActive(false);
            concludeBattle();
            return 0;
          }
          if (soundEnabled && prev <= 4 && synthRef.current) {
            synthRef.current.playBattleBeep(false);
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [battleActive, battleTimeLeft, soundEnabled]);

  const concludeBattle = () => {
    let winner = null;
    let maxBlinks = -1;
    for (const [key, count] of Object.entries(battleScores)) {
      if (count > maxBlinks) {
        maxBlinks = count;
        winner = key;
      }
    }
    const winnerP = participants.find((p) => p.id === winner || p.key === winner);
    const winnerName = winnerP ? winnerP.name : winner;
    setBattleWinner(winner ? `${winnerName} (${maxBlinks} Blinks)` : "Draw / No Blinks");
    if (soundEnabled && synthRef.current) synthRef.current.playBattleBeep(true);
    addLog(`⚔️ Battle Round Finished! Winner: ${winnerName || "Draw"}`, "success");
  };

  // --- Blink Race Sequence ---
  const handleStartRace = () => {
    setRaceState("COUNTDOWN");
    setRaceCountdown(3);
    setRaceWinner(null);
    setRaceReactionTime(null);
    setMode("BLINK RACE");
    addLog("Reflex Race: 3...", "warn");

    let count = 3;
    const interval = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setRaceCountdown(count);
        addLog(`Reflex Race: ${count}...`, "warn");
      } else {
        clearInterval(interval);
        setRaceState("WAITING_BLINK");
        raceStartTimeRef.current = performance.now();
        addLog("⚡ BLINK NOW!", "blink");
        if (soundEnabled && synthRef.current) synthRef.current.playBattleBeep(true);
      }
    }, 1000);
  };

  // --- Authoritative Blink Trigger Handler ---
  const onBlinkDetected = useCallback(
    (participantId, blinkData) => {
      const now = Date.now();
      const elapsedMins = Math.max(0.1, (now - (sessionStartTimeRef.current || now)) / 60000);
      const participantName = blinkData.name || participantId;

      // 1. Scoped State Updater by Participant ID
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.id === participantId || p.key === participantId || p.name === participantId) {
            const count = (p.blinkCount || 0) + 1;
            const rate = parseFloat((count / elapsedMins).toFixed(1));
            return {
              ...p,
              blinkCount: count,
              blinkRate: rate,
              status: "BLINKING",
              currentStreak: (p.currentStreak || 0) + 1,
              longestStreak: Math.max(p.longestStreak || 0, (p.currentStreak || 0) + 1),
              lastBlinkTime: now,
              currentEar: blinkData.minEar || p.currentEar
            };
          }
          return p;
        })
      );

      // Reset status back to tracking after 300ms
      setTimeout(() => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === participantId || p.key === participantId || p.name === participantId
              ? { ...p, status: "TRACKING" }
              : p
          )
        );
      }, 300);

      // 2. Play audio tone
      if (soundEnabled && synthRef.current) {
        synthRef.current.playBlinkSound(650 + Math.random() * 100, "sine");
      }

      // 3. Update battle score scoped to participantId
      if (battleActive) {
        setBattleScores((prev) => ({
          ...prev,
          [participantId]: (prev[participantId] || 0) + 1
        }));
      }

      // 4. Update Reflex Race if waiting
      if (raceState === "WAITING_BLINK") {
        const reactionMs = Math.round(performance.now() - raceStartTimeRef.current);
        setRaceWinner(participantName);
        setRaceReactionTime(reactionMs);
        setRaceState("FINISHED");
        addLog(`🏁 ${participantName} won the reflex race in ${reactionMs}ms!`, "success");
      }

      // 5. Append to activity timeline and history scoped to participant
      const ev = {
        timestamp: now,
        participantKey: participantId,
        participantId: participantId,
        participantName,
        durationMs: blinkData.durationMs || 120,
        earDrop: blinkData.earDrop || 0.1,
        isWink: blinkData.isWink || false,
        winkEye: blinkData.winkEye || null,
        color: blinkData.color || "#00f2fe"
      };
      setHistoryEvents((prev) => [...prev.slice(-99), ev]);

      // 6. Transmit authoritative event to FastAPI Backend via REST
      if (sessionId) {
        api.recordBlink({
          session_id: sessionId,
          participant_id: participantId,
          participant_key: participantId,
          participant_name: participantName,
          timestamp: now,
          duration_ms: blinkData.durationMs || 120,
          ear_drop: blinkData.earDrop || 0.1,
          min_ear: blinkData.minEar || 0.18,
          confidence: blinkData.confidence || 0.95,
          head_pose_yaw: blinkData.headPoseYaw || 0.0,
          head_pose_pitch: blinkData.headPosePitch || 0.0,
          is_wink: blinkData.isWink || false,
          wink_eye: blinkData.winkEye || null
        });

        // Periodically refresh leaderboard
        api.fetchLeaderboard(sessionId).then((rows) => {
          if (rows && rows.length > 0) setLeaderboard(rows);
        }).catch(() => {});
      }
    },
    [battleActive, raceState, sessionId, soundEnabled, addLog]
  );

  // --- MediaPipe Face Tracking & Inference Loop ---
  const startCamera = async () => {
    if (synthRef.current) synthRef.current.init();

    try {
      addLog("Requesting local camera access...", "info");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, frameRate: { ideal: 60 } }
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setResolution(`${videoRef.current.videoWidth || 1280}x${videoRef.current.videoHeight || 720}`);
      }

      setIsRunning(true);
      setMode("NORMAL OPERATION");
      addLog("Camera stream engaged. Loading MediaPipe FaceLandmarker...", "success");

      // Load MediaPipe FaceLandmarker if available on window
      if (window.FilesetResolver && window.FaceLandmarker) {
        const fileset = await window.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        landmarkerRef.current = await window.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numFaces: 4,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFaceBlendshapes: true
        });
        addLog("MediaPipe Neural FaceLandmarker initialized successfully.", "success");
      } else {
        addLog("MediaPipe CDN scripts loading in background...", "info");
      }

      runInferenceLoop();
    } catch (err) {
      console.error("Camera start error:", err);
      addLog(`Camera Error: ${err.message || err}`, "warn");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
    }
    if (faceTrackerRef.current) {
      faceTrackerRef.current.clear();
    }
    setIsRunning(false);
    setMode("IDLE MODE");
    setPeopleCount(0);
    addLog("Optical stream halted.", "info");
  };

  // Main Render & Detection Loop
  const runInferenceLoop = () => {
    let lastTime = performance.now();
    let frameCount = 0;

    const loop = (timestamp) => {
      // FPS measurement
      frameCount += 1;
      if (timestamp - lastTime >= 1000) {
        setFps(frameCount);
        frameCount = 0;
        lastTime = timestamp;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState >= 2) {
        const ctx = canvas.getContext("2d");
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Perform Landmarker Inference
        if (landmarkerRef.current) {
          try {
            const results = landmarkerRef.current.detectForVideo(video, timestamp);
            const faces = results.faceLandmarks || [];

            // Multi-Person Spatial FaceTracker:
            // Matches raw landmarks to persistent participant IDs using centroid distance and IoU bipartite matching.
            if (!faceTrackerRef.current) {
              faceTrackerRef.current = new FaceTracker({
                onJoined: (p) => addLog(`[TRACKER] Participant joined: ${p.name} (${p.id})`, "info"),
                onLeft: (p) => {
                  addLog(`[TRACKER] Participant left: ${p.name} (${p.id})`, "dim");
                  setParticipants((prev) => prev.filter((item) => item.id !== p.id));
                },
                onReacquired: (p) => addLog(`[TRACKER] Participant reacquired: ${p.name} (${p.id})`, "info")
              });
            }

            const trackedParticipants = faceTrackerRef.current.update(faces, timestamp);
            const activeParticipants = trackedParticipants.filter(
              (tp) => tp.status === "active" || tp.status === "lost_grace"
            );
            setPeopleCount(activeParticipants.length);

            // Synchronize React participants state with persistent tracked participants
            if (activeParticipants.length > 0) {
              setParticipants((prev) => {
                let changed = false;
                const existingMap = new Map(prev.map((p) => [p.id, p]));
                const updated = [...prev];

                for (const tp of activeParticipants) {
                  if (!existingMap.has(tp.id)) {
                    changed = true;
                    const color = tp.palette?.hex || PARTICIPANT_COLORS[(tp.seq - 1) % PARTICIPANT_COLORS.length];
                    updated.push({
                      id: tp.id,
                      key: tp.id,
                      participantId: tp.id,
                      seq: tp.seq,
                      name: tp.name,
                      color,
                      blinkCount: 0,
                      blinkRate: 0.0,
                      currentStreak: 0,
                      longestStreak: 0,
                      baselineEar: 0.28,
                      currentEar: 0.28,
                      status: "TRACKING"
                    });
                  }
                }
                return changed ? updated : prev;
              });
            }

            // Draw Cyber Reticles & execute ocular pipeline per persistent participant
            activeParticipants.forEach((tp) => {
              const participantId = tp.id;
              const participantName = tp.name;
              const color = tp.palette?.hex || PARTICIPANT_COLORS[(tp.seq - 1) % PARTICIPANT_COLORS.length];
              const landmarks = tp.landmarks;
              if (!landmarks || landmarks.length === 0) return;

              // Calculate bounding box from landmarks
              let minX = 1, minY = 1, maxX = 0, maxY = 0;
              landmarks.forEach((pt) => {
                if (pt.x < minX) minX = pt.x;
                if (pt.y < minY) minY = pt.y;
                if (pt.x > maxX) maxX = pt.x;
                if (pt.y > maxY) maxY = pt.y;
              });

              // Mirrored horizontal coordinates for webcam feel
              const boxX = (1 - maxX) * canvas.width;
              const boxY = minY * canvas.height;
              const boxW = (maxX - minX) * canvas.width;
              const boxH = (maxY - minY) * canvas.height;

              // Corner brackets
              ctx.strokeStyle = color;
              ctx.lineWidth = 2.5;
              const cornerLen = Math.min(24, boxW * 0.2);

              // Top-Left
              ctx.beginPath();
              ctx.moveTo(boxX, boxY + cornerLen);
              ctx.lineTo(boxX, boxY);
              ctx.lineTo(boxX + cornerLen, boxY);
              ctx.stroke();

              // Top-Right
              ctx.beginPath();
              ctx.moveTo(boxX + boxW - cornerLen, boxY);
              ctx.lineTo(boxX + boxW, boxY);
              ctx.lineTo(boxX + boxW, boxY + cornerLen);
              ctx.stroke();

              // Bottom-Left
              ctx.beginPath();
              ctx.moveTo(boxX, boxY + boxH - cornerLen);
              ctx.lineTo(boxX, boxY + boxH);
              ctx.lineTo(boxX + cornerLen, boxY + boxH);
              ctx.stroke();

              // Bottom-Right
              ctx.beginPath();
              ctx.moveTo(boxX + boxW - cornerLen, boxY + boxH);
              ctx.lineTo(boxX + boxW, boxY + boxH);
              ctx.lineTo(boxX + boxW, boxY + boxH - cornerLen);
              ctx.stroke();

              // Standard MediaPipe Face Mesh Periocular Indices:
              // Left Eye: [33, 160, 158, 133, 153, 145]
              // Right Eye: [362, 385, 387, 263, 373, 380]
              const p33 = landmarks[33], p133 = landmarks[133], p160 = landmarks[160], p145 = landmarks[145], p158 = landmarks[158], p153 = landmarks[153];
              const p362 = landmarks[362], p263 = landmarks[263], p385 = landmarks[385], p380 = landmarks[380], p387 = landmarks[387], p373 = landmarks[373];

              const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

              let leftEAR = 0, rightEAR = 0;
              if (p33 && p133 && p160 && p145 && p158 && p153) {
                const v1 = dist(p160, p145);
                const v2 = dist(p158, p153);
                const h = dist(p33, p133);
                leftEAR = h > 0.000001 ? (v1 + v2) / (2.0 * h) : 0;
              }
              if (p362 && p263 && p385 && p380 && p387 && p373) {
                const v1 = dist(p385, p380);
                const v2 = dist(p387, p373);
                const h = dist(p362, p263);
                rightEAR = h > 0.000001 ? (v1 + v2) / (2.0 * h) : 0;
              }

              const ear = (leftEAR > 0 && rightEAR > 0) ? (leftEAR + rightEAR) / 2.0 : (leftEAR || rightEAR || 0.28);
              earBufferRef.current.push(ear);
              if (earBufferRef.current.length > 100) earBufferRef.current.shift();

              const nowMs = performance.now();

              // 1. Mandatory 2-Second Startup Calibration Window (Scoped strictly to participantId)
              if (!calibrationDataRef.current[participantId]) {
                calibrationDataRef.current[participantId] = {
                  samples: [],
                  startTime: nowMs,
                  isCalibrated: false,
                  openThreshold: 0.28,
                  closeThreshold: 0.224,
                  reopenThreshold: 0.252,
                  closedExtreme: 0.15,
                  openExtreme: 0.35
                };
              }

              const calib = calibrationDataRef.current[participantId];
              if (!calib.isCalibrated) {
                if (ear > 0.05 && ear < 0.60) {
                  calib.samples.push(ear);
                }
                const elapsed = nowMs - calib.startTime;
                const progress = Math.min(1.0, elapsed / 2000);

                // Participant Header Label with calibration status
                ctx.fillStyle = "rgba(4, 7, 17, 0.85)";
                ctx.fillRect(boxX, boxY - 26, Math.max(160, boxW * 0.7), 22);
                ctx.fillStyle = color;
                ctx.font = "bold 12px Orbitron, sans-serif";
                ctx.fillText(`${participantName} [CALIB ${Math.round(progress * 100)}%]`, boxX + 6, boxY - 10);

                if (elapsed >= 2000 && calib.samples.length >= 20) {
                  const sorted = [...calib.samples].sort((a, b) => a - b);
                  calib.closedExtreme = sorted[0];
                  calib.openExtreme = sorted[sorted.length - 1];
                  const idx75 = Math.floor(sorted.length * 0.75);
                  calib.openThreshold = sorted[idx75] || sorted[Math.floor(sorted.length / 2)];
                  calib.closeThreshold = calib.openThreshold * 0.80;
                  calib.reopenThreshold = calib.openThreshold * 0.90;
                  calib.isCalibrated = true;
                  addLog(`[CALIBRATION] ${participantName} (${participantId}) dynamic baseline locked: open=${calib.openThreshold.toFixed(3)}, close=${calib.closeThreshold.toFixed(3)}, reopen=${calib.reopenThreshold.toFixed(3)}`, "success");
                  setParticipants((prev) =>
                    prev.map((p) =>
                      p.id === participantId || p.key === participantId
                        ? { ...p, baselineEar: calib.openThreshold, currentEar: calib.openThreshold }
                        : p
                    )
                  );
                }
                // Suppress blink triggers during mandatory 2s calibration window
                return;
              }

              // Calibrated Header Label
              ctx.fillStyle = "rgba(4, 7, 17, 0.85)";
              ctx.fillRect(boxX, boxY - 26, Math.max(140, boxW * 0.6), 22);
              ctx.fillStyle = color;
              ctx.font = "bold 12px Orbitron, sans-serif";
              ctx.fillText(`${participantName} [LOCKED]`, boxX + 6, boxY - 10);

              // 2. Hardened 400ms Refractory Period Lockout Guard (Scoped strictly to participantId)
              const isLockedOut = nowMs < (refractoryTimersRef.current[participantId] || 0);
              if (isLockedOut) {
                if (stateMachineRef.current[participantId] === "CLOSED" && ear >= calib.reopenThreshold) {
                  stateMachineRef.current[participantId] = "OPEN";
                }
                return;
              }

              // 3. Zero-Lag State Machine with Hardened 400ms Lockout on Falling Edge
              const currentState = stateMachineRef.current[participantId] || "OPEN";

              if (currentState === "OPEN") {
                // Falling Edge: Trigger down-state when EAR drops below openThreshold * 0.8
                if (ear < calib.closeThreshold) {
                  stateMachineRef.current[participantId] = "CLOSED";
                  closureStartTimesRef.current[participantId] = nowMs;

                  // HARDENED REFRACTORY LOCKOUT:
                  // Once a falling edge registers a valid blink, lock out all incoming triggers for 400ms!
                  refractoryTimersRef.current[participantId] = nowMs + 400;

                  onBlinkDetected(participantId, {
                    name: participantName,
                    durationMs: 100,
                    earDrop: parseFloat((calib.openThreshold - ear).toFixed(3)),
                    minEar: parseFloat(ear.toFixed(3)),
                    confidence: 0.98,
                    color
                  });
                }
              } else if (currentState === "CLOSED") {
                // Return to OPEN state when EAR crosses back above reopenThreshold (openThreshold * 0.9)
                if (ear >= calib.reopenThreshold) {
                  stateMachineRef.current[participantId] = "OPEN";
                  closureStartTimesRef.current[participantId] = 0;
                }
              }
            });
          } catch (e) {
            // Frame processing catch
          }
        }

        // Draw Oscilloscope waveform
        const oscCanvas = oscCanvasRef.current;
        if (oscCanvas) {
          const oCtx = oscCanvas.getContext("2d");
          const oW = oscCanvas.width;
          const oH = oscCanvas.height;
          oCtx.fillStyle = "rgba(4, 7, 17, 0.95)";
          oCtx.fillRect(0, 0, oW, oH);

          oCtx.strokeStyle = "#00f2fe";
          oCtx.lineWidth = 2;
          oCtx.beginPath();
          const buf = earBufferRef.current;
          buf.forEach((val, i) => {
            const x = (i / buf.length) * oW;
            const y = oH - Math.max(5, Math.min(oH - 5, val * 120));
            if (i === 0) oCtx.moveTo(x, y);
            else oCtx.lineTo(x, y);
          });
          oCtx.stroke();
        }
      }

      animFrameIdRef.current = requestAnimationFrame(loop);
    };

    animFrameIdRef.current = requestAnimationFrame(loop);
  };

  // End Session Report
  const handleEndSession = async () => {
    if (sessionId) {
      const rep = await api.endSession(sessionId);
      if (rep) {
        setSessionReport(rep);
        setShowReport(true);
      }
    }
  };

  return (
    <div className={`app-container ${screenShakeClass}`}>
      {/* Top Header */}
      <Header
        peopleDetected={peopleCount}
        mode={mode}
        soundEnabled={soundEnabled}
        debugEnabled={debugEnabled}
        onToggleSound={() => setSoundEnabled((v) => !v)}
        onToggleDebug={() => setDebugEnabled((v) => !v)}
        onOpenFeatures={() => setShowFeatures(true)}
        onOpenHistory={() => setShowHistory(true)}
        onOpenAchievements={() => setShowAchievements(true)}
        onOpenReport={handleEndSession}
      />

      {/* Main Grid Layout */}
      <main className="dashboard-main-grid">
        {/* Left Column: Camera Viewport HUD & Participants */}
        <div className="grid-left-col">
          <CameraHUD
            videoRef={videoRef}
            canvasRef={canvasRef}
            oscCanvasRef={oscCanvasRef}
            isRunning={isRunning}
            fps={fps}
            resolution={resolution}
            debugEnabled={debugEnabled}
            onStartCamera={startCamera}
            onStopCamera={stopCamera}
          />

          <ParticipantCards
            participants={participants}
            selectedParticipantId={selectedParticipantId}
            onSelectParticipant={(id) => setSelectedParticipantId(id)}
          />
          <ActivityChart historyEvents={historyEvents} participants={participants} />
        </div>

        {/* Right Column: Mini-Games, Leaderboard & Terminal */}
        <div className="grid-right-col">
          {(() => {
            const activeParticipant =
              participants.find((p) => p.id === selectedParticipantId || p.key === selectedParticipantId) ||
              participants[0] ||
              { id: "person-1", name: "PERSON 1", blinkRate: 15 };

            return (
              <>
                {/* Mini-Games Suite Tabs */}
                <div className="minigame-nav-tabs" style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }}>
                  <button className={`tab-btn ${activeGameTab === "battle" ? "active" : ""}`} onClick={() => setActiveGameTab("battle")}>⚔️ BATTLE</button>
                  <button className={`tab-btn ${activeGameTab === "race" ? "active" : ""}`} onClick={() => setActiveGameTab("race")}>🏁 RACE</button>
                  <button className={`tab-btn ${activeGameTab === "rhythm" ? "active" : ""}`} onClick={() => setActiveGameTab("rhythm")}>🎵 BLINK HERO</button>
                  <button className={`tab-btn ${activeGameTab === "pet" ? "active" : ""}`} onClick={() => setActiveGameTab("pet")}>👾 NEO-PET</button>
                  <button className={`tab-btn ${activeGameTab === "soundboard" ? "active" : ""}`} onClick={() => setActiveGameTab("soundboard")}>🔊 SOUNDBOARD</button>
                </div>

                {activeGameTab === "battle" && (
                  <BattleArena
                    battleActive={battleActive}
                    battleTimeLeft={battleTimeLeft}
                    selectedDuration={battleDuration}
                    battleScores={battleScores}
                    participants={participants}
                    battleWinner={battleWinner}
                    onSelectDuration={(d) => setBattleDuration(d)}
                    onStartBattle={() => {
                      setBattleActive(true);
                      setBattleTimeLeft(battleDuration);
                      setBattleScores({});
                      setBattleWinner(null);
                      setMode("BATTLE ARENA");
                      if (sessionId) api.triggerBattleAction(sessionId, "start", battleDuration);
                    }}
                    onPauseBattle={() => {
                      setBattleActive(false);
                      if (sessionId) api.triggerBattleAction(sessionId, "pause");
                    }}
                    onResetBattle={() => {
                      setBattleActive(false);
                      setBattleTimeLeft(battleDuration);
                      setBattleScores({});
                      setBattleWinner(null);
                      if (sessionId) api.triggerBattleAction(sessionId, "reset", battleDuration);
                    }}
                  />
                )}

                {activeGameTab === "race" && (
                  <BlinkRace
                    raceState={raceState}
                    countdownNumber={raceCountdown}
                    raceWinner={raceWinner}
                    reactionTimeMs={raceReactionTime}
                    onStartRace={handleStartRace}
                    onResetRace={() => {
                      setRaceState("IDLE");
                      setRaceWinner(null);
                      setRaceReactionTime(null);
                    }}
                  />
                )}

                {activeGameTab === "rhythm" && (
                  <BlinkHero
                    sessionId={sessionId}
                    onScoreSubmit={(data) => {
                      if (sessionId) {
                        api.submitMinigameScore({
                          session_id: sessionId,
                          participant_name: activeParticipant?.name || "Player 1",
                          game_type: "rhythm",
                          ...data
                        }).then(() => addLog(`[HERO] Score submitted for ${activeParticipant?.name || "Player"}: ${data.score} pts`, "success"));
                      }
                    }}
                  />
                )}

                {activeGameTab === "pet" && (
                  <NeoPet
                    petState={petData}
                    liveBpm={parseFloat(activeParticipant?.blinkRate) || 15}
                    onFeed={() => {
                      addLog(`Nourished familiar with cyber-ramen for ${activeParticipant?.name || "Operator"}!`, "success");
                      if (sessionId) {
                        api.updatePetState(sessionId, { pet_name: petData.pet_name || "CYBER-LUMEN", xp: (petData.xp || 0) + 15 });
                      }
                    }}
                    onHydrate={() => {
                      addLog("Administered ocular hydration mist!", "info");
                    }}
                  />
                )}

                {activeGameTab === "soundboard" && (
                  <SoundboardReactions
                    onTriggerCombo={(combo) => {
                      addLog(`Triggered Reaction Combo: ${combo.title} (${combo.emoji}) by ${activeParticipant?.name || "Local Operator"}`, "success");
                      if (wsClientRef.current) {
                        wsClientRef.current.sendComboReaction({
                          combo_type: combo.id,
                          emoji: combo.emoji,
                          title: combo.title,
                          participant_name: activeParticipant?.name || "Local Operator"
                        });
                      }
                    }}
                  />
                )}
              </>
            );
          })()}

          <Leaderboard entries={leaderboard.length > 0 ? leaderboard : participants} />
          <SystemTerminal logs={terminalLogs} />
        </div>
      </main>

      {/* Modals */}
      <FeaturesModal isOpen={showFeatures} onClose={() => setShowFeatures(false)} />
      <HistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} historyEvents={historyEvents} />
      <AchievementsModal
        isOpen={showAchievements}
        onClose={() => setShowAchievements(false)}
        unlockedKeys={unlockedAchievements}
        achievements={[
          { achievement_key: "FIRST_BLINK", title: "First Contact", description: "Recorded your first optical blink.", icon: "eye" },
          { achievement_key: "STARE_MASTER", title: "Stare Master", description: "10+ seconds unbroken stare.", icon: "shield" },
          { achievement_key: "RAPID_FIRE", title: "Hyper Frequency", description: "Cadence exceeding 30 BPM.", icon: "zap" },
          { achievement_key: "BLINK_CENTURION", title: "Centurion", description: "50 accumulated blinks.", icon: "award" }
        ]}
      />
      <SessionReportModal
        isOpen={showReport}
        onClose={() => setShowReport(false)}
        report={sessionReport}
      />
    </div>
  );
}
