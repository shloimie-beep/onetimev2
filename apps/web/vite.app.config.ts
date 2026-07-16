import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  plugins: [react()],
  build: {
    outDir: path.resolve(process.cwd(), 'dist/apps/web/public'),
    emptyOutDir: false,
    manifest: 'manifest-app.json',
    rollupOptions: {
      input: {
        crm: path.resolve(process.cwd(), 'apps/web/src/client/app/crm-entry.tsx'),
        portal: path.resolve(process.cwd(), 'apps/web/src/client/app/portal-entry.tsx'),
        'classroom-launch': path.resolve(
          process.cwd(),
          'apps/web/src/client/classroom/zoom-launch-client.ts',
        ),
      },
      output: {
        entryFileNames: 'assets/app-[name].js',
        chunkFileNames: 'assets/app-[name].js',
        assetFileNames: 'assets/app-[name][extname]',
      },
    },
  },
});
