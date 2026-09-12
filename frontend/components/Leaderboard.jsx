import React from "react";

export default function Leaderboard({ entries = [] }) {
  // Compute highlights
  let topBlinker = null;
  let topRate = null;
  let topStreak = null;

  if (entries.length > 0) {
    topBlinker = [...entries].sort((a, b) => (b.total_blinks || b.blinkCount || 0) - (a.total_blinks || a.blinkCount || 0))[0];
    topRate = [...entries].sort((a, b) => (b.blink_rate || b.blinkRate || 0) - (a.blink_rate || a.blinkRate || 0))[0];
    topStreak = [...entries].sort((a, b) => (b.longest_streak || b.longestStreak || 0) - (a.longest_streak || a.longestStreak || 0))[0];
  }

  const getRankBadge = (rank) => {
    if (rank === 1) return <span className="rank-badge gold">1st 🥇</span>;
    if (rank === 2) return <span className="rank-badge silver">2nd 🥈</span>;
    if (rank === 3) return <span className="rank-badge bronze">3rd 🥉</span>;
    return <span className="rank-badge normal">{rank}th</span>;
  };

  return (
    <section className="leaderboard-section">
      <div className="section-title-row">
        <div className="title-group">
          <span className="section-icon">🏆</span>
          <h2 className="section-title">REAL-TIME RANKINGS & HIGHLIGHTS</h2>
        </div>
        <div className="live-sync-indicator">
          <span className="sync-dot"></span>
          <span>LIVE BACKEND SYNC</span>
        </div>
      </div>

      {/* Highlights Grid */}
      <div className="highlights-grid">
        <div className="highlight-card">
          <span className="highlight-icon">👑</span>
          <div className="highlight-info">
            <span className="highlight-label">LEADING BLINKER</span>
            <span className="highlight-value">
              {topBlinker ? `${topBlinker.participant_name || topBlinker.name || topBlinker.participant_key} (${topBlinker.total_blinks || topBlinker.blinkCount} blinks)` : "Awaiting Data"}
            </span>
          </div>
        </div>

        <div className="highlight-card">
          <span className="highlight-icon">⚡</span>
          <div className="highlight-info">
            <span className="highlight-label">HIGHEST CADENCE</span>
            <span className="highlight-value">
              {topRate ? `${topRate.participant_name || topRate.name} (${(topRate.blink_rate || topRate.blinkRate || 0).toFixed(1)} BPM)` : "Awaiting Data"}
            </span>
          </div>
        </div>

        <div className="highlight-card">
          <span className="highlight-icon">🗿</span>
          <div className="highlight-info">
            <span className="highlight-label">LONGEST STARE</span>
            <span className="highlight-value">
              {topStreak ? `${topStreak.participant_name || topStreak.name} (${Math.floor(topStreak.longest_streak || topStreak.longestStreak || 0)}s)` : "Awaiting Data"}
            </span>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>RANK</th>
              <th>PARTICIPANT</th>
              <th>TOTAL BLINKS</th>
              <th>CADENCE (BPM)</th>
              <th>LONGEST STARE</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan="5" className="empty-table-cell">
                  No participant data recorded yet. Initialize optical feed to populate rankings.
                </td>
              </tr>
            ) : (
              entries.map((entry, idx) => {
                const rank = entry.rank || idx + 1;
                const name = entry.participant_name || entry.name || entry.participant_key;
                const blinks = entry.total_blinks !== undefined ? entry.total_blinks : entry.blinkCount;
                const rate = entry.blink_rate !== undefined ? entry.blink_rate : entry.blinkRate;
                const streak = entry.longest_streak !== undefined ? entry.longest_streak : entry.longestStreak;

                return (
                  <tr key={entry.id || idx}>
                    <td>{getRankBadge(rank)}</td>
                    <td>
                      <div className="table-participant-cell">
                        <span
                          className="table-color-dot"
                          style={{ backgroundColor: entry.color || "#00f2fe" }}
                        ></span>
                        <span className="table-participant-name" style={{ color: entry.color || "#00f2fe" }}>
                          {name}
                        </span>
                      </div>
                    </td>
                    <td className="table-bold-num">{blinks}</td>
                    <td>{(rate || 0).toFixed(1)}</td>
                    <td>{Math.floor(streak || 0)}s</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
