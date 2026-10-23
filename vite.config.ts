import { defineConfig } from 'vite';

export default defineConfig({
  // The side-panel HTML lives in dist/src/sidepanel/, so packaged asset URLs
  // must be relative rather than extension-root absolute paths.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: 'src/sidepanel/index.html',
        background: 'src/background.ts'
      },
      output: { entryFileNames: '[name].js' }
    }
  }
});
