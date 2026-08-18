import { resolve } from 'path'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  build: {
    outDir: resolve(__dirname, 'out/renderer'),
    emptyOutDir: true
  },
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src')
    }
  },
  server: {
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  }
})
