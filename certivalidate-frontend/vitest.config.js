import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Igual que la app (vite.config.js + plugin React): JSX con runtime automático,
  // así los componentes no necesitan importar React para usar JSX.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/setupTests.js'],
    include: ['src/**/*.{test,spec}.{js,jsx}'],
    passWithNoTests: true,
  },
})
