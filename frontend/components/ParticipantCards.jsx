import React from "react";

export default function ParticipantCards({ participants = [], selectedParticipantId = null, onSelectParticipant = null }) {
  if (participants.length === 0) {
    return (
      <div className="empty-participants-placeholder">
        <span className="placeholder-icon">👥</span>
        <div className="placeholder-text">NO HUMAN FACES PRESENT IN CAMERA FRAME</div>
        <div className="placeholder-sub">
          Position 1 to 4 individuals in front of the optical sensor to begin multi-person tracking.
        </div>
      </div>
    );
  }

  return (
    <div className="participant-grid">
      {participants.map((p) => {
        const participantId = p.id || p.key || p.participantId;
        const streakSeconds = Math.floor(p.currentStreak || 0);
        const bpm = typeof p.blinkRate === "number" ? p.blinkRate.toFixed(1) : (parseFloat(p.blinkRate) || 0.0).toFixed(1);
        const isBlinking = p.status === "BLINKING";
        const isWinking = p.status === "WINKING";
        const isSelected = selectedParticipantId === participantId;

        return (
          <div
            key={participantId}
            id={`participant-card-${participantId}`}
            data-participant-id={participantId}
            className={`participant-card ${isBlinking ? "blinking" : ""} ${isWinking ? "winking" : ""} ${isSelected ? "selected-actor" : ""}`}
            onClick={() => onSelectParticipant && onSelectParticipant(participantId)}
            style={{
              borderColor: p.color || "#00f2fe",
              cursor: onSelectParticipant ? "pointer" : "default",
              boxShadow: isBlinking
                ? `0 0 25px ${p.color || "#00f2fe"}`
                : (isSelected ? `0 0 18px ${p.color || "#00f2fe"}` : `0 0 10px rgba(0,0,0,0.5)`)
            }}
          >
            {/* Top Bar */}
            <div className="participant-card-header">
              <div className="participant-badge-group">
                <span
                  className="participant-dot"
                  style={{ backgroundColor: p.color || "#00f2fe" }}
                ></span>
                <span className="participant-name-title" style={{ color: p.color || "#00f2fe" }}>
                  {p.name || participantId}
                </span>
              </div>
              <span
                className={`status-pill ${p.status ? p.status.toLowerCase() : "tracking"}`}
                style={{ borderColor: p.color || "#00f2fe" }}
              >
                {p.status || "TRACKING"}
              </span>
            </div>

            {/* Metrics Row */}
            <div className="participant-metrics-row">
              {/* Total Blinks */}
              <div className="metric-box">
                <span className="metric-label">TOTAL BLINKS</span>
                <span className="metric-value blink-number" style={{ color: p.color || "#00f2fe" }}>
                  {p.blinkCount || 0}
                </span>
              </div>

              {/* Cadence BPM */}
              <div className="metric-box">
                <span className="metric-label">CADENCE (BPM)</span>
                <span className="metric-value">{bpm}</span>
              </div>

              {/* Current Stare Streak */}
              <div className="metric-box">
                <span className="metric-label">STARE STREAK</span>
                <span className="metric-value">{streakSeconds}s</span>
              </div>
            </div>

            {/* EAR Calibration Status */}
            <div className="participant-ear-bar-wrapper">
              <div className="ear-label-row">
                <span>OCULAR BASELINE: {(p.baselineEar || 0.28).toFixed(3)}</span>
                <span>CURRENT EAR: {(p.currentEar || p.baselineEar || 0.28).toFixed(3)}</span>
              </div>
              <div className="ear-progress-track">
                <div
                  className="ear-progress-fill"
                  style={{
                    width: `${Math.min(100, ((p.currentEar || 0.28) / (p.baselineEar || 0.28)) * 100)}%`,
                    backgroundColor: p.color || "#00f2fe"
                  }}
                ></div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
