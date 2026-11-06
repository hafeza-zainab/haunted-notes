import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  worker: {
    format: 'es',
  },
  optimizeDeps: {
    // @huggingface/transformers uses dynamic imports and top-level await;
    // excluding it from pre-bundling avoids CommonJS transform issues.
    exclude: ['@huggingface/transformers'],
  },
  build: {
    target: 'esnext',
  },
})
