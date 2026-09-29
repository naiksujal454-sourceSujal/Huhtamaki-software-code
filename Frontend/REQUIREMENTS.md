# Huhtamaki Vision Inspection System - Frontend Architecture & Requirements Guide

This document is the definitive engineering reference for the **Huhtamaki Vision Inspection System Frontend (HMI)**. It details the technology stack, project layout, state machine, zero-mock policy, WebSocket telemetry stream, and hardware navigation.

---

## 1. Tech Stack Overview

- **Framework**: React 19 (`^19.0.0`)
- **Language**: TypeScript (`~5.7.2` / ES2023)
- **Build Tool & Bundler**: Vite 6 (`@vitejs/plugin-react`)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` engine)
- **Desktop Runtime**: Tauri v2 (`@tauri-apps/cli`)
- **Component Icons**: `lucide-react`
- **Analytics & Visualizations**: `recharts` (Bar charts, pass/fail trends, throughput)
- **Typography**: Ubuntu font family (`font-ubuntu`)

---

## 2. Quickstart & Commands

```bash
# Navigate to the frontend directory
cd "Huhtamaki software/Frontend"

# Install dependencies
npm install

# Start local development server (runs on http://localhost:5173)
npm run dev

# Run TypeScript compilation check
npx tsc --noEmit

# Production bundle build
npm run build

# Launch native desktop development window (Tauri + Vite)
npm run desktop
```

---

## 3. Project Directory Structure (`src/`)

```
src/
├── assets/                          # Static assets and brand logos
├── components/                      # UI Components divided by domain
│   ├── Connections/                 # Hardware & communications diagnostic view
│   │   └── ConnectionsView.tsx      # Scanner, PLC, Lights, Ethernet, USB, Hardware tabs
│   ├── Dashboard/                   # Analytics and metrics views
│   │   └── AnalyticsView.tsx        # Batch analytics, failure reasons, trend charts, CSV Export
│   ├── Decorations/                 # Visual and navigation edge elements
│   │   └── EdgePanel.tsx            # Left & right destination-specific navigation chevrons
│   ├── Footer/                      # Global bottom status bar
│   │   └── Footer.tsx               # Serial number, time, admin session, logout trigger, Home button
│   ├── Header/                      # Industrial top control panel
│   │   ├── ControlsWidget.tsx       # Start/Pause/Resume/Stop state machine controls
│   │   ├── CounterWidget.tsx        # PASS, FAIL, TOTAL, %RR counters
│   │   ├── Header.tsx               # Master interlocking header bar
│   │   └── StatusWidget.tsx         # Inspection time, speed (PPM), status badge
│   ├── Login/                       # Authentication overlay
│   │   └── LoginModal.tsx           # Database credential validation
│   ├── Modals/                      # Reusable dialog overlays
│   │   ├── ChangePasswordModal.tsx  # User password change with database persistence
│   │   ├── CreateRecipeModal.tsx    # Recipe creation with OCR text extraction
│   │   ├── CriticalAlarmModal.tsx   # Floating defect pause and acknowledge modal
│   │   ├── LogoutModal.tsx          # Logout prompt
│   │   └── SelectPresetModal.tsx    # Recipe preset selection dialog
│   ├── ResultsPanel/                # Inspection results and audit logs
│   │   ├── EventLogs.tsx            # Live scans table & audit event trail
│   │   ├── ExtractionDetails.tsx    # Barcode extraction metadata & confidence score
│   │   └── ResultsPanel.tsx         # Inspection decision banner & split results container
│   ├── ScannerViewer/               # Camera viewport
│   │   └── ScannerViewer.tsx        # Live container frame viewer, defect simulation & injector
│   └── Settings/                    # Enterprise configuration module
│       ├── SettingsView.tsx         # Multi-tab settings container & role access guard
│       └── tabs/                    # Individual configuration sub-tabs
│           ├── AdvanceSettingsTab.tsx    # PLC memory map, debug mode, frame cache
│           ├── AlertConfigurationTab.tsx # Thresholds and suppression rules
│           ├── GeneralSettingsTab.tsx    # Plant ID, date format, camera exposure
│           ├── InternetConnectionTab.tsx # Real network detection (IP, MAC, Gateway, Wi-Fi)
│           ├── LogsTab.tsx               # Pure terminal (App Logs, Config Logs, Event Logs)
│           ├── PlatformTab.tsx           # Platform configuration
│           ├── ProductionLineTab.tsx     # Conveyor parameters and line speeds
│           ├── SecurityTab.tsx           # Active users, delete account, role matrix
│           ├── ServiceDetailTab.tsx      # Machine service hours & vendor logs
│           ├── SystemInfoTab.tsx         # Real hardware metrics (CPU, RAM, OS, Disk)
│           ├── TestTab.tsx               # Component self-test diagnostics
│           └── UITab.tsx                 # Language, theme, and screen brightness
├── contexts/                        # Global state providers
│   └── LanguageContext.tsx          # Multi-language translation context
└── services/                        # API clients and business logic
    ├── api.ts                       # Backend REST client (auth, users, settings, CSV export)
    ├── apiConfig.ts                 # Direct backend vs proxy resolution
    ├── auditLogger.ts               # Audit logging utility
    ├── dateFormatService.ts         # Global date formatting service
    ├── inspectionService.ts         # Live WebSocket stream & run state machine
    ├── recipeStore.ts               # Recipe persistence & cache
    └── settingsStore.ts             # Settings persistence & preloader
