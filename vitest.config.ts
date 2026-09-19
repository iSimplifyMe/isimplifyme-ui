import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The beacon is a delegated document listener; its tests click real elements.
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://example.com/contact' } },
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
