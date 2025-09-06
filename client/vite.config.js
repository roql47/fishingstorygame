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
        // 기본 디버깅 정보 제거
        drop_console: true,
        drop_debugger: true,
        // 안전한 코드 최적화만 적용
        dead_code: true,
        unused: true,
        conditionals: true,
        evaluate: true,
        // 변수 최적화 (보수적)
        reduce_vars: true,
        join_vars: true,
        // 함수 인라인화 (보수적)
        inline: 1, // 3에서 1로 줄임 (라이브러리 호환성)
        // 루프 최적화
        loops: true,
        // 위험한 최적화 비활성화 (라이브러리 호환성)
        unsafe: false,
        unsafe_comps: false,
        unsafe_Function: false,
        unsafe_math: false,
        unsafe_symbols: false,
        unsafe_methods: false,
        unsafe_proto: false,
        unsafe_regexp: false,
        // 압축 패스 줄임 (안정성)
        passes: 1, // 3에서 1로 줄임
        pure_getters: false, // 라이브러리 호환성을 위해 비활성화
        pure_funcs: [
          'console.log', 'console.warn', 'console.error', 
          'console.info', 'console.debug', 'console.trace'
        ]
      },
      mangle: {
        // 🔒 변수명 난독화 (라이브러리 호환성 고려)
        toplevel: true,
        // 함수 이름 보존 (라이브러리 호환성)
        keep_fnames: true,
        // 클래스 이름 보존 (라이브러리 호환성)
        keep_classnames: true,
        // 프로퍼티 난독화 비활성화 (라이브러리 호환성)
        properties: false,
        // Safari 10 호환성
        safari10: true,
        // 라이브러리 관련 예약어 보호
        reserved: [
          // Socket.IO 관련
          'emit', 'on', 'off', 'connect', 'disconnect', 'socket',
          // React 관련
          'React', 'ReactDOM', 'useState', 'useEffect', 'useCallback',
          // Axios 관련
          'axios', 'get', 'post', 'put', 'delete',
          // 기타 중요한 함수들
          'addEventListener', 'removeEventListener', 'setTimeout', 'setInterval'
        ]
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
