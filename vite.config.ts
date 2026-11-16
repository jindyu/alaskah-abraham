/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
  // 14개 무대를 모두 짓는 테스트는 부하 시 기본 5초를 넘긴다 — 전역 제한을 넉넉히
  test: { testTimeout: 60000 },
  build: {
    target: mode === 'android' ? 'chrome80' : 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/three')) {
            return 'three';
          }
        },
      },
    },
  },
}));
