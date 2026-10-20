import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits the decorator metadata that NestJS dependency injection needs.
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['src/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    setupFiles: ['test/setup-env.ts'],
  },
});
