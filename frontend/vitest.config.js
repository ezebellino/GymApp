import { defineConfig, mergeConfig } from 'vite'
import viteConfig from './vite.config.js'

// Se combina con vite.config.js con mergeConfig: si existe un vitest.config.*,
// Vitest ignora el vite.config.* por completo, y sin el merge se pierden el alias
// `@ -> ./src` y el plugin de React.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
    },
  }),
)
