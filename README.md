# Salesforce Investigation Dashboard

Angular frontend for investigation trends. Connect to the **FastAPI** backend (port 4000) for live data; the frontend shows sample data when the API is unavailable.

## Quick start

1. **Start the backend** (FastAPI; must run on port 4000 for the frontend to use it):

   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn fastapi_app.main:app --reload --port 4000
   ```

   See `backend/RUN_GUIDE.md` for env and Salesforce OAuth.

2. **Start the frontend**:

   ```bash
   npm start
   ```

3. Open **http://localhost:4200**. The app calls `http://localhost:4000/api`. If the backend is not running, the dashboard shows sample data and a "Backend unavailable" banner.

## Scripts (from repo root)

| Script          | Description               |
|-----------------|---------------------------|
| `npm start`     | Start Angular dev server  |
| `npm run build` | Build frontend for prod   |
| `npm test`      | Run frontend unit tests   |

## Integration (no backend code changes)

- The **Node (Express)** backend in `backend/src/server.js` exposes only `/health` and `/api/salesforce/connect-test`. It does not serve trends.
- The **FastAPI** backend in `backend/fastapi_app/main.py` exposes `GET /api/investigations/trends` (and the other routes). Use this backend for full dashboard integration; the frontend is already configured to use `http://localhost:4000/api` in development.
