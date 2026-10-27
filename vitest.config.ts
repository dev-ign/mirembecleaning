import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    // Real local Pixel opt-in must not change unrelated UI-test defaults.
    env: { VITE_ENABLE_MARKETING_IN_DEVELOPMENT: 'false' },
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
