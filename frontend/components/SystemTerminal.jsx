import React, { useEffect, useRef } from "react";

export default function SystemTerminal({ logs = [] }) {
  const terminalEndRef = useRef(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  return (
    <section className="terminal-panel">
      <div className="panel-header">
        <div className="panel-title-lockup">
          <span className="panel-icon">💻</span>
          <h2 className="panel-title">SYSTEM EVENT LOG & WEBSOCKET CONSOLE</h2>
        </div>
        <span className="stat-pill">AUTO-STREAMING</span>
      </div>

      <div className="terminal-body">
        <div className="terminal-output">
          {logs.map((log, index) => (
            <div key={index} className={`terminal-line ${log.type || "info"}`}>
              <span className="log-time">[{log.time}]</span>{" "}
              <span className="log-prefix">&gt;</span>{" "}
              <span className="log-text">{log.text}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </section>
  );
}
