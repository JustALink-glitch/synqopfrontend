/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: { port: 5173, strictPort: true },
  // Older phones too: iPhones on iOS 14–15 (e.g. iPhone 6s, 7) and Android phones with Chrome from 2021.
  // Vite's default only covers Safari/iOS 16.4+ and Chrome 111+.
  build: { target: ['es2020', 'safari14', 'ios14', 'chrome87', 'edge88', 'firefox78'] },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
