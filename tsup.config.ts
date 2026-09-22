import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/pointer/index.ts', 'src/hand/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // React 與 MediaPipe 由使用端提供
  external: ['react', 'react/jsx-runtime', '@mediapipe/tasks-vision'],
  // CSS 原樣複製，讓使用端自己決定要不要載
  loader: { '.css': 'copy' },
})
