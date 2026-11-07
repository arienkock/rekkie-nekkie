/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const APP_VERSION = process.env.GITHUB_SHA ?? 'development'

/** version.json next to index.html: open tabs compare it with their own
 *  version and reload themselves on the home screen (src/app-update.ts). */
function versionFile(): Plugin {
  return {
    name: 'rekkie-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: APP_VERSION }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo at https://arienkock.github.io/rekkie-nekkie/,
  // so all built asset URLs must be prefixed with the repo subpath.
  // Must stay in sync with the repository name; deployed by
  // .github/workflows/pages.yml
  base: '/rekkie-nekkie/',
  plugins: [react(), versionFile()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(APP_VERSION),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
