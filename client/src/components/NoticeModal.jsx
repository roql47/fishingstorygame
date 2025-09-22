import { Bell, X } from "lucide-react";
import { NOTICE_DATA, VERSION_INFO } from "../data/noticeData";

const NoticeModal = ({ showNoticeModal, setShowNoticeModal, isDarkMode }) => {
  if (!showNoticeModal) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-2xl ${
        isDarkMode ? "glass-card" : "bg-white border border-gray-300"
      }`}>
        {/* 헤더 */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? "border-gray-600" : "border-gray-200"
        }`}>
          <div className="flex items-center gap-3">
            <Bell className={`w-5 h-5 ${isDarkMode ? "text-blue-400" : "text-blue-600"}`} />
            <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              📢 공지사항
            </h2>
            <span className={`text-sm px-2 py-1 rounded-full ${
              isDarkMode ? "bg-purple-500/20 text-purple-300" : "bg-purple-100 text-purple-600"
            }`}>
              {VERSION_INFO.name} {VERSION_INFO.version}
            </span>
          </div>
          <button
            onClick={() => setShowNoticeModal(false)}
            className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
              isDarkMode ? "glass-input text-gray-400" : "bg-gray-100 text-gray-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {NOTICE_DATA.map((notice, index) => (
            <div
              key={notice.id}
              className={`p-4 rounded-lg ${
                index === 0 && notice.isNew
                  ? `border-l-4 ${
                      isDarkMode 
                        ? "bg-blue-500/10 border-blue-400" 
                        : "bg-blue-50 border-blue-500"
                    }`
                  : isDarkMode ? "glass-input" : "bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                {notice.isNew && (
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500 text-white">
                    NEW
                  </span>
                )}
                <span className={`text-sm ${isDarkMode ? "text-gray-400" : "text-gray-600"}`}>
                  {notice.date}
                </span>
              </div>
              <h3 className={`font-semibold mb-2 ${isDarkMode ? "text-white" : "text-gray-800"}`}>
                {notice.title}
              </h3>
              <div className={`text-sm leading-relaxed ${isDarkMode ? "text-gray-300" : "text-gray-700"}`}>
                {notice.content.map((item, itemIndex) => (
                  <div key={itemIndex}>• {item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NoticeModal;
