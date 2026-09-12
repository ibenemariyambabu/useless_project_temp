import React, { useState, useEffect } from "react";

export default function NeoPet({
  petState = {},
  liveBpm = 15,
  onFeed,
  onHydrate
}) {
  const [pet, setPet] = useState({
    name: "CYBER-LUMEN",
    stage: "CYBER-EGG",
    level: 1,
    health: 100,
    energy: 100,
    happiness: 100,
    xp: 0,
    blinksFed: 0,
    ...petState
  });

  const [eyeHeight, setEyeHeight] = useState(6);

  useEffect(() => {
    if (petState && petState.pet_name) {
      setPet(prev => ({
        ...prev,
        name: petState.pet_name,
        stage: petState.evolution_stage || prev.stage,
        level: petState.level || prev.level,
        health: petState.health !== undefined ? petState.health : prev.health,
        energy: petState.energy !== undefined ? petState.energy : prev.energy,
        happiness: petState.happiness !== undefined ? petState.happiness : prev.happiness,
        xp: petState.xp !== undefined ? petState.xp : prev.xp
      }));
    }
  }, [petState]);

  const blinkPetEyes = () => {
    setEyeHeight(1);
    setTimeout(() => setEyeHeight(6), 160);
  };

  const handleManualFeed = () => {
    blinkPetEyes();
    setPet(prev => ({
      ...prev,
      happiness: Math.min(100, prev.happiness + 15),
      energy: Math.min(100, prev.energy + 10),
      xp: prev.xp + 15
    }));
    if (onFeed) onFeed();
  };

  const handleManualHydrate = () => {
    blinkPetEyes();
    setPet(prev => ({
      ...prev,
      health: Math.min(100, prev.health + 20),
      energy: Math.min(100, prev.energy + 8)
    }));
    if (onHydrate) onHydrate();
  };

  // Evolution boundaries
  let stageMax = 100;
  let stageMin = 0;
  if (pet.stage === "NEON SPRITE") { stageMin = 100; stageMax = 300; }
  else if (pet.stage === "MECHA-FOX") { stageMin = 300; stageMax = 700; }
  else if (pet.stage === "QUANTUM DRAGON") { stageMin = 700; stageMax = 1500; }

  const xpPct = Math.min(100, Math.round(((pet.xp - stageMin) / Math.max(1, stageMax - stageMin)) * 100));

  let bpmStatus = "RATE: BALANCED (RELAXED)";
  let mouthD = "M 70 100 Q 80 112 90 100";
  if (liveBpm >= 12 && liveBpm <= 24) {
    bpmStatus = `RATE: ${liveBpm.toFixed(1)} BPM (IDEAL ZONE — THRIVING ✨)`;
    mouthD = "M 70 98 Q 80 114 90 98";
  } else if (liveBpm > 26) {
    bpmStatus = `RATE: ${liveBpm.toFixed(1)} BPM (OVERCLOCKED / JITTERY ⚡)`;
    mouthD = "M 72 105 Q 80 99 88 105";
  } else if (liveBpm < 6) {
    bpmStatus = `RATE: ${liveBpm.toFixed(1)} BPM (RETINA STRAIN / DROOPY 💤)`;
    mouthD = "M 72 105 L 88 105";
  }

  return (
    <section className="pet-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">👾</span>
          <h2 className="panel-title">NEO-PET: BIOMETRIC CYBER-FAMILIAR</h2>
        </div>
        <span className="stat-pill text-emerald">TIER: {pet.stage}</span>
      </div>

      <div className="pet-container">
        <div className="pet-avatar-wrapper">
          <svg className="pet-svg" viewBox="0 0 160 160" width="160" height="160">
            <defs>
              <radialGradient id="petGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#00FF9D" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#00f2fe" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#060912" stopOpacity="0" />
              </radialGradient>
              <filter id="petGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="glow" />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Ambient Aura */}
            <circle cx="80" cy="80" r="55" fill="url(#petGrad)" filter="url(#petGlow)" />

            {/* Pet Body */}
            <circle cx="80" cy="80" r="46" fill="#0d1424" stroke="#00f2fe" strokeWidth="2.5" />

            {/* Left Eye */}
            <ellipse cx="66" cy="74" rx="5" ry={eyeHeight} fill="#00FF9D" />

            {/* Right Eye */}
            <ellipse cx="94" cy="74" rx="5" ry={eyeHeight} fill="#00FF9D" />

            {/* Mouth */}
            <path d={mouthD} fill="none" stroke="#FFE600" strokeWidth="2.5" strokeLinecap="round" />

            {/* Antenna Orb */}
            <line x1="80" y1="34" x2="80" y2="20" stroke="#00f2fe" strokeWidth="2" />
            <circle cx="80" cy="18" r="4" fill="#FF007F" filter="url(#petGlow)" />
          </svg>

          <div className="pet-telemetry-badge">
            <span>LVL {pet.level}</span> • <span>{pet.name}</span>
          </div>
        </div>

        <div className="pet-vitals-column">
          <div className="pet-vital-row">
            <span className="vital-label">HEALTH</span>
            <div className="vital-track">
              <div className="vital-fill vital-health" style={{ width: `${pet.health}%` }} />
            </div>
            <span className="vital-val text-emerald">{Math.round(pet.health)}%</span>
          </div>

          <div className="pet-vital-row">
            <span className="vital-label">ENERGY</span>
            <div className="vital-track">
              <div className="vital-fill vital-energy" style={{ width: `${pet.energy}%` }} />
            </div>
            <span className="vital-val text-cyan">{Math.round(pet.energy)}%</span>
          </div>

          <div className="pet-vital-row">
            <span className="vital-label">HAPPINESS</span>
            <div className="vital-track">
              <div className="vital-fill vital-happy" style={{ width: `${pet.happiness}%` }} />
            </div>
            <span className="vital-val text-yellow">{Math.round(pet.happiness)}%</span>
          </div>

          <div className="pet-vital-row">
            <span className="vital-label">XP (EVO)</span>
            <div className="vital-track">
              <div className="vital-fill vital-xp" style={{ width: `${xpPct}%` }} />
            </div>
            <span className="vital-val text-magenta">{pet.xp} XP</span>
          </div>

          <div className="pet-status-readout font-mono">
            {bpmStatus}
          </div>

          <div className="pet-actions-row">
            <button className="primary-btn mini-p-btn" onClick={handleManualFeed}>
              🍜 NOURISH (+XP)
            </button>
            <button className="secondary-btn mini-p-btn" onClick={handleManualHydrate}>
              💧 OCULAR MIST
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
