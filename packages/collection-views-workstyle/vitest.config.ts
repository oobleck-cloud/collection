/// <reference types="vitest" />
import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'

const systheme = realpathSync('node_modules/@oobleck/systheme')

export default defineConfig({
  plugins: [react()],
  // collection-views·systheme·workstyle 은 이 패키지 바깥(형제 레포·패키지)에 링크돼 있다 — 그 실제 경로를 읽게 허용한다.
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        systheme,
        realpathSync('node_modules/@oobleck/workstyle'),
        realpathSync('node_modules/@oobleck/collection-views'),
      ],
    },
  },
  // 여러 곳에서 링크된 패키지가 react 를 한 벌만 쓰게 묶고, systheme 안의 '@/…' 는 systheme/src 로(tsconfig paths 와 같다)
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [{ find: /^@\//, replacement: `${systheme}/src/` }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['../collection-views/src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    // systheme 이 쓰는 framer-motion 이 systheme 쪽 react 를 따로 읽지 않게 vite 로 묶는다
    server: { deps: { inline: [/framer-motion/, /motion/, /lucide-react/] } },
  },
})
