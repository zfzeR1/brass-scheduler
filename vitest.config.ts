import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react() as any],
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts'
      ]
    }
  }
});
