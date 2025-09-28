/**
 * 🛒 상점 탭 컴포넌트
 * 낚시대와 악세서리 구매 기능
 */

import React, { useState } from 'react';
import { ShoppingCart, Coins, Gem, Star, Fish, Diamond, Package } from 'lucide-react';

const ShopTab = ({
  // 상태
  isDarkMode,
  userMoney,
  userAmber,
  userStarPieces,
  
  // 함수
  getAllShopItems,
  buyItem,
  exchangeEtherKeys
}) => {
  const [activeShopTab, setActiveShopTab] = useState('equipment'); // equipment, items

  return (
    <div className={`rounded-2xl board-shadow min-h-full flex flex-col ${
      isDarkMode ? "glass-card" : "bg-white/80 backdrop-blur-md border border-gray-300/30"
    }`}>
      {/* 상점 헤더 */}
      <div className={`border-b p-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
              <ShoppingCart className={`w-4 h-4 ${
                isDarkMode ? "text-purple-400" : "text-purple-600"
              }`} />
            </div>
            <div>
              <h2 className={`text-lg font-semibold ${
                isDarkMode ? "text-white" : "text-gray-800"
              }`}>장비 상점</h2>
              <p className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>낚시 장비와 악세서리를 구매하세요</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
              isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
            }`}>
              <Coins className={`w-4 h-4 ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-yellow-400" : "text-yellow-600"
              }`}>{(userMoney || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>골드</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border ${
              isDarkMode ? "border-orange-400/20" : "border-orange-500/30"
            }`}>
              <Gem className={`w-4 h-4 ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>{(userAmber || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>호박석</span>
            </div>
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border ${
              isDarkMode ? "border-blue-400/20" : "border-blue-500/30"
            }`}>
              <Star className={`w-4 h-4 ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`} />
              <span className={`text-sm font-bold ${
                isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}>{(userStarPieces || 0).toLocaleString()}</span>
              <span className={`text-xs ${
                isDarkMode ? "text-gray-400" : "text-gray-600"
              }`}>별조각</span>
            </div>
          </div>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className={`border-b px-4 ${
        isDarkMode ? "border-white/10" : "border-gray-300/20"
      }`}>
        <div className="flex gap-1">
          <button
            onClick={() => setActiveShopTab('equipment')}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-all duration-300 font-medium ${
              activeShopTab === 'equipment'
                ? isDarkMode
                  ? "bg-blue-500/20 text-blue-400 border-b-2 border-blue-400"
                  : "bg-blue-500/10 text-blue-600 border-b-2 border-blue-500"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Fish className="w-4 h-4" />
            <span>장비</span>
          </button>
          <button
            onClick={() => setActiveShopTab('items')}
            className={`flex items-center gap-2 px-4 py-3 rounded-t-lg transition-all duration-300 font-medium ${
              activeShopTab === 'items'
                ? isDarkMode
                  ? "bg-purple-500/20 text-purple-400 border-b-2 border-purple-400"
                  : "bg-purple-500/10 text-purple-600 border-b-2 border-purple-500"
                : isDarkMode
                  ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                  : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>기타</span>
          </button>
        </div>
      </div>
      
      {/* 상점 아이템 목록 */}
      <div className="flex-1 p-4">
        {/* 장비 탭 */}
        {activeShopTab === 'equipment' && (
          <div className="space-y-6">
            {/* 낚시대 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-blue-400" : "text-blue-600"
              }`}>
                <Fish className="w-5 h-5" />
                <h3 className="font-semibold">낚시대</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getAllShopItems('낚시대').map((item, index) => (
                  <div key={index} className={`p-4 rounded-xl border transition-all duration-300 hover:scale-105 ${
                    isDarkMode 
                      ? "bg-blue-500/10 border-blue-500/30 hover:border-blue-400/50" 
                      : "bg-blue-500/5 border-blue-500/20 hover:border-blue-400/40"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isDarkMode ? "bg-blue-500/20" : "bg-blue-500/10"
                        }`}>
                          <Fish className={`w-6 h-6 ${
                            isDarkMode ? "text-blue-400" : "text-blue-600"
                          }`} />
                        </div>
                        <div>
                          <h4 className={`font-bold ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>{item.name}</h4>
                          <p className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>{item.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                        isDarkMode 
                          ? "bg-yellow-500/20 border border-yellow-500/30" 
                          : "bg-yellow-500/10 border border-yellow-500/20"
                      }`}>
                        <Coins className={`w-4 h-4 ${
                          isDarkMode ? "text-yellow-400" : "text-yellow-600"
                        }`} />
                        <span className={`text-sm font-bold ${
                          isDarkMode ? "text-yellow-400" : "text-yellow-600"
                        }`}>{item.price.toLocaleString()}</span>
                        <span className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>골드</span>
                      </div>
                      <button
                        onClick={() => buyItem(item)}
                        disabled={!userMoney || userMoney < item.price}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          !userMoney || userMoney < item.price
                            ? isDarkMode
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : isDarkMode
                              ? "bg-blue-600 hover:bg-blue-500 text-white"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                        } hover:scale-105 active:scale-95`}
                      >
                        구매하기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 악세서리 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-orange-400" : "text-orange-600"
              }`}>
                <Diamond className="w-5 h-5" />
                <h3 className="font-semibold">악세서리</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getAllShopItems('악세서리').map((item, index) => (
                  <div key={index} className={`p-4 rounded-xl border transition-all duration-300 hover:scale-105 ${
                    isDarkMode 
                      ? "bg-orange-500/10 border-orange-500/30 hover:border-orange-400/50" 
                      : "bg-orange-500/5 border-orange-500/20 hover:border-orange-400/40"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${
                          isDarkMode ? "bg-orange-500/20" : "bg-orange-500/10"
                        }`}>
                          <Diamond className={`w-6 h-6 ${
                            isDarkMode ? "text-orange-400" : "text-orange-600"
                          }`} />
                        </div>
                        <div>
                          <h4 className={`font-bold ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>{item.name}</h4>
                          <p className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>{item.description}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                        isDarkMode 
                          ? "bg-orange-500/20 border border-orange-500/30" 
                          : "bg-orange-500/10 border border-orange-500/20"
                      }`}>
                        <Gem className={`w-4 h-4 ${
                          isDarkMode ? "text-orange-400" : "text-orange-600"
                        }`} />
                        <span className={`text-sm font-bold ${
                          isDarkMode ? "text-orange-400" : "text-orange-600"
                        }`}>{item.price.toLocaleString()}</span>
                        <span className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>호박석</span>
                      </div>
                      <button
                        onClick={() => buyItem(item)}
                        disabled={!userAmber || userAmber < item.price}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          !userAmber || userAmber < item.price
                            ? isDarkMode
                              ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                              : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : isDarkMode
                              ? "bg-orange-600 hover:bg-orange-500 text-white"
                              : "bg-orange-500 hover:bg-orange-600 text-white"
                        } hover:scale-105 active:scale-95`}
                      >
                        구매하기
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 기타 탭 */}
        {activeShopTab === 'items' && (
          <div className="space-y-6">
            {/* 에테르 열쇠 교환 섹션 */}
            <div>
              <div className={`flex items-center gap-2 mb-4 px-2 ${
                  isDarkMode ? "text-purple-400" : "text-purple-600"
              }`}>
                <Diamond className="w-5 h-5" />
                <h3 className="font-semibold">에테르 열쇠</h3>
              </div>
              <div className={`p-4 rounded-xl border ${
                isDarkMode 
                  ? "bg-purple-500/10 border-purple-500/30" 
                  : "bg-purple-500/5 border-purple-500/20"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${
                        isDarkMode ? "bg-purple-500/20" : "bg-purple-500/10"
                      }`}>
                        <Diamond className={`w-6 h-6 ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`} />
                      </div>
                      <div>
                        <h4 className={`font-bold ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>에테르 열쇠 5개</h4>
                        <p className={`text-sm ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>파티던전 입장권</p>
                      </div>
                    </div>
                    <div className={`text-xs ${
                      isDarkMode ? "text-gray-400" : "text-gray-600"
                    }`}>
                      파티던전을 생성하거나 참여할 때 필요한 특별한 열쇠입니다.
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
                      isDarkMode 
                        ? "bg-blue-500/20 border border-blue-500/30" 
                        : "bg-blue-500/10 border border-blue-500/20"
                    }`}>
                      <Star className={`w-4 h-4 ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`} />
                      <span className={`text-sm font-bold ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`}>1</span>
                      <span className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      }`}>별조각</span>
                    </div>
                    <button
                      onClick={() => exchangeEtherKeys()}
                      disabled={!userStarPieces || userStarPieces < 1}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        !userStarPieces || userStarPieces < 1
                          ? isDarkMode
                            ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                            : "bg-gray-300 text-gray-500 cursor-not-allowed"
                          : isDarkMode
                            ? "bg-purple-600 hover:bg-purple-500 text-white"
                            : "bg-purple-500 hover:bg-purple-600 text-white"
                      } hover:scale-105 active:scale-95`}
                    >
                      교환하기
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ShopTab;