import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const clientRoot = path.dirname(fileURLToPath(import.meta.url));
const apiTarget = `http://127.0.0.1:${process.env.PORT || 8000}`;

export default defineConfig({
  root: clientRoot,
  publicDir: path.join(clientRoot, 'public'),
  plugins: [react()],
  build: {
    outDir: path.join(clientRoot, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/media': apiTarget,
    },
  },
});
