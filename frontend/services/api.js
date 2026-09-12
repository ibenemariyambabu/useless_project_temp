/**
 * BlinkOS Frontend API Service
 * Handles REST communication and real-time WebSocket connection to FastAPI backend
 */

const getApiBase = () => {
  if (typeof window !== "undefined") {
    // If running inside Next.js or with proxy
    return window.location.origin.includes(":3000")
      ? "/api"
      : "http://localhost:8000/api";
  }
  return "http://localhost:8000/api";
};

const getWsBase = (sessionId) => {
  if (typeof window !== "undefined") {
    const isHttps = window.location.protocol === "https:";
    const wsProto = isHttps ? "wss:" : "ws:";
    const host = window.location.origin.includes(":3000")
      ? window.location.host
      : "localhost:8000";
    return `${wsProto}//${host}/ws/session/${sessionId}`;
  }
  return `ws://localhost:8000/ws/session/${sessionId}`;
};

export const api = {
  async createSession(mode = "standard") {
    try {
      const res = await fetch(`${getApiBase()}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode })
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to create session on backend:", err);
      return { id: "local-session-" + Date.now(), session_code: "LOCAL" };
    }
  },

  async registerParticipant(sessionId, participantData) {
    try {
      const res = await fetch(`${getApiBase()}/sessions/${sessionId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(participantData)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to register participant:", err);
      return null;
    }
  },

  async recordBlink(blinkPayload) {
    try {
      const res = await fetch(`${getApiBase()}/blinks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(blinkPayload)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to record blink on backend:", err);
      return null;
    }
  },

  async fetchLeaderboard(sessionId) {
    try {
      const url = sessionId 
        ? `${getApiBase()}/leaderboard/session/${sessionId}`
        : `${getApiBase()}/leaderboard`;
      const res = await fetch(url);
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to fetch leaderboard:", err);
      return [];
    }
  },

  async fetchAchievements() {
    try {
      const res = await fetch(`${getApiBase()}/achievements`);
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to fetch achievements:", err);
      return [];
    }
  },

  async unlockAchievement(achievementData) {
    try {
      const res = await fetch(`${getApiBase()}/achievements/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(achievementData)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to unlock achievement:", err);
      return null;
    }
  },

  async triggerBattleAction(sessionId, action, duration = 30, scores = {}, winner = null) {
    try {
      const res = await fetch(`${getApiBase()}/battle/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          action,
          duration,
          scores,
          winner
        })
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to trigger battle action:", err);
      return null;
    }
  },

  async endSession(sessionId) {
    try {
      const res = await fetch(`${getApiBase()}/sessions/${sessionId}/end`, {
        method: "POST"
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to end session:", err);
      return null;
    }
  },

  async submitMinigameScore(scorePayload) {
    try {
      const res = await fetch(`${getApiBase()}/minigames/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scorePayload)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to submit score:", err);
      return null;
    }
  },

  async fetchMinigameScores(gameType = "rhythm") {
    try {
      const res = await fetch(`${getApiBase()}/minigames/scores/${gameType}`);
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to fetch high scores:", err);
      return [];
    }
  },

  async fetchPetState(sessionId) {
    try {
      const res = await fetch(`${getApiBase()}/pet/${sessionId}`);
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to fetch pet state:", err);
      return null;
    }
  },

  async updatePetState(sessionId, petData) {
    try {
      const res = await fetch(`${getApiBase()}/pet/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(petData)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to update pet state:", err);
      return null;
    }
  },

  async triggerReaction(reactionPayload) {
    try {
      const res = await fetch(`${getApiBase()}/reactions/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reactionPayload)
      });
      return await res.json();
    } catch (err) {
      console.warn("[BlinkOS API] Failed to trigger reaction:", err);
      return null;
    }
  }
};

/**
 * Reconnecting WebSocket Client for real-time room communication
 */
export class BlinkWebSocketClient {
  constructor(sessionId, onMessageCallback) {
    this.sessionId = sessionId;
    this.onMessageCallback = onMessageCallback;
    this.ws = null;
    this.reconnectTimer = null;
    this.pingInterval = null;
    this.isDestroyed = false;
    this.connect();
  }

  connect() {
    if (typeof window === "undefined" || this.isDestroyed) return;

    try {
      const url = getWsBase(this.sessionId);
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log(`[BlinkWS] Connected to session room: ${this.sessionId}`);
        this.startPing();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (this.onMessageCallback) {
            this.onMessageCallback(data);
          }
        } catch (e) {
          console.error("[BlinkWS] Parse error:", e);
        }
      };

      this.ws.onclose = () => {
        this.stopPing();
        if (!this.isDestroyed) {
          this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("[BlinkWS] Error:", err);
        this.ws.close();
      };
    } catch (e) {
      console.warn("[BlinkWS] Init error:", e);
    }
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  sendComboReaction(comboData) {
    this.send({
      type: "COMBO_REACTION",
      ...comboData,
      timestamp: Date.now()
    });
  }

  sendRhythmScore(scoreData) {
    this.send({
      type: "RHYTHM_SCORE_UPDATE",
      ...scoreData
    });
  }

  sendPetUpdate(petData) {
    this.send({
      type: "PET_UPDATE",
      pet: petData
    });
  }

  sendComboStreak(streakData) {
    this.send({
      type: "COMBO_STREAK",
      streak_data: streakData
    });
  }

  startPing() {
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.send({ type: "PING", timestamp: Date.now() });
    }, 15000);
  }

  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  destroy() {
    this.isDestroyed = true;
    this.stopPing();
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
