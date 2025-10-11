import React, { useState, useEffect } from 'react';
import { X, ShoppingCart, Package, Coins, TrendingUp, User, Clock } from 'lucide-react';
import { CRAFTING_RECIPES, getMaterialTier } from '../data/craftingData';
import { getSocket } from '../lib/socket';

const MarketModal = ({ 
  showMarketModal, 
  setShowMarketModal, 
  isDarkMode,
  inventory,
  materials,
  setMaterials,
  gold,
  setGold,
  amber,
  setAmber,
  starPieces,
  setStarPieces,
  nickname,
  fishingSkill,
  onPurchase,
  onListItem,
  onCancelListing
}) => {
  const [activeTab, setActiveTab] = useState('browse'); // browse, myListings, myItems, history, allHistory
  const [marketListings, setMarketListings] = useState([]);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [allTradeHistory, setAllTradeHistory] = useState([]);
  const [itemAveragePrices, setItemAveragePrices] = useState({});
  const [selectedItem, setSelectedItem] = useState(null);
  const [listPrice, setListPrice] = useState('');
  const [listQuantity, setListQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  // 거래소 목록 불러오기 및 소켓 이벤트 설정
  useEffect(() => {
    if (!showMarketModal) return;
    
    fetchMarketListings();
    fetchTradeHistory();
    fetchAllTradeHistory();
    fetchAveragePrices();
    
    // 소켓 이벤트 리스너 설정
    const socket = getSocket();
    
    const handleMarketUpdate = (data) => {
      fetchMarketListings(); // 거래소 목록 새로고침
      fetchTradeHistory(); // 내 거래내역 새로고침
      fetchAllTradeHistory(); // 전체 거래내역 새로고침
      fetchAveragePrices(); // 평균가 새로고침
    };
    
    socket.on('marketUpdate', handleMarketUpdate);
    
    return () => {
      socket.off('marketUpdate', handleMarketUpdate);
    };
  }, [showMarketModal]);

  const fetchMarketListings = async () => {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const response = await fetch(`${serverUrl}/api/market/listings`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMarketListings(data);
      }
    } catch (error) {
      console.error('거래소 목록 로딩 실패:', error);
    }
  };

  const fetchTradeHistory = async () => {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const response = await fetch(`${serverUrl}/api/market/history`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTradeHistory(data);
      }
    } catch (error) {
      console.error('거래 내역 로딩 실패:', error);
    }
  };

  const fetchAllTradeHistory = async () => {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const response = await fetch(`${serverUrl}/api/market/history/all`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllTradeHistory(data);
      }
    } catch (error) {
      console.error('전체 거래 내역 로딩 실패:', error);
    }
  };

  const fetchAveragePrices = async () => {
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const response = await fetch(`${serverUrl}/api/market/average-prices`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setItemAveragePrices(data);
      }
    } catch (error) {
      console.error('평균 가격 로딩 실패:', error);
    }
  };

  // 거래 가능한 아이템 목록 가져오기
  const getTradableItems = () => {
    const items = [];
    
    // 1. 분해 재료
    if (materials) {
      const allMaterials = new Set();
      CRAFTING_RECIPES.forEach(recipe => {
        allMaterials.add(recipe.inputMaterial);
        allMaterials.add(recipe.outputMaterial);
      });
      
      materials.filter(item => item.material && allMaterials.has(item.material))
        .forEach(item => {
          items.push({ 
            type: 'material', 
            name: item.material, 
            count: item.count,
            icon: '📦'
          });
        });
    }
    
    // 2. 호박석
    if (amber && amber > 0) {
      items.push({ 
        type: 'amber', 
        name: '호박석', 
        count: amber,
        icon: '💎'
      });
    }
    
    // 3. 별조각
    if (starPieces && starPieces > 0) {
      items.push({ 
        type: 'starPiece', 
        name: '별조각', 
        count: starPieces,
        icon: '⭐'
      });
    }
    
    return items;
  };

  // 아이템 등록
  const handleListItem = async () => {
    if (!selectedItem || !listPrice || listPrice <= 0 || listQuantity <= 0) {
      alert('가격과 수량을 올바르게 입력해주세요.');
      return;
    }

    if (listQuantity > selectedItem.count) {
      alert('보유 수량보다 많이 등록할 수 없습니다.');
      return;
    }

    // 보증금 체크 (먼저 확인!)
    const totalPrice = parseInt(listPrice) * listQuantity;
    const deposit = Math.floor(totalPrice * 0.05);
    
    if (gold < deposit) {
      alert(`보증금이 부족합니다.\n필요한 보증금: ${deposit.toLocaleString()}골드\n현재 골드: ${gold.toLocaleString()}골드`);
      return;
    }

    setLoading(true);
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const response = await fetch(`${serverUrl}/api/market/list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: JSON.stringify({
          itemName: selectedItem.name,
          itemType: selectedItem.type,
          quantity: listQuantity,
          pricePerUnit: parseInt(listPrice)
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        const totalPrice = parseInt(listPrice) * listQuantity;
        const deposit = Math.floor(totalPrice * 0.05);

        // 즉시 로컬 상태 업데이트 (아이템 차감 + 보증금 차감)
        if (selectedItem.type === 'material') {
          const updatedMaterials = materials.map(m => {
            if (m.material === selectedItem.name) {
              const newCount = m.count - listQuantity;
              return newCount > 0 ? { ...m, count: newCount } : null;
            }
            return m;
          }).filter(m => m !== null);
          setMaterials(updatedMaterials);
        } else if (selectedItem.type === 'amber') {
          setAmber(prev => prev - listQuantity);
        } else if (selectedItem.type === 'starPiece') {
          setStarPieces(prev => prev - listQuantity);
        }

        // 보증금 차감
        setGold(prev => prev - deposit);
        
        alert(`아이템이 거래소에 등록되었습니다!\n보증금 ${deposit.toLocaleString()}골드가 차감되었습니다.`);
        setSelectedItem(null);
        setListPrice('');
        setListQuantity(1);
        fetchMarketListings();
        
        if (onListItem) onListItem();
      } else {
        alert(data.message || '등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('아이템 등록 실패:', error);
      alert('아이템 등록 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 아이템 구매
  const handlePurchase = async (listing) => {
    if (gold < listing.pricePerUnit * listing.quantity) {
      alert('골드가 부족합니다.');
      return;
    }

    if (listing.sellerNickname === nickname) {
      alert('자신의 물건은 구매할 수 없습니다.');
      return;
    }

    if (!confirm(`${listing.itemName} ${listing.quantity}개를 ${(listing.pricePerUnit * listing.quantity).toLocaleString()}골드에 구매하시겠습니까?`)) {
      return;
    }

    setLoading(true);
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const listingId = listing._id || listing.id;
      const response = await fetch(`${serverUrl}/api/market/purchase/${listingId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        // 즉시 로컬 상태 업데이트 (아이템 추가, 골드 차감)
        if (listing.itemType === 'material') {
          const existingMaterial = materials.find(m => m.material === listing.itemName);
          if (existingMaterial) {
            const updatedMaterials = materials.map(m => 
              m.material === listing.itemName 
                ? { ...m, count: m.count + listing.quantity }
                : m
            );
            setMaterials(updatedMaterials);
          } else {
            setMaterials([...materials, { material: listing.itemName, count: listing.quantity }]);
          }
        } else if (listing.itemType === 'amber') {
          setAmber(prev => prev + listing.quantity);
        } else if (listing.itemType === 'starPiece') {
          setStarPieces(prev => prev + listing.quantity);
        }
        
        setGold(prev => prev - (listing.pricePerUnit * listing.quantity));
        
        alert('구매가 완료되었습니다!');
        fetchMarketListings();
        
        if (onPurchase) onPurchase();
      } else {
        alert(data.message || '구매에 실패했습니다.');
      }
    } catch (error) {
      console.error('구매 실패:', error);
      alert('구매 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 등록 취소
  const handleCancelListing = async (listing) => {
    if (!confirm('등록을 취소하시겠습니까?')) {
      return;
    }

    setLoading(true);
    try {
      const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
      const listingId = listing._id || listing.id;
      const response = await fetch(`${serverUrl}/api/market/cancel/${listingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        // 즉시 로컬 상태 업데이트 (아이템 반환 + 보증금 반환)
        if (listing.itemType === 'material') {
          const existingMaterial = materials.find(m => m.material === listing.itemName);
          if (existingMaterial) {
            const updatedMaterials = materials.map(m => 
              m.material === listing.itemName 
                ? { ...m, count: m.count + listing.quantity }
                : m
            );
            setMaterials(updatedMaterials);
          } else {
            setMaterials([...materials, { material: listing.itemName, count: listing.quantity }]);
          }
        } else if (listing.itemType === 'amber') {
          setAmber(prev => prev + listing.quantity);
        } else if (listing.itemType === 'starPiece') {
          setStarPieces(prev => prev + listing.quantity);
        }

        // 보증금 반환
        setGold(prev => prev + listing.deposit);
        
        alert(`등록이 취소되었습니다.\n보증금 ${listing.deposit.toLocaleString()}골드가 반환되었습니다.`);
        fetchMarketListings();
        
        if (onCancelListing) onCancelListing();
      } else {
        alert(data.message || '취소에 실패했습니다.');
      }
    } catch (error) {
      console.error('취소 실패:', error);
      alert('취소 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!showMarketModal) return null;

  const tradableItems = getTradableItems();
  const myListings = marketListings.filter(listing => listing.sellerNickname === nickname);
  const allListings = marketListings; // 모든 등록 아이템 표시

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`max-w-5xl w-full max-h-[90vh] rounded-2xl overflow-hidden ${
        isDarkMode 
          ? "glass-card border border-white/10" 
          : "bg-white/95 backdrop-blur-md border border-gray-300/30"
      }`}>
        {/* 헤더 */}
        <div className={`p-6 border-b ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <h2 className={`text-2xl font-bold flex items-center gap-2 ${
              isDarkMode ? "text-white" : "text-gray-800"
            }`}>
              <ShoppingCart className="w-7 h-7" />
              거래소
            </h2>
            <button
              onClick={() => setShowMarketModal(false)}
              className={`p-2 rounded-full transition-all duration-300 ${
                isDarkMode 
                  ? "hover:bg-white/10 text-gray-400 hover:text-white" 
                  : "hover:bg-gray-100 text-gray-600 hover:text-gray-800"
              }`}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setActiveTab('browse')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'browse'
                  ? isDarkMode
                    ? "bg-blue-500/20 text-blue-400 border border-blue-400/30"
                    : "bg-blue-500/10 text-blue-600 border border-blue-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              거래소 ({allListings.length})
            </button>
            <button
              onClick={() => setActiveTab('myListings')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'myListings'
                  ? isDarkMode
                    ? "bg-green-500/20 text-green-400 border border-green-400/30"
                    : "bg-green-500/10 text-green-600 border border-green-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Package className="w-4 h-4" />
              내 등록 ({myListings.length})
            </button>
            <button
              onClick={() => setActiveTab('myItems')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'myItems'
                  ? isDarkMode
                    ? "bg-purple-500/20 text-purple-400 border border-purple-400/30"
                    : "bg-purple-500/10 text-purple-600 border border-purple-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Package className="w-4 h-4" />
              내 아이템 ({tradableItems.length})
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'history'
                  ? isDarkMode
                    ? "bg-orange-500/20 text-orange-400 border border-orange-400/30"
                    : "bg-orange-500/10 text-orange-600 border border-orange-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Clock className="w-4 h-4" />
              내 거래내역
            </button>
            <button
              onClick={() => setActiveTab('allHistory')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
                activeTab === 'allHistory'
                  ? isDarkMode
                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-400/30"
                    : "bg-cyan-500/10 text-cyan-600 border border-cyan-500/30"
                  : isDarkMode
                    ? "text-gray-400 hover:text-gray-300 hover:bg-white/5"
                    : "text-gray-600 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              전체 거래내역
            </button>
          </div>
        </div>

        {/* 컨텐츠 */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* 거래소 탭 */}
          {activeTab === 'browse' && (
            <div>
              {allListings.length === 0 ? (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <ShoppingCart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>현재 거래소에 등록된 아이템이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {allListings.map((listing) => (
                    <div
                      key={listing._id || listing.id}
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                          : "bg-white border-gray-300/50 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>
                            {listing.itemType === 'amber' ? '💎' : listing.itemType === 'starPiece' ? '⭐' : '📦'} {listing.itemName}
                          </h3>
                          <div className={`flex items-center gap-2 text-sm mb-2 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            <User className="w-4 h-4" />
                            {listing.sellerNickname}
                          </div>
                          <div className={`text-sm mb-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            수량: {listing.quantity}개
                          </div>
                          <div className={`text-lg font-bold ${
                            isDarkMode ? "text-yellow-400" : "text-yellow-600"
                          }`}>
                            <Coins className="w-4 h-4 inline mr-1" />
                            {(listing.pricePerUnit * listing.quantity).toLocaleString()}골드
                            <span className={`text-sm ml-2 ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              (개당 {listing.pricePerUnit.toLocaleString()})
                            </span>
                          </div>
                          {itemAveragePrices[listing.itemName] && (
                            <div className={`text-xs mt-1 ${
                              isDarkMode ? "text-gray-500" : "text-gray-500"
                            }`}>
                              최근 평균가: {Math.round(itemAveragePrices[listing.itemName].avgPrice).toLocaleString()}골드
                              {listing.pricePerUnit < itemAveragePrices[listing.itemName].avgPrice ? (
                                <span className="ml-1 text-green-500">↓ 저렴</span>
                              ) : listing.pricePerUnit > itemAveragePrices[listing.itemName].avgPrice ? (
                                <span className="ml-1 text-red-500">↑ 비쌈</span>
                              ) : (
                                <span className="ml-1 text-blue-500">= 평균</span>
                              )}
                              <span className="ml-1">({itemAveragePrices[listing.itemName].tradeCount}회 거래)</span>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handlePurchase(listing)}
                          disabled={loading || gold < listing.pricePerUnit * listing.quantity || listing.sellerNickname === nickname}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                            loading || gold < listing.pricePerUnit * listing.quantity || listing.sellerNickname === nickname
                              ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                              : isDarkMode
                                ? "bg-blue-500/20 text-blue-400 border border-blue-400/30 hover:bg-blue-500/30"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                          }`}
                        >
                          {listing.sellerNickname === nickname ? "내 물건" : "구매"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 내 등록 탭 */}
          {activeTab === 'myListings' && (
            <div>
              {myListings.length === 0 ? (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>등록한 아이템이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {myListings.map((listing) => (
                    <div
                      key={listing._id || listing.id}
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        isDarkMode
                          ? "bg-green-500/10 border-green-400/30"
                          : "bg-green-50 border-green-300/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>
                            {listing.itemType === 'amber' ? '💎' : listing.itemType === 'starPiece' ? '⭐' : '📦'} {listing.itemName}
                          </h3>
                          <div className={`flex items-center gap-2 text-sm mb-2 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            <User className="w-4 h-4" />
                            {listing.sellerNickname}
                          </div>
                          <div className={`text-sm mb-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            수량: {listing.quantity}개
                          </div>
                          <div className={`text-lg font-bold ${
                            isDarkMode ? "text-yellow-400" : "text-yellow-600"
                          }`}>
                            <Coins className="w-4 h-4 inline mr-1" />
                            {(listing.pricePerUnit * listing.quantity).toLocaleString()}골드
                            <span className={`text-sm ml-2 ${
                              isDarkMode ? "text-gray-400" : "text-gray-600"
                            }`}>
                              (개당 {listing.pricePerUnit.toLocaleString()})
                            </span>
                          </div>
                          {listing.deposit && (
                            <div className={`text-xs mt-1 ${
                              isDarkMode ? "text-orange-400" : "text-orange-600"
                            }`}>
                              보증금: {listing.deposit.toLocaleString()}골드 (취소 시 반환)
                            </div>
                          )}
                          <div className={`text-xs mt-2 flex items-center gap-1 ${
                            isDarkMode ? "text-gray-500" : "text-gray-500"
                          }`}>
                            <Clock className="w-3 h-3" />
                            {new Date(listing.listedAt).toLocaleString('ko-KR')}
                          </div>
                        </div>
                        <button
                          onClick={() => handleCancelListing(listing)}
                          disabled={loading}
                          className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                            loading
                              ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                              : isDarkMode
                                ? "bg-red-500/20 text-red-400 border border-red-400/30 hover:bg-red-500/30"
                                : "bg-red-500 text-white hover:bg-red-600"
                          }`}
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 내 아이템 탭 */}
          {activeTab === 'myItems' && (
            <div>
              {tradableItems.length === 0 ? (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>거래 가능한 아이템이 없습니다.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tradableItems.map((item, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        selectedItem?.name === item.name
                          ? isDarkMode
                            ? "bg-purple-500/20 border-purple-400/50"
                            : "bg-purple-100 border-purple-400"
                          : isDarkMode
                            ? "bg-gray-800/50 border-gray-600/30 hover:bg-gray-700/50"
                            : "bg-white border-gray-300/50 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className={`text-lg font-bold mb-1 ${
                            isDarkMode ? "text-white" : "text-gray-800"
                          }`}>
                            {item.icon} {item.name}
                          </h3>
                          <div className={`text-sm ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            보유: {item.count}개
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            if (selectedItem?.name === item.name) {
                              setSelectedItem(null);
                              setListPrice('');
                              setListQuantity(1);
                            } else {
                              setSelectedItem(item);
                              setListQuantity(1);
                            }
                          }}
                          className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-300 ${
                            selectedItem?.name === item.name
                              ? isDarkMode
                                ? "bg-purple-500/30 text-purple-300"
                                : "bg-purple-600 text-white"
                              : isDarkMode
                                ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                : "bg-blue-500 text-white hover:bg-blue-600"
                          }`}
                        >
                          {selectedItem?.name === item.name ? "선택됨" : "등록"}
                        </button>
                      </div>

                      {/* 등록 폼 */}
                      {selectedItem?.name === item.name && (
                        <div className={`pt-3 border-t ${
                          isDarkMode ? "border-white/10" : "border-gray-300/30"
                        }`}>
                          <div className="space-y-2">
                            <div>
                              <label className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>
                                수량
                              </label>
                              <input
                                type="number"
                                min="1"
                                max={item.count}
                                value={listQuantity}
                                onChange={(e) => setListQuantity(Math.max(1, Math.min(item.count, parseInt(e.target.value) || 1)))}
                                className={`w-full px-3 py-2 rounded-lg border ${
                                  isDarkMode
                                    ? "bg-gray-700/50 border-gray-600 text-white"
                                    : "bg-white border-gray-300 text-gray-800"
                                }`}
                              />
                            </div>
                            <div>
                              <label className={`text-sm ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>
                                개당 가격 (골드)
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={listPrice}
                                onChange={(e) => setListPrice(e.target.value)}
                                placeholder="가격 입력"
                                className={`w-full px-3 py-2 rounded-lg border ${
                                  isDarkMode
                                    ? "bg-gray-700/50 border-gray-600 text-white placeholder-gray-500"
                                    : "bg-white border-gray-300 text-gray-800 placeholder-gray-400"
                                }`}
                              />
                            </div>
                            {listPrice && listQuantity && (
                              <div className="space-y-1">
                                <div className={`text-sm ${
                                  isDarkMode ? "text-yellow-400" : "text-yellow-600"
                                }`}>
                                  총 판매가: {(parseInt(listPrice) * listQuantity).toLocaleString()}골드
                                </div>
                                <div className={`text-xs ${
                                  isDarkMode ? "text-orange-400" : "text-orange-600"
                                }`}>
                                  등록 보증금 (5%): -{Math.floor((parseInt(listPrice) * listQuantity) * 0.05).toLocaleString()}골드
                                </div>
                                <div className={`text-xs ${
                                  isDarkMode ? "text-gray-400" : "text-gray-600"
                                }`}>
                                  💡 취소 시 보증금 반환, 판매 시 회수 안 됨
                                </div>
                                {itemAveragePrices[item.name] && (
                                  <div className={`text-xs ${
                                    isDarkMode ? "text-gray-500" : "text-gray-500"
                                  }`}>
                                    최근 평균가: {Math.round(itemAveragePrices[item.name].avgPrice).toLocaleString()}골드
                                    {parseInt(listPrice) < itemAveragePrices[item.name].avgPrice ? (
                                      <span className="ml-1 text-green-500">↓ 평균보다 저렴</span>
                                    ) : parseInt(listPrice) > itemAveragePrices[item.name].avgPrice ? (
                                      <span className="ml-1 text-red-500">↑ 평균보다 비쌈</span>
                                    ) : (
                                      <span className="ml-1 text-blue-500">= 평균 가격</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <button
                              onClick={handleListItem}
                              disabled={loading || !listPrice || listPrice <= 0}
                              className={`w-full py-2 rounded-lg font-medium transition-all duration-300 ${
                                loading || !listPrice || listPrice <= 0
                                  ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                                  : isDarkMode
                                    ? "bg-green-500/20 text-green-400 border border-green-400/30 hover:bg-green-500/30"
                                    : "bg-green-500 text-white hover:bg-green-600"
                              }`}
                            >
                              거래소에 등록
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 내 거래내역 탭 */}
          {activeTab === 'history' && (
            <div>
              {tradeHistory.length === 0 ? (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>거래 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {tradeHistory.map((trade, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30"
                          : "bg-white border-gray-300/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`text-lg font-bold ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>
                              {trade.itemType === 'amber' ? '💎' : trade.itemType === 'starPiece' ? '⭐' : '📦'} {trade.itemName}
                            </h3>
                            <span className={`text-xs px-2 py-1 rounded ${
                              trade.type === 'purchase'
                                ? isDarkMode
                                  ? "bg-blue-500/20 text-blue-400"
                                  : "bg-blue-100 text-blue-600"
                                : isDarkMode
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-green-100 text-green-600"
                            }`}>
                              {trade.type === 'purchase' ? '구매' : '판매'}
                            </span>
                          </div>
                          <div className={`text-sm space-y-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              {trade.type === 'purchase' 
                                ? `판매자: ${trade.sellerNickname}` 
                                : `구매자: ${trade.buyerNickname}`}
                            </div>
                            <div>수량: {trade.quantity}개</div>
                            <div className={`font-bold ${
                              isDarkMode ? "text-yellow-400" : "text-yellow-600"
                            }`}>
                              <Coins className="w-4 h-4 inline mr-1" />
                              {trade.totalPrice.toLocaleString()}골드
                              <span className={`text-xs ml-2 ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>
                                (개당 {trade.pricePerUnit.toLocaleString()})
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(trade.tradedAt).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 전체 거래내역 탭 */}
          {activeTab === 'allHistory' && (
            <div>
              {allTradeHistory.length === 0 ? (
                <div className={`text-center py-12 ${
                  isDarkMode ? "text-gray-400" : "text-gray-600"
                }`}>
                  <TrendingUp className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>전체 거래 내역이 없습니다.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {allTradeHistory.map((trade, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border transition-all duration-300 ${
                        isDarkMode
                          ? "bg-gray-800/50 border-gray-600/30"
                          : "bg-white border-gray-300/50"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className={`text-lg font-bold ${
                              isDarkMode ? "text-white" : "text-gray-800"
                            }`}>
                              {trade.itemType === 'amber' ? '💎' : trade.itemType === 'starPiece' ? '⭐' : '📦'} {trade.itemName}
                            </h3>
                          </div>
                          <div className={`text-sm space-y-1 ${
                            isDarkMode ? "text-gray-400" : "text-gray-600"
                          }`}>
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4" />
                              <span className="text-red-400">판매:</span> {trade.sellerNickname}
                              <span className="mx-2">→</span>
                              <span className="text-blue-400">구매:</span> {trade.buyerNickname}
                            </div>
                            <div>수량: {trade.quantity}개</div>
                            <div className={`font-bold ${
                              isDarkMode ? "text-yellow-400" : "text-yellow-600"
                            }`}>
                              <Coins className="w-4 h-4 inline mr-1" />
                              {trade.totalPrice.toLocaleString()}골드
                              <span className={`text-xs ml-2 ${
                                isDarkMode ? "text-gray-400" : "text-gray-600"
                              }`}>
                                (개당 {trade.pricePerUnit.toLocaleString()})
                              </span>
                            </div>
                            <div className="flex items-center gap-1 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              {new Date(trade.tradedAt).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className={`p-4 border-t ${
          isDarkMode ? "border-white/10" : "border-gray-300/20"
        }`}>
          <div className="flex items-center justify-between">
            <div className={`text-sm ${
              isDarkMode ? "text-gray-400" : "text-gray-600"
            }`}>
              💡 분해 아이템, 호박석, 별조각 거래 가능 • 등록 시 보증금 5% 필요 (낚시 실력 5 이상)
            </div>
            <div className={`text-lg font-bold ${
              isDarkMode ? "text-yellow-400" : "text-yellow-600"
            }`}>
              <Coins className="w-5 h-5 inline mr-1" />
              {gold?.toLocaleString()}골드
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketModal;
