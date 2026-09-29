# Huhtamaki Backend

## Auth setup

1. Create the PostgreSQL database named `huhtamaki_software`.
2. Install dependencies:

```powershell
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

3. Set the database and default account values in `.env`.
4. Start the API:

```powershell
..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

On startup, the API creates the auth tables and seeds these accounts if their usernames do not exist:

- `admin` with role `admin`
- `operator` with role `operator`
- `user` with role `user`

Passwords are read from `DEFAULT_*_PASSWORD` environment variables and stored only as Argon2 hashes in PostgreSQL. Change those values before the first production startup.

## Auth endpoints

- `POST /api/auth/login` - create a database-backed session
- `POST /api/auth/logout` - revoke the current session
- `GET /api/auth/me` - return the signed-in user
- `PATCH /api/auth/me` - change the current username and/or password; `current_password` is required
- `GET /health` - database connectivity health check

## Inspection and dashboard endpoints

All inspection and dashboard endpoints require the session cookie created by login.

- `POST /api/inspections` - persist one real inspection result
- `GET /api/inspections?limit=50&offset=0` - list recent persisted results
- `GET /api/dashboard/summary` - calculate totals, pass rate, processing average, print verification, trends, failure reasons, and recent results from PostgreSQL
- `GET /api/system/audit-logs` - read audit events; admin role only

Example inspection payload:

```json
{
	"inspection_key": "camera-2026-09-24-0001",
	"status": "NOT_OK",
	"preset": "production",
	"image_name": "frame-0001.bmp",
	"batch_code": "BATCH-001",
	"processing_ms": 179.4,
	"print_verified": true,
	"print_status": "NOT_OK",
	"defects": [
		{"reason": "seal_ocr", "category": "seal", "count": 1}
	],
	"metadata": {"camera": "line-1", "source": "plc"}
}
```

Recipes are not connected yet. The inspection `metadata` JSON field is available for new machine fields until the recipe contract is defined.

## Audit logging for future modules

Use `record_audit()` from `app.services.audit_service` after every settings, recipe, inspection, user, or system mutation. The event is committed with the surrounding transaction and is also printed to the backend terminal as a JSON `AUDIT` line. Passwords, tokens, and secrets are automatically redacted from terminal details.
