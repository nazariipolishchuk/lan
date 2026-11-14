/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// LAN_BASE is the GitHub Pages sub-path (for example "/lan/"); "/" in development.
export default defineConfig({
  base: process.env.LAN_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
  },
})
