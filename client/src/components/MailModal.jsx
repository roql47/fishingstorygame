import { useState, useEffect } from 'react';
import { X, Send, Mail, Trash2, Plus, ArrowLeft, CheckCheck, Trash } from 'lucide-react';
import axios from 'axios';

const MailModal = ({ isOpen, onClose, username, userUuid }) => {
  const [activeTab, setActiveTab] = useState('inbox'); // 'inbox' or 'sent'
  const [mails, setMails] = useState([]);
  const [selectedMail, setSelectedMail] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [receiverNickname, setReceiverNickname] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // 메일 목록 불러오기
  const loadMails = async () => {
    try {
      setIsLoading(true);
      const endpoint = activeTab === 'inbox' ? '/api/mail/inbox' : '/api/mail/sent';
      const token = localStorage.getItem('jwtToken');
      
      const response = await axios.get(`${import.meta.env.VITE_SERVER_URL || window.location.origin}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setMails(response.data.mails);
      }
    } catch (error) {
      console.error('메일 불러오기 실패:', error);
      setError('메일을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 메일 발송
  const sendMail = async () => {
    if (!receiverNickname.trim()) {
      setError('받는 사람을 입력해주세요.');
      return;
    }
    if (!message.trim()) {
      setError('메시지를 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      const token = localStorage.getItem('jwtToken');
      
      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/mail/send`,
        {
          receiverNickname,
          subject: subject || '(제목 없음)',
          message
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setShowCompose(false);
        setReceiverNickname('');
        setSubject('');
        setMessage('');
        setActiveTab('sent');
        loadMails();
      }
    } catch (error) {
      console.error('메일 발송 실패:', error);
      setError(error.response?.data?.error || '메일 발송에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 메일 읽음 처리
  const markAsRead = async (mailId) => {
    try {
      const token = localStorage.getItem('jwtToken');
      await axios.post(
        `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/mail/read/${mailId}`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      // 로컬 상태 업데이트
      setMails(mails.map(mail => 
        mail._id === mailId ? { ...mail, isRead: true } : mail
      ));
    } catch (error) {
      console.error('메일 읽음 처리 실패:', error);
    }
  };

  // 메일 삭제
  const deleteMail = async (mailId) => {
    if (!confirm('정말로 이 메일을 삭제하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('jwtToken');
      await axios.delete(
        `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/mail/${mailId}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setMails(mails.filter(mail => mail._id !== mailId));
      setSelectedMail(null);
    } catch (error) {
      console.error('메일 삭제 실패:', error);
      setError('메일 삭제에 실패했습니다.');
    }
  };

  // 모두 읽음 처리
  const readAllMails = async () => {
    if (!confirm('받은 메일을 모두 읽음 처리하시겠습니까?')) return;

    try {
      const token = localStorage.getItem('jwtToken');
      const response = await axios.post(
        `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/mail/read-all`,
        {},
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        // 로컬 상태 업데이트
        setMails(mails.map(mail => ({ ...mail, isRead: true })));
        alert(response.data.message);
      }
    } catch (error) {
      console.error('모두 읽음 처리 실패:', error);
      setError('모두 읽음 처리에 실패했습니다.');
    }
  };

  // 모두 삭제
  const deleteAllMails = async () => {
    const tabName = activeTab === 'inbox' ? '받은 편지함' : '보낸 편지함';
    if (!confirm(`${tabName}의 모든 메일을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const token = localStorage.getItem('jwtToken');
      const response = await axios.delete(
        `${import.meta.env.VITE_SERVER_URL || window.location.origin}/api/mail/delete-all/${activeTab}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (response.data.success) {
        setMails([]);
        setSelectedMail(null);
        alert(response.data.message);
      }
    } catch (error) {
      console.error('모두 삭제 실패:', error);
      setError('모두 삭제에 실패했습니다.');
    }
  };

  // 탭 변경 시 메일 다시 불러오기
  useEffect(() => {
    if (isOpen) {
      loadMails();
      setSelectedMail(null);
      setShowCompose(false);
    }
  }, [activeTab, isOpen]);

  // 메일 선택 시 읽음 처리
  const handleMailClick = (mail) => {
    setSelectedMail(mail);
    if (activeTab === 'inbox' && !mail.isRead) {
      markAsRead(mail._id);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl shadow-2xl w-full max-w-4xl h-[600px] overflow-hidden flex">
        {/* 왼쪽: 대화 목록 */}
        <div className="w-[340px] border-r border-gray-700 flex flex-col">
          {/* 헤더 */}
          <div className="p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-400" />
              <span className="text-lg font-bold text-white">{username}</span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setShowCompose(true);
                  setSelectedMail(null);
                  setReceiverNickname('');
                  setSubject('');
                  setMessage('');
                }}
                className="p-2 text-blue-400 hover:bg-gray-800 rounded-full transition-colors"
                title="새 메시지"
              >
                <Plus className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:bg-gray-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div className="border-b border-gray-700">
            <div className="flex">
              <button
                onClick={() => {
                  setActiveTab('inbox');
                  setSelectedMail(null);
                }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'inbox'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                받은 메시지
              </button>
              <button
                onClick={() => {
                  setActiveTab('sent');
                  setSelectedMail(null);
                }}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'sent'
                    ? 'text-white border-b-2 border-blue-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                보낸 메시지
              </button>
            </div>
            {/* 액션 버튼 */}
            {mails.length > 0 && (
              <div className="flex gap-1 p-2 bg-gray-800">
                {activeTab === 'inbox' && (
                  <button
                    onClick={readAllMails}
                    className="flex-1 py-1.5 px-2 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors flex items-center justify-center gap-1"
                  >
                    <CheckCheck className="w-3 h-3" />
                    모두읽기
                  </button>
                )}
                <button
                  onClick={deleteAllMails}
                  className="flex-1 py-1.5 px-2 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors flex items-center justify-center gap-1"
                >
                  <Trash className="w-3 h-3" />
                  모두삭제
                </button>
              </div>
            )}
          </div>

          {/* 대화 목록 */}
          <div className="flex-1 overflow-y-auto">
            {isLoading && mails.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : mails.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-400">메시지가 없습니다</div>
            ) : (
              <div>
                {mails.map((mail) => (
                  <div
                    key={mail._id}
                    onClick={() => handleMailClick(mail)}
                    className={`p-3 border-b border-gray-800 cursor-pointer transition-colors hover:bg-gray-800 ${
                      selectedMail?._id === mail._id ? 'bg-gray-800' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* 아바타 */}
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                        <span className="text-white font-bold text-lg">
                          {(activeTab === 'inbox' ? mail.senderNickname : mail.receiverNickname)[0]}
                        </span>
                      </div>
                      {/* 내용 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-sm font-semibold ${!mail.isRead && activeTab === 'inbox' ? 'text-white' : 'text-gray-300'}`}>
                            {activeTab === 'inbox' ? mail.senderNickname : mail.receiverNickname}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(mail.sentAt).toLocaleDateString('ko', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <div className={`text-sm truncate ${!mail.isRead && activeTab === 'inbox' ? 'text-gray-200 font-medium' : 'text-gray-500'}`}>
                          {mail.message}
                        </div>
                      </div>
                      {!mail.isRead && activeTab === 'inbox' && (
                        <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-2"></div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 오른쪽: 대화 내용 */}
        <div className="flex-1 flex flex-col bg-gray-800">
          {showCompose ? (
            <>
              {/* 새 메시지 헤더 */}
              <div className="p-4 border-b border-gray-700 flex items-center gap-3">
                <button
                  onClick={() => setShowCompose(false)}
                  className="p-1 text-gray-400 hover:text-white transition-colors"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <span className="text-white font-semibold">새 메시지</span>
              </div>

              {/* 메시지 작성 폼 */}
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={receiverNickname}
                      onChange={(e) => setReceiverNickname(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="받는 사람"
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="제목 (선택사항)"
                    />
                  </div>
                  <div>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-64 resize-none"
                      placeholder="메시지를 입력하세요..."
                    />
                  </div>
                  {error && (
                    <div className="p-3 bg-red-600 text-white rounded-lg text-sm">
                      {error}
                    </div>
                  )}
                </div>
              </div>

              {/* 전송 버튼 */}
              <div className="p-4 border-t border-gray-700">
                <button
                  onClick={sendMail}
                  disabled={isLoading}
                  className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-semibold"
                >
                  {isLoading ? '전송 중...' : '전송'}
                </button>
              </div>
            </>
          ) : selectedMail ? (
            <>
              {/* 대화 헤더 */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold">
                      {(activeTab === 'inbox' ? selectedMail.senderNickname : selectedMail.receiverNickname)[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-semibold truncate">
                      {activeTab === 'inbox' ? selectedMail.senderNickname : selectedMail.receiverNickname}
                    </div>
                    {selectedMail.subject && selectedMail.subject !== '(제목 없음)' && (
                      <div className="text-base text-blue-400 font-bold truncate">
                        {selectedMail.subject}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      {new Date(selectedMail.sentAt).toLocaleString('ko', { 
                        month: 'short', 
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deleteMail(selectedMail._id)}
                  className="p-2 text-red-400 hover:bg-gray-700 rounded-full transition-colors flex-shrink-0"
                  title="삭제"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              {/* 메시지 내용 */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {/* 메시지 말풍선 */}
                <div className={`flex ${activeTab === 'sent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] ${
                    activeTab === 'sent'
                      ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm'
                      : 'bg-gray-700 text-white rounded-2xl rounded-bl-sm'
                  } px-4 py-2 shadow-lg`}>
                    <div className="text-sm whitespace-pre-wrap break-words">
                      {selectedMail.message}
                    </div>
                  </div>
                </div>
              </div>

              {/* 답장 입력창 (받은 메시지인 경우만) */}
              {activeTab === 'inbox' && (
                <div className="p-4 border-t border-gray-700">
                  <button
                    onClick={() => {
                      setShowCompose(true);
                      setReceiverNickname(selectedMail.senderNickname);
                      setSubject(`RE: ${selectedMail.subject}`);
                      setSelectedMail(null);
                    }}
                    className="w-full py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    답장하기
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Mail className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">메시지를 선택하세요</p>
                <p className="text-sm mt-2">대화를 시작하려면 왼쪽에서 선택하거나<br />새 메시지를 작성하세요</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MailModal;
