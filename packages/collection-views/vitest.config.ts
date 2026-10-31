/// <reference types="vitest" />
import { realpathSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { searchForWorkspaceRoot } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // @oobleck/systheme 은 이 레포 바깥(형제 레포)에 링크돼 있다. vite 는 작업공간 밖 파일 읽기를 막으므로 그 실제 경로를 허용한다.
  server: { fs: { allow: [searchForWorkspaceRoot(process.cwd()), realpathSync('node_modules/@oobleck/systheme')] } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules', 'dist'],
    css: false,
  },
})
