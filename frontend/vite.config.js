import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // VITE_API_BASE_URL 미설정 시에만 사용. 설정 시 fetch 가 절대 URL 로 가므로 프록시 안 탐.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
    },
  },
})
