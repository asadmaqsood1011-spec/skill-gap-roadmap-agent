import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: frontend calls /api/* -> backend on :3001.
// In prod, set VITE_API_BASE to the deployed backend URL instead.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
});
