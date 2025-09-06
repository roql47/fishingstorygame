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
    // 🔒 소스맵 완전 비활성화 (소스 코드 숨김)
    sourcemap: false,
    
    // 🔒 강화된 코드 압축 및 변수명 난독화
    minify: 'terser',
    terserOptions: {
      compress: {
        // 모든 console 출력 제거
        drop_console: true,
        drop_debugger: true,
        // 사용하지 않는 코드 제거
        dead_code: true,
        unused: true,
        // 조건문 최적화
        conditionals: true,
        // 변수 최적화
        reduce_vars: true,
        join_vars: true
      },
      mangle: {
        // 🔒 모든 변수명 난독화
        toplevel: true,
        // 함수 이름도 난독화
        keep_fnames: false,
        // 클래스 이름도 난독화  
        keep_classnames: false
      },
      format: {
        // 모든 주석 제거
        comments: false
      }
    },
    
    // 🔒 파일명 복잡화
    rollupOptions: {
      output: {
        // 복잡한 파일명 생성
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js', 
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  }
})
