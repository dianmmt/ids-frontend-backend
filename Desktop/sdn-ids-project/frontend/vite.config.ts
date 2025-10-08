import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0', // Bind tất cả network interfaces
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.NODE_ENV === 'development' ? 'http://localhost:3001' : 'http://backend:3001',
        changeOrigin: true,
        timeout: 60000,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.error('Proxy error:', err);
          });
        },
      },
    },
  }
});