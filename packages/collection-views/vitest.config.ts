/// <reference types="vitest" />
import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // @oobleck/systheme 은 이 레포 바깥(형제 레포)에 링크돼 있다. vite 는 작업공간 밖 파일 읽기를 막으므로 그 실제 경로를 허용한다.
  server: {
    fs: {
      allow: [
        searchForWorkspaceRoot(process.cwd()),
        realpathSync('node_modules/@oobleck/systheme'),
      ],
    },
  },
  // workstyle 은 따로 받은 react 를 들고 있다(제 시험용). 한 벌만 쓰게 묶는다
  // systheme 안의 '@/…' 는 systheme/src(tsconfig paths 와 같다) — 시험이 systheme 을 흉내 내지 않고 실제로 그릴 때 쓴다
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^@\//, replacement: `${realpathSync('node_modules/@oobleck/systheme')}/src/` },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    css: false,
    // systheme 이 쓰는 lucide-react·framer-motion 이 systheme 쪽 react 를 따로 읽지 않게 vite 로 묶는다(위 dedupe 가 걸리게)
    server: { deps: { inline: [/lucide-react/, /framer-motion/, /motion/] } },
  },
})
