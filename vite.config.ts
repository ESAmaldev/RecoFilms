import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// during development, forward any `/api` request to the proxy server
// running on port 3000.  the client code always hits `/api/...`, so
// without this Vite proxy the dev server would return 404.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
});