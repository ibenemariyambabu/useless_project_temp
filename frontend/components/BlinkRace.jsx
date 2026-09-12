import React from "react";

export default function BlinkRace({
  raceState = "IDLE", // "IDLE", "COUNTDOWN", "WAITING_BLINK", "FINISHED"
  countdownNumber = 3,
  raceWinner = null,
  reactionTimeMs = null,
  onStartRace,
  onResetRace
}) {
  return (
    <section className="race-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">🏁</span>
          <h2 className="panel-title">QUICK-DRAW BLINK RACE</h2>
        </div>
        <span className="stat-pill">REFLEX TEST</span>
      </div>

      <div className="race-body">
        {raceState === "IDLE" && (
          <div className="race-idle-prompt">
            <p className="race-desc">
              First participant to blink after the green "BLINK NOW!" cue wins the reflex duel.
            </p>
            <button className="arena-btn race-start-btn" onClick={onStartRace}>
              <span>⚡</span> INITIATE REFLEX DUEL
            </button>
          </div>
        )}

        {raceState === "COUNTDOWN" && (
          <div className="race-countdown-wrapper">
            <div className="race-countdown-number">{countdownNumber}</div>
            <div className="race-countdown-sub">HOLD YOUR GAZE... DO NOT BLINK!</div>
          </div>
        )}

        {raceState === "WAITING_BLINK" && (
          <div className="race-go-wrapper">
            <div className="race-go-signal">BLINK NOW!</div>
            <div className="race-go-sub">RECORDING OPTICAL REFLEX SPEEDS...</div>
          </div>
        )}

        {raceState === "FINISHED" && (
          <div className="race-result-wrapper">
            <div className="race-winner-crown">🏆</div>
            <div className="race-winner-title">{raceWinner} WON THE DUEL!</div>
            {reactionTimeMs && (
              <div className="race-reaction-badge">
                REACTION TIME: <strong>{reactionTimeMs} ms</strong>
              </div>
            )}
            <button className="arena-btn reset-btn mt-4" onClick={onResetRace}>
              <span>↺</span> REMATCH
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
