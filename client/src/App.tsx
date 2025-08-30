import { useEffect, useMemo, useRef, useState } from "react";
import { getSocket } from "./lib/socket";
import axios from "axios";
import "./App.css";

type ChatMessage = {
  username: string;
  content: string;
  system?: boolean;
};

type LeaderboardRow = {
  username: string;
  total: number;
};

function App() {
  const [username, setUsername] = useState<string>(() =>
    localStorage.getItem("nickname") || ""
  );
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const serverUrl = useMemo(
    () => (import.meta.env.VITE_SERVER_URL as string) || "http://localhost:4000",
    []
  );

  useEffect(() => {
    if (!username) return;
    const socket = getSocket();

    const onMessage = (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    };

    socket.on("chat:message", onMessage);
    socket.emit("chat:join", { username });

    return () => {
      socket.off("chat:message", onMessage);
    };
  }, [username]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!username) return;
    const fetchLeaderboard = async () => {
      try {
        const res = await axios.get(`${serverUrl}/api/leaderboard`);
        setLeaderboard(res.data);
      } catch (e) {
        // ignore
      }
    };
    fetchLeaderboard();
    const id = setInterval(fetchLeaderboard, 10000);
    return () => clearInterval(id);
  }, [serverUrl, username]);

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const socket = getSocket();
    const payload: ChatMessage = { username, content: text };
    socket.emit("chat:message", payload);
    setInput("");
  };

  if (!username) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-sky-900 text-white">
        <div className="w-full max-w-md bg-sky-800/60 backdrop-blur rounded-xl p-6 shadow-lg">
          <h1 className="text-2xl font-bold mb-4">채팅 낚시게임</h1>
          <label className="block text-sm mb-2">닉네임</label>
          <input
            className="w-full rounded-md px-3 py-2 text-black"
            placeholder="예: 낚시왕"
            onChange={(e) => setUsername(e.target.value)}
          />
          <button
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-2 rounded-md"
            onClick={() => {
              if (username.trim()) {
                localStorage.setItem("nickname", username.trim());
                setUsername(username.trim());
              }
            }}
          >
            시작하기
          </button>
          <p className="text-xs text-white/70 mt-3">채팅창에 "낚시하기" 를 입력해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-900 text-white">
      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-4 p-4">
        <div className="md:col-span-2 bg-sky-800/60 backdrop-blur rounded-xl p-4 shadow-lg flex flex-col h-[80vh]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xl font-bold">채팅</h2>
            <button
              className="text-xs text-white/80 underline"
              onClick={() => {
                localStorage.removeItem("nickname");
                location.reload();
              }}
            >
              닉네임 변경
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className="text-sm">
                {m.system ? (
                  <span className="text-amber-300">[시스템] {m.content}</span>
                ) : (
                  <>
                    <span className="text-emerald-300 font-semibold mr-2">{m.username}</span>
                    <span>{m.content}</span>
                  </>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="mt-3 flex gap-2">
            <input
              className="flex-1 rounded-md px-3 py-2 text-black"
              placeholder="메시지를 입력하세요 (낚시하기)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend();
              }}
            />
            <button
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-4 rounded-md"
              onClick={handleSend}
            >
              전송
            </button>
          </div>
        </div>

        <div className="bg-sky-800/60 backdrop-blur rounded-xl p-4 shadow-lg h-[80vh]">
          <h2 className="text-xl font-bold mb-3">리더보드</h2>
          <div className="space-y-2 overflow-y-auto h-[calc(80vh-3rem)] pr-1">
            {leaderboard.length === 0 && (
              <div className="text-sm text-white/70">아직 기록이 없습니다.</div>
            )}
            {leaderboard.map((row) => (
              <div key={row.username} className="flex justify-between text-sm">
                <span className="font-medium">{row.username}</span>
                <span className="text-white/80">{row.total} 마리</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
