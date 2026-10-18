import { defineConfig } from 'vite';

export default defineConfig({
  // Rutas relativas: el build funciona desde cualquier carpeta o servidor estático.
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1200 },
});