```

---

## 4. Navigation Rules & Edge Panel Buttons

The HMI provides two side navigation chevrons rendered by `EdgePanel.tsx`:

1. **Left Chevron Button**:
   - **Target**: Strictly opens the **Settings & Detailed Dashboard** view (`'analytics'`).
   - **Disabled State**: When the user is already on `'analytics'` or `'settings'`, the left button is **disabled** (`opacity-30`, `cursor-not-allowed`, `pointer-events-none`).
   - **Enabled State**: When on Home (`'inspection'`) or Hardware (`'connections'`), it is enabled.

2. **Right Chevron Button**:
   - **Target**: Strictly opens the **Hardware, Scanner & PLC Configs** view (`'connections'`).
   - **Disabled State**: When the user is already on `'connections'`, the right button is **disabled** (`opacity-30`, `cursor-not-allowed`, `pointer-events-none`).
   - **Enabled State**: When on Home (`'inspection'`) or Settings/Dashboard, it is enabled.

3. **Home Button**:
   - Always available in the Footer bar to return immediately to the primary inspection view (`'inspection'`).

---

## 5. Zero-Mock Policy & Real Telemetry

The application strictly forbids mock data. All components bind to genuine system and hardware APIs:
- **Network & Hardware**: IP addresses, MAC addresses, default gateways, and active Wi-Fi SSIDs are genuine Windows network detections from Python `psutil` and socket calls.
- **Diagnostics**: Real disk free/used storage metrics from `shutil.disk_usage()` and socket health checks.
- **Active Users**: Stored in PostgreSQL with real CRUD operations, password hashing, and account deletion (`DELETE /api/users/{id}`).
- **Event Logs Terminal**: Pure terminal console rendering 3 designated log streams:
  1. `App Logs`: Real Python logging ring-buffer events (`[INFO]`, `[WARN]`, `[ERROR]`, `[DEBUG]`).
  2. `Config Logs`: Real settings modifications by actors.
  3. `Event Logs`: Structured audit trail with timestamp, actor, role, IP, entity, and action.
- **Day CSV Export**: Real daily inspection records fetched from PostgreSQL with instant download and on-screen modal viewer.

---

## 6. Live Telemetry & Ultra-Fast WebSocket Reconnection

The frontend connects to the backend inspection stream via `/api/ws/live`:
- **Direct Connection**: In development, `apiConfig.ts` routes directly to `ws://127.0.0.1:8000/api/ws/live` to bypass Vite dev proxy timeouts.
- **Fast-Probe Reconnect**: Reconnect interval starts at **250ms** upon server restart.
- **Active Health Probing**: Polling `/api/health` every 350ms ensures that the microsecond the backend finishes booting, the WebSocket reconnects in **< 200ms**.
- **Bidirectional Heartbeat**: Automated 15-second heartbeat ping maintains connection integrity through firewalls and OS socket timeouts.
