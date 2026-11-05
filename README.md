# Creditfix Prototype

Creditfix is an AI-powered grievance management prototype for a hypothetical Indian District Administration.

## Technology stack
- Frontend: React + Vite + JavaScript + Bootstrap 5
- Backend: Python + FastAPI
- Database: MongoDB Atlas
- AI: Google Gemini API
- Storage: Cloudinary
- Authentication: JWT

## Project structure
- `frontend/` - React application shell and user interfaces
- `backend/` - FastAPI application, services and tests
- `.github/` - project instructions, agents and skill definitions

## Backend setup

From `backend/`, create and activate a virtual environment, then install dependencies:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Copy `.env.example` to `.env` and set `MONGODB_URI` and
`MONGODB_DB_NAME` to your own MongoDB Atlas configuration. The backend starts
without these values, but `/health` reports the database as not configured.
When configured, the health endpoint pings MongoDB on each request and returns
HTTP 503 unless the connection is available.

Run the API and tests from `backend/`:

```powershell
python -m uvicorn app.main:app --reload
python -m pytest
```

Open `http://127.0.0.1:8000/health` to check application and database status.

## Frontend setup

Install dependencies and run the Vite development server from `frontend/`:

```powershell
npm install
npm run dev
```

## Notes
This project is being implemented incrementally. The current backend provides
configuration, MongoDB connection lifecycle management, and health reporting.
