/**
 * 🛒 상점 탭 컴포넌트
 * 낚시대와 악세서리 구매 기능
 */

import React from 'react';
import { ShoppingCart, Coins, Gem, Star, Fish, Diamond } from 'lucide-react';

const ShopTab = ({
  // 상태
  isDarkMode,
  userMoney,
  userAmber,
  userStarPieces,
  
  // 함수
  getAllShopItems,
  buyItem
}) => {
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
      
      {/* 상점 아이템 목록 */}
      <div className="flex-1 p-4">
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
              {(getAllShopItems()?.fishing_rod || []).map((item, index) => (
              <div key={index} className={`p-4 rounded-xl hover:glow-effect transition-all duration-300 group ${
                isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20">
                      <Fish className={`w-6 h-6 group-hover:scale-110 transition-transform ${
                        isDarkMode ? "text-blue-400" : "text-blue-600"
                      }`} />
                    </div>
                    <div>
                      <div className={`font-medium text-base ${
                        isDarkMode ? "text-white" : "text-gray-800"
                        }`}>{item.name}</div>
                      <div className={`text-xs ${
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>{item.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border ${
                        isDarkMode ? "border-yellow-400/20" : "border-yellow-500/30"
                    }`}>
                      <Coins className={`w-3 h-3 ${
                        isDarkMode ? "text-yellow-400" : "text-yellow-600"
                      }`} />
                      <span className={`text-xs font-bold ${
                        isDarkMode ? "text-yellow-400" : "text-yellow-600"
                        }`}>{item.price.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={() => buyItem(item.name, item.price, item.category)}
                        disabled={userMoney < item.price}
                      className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                          userMoney < item.price
                            ? "opacity-50 cursor-not-allowed"
                            : isDarkMode 
                              ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30" 
                              : "bg-blue-500/10 text-blue-600 hover:bg-blue-500/20"
                        }`}
                        title="구매하기"
                      >
                        <ShoppingCart className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </div>

          {/* 악세서리 섹션 */}
          <div>
            <div className={`flex items-center gap-2 mb-4 px-2 ${
              isDarkMode ? "text-purple-400" : "text-purple-600"
            }`}>
              <Diamond className="w-5 h-5" />
              <h3 className="font-semibold">악세서리</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(getAllShopItems()?.accessories || []).map((item, index) => (
                <div key={index} className={`p-4 rounded-xl hover:glow-effect transition-all duration-300 group ${
                  isDarkMode ? "glass-input" : "bg-white/60 backdrop-blur-sm border border-gray-300/40"
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20">
                        <Diamond className={`w-6 h-6 group-hover:scale-110 transition-transform ${
                          isDarkMode ? "text-purple-400" : "text-purple-600"
                        }`} />
                      </div>
                      <div>
                        <div className={`font-medium text-base ${
                          isDarkMode ? "text-white" : "text-gray-800"
                        }`}>{item.name}</div>
                        <div className={`text-xs ${
                          isDarkMode ? "text-gray-400" : "text-gray-600"
                        }`}>{item.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-orange-500/20 to-amber-500/20 border ${
                        isDarkMode ? "border-orange-400/20" : "border-orange-500/30"
                      }`}>
                        <Gem className={`w-3 h-3 ${
                          isDarkMode ? "text-orange-400" : "text-orange-600"
                        }`} />
                        <span className={`text-xs font-bold ${
                          isDarkMode ? "text-orange-400" : "text-orange-600"
                        }`}>{item.price.toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => buyItem(item.name, item.price, item.category, 'amber')}
                        disabled={userAmber < item.price}
                        className={`p-2 rounded-lg hover:scale-110 transition-all duration-300 ${
                          userAmber < item.price
                            ? "opacity-50 cursor-not-allowed"
                            : isDarkMode 
                              ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30" 
                              : "bg-purple-500/10 text-purple-600 hover:bg-purple-500/20"
                        }`}
                        title="구매하기"
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShopTab;
