import { BookOpen, X } from "lucide-react";
import { TUTORIAL_DATA } from "../data/tutorialData";

const TutorialModal = ({ showTutorialModal, setShowTutorialModal, isDarkMode }) => {
  if (!showTutorialModal) return null;

  const getColorClasses = (section) => {
    const colorMap = {
      blue: {
        text: isDarkMode ? "text-blue-400" : "text-blue-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      green: {
        text: isDarkMode ? "text-green-400" : "text-green-600", 
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      emerald: {
        text: isDarkMode ? "text-emerald-400" : "text-emerald-600", 
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      orange: {
        text: isDarkMode ? "text-orange-400" : "text-orange-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      purple: {
        text: isDarkMode ? "text-purple-400" : "text-purple-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      teal: {
        text: isDarkMode ? "text-teal-400" : "text-teal-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      red: {
        text: isDarkMode ? "text-red-400" : "text-red-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      yellow: {
        text: isDarkMode ? "text-yellow-400" : "text-yellow-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      indigo: {
        text: isDarkMode ? "text-indigo-400" : "text-indigo-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      amber: {
        text: isDarkMode ? "text-amber-400" : "text-amber-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      pink: {
        text: isDarkMode ? "text-pink-400" : "text-pink-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      },
      cyan: {
        text: isDarkMode ? "text-cyan-400" : "text-cyan-600",
        bg: isDarkMode ? "glass-input" : `bg-gradient-to-br ${section.gradient}`
      }
    };
    return colorMap[section.color] || colorMap.blue;
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`w-full max-w-3xl max-h-[80vh] overflow-hidden rounded-2xl ${
        isDarkMode ? "glass-card" : "bg-white border border-gray-300"
      }`}>
        {/* 헤더 */}
        <div className={`flex items-center justify-between p-6 border-b ${
          isDarkMode ? "border-gray-600" : "border-gray-200"
        }`}>
          <div className="flex items-center gap-3">
            <BookOpen className={`w-5 h-5 ${isDarkMode ? "text-green-400" : "text-green-600"}`} />
            <h2 className={`text-xl font-bold ${isDarkMode ? "text-white" : "text-gray-800"}`}>
              게임 가이드
            </h2>
          </div>
          <button
            onClick={() => setShowTutorialModal(false)}
            className={`p-2 rounded-full hover:glow-effect transition-all duration-300 ${
              isDarkMode ? "glass-input text-gray-400" : "bg-gray-100 text-gray-600"
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 내용 */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {TUTORIAL_DATA.map((section) => {
            const colorClasses = getColorClasses(section);
            
            return (
              <div key={section.id} className={`p-4 rounded-lg ${colorClasses.bg}`}>
                <h3 className={`font-bold text-lg mb-3 flex items-center gap-2 ${colorClasses.text}`}>
                  {section.title}
                </h3>
                <div className="space-y-2 text-sm">
                  {section.content.map((item, index) => (
                    <p key={index} className={isDarkMode ? "text-gray-300" : "text-gray-700"}>
                      <strong>{item.title}:</strong> {item.description}
                    </p>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;
