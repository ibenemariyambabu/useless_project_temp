import React from "react";

export function FeaturesModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">📖</span>
            <h2 className="modal-title">BLINKOS SYSTEM CAPABILITIES</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="feature-item">
            <h3>👥 Person-Aware Multi-Face Tracking</h3>
            <p>
              Simultaneously tracks up to 4 human faces using MediaPipe Tasks Vision. 
              Tracks spatial centroids and bounding box IoU with zero blink cross-talk.
            </p>
          </div>
          <div className="feature-item">
            <h3>👁️ 6-Point Eye Aspect Ratio (EAR)</h3>
            <p>
              Calculates 6-point Euclidean ocular distances for both left and right eyes. 
              Features a 4-state temporal machine with 2.0s median baseline calibration.
            </p>
          </div>
          <div className="feature-item">
            <h3>⚔️ Competition Arena & Reflex Duel</h3>
            <p>
              Multiplayer duels with configurable 30s/60s/90s round timers, live score tracking, 
              and quick-draw reflex contests with millisecond reaction latency detection.
            </p>
          </div>
          <div className="feature-item">
            <h3>🔒 Strict Local Privacy Protection</h3>
            <p>
              MediaPipe neural inference runs 100% inside your local browser runtime. 
              Only anonymized event metadata (duration, drop, timestamps) is sent to the backend. 
              Zero camera footage or face crops ever leave your machine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HistoryModal({ isOpen, onClose, historyEvents = [] }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">📋</span>
            <h2 className="modal-title">DETAILED BLINK EVENT LEDGER</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>TIME</th>
                  <th>PARTICIPANT</th>
                  <th>DURATION</th>
                  <th>EAR DROP</th>
                  <th>TYPE</th>
                </tr>
              </thead>
              <tbody>
                {historyEvents.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty-table-cell">No blink events logged yet.</td>
                  </tr>
                ) : (
                  historyEvents.slice(-50).reverse().map((ev, i) => (
                    <tr key={i}>
                      <td>{new Date(ev.timestamp).toLocaleTimeString()}</td>
                      <td style={{ color: ev.color || "#00f2fe" }}>{ev.participantName || ev.participantKey}</td>
                      <td>{Math.round(ev.durationMs || 120)} ms</td>
                      <td>{(ev.earDrop || 0.1).toFixed(3)}</td>
                      <td>{ev.isWink ? `😉 WINK (${ev.winkEye})` : "👁️ BLINK"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AchievementsModal({ isOpen, onClose, achievements = [], unlockedKeys = [] }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">🏆</span>
            <h2 className="modal-title">ACHIEVEMENTS & BADGES</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="achievements-grid">
            {achievements.map((a) => {
              const isUnlocked = unlockedKeys.includes(a.achievement_key || a.id);
              return (
                <div key={a.achievement_key || a.id} className={`achievement-badge ${isUnlocked ? "unlocked" : "locked"}`}>
                  <div className="badge-icon">{a.icon === "eye" ? "👁️" : a.icon === "shield" ? "🛡️" : a.icon === "zap" ? "⚡" : a.icon === "award" ? "🎖️" : "🏆"}</div>
                  <div className="badge-title">{a.title}</div>
                  <div className="badge-desc">{a.description}</div>
                  <div className="badge-status-pill">{isUnlocked ? "✓ UNLOCKED" : "LOCKED"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SessionReportModal({ isOpen, onClose, report = null }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container report-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-icon">📊</span>
            <h2 className="modal-title">SESSION CONCLUDED — OFFICIAL REPORT</h2>
          </div>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {report ? (
            <div className="report-content">
              <div className="report-summary-grid">
                <div className="report-card">
                  <span className="report-label">TOTAL BLINKS</span>
                  <span className="report-val">{report.total_blinks}</span>
                </div>
                <div className="report-card">
                  <span className="report-label">SESSION DURATION</span>
                  <span className="report-val">{Math.round(report.duration_seconds)}s</span>
                </div>
                <div className="report-card">
                  <span className="report-label">TOP BLINKER</span>
                  <span className="report-val highlight">{report.top_blinker || "None"}</span>
                </div>
                <div className="report-card">
                  <span className="report-label">HIGHEST CADENCE</span>
                  <span className="report-val">{report.highest_rate_bpm} BPM</span>
                </div>
                <div className="report-card">
                  <span className="report-label">LONGEST STARE</span>
                  <span className="report-val">{report.longest_streak_sec}s</span>
                </div>
                <div className="report-card">
                  <span className="report-label">PARTICIPANTS</span>
                  <span className="report-val">{report.participants_count}</span>
                </div>
              </div>

              {report.achievements_unlocked && report.achievements_unlocked.length > 0 && (
                <div className="report-achievements-unlocked">
                  <h4>🎖️ UNLOCKED IN THIS SESSION</h4>
                  <div className="badges-unlocked-row">
                    {report.achievements_unlocked.map((k) => (
                      <span key={k} className="unlocked-tag">✨ {k}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="report-placeholder">Generating summary report...</div>
          )}
        </div>
        <div className="modal-footer">
          {report && (
            <>
              <button
                className="primary-btn mini-p-btn"
                onClick={() => {
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
                  const a = document.createElement("a");
                  a.href = dataStr;
                  const dateStr = new Date().toISOString().slice(0, 10);
                  a.download = `blinkos_telemetry_${dateStr}.json`;
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
              >
                DOWNLOAD SESSION DATA (JSON)
              </button>
              <button
                className="secondary-btn mini-p-btn"
                onClick={(e) => {
                  const text = `BLINKOS SESSION REPORT\nDuration: ${Math.round(report.duration_seconds)}s\nTotal Blinks: ${report.total_blinks}\nTop Blinker: ${report.top_blinker || 'N/A'}\nHighest Cadence: ${report.highest_rate_bpm} BPM\nLongest Stare: ${report.longest_streak_sec}s`;
                  navigator.clipboard.writeText(text);
                  const btn = e.currentTarget;
                  const orig = btn.textContent;
                  btn.textContent = "✓ COPIED TO CLIPBOARD!";
                  setTimeout(() => { btn.textContent = orig; }, 2000);
                }}
              >
                COPY SUMMARY TO CLIPBOARD
              </button>
            </>
          )}
          <button className="arena-btn" onClick={onClose}>RETURN TO OPERATING SYSTEM</button>
        </div>
      </div>
    </div>
  );
}
