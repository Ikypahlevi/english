import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen, Layers, GraduationCap, Upload, ChevronLeft, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, Sparkles, Loader2, Volume2,
  Lightbulb, Trash2, FolderOpen, ArrowLeft, Database, Sun, Moon,
  FileSpreadsheet, LayoutDashboard, BookMarked, BrainCircuit, Zap,
  ChevronDown, ChevronUp, FileText, LogOut, User, Flame
} from "lucide-react";
import axios from "axios";
import confetti from "https://cdn.skypack.dev/canvas-confetti";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

// ── Cấu hình Axios Interceptor ──────────────────────────────────────
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem("engmaster-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

axios.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 || error.response?.status === 403) {
    localStorage.removeItem("engmaster-token");
    localStorage.removeItem("engmaster-user");
    window.dispatchEvent(new Event("auth-expired"));
  }
  return Promise.reject(error);
});

// ── Âm thanh ────────────────────────────────────────────────────────
// Sử dụng các Data URI âm thanh ngắn để không cần tải file ngoài
const playSound = (type) => {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'correct') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.2);
    } else if (type === 'wrong') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(150, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.3);
    }
  } catch (e) { console.log("Audio not supported"); }
};

// ── Dark Mode Hook ──────────────────────────────────────────────────
function useDarkMode() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("engmaster-theme");
    return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("engmaster-theme", dark ? "dark" : "light");
  }, [dark]);
  return [dark, setDark];
}

// ── Toast Store (Global) ─────────────────────────────────────────────
let toastTimeout;
const toastSubscribers = new Set();
export const showToast = (message, type = 'success') => {
  toastSubscribers.forEach(cb => cb({ message, type, id: Date.now() }));
};

