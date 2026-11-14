import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('/react-router') || id.includes('/@remix-run/')) return 'vendor-router';
          if (id.includes('/@tanstack/') || id.includes('/axios/')) return 'vendor-data';
          if (id.includes('/i18next') || id.includes('/react-i18next/')) return 'vendor-i18n';
          if (id.includes('/react-dom/') || id.includes('/scheduler/')) return 'vendor-react';
          return undefined;
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Forward API calls to the backend so the refresh-token cookie stays same-origin in dev
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Public avatar files are served by the backend at /uploads
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/tests/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
    css: false,
  },
});
