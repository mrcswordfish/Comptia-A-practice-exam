import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base makes the build work on GitHub Pages (and any subpath) without extra config.
export default defineConfig({
  plugins: [react()],
  base: "./",
})
