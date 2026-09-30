# Huhtamaki Vision Inspection System

> **Enterprise Industrial Vision Inspection, Barcode Verification & Automated Rejection Platform**  
> *Developed for Huhtamaki High-Speed Packaging & Conveyor Lines*

---

## Table of Contents
1. [Overview & Purpose](#1-overview--purpose)
2. [End-to-End System Workflow (How It Works)](#2-end-to-end-system-workflow-how-it-works)
3. [Recipe Creation & Fast Barcode Auto-Detection](#3-recipe-creation--fast-barcode-auto-detection)
   - [3.1 How Recipes Are Created](#31-how-recipes-are-created)
   - [3.2 Barcode Extraction Pipeline & Speed (~15ms - 50ms)](#32-barcode-extraction-pipeline--speed-15ms---50ms)
4. [Live Inspection & Barcode Comparison Logic](#4-live-inspection--barcode-comparison-logic)
   - [4.1 Inspection Execution Loop](#41-inspection-execution-loop)
   - [4.2 Exact Barcode Matching Logic (`compare_code`)](#42-exact-barcode-matching-logic-compare_code)
5. [Defect Handling: What Happens on FAIL (NOK)](#5-defect-handling-what-happens-on-fail-nok)
   - [5.1 Immediate Line Stop (Conveyor Interlock)](#51-immediate-line-stop-conveyor-interlock)
   - [5.2 Alarm Buzzer & Tower Light](#52-alarm-buzzer--tower-light)
   - [5.3 Automatic Email Alert Dispatch](#53-automatic-email-alert-dispatch)
   - [5.4 Critical Alarm Modal on HMI & Recovery](#55-critical-alarm-modal-on-hmi--recovery)
6. [System Architecture & Technologies Used](#6-system-architecture--technologies-used)
   - [6.1 Architectural Topology Diagram](#61-architectural-topology-diagram)
   - [6.2 Technology Stack (Frontend, Backend, Hardware)](#62-technology-stack-frontend-backend-hardware)
   - [6.3 Sensor & Hardware Specifications](#63-sensor--hardware-specifications)
7. [HMI Design System & Visual Aesthetics](#7-hmi-design-system--visual-aesthetics)
   - [7.1 Industrial Color Palette](#71-industrial-color-palette)
   - [7.2 Destination-Aware Smart Navigation](#72-destination-aware-smart-navigation)
   - [7.3 Batch History & Production Tracking](#73-batch-history--production-tracking)
   - [7.4 Strict Zero-Mock Data Policy](#74-strict-zero-mock-data-policy)
8. [Directory Structure](#8-directory-structure)
9. [Quickstart & Installation Guide](#9-quickstart--installation-guide)

---

## 1. Overview & Purpose

The **Huhtamaki Vision Inspection System** is an enterprise-grade, high-speed industrial quality control and human-machine interface (HMI) platform. Built specifically for Huhtamaki packaging and container manufacturing facilities, it provides automated optical verification of 1D barcodes.

### Key Capabilities:
- **Dedicated Industrial Imager**: Interfaced with a **Datalogic Data Matrix 220** optical sensor via industrial Ethernet TCP/IP (`192.168.125.20:51235`).
- **Instant Tri-Action Safety on Failure**: On any defect or code mismatch, the system immediately **halts the conveyor line**, triggers a **loud acoustic buzzer & red light**, sends an **automated email alert to supervisors**, and activates a **pneumatic ejector valve**.
- **Real-Time Production Batch Accounting**: Tracks active batches, calculates live Pass and Fail counts, and maintains persistent batch history records.
- **Dual Deployment**: Runs seamlessly in any modern web browser (`http://localhost:5173`) or as a hardened standalone Windows Desktop Application (`.exe`) powered by Tauri v2.

---

## 2. End-to-End System Workflow (How It Works)

The software coordinates physical hardware, network sockets, backend state machines, and the frontend operator interface through a clear operational workflow:

```
[1. System Boot] ─────────► [2. Operator Login] ─────────► [3. Open Production Batch]
                                                                    │
[6. Real-Time Telemetry] ◄── [5. High-Speed Inspection] ◄─── [4. Select/Arm Recipe]
         │
         ├─── If OK (Pass) ───► Belt continues, Counters increment, Active batch Pass +1
         │
         └─── If NOK (Fail) ──► 1. Line Stops (PLC Coil 0=1)
                                2. Buzzer Rings (PLC Coil 1=1)
                                3. Email Alert Dispatched
                                4. HMI Critical Alarm Modal Appears
                                     │
                                [5. Operator Acknowledges & Resumes]
                                     │
                                [6. Audit Log Committed]
                                     │
                                [7. Analytics & Batch History Recorded]
```

1. **Boot**: The FastAPI backend initializes, sets up database tables (`app.db`), starts the asynchronous database queue worker, and verifies physical hardware (CPU, RAM, NICs).
2. **Login**: Operators sign in using secure Argon2 credentials. Roles (`ADMIN`, `OPERATOR`, `USER`) dictate feature accessibility.
3. **Open Batch**: The operator opens a production batch (e.g., `LOT-2026-X01`). All subsequent inspections are stamped with this batch code.
4. **Recipe**: The operator selects the active recipe preset. The expected barcode and reference images load into RAM in under 5ms.
5. **Inspect**: Conveyor belt triggers the Datalogic Data Matrix 220 sensor. Scanned barcode is transmitted to the backend over TCP/IP socket.
6. **Compare**: The backend executes `compare_code(scanned, expected)`.
7. **Action**: If PASS, live counters update. If FAIL, the conveyor line stops, buzzer sounds, email dispatches, and pneumatic rejector ejects the container.
8. **Acknowledge**: The operator clears the defect, silences the buzzer, and clicks "Resume" to restart the line.
9. **History & Export**: All records are saved to SQLite/PostgreSQL, updating Batch History and enabling one-click CSV export.

---

## 3. Recipe Creation & Fast Barcode Auto-Detection

### 3.1 How Recipes Are Created
Operators or supervisors can create new inspection recipes directly from the HMI:
1. Click **Create New Recipe**.
2. Enter the Recipe Name (e.g. `Coke 500ml Label`), SKU category, and optional notes.
3. Upload a reference product photograph or label artwork (`.png` or `.jpg`).
4. Click **Extract Barcode & Save**.

### 3.2 Barcode Extraction Pipeline & Speed (~15ms - 50ms)
When a label image is uploaded, the backend executes an optimized multi-stage computer vision pipeline (`barcode_roi_processor.py`):

1. **Resolution Pre-Scaling**: High-resolution 4K or 12-megapixel smartphone photos are dynamically downscaled to max 1600px width/height. This prevents computer vision freezes and ensures rapid execution.
2. **Stage 1 - Native OpenCV C++ Barcode Detector**: Uses OpenCV's optimized C++ engine (`detectAndDecode`). Detects and decodes standard 1D barcodes and 2D DataMatrix codes across any orientation in **~15ms to 20ms**.
3. **Stage 2 - Direct PyZbar Grayscale Sweep**: If Stage 1 requires confirmation, the image is converted to a normalized grayscale buffer and swept using PyZbar.
4. **Stage 3 - Fast 90° Rotated Check**: Barcodes printed vertically on bottle edges are rotated 90° clockwise in memory to ensure 100% extraction accuracy (~25ms).
5. **Stage 4 - Adaptive Thresholding & Morphology**: For glossy, metallic, or reflective packaging (e.g., aluminum foil lids), adaptive contrast enhancement isolates barcode bars from background noise.
6. **ROI Auto-Cropping**: The detected barcode's bounding box coordinates `(x, y, w, h)` are extracted. The backend crops and saves a crisp, magnified preview of the barcode into `Backend/data/processed/`.
7. **Standalone Recipe Code Generation**: The backend automatically compiles a dedicated Python script `Frontend/recipes/{recipe_name}.py` containing the exact ROI coordinates and target code.

> **Extraction Speed Summary**: The entire detection, crop, and save sequence finishes in **under 50 milliseconds**. Once saved, loading the recipe into live runtime memory takes **less than 5 milliseconds**.

---

## 4. Barcode Comparison Logic

### 4.2 Exact Barcode Matching Logic (`compare_code`)
The core verification function runs character-by-character comparison:

```python
def compare_code(scanned_text: str, recipe_expected_code: str) -> dict:
    scanned = str(scanned_text).strip() if scanned_text else ""
    expected = str(recipe_expected_code).strip() if recipe_expected_code else ""
    inspected_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    # Rule 1: Recipe target code must exist
    if not expected:
        return {
            "status": "NOK",
            "reason": "RECIPE_READ_FAILED",
            "text": "",
            "confidence": 0,
            "inspected_at": inspected_time,
        }

    # Rule 2: Scanner must return a readable barcode string
    if not scanned:
        return {
            "status": "NOK",
            "reason": "SCANNER_READ_FAILED",
            "text": "",
            "confidence": 0,
            "inspected_at": inspected_time,
        }

    # Rule 3: Exact string equality check
    if scanned == expected:
        return {
            "status": "OK",
            "reason": "CODE_MATCHED",
            "text": scanned,
            "confidence": 100,
            "inspected_at": inspected_time,
        }
    else:
        return {
            "status": "NOK",
            "reason": "CODE_MISMATCH",
            "text": scanned,
            "confidence": 100,
            "inspected_at": inspected_time,
        }
```

### Result Actions:
- **PASS (OK)**:
  - Total Inspected counter increments by 1.
  - PASS counter increments by 1.
  - Active Batch Pass counter increments in real time.
  - WebSocket broadcasts the result to the HMI in `< 1ms`.
  - The live camera viewer outlines the barcode in **Green**.
  - Conveyor continues uninterrupted.
- **FAIL (NOK)**:
  - FAIL counter increments by 1.
  - Active Batch Fail counter increments in real time.
  - Immediately triggers the Safety Interlock Sequence detailed below.

---

## 5. Defect Handling: What Happens on FAIL (NOK)

When a defect is detected (barcode mismatch, unreadable code, or damaged label), the system executes a coordinated, multi-channel response:

### 5.1 Immediate Line Stop (Conveyor Interlock)
- The state machine immediately changes to `PAUSED`.
- The backend sends a Modbus TCP command to the PLC: **Coil 0 = 1 (Conveyor Line Stop)**.
- The physical conveyor motor interlock opens, halting container movement immediately to prevent defective products from proceeding downstream.

### 5.2 Alarm Buzzer & Tower Light
- The backend writes Modbus TCP **Coil 1 = 1 (Alarm Buzzer & Red Light)**.
- The physical factory floor buzzer sounds a loud acoustic siren, and the red stack light flashes, alerting line supervisors and operators.

### 5.3 Automatic Email Alert Dispatch
- The `email_service` automatically builds a responsive HTML alert email containing:
  - Defect Type (e.g. `CODE_MISMATCH`, `SCANNER_READ_FAILED`).
  - Scanned Barcode vs Expected Recipe Barcode.
  - Timestamp and Inspection Record ID.
  - Active Batch code and Recipe Name.
  - Notification that the line has been halted by safety interlocks.
- The email is dispatched in a background asynchronous thread via SMTP to configured supervisors (`supervisor@huhtamaki.com`).

### 5.5 Critical Alarm Modal on HMI & Recovery
- The WebSocket pushes a `CRITICAL_ALARM` event to the HMI in `< 1ms`.
- The screen locks into the high-contrast **Critical Defect Modal**:
  - Displays side-by-side comparison: Scanned image with **Red Bounding Box** vs Expected Reference.
  - Highlights exact character differences.
  - Shows defect reason and timestamp.
- **Recovery Procedure**:
  1. The operator clicks **Acknowledge Alarm** on the modal.
  2. The backend sends Modbus TCP **Coil 1 = 0**, silencing the physical buzzer.
  3. The operator clicks **Resume Inspection**. Modbus Coil 0 is reset, the conveyor belt restarts, and inspection resumes.
  4. An immutable audit record (`alarm.acknowledged`) is logged with the operator's username and timestamp.

---

## 6. System Architecture & Technologies Used

### 6.1 Architectural Topology Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│               TIER 1: FRONTEND HMI PRESENTATION LAYER                  │
│       React 19 + TypeScript + Tailwind CSS v4 + Tauri Desktop          │
│                (Port: 5173  |  Native Windows Executable)              │
│  - Top Control & Live Counter Bar   - Scanner Viewer Optical Feed      │
│  - Destination-Aware Chevrons       - Results Panel & Extraction Log   │
│  - Analytics Dashboard & Charts     - Batch History & Health Monitors  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
           ┌────────────────────────┴────────────────────────┐
           │ HTTP REST APIs (Port 8000)                      │ WebSocket (ws://)
           │ - Authentication & User CRUD                    │ - Live Optical Stream
           │ - Recipe Setup & Calibration                    │ - Live Pass/Fail Counters
           │ - Batch Open/Close Management                   │ - Critical Defect Alerts
           │ - Daily CSV Inspection Export                   │ - Sub-ms Event Broadcast
           ▼                                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│               TIER 2: INDUSTRIAL BACKEND API GATEWAY                   │
│                    FastAPI + Uvicorn ASGI Server                       │
│  ┌───────────────────────────────┐   ┌──────────────────────────────┐  │
│  │ Processing State Machine      │   │ WebSocket Telemetry Hub      │  │
│  │ - IDLE / RUNNING / PAUSED     │   │ - Async Non-blocking Pub/Sub │  │
│  │ - Asynchronous DB Queue       │   │ - Rapid 500ms Auto-Reconnect │  │
│  └───────────────────────────────┘   └──────────────────────────────┘  │
└───────────────────┬─────────────────────────────────┬──────────────────┘
                    │                                 │
                    ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│  TIER 3: SENSORS & MACHINE CONTROL   │  │  TIER 4: DATA & SECURITY     │
│  - Datalogic Data Matrix 220 Imager  │  │  - SQLAlchemy 2.0 Engine     │
│  - OpenCV (cv2) & ROI Processor      │  │  - SQLite (app.db) / Postgres│
│  - psutil Live OS Hardware Probes    │  │  - Argon2 Password Hasher    │
│  - PLC Modbus TCP & Ejector Solenoid │  │  - Audit Trail Ring Buffer   │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

### 6.2 Technology Stack (Frontend, Backend, Hardware)

| Layer | Component | Technology | Role & Key Features |
| :--- | :--- | :--- | :--- |
| **Frontend HMI** | Single Page App | React 19, TypeScript, Vite 6 | 
| **Frontend Styling**| Styling System | Tailwind CSS v4, Lucide Icons | Clean industrial theme tokens, glassmorphism, responsive micro-animations. |
| **Desktop App** | Native Container | Tauri v2 (Rust runtime) | Lightweight Windows `.exe` application with native system performance. |
| **Backend Gateway** | Web Server | FastAPI, Uvicorn, Python 3.12 | Asynchronous ASGI server delivering sub-millisecond REST and WebSocket APIs. |
| **Computer Vision** | Image Processing | OpenCV (`cv2`), PyZbar, NumPy | Barcode ROI localization, pre-scaling, multi-strategy decoding pipeline. |
| **Database** | Persistence | SQLAlchemy 2.0, SQLite / PostgreSQL | Thread-safe transactional storage for recipes, users, batches, and inspections. |
| **Security** | Authentication | Argon2 (`pwdlib[argon2]`), HTTP-Only Cookies | Robust password hashing and tamper-evident audit trail logging. |
| **Industrial Comm**| Machine Control | Python Sockets, Modbus TCP | Low-level socket interface to sensor (`:51235`) and PLC (`:502`). |
| **Diagnostics** | Hardware Telemetry | `psutil` | Real-time monitoring of CPU, RAM, disk storage, and physical network adapters. |

### 6.3 Sensor & Hardware Specifications
- **Optical Sensor**: **Datalogic Data Matrix 220** Industrial 1D/2D Imager.
  - **Connection**: Ethernet TCP/IP Socket (`192.168.125.20:51235`).
  - **Optics**: High-speed electronic focus liquid lens with integrated high-power LED strobe.
  - **Symbologies**: DataMatrix, QR Code, Code 128, EAN-13, UPC-A, PDF417.
- **Programmable Logic Controller (PLC)**: Modbus TCP (`192.168.125.10:502`).
  - **Coil 0**: Conveyor Motor Interlock (1 = Stop Line, 0 = Run Line).
  - **Coil 1**: Factory Alarm Buzzer & Red Tower Light (1 = Sound Alarm, 0 = Silence).
  - **Coil 2**: Pneumatic Rejection Solenoid Valve Pulse.
  - **Discrete Input 0 (DI-0)**: Industrial Gap Sensor (Slot/Fork Gap Sensor for high-speed container gap detection).

## 7. HMI Design System & Visual Aesthetics

### 7.1 Industrial Color Palette
The interface uses an intentional, high-contrast industrial color scheme designed for factory lighting conditions:
- **Pixtron Deep Blue (`#123681` / `#153472`)**: Primary branding, active navigation tabs, action buttons, and header accents.
- **Vibrant Industrial Green (`#37b34a` / `text-emerald-600`)**: Approved inspection states, Pass badges, and OK counter tiles.
- **Alert Red (`#da291c` / `text-red-600`)**: Critical defects, rejected container bounding boxes, Fail counter tiles, and alarm modals.
- **Slate Gray Neutral Canvas (`#eff1f4` / `#f8fafc`)**: Low-glare, non-fatiguing backdrop engineered for 24/7 operator shifts.

### 7.2 Destination-Aware Smart Navigation
- **Left Edge Chevron (`<`)**: Directly navigates to the **Settings & Analytics Dashboard**. Automatically dims with reduced opacity when currently on that view.
- **Right Edge Chevron (`>`)**: Directly navigates to **Hardware, Scanner & PLC Connections**. Automatically dims when that view is active.
- Operators can switch between real-time inspection, diagnostic analytics, and hardware calibration with a single click.

### 7.3 Batch History & Production Tracking
The **Analytics Dashboard** includes an enterprise-grade production batch tracker:
- **Open / Close Batch Control**: Enter a new lot code and click **Open Batch** to initialize production tracking.
- **Batch History Table**: Accurately tracks every production batch with:
  - **Code**: Batch / Lot identifier with active pulsing green badge.
  - **Status**: `open` or `closed`.
  - **Pass**: Exact count of approved containers in that batch.
  - **Fail**: Exact count of rejected containers in that batch.
  - **Opened**: Formatted timestamp (`DD/MM/YYYY, HH:MM:SS am/pm`).
- **Live Increments**: As containers are inspected, the active batch row updates dynamically.

### 7.4 Strict Zero-Mock Data Policy
- **No Simulated Arrays**: All hardcoded fallback arrays have been eliminated.
- **100% Real Metrics**: Counter statistics, defect breakdowns, top failure reasons, pipeline health gauges, and batch tables bind exclusively to genuine database records and live operating system telemetry.

---

## 8. Directory Structure

```
Huhtamaki software/
├── Backend/                                # Industrial Gateway & Core Logic
│   ├── app/
│   │   ├── api/                            # REST API Route Controllers
│   │   │   ├── auth.py                     # Login, session verification, logout
│   │   │   ├── dashboard.py                # Analytics summary, batch open/close, health
│   │   │   ├── inspections.py              # Live inspection events, CSV export, alarms
│   │   │   ├── recipes.py                  # Recipe CRUD, image uploads, ROI extraction
│   │   │   ├── settings.py                 # Line configuration, network diagnostics
│   │   │   ├── system.py                   # Health checks, audit events, buzzer test
│   │   │   └── users.py                    # User account management & roles
│   │   ├── db/
│   │   │   └── database.py                 # SQLAlchemy engine, sessionmaker, schema init
│   │   ├── models/                         # Persistent Database Models
│   │   │   ├── batch.py                    # ProductionBatch entity
│   │   │   ├── event.py                    # AuditEvent entity
│   │   │   ├── inspection.py               # Inspection records & defect details
│   │   │   ├── recipe.py                   # Recipe configuration & parameters
│   │   │   ├── settings.py                 # SystemSetting, RolePrivilege, AlertConfig
│   │   │   └── user.py                     # User account & AuthSession entities
│   │   ├── schemas/                        # Pydantic Request/Response Models
│   │   │   ├── auth.py, dashboard.py, inspection.py, recipe.py, settings.py
│   │   ├── services/                       # Business Logic & Hardware Drivers
│   │   │   ├── audit_service.py            # Audit event recorder & ring buffer
│   │   │   ├── barcode_roi_processor.py    # Multi-strategy barcode detection & cropping
│   │   │   ├── dashboard_service.py        # Analytics, batch history & pipeline health
│   │   │   ├── email_service.py            # Automated defect email notifications
│   │   │   ├── inspection_service.py       # Inspection persistence coordinator
│   │   │   ├── log_service.py              # In-memory logging ring buffer
│   │   │   ├── processing_manager.py       # State machine, Data Matrix 220 socket, queue
│   │   │   ├── recipe_service.py           # Recipe image storage & loader
│   │   │   └── settings_service.py         # psutil hardware & NIC diagnostics
│   │   └── websocket/
│   │       └── live_stream.py              # WebSocket connection manager & broadcast
│   ├── data/                               # Local media & recipe presets
│   ├── requirements.txt                    # Python dependency manifest
│   └── main.py                             # FastAPI application entrypoint
│
├── Frontend/                               # HMI Client & Desktop App
│   ├── src/
│   │   ├── components/
│   │   │   ├── Connections/                # Scanner, PLC, Lights, NIC diagnostics
│   │   │   ├── Dashboard/                  # AnalyticsView (Batch History, Charts, CSV Export)
│   │   │   ├── Decorations/                # EdgePanel destination-aware chevrons
│   │   │   ├── Footer/                     # Status bar, system clock, user session
│   │   │   ├── Header/                     # State machine controls & live counters
│   │   │   ├── Login/                      # Sign In Modal
│   │   │   ├── Modals/                     # CriticalAlarmModal, CreateRecipeModal, etc.
│   │   │   ├── ResultsPanel/               # ExtractionDetails, EventLogs terminal
│   │   │   ├── ScannerViewer/              # Live Data Matrix 220 camera display & overlays
│   │   │   └── Settings/                   # Comprehensive multi-tab settings suite
│   │   ├── contexts/                       # Language & localization context
│   │   ├── services/                       # API clients, auditLogger, recipeStore
│   │   ├── App.tsx                         # Master application coordinator & state
│   │   ├── index.css                       # Tailwind CSS v4 design tokens
│   │   └── main.tsx                        # React application bootstrap
│   ├── src-tauri/                          # Tauri v2 native desktop configuration
│   ├── package.json                        # Node.js dependencies & scripts
│   └── vite.config.ts                      # Vite 6 configuration
│
├── .gitignore                              # Clean repository exclusion manifest
├── launch_tauri_app.bat                    # Standalone desktop application launcher
├── README.md                               # Master combined documentation
└── main.py                                 # Root gateway launcher
```

---

## 9. Quickstart & Installation Guide

### 9.1 Prerequisites
- **Python**: Version 3.11 or 3.12 (64-bit)
- **Node.js**: Version 18.x, 20.x, or 22.x LTS
- **Rust** *(Optional, only needed if recompiling the Tauri native executable)*

### 9.2 Running the Backend Server
Open PowerShell in the project root:
```powershell
# 1. Activate the Python virtual environment
.\.venv\Scripts\activate

# 2. Start the FastAPI ASGI gateway
python -m uvicorn Backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
The backend API will start on `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

### 9.3 Running the Frontend HMI
In a second PowerShell terminal:
```powershell
# 1. Navigate to the Frontend directory
cd Frontend

# 2. Start the Vite development server
npm run dev
```
Open your browser and navigate to `http://localhost:5173`.

### 9.4 Running the Native Windows Desktop Application
To launch the standalone desktop application without a browser:
```powershell
# Run the desktop launcher script from the project root
.\launch_tauri_app.bat
```
Alternatively, using the Tauri CLI:
```powershell
cd Frontend
npm run tauri:dev
```

### 9.5 Default Credentials
- **Username**: `admin`
- **Password**: `admin123`
