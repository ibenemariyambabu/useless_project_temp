<img width="1280" height="640" alt="git (1)" src="https://github.com/user-attachments/assets/8920b256-2ba8-4988-b824-5351134eb4bd" />

# BlinkOS 👁️🎯

## Basic Details
### Team Name: BlinkForce

### Team Members
- Team Lead: Ibene Mariyam Babu - Lead Developer

### Project Description
BlinkOS is a production-ready, full-stack computer-vision operating system and multiplayer arcade platform where involuntary and voluntary human eye blinks/winks act as the primary input controllers.

### The Problem (that doesn't exist)
Using your hands, mice, touchscreens, or keyboards to interact with computers requires unnecessary physical effort, manual dexterity, and repetitive finger movements. In a world full of hands-free technology, why should humans have to lift a finger to play rhythm games, battle peers in arcade arenas, or nourish virtual cyber-pets when our eyes are already blinking 15 to 20 times every single minute?

### The Solution (that nobody asked for)
BlinkOS completely eliminates traditional human-computer interfaces by turning your eyelids into high-precision input devices. Using an on-device MediaPipe 478-point facial mesh, a rotation-invariant Euclidean Eye Aspect Ratio (EAR) pipeline, a zero-lag falling-edge state machine with 400ms hardened refractory lockouts, and a real-time Python FastAPI + WebSocket multiplayer synchronization engine, BlinkOS transforms ordinary biological blinks into high-stakes gaming actions, competitive leaderboard rankings, soundboard reactions, and digital pet nourishment.

## Technical Details
### Technologies/Components Used
For Software:
- **Languages**: Python 3.10+, JavaScript (ES6+), HTML5, CSS3
- **Frameworks**: FastAPI, Next.js 14 / React 18, Uvicorn
- **Libraries**: MediaPipe Face Mesh, Web Audio API, HTML5 Canvas API, SQLAlchemy ORM, WebSockets
- **Tools**: Docker Compose, Git, PostgreSQL 16, Chrome DevTools

