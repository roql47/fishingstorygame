import React, { useState, useEffect, useRef } from 'react';
import { Shield, Clock, AlertCircle } from 'lucide-react';

const MacroTestModal = ({ 
  isOpen, 
  word, 
  onSubmit, 
  onTimeout,
  isDarkMode = true 
}) => {
  const [timeLeft, setTimeLeft] = useState(60);
  const [response, setResponse] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const timerRef = useRef(null);
  const initializedRef = useRef(false);

  // 모달이 열릴 때 타이머 시작 및 입력창 포커스
  useEffect(() => {
    if (isOpen && !initializedRef.current) {
      initializedRef.current = true;
      setTimeLeft(60);
      setResponse('');
      setIsSubmitting(false);
      
      // 입력창 자동 포커스
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      // 카운트다운 시작
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            onTimeout?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    
    if (!isOpen) {
      initializedRef.current = false;
      setIsSubmitting(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isOpen]);

  // 모달이 닫히지 않도록 ESC 키 방지
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (response.trim() && !isSubmitting) {
      setIsSubmitting(true);
      console.log('[MacroTestModal] 제출 중:', response.trim());
      onSubmit?.(response.trim());
    }
  };

  if (!isOpen) return null;

  // 시간에 따른 색상 변경
  const getTimeColor = () => {
    if (timeLeft > 30) return isDarkMode ? 'text-green-400' : 'text-green-600';
    if (timeLeft > 10) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
    return isDarkMode ? 'text-red-400' : 'text-red-600';
  };

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ zIndex: 9999 }}
      onClick={(e) => e.stopPropagation()} // 클릭 이벤트 전파 방지
    >
      {/* 배경 오버레이 (클릭해도 닫히지 않음) */}
      <div 
        className={`absolute inset-0 ${
          isDarkMode ? 'bg-black/90' : 'bg-gray-900/90'
        } backdrop-blur-sm`}
        onClick={(e) => e.preventDefault()}
      />
      
      {/* 모달 컨텐츠 */}
      <div 
        className={`relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl shadow-2xl border-2 ${
          isDarkMode 
            ? 'bg-gradient-to-br from-gray-900 to-gray-800 border-yellow-500/50' 
            : 'bg-white border-yellow-500'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className={`p-4 rounded-full ${
              isDarkMode ? 'bg-yellow-500/20' : 'bg-yellow-100'
            }`}>
              <Shield className={`w-12 h-12 ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
              }`} />
            </div>
          </div>
          <h2 className={`text-2xl font-bold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            매크로 테스트
          </h2>
          <p className={`text-sm ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            아래 단어를 정확히 입력해주세요
          </p>
        </div>

        {/* 타이머 */}
        <div className="flex items-center justify-center mb-6">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            isDarkMode ? 'bg-gray-800/50' : 'bg-gray-100'
          }`}>
            <Clock className={`w-5 h-5 ${getTimeColor()}`} />
            <span className={`text-2xl font-bold ${getTimeColor()}`}>
              {timeLeft}초
            </span>
          </div>
        </div>

        {/* 캡챠 단어 표시 */}
        <div className={`mb-6 p-6 rounded-xl text-center ${
          isDarkMode 
            ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30' 
            : 'bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-300'
        }`}>
          <div className={`text-sm mb-2 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            다음 단어를 입력하세요:
          </div>
          <div className={`text-4xl font-bold tracking-wider ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {word}
          </div>
        </div>

        {/* 경고 메시지 */}
        <div className={`flex items-start gap-2 mb-6 p-3 rounded-lg ${
          isDarkMode 
            ? 'bg-red-500/10 border border-red-500/30' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <AlertCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
            isDarkMode ? 'text-red-400' : 'text-red-600'
          }`} />
          <p className={`text-sm ${
            isDarkMode ? 'text-red-300' : 'text-red-700'
          }`}>
            대소문자를 정확히 입력해야 합니다. 시간 초과 또는 오답 시 연결이 종료됩니다.
          </p>
        </div>

        {/* 입력 폼 */}
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="여기에 단어를 입력하세요"
            disabled={isSubmitting}
            className={`w-full px-4 py-3 rounded-lg text-lg mb-4 border-2 transition-all ${
              isDarkMode
                ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-500 focus:border-blue-400 focus:bg-gray-750'
                : 'bg-white border-gray-300 text-gray-900 placeholder-gray-400 focus:border-blue-500'
            } focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
              isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
            }`}
            autoComplete="off"
            autoFocus
          />
          
          <button
            type="submit"
            disabled={!response.trim() || isSubmitting}
            className={`w-full py-3 rounded-lg font-bold text-lg transition-all ${
              response.trim() && !isSubmitting
                ? isDarkMode
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white'
                : isDarkMode
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? '제출 중...' : '제출하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default MacroTestModal;

