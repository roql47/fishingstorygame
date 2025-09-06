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
    
    // 🔒 최대 강도 코드 압축 및 난독화
    minify: 'terser',
    terserOptions: {
      compress: {
        // 모든 디버깅 정보 제거
        drop_console: true,
        drop_debugger: true,
        // 사용하지 않는 코드 제거
        dead_code: true,
        unused: true,
        // 조건문 최적화
        conditionals: true,
        evaluate: true,
        // 변수 최적화
        reduce_vars: true,
        reduce_funcs: true,
        join_vars: true,
        collapse_vars: true,
        // 함수 인라인화 (강화)
        inline: 3,
        // 루프 최적화
        loops: true,
        // 불필요한 괄호 제거
        unsafe: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_symbols: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        // 문자열 압축
        passes: 3, // 3번 압축 패스
        pure_getters: true,
        pure_funcs: [
          'console.log', 'console.warn', 'console.error', 
          'console.info', 'console.debug', 'console.trace',
          'Math.floor', 'Math.ceil', 'Math.round'
        ]
      },
      mangle: {
        // 🔒 최대 강도 변수명 난독화
        toplevel: true,
        eval: true,
        // 함수 이름도 난독화
        keep_fnames: false,
        // 클래스 이름도 난독화  
        keep_classnames: false,
        // 프로퍼티 난독화 (주의: 일부 라이브러리 호환성 문제 가능)
        properties: {
          regex: /^_/ // _로 시작하는 프로퍼티만 난독화
        },
        // Safari 10 호환성
        safari10: true,
        // 예약어 사용
        reserved: []
      },
      format: {
        // 모든 주석 제거
        comments: false,
        // 공백 최소화
        beautify: false,
        // 세미콜론 제거
        semicolons: false,
        // 문자열 인용 최적화
        quote_style: 1
      }
    },
    
    // 🔒 파일명 복잡화 및 코드 분할
    rollupOptions: {
      output: {
        // 더 복잡한 파일명 생성
        entryFileNames: (chunkInfo) => {
          const randomStr = Math.random().toString(36).substring(2, 8);
          return `assets/app-${randomStr}-[hash].js`;
        },
        chunkFileNames: (chunkInfo) => {
          const randomStr = Math.random().toString(36).substring(2, 8);
          return `assets/chunk-${randomStr}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const randomStr = Math.random().toString(36).substring(2, 8);
          return `assets/asset-${randomStr}-[hash].[ext]`;
        },
        // 코드 분할 (더 작은 청크로 나누어 분석 어렵게)
        manualChunks: (id) => {
          // 라이브러리별로 분할
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('axios')) return 'http-vendor';
            if (id.includes('socket.io')) return 'socket-vendor';
            if (id.includes('lucide')) return 'icon-vendor';
            return 'vendor';
          }
          // 소스 코드도 기능별로 분할
          if (id.includes('src/')) {
            if (id.includes('component')) return 'components';
            if (id.includes('lib')) return 'utils';
            return 'main';
          }
        }
      }
    },
    
    // 청크 크기 최적화
    chunkSizeWarningLimit: 500, // 더 작은 청크로 분할
    
    // 빌드 최적화
    target: 'es2015'
  }
})
