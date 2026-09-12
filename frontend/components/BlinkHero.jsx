import React, { useRef, useEffect, useState } from "react";

export default function BlinkHero({
  sessionId,
  onScoreSubmit,
  externalInputLane = null // 0: Left, 1: Center, 2: Right from CV
}) {
  const canvasRef = useRef(null);
  const [isRunning, setIsRunning] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [rating, setRating] = useState("READY");
  const [accuracy, setAccuracy] = useState(100);
  const [difficulty, setDifficulty] = useState("casual");

  const gameStateRef = useRef({
    isRunning: false,
    notes: [],
    splashes: [],
    lastSpawn: 0,
    score: 0,
    streak: 0,
    maxStreak: 0,
    hits: 0,
    totalNotes: 0,
    difficulty: "casual"
  });

  const LANES = [
    { id: 0, name: "LEFT WINK", x: 80, color: "#00f2fe", label: "😉 LEFT" },
    { id: 1, name: "CENTER BLINK", x: 240, color: "#00FF9D", label: "👁️ BOTH" },
    { id: 2, name: "RIGHT WINK", x: 400, color: "#FF007F", label: "RIGHT 😉" }
  ];

  const TARGET_Y = 175;

  const triggerLaneInput = (laneIdx) => {
    const s = gameStateRef.current;
    if (!s.isRunning) return;

    let closest = null;
    let minDiff = 999;
    s.notes.forEach(note => {
      if (note.lane === laneIdx && !note.hit && !note.missed) {
        const diff = Math.abs(note.y - TARGET_Y);
        if (diff < minDiff && diff < 55) {
          minDiff = diff;
          closest = note;
        }
      }
    });

    const lane = LANES[laneIdx];
    if (closest) {
      closest.hit = true;
      let pts = 50;
      let label = "OK";
      let col = "#fbbf24";

      if (minDiff < 14) {
        pts = 150;
        label = "PERFECT!";
        col = "#00FF9D";
      } else if (minDiff < 32) {
        pts = 90;
        label = "GREAT!";
        col = "#00f2fe";
      }

      s.streak++;
      if (s.streak > s.maxStreak) s.maxStreak = s.streak;
      s.hits++;
      const multiplier = Math.min(4, 1 + Math.floor(s.streak / 5));
      s.score += pts * multiplier;

      s.splashes.push({ x: lane.x, y: TARGET_Y, color: col, radius: 10, alpha: 1, label: `${label} +${pts * multiplier}` });
      setRating(label);
    } else {
      s.streak = 0;
      s.splashes.push({ x: lane.x, y: TARGET_Y, color: "#ef4444", radius: 8, alpha: 0.8, label: "MISS!" });
      setRating("MISS!");
    }

    const acc = s.totalNotes > 0 ? Math.round((s.hits / Math.max(1, s.totalNotes)) * 100) : 100;
    setScore(s.score);
    setStreak(s.streak);
    setAccuracy(acc);
  };

  // React to external computer-vision trigger
  useEffect(() => {
    if (externalInputLane !== null && isRunning) {
      triggerLaneInput(externalInputLane);
    }
  }, [externalInputLane]);

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStateRef.current.isRunning) return;
      if (e.key === "ArrowLeft" || e.code === "KeyA") {
        e.preventDefault();
        triggerLaneInput(0);
      } else if (e.key === " " || e.key === "ArrowDown" || e.code === "KeyS") {
        e.preventDefault();
        triggerLaneInput(1);
      } else if (e.key === "ArrowRight" || e.code === "KeyD") {
        e.preventDefault();
        triggerLaneInput(2);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const startGame = () => {
    setIsRunning(true);
    setScore(0);
    setStreak(0);
    setAccuracy(100);
    setRating("BEAT ACTIVE");

    const s = gameStateRef.current;
    s.isRunning = true;
    s.score = 0;
    s.streak = 0;
    s.maxStreak = 0;
    s.hits = 0;
    s.totalNotes = 0;
    s.notes = [];
    s.splashes = [];
    s.lastSpawn = performance.now();
    s.difficulty = difficulty;
  };

  const stopGame = () => {
    setIsRunning(false);
    gameStateRef.current.isRunning = false;

    const finalScore = gameStateRef.current.score;
    const finalAcc = gameStateRef.current.totalNotes > 0 
      ? Math.round((gameStateRef.current.hits / gameStateRef.current.totalNotes) * 100) 
      : 100;

    if (onScoreSubmit) {
      onScoreSubmit({
        score: finalScore,
        accuracy_pct: finalAcc,
        max_combo: gameStateRef.current.maxStreak,
        difficulty
      });
    }
  };

  // Animation Loop
  useEffect(() => {
    let animId;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    const render = () => {
      const s = gameStateRef.current;
      const now = performance.now();

      // Spawn notes
      if (s.isRunning) {
        const interval = s.difficulty === "overclock" ? 480 : (s.difficulty === "cyber" ? 640 : 850);
        if (now - s.lastSpawn >= interval) {
          s.lastSpawn = now;
          const laneIdx = Math.floor(Math.random() * 3);
          s.notes.push({ lane: laneIdx, y: -15, hit: false, missed: false });
          s.totalNotes++;
        }
      }

      // Update positions
      const speed = s.difficulty === "overclock" ? 4.2 : (s.difficulty === "cyber" ? 3.4 : 2.5);
      for (let i = s.notes.length - 1; i >= 0; i--) {
        const note = s.notes[i];
        if (s.isRunning) note.y += speed;
        if (!note.hit && !note.missed && note.y > TARGET_Y + 35) {
          note.missed = true;
          s.streak = 0;
          setStreak(0);
          setRating("MISS!");
        }
        if (note.y > 230 || note.hit) {
          s.notes.splice(i, 1);
        }
      }

      // Render Highway
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#060912";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Lanes
      LANES.forEach((lane, idx) => {
        ctx.strokeStyle = "rgba(0, 242, 254, 0.12)";
        ctx.lineWidth = 1;
        ctx.strokeRect(lane.x - 65, 0, 130, canvas.height);

        // Strike Receptor
        ctx.save();
        ctx.strokeStyle = lane.color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(lane.x, TARGET_Y, 19, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = "bold 9px 'Share Tech Mono', monospace";
        ctx.fillStyle = lane.color;
        ctx.textAlign = "center";
        ctx.fillText(lane.label, lane.x, TARGET_Y + 32);
        ctx.restore();
      });

      // Target line
      ctx.save();
      ctx.strokeStyle = "rgba(255, 230, 0, 0.55)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(10, TARGET_Y);
      ctx.lineTo(canvas.width - 10, TARGET_Y);
      ctx.stroke();
      ctx.restore();

      // Draw Notes
      s.notes.forEach(note => {
        if (note.hit || note.missed) return;
        const lane = LANES[note.lane];
        ctx.save();
        ctx.fillStyle = lane.color;
        ctx.shadowColor = lane.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(lane.x, note.y, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(lane.x, note.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // Draw Splashes
      for (let i = s.splashes.length - 1; i >= 0; i--) {
        const sp = s.splashes[i];
        sp.radius += 2.2;
        sp.alpha -= 0.045;
        if (sp.alpha <= 0) {
          s.splashes.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.globalAlpha = sp.alpha;
        ctx.strokeStyle = sp.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = "bold 11px 'Orbitron', sans-serif";
        ctx.fillStyle = sp.color;
        ctx.textAlign = "center";
        ctx.fillText(sp.label, sp.x, sp.y - sp.radius - 4);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [difficulty]);

  return (
    <section className="rhythm-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">🎵</span>
          <h2 className="panel-title">BLINK HERO: RHYTHM HIGHWAY</h2>
        </div>
        <span className="stat-pill text-cyan">SYNTHWAVE CYBER-BEATS</span>
      </div>

      <div className="rhythm-hud-row">
        <div className="rhythm-stat-box">
          <span className="rhythm-hud-label">SCORE</span>
          <span className="rhythm-hud-val text-cyan">{score}</span>
        </div>
        <div className="rhythm-stat-box">
          <span className="rhythm-hud-label">STREAK</span>
          <span className="rhythm-hud-val text-yellow">{streak}x</span>
        </div>
        <div className="rhythm-stat-box">
          <span className="rhythm-hud-label">RATING</span>
          <span className="rhythm-hud-val text-magenta">{rating}</span>
        </div>
        <div className="rhythm-stat-box">
          <span className="rhythm-hud-label">ACCURACY</span>
          <span className="rhythm-hud-val text-emerald">{accuracy}%</span>
        </div>
      </div>

      <div className="rhythm-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={480}
          height={210}
          className="rhythm-canvas"
        />
      </div>

      <div className="rhythm-controls-footer">
        <div className="diff-group">
          {["casual", "cyber", "overclock"].map(d => (
            <button
              key={d}
              className={`diff-btn ${difficulty === d ? "active" : ""}`}
              onClick={() => {
                setDifficulty(d);
                gameStateRef.current.difficulty = d;
              }}
            >
              {d.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="rhythm-actions">
          {!isRunning ? (
            <button className="primary-btn mini-p-btn" onClick={startGame}>
              ▶ START TRACK
            </button>
          ) : (
            <button className="secondary-btn mini-p-btn" onClick={stopGame}>
              ⏹ STOP TRACK
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
