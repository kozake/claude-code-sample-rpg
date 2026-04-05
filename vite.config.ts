/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/claude-code-sample-rpg/',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@content': resolve(__dirname, 'content'),
    },
  },
  server: {
    host: true,
    port: 3000,
  },
  build: {
    target: 'es2020',
    outDir: 'docs',
  },
  assetsInclude: ['**/*.json'],
  test: {
    globals: true,
    environment: 'node',
  },
});
