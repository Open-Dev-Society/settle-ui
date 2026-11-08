import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'settle-ui': fileURLToPath(new URL('./packages/settle-ui/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    include: ['packages/**/*.test.ts', 'packages/**/*.test.tsx', 'playground/**/*.test.ts', 'playground/**/*.test.tsx'],
  },
});
