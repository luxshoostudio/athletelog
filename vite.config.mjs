import { defineConfig } from 'vite';

export default defineConfig(({ command }) => ({
  define: command === 'build' ? { 'process.env.NODE_ENV':'"production"' } : {},
  build: {
    outDir: 'vendor/workout-v2',
    emptyOutDir: true,
    lib: {
      entry: 'src/workouts/main.jsx',
      formats: ['es'],
      fileName: () => 'workout-v2.js',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: { assetFileNames: asset => asset.name?.endsWith('.css') ? 'workout-v2.css' : '[name][extname]' },
    },
  },
}));
