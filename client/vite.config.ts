import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Prefer .ts source over compiled .js so Vite picks up shared/*.ts instead of shared/*.js
    extensions: ['.mts', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.json'],
  },
  server: {
    fs: {
      // Allow importing from the monorepo root (shared/)
      allow: ['..'],
    },
  },
})