![BlinkOS Full-Stack](https://img.shields.io/badge/BlinkOS-Full--Stack%20v2.0-00f2fe?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Frontend-Next.js%2014%20%2F%20React%2018-black?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Deploy-Vercel%20Ready-black?style=for-the-badge&logo=vercel)
![FastAPI](https://img.shields.io/badge/Backend-Python%20FastAPI-009688?style=for-the-badge)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-336791?style=for-the-badge)
![Docker Compose](https://img.shields.io/badge/Orchestration-Docker%20Compose-2496ED?style=for-the-badge)
![Zero Hardware](https://img.shields.io/badge/Hardware-100%25%20Zero%20Hardware-emerald?style=for-the-badge)
![Strict Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side%20CV-blue?style=for-the-badge)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fibenemariyambabu%2Fuseless_project_temp&root-directory=frontend&env=BACKEND_URL,NEXT_PUBLIC_WS_URL&envDescription=Optional%20backend%20and%20WebSocket%20URLs%20for%20live%20multiplayer)

---

## 1. System Architecture Overview

BlinkOS is an end-to-end full-stack platform combining real-time browser computer vision with an asynchronous Python backend and relational database persistence:

```text
                                 BROWSER CLIENT
┌─────────────────────────────────────────────────────────────────────────────┐
│  React / Next.js Frontend (/frontend)                                       │
│                                                                             │
│  Webcam ──► MediaPipe Tasks Vision (WASM/SIMD, numFaces: 4)                │
│                 │                                                           │
│                 ▼                                                           │
│            Spatial FaceTracker (0.65 Centroid + 0.35 IoU)                   │
│                 │                                                           │
│                 ▼                                                           │
│            CalibrationEngine (2.0s Median Baseline EAR)                     │
│                 │                                                           │
│                 ▼                                                           │
│            BlinkDetector (4-State Machine: OPEN->CLOSING->CLOSED->OPENING)  │
│                 │                                                           │
│                 ▼                                                           │
│            Authoritative BlinkEvent Dispatched                              │
│            ├── Canvas HUD & Live EAR Oscilloscope Graph                     │
│            ├── Local Audio Synthesizer & Cyberpunk Dashboard UI             │
│            └── WebSocket Client (Reconnecting WebSocket)                   │
└───────────────────────┬───────────────────────────────▲─────────────────────┘
                        │                               │
                        │ JSON BlinkEvent               │ Live Leaderboard &
                        │ & Session Actions             │ Multiplayer Sync
                        ▼                               │
┌───────────────────────────────────────────────────────┴─────────────────────┐
│  FastAPI Backend (/backend)                                                 │
│                                                                             │
│  ├── WebSocket Connection Manager (/ws/session/{session_id})                │
│  │     └── Broadcasts blinks, battle ticks, and real-time rank updates     │
│  │                                                                          │
│  ├── REST API Endpoints:                                                    │
│  │     ├── POST /api/sessions           (Create session)                    │
│  │     ├── GET  /api/sessions/{id}      (Fetch state & analytics)           │
│  │     ├── POST /api/sessions/{id}/end  (Conclude session report)           │
│  │     ├── POST /api/blinks             (Ingest validated BlinkEvent)       │
│  │     ├── GET  /api/leaderboard        (All-time & session rankings)       │
│  │     └── GET  /api/achievements       (User unlocked achievements)        │
│  │                                                                          │
│  └── SQLAlchemy ORM Layer (Async/Sync Engine)                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  PostgreSQL 16 Database (/docker-compose db service)                        │
│                                                                             │
│  Tables:                                                                    │
│  ├── users              (id, username, created_at)                          │
│  ├── sessions           (id, session_code, mode, duration, total_blinks)   │
│  ├── participants       (id, session_id, participant_key, name, color, BPM)│
│  ├── blink_events       (id, session_id, duration_ms, ear_drop, confidence) │
│  ├── leaderboards       (id, participant_name, total_blinks, rank)          │
│  └── achievements       (id, user_id, achievement_key, unlocked_at)        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Project Directory Structure

```text
BlinkOS/
├── frontend/
│   ├── app/
│   │   ├── globals.css         # Cyberpunk dark visual theme & tokens
│   │   ├── layout.jsx          # HTML shell, fonts, MediaPipe CDN script
│   │   ├── page.jsx            # Next.js master dashboard orchestrator
│   │   ├── index.html          # Standalone prototype HTML entrypoint
│   │   └── script.js           # Standalone prototype JS orchestrator
│   ├── components/
│   │   ├── Header.jsx          # Top system status, mode, sound & debug toggles
│   │   ├── CameraHUD.jsx       # Video feed, canvas overlay, EAR oscilloscope
│   │   ├── ParticipantCards.jsx# Real-time multi-person metrics & status pills
│   │   ├── Leaderboard.jsx     # Live rankings & highlight awards
│   │   ├── BattleArena.jsx     # 30s/60s/90s round timer & live duel bars
│   │   ├── BlinkRace.jsx       # 3-2-1 countdown reflex duel
│   │   ├── ActivityChart.jsx   # Rolling 60s multi-participant canvas timeline
│   │   ├── SystemTerminal.jsx  # Monospace scrolling event console
│   │   └── Modals.jsx          # Features, History, Badges & Session Reports
│   ├── cv/
│   │   ├── vision.js           # MediaPipe loader, EAR, 3D head pose, quality
│   │   ├── faceTracker.js      # Spatial tracking (Centroid + IoU overlap)
│   │   ├── calibration.js      # 2.0s median baseline calibration engine
│   │   ├── blinkDetector.js    # 4-state temporal machine & confidence filter
│   │   └── renderer.js         # Canvas graphics, reticles, oscilloscope
│   ├── lib/
│   │   └── config.js           # Central config constants & color palettes
│   ├── services/
│   │   └── api.js              # REST client & reconnecting WebSocket manager
│   ├── styles/
│   │   └── style.css           # Preserved core stylesheet
│   ├── next.config.js          # Next.js proxy rewrites to FastAPI backend
│   ├── package.json            # Next.js & React dependencies
│   └── Dockerfile              # Multi-stage production container
│
├── backend/
│   ├── app/
│   │   ├── config.py           # Database URL, CORS, host/port settings
│   │   ├── database.py         # SQLAlchemy engine & sessionmaker (PostgreSQL + SQLite fallback)
│   │   ├── models.py           # Relational schema (Users, Sessions, Blinks, etc.)
│   │   ├── schemas.py          # Pydantic validation models
│   │   ├── websocket.py        # ConnectionManager for multi-client room sync
│   │   ├── routers/
│   │   │   ├── sessions.py     # Session creation, registration, and report
│   │   │   ├── blinks.py       # BlinkEvent ingestion and WebSocket broadcast
│   │   │   ├── leaderboard.py  # Global and session ranking queries
│   │   │   ├── achievements.py # Achievement catalog and unlock triggers
│   │   │   └── battle.py       # Multiplayer battle synchronization
│   │   └── main.py             # FastAPI entrypoint, CORS, and health check
│   ├── requirements.txt        # Python backend dependencies
│   └── Dockerfile              # Python 3.11 container
│
├── docker-compose.yml          # Multi-container orchestration (PostgreSQL + FastAPI + Next.js)
└── README.md                   # System documentation
```

---

## 3. Strict Privacy & Local Inference Guarantee

> [!IMPORTANT]
> **Zero Raw Webcam Video Transmitted**:
> - All optical inference (MediaPipe 478 face mesh landmarks, 6-point Euclidean EAR distance calculations, 3D head pose estimation, and ocular baseline calibration) executes **100% inside your browser runtime**.
> - **Zero video frames, face crops, or camera streams** are transmitted across the network or stored in the database.
> - The backend and PostgreSQL database exclusively ingest **anonymized numerical event metadata**:
>   - `duration_ms` (e.g., `145.0`)
>   - `ear_drop` (e.g., `0.12`)
>   - `confidence` (e.g., `0.98`)
>   - `head_pose_yaw` / `head_pose_pitch` (e.g., `1.5`, `-2.0`)
>   - `timestamp` (e.g., `1726080000000`)
>   - `participant_key` (e.g., `"PERSON 1"`)

---

## 4. REST API & WebSocket Specifications

### REST Endpoints (`/api`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status, database engine, active rooms |
| `POST` | `/api/sessions` | Create a new session (standard, battle, or race) |
| `GET` | `/api/sessions/{session_id}` | Retrieve session details, participants, and stats |
| `POST` | `/api/sessions/{session_id}/participants` | Register or update participant in session |
| `POST` | `/api/sessions/{session_id}/end` | Conclude session, compute stats, and generate report |
| `POST` | `/api/blinks` | Ingest validated BlinkEvent, update BPM/streak, broadcast |
| `GET` | `/api/blinks/{session_id}` | Fetch recent blink event history for session |
| `GET` | `/api/leaderboard` | Retrieve global all-time top blinkers |
| `GET` | `/api/leaderboard/session/{session_id}` | Retrieve live session rankings |
| `GET` | `/api/achievements` | Master achievements catalog |
| `GET` | `/api/achievements/session/{session_id}` | Unlocked achievements in session |
| `POST` | `/api/achievements/unlock` | Record an achievement unlock and broadcast |
| `POST` | `/api/battle/action` | Broadcast battle round timer, pause, or reset |

### WebSocket Protocol (`/ws/session/{session_id}`)

Clients subscribe to `/ws/session/{session_id}` to receive real-time room broadcasts:

```json
// Incoming Blink Broadcast
{
  "type": "BLINK_EVENT",
  "session_id": "32361acf-...",
  "blink": {
    "participant_key": "PERSON 1",
    "name": "Operator Alpha",
    "color": "#00FF9D",
    "duration_ms": 140.0,
    "ear_drop": 0.12,
    "confidence": 0.98,
    "is_wink": false,
    "blink_count": 12,
    "blink_rate": 18.5,
    "timestamp": 1726080000000
  }
}
```

---

## 5. Running the Application

### Option A: Complete Multi-Container Orchestration (Recommended)

Run the Next.js frontend, FastAPI backend, and PostgreSQL database seamlessly with Docker Compose:

```bash
# From repository root
docker compose up --build
```

- **Next.js Frontend**: [http://localhost:3000](http://localhost:3000)
- **FastAPI Backend & Interactive Swagger Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **PostgreSQL Database**: Port `5432` (`blinkos` / `blinkos_secret`)

---

### Option B: Local Standalone Development

The FastAPI backend automatically detects whether PostgreSQL is available; if not, it gracefully initializes a local SQLite database (`sqlite:///./blinkos.db`) with zero setup required.

#### 1. Start FastAPI Backend:
```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Start Frontend:
**Using Next.js:**
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

**Using Standalone Prototype:**
```bash
cd frontend/app
python -m http.server 5500
# Open http://localhost:5500/index.html
```

---

## 6. Deploying to Vercel (Production Cloud Deployment)

BlinkOS is fully configured for zero-friction deployment on **Vercel** with Next.js 14 App Router, Edge network delivery, and built-in Serverless Route Handlers.

### Method 1: 1-Click Instant Deploy

Click the button below to deploy BlinkOS directly to your Vercel account with pre-configured settings:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fibenemariyambabu%2Fuseless_project_temp&root-directory=frontend&env=BACKEND_URL,NEXT_PUBLIC_WS_URL&envDescription=Optional%20backend%20and%20WebSocket%20URLs%20for%20live%20multiplayer)

---

### Method 2: Deploying via Vercel Dashboard (Git Import)

1. Open your [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New..."** ➔ **"Project"**.
2. Select and import the repository: `ibenemariyambabu/useless_project_temp`.
3. In the **Configure Project** settings:
   - **Framework Preset**: `Next.js` (automatically detected)
   - **Root Directory**: Click **Edit** and select `frontend`.
4. *(Optional)* **Environment Variables**:
   If connecting to a hosted FastAPI backend (e.g., on Railway, Render, Fly.io, or VPS):
   | Variable | Example Value | Description |
   |---|---|---|
   | `BACKEND_URL` | `https://your-backend.up.railway.app` | Next.js server-side rewrite proxy destination |
   | `NEXT_PUBLIC_API_URL` | `/api` | Client-side API base URL (defaults to `/api`) |
   | `NEXT_PUBLIC_WS_URL` | `wss://your-backend.up.railway.app` | Real-time multiplayer WebSocket sync |
   > **Note:** If no backend URL is specified, BlinkOS runs in **Zero-Config Standalone Cloud Mode** using built-in Next.js Serverless Route Handlers (`/api/sessions`, `/api/achievements`, etc.) and on-device MediaPipe computer vision.
5. Click **Deploy**. Vercel compiles the production bundle in seconds and provides your live `*.vercel.app` production URL.

---

### Method 3: Deploying via Vercel CLI

```bash
# 1. Install Vercel CLI (if not already installed)
npm i -g vercel

# 2. Deploy from the frontend directory
cd frontend
vercel

# 3. Deploy directly to production
vercel --prod
```

---

## 7. Verification & Automated Test Suite

A verification test suite verifies database schema creation, REST API endpoints, and WebSocket two-way messaging:

```bash
python scratch/test_backend.py
python scratch/test_ws.py
```
Both test suites complete with **100% test pass rate**.

---
Made with ❤️ at TinkerHub Useless Projects 

![Static Badge](https://img.shields.io/badge/TinkerHub-24?color=%23000000&link=https%3A%2F%2Fwww.tinkerhub.org%2F)
![Static Badge](https://img.shields.io/badge/UselessProjects--26-26?link=https%3A%2F%2Ftinkerhub.org%2Fevents%2F1M8ORET9A1%2Fuseless-projects-3.0)
