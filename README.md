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

Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and
`MONGODB_DB_NAME` to your own MongoDB Atlas configuration. The backend can start
without these values, but `/health/db` will report the database as unavailable.

Run the API and tests from `backend/`:

```powershell
python -m uvicorn app.main:app --reload
python -m pytest
```

The current grievance API supports submission, retrieval with status/category/
department filters and pagination, officer review updates, and status changes.
Officer review and status endpoints are not authenticated yet and must only be
used in the local prototype environment until authorization is implemented.

## Frontend setup

Install dependencies and run the Vite development server from `frontend/`:

```powershell
npm install
npm run dev
```

## Notes
This repository is for the prototype scaffold only. Application features and business logic will be added in subsequent implementation steps.
