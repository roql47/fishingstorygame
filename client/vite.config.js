import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  base: './',
  build: {
    // 🔒 소스맵 비활성화 (소스 코드 숨김)
    sourcemap: false,
    
    // 🔒 안전한 코드 압축 (라이브러리 호환성 우선)
    minify: 'terser',
    terserOptions: {
      compress: {
        // 기본적인 최적화만
        drop_console: true,
        drop_debugger: true,
        dead_code: true,
        unused: true
      },
      mangle: {
        // 변수명 난독화 비활성화 (안정성 우선)
        toplevel: false,
        keep_fnames: true,
        keep_classnames: true,
        properties: false
      },
      format: {
        comments: false
      }
    },
    
    // 🔒 강제 캐시 무효화를 위한 파일명 변경
    rollupOptions: {
      output: {
        entryFileNames: 'assets/main-[hash]-' + Date.now() + '.js',
        chunkFileNames: 'assets/chunk-[hash]-' + Date.now() + '.js',
        assetFileNames: 'assets/[name]-[hash]-' + Date.now() + '.[ext]'
      }
    }
  }
})
