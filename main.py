

import os
import sys

# Ensure Backend directory is in sys.path
backend_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

# Backend is added to sys.path so app can be imported directly

from app.main import app  # noqa: F401
# Reload trigger: 2026-09-28 ultra fast network and diagnostic caching enabled

