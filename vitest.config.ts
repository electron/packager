import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/vitest.setup.ts'],
    include: ['./test/**/*.spec.ts'],
    clearMocks: true,
    testTimeout: 15_000,
    typecheck: {
      tsconfig: './tsconfig.json',
    },
  },
});
