# DistrictOps AI prototype

This is a standalone, frontend-only demonstration workspace. It does not replace or modify the existing grievance-management application.

## Run locally

```powershell
npm install
npm run dev
```

Create a production build with `npm run build`.

## Demo behavior

- Choose a simulated role on the entry screen to preview role-aware navigation.
- Use the task, meeting, file, field, document and coordination modules to create or update records.
- Shared records are stored in browser `localStorage`; clear the `districtops-demo-state-v1` and `districtops-demo-user-v1` keys to restore the seed data.
- AI, OCR, document retrieval, voice and multi-capability workflow outputs are illustrative local demonstrations. No AI service, speech service, government system or external data source is connected.
- All included departments, people, tasks, documents and circulars are synthetic. Synthetic circulars are not legal or official guidance.
- Role selection is a user-interface demonstration only, not authentication or backend authorization.

## Included grievance application

The existing AI grievance frontend is included at [`grievance-portal/`](./grievance-portal/). It is kept as a separate Vite entry point so its citizen and officer routes do not collide with the DistrictOps routes:

- Citizen portal: `/grievance-portal/index.html#/`
- Officer sign in: `/grievance-portal/index.html#/login`
- Officer dashboard: `/grievance-portal/index.html#/dashboard`

DistrictOps exposes the same application from its **AI grievance system** workspace. The copied app retains its own `HashRouter`, authentication context, API service and pages. It uses `VITE_API_BASE_URL` when provided and otherwise targets `http://localhost:8000`.
