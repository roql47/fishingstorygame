// 🔒 서버에서 게임 데이터를 가져오는 함수들

// 서버 URL 결정
const getServerUrl = () => {
  if (typeof window !== 'undefined') {
    // 프로덕션 환경에서는 현재 도메인 사용
    if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return window.location.origin;
    }
  }
  // 개발 환경에서는 환경변수 또는 기본값 사용
  return import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
};

const serverUrl = getServerUrl();

// API 호출 헬퍼 함수
const fetchGameData = async (endpoint) => {
  try {
    const response = await fetch(`${serverUrl}/api/game-data/${endpoint}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${endpoint}: ${response.status}`);
    }
    const result = await response.json();
    if (!result.success) {
      throw new Error(result.error || `Failed to load ${endpoint}`);
    }
    return result.data;
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error);
    throw error;
  }
};

// 게임 데이터 가져오기 함수들
export const getFishData = async () => {
  return await fetchGameData('fish');
};

export const getFishHealthData = async () => {
  return await fetchGameData('fish-health');
};

export const getFishSpeedData = async () => {
  return await fetchGameData('fish-speed');
};

export const getProbabilityData = async () => {
  return await fetchGameData('probability');
};

export const getPrefixData = async () => {
  return await fetchGameData('prefixes');
};

export const getShopData = async () => {
  return await fetchGameData('shop');
};

// 추가 유틸리티 함수들
export const getAvailableFishBySkill = async (skill) => {
  return await fetchGameData(`available-fish/${skill}`);
};

export const getFishByName = async (name) => {
  return await fetchGameData(`fish/${encodeURIComponent(name)}`);
};

export const getFishByMaterial = async (material) => {
  return await fetchGameData(`fish-by-material/${encodeURIComponent(material)}`);
};

export const getShopItemsByCategory = async (category) => {
  return await fetchGameData(`shop/${category}`);
};