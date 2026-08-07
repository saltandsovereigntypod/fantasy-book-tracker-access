import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/fantasy-book-tracker-access/',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
