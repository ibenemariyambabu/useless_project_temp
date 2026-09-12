import React from "react";

export default function Header({
  peopleDetected = 0,
  mode = "IDLE MODE",
  soundEnabled = false,
  debugEnabled = false,
  onToggleSound,
  onToggleDebug,
  onOpenFeatures,
  onOpenHistory,
  onOpenAchievements,
  onOpenReport
}) {
  return (
    <header className="sys-header">
      <div className="header-left">
        <div className="logo-lockup">
          <span className="logo-symbol">◉</span>
          <div className="logo-text">
            <span className="brand-title">BLINKOS</span>
            <span className="brand-sub">v2.0 • PRODUCTION FULL-STACK</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        {/* Human Presence Monitor */}
        <div className="presence-badge" title="Number of uniquely tracked human faces in view">
          <span className="presence-icon">👤</span>
          <span>PEOPLE DETECTED: {peopleDetected}</span>
        </div>

        {/* Mode Indicator */}
        <div className="mode-badge">
          <span className="mode-pip"></span>
          <span>{mode}</span>
        </div>

        {/* Local Privacy Pill */}
        <div className="privacy-badge" title="Optical landmarks processed strictly in your local browser runtime. Zero video leaves your device.">
          <span className="privacy-lock">🔒</span>
          <span>PROCESSING LOCALLY</span>
        </div>
      </div>

      <div className="header-right">
        {/* Feature Discovery */}
        <button className="sys-btn" onClick={onOpenFeatures} title="View BlinkOS Features Guide">
          <span>📖</span>
          <span>FEATURES</span>
        </button>

        {/* Session History */}
        <button className="sys-btn" onClick={onOpenHistory} title="View Detailed Blink History">
          <span>📋</span>
          <span>HISTORY</span>
        </button>

        {/* Achievements */}
        <button className="sys-btn" onClick={onOpenAchievements} title="View Unlocked Achievements">
          <span>🏆</span>
          <span>BADGES</span>
        </button>

        {/* Debug HUD Toggle */}
        <button className="sys-btn" onClick={onToggleDebug} title="Toggle Developer Computer-Vision HUD Overlay">
          <span>⚙️</span>
          <span>{debugEnabled ? "DEBUG: ON" : "DEBUG: OFF"}</span>
        </button>

        {/* Sound Toggle */}
        <button className="sys-btn icon-btn" onClick={onToggleSound} title="Toggle Synthesized Audio Feedback">
          <span>{soundEnabled ? "🔊" : "🔇"}</span>
          <span>{soundEnabled ? "SOUND: ON" : "SOUND: OFF"}</span>
        </button>

        {/* End Session Report */}
        <button className="sys-btn danger-btn" onClick={onOpenReport} title="End Session & Generate Summary Report">
          <span>📊</span>
          <span>REPORT</span>
        </button>
      </div>
    </header>
  );
}
