import React from "react";

export default function CameraHUD({
  videoRef,
  canvasRef,
  oscCanvasRef,
  isRunning,
  fps = 0,
  resolution = "1280x720",
  onStartCamera,
  onStopCamera,
  debugEnabled = false
}) {
  return (
    <section className="viewport-panel" aria-label="Webcam Optical Viewport">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">🎥</span>
          <h2 className="panel-title">OPTICAL NEURAL FEED</h2>
        </div>
        <div className="panel-status-indicators">
          <span className="stat-pill" title="Live Video Capture Resolution">
            {resolution}
          </span>
          <span className="stat-pill" title="Inference Frame Frequency">
            {fps} FPS
          </span>
          <span className={`status-dot ${isRunning ? "active" : ""}`}></span>
        </div>
      </div>

      <div className="video-viewport-wrapper">
        <video
          ref={videoRef}
          id="webcam-feed"
          className="webcam-video"
          playsInline
          muted
          autoPlay
          aria-label="Live Camera Stream"
        />

        <canvas
          ref={canvasRef}
          id="overlay-canvas"
          className="overlay-canvas"
          aria-label="Computer-Vision Graphic Overlay"
        />

        {/* Edge-Anchored Viewport Blink Tag (Bottom-Right Margin) */}
        <div id="viewport-blink-tag" className="viewport-blink-tag">
          ⚡ BLINK CONFIRMED
        </div>

        {/* Edge-Anchored Arcade Announcer Banner (Top-Right Margin) */}
        <div id="arcade-announcer-banner" className="arcade-announcer-banner hidden" aria-live="polite">
          <div className="banner-pill" id="arcade-banner-pill">
            <span className="banner-multiplier" id="arcade-banner-multiplier">2X</span>
            <div className="banner-text-group">
              <span className="banner-title" id="arcade-banner-title">DOUBLE BLINK!</span>
              <span className="banner-callout" id="arcade-banner-callout">DOUBLE KILL!</span>
            </div>
          </div>
        </div>

        {/* Camera Standby / Prompt Overlay */}
        {!isRunning && (
          <div className="camera-standby-overlay">
            <div className="standby-content">
              <div className="standby-radar">
                <div className="radar-sweep"></div>
                <span className="standby-icon">👁️</span>
              </div>
              <h3 className="standby-title">OPTICAL SYSTEM STANDBY</h3>
              <p className="standby-desc">
                High-precision 478-point MediaPipe face landmarker and multi-person tracking engine ready.
              </p>
              <button
                id="start-camera-btn"
                className="action-btn primary-pulse"
                onClick={onStartCamera}
              >
                <span>🚀</span>
                <span>INITIALIZE OPTICAL SYSTEM</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Oscilloscope Mini-Bar */}
      <div className="oscilloscope-container" title="Real-Time Eye Aspect Ratio (EAR) Waveform">
        <div className="osc-header">
          <span>OCULAR OSCILLOSCOPE (LIVE EAR WAVEFORM)</span>
          <span className="osc-tag">400ms WINDOW</span>
        </div>
        <canvas
          ref={oscCanvasRef}
          id="oscilloscope-canvas"
          className="oscilloscope-canvas"
          width="640"
          height="50"
        />
      </div>
    </section>
  );
}
