import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build React: prévia técnica no Vite, rota jogável /play servida pelo server.mjs no Railway.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }
});
