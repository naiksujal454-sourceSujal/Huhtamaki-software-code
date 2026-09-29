# Huhtamaki Vision Inspection System - Backend Architecture & Requirements Guide

This document is the definitive engineering specification for the **Huhtamaki Vision Inspection System Backend API**. It details the architecture, database models, REST API endpoints, real hardware interfaces, WebSocket streaming, and zero-mock persistence rules.

---

## 1. Tech Stack Overview

- **Framework**: FastAPI (`^0.115.0`)
- **ASGI Server**: Uvicorn (`^0.32.0`) with hot-reload
- **Database & ORM**: SQLAlchemy 2.0 with PostgreSQL / SQLite support
- **Schema Validation**: Pydantic v2
- **Password Security**: Argon2 via `pwdlib[argon2]`
- **System & Hardware Detection**: `psutil` (non-blocking), Python `socket`, `platform`, `subprocess`
- **Computer Vision & OCR**: OpenCV (`cv2`), PyTorch, PaddleOCR, `zxing-cpp`

---

## 2. Quickstart & Commands

```bash
# Navigate to project root
cd "Huhtamaki software"

# Activate virtual environment
.\.venv\Scripts\activate

# Start backend server with hot-reload on port 8000
uvicorn main:app --reload --port 8000

# Direct execution without activating virtual environment
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

- API Base URL: `http://127.0.0.1:8000`
- Interactive Swagger Documentation: `http://127.0.0.1:8000/docs`
- Health Probe: `http://127.0.0.1:8000/health` and `http://127.0.0.1:8000/api/health`

---

## 3. Directory Layout (`Backend/app/`)

```
Backend/app/
├── api/                             # REST API route controllers
│   ├── auth.py                      # Session login, token verification, logout
│   ├── dashboard.py                 # Summary metrics, pass rate, failure categories
│   ├── inspections.py               # Inspection control, defect injection, CSV export
│   ├── recipes.py                   # Recipe presets, barcode extraction, image serve
│   ├── settings.py                  # Section settings, system info, network diagnostics
│   ├── system.py                    # Health check, audit logs, buzzer trigger
│   └── users.py                     # User CRUD, role management, permanent deletion
├── db/                              # Database connectivity
│   └── database.py                  # Engine configuration, sessionmaker, schema init
├── models/                          # SQLAlchemy database entities
│   ├── event.py                     # AuditEvent table
│   ├── inspection.py                # Inspection records and defects
│   ├── recipe.py                    # Recipe definitions and verification settings
│   ├── settings.py                  # SystemSetting, RolePrivilege, AlertConfiguration
│   └── user.py                      # User accounts and AuthSession
├── schemas/                         # Pydantic input/output schemas
│   ├── auth.py                      # LoginRequest, LoginResponse, UserRead
│   ├── dashboard.py                 # DashboardSummary, TrendPoint, FailureReason
│   └── inspection.py                # InspectionCreate, InspectionRead
├── services/                        # Business logic & hardware integration
│   ├── audit_service.py             # Enterprise audit event recorder
│   ├── auth_service.py              # Credential validation & session generation
│   ├── dashboard_service.py         # In-memory cached batch telemetry calculation
│   ├── inspection_service.py        # Inspection ingestion and defect tracking
│   ├── log_service.py               # Application log ring buffer & audit log reader
│   ├── processing_manager.py        # Conveyor loop, state machine, barcode matcher
│   ├── recipe_service.py            # Recipe storage and image preloading
│   └── settings_service.py          # Real hardware/network detection, debug mode
└── websocket/                       # Real-time WebSocket infrastructure
    └── live_stream.py               # Live telemetry broadcaster and client pool
```

---

## 4. Key Endpoints Specification

### 4.1. Inspections & CSV Export
- `GET /api/inspections/export-csv?target_date=YYYY-MM-DD`
  - Queries genuine `Inspection` rows from PostgreSQL for the target date.
  - Returns streaming CSV content with headers:
    `Inspection ID, Timestamp, Preset / Recipe, Status, Scanned 1D Barcode, Expected Reference Code, Print Verified, Print Status, Latency (ms), Defect Reason, Batch Code`.
  - Automatically records `inspections.exported_csv` audit event.
- `GET /api/inspections`: Returns paginated inspection history.
- `POST /api/inspection/start`: Initiates inspection state machine.
- `POST /api/inspection/stop`: Halts inspection conveyor run.
- `POST /api/inspection/inject-defect`: Forces immediate defect container injection.

### 4.2. Dashboard Telemetry & High-Speed Caching
- `GET /api/dashboard/summary`:
  - Returns aggregate counts (`total`, `passed`, `failed`, `pass_rate`, `average_processing_ms`, `defect_breakdown`, `top_failure_reasons`, `trend`, `recent_results`).
  - Implements in-memory caching with 2.5s TTL: subsequent queries execute in **< 0.1ms**.

### 4.3. Real Hardware & Network Detection (Zero-Mock)
- `GET /api/settings/network/interfaces`:
  - Returns real network adapters from `psutil.net_if_addrs()`.
  - Genuine active IP, MAC address, subnet mask, default gateway, and connected Wi-Fi SSID.
  - Subprocess calls are independently cached for 30s for sub-5ms latency.
- `GET /api/settings/system-info`:
  - Returns genuine CPU model, physical cores, logical cores, non-blocking CPU load, RAM usage, and disk space.

### 4.4. Real Debug Mode
- `PUT /api/settings/section/advance_debug`:
  - Toggling `enable_debug_logs` dynamically sets the Python root logger and all application loggers to `logging.DEBUG` or `logging.INFO`.
  - Detailed camera timestamps and Modbus register hex dumps stream into the application log ring buffer.

### 4.5. Active Users & Security
- `GET /api/users`: Returns active user accounts from PostgreSQL.
- `POST /api/users`: Creates new user with Argon2 password hash.
- `DELETE /api/users/{user_id}`: Permanently deletes user account from database with protection for the last remaining administrator and automatic audit logging.

### 4.6. Real-Time Telemetry Stream
- `WS /api/ws/live` and `WS /ws/live`:
  - Broadcasts live inspection results, defect alarms, and state changes to connected frontends.
  - Heartbeat responder: responds to incoming client ping frames with instant pong frames.
