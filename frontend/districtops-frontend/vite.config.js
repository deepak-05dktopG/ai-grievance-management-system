import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        districtops: resolve(projectRoot, 'index.html'),
        grievance: resolve(projectRoot, 'grievance-portal/index.html'),
      },
    },
  },
});
