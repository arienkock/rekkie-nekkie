/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo at https://arienkock.github.io/rekkie-nekkie/,
  // so all built asset URLs must be prefixed with the repo subpath.
  // Must stay in sync with the repository name; deployed by
  // .github/workflows/pages.yml
  base: '/rekkie-nekkie/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})