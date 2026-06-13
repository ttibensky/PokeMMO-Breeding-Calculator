import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const devPort = Number(env.DEV_PORT) || 3000;
  const previewPort = Number(env.PREVIEW_PORT) || 3001;

  return {
    plugins: [react()],
    base: '/PokeMMO-Breeding-Calculator/',
    build: {
      // The bundled Pokémon dataset JSON (~1.5 MB) is intentionally large;
      // raise the warning threshold so the build doesn't flag it as unexpected.
      chunkSizeWarningLimit: 2000,
    },
    server: {
      port: devPort,
      strictPort: true,
    },
    preview: {
      port: previewPort,
      strictPort: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
      exclude: ['e2e/**', 'node_modules/**', '.claude/**'],
    },
  };
});
