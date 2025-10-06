import { useEffect, useState } from 'react';

/**
 * 모바일 최적화 훅
 * 모바일 디바이스 감지 및 최적화 설정 제공
 */
export function useMobileOptimization() {
  const [mobileConfig, setMobileConfig] = useState({
    isMobile: false,
    isTablet: false,
    isLowEndDevice: false,
    shouldReduceAnimations: false,
    maxChatMessages: 100,
    shouldLazyLoad: false
  });

  useEffect(() => {
    const checkDevice = () => {
      // 모바일 디바이스 감지
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isTablet = /iPad|Android(?!.*Mobile)/i.test(navigator.userAgent);
      
      // 저사양 디바이스 감지 (하드웨어 동시성)
      const isLowEndDevice = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4;
      
      // 애니메이션 감소 설정
      const shouldReduceAnimations = isMobile || isLowEndDevice;
      
      // 채팅 메시지 최대 개수
      const maxChatMessages = isMobile ? 50 : 100;
      
      // 지연 로딩 설정
      const shouldLazyLoad = isMobile || isLowEndDevice;

      setMobileConfig({
        isMobile,
        isTablet,
        isLowEndDevice,
        shouldReduceAnimations,
        maxChatMessages,
        shouldLazyLoad
      });

      console.log('📱 모바일 최적화 설정:', {
        isMobile,
        isTablet,
        isLowEndDevice,
        shouldReduceAnimations
      });
    };

    checkDevice();

    // 화면 크기 변경 시 재확인
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  return mobileConfig;
}
