import React from "react";

export default function BattleArena({
  battleActive = false,
  battleTimeLeft = 30,
  selectedDuration = 30,
  battleScores = {},
  participants = [],
  battleWinner = null,
  onSelectDuration,
  onStartBattle,
  onPauseBattle,
  onResetBattle
}) {
  return (
    <section className="battle-arena-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">⚔️</span>
          <h2 className="panel-title">OPTICAL BATTLE ARENA</h2>
        </div>
        <div className="round-duration-selector">
          {[30, 60, 90].map((sec) => (
            <button
              key={sec}
              className={`duration-pill-btn ${selectedDuration === sec ? "active" : ""}`}
              disabled={battleActive}
              onClick={() => onSelectDuration(sec)}
            >
              {sec}s
            </button>
          ))}
        </div>
      </div>

      <div className="arena-body">
        {/* Battle Digital Clock */}
        <div className="battle-timer-display">
          <div className="clock-label">ROUND CLOCK</div>
          <div className={`clock-digits ${battleTimeLeft <= 5 && battleActive ? "critical-pulse" : ""}`}>
            00:{battleTimeLeft < 10 ? `0${battleTimeLeft}` : battleTimeLeft}
          </div>
        </div>

        {/* Action Controls */}
        <div className="battle-controls-row">
          {!battleActive ? (
            <button className="arena-btn start-btn" onClick={onStartBattle}>
              <span>▶</span> START BATTLE
            </button>
          ) : (
            <button className="arena-btn pause-btn" onClick={onPauseBattle}>
              <span>⏸</span> PAUSE
            </button>
          )}
          <button className="arena-btn reset-btn" onClick={onResetBattle}>
            <span>↺</span> RESET
          </button>
        </div>

        {/* Live Score Comparison Bars */}
        <div className="battle-scores-container">
          {participants.length < 2 ? (
            <div className="arena-waiting-notice">
              ⚠️ Minimum 2 participants required for competition duels.
            </div>
          ) : (
            participants.slice(0, 4).map((p) => {
              const pid = p.id || p.key;
              const score = (battleScores[p.id] !== undefined) ? battleScores[p.id] : (battleScores[p.key] || 0);
              return (
                <div key={pid} className="battle-participant-bar">
                  <div className="bar-info-row">
                    <span style={{ color: p.color || "#00f2fe", fontWeight: 700 }}>
                      {p.name || pid}
                    </span>
                    <span className="bar-score-number" style={{ color: p.color || "#00f2fe" }}>
                      {score} BLINKS
                    </span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${Math.min(100, score * 5)}%`,
                        backgroundColor: p.color || "#00f2fe"
                      }}
                    ></div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Winner Announcement Banner */}
        {battleWinner && (
          <div className="winner-announcement-banner">
            <span className="winner-crown">👑</span>
            <div className="winner-text">
              <span className="winner-title">ROUND CONCLUDED!</span>
              <span className="winner-name">{battleWinner} VICTORIOUS!</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
