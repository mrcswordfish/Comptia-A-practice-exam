import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages (project pages) needs the correct base path, e.g. "/<repo>/"
// We set it via env var in the GH Actions workflow (VITE_BASE).
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
})
