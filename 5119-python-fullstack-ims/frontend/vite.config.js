import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5119,
    proxy: {
      '/api': {
        target: 'http://localhost:8119',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8119',
        changeOrigin: true,
      },
      '/thumbnails': {
        target: 'http://localhost:8119',
        changeOrigin: true,
      },
    },
  },
})
