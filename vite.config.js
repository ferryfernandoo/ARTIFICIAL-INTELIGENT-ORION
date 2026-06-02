import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: './index.html'
    },
    minify: 'terser',
    cssMinify: false
  },
  server: {
    middlewareMode: false,
    proxy: {
      '/api': {
        target: 'http://187.77.116.90:3001',
        changeOrigin: true,
        secure: false
      },
      '/download': {
        target: 'http://187.77.116.90:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
