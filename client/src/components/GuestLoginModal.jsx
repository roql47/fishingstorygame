import { useState } from "react";
import { User, X, LogIn, UserPlus, AlertCircle, CheckCircle } from "lucide-react";

const GuestLoginModal = ({ showModal, setShowModal, onLogin, isDarkMode }) => {
  const [activeTab, setActiveTab] = useState("login"); // "login" or "signup"
  const [accountId, setAccountId] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [idCheckStatus, setIdCheckStatus] = useState(null); // null, "checking", "available", "taken"

  if (!showModal) return null;

  // 아이디 유효성 검증 (영문, 숫자만 허용, 최대 8글자)
  const validateAccountId = (id) => {
    const regex = /^[가-힣a-zA-Z0-9]{1,8}$/;
    return regex.test(id);
  };

  // 아이디 입력 핸들러
  const handleAccountIdChange = (e) => {
    const value = e.target.value.slice(0, 8); // 최대 8글자
    setAccountId(value);
    setIdCheckStatus(null);
    setError("");
  };

  // 아이디 중복 체크
  const checkIdAvailability = async () => {
    if (!validateAccountId(accountId)) {
      setError("아이디는 한글, 영문, 숫자만 가능합니다 (최대 8글자)");
      return;
    }

    setIdCheckStatus("checking");
    setError("");

    try {
      const response = await fetch(`/api/guest/check-id/${accountId}`);
      const data = await response.json();

      if (data.available) {
        setIdCheckStatus("available");
      } else {
        setIdCheckStatus("taken");
        setError("이미 사용 중인 아이디입니다");
      }
    } catch (err) {
      console.error("아이디 중복 체크 실패:", err);
      setError("중복 체크 중 오류가 발생했습니다");
      setIdCheckStatus(null);
    }
  };

  // 로그인 처리
  const handleLogin = async () => {
    if (!accountId.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요");
      return;
    }

    if (!validateAccountId(accountId)) {
      setError("아이디는 한글, 영문, 숫자만 가능합니다 (최대 8글자)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/guest/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("게스트 로그인 성공:", data);
        onLogin(data.userUuid, data.username, accountId);
        setShowModal(false);
      } else {
        setError(data.error || "로그인에 실패했습니다");
      }
    } catch (err) {
      console.error("로그인 오류:", err);
      setError("로그인 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 회원가입 처리
  const handleSignup = async () => {
    if (!accountId.trim() || !password.trim() || !confirmPassword.trim()) {
      setError("모든 항목을 입력해주세요");
      return;
    }

    if (!validateAccountId(accountId)) {
      setError("아이디는 한글, 영문, 숫자만 가능합니다 (최대 8글자)");
      return;
    }

    if (password.length < 4) {
      setError("비밀번호는 최소 4자 이상이어야 합니다");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    if (idCheckStatus !== "available") {
      setError("아이디 중복 체크를 먼저 해주세요");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/guest/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("회원가입 성공:", data);
        onLogin(data.userUuid, data.username, accountId);
        setShowModal(false);
      } else {
        setError(data.error || "회원가입에 실패했습니다");
      }
    } catch (err) {
      console.error("회원가입 오류:", err);
      setError("회원가입 중 오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  // 모달 닫기
  const handleClose = () => {
    setShowModal(false);
    setAccountId("");
    setPassword("");
    setConfirmPassword("");
    setError("");
    setIdCheckStatus(null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div
        className={`w-full max-w-md overflow-hidden rounded-2xl shadow-2xl ${
          isDarkMode ? "bg-gray-900/95 border border-gray-700" : "bg-white border border-gray-300"
        }`}
      >
        {/* 헤더 */}
        <div
          className={`flex items-center justify-between p-6 border-b ${
            isDarkMode ? "border-gray-600" : "border-gray-200"
          }`}
        >
          <div className="flex items-center gap-3">
            <User className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
            <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              게스트 계정
            </h2>
          </div>
          <button
            onClick={handleClose}
            className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
              isDarkMode ? "bg-gray-800/90 text-gray-400 hover:bg-gray-700" : "bg-gray-100 text-gray-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 탭 */}
        <div className={`flex border-b ${isDarkMode ? "border-gray-600" : "border-gray-200"}`}>
          <button
            onClick={() => {
              setActiveTab("login");
              setError("");
              setIdCheckStatus(null);
            }}
            className={`flex-1 py-3 px-4 font-medium transition-all duration-300 ${
              activeTab === "login"
                ? isDarkMode
                  ? "bg-blue-500/20 text-blue-400 border-b-2 border-blue-400"
                  : "bg-blue-50 text-blue-600 border-b-2 border-blue-500"
                : isDarkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <LogIn className="w-4 h-4" />
              로그인
            </div>
          </button>
          <button
            onClick={() => {
              setActiveTab("signup");
              setError("");
              setIdCheckStatus(null);
            }}
            className={`flex-1 py-3 px-4 font-medium transition-all duration-300 ${
              activeTab === "signup"
                ? isDarkMode
                  ? "bg-blue-500/20 text-blue-400 border-b-2 border-blue-400"
                  : "bg-blue-50 text-blue-600 border-b-2 border-blue-500"
                : isDarkMode
                ? "text-gray-400 hover:text-gray-300"
                : "text-gray-600 hover:text-gray-800"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <UserPlus className="w-4 h-4" />
              회원가입
            </div>
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 space-y-4">
          {/* 로그인 탭 */}
          {activeTab === "login" && (
            <>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  아이디
                </label>
                <input
                  type="text"
                  value={accountId}
                  onChange={handleAccountIdChange}
                  placeholder="영문, 숫자 (최대 8글자)"
                  maxLength={8}
                  className={`w-full px-4 py-3 rounded-lg transition-all duration-300 ${
                    isDarkMode
                      ? "bg-gray-800/90 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      : "bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400"
                  }`}
                  onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                  className={`w-full px-4 py-3 rounded-lg transition-all duration-300 ${
                    isDarkMode
                      ? "bg-gray-800/90 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      : "bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400"
                  }`}
                  onKeyPress={(e) => e.key === "Enter" && handleLogin()}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              <button
                onClick={handleLogin}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  loading
                    ? "opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500"
                    : isDarkMode
                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/30 hover:scale-105"
                    : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-105"
                }`}
              >
                <LogIn className="w-4 h-4" />
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </>
          )}

          {/* 회원가입 탭 */}
          {activeTab === "signup" && (
            <>
              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  아이디
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={accountId}
                    onChange={handleAccountIdChange}
                    placeholder="영문, 숫자 (최대 8글자)"
                    maxLength={8}
                    className={`flex-1 px-4 py-3 rounded-lg transition-all duration-300 ${
                      isDarkMode
                        ? "bg-gray-800/90 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                        : "bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400"
                    }`}
                  />
                  <button
                    onClick={checkIdAvailability}
                    disabled={!accountId || idCheckStatus === "checking"}
                    className={`px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                      !accountId || idCheckStatus === "checking"
                        ? "opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500"
                        : isDarkMode
                        ? "bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 border border-purple-400/30"
                        : "bg-purple-500 text-white hover:bg-purple-600"
                    }`}
                  >
                    {idCheckStatus === "checking" ? "확인 중..." : "중복 체크"}
                  </button>
                </div>
                {idCheckStatus === "available" && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    사용 가능한 아이디입니다
                  </div>
                )}
                {idCheckStatus === "taken" && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-red-400">
                    <AlertCircle className="w-4 h-4" />
                    이미 사용 중인 아이디입니다
                  </div>
                )}
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  비밀번호
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 (최소 4자)"
                  className={`w-full px-4 py-3 rounded-lg transition-all duration-300 ${
                    isDarkMode
                      ? "bg-gray-800/90 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      : "bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400"
                  }`}
                />
              </div>

              <div>
                <label
                  className={`block text-sm font-medium mb-2 ${
                    isDarkMode ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  비밀번호 확인
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  className={`w-full px-4 py-3 rounded-lg transition-all duration-300 ${
                    isDarkMode
                      ? "bg-gray-800/90 border border-gray-600 text-white placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/50"
                      : "bg-gray-50 border border-gray-300 text-gray-800 placeholder-gray-400"
                  }`}
                  onKeyPress={(e) => e.key === "Enter" && handleSignup()}
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{error}</span>
                </div>
              )}

              <button
                onClick={handleSignup}
                disabled={loading}
                className={`w-full py-3 px-6 rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                  loading
                    ? "opacity-50 cursor-not-allowed bg-gray-500/20 text-gray-500"
                    : isDarkMode
                    ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-400/30 hover:scale-105"
                    : "bg-blue-500 text-white hover:bg-blue-600 hover:scale-105"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                {loading ? "가입 중..." : "회원가입"}
              </button>
            </>
          )}

          {/* 안내 메시지 */}
          <div
            className={`text-xs text-center p-3 rounded-lg ${
              isDarkMode ? "bg-yellow-500/10 text-yellow-400" : "bg-yellow-50 text-yellow-700"
            }`}
          >
            💡 계정을 생성하면 데이터가 안전하게 저장됩니다
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuestLoginModal;

