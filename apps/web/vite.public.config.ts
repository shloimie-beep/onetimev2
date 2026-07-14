import path from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: path.resolve(process.cwd(), 'apps/web/public'),
  build: {
    outDir: path.resolve(process.cwd(), 'dist/apps/web/public'),
    emptyOutDir: false,
    manifest: true,
    rollupOptions: {
      input: {
        public: path.resolve(process.cwd(), 'apps/web/src/client/public/public-entry.ts'),
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
