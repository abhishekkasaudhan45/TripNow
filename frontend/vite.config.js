import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // 👉 ADDED THIS BUILD SECTION HERE:
  build: {
    chunkSizeWarningLimit: 1000,
  }
})