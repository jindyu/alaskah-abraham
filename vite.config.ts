import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  base: './',
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
