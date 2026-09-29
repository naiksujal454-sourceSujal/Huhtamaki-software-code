# Huhtamaki Vision Inspection System - Master Requirements & Architecture

## System Overview
The **Huhtamaki Vision Inspection System** is an enterprise-grade industrial inspection platform designed for high-speed bottle, container, label, and 1D/2D code verification on manufacturing conveyor lines.

---

## 1. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                 React 19 + Tailwind CSS HMI                 │
│              (Vite 6 Dev Server / Tauri Desktop)            │
│               Port: 5173  |  Host: localhost                │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP REST & WebSocket (ws://)
┌──────────────────────────────▼──────────────────────────────┐
│                    FastAPI Backend Gateway                  │
│                (Uvicorn ASGI Server on Port 8000)           │
├──────────────────────────────┬──────────────────────────────┤
│  Services & Hardware Engine  │  Database & Security Layer   │
│  - Barcode Extractor & OCR   │  - PostgreSQL / SQLite Engine│
│  - Processing State Machine  │  - Argon2 Password Hasher    │
│  - Live WebSocket Stream     │  - Enterprise Audit Trail    │
│  - Real Diagnostics (psutil) │  - In-Memory Ring Buffer     │
└──────────────────────────────┴──────────────────────────────┘
```

---

## 2. Component Reference Documentation

- **Frontend Specification**: [`Frontend/REQUIREMENTS.md`](file:///c:/Users/naiks/OneDrive/Desktop/Huhtamaki%20software/Frontend/REQUIREMENTS.md)
  - Detailed component tree, state management, and edge navigation rules.
- **Backend Specification**: [`Backend/REQUIREMENTS.md`](file:///c:/Users/naiks/OneDrive/Desktop/Huhtamaki%20software/Backend/REQUIREMENTS.md)
  - REST endpoints, database schemas, hardware detection, and WebSocket streaming.

---

## 3. Server Startup Commands

### 3.1 Backend Server (Port 8000)
```powershell
cd "c:\Users\naiks\OneDrive\Desktop\Huhtamaki software"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### 3.2 Frontend Web HMI (Port 5173)
```powershell
cd "c:\Users\naiks\OneDrive\Desktop\Huhtamaki software\Frontend"
npm run dev
```

### 3.3 Desktop Application (Native Tauri Window)
Double-click `launch_tauri_app.bat` or run:
```powershell
cd "c:\Users\naiks\OneDrive\Desktop\Huhtamaki software\Frontend"
npm run desktop
```

---

## 4. Key Engineering Standards

1. **Strict Zero-Mock Policy**: Absolutely no mock arrays, fake delays, or simulated placeholders. All network interfaces, hardware statistics, user accounts, and inspection events bind to real backend services and database records.
2. **Terminal-Style Logging**: Logs screen is restricted exclusively to 3 real streams:
   - `App Logs`: Python runtime logging ring buffer.
   - `Config Logs`: Settings modifications with actor and IP tracking.
   - `Event Logs`: Complete audit trail format (`[TIMESTAMP] [EVENT/AUDIT] [@ACTOR] (ROLE) [IP] [ENTITY] ACTION: DETAILS`).
3. **Destination-Specific Navigation**:
   - Left button strictly targets Settings & Detailed Dashboard view (`'analytics'`) and disables when active.
   - Right button strictly targets Hardware, Scanner & PLC Configs (`'connections'`) and disables when active.
4. **Real CSV Export**: Instant generation and download of genuine inspection records for the current day with on-screen verification preview.
5. **Real Debug Mode**: Dynamic switching between `logging.DEBUG` and `logging.INFO` persisted in database.
