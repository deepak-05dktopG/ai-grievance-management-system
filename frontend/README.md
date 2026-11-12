# DistrictOps AI prototype

This is the single frontend application for the DistrictOps and AI grievance demonstrations. It does not replace or modify the backend.

## Run locally

```powershell
npm install
npm run dev
```

Create a production build with `npm run build`.

## Deploy on Vercel

Set the Vercel project **Root Directory** to `frontend`. The included [`vercel.json`](./vercel.json) builds this combined app and publishes `dist`.

If the grievance API should be live after deployment, add `VITE_API_BASE_URL` as a Vercel environment variable with the deployed backend URL. Without it, the demo UI still loads, but the grievance API client falls back to `http://localhost:8000`.

## Demo behavior

- Choose a simulated role on the entry screen to preview role-aware navigation.
- Use the task, meeting, file, field, document and coordination modules to create or update records.
- Shared records are stored in browser `localStorage`; clear the `districtops-demo-state-v1` and `districtops-demo-user-v1` keys to restore the seed data.
- AI, OCR, document retrieval, voice and multi-capability workflow outputs are illustrative local demonstrations. No AI service, speech service, government system or external data source is connected.
- All included departments, people, tasks, documents and circulars are synthetic. Synthetic circulars are not legal or official guidance.
- Role selection is a user-interface demonstration only, not authentication or backend authorization.

## Included grievance application

The existing AI grievance frontend is included under [`src/grievance-portal/`](./src/grievance-portal/). It is a second Vite page entry, not a second package or frontend application:

- Citizen portal: `/grievance.html#/`
- Officer sign in: `/grievance.html#/login`
- Officer dashboard: `/grievance.html#/dashboard`

DistrictOps exposes the same application from its **AI grievance system** workspace. The grievance code retains its own `HashRouter`, authentication context, API service and pages while sharing this one package and one `src/` tree. It uses `VITE_API_BASE_URL` when provided and otherwise targets `http://localhost:8000`.
