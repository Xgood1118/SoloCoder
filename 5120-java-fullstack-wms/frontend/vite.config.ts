import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5120,
    proxy: {
      '/api': {
        target: 'http://localhost:8120',
        changeOrigin: true
      }
    }
  }
})
