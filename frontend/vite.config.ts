import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
// vitest/config's defineConfig = Vite's, plus the "test" section below
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // The browser only talks to the Vite dev server (same origin, so no CORS);
    // Vite forwards /api/* to the NestJS backend without the /api prefix.
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      // The WebSocket (backend RealtimeGateway), same origin as the page
      '/ws': { target: 'ws://localhost:3000', ws: true },
    },
  },
  // npm test: the same plugins and settings as the app, so the tests run
  // the code the way the browser gets it
  test: {
    // A simulated browser (DOM, window, events) inside Node
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Each test starts with fresh mocks: one test can't leak into the next
    restoreMocks: true,
  },
});
