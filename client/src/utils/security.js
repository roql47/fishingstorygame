// 🔒 클라이언트 보안 유틸리티

// 🔒 문자열 간단 인코딩 (완전한 보안은 아니지만 기본 난독화)
export const encodeString = (str) => {
  return btoa(str).split('').reverse().join('');
};

export const decodeString = (encoded) => {
  return atob(encoded.split('').reverse().join(''));
};

// 🔒 API 엔드포인트 난독화
const _endpoints = {
  a: '/api/toggle-admin',
  b: '/api/reset-account', 
  c: '/api/fishing',
  d: '/api/raid/summon',
  e: '/api/raid/attack',
  f: '/api/cooldown',
  g: '/api/inventory',
  h: '/api/user-money',
  i: '/api/user-amber',
  j: '/api/star-pieces'
};

export const getEndpoint = (key) => _endpoints[key] || key;

// 🔒 개발자 도구 감지 (기본적인 수준)
const devtools = {
  open: false,
  orientation: null
};

export const detectDevTools = () => {
  try {
    const threshold = 160;
    
    const checkDevTools = () => {
      try {
        if (window.outerHeight - window.innerHeight > threshold || 
            window.outerWidth - window.innerWidth > threshold) {
          if (!devtools.open) {
            devtools.open = true;
            if (console && console.clear) console.clear();
            if (console && console.log) {
              console.log('%c🔒 개발자 도구가 감지되었습니다.', 'color: red; font-size: 20px; font-weight: bold;');
              console.log('%c⚠️  이 애플리케이션의 소스코드는 보호되고 있습니다.', 'color: orange; font-size: 14px;');
              console.log('%c🚫 무단 수정이나 해킹 시도는 금지됩니다.', 'color: red; font-size: 14px;');
            }
          }
        } else {
          devtools.open = false;
        }
      } catch (e) {
        // 에러 무시
      }
    };
    
    setInterval(checkDevTools, 1000); // 1초로 늘려서 성능 개선
  } catch (error) {
    // 개발자 도구 감지 실패해도 앱은 정상 동작
  }
};

// 🔒 콘솔 보호 (프로덕션에서만)
export const protectConsole = () => {
  if (import.meta.env.PROD) {
    try {
      // 콘솔 메서드들을 빈 함수로 대체
      const noop = () => {};
      const consoleMethods = ['log', 'debug', 'info', 'warn', 'error', 'trace', 'dir', 'group', 'groupCollapsed', 'groupEnd', 'time', 'timeEnd', 'profile', 'profileEnd', 'dirxml', 'assert', 'count'];
      
      consoleMethods.forEach(method => {
        if (window.console && typeof window.console[method] === 'function') {
          window.console[method] = noop;
        }
      });
      
      // 개발자 도구 감지 (안전하게)
      setTimeout(() => {
        detectDevTools();
      }, 1000);
    } catch (error) {
      // 보안 기능 실패해도 앱은 정상 동작하도록
      console.warn('보안 기능 초기화 실패:', error);
    }
  }
};

// 🔒 우클릭 및 키보드 단축키 비활성화 (선택적)
export const disableRightClick = () => {
  if (import.meta.env.PROD) {
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
    
    document.addEventListener('keydown', (e) => {
      // F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U 등 차단
      if (e.key === 'F12' || 
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'U')) {
        e.preventDefault();
        return false;
      }
    });
  }
};

// 🔒 소스코드 보호 메시지
export const showProtectionMessage = () => {
  if (import.meta.env.PROD) {
    console.log('%c🦊 여우이야기', 'color: #ff6b35; font-size: 24px; font-weight: bold;');
    console.log('%c🔒 이 애플리케이션은 보안이 적용되어 있습니다.', 'color: #333; font-size: 14px;');
    console.log('%c⚠️  소스코드 수정이나 해킹 시도는 금지됩니다.', 'color: red; font-size: 12px;');
    console.log('%c📞 문의: 개발팀', 'color: #666; font-size: 12px;');
  }
};
