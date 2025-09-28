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
    
    // 🔒 강력한 코드 압축 및 난독화
    minify: 'terser',
    terserOptions: {
      compress: {
        // 안전한 압축 및 최적화
        drop_console: true,
        drop_debugger: true,
        dead_code: true,
        unused: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        loops: true,
        hoist_funs: true,
        hoist_vars: true,
        if_return: true,
        join_vars: true,
        sequences: true,
        passes: 2, // 2번 압축 패스로 안전하게
        pure_funcs: ['console.log', 'console.info', 'console.warn'], // 함수 제거
        pure_getters: false, // React 호환성을 위해 비활성화
        unsafe: false, // 안전성을 위해 비활성화
        unsafe_comps: false,
        unsafe_math: false,
        unsafe_proto: false
      },
      mangle: {
        // 🔒 안전한 변수명 난독화
        toplevel: false, // React 호환성을 위해 비활성화
        keep_fnames: true, // React 컴포넌트 함수명 보존
        keep_classnames: true, // React 클래스 컴포넌트 보존
        properties: false, // 속성명 난독화 비활성화 (React props 보호)
        safari10: true,
        reserved: ['$', 'jQuery', 'React', 'ReactDOM', 'useState', 'useEffect', 'useCallback', 'useMemo', 'useRef'] // React 훅들도 보존
      },
      format: {
        comments: false, // 모든 주석 제거
        beautify: false, // 코드 압축
        ascii_only: true, // ASCII 문자만 사용
        wrap_iife: true // 즉시실행함수 래핑
      },
      nameCache: {}, // 이름 캐시로 일관성 유지
      ie8: false,
      safari10: true
    },
    
    // 🔒 청크 분할 및 파일명 난독화
    rollupOptions: {
      output: {
        // 더 복잡한 파일명 패턴
        entryFileNames: (chunkInfo) => {
          const hash = Math.random().toString(36).substring(2, 15);
          return `assets/app-${hash}-[hash].js`;
        },
        chunkFileNames: (chunkInfo) => {
          const hash = Math.random().toString(36).substring(2, 15);
          return `assets/chunk-${hash}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          const hash = Math.random().toString(36).substring(2, 15);
          return `assets/[name]-${hash}-[hash].[ext]`;
        },
        
        // 청크 분할로 코드 분석 어렵게 만들기
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-axios': ['axios'],
          'vendor-ui': ['lucide-react'],
          'vendor-utils': ['socket.io-client']
        }
      }
    },
    
    // 추가 보안 설정
    reportCompressedSize: false, // 빌드 정보 숨김
    chunkSizeWarningLimit: 2000 // 청크 크기 경고 임계값 증가
  }
})
