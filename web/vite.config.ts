import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // En desarrollo, /api y /uploads se redirigen al backend
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
      // E7: Socket.IO (monitoreo en vivo) comparte el mismo servidor HTTP
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
