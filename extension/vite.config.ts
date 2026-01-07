import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import { resolve } from 'path'
import manifest from './manifest.json'

// Plugin to copy CSS files to dist
function copyContentStyles() {
  return {
    name: 'copy-content-styles',
    closeBundle() {
      const srcPath = resolve(__dirname, 'src/content/styles.css')
      const destDir = resolve(__dirname, 'dist/src/content')
      const destPath = resolve(destDir, 'styles.css')

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true })
      }
      copyFileSync(srcPath, destPath)
      console.log('✓ Content styles copied to dist')
    }
  }
}

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
    copyContentStyles(),
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
      },
    },
  },
})
