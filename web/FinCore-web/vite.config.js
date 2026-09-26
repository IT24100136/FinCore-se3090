import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5007', // Forwards all /api calls directly to your backend
        changeOrigin: true,
        secure: false,
      }
    }
  }
})