function ToastContainer() {
  const [toast, setToast] = useState(null);
  
  useEffect(() => {
    const cb = (newToast) => {
      setToast(newToast);
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => setToast(null), 3000);
    };
    toastSubscribers.add(cb);
    return () => toastSubscribers.delete(cb);
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-up">
      <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-medium text-sm ${
        toast.type === 'error' ? 'bg-rose-500 text-white' : 
        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
      }`}>
        {toast.type === 'error' ? <XCircle size={18} /> : 
         toast.type === 'success' ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
        {toast.message}
      </div>
    </div>
  );
}

// ── Gemini helper ───────────────────────────────────────────────────
async function callGeminiAPI(prompt) {
  try {
    const res = await axios.post(`${API_BASE}/check-answer`, { 
      word: "AI", correctMeaning: "AI", userAnswer: "AI", _prompt_override: prompt 
    });
    // Trick: Dùng lại endpoint check-answer cho mục đích chung tạm thời hoặc viết endpoint riêng
    // Hiện tại tạm thời gọi dummy nếu không có endpoint riêng
    return { english: "Example sentence", vietnamese: "Câu ví dụ" }; 
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════
// AUTHENTICATION SCREEN
// ══════════════════════════════════════════════════════════════════
function AuthScreen({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const res = await axios.post(`${API_BASE}${endpoint}`, { email, password });
      if (res.data.success) {
        localStorage.setItem("engmaster-token", res.data.token);
        localStorage.setItem("engmaster-user", JSON.stringify(res.data.user));
        showToast(res.data.message, "success");
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EngMaster</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Đăng nhập để lưu tiến độ học tập</p>
        </div>

        {error && (
          <div className="p-3 mb-6 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-800/50 flex items-center gap-2">
            <XCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-brand-500 font-medium text-slate-900 dark:text-white" 
              placeholder="user@example.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mật khẩu</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-brand-500 font-medium text-slate-900 dark:text-white" 
              placeholder="••••••••" />
          </div>
          
          <button type="submit" disabled={loading}
            className="w-full py-4 mt-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/30 disabled:opacity-50 flex items-center justify-center">
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Đăng nhập" : "Đăng ký")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("engmaster-user") || "null"));
  const [userStats, setUserStats] = useState({ xp: 0, streak_days: 0 });
  
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(false);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isXlsxLoaded, setIsXlsxLoaded] = useState(false);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [isQuizOngoing, setIsQuizOngoing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dark, setDark] = useDarkMode();

  // Handle auto logout
  useEffect(() => {
    const handleExpired = () => { setUser(null); showToast("Phiên đăng nhập đã hết hạn", "error"); };
    window.addEventListener("auth-expired", handleExpired);
    return () => window.removeEventListener("auth-expired", handleExpired);
  }, []);

  // Fetch initial data
  const fetchInitialData = useCallback(async () => {
    if (!user) return;
    setIsLoadingTopics(true);
    try {
      const [topicsRes, statsRes] = await Promise.all([
        axios.get(`${API_BASE}/topics`),
        axios.get(`${API_BASE}/stats`).catch(() => ({ data: { data: { xp: 0, streak_days: 0 } } }))
      ]);
      setTopics(topicsRes.data.data || []);
      setUserStats(statsRes.data.data || { xp: 0, streak_days: 0 });
    } catch (err) {
      if (err.response?.status !== 401 && err.response?.status !== 403) {
        showToast("Không thể tải dữ liệu", "error");
      }
    } finally {
      setIsLoadingTopics(false);
    }
  }, [user]);

  useEffect(() => { fetchInitialData(); }, [fetchInitialData]);

  // Handle Stats Update
  const addXP = async (amount) => {
    try {
      const res = await axios.post(`${API_BASE}/stats/update`, { xpGained: amount });
      if (res.data.success) setUserStats(res.data.data);
    } catch (e) {}
  };

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc muốn đăng xuất?")) {
      localStorage.removeItem("engmaster-token");
      localStorage.removeItem("engmaster-user");
      setUser(null);
      setTopics([]);
      setVocabList([]);
    }
  };

  if (!user) {
    return (
      <>
        <ToastContainer />
        <AuthScreen onLoginSuccess={setUser} />
      </>
    );
  }

  // ── Load XLSX ─────────────────────────────────────────────────
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXlsxLoaded(true);
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const selectTopic = useCallback(async (topic) => {
    setSelectedTopic(topic);
    setVocabList([]);
    setIsLoadingVocab(true);
    try {
      const res = await axios.get(`${API_BASE}/topics/${topic.topic_id}/vocabularies`);
      setVocabList(res.data.data || []);
    } catch (err) {
      showToast("Lỗi khi tải từ vựng", "error");
    } finally {
      setIsLoadingVocab(false);
    }
  }, []);

  const backToTopics = useCallback(() => {
    setSelectedTopic(null);
    setVocabList([]);
  }, []);

  const handleTabChange = useCallback((newTab) => {
    if (isQuizOngoing && newTab !== activeTab) {
      if (!window.confirm("Bạn đang kiểm tra dở, bạn có chắc muốn thoát ra không?")) return;
    }
    setActiveTab(newTab);
    if (newTab !== "list") { setSelectedTopic(null); setVocabList([]); }
  }, [isQuizOngoing, activeTab]);

  // ── File upload ───────────────────────────────────────────────
  const processFile = useCallback((file) => {
    if (!file) return;
    if (!isXlsxLoaded || !window.XLSX) {
      showToast("Thư viện đọc Excel đang tải, vui lòng chờ...", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = window.XLSX.read(evt.target.result, { type: "binary" });
      setPendingWorkbook({ file, wb });
      setSelectedSheets([]);
    };
    reader.readAsBinaryString(file);
  }, [isXlsxLoaded]);

  const handleFileUpload = useCallback((e) => {
    processFile(e.target.files[0]);
    e.target.value = null;
  }, [processFile]);

  const toggleSheetSelection = (wsname) => {
    setSelectedSheets(prev => prev.includes(wsname) ? prev.filter(s => s !== wsname) : [...prev, wsname]);
  };

  const handleImportSelectedSheets = async () => {
    if (!pendingWorkbook || selectedSheets.length === 0) return;
    const { wb } = pendingWorkbook;
    const apiPayload = selectedSheets.map(wsname => {
      const ws = wb.Sheets[wsname];
      const rawData = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
      const vocabularies = [];
      for (let i = 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (row && row.length >= 4 && row[1]) {
          vocabularies.push({
            word: row[1]?.toString().trim() || "",
            ipa: row[2]?.toString().trim() || "",
            meaning: row[3]?.toString().trim() || "",
          });
        }
      }
      return { sheetName: wsname, fileName: pendingWorkbook.file.name, vocabularies };
    }).filter(s => s.vocabularies.length > 0);

    if (apiPayload.length === 0) {
      showToast("Không tìm thấy dữ liệu hợp lệ trong các sheet đã chọn.", "error");
      return;
    }
    setIsSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/topics/import`, apiPayload);
      await fetchInitialData();
      setPendingWorkbook(null);
      setSelectedSheets([]);
      showToast(response.data.message, "success");
    } catch (err) {
      showToast("Import thất bại: " + (err.response?.data?.message || err.message), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTopic = useCallback(async (topicId, topicName) => {
    if (!window.confirm(`Xóa buổi "${topicName}" và toàn bộ từ vựng?`)) return;
    try {
      await axios.delete(`${API_BASE}/topics/${topicId}`);
      if (selectedTopic?.topic_id === topicId) { setSelectedTopic(null); setVocabList([]); }
      await fetchInitialData();
      showToast("Đã xóa chủ điểm", "success");
    } catch { showToast("Lỗi khi xóa chủ điểm.", "error"); }
  }, [selectedTopic, fetchInitialData]);

  const handleDeleteVocab = useCallback(async (vocabId, word) => {
    try {
      await axios.delete(`${API_BASE}/vocabularies/${vocabId}`);
      setVocabList(prev => prev.filter(v => v.vocabulary_id !== vocabId));
      await fetchInitialData();
      showToast(`Đã xóa từ "${word}"`, "success");
    } catch { showToast("Lỗi khi xóa từ vựng.", "error"); }
  }, [fetchInitialData]);

  const totalVocab = useMemo(() => topics.reduce((s, t) => s + Number(t.vocab_count || 0), 0), [topics]);

  const navItems = [
    { id: "list",      icon: BookOpen,      label: "Từ vựng" },
    { id: "flashcard", icon: Layers,         label: "Flashcards" },
    { id: "quiz",      icon: BrainCircuit,   label: "Kiểm tra" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <ToastContainer />

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">EngMaster</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Pro Learner</p>
          </div>
        </div>

        {/* User Profile & Gamification Stats */}
        <div className="px-4 py-4">
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
              <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                <User size={20} className="text-slate-500 dark:text-slate-400" />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white text-sm truncate">{user.email}</p>
                <button onClick={handleLogout} className="text-xs text-rose-500 hover:text-rose-600 font-medium mt-0.5 flex items-center gap-1">
                  <LogOut size={12} /> Đăng xuất
                </button>
              </div>
            </div>
            <div className="flex justify-between items-center gap-2 text-center">
              <div className="flex-1 bg-amber-50 dark:bg-amber-900/20 rounded-xl py-2">
                <div className="flex items-center justify-center gap-1 text-amber-500 mb-0.5">
                  <Zap size={14} className="fill-amber-500" /> <span className="font-bold">{userStats.xp}</span>
                </div>
                <p className="text-[10px] uppercase font-bold text-amber-600/70 dark:text-amber-500/70">XP</p>
              </div>
              <div className="flex-1 bg-orange-50 dark:bg-orange-900/20 rounded-xl py-2">
                <div className="flex items-center justify-center gap-1 text-orange-500 mb-0.5">
                  <Flame size={14} className="fill-orange-500" /> <span className="font-bold">{userStats.streak_days}</span>
                </div>
                <p className="text-[10px] uppercase font-bold text-orange-600/70 dark:text-orange-500/70">Ngày chuỗi</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-2 space-y-1">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeTab === id
                  ? "bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="px-4 pb-6 mt-auto">
          <button onClick={() => setDark(d => !d)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group">
            {dark ? <Sun size={18} className="text-amber-400 group-hover:rotate-12 transition-transform" /> : <Moon size={18} className="group-hover:-rotate-12 transition-transform" />}
            <span>{dark ? "Chế độ Sáng" : "Chế độ Tối"}</span>
          </button>
        </div>
      </aside>

      {/* ── MOBILE TOP BAR ───────────────────────────────────── */}
      <div className="md:hidden fixed top-0 inset-x-0 z-30 bg-white/80 dark:bg-slate-900/90 backdrop-blur-lg border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center justify-between transition-colors duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <GraduationCap size={16} className="text-white" />
          </div>
          <span className="font-bold text-slate-900 dark:text-white">EngMaster</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-orange-500 text-sm font-bold bg-orange-50 dark:bg-orange-900/30 px-2 py-1 rounded-lg">
            <Flame size={14} className="fill-orange-500" /> {userStats.streak_days}
          </div>
          <button onClick={() => setDark(d => !d)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
          </button>
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 mt-14 md:mt-0 max-w-5xl w-full mx-auto">
          {isLoadingTopics ? (
             <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-500" size={40} /></div>
          ) : (
            <>
              {activeTab === "list" && (
                <div className="animate-slide-up">
                  <VocabListView
                    topics={topics}
                    selectedTopic={selectedTopic}
                    vocabList={vocabList}
                    isLoadingVocab={isLoadingVocab}
                    selectTopic={selectTopic}
                    backToTopics={backToTopics}
                    handleFileUpload={handleFileUpload}
                    processFile={processFile}
                    handleDeleteTopic={handleDeleteTopic}
                    handleDeleteVocab={handleDeleteVocab}
                    totalVocab={totalVocab}
                  />
                </div>
              )}
              {activeTab === "flashcard" && (
                <div className="animate-slide-up">
                  <FlashcardQuizWrapper topics={topics} mode="flashcard" addXP={addXP} />
                </div>
              )}
              {activeTab === "quiz" && (
                <div className="animate-slide-up">
                  <FlashcardQuizWrapper topics={topics} mode="quiz" setIsQuizOngoing={setIsQuizOngoing} addXP={addXP} />
                </div>
              )}
            </>
          )}
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex transition-colors duration-300">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all ${
                activeTab === id ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"
              }`}>
              <Icon size={20} /><span>{label}</span>
            </button>
          ))}
          <button onClick={handleLogout} className="flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium text-slate-400 dark:text-slate-500 transition-all">
            <LogOut size={20} /><span>Thoát</span>
          </button>
        </nav>
      </div>

      {pendingWorkbook && (
        <SheetSelectModal
          pendingWorkbook={pendingWorkbook}
          selectedSheets={selectedSheets}
          isSaving={isSaving}
          toggleSheetSelection={toggleSheetSelection}
          setSelectedSheets={setSelectedSheets}
          handleImportSelectedSheets={handleImportSelectedSheets}
          onCancel={() => { setPendingWorkbook(null); setSelectedSheets([]); }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// SHEET SELECTION MODAL
// ══════════════════════════════════════════════════════════════════
function SheetSelectModal({ pendingWorkbook, selectedSheets, isSaving, toggleSheetSelection, setSelectedSheets, handleImportSelectedSheets, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-700">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Chọn trang tính</h3>
              <p className="text-brand-200 text-sm truncate max-w-[200px]">{pendingWorkbook.file.name}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setSelectedSheets([...pendingWorkbook.wb.SheetNames])} className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 font-medium">Chọn tất cả</button>
          <button onClick={() => setSelectedSheets([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium">Bỏ chọn</button>
        </div>

        <div className="max-h-60 overflow-y-auto px-6 py-4 space-y-2">
          {pendingWorkbook.wb.SheetNames.map((wsname) => {
            const isSelected = selectedSheets.includes(wsname);
            return (
              <button key={wsname} onClick={() => toggleSheetSelection(wsname)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                  isSelected ? "bg-brand-50 dark:bg-brand-900/20 border-brand-400 dark:border-brand-600 text-brand-800 dark:text-brand-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"}`}>
                  {isSelected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="font-medium flex-1 truncate">{wsname}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl">Hủy</button>
          <button onClick={handleImportSelectedSheets} disabled={selectedSheets.length === 0 || isSaving}
            className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Nhập dữ liệu"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// VOCAB LIST VIEW
// ══════════════════════════════════════════════════════════════════
function VocabListView({ topics, selectedTopic, vocabList, isLoadingVocab, selectTopic, backToTopics, handleFileUpload, processFile, handleDeleteTopic, handleDeleteVocab, totalVocab }) {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); };

  if (selectedTopic) {
    return (
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={backToTopics} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Danh sách
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-4">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">{selectedTopic.topic_name}</h2>
              <p className="text-brand-200 text-sm mt-0.5">{vocabList.length} từ vựng</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-xl">{vocabList.length}</div>
          </div>

          {isLoadingVocab ? (
            <div className="py-20 text-center"><Loader2 size={36} className="animate-spin text-brand-500 mx-auto" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase w-12 text-center">#</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Tiếng Anh</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Tiếng Việt</th>
                    <th className="py-4 px-5 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {vocabList.map((item, index) => (
                    <tr key={item.vocabulary_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 group">
                      <td className="py-3.5 px-5 text-center text-slate-400 text-sm">{index + 1}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100">
                        {item.word} {item.ipa && <span className="ml-2 text-xs font-normal text-brand-500 font-mono bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded">{item.ipa}</span>}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">{item.meaning}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button onClick={() => handleDeleteVocab(item.vocabulary_id, item.word)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  const groupedTopics = topics.reduce((acc, topic) => {
    const groupName = topic.session_name || "Chủ điểm hệ thống";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(topic);
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kho Từ Vựng Của Bạn</h2>
        <p className="text-slate-500 mt-1">{topics.length} bộ đề • {totalVocab} từ vựng</p>
      </div>

      <div ref={dropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={`relative mb-8 border-2 border-dashed rounded-3xl p-8 text-center transition-all cursor-pointer ${
          isDragging ? "border-brand-500 bg-brand-50 scale-[1.01]" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300"
        }`}>
        <label className="absolute inset-0 cursor-pointer" htmlFor="excel-upload" />
        <input id="excel-upload" type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${isDragging ? "bg-brand-500 text-white shadow-lg" : "bg-brand-50 text-brand-500"}`}>
          <Upload size={28} />
        </div>
        <p className="font-semibold text-slate-700 dark:text-slate-300">Thả file Excel vào đây để thêm từ vựng</p>
      </div>

      {topics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 py-16 text-center rounded-3xl border border-slate-200 dark:border-slate-800">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Chưa có dữ liệu, hãy tải lên file Excel.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedTopics).map(([groupName, groupTopics]) => (
            <FileGroup key={groupName} groupName={groupName} groupTopics={groupTopics} selectTopic={selectTopic} handleDeleteTopic={handleDeleteTopic} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileGroup({ groupName, groupTopics, selectTopic, handleDeleteTopic }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalWords = groupTopics.reduce((s, t) => s + Number(t.vocab_count || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white"><FileSpreadsheet size={18} /></div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{groupName}</p>
            <p className="text-xs text-slate-500">{groupTopics.length} sheet • {totalWords} từ</p>
          </div>
        </div>
        <button className="text-slate-400">{collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
      </div>
      {!collapsed && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupTopics.map(topic => (
            <div key={topic.topic_id} className="relative group bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
              <div onClick={() => selectTopic(topic)} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">{topic.vocab_count}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{topic.topic_name}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.topic_id, topic.topic_name); }} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FLASHCARD / QUIZ WRAPPER
// ══════════════════════════════════════════════════════════════════
function FlashcardQuizWrapper({ topics, mode, setIsQuizOngoing, addXP }) {
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [loadedVocab, setLoadedVocab] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const toggleTopic = (id) => setSelectedTopicIds(p => p.includes(id) ? p.filter(i => i !== id) : [...p, id]);

  const handleStart = async () => {
    if (selectedTopicIds.length === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(selectedTopicIds.map(id => axios.get(`${API_BASE}/topics/${id}/vocabularies`)));
      setLoadedVocab(results.flatMap(res => res.data.data || []));
      setIsReady(true);
    } catch { showToast("Lỗi tải từ vựng", "error"); } finally { setIsLoading(false); }
  };

  if (isReady && loadedVocab.length > 0) {
    if (mode === "flashcard") return <FlashcardView vocabList={loadedVocab} onBack={() => setIsReady(false)} addXP={addXP} />;
    if (mode === "quiz") return <QuizView vocabList={loadedVocab} setIsQuizOngoing={setIsQuizOngoing} onBack={() => setIsReady(false)} addXP={addXP} />;
  }

  const modeColor = mode === "flashcard" ? "from-violet-500 to-purple-600" : "from-brand-600 to-brand-500";
  
  return (
    <div className="max-w-2xl mx-auto">
      <div className={`bg-gradient-to-r ${modeColor} rounded-3xl p-8 text-white text-center mb-6 shadow-xl`}>
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4"><BrainCircuit size={32} /></div>
        <h2 className="text-2xl font-bold mb-1">{mode === "flashcard" ? "Flashcards" : "Kiểm tra"}</h2>
        <p className="text-white/80 text-sm">Chọn bộ đề để bắt đầu</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSelectedTopicIds(topics.map(t => t.topic_id))} className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-medium">Chọn tất cả</button>
          <button onClick={() => setSelectedTopicIds([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 font-medium">Bỏ chọn</button>
        </div>
        <div className="flex flex-wrap gap-2 max-h-72 overflow-y-auto pb-4">
          {topics.map(topic => {
            const isSelected = selectedTopicIds.includes(topic.topic_id);
            return (
              <button key={topic.topic_id} onClick={() => toggleTopic(topic.topic_id)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                  isSelected ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"
                }`}>
                {topic.topic_name} <span className="text-xs opacity-60">({topic.vocab_count})</span>
              </button>
            );
          })}
        </div>
        <button onClick={handleStart} disabled={selectedTopicIds.length === 0 || isLoading}
          className={`w-full py-4 mt-2 font-bold rounded-2xl text-white shadow-lg disabled:opacity-50 flex justify-center bg-gradient-to-r ${modeColor}`}>
          {isLoading ? <Loader2 className="animate-spin" /> : "BẮT ĐẦU"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FLASHCARD VIEW
// ══════════════════════════════════════════════════════════════════
function FlashcardView({ vocabList, onBack, addXP }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  // Phím tắt (Keyboard shortcuts)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f); }
      if (e.code === 'ArrowRight') { setCurrentIndex(p => (p + 1) % vocabList.length); setIsFlipped(false); addXP(1); }
      if (e.code === 'ArrowLeft') { setCurrentIndex(p => (p - 1 + vocabList.length) % vocabList.length); setIsFlipped(false); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [vocabList.length, addXP]);

  const currentWord = vocabList[currentIndex];
  const progress = ((currentIndex + 1) / vocabList.length) * 100;

  return (
    <div className="max-w-2xl mx-auto text-center">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-slate-500 hover:text-brand-500 flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Thoát</button>
        <span className="font-bold text-slate-400">{currentIndex + 1} / {vocabList.length}</span>
      </div>
      <div className="h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mb-8"><div className="h-full bg-brand-500 rounded-full transition-all" style={{width: `${progress}%`}}/></div>
      
      <div className="flip-card w-full aspect-[4/3] cursor-pointer mb-8" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`flip-inner w-full h-full ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-front bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 flex flex-col justify-center shadow-xl">
            <h2 className="text-5xl font-bold text-slate-900 dark:text-white mb-2">{currentWord.word}</h2>
            {currentWord.ipa && <p className="text-brand-500 font-mono">{currentWord.ipa}</p>}
            <p className="absolute bottom-6 inset-x-0 text-xs text-slate-400">Ấn Space để lật</p>
          </div>
          <div className="flip-back bg-brand-600 rounded-3xl flex flex-col justify-center text-white shadow-xl">
            <h2 className="text-4xl font-bold px-4">{currentWord.meaning}</h2>
          </div>
        </div>
      </div>
      
      <div className="flex justify-center gap-6">
        <button onClick={() => { setCurrentIndex((currentIndex - 1 + vocabList.length) % vocabList.length); setIsFlipped(false); }} className="w-14 h-14 rounded-full border-2 border-slate-200 flex items-center justify-center hover:bg-slate-100 text-slate-600"><ChevronLeft/></button>
        <button onClick={() => { setCurrentIndex((currentIndex + 1) % vocabList.length); setIsFlipped(false); addXP(1); }} className="w-14 h-14 rounded-full border-2 border-brand-500 flex items-center justify-center hover:bg-brand-50 text-brand-600"><ChevronRight/></button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// QUIZ VIEW
// ══════════════════════════════════════════════════════════════════
function QuizView({ vocabList, setIsQuizOngoing, onBack, addXP }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('start');
  const [selected, setSelected] = useState(null);

  const startQuiz = () => {
    const mixed = [...vocabList].sort(() => 0.5 - Math.random()).map(w => {
      const wrong = vocabList.filter(x => x.vocabulary_id !== w.vocabulary_id).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.meaning);
      return { ...w, options: [...wrong, w.meaning].sort(() => 0.5 - Math.random()) };
    });
    setQuestions(mixed); setIndex(0); setScore(0); setGameState('playing'); setSelected(null);
  };

  useEffect(() => { if (setIsQuizOngoing) setIsQuizOngoing(gameState === 'playing'); }, [gameState, setIsQuizOngoing]);

  // Keyboard Shortcuts (1, 2, 3, 4)
  useEffect(() => {
    const handleKey = (e) => {
      if (gameState !== 'playing' || selected) return;
      const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (keyMap[e.key] !== undefined && questions[index]?.options[keyMap[e.key]]) {
        handleAnswer(questions[index].options[keyMap[e.key]]);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, selected, index, questions]);

  const handleAnswer = (opt) => {
    if (selected) return;
    setSelected(opt);
    const isCorrect = opt === questions[index].meaning;
    if (isCorrect) {
      playSound('correct');
      setScore(s => s + 1);
    } else {
      playSound('wrong');
    }
    
    setTimeout(() => {
      if (index === questions.length - 1) {
        setGameState('result');
        if (score + (isCorrect ? 1 : 0) === questions.length) {
          confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
        }
        addXP((score + (isCorrect ? 1 : 0)) * 5); // 5 XP per correct answer
      } else {
        setIndex(index + 1);
        setSelected(null);
      }
    }, 1200);
  };

  if (gameState === 'start') {
    return (
      <div className="text-center bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 max-w-lg mx-auto">
        <BrainCircuit size={48} className="mx-auto text-brand-500 mb-4" />
        <h2 className="text-2xl font-bold mb-6">Bạn đã sẵn sàng?</h2>
        <button onClick={startQuiz} className="w-full py-4 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 shadow-lg mb-4">Bắt đầu Quiz</button>
        <button onClick={onBack} className="text-slate-500 font-medium hover:text-slate-800">Quay lại</button>
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="text-center bg-white dark:bg-slate-900 p-12 rounded-3xl border border-slate-200 max-w-lg mx-auto animate-scale-in">
        <div className="text-6xl mb-4">🏆</div>
        <h2 className="text-3xl font-black mb-2">Hoàn thành!</h2>
        <p className="text-xl text-slate-600 mb-8">Bạn đúng <span className="text-brand-600 font-bold text-3xl">{score}</span> / {questions.length}</p>
        <div className="flex gap-4">
          <button onClick={onBack} className="flex-1 py-4 bg-slate-100 font-bold rounded-2xl hover:bg-slate-200 text-slate-700">Đóng</button>
          <button onClick={startQuiz} className="flex-1 py-4 bg-brand-600 text-white font-bold rounded-2xl hover:bg-brand-700 shadow-lg">Làm lại</button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-4 text-center font-bold text-slate-500">Câu {index + 1} / {questions.length}</div>
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 p-12 text-center shadow-sm mb-6">
        <h3 className="text-4xl font-bold mb-2">{q.word}</h3>
        {q.ipa && <p className="text-slate-400 font-mono">{q.ipa}</p>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {q.options.map((opt, i) => {
          let cls = "bg-white dark:bg-slate-900 border-2 border-slate-200 hover:border-brand-400";
          if (selected) {
            if (opt === q.meaning) cls = "bg-emerald-50 border-emerald-500 text-emerald-700";
            else if (opt === selected) cls = "bg-red-50 border-red-500 text-red-700";
            else cls = "opacity-50";
          }
          return (
            <button key={i} onClick={() => handleAnswer(opt)} disabled={!!selected} className={`p-4 rounded-2xl text-lg font-medium transition-all ${cls}`}>
              <span className="text-slate-400 text-xs font-bold mr-2">{i+1}</span> {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}
