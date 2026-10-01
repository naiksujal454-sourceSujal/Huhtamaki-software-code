import sys
if sys.platform == "win32":
    import ctypes
    try:
        ctypes.windll.winmm.timeBeginPeriod(1)
    except Exception:
        pass

from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.auth import router as auth_router
from app.api.dashboard import router as dashboard_router
from app.api.inspections import router as inspections_router
from app.api.recipes import router as recipes_router
from app.api.settings import router as settings_router
from app.api.system import router as system_router
from app.api.users import router as users_router
from app.api.datalogic import router as datalogic_router
from app.api.plc import router as plc_router
from app.config import get_settings
from app.db.database import SessionLocal, engine, init_database
from app.services.audit_service import log_recent_audits
from app.services.auth_service import seed_default_users
from app.services.recipe_service import seed_default_recipes
from app.services.settings_service import seed_default_settings
from app.websocket.live_stream import ws_manager

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


import asyncio
from app.services.image_cache_service import warm_cache

@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    with SessionLocal() as db:
        seed_default_users(db, settings)
        seed_default_settings(db)
        seed_default_recipes(db)
        db.commit()
        log_recent_audits(db)
    # Warm up RAM image cache in background thread
    asyncio.create_task(asyncio.to_thread(warm_cache))
    yield
    engine.dispose()


app = FastAPI(title="Huhtamaki Inspection API", version="0.1.0", lifespan=lifespan)

cors_origins = list(settings.allowed_origins) + [
    "http://tauri.localhost",
    "https://tauri.localhost",
    "tauri://localhost",
    "http://localhost:1420",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.1.185:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"^(https?://(localhost|127\.0\.0\.1|tauri\.localhost|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.\d+\.\d+\.\d+)(:\d+)?|tauri://localhost)$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(inspections_router, prefix="/api")
app.include_router(recipes_router, prefix="/api")
app.include_router(settings_router, prefix="/api")
app.include_router(system_router, prefix="/api")
app.include_router(users_router, prefix="/api")
app.include_router(datalogic_router, prefix="/api")
app.include_router(plc_router, prefix="/api")


@app.websocket("/api/ws/live")
@app.websocket("/ws/live")
async def live_websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection open and receive any ping/commands from frontend
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        await ws_manager.disconnect(websocket)
    except Exception as e:
        await ws_manager.disconnect(websocket)


@app.get("/health")
@app.get("/api/health")
def health() -> dict[str, str]:
    with SessionLocal() as db:
        db.execute(text("SELECT 1"))
    return {"status": "ok"}
