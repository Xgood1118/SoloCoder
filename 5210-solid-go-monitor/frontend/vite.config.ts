import { defineConfig } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 3010,
    proxy: {
      '/api': 'http://localhost:8110',
    },
  },
  build: {
    target: 'esnext',
  },
});
