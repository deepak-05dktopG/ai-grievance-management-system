// Vite/React dev-server configuration; from frontend run `npm run dev` or `npm run build`.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const prototypeRoot = resolve(configDirectory, 'districtops-frontend');

export default defineConfig({
  plugins: [react()],
  root: prototypeRoot,
  build: {
    rollupOptions: {
      input: {
        districtops: resolve(prototypeRoot, 'index.html'),
        grievance: resolve(prototypeRoot, 'grievance-portal/index.html'),
      },
    },
  },
  server: {
    port: 5173,
  },
});