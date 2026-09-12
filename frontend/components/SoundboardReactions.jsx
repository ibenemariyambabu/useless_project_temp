import React, { useState } from "react";

export default function SoundboardReactions({
  onTriggerCombo,
  recentGesture = ""
}) {
  const [lastTriggered, setLastTriggered] = useState(null);

  const COMBOS = [
    { id: "TRIPLE_BLINK", title: "SUPERNOVA BURST", emoji: "🔥", keySeq: "BLINK x3 (Rapid)", bonus: "+50 XP" },
    { id: "DOUBLE_WINK_LEFT", title: "CYAN LIGHTNING", emoji: "⚡", keySeq: "LEFT WINK x2", bonus: "+30 XP" },
    { id: "DOUBLE_WINK_RIGHT", title: "PLASMA EXPLOSION", emoji: "💥", keySeq: "RIGHT WINK x2", bonus: "+30 XP" },
    { id: "WINK_ALTERNATE", title: "HYPERDRIVE WARP", emoji: "🚀", keySeq: "LEFT ➔ RIGHT WINK", bonus: "+40 XP" },
    { id: "BLINK_WINK_COMBO", title: "CYBER MATRIX", emoji: "👁️", keySeq: "BLINK ➔ WINK", bonus: "+25 XP" }
  ];

  const handleCardClick = (combo) => {
    setLastTriggered(combo.id);
    setTimeout(() => setLastTriggered(null), 1000);
    if (onTriggerCombo) {
      onTriggerCombo(combo);
    }
  };

  return (
    <section className="soundboard-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">🔊</span>
          <h2 className="panel-title">GESTURE COMBO SOUNDBOARD & REACTIONS</h2>
        </div>
        <span className="stat-pill text-cyan">WEBSOCKET BROADCAST</span>
      </div>

      <div className="soundboard-buffer-row">
        <span className="buffer-label">GESTURE STREAM:</span>
        <div className="buffer-display font-mono">
          {recentGesture || "[AWAITING OPTICAL GESTURE COMBOS]"}
        </div>
      </div>

      <div className="combos-grid">
        {COMBOS.map(c => (
          <button
            key={c.id}
            className={`combo-card-btn ${lastTriggered === c.id ? "active-flash" : ""}`}
            onClick={() => handleCardClick(c)}
          >
            <div className="combo-card-header">
              <span className="combo-emoji">{c.emoji}</span>
              <span className="combo-title">{c.title}</span>
            </div>
            <div className="combo-keyseq font-mono">{c.keySeq}</div>
            <div className="combo-bonus">{c.bonus}</div>
          </button>
        ))}
      </div>
    </section>
  );
}
