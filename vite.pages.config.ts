import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/postcss';
import { fileURLToPath } from 'node:url';

// Pages serves this project under /ticatuka/, without a server runtime.
export default defineConfig({
  base: '/ticatuka/',
  plugins: [react()],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
  define: { 'process.env.NEXT_PUBLIC_BASE_PATH': JSON.stringify('/ticatuka') },
  build: { outDir: 'dist-pages', emptyOutDir: true },
});
