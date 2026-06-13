import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/PokeMMO-Breeding-Calculator/',
  build: {
    // The bundled Pokémon dataset JSON (~1.5 MB) is intentionally large;
    // raise the warning threshold so the build doesn't flag it as unexpected.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    exclude: ['e2e/**', 'node_modules/**', '.claude/**'],
  },
});
