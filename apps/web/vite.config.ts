import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Build experimental isolado; o Railway continua usando o server.mjs da v0.1.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 }
});
