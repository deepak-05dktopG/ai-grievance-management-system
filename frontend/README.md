# CreditFix frontend

The `frontend` directory contains the complete frontend for the CreditFix prototype. It is one Vite application with one `package.json`, one lockfile and one `src/` tree.

The build exposes two page entries:

- DistrictOps operations workspace: `/`
- AI grievance portal: `/grievance.html`

The grievance portal is a separate page entry within the same frontend package. It is not a nested frontend application.

## Requirements

- Node.js 22.x
- npm
- The repository cloned locally

The required Node version is declared in [`package.json`](./package.json). Run all frontend commands from this directory, not from the repository root.

## Frontend setup workflow

### 1. Open the frontend directory

```powershell
cd .\frontend
```

### 2. Install dependencies

Use the lockfile for a reproducible installation:

```powershell
npm ci
```

Use `npm install` only when intentionally changing dependencies.

### 3. Configure the grievance API when required

The DistrictOps prototype works with synthetic local data and does not require a backend. The grievance portal can call the FastAPI backend when `VITE_API_BASE_URL` is set.

Create `frontend/.env.local` when running against a local backend:

```dotenv
VITE_API_BASE_URL=http://localhost:8000
```

Do not commit `.env.local` or any file containing API keys. Vite exposes variables prefixed with `VITE_` to browser code, so only public, non-secret configuration belongs there.

### 4. Start the development server

```powershell
npm run dev
```

Open the URL printed by Vite, normally:

- `http://localhost:5173/` for DistrictOps
- `http://localhost:5173/grievance.html#/` for the citizen grievance portal
- `http://localhost:5173/grievance.html#/login` for officer sign-in
- `http://localhost:5173/grievance.html#/dashboard` for the officer dashboard

DistrictOps uses `BrowserRouter`. The grievance portal uses `HashRouter`, which keeps its nested routes working when it is embedded from the DistrictOps AI grievance workspace.

## Available commands

Run these commands from [`frontend/`](./):

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Create the production build in `dist/` |
| `npm run preview` | Serve the production build locally |

Before submitting frontend changes, run:

```powershell
npm run build
```

This validates the Vite multi-page configuration and catches import or production-bundling errors.

## Project structure

```text
frontend/
├── index.html                 # DistrictOps entry
├── grievance.html             # Grievance portal entry
├── package.json               # Single frontend package
├── package-lock.json          # Locked dependency tree
├── vite.config.js             # React and multi-page build configuration
├── vercel.json                # Vercel build and routing configuration
└── src/
    ├── App.jsx                # DistrictOps shell and routes
    ├── components/            # Shared DistrictOps UI primitives
    ├── context/               # DistrictOps state and local persistence
    ├── data/                  # Synthetic prototype data
    ├── pages/                 # DistrictOps feature modules
    └── grievance-portal/      # Grievance pages, context, services and styles
```

Keep DistrictOps changes in the existing application structure. Add grievance changes under [`src/grievance-portal/`](./src/grievance-portal/) and preserve its `HashRouter` entry unless the page routing design is intentionally changed.

## Development workflow

1. Pull the latest changes and run `npm ci`.
2. Start `npm run dev` from `frontend/`.
3. Use the DistrictOps workspace to review role-aware navigation and feature modules.
4. Use the AI grievance system workspace or the direct grievance URL to verify citizen and officer flows.
5. Confirm local state behavior by refreshing the browser. DistrictOps demo records are persisted in `localStorage`.
6. Run `npm run build` before opening a pull request or deploying.

DistrictOps demo state can be reset by removing these browser storage keys:

- `districtops-demo-state-v1`
- `districtops-demo-user-v1`

## Vercel deployment

Configure the Vercel project as follows:

- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Node.js version:** `22.x`

[`vercel.json`](./vercel.json) contains the build and SPA rewrite configuration. Set `VITE_API_BASE_URL` in the Vercel project environment variables if the deployed grievance portal should call a deployed backend. A frontend deployment alone does not provide the FastAPI or MongoDB services.

## Prototype boundaries

- DistrictOps records, notifications, audit history and workflow interactions use synthetic data and browser-local state.
- AI, OCR, document retrieval, voice and agent workflows are illustrative UI demonstrations; no external AI or government system is connected.
- Included departments, users, tasks, documents and circulars are synthetic. Synthetic circulars are not official or legal guidance.
- Role selection in DistrictOps is a UI demonstration, not authentication or backend authorization.
- The grievance portal uses the configured API when available and otherwise falls back to `http://localhost:8000`; backend availability and authentication are separate from the static frontend build.
