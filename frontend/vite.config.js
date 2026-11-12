// Vite/React dev-server configuration; from frontend run `npm run dev` or `npm run build`.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        districtops: 'index.html',
        grievance: 'grievance.html',
      },
    },
  },
  server: {
    port: 5173,
  },
});