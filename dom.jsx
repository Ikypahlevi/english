import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen, Layers, GraduationCap, Upload, ChevronLeft, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, Sparkles, Loader2, Volume2,
  Lightbulb, Trash2, FolderOpen, ArrowLeft, Database, Sun, Moon,
  FileSpreadsheet, LayoutDashboard, BookMarked, BrainCircuit, Zap,
  ChevronDown, ChevronUp, FileText, LogOut, User, Flame, CalendarClock, MessageSquare, Users, Headphones, Trophy, Keyboard
} from "lucide-react";
import axios from "axios";
import confetti from "canvas-confetti";
import localforage from "localforage";
import LeaderboardView from "./src/views/LeaderboardView.jsx";
import DashboardView from "./src/views/DashboardView.jsx";


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
    } else if (type === 'flip') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.1);
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.15);
    }
  } catch (e) { console.log("Audio not supported"); }
};

// ── Text-to-Speech (Anh Mỹ) ─────────────────────────────────────────
export const speakWord = (text, lang = 'en-US') => {
  if (!window.speechSynthesis) return;
  
  // Hủy các giọng đọc đang dang dở
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9; // Đọc chậm một chút để dễ nghe hơn
  window.speechSynthesis.speak(utterance);
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
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
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
            className="vip-btn w-full py-4 mt-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/40 disabled:opacity-50 flex items-center justify-center overflow-hidden relative">
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-600 rounded-xl m-4 border border-red-200 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Đã xảy ra lỗi (Crash)</h2>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-white p-4 rounded border border-red-100 overflow-auto max-h-96">
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.error && this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700">Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
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
  const [activeTab, setActiveTab] = useState("dashboard"); // Mặc định là trang tổng quan
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

  // Helper để nhóm, lọc trùng lặp và sắp xếp topics
  const groupAndSortTopics = useCallback((topicsList) => {
    const uniqueTopics = new Map();
    topicsList.forEach(topic => {
      const key = `${topic.session_name || "Chủ điểm hệ thống"}|||${topic.topic_name}`;
      if (!uniqueTopics.has(key) || topic.topic_id > uniqueTopics.get(key).topic_id) {
         uniqueTopics.set(key, topic);
      }
    });

    const grouped = Array.from(uniqueTopics.values()).reduce((acc, topic) => {
      const groupName = topic.session_name || "Chủ điểm hệ thống";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(topic);
      return acc;
    }, {});

    return Object.entries(grouped).map(([groupName, groupTopics]) => {
      // Sắp xếp các topic bên trong buổi
      groupTopics.sort((a, b) => a.topic_name.localeCompare(b.topic_name, undefined, { numeric: true }));
      return [groupName, groupTopics];
    }).sort((a, b) => {
      // Sắp xếp các buổi (e.g., "Buổi 1" -> 1, "Buổi 10" -> 10)
      const matchA = a[0].match(/\d+/);
      const matchB = b[0].match(/\d+/);
      if (matchA && matchB) {
        return parseInt(matchA[0], 10) - parseInt(matchB[0], 10);
      }
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
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

  const handleDeleteGroup = useCallback(async (groupName, groupTopics) => {
    if (!window.confirm(`Xóa toàn bộ file "${groupName}" gồm ${groupTopics.length} sheet và tất cả từ vựng?`)) return;
    try {
      await Promise.all(groupTopics.map(topic => axios.delete(`${API_BASE}/topics/${topic.topic_id}`)));
      if (selectedTopic && groupTopics.find(t => t.topic_id === selectedTopic.topic_id)) { 
        setSelectedTopic(null); setVocabList([]); 
      }
      await fetchInitialData();
      showToast(`Đã xóa file "${groupName}"`, "success");
    } catch (err) { 
      console.error("Lỗi xóa group:", err);
      showToast("Lỗi khi xóa file.", "error"); 
    }
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
    { id: "dashboard", icon: LayoutDashboard, label: "Tổng quan" },
    { id: "list",      icon: BookOpen,       label: "Kho từ" },
    { id: "flashcard", icon: Layers,         label: "Thẻ bài" },
    { id: "quiz",      icon: BrainCircuit,   label: "Kiểm tra" },
    { id: "transcribe",icon: Headphones,     label: "Luyện nghe" },
  ];
  if (user?.role === 'admin') {
    navItems.push({ id: "admin", icon: Users, label: "Quản trị" });
  }

  if (!user) {
    return (
      <>
        <ToastContainer />
        <AuthScreen onLoginSuccess={setUser} />
      </>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <ToastContainer />

      {/* ── VIP TOP HEADER ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm transition-all duration-300">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30 group-hover:animate-pulse-slow transition-all duration-300">
              <GraduationCap size={22} className="text-white" />
            </div>
            <h1 className="text-xl font-black bg-gradient-to-r from-brand-700 to-brand-500 dark:from-brand-300 dark:to-brand-100 bg-clip-text text-transparent tracking-tight hidden sm:block">EngMaster</h1>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-2">
            {navItems.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => handleTabChange(id)}
                className={`nav-item px-5 py-2 flex items-center gap-2 font-medium text-sm transition-all ${
                  activeTab === id
                    ? "nav-active"
                    : "text-slate-600 dark:text-slate-400"
                }`}
              >
                <Icon size={18} className={activeTab === id ? "animate-bounce" : ""} />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Gamification Stats & Profile */}
          <div className="flex items-center gap-3 md:gap-5">
            <div className="flex items-center gap-3">
               <div className="flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform cursor-default" title="Kinh nghiệm">
                 <div className="relative">
                   <Zap size={20} className="fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse-slow" />
                 </div>
                 <span className="font-bold text-slate-800 dark:text-white text-sm">{userStats.xp}</span>
               </div>
               <div className="flex items-center gap-1.5 hover:-translate-y-0.5 transition-transform cursor-default" title="Chuỗi ngày học">
                 <div className="relative">
                   <Flame size={20} className="fill-orange-500 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse-slow" />
                 </div>
                 <span className="font-bold text-slate-800 dark:text-white text-sm">{userStats.streak_days}</span>
               </div>
            </div>

            <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>

            <div className="flex items-center gap-2">
              <button onClick={() => setDark(d => !d)} className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all hover:scale-110 group">
                {dark ? <Sun size={20} className="group-hover:text-amber-400 group-hover:rotate-45 transition-all" /> : <Moon size={20} className="group-hover:text-brand-500 group-hover:-rotate-12 transition-all" />}
              </button>
              
              <button onClick={handleLogout} className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-500 transition-all hover:scale-110" title="Đăng xuất">
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ────────────────────────────────── */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200/50 dark:border-slate-800/50 px-2 pb-safe pt-2 flex items-center justify-around shadow-[0_-10px_20px_rgba(0,0,0,0.05)] dark:shadow-none">
        {navItems.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => handleTabChange(id)}
            className={`flex-1 flex flex-col items-center justify-center p-2 rounded-xl gap-1 text-[10px] font-bold transition-all ${
              activeTab === id
                ? "text-brand-600 dark:text-brand-400"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <div className={`p-1.5 rounded-lg transition-all ${activeTab === id ? 'bg-brand-50 dark:bg-brand-900/30' : ''}`}>
              <Icon size={22} className={activeTab === id ? "animate-bounce drop-shadow-md" : ""} />
            </div>
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <main className="flex-1 px-4 md:px-8 py-8 md:py-10 max-w-5xl w-full mx-auto">
          {isLoadingTopics ? (
             <div className="p-8 space-y-8 animate-pulse max-w-5xl mx-auto w-full">
               <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-2xl w-1/4"></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                 <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
                 <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded-2xl"></div>
               </div>
               <div className="h-96 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
             </div>
          ) : (
            <>
              {activeTab === "dashboard" && (
                <div className="animate-slide-up">
                  <DashboardView userStats={userStats} totalTopics={topics.length} totalVocab={totalVocab} />
                </div>
              )}
              {activeTab === "list" && (
                <div className="animate-slide-up">
                  <ErrorBoundary>
                    <VocabListView
                      user={user}
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
                      handleDeleteGroup={handleDeleteGroup}
                      totalVocab={totalVocab}
                    />
                  </ErrorBoundary>
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
              {activeTab === "chat" && (
                <div className="animate-slide-up">
                  <FlashcardQuizWrapper topics={topics} mode="chat" addXP={addXP} />
                </div>
              )}
              {activeTab === "transcribe" && (
                <div className="animate-slide-up">
                  <AudioTranscriptionView />
                </div>
              )}
              {activeTab === "leaderboard" && (
                <div className="animate-slide-up">
                  <LeaderboardView />
                </div>
              )}
              {activeTab === "admin" && user?.role === 'admin' && (
                <div className="animate-slide-up">
                  <AdminDashboardView />
                </div>
              )}
            </>
          )}
        </main>

      </div>

      {/* Đã xoá AIFloatingChat theo yêu cầu */}

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
// DAILY REVIEW VIEW (SRS)
// ══════════════════════════════════════════════════════════════════
function DailyReviewView({ addXP, setIsQuizOngoing }) {
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState(null); // 'flashcard' or 'quiz'

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/reviews/today`);
      setReviews(res.data.data || []);
    } catch (err) {
      showToast("Lỗi tải danh sách ôn tập", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinishReview = () => {
    setMode(null);
    fetchReviews(); // Reload to see if any are left
  };

  if (isLoading) {
    return <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-brand-500" size={40} /></div>;
  }

  if (mode === "flashcard") {
    return <FlashcardView vocabList={reviews} onBack={handleFinishReview} addXP={addXP} updateSRS={true} onComplete={handleFinishReview} />;
  }

  if (mode === "quiz") {
    return <IntegratedQuizView vocabList={reviews} setIsQuizOngoing={setIsQuizOngoing} onBack={handleFinishReview} addXP={addXP} updateSRS={true} onComplete={handleFinishReview} />;
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 rounded-2xl p-8 text-white text-center mb-6 shadow-xl relative overflow-hidden animate-slide-up">
        <Sparkles size={120} className="absolute -top-10 -right-10 text-brand-400 opacity-20 rotate-12" />
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 relative z-10">
          <CalendarClock size={32} />
        </div>
        <h2 className="text-2xl font-bold mb-2 relative z-10">Mục tiêu hôm nay</h2>
        
        {reviews.length > 0 ? (
          <p className="text-white/90 text-sm relative z-10">Bạn có <span className="font-bold text-amber-300 text-lg">{reviews.length}</span> từ vựng cần ôn lại để không bị quên.</p>
        ) : (
          <p className="text-white/90 text-sm relative z-10">Tuyệt vời! Bạn đã hoàn thành tất cả mục tiêu ôn tập hôm nay.</p>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-up" style={{ animationDelay: '100ms' }}>
          <button onClick={() => setMode('flashcard')} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl hover:border-brand-500 dark:hover:border-brand-500 transition-all group flex flex-col items-center text-center shadow-sm hover:shadow-lg hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">Ôn bằng Flashcard</h3>
            <p className="text-xs text-slate-500">Tự đánh giá trí nhớ của bản thân qua thẻ lật</p>
          </button>

          <button onClick={() => setMode('quiz')} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl hover:border-brand-500 dark:hover:border-brand-500 transition-all group flex flex-col items-center text-center shadow-sm hover:shadow-lg hover:-translate-y-1">
            <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BrainCircuit size={24} />
            </div>
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 mb-1">Ôn bằng Bài tập</h3>
            <p className="text-xs text-slate-500">Hệ thống sẽ tự chấm điểm và tính toán lại lịch ôn</p>
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl text-center shadow-sm animate-scale-in">
          <CheckCircle2 size={64} className="mx-auto text-emerald-500 mb-4 animate-bounce" />
          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Đã học xong!</h3>
          <p className="text-slate-500 text-sm">Hệ thống Spaced Repetition (SRS) ghi nhận trí nhớ của bạn rất tốt. Hãy quay lại vào ngày mai để duy trì chuỗi Streak nhé.</p>
        </div>
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-700">
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
function VocabListView({ user, topics, selectedTopic, vocabList, isLoadingVocab, selectTopic, backToTopics, handleFileUpload, processFile, handleDeleteTopic, handleDeleteVocab, handleDeleteGroup, totalVocab }) {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); };

  const sortedSessions = useMemo(() => {
    const uniqueTopics = new Map();
    topics.forEach(topic => {
      const key = `${topic.session_name || "Chủ điểm hệ thống"}|||${topic.topic_name}`;
      if (!uniqueTopics.has(key) || topic.topic_id > uniqueTopics.get(key).topic_id) {
         uniqueTopics.set(key, topic);
      }
    });

    const grouped = Array.from(uniqueTopics.values()).reduce((acc, topic) => {
      const groupName = topic.session_name || "Chủ điểm hệ thống";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(topic);
      return acc;
    }, {});

    return Object.entries(grouped).map(([groupName, groupTopics]) => {
      groupTopics.sort((a, b) => a.topic_name.localeCompare(b.topic_name, undefined, { numeric: true }));
      return [groupName, groupTopics];
    }).sort((a, b) => {
      const matchA = a[0].match(/\d+/);
      const matchB = b[0].match(/\d+/);
      if (matchA && matchB) {
        return parseInt(matchA[0], 10) - parseInt(matchB[0], 10);
      }
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [topics]);

  if (selectedTopic) {
    return (
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={backToTopics} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Danh sách
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-4">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">{selectedTopic.topic_name}</h2>
              <p className="text-brand-200 text-sm mt-0.5">{vocabList.length} từ vựng</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-xl">{vocabList.length}</div>
          </div>

          {isLoadingVocab ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
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
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <div className="relative group/img cursor-pointer">
                           <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-500">
                             <Sparkles size={14} />
                           </div>
                           <div className="absolute left-0 bottom-full mb-2 hidden group-hover/img:block z-50 w-40 h-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden origin-bottom-left animate-scale-in">
                             <img src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(item.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=200&height=200&nologo=true`} alt={item.word} className="w-full h-full object-cover" loading="lazy" />
                           </div>
                        </div>
                        {item.word} 
                        <button onClick={(e) => { e.stopPropagation(); speakWord(item.word); }} className="ml-2 text-slate-400 hover:text-brand-500 transition-colors" title="Nghe phát âm">
                          <Volume2 size={16} />
                        </button>
                        {item.ipa && <span className="ml-2 text-xs font-normal text-brand-500 font-mono bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded">{item.ipa}</span>}
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



  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kho Từ Vựng Của Bạn</h2>
        <p className="text-slate-500 mt-1">{topics.length} bộ đề • {totalVocab} từ vựng</p>
      </div>

      <div ref={dropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={`relative mb-8 border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
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
        <div className="bg-white dark:bg-slate-900 py-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Chưa có dữ liệu, hãy tải lên file Excel.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedSessions.map(([groupName, groupTopics]) => (
            <FileGroup key={groupName} user={user} groupName={groupName} groupTopics={groupTopics} selectTopic={selectTopic} handleDeleteTopic={handleDeleteTopic} handleDeleteGroup={handleDeleteGroup} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileGroup({ user, groupName, groupTopics, selectTopic, handleDeleteTopic, handleDeleteGroup }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalWords = groupTopics.reduce((s, t) => s + Number(t.vocab_count || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white"><FileSpreadsheet size={18} /></div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{groupName}</p>
            <p className="text-xs text-slate-500">{groupTopics.length} sheet • {totalWords} từ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupName, groupTopics); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Xóa toàn bộ file">
            <Trash2 size={16} />
          </button>
          <button className="text-slate-400 p-1">{collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
        </div>
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
    if (mode === "flashcard") return <FlashcardView vocabList={loadedVocab} onBack={() => setIsReady(false)} addXP={addXP} updateSRS={true} />;
    if (mode === "quiz") return <IntegratedQuizView vocabList={loadedVocab} setIsQuizOngoing={setIsQuizOngoing} onBack={() => setIsReady(false)} addXP={addXP} updateSRS={true} />;
    if (mode === "chat") return <ChatRoleplayView vocabList={loadedVocab} onBack={() => setIsReady(false)} addXP={addXP} />;
  }

  const modeColor = mode === "flashcard" ? "from-violet-500 to-purple-600" : mode === "chat" ? "from-emerald-500 to-teal-600" : "from-brand-600 to-brand-500";
  
  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className={`bg-gradient-to-r ${modeColor} rounded-2xl p-8 text-white text-center mb-6 shadow-xl`}>
        <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
          {mode === "chat" ? <MessageSquare size={32} /> : <BrainCircuit size={32} />}
        </div>
        <h2 className="text-2xl font-bold mb-1">{mode === "flashcard" ? "Flashcards" : mode === "chat" ? "Giao tiếp AI" : "Kiểm tra tổng hợp"}</h2>
        <p className="text-white/80 text-sm">Chọn bộ đề để bắt đầu</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-4">
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setSelectedTopicIds(topics.map(t => t.topic_id))} className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 text-brand-600 font-medium">Chọn tất cả</button>
          <button onClick={() => setSelectedTopicIds([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 font-medium">Bỏ chọn</button>
        </div>
        <div className="max-h-80 overflow-y-auto pr-2 pb-4 space-y-6">
          {(() => {
            const uniqueTopics = new Map();
            topics.forEach(topic => {
              const key = `${topic.session_name || "Chủ điểm hệ thống"}|||${topic.topic_name}`;
              if (!uniqueTopics.has(key) || topic.topic_id > uniqueTopics.get(key).topic_id) {
                 uniqueTopics.set(key, topic);
              }
            });

            const grouped = Array.from(uniqueTopics.values()).reduce((acc, topic) => {
              const groupName = topic.session_name || "Chủ điểm hệ thống";
              if (!acc[groupName]) acc[groupName] = [];
              acc[groupName].push(topic);
              return acc;
            }, {});

            const sorted = Object.entries(grouped).map(([groupName, groupTopics]) => {
              groupTopics.sort((a, b) => a.topic_name.localeCompare(b.topic_name, undefined, { numeric: true }));
              return [groupName, groupTopics];
            }).sort((a, b) => {
              const matchA = a[0].match(/\d+/);
              const matchB = b[0].match(/\d+/);
              if (matchA && matchB) {
                return parseInt(matchA[0], 10) - parseInt(matchB[0], 10);
              }
              return a[0].localeCompare(b[0], undefined, { numeric: true });
            });

            return sorted.map(([groupName, groupTopics]) => (
              <div key={groupName}>
                <div className="flex items-center gap-2 mb-3">
                  <FileSpreadsheet size={16} className="text-slate-400" />
                  <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300">{groupName}</h3>
                </div>
                <div className="flex flex-wrap gap-2 pl-6">
                  {groupTopics.map(topic => {
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
            </div>
          ));
        })()}
        </div>
        <button onClick={handleStart} disabled={selectedTopicIds.length === 0 || isLoading}
          className={`vip-btn w-full py-4 mt-2 font-bold rounded-2xl text-white shadow-lg disabled:opacity-50 flex justify-center bg-gradient-to-r ${modeColor} shadow-brand-500/40`}>
          {isLoading ? <Loader2 className="animate-spin" /> : "BẮT ĐẦU"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FLASHCARD VIEW (SRS Enabled)
// ══════════════════════════════════════════════════════════════════
function FlashcardView({ vocabList, onBack, addXP, updateSRS, onComplete }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const submitRating = async (rating) => {
    const word = vocabList[currentIndex];
    
    // Nếu chế độ updateSRS được bật, gọi API cập nhật tiến độ
    if (updateSRS) {
      try {
        await axios.post(`${API_BASE}/reviews/update`, { vocabulary_id: word.vocabulary_id, rating });
      } catch (err) { console.error("Lỗi cập nhật SRS"); }
    }
    
    if (rating >= 3) addXP(2); // Cộng điểm cho những từ nhớ tốt
    
    // Tự động chuyển thẻ
    if (currentIndex < vocabList.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      showToast("Hoàn thành bài tập Flashcard!", "success");
      if (onComplete) onComplete();
      else onBack();
    }
  };

  // Keyboard Shortcuts (1, 2, 3, 4) for rating when flipped, Space for flip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') { 
        e.preventDefault(); 
        playSound('flip');
        setIsFlipped(f => !f); 
      }
      
      // Nếu mặt sau đang lật, cho phép dùng số 1-4 để đánh giá
      if (isFlipped) {
        if (e.key === '1') submitRating(0); // Quên
        if (e.key === '2') submitRating(2); // Khó
        if (e.key === '3') submitRating(4); // Tốt
        if (e.key === '4') submitRating(5); // Dễ
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isFlipped, vocabList]);

  const currentWord = vocabList[currentIndex];
  const progress = ((currentIndex + 1) / vocabList.length) * 100;

  return (
    <div className="max-w-3xl mx-auto text-center animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <button onClick={onBack} className="text-slate-500 hover:text-brand-500 flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Thoát</button>
        <span className="font-bold text-slate-400 text-lg">{currentIndex + 1} / {vocabList.length}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full mb-10 overflow-hidden shadow-inner">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out" style={{width: `${progress}%`}}/>
      </div>
      
      <div className="flip-card w-full aspect-[4/3] sm:aspect-[16/9] cursor-pointer mb-10 group" onClick={() => { playSound('flip'); setIsFlipped(!isFlipped); }}>
        <div className={`flip-inner w-full h-full ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-front bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center shadow-2xl shadow-brand-500/10 relative overflow-hidden group-hover:border-brand-300 transition-colors">
            <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
              <img 
                src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(currentWord.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=800&height=600&nologo=true`} 
                alt="bg" 
                className="w-full h-full object-cover blur-xl scale-110"
              />
            </div>
            <div className="relative z-10 flex flex-col items-center w-full px-4">
              <div className="w-48 h-48 mb-8 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                 <img 
                  src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(currentWord.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=400&height=400&nologo=true`} 
                  alt={currentWord.word} 
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="flex items-center gap-4 mb-3">
                <h2 className="text-5xl sm:text-6xl font-black text-slate-900 dark:text-white tracking-tight">{currentWord.word}</h2>
                <button onClick={(e) => { e.stopPropagation(); speakWord(currentWord.word); }} className="w-14 h-14 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-100 dark:hover:bg-brand-800 hover:scale-110 transition-all shadow-md" title="Nghe phát âm">
                  <Volume2 size={28} />
                </button>
              </div>
              {currentWord.ipa && <p className="text-brand-500 font-mono text-2xl bg-brand-50 dark:bg-slate-800 px-6 py-2 rounded-xl inline-block font-medium">{currentWord.ipa}</p>}
            </div>
            <p className="absolute bottom-6 inset-x-0 text-sm text-slate-400 dark:text-slate-500 font-semibold z-10 animate-bounce">Nhấn Space để lật</p>
          </div>
          <div className="flip-back bg-gradient-to-br from-brand-600 to-brand-500 rounded-[2rem] flex flex-col justify-center items-center text-white shadow-2xl relative border-4 border-brand-400/30">
            <h2 className="text-5xl sm:text-6xl font-black px-6 text-center leading-tight">{currentWord.meaning}</h2>
          </div>
        </div>
      </div>
      
      {isFlipped ? (
        <div className="grid grid-cols-4 gap-3 animate-slide-up">
          <button onClick={() => submitRating(0)} className="group py-5 bg-white dark:bg-slate-900 text-rose-500 font-bold rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:-translate-y-1 transition-all flex flex-col items-center shadow-sm">
            <span className="text-3xl mb-2 group-hover:scale-125 transition-transform">😔</span>
            <span className="text-lg">Quên</span>
            <span className="text-xs opacity-50 mt-1 font-medium">Phím 1</span>
          </button>
          <button onClick={() => submitRating(2)} className="group py-5 bg-white dark:bg-slate-900 text-orange-500 font-bold rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:-translate-y-1 transition-all flex flex-col items-center shadow-sm">
            <span className="text-3xl mb-2 group-hover:scale-125 transition-transform">🤔</span>
            <span className="text-lg">Khó</span>
            <span className="text-xs opacity-50 mt-1 font-medium">Phím 2</span>
          </button>
          <button onClick={() => submitRating(4)} className="group py-5 bg-white dark:bg-slate-900 text-emerald-500 font-bold rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:-translate-y-1 transition-all flex flex-col items-center shadow-sm">
            <span className="text-3xl mb-2 group-hover:scale-125 transition-transform">😊</span>
            <span className="text-lg">Tốt</span>
            <span className="text-xs opacity-50 mt-1 font-medium">Phím 3</span>
          </button>
          <button onClick={() => submitRating(5)} className="group py-5 bg-white dark:bg-slate-900 text-blue-500 font-bold rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 hover:border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:-translate-y-1 transition-all flex flex-col items-center shadow-sm">
            <span className="text-3xl mb-2 group-hover:scale-125 transition-transform">🤩</span>
            <span className="text-lg">Dễ</span>
            <span className="text-xs opacity-50 mt-1 font-medium">Phím 4</span>
          </button>
        </div>
      ) : (
        <div className="h-28 opacity-60 flex items-center justify-center text-base font-semibold text-slate-400 animate-pulse">
          Cố gắng nhớ nghĩa của từ trước khi lật thẻ nhé!
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// INTEGRATED QUIZ VIEW (SRS Enabled)
// ══════════════════════════════════════════════════════════════════
function IntegratedQuizView({ vocabList, setIsQuizOngoing, onBack, addXP, updateSRS, onComplete }) {
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [gameState, setGameState] = useState('start'); // start, playing, result
  const [mistakes, setMistakes] = useState([]);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  
  // For multiple-choice
  const [selected, setSelected] = useState(null);
  
  // For typing / listening
  const [input, setInput] = useState("");
  const [isChecking, setIsChecking] = useState(false);
  
  // Shared feedback state
  const [feedback, setFeedback] = useState(null); // { isCorrect, reason }
  const inputRef = useRef(null);

  const allModes = [
    { id: 'multiple-choice', label: 'Trắc nghiệm' },
    { id: 'typing-en-vi', label: 'Gõ tiếng Việt' },
    { id: 'typing-vi-en', label: 'Gõ tiếng Anh' },
    { id: 'listen-en', label: 'Nghe TA - Gõ TV' },
    { id: 'listen-vi', label: 'Nghe TV - Gõ TA' }
  ];
  const [selectedMode, setSelectedMode] = useState('multiple-choice');

  const startQuiz = () => {
    const mixed = [...vocabList].sort(() => 0.5 - Math.random()).map(w => {
      const qType = selectedMode;
      
      let options = [];
      if (qType === 'multiple-choice') {
        const wrong = vocabList.filter(x => x.vocabulary_id !== w.vocabulary_id).sort(() => 0.5 - Math.random()).slice(0, 3).map(x => x.meaning);
        options = [...wrong, w.meaning].sort(() => 0.5 - Math.random());
      }
      return { ...w, qType, options };
    });
    setQuestions(mixed); setIndex(0); setScore(0); setGameState('playing'); 
    setSelected(null); setFeedback(null); setInput(""); setMistakes([]);
    setStreak(0); setMaxStreak(0);
  };

  useEffect(() => { if (setIsQuizOngoing) setIsQuizOngoing(gameState === 'playing'); }, [gameState, setIsQuizOngoing]);

  useEffect(() => {
    if (gameState === 'playing' && !feedback && inputRef.current) {
      inputRef.current.focus();
    }
  }, [gameState, index, feedback]);

  // Auto play audio for listening modes
  useEffect(() => {
    if (gameState === 'playing' && !feedback && questions[index]) {
      const q = questions[index];
      if (q.qType === 'listen-en') {
        speakWord(q.word, 'en-US');
      } else if (q.qType === 'listen-vi') {
        speakWord(q.meaning, 'vi-VN');
      }
    }
  }, [gameState, index, questions, feedback]);

  // Keyboard Shortcuts (1, 2, 3, 4) for multiple choice
  useEffect(() => {
    const handleKey = (e) => {
      if (gameState !== 'playing' || feedback || selected) return;
      const q = questions[index];
      if (q?.qType === 'multiple-choice') {
        const keyMap = { '1': 0, '2': 1, '3': 2, '4': 3 };
        if (keyMap[e.key] !== undefined && q.options[keyMap[e.key]]) {
          handleMCQAnswer(q.options[keyMap[e.key]]);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [gameState, feedback, selected, index, questions]);

  const processResult = async (isCorrect, resultFeedback, q) => {
    setFeedback(resultFeedback);
    setIsChecking(false);

    if (isCorrect) {
      playSound('correct');
      if (!q.hasFailed) setScore(s => s + 1);
      setStreak(prev => {
        const next = prev + 1;
        setMaxStreak(m => Math.max(m, next));
        return next;
      });
    } else {
      playSound('wrong');
      setStreak(0);
      setMistakes(prev => {
        if (prev.find(m => m.vocabulary_id === q.vocabulary_id)) return prev;
        return [...prev, { ...q, userAnswer: resultFeedback.userAnswer || "Không rõ", reason: resultFeedback.reason }];
      });
    }

    if (updateSRS && !q.hasFailed) {
      try {
        await axios.post(`${API_BASE}/reviews/update`, { vocabulary_id: q.vocabulary_id, rating: isCorrect ? 4 : 0 });
      } catch (e) { console.error("Lỗi gửi điểm SRS"); }
    }
  };

  // Tự động chuyển câu sau 3 giây khi có kết quả
  const autoNextRef = useRef(null);
  useEffect(() => {
    autoNextRef.current = () => nextQuestion();
  });

  useEffect(() => {
    let timer;
    if (feedback && gameState === 'playing') {
      timer = setTimeout(() => {
        if (autoNextRef.current) autoNextRef.current();
      }, feedback.isCorrect ? 800 : 1500);
    }
    return () => clearTimeout(timer);
  }, [feedback, gameState]);

  const handleMCQAnswer = async (opt) => {
    if (selected || feedback) return;
    setSelected(opt);
    const q = questions[index];
    const isCorrect = opt === q.meaning;
    const resultFeedback = { isCorrect, reason: isCorrect ? "Chính xác!" : `Sai rồi. Đáp án đúng là: ${q.meaning}`, userAnswer: opt };
    await processResult(isCorrect, resultFeedback, q);
  };

  const handleTypingAnswer = async () => {
    if (!input.trim() || isChecking || feedback) return;
    setIsChecking(true);
    
    const q = questions[index];
    let isCorrect = false;
    let resultFeedback = null;

    // Chuẩn hóa chuỗi: lowercase, xóa dấu tiếng Việt, xóa MỌI loại dấu câu, ký tự đặc biệt
    const normalizeStr = (s) => s ? String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim() : '';
    
    const isEnglishInput = (q.qType === 'typing-vi-en' || q.qType === 'listen-vi');
    const targetStr = isEnglishInput ? q.word : q.meaning;
    
    const normInput = normalizeStr(input);
    const normTarget = normalizeStr(targetStr);
    
    // Tách các nghĩa nếu có dấu phẩy hoặc |
    const targetParts = targetStr.split(/[,|;]/).map(normalizeStr);
    
    // So khớp không phân biệt vị trí từ (word order independent)
    const checkWordsMatch = (str1, str2) => {
      if (!str1 || !str2) return false;
      const w1 = str1.split(' ').sort().join(' ');
      const w2 = str2.split(' ').sort().join(' ');
      return w1 === w2;
    };

    // So khớp nhanh tại frontend
    if (normInput === normTarget || targetParts.includes(normInput) || checkWordsMatch(normInput, normTarget) || targetParts.some(part => checkWordsMatch(normInput, part))) {
      isCorrect = true;
      resultFeedback = { isCorrect: true, reason: "Đúng (Khớp chính xác)", userAnswer: input.trim() };
    } else {
      try {
        // Dùng AI chấm cho các trường hợp từ đồng nghĩa/nghĩa khác
        const res = await axios.post(`${API_BASE}/check-answer`, {
          word: q.word,
          correctMeaning: q.meaning,
          userAnswer: input.trim(),
          isEnglishInput: isEnglishInput
        });
        if (res.data.success) {
          isCorrect = res.data.data.isCorrect;
          resultFeedback = res.data.data;
          resultFeedback.userAnswer = input.trim();
        } else {
          throw new Error("API returned error");
        }
      } catch (e) {
        // Fallback
        isCorrect = normTarget.includes(normInput) && normInput.length >= 3;
        resultFeedback = { isCorrect, reason: isCorrect ? "Chấp nhận (AI Fallback)" : `Sai. Đáp án đúng: ${targetStr}`, userAnswer: input.trim() };
      }
    }
    
    await processResult(isCorrect, resultFeedback, q);
  };

  const nextQuestion = (forceCorrect = false) => {
    const q = questions[index];
    const isCorrect = forceCorrect || (feedback && feedback.isCorrect);
    
    let nextIndex = index + 1;
    let newQuestions = [...questions];
    
    if (!isCorrect) {
      // Đẩy câu hỏi sai xuống cuối để làm lại
      newQuestions.push({ ...q, hasFailed: true });
      setQuestions(newQuestions);
    }

    if (index === newQuestions.length - 1) {
      setGameState('result');
      const finalScore = score + (isCorrect && !q.hasFailed ? 1 : 0);
      if (finalScore === vocabList.length) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      addXP(finalScore * 10); // 10 XP per correct answer
    } else {
      setIndex(nextIndex);
      setFeedback(null);
      setSelected(null);
      setInput("");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (feedback) {
        nextQuestion();
      } else {
        const q = questions[index];
        if (q?.qType !== 'multiple-choice') {
           handleTypingAnswer();
        }
      }
    }
  };

  if (gameState === 'start') {
    return (
      <div className="text-center bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border border-slate-100 dark:border-slate-800 max-w-2xl mx-auto shadow-2xl shadow-brand-500/5 animate-scale-in">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-brand-50 dark:bg-brand-900/30 rounded-3xl mx-auto flex items-center justify-center mb-4 sm:mb-6">
          <BrainCircuit size={36} className="text-brand-500 animate-pulse-slow sm:w-12 sm:h-12" />
        </div>
        <h2 className="text-2xl sm:text-3xl font-black mb-2 text-slate-900 dark:text-white">Kiểm tra Tổng hợp</h2>
        <p className="text-slate-500 mb-6 font-medium text-sm sm:text-base">Chọn chế độ bạn muốn thử sức hôm nay:</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 text-left">
          {allModes.map(m => {
            const isSelected = selectedMode === m.id;
            let icon = <CheckCircle2 />;
            if (m.id.includes('typing')) icon = <Keyboard />;
            if (m.id.includes('listen')) icon = <Headphones />;
            if (m.id === 'multiple-choice') icon = <Layers />;

            return (
              <button key={m.id} onClick={() => setSelectedMode(m.id)}
                className={`p-3 sm:p-4 rounded-2xl border-2 flex items-center gap-3 sm:gap-4 font-medium transition-all group ${
                  isSelected 
                    ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 shadow-md transform -translate-y-1" 
                    : "border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 hover:-translate-y-1"
                }`}>
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isSelected ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:bg-brand-100 group-hover:text-brand-500'
                }`}>
                  {React.cloneElement(icon, { size: 18 })}
                </div>
                <div className="flex-1">
                  <span className={`block text-base sm:text-lg ${isSelected ? 'font-bold' : 'font-semibold'}`}>{m.label}</span>
                </div>
                <div className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-brand-500 bg-brand-500' : 'border-slate-300 dark:border-slate-600'}`}>
                   {isSelected && <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white" />}
                </div>
              </button>
            )
          })}
        </div>

        <button onClick={startQuiz} className="vip-btn w-full py-3 sm:py-4 text-lg sm:text-xl bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl hover:shadow-brand-500/40 shadow-xl mb-3 sm:mb-4 uppercase tracking-wider">
          Bắt đầu ngay
        </button>
        <button onClick={onBack} className="text-slate-400 font-semibold text-sm sm:text-base hover:text-slate-600 transition-colors">Quay lại</button>
      </div>
    );
  }

  if (gameState === 'result') {
    return (
      <div className="text-center bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 max-w-xl mx-auto shadow-2xl shadow-brand-500/10 animate-bounce-soft">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-2xl sm:text-3xl font-black mb-4 text-slate-900 dark:text-white">Hoàn thành xuất sắc!</h2>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6 mb-6 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-700">
          <div className="text-center">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm số</p>
            <p className="text-xl text-slate-600 dark:text-slate-300 font-medium">
              <span className="text-brand-500 font-black text-4xl mr-1">{score}</span> / {vocabList.length}
            </p>
          </div>
          {maxStreak >= 3 && (
            <div className="hidden sm:block w-px h-16 bg-slate-200 dark:bg-slate-700"></div>
          )}
          {maxStreak >= 3 && (
            <div className="text-center">
               <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Chuỗi dài nhất</p>
               <p className="text-4xl text-orange-500 font-black flex items-center justify-center gap-2" title="Chuỗi đúng liên tiếp dài nhất">
                <Flame size={32} className="fill-orange-500" /> {maxStreak}
              </p>
            </div>
          )}
        </div>

        {mistakes.length > 0 && (
          <div className="mb-8 text-left">
            <h3 className="font-black text-xl mb-4 text-slate-800 dark:text-white flex items-center gap-2">
              <XCircle className="text-red-500" size={24} /> Cần ôn tập lại ({mistakes.length})
            </h3>
            <div className="space-y-4 max-h-72 overflow-y-auto pr-2 scrollbar-thin">
              {mistakes.map((m, i) => (
                <div key={i} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border-2 border-red-100 dark:border-red-900/30 shadow-sm relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-2 bg-red-400"></div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3 pl-2">
                    <span className="font-black text-xl text-slate-900 dark:text-white">{m.word}</span>
                    <span className="text-sm font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-300 px-4 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      Đúng: {m.qType.includes('vi-en') || m.qType === 'listen-vi' ? m.word : m.meaning}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 dark:text-slate-400 pl-2 font-medium">
                    Bạn chọn: <span className="line-through text-red-500 font-bold ml-1">{m.userAnswer}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-6">
          <button onClick={onComplete || onBack} className="flex-1 py-4 bg-slate-100 dark:bg-slate-800 font-bold text-lg rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors border-2 border-transparent">Về trang chủ</button>
          <button onClick={startQuiz} className="vip-btn flex-1 py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-lg rounded-2xl shadow-xl shadow-brand-500/30 uppercase tracking-wide">Chơi lại ngay</button>
        </div>
      </div>
    );
  }

  const q = questions[index];
  
  let headerText = "";
  let displayWord = "";
  let isListenMode = false;
  
  if (q.qType === 'multiple-choice') {
    headerText = "Chọn nghĩa đúng";
    displayWord = q.word;
  } else if (q.qType === 'typing-en-vi') {
    headerText = "Dịch sang Tiếng Việt";
    displayWord = q.word;
  } else if (q.qType === 'typing-vi-en') {
    headerText = "Dịch sang Tiếng Anh";
    displayWord = q.meaning;
  } else if (q.qType === 'listen-en') {
    headerText = "Nghe Tiếng Anh & Gõ nghĩa Tiếng Việt";
    isListenMode = true;
  } else if (q.qType === 'listen-vi') {
    headerText = "Nghe Tiếng Việt & Gõ từ Tiếng Anh";
    isListenMode = true;
  }

  const progress = (index / questions.length) * 100;

  return (
    <div className="max-w-3xl mx-auto animate-fade-in pb-24">
      <div className="mb-4 flex justify-between items-center">
        <button onClick={onBack} className="text-slate-500 hover:text-brand-500 flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Thoát</button>
        <div className="flex items-center gap-4">
          {streak > 1 && (
            <span className="font-bold text-orange-500 flex items-center gap-1 animate-pulse" title="Chuỗi đúng liên tiếp">
              <Flame size={18} className="fill-orange-500" /> {streak}
            </span>
          )}
          <span className="font-bold text-slate-400">Câu {index + 1} / {questions.length}</span>
        </div>
      </div>
      
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-6 overflow-hidden shadow-inner">
        <div className="h-full bg-gradient-to-r from-brand-400 to-brand-600 rounded-full transition-all duration-500 ease-out" style={{width: `${progress}%`}}/>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 sm:p-8 text-center shadow-lg shadow-brand-500/5 mb-6 relative">
        <p className="text-xs sm:text-sm font-bold text-brand-500 uppercase tracking-widest mb-4">
          {headerText}
        </p>
        
        {isListenMode ? (
          <div className="flex justify-center items-center gap-3 mb-2">
            <button onClick={() => speakWord(q.qType === 'listen-en' ? q.word : q.meaning, q.qType === 'listen-en' ? 'en-US' : 'vi-VN')} className="w-16 h-16 rounded-full bg-brand-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-200 transition-colors shadow-md animate-pulse">
              <Headphones size={32} />
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center gap-3 mb-2">
            <h3 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">{displayWord}</h3>
            {(q.qType === 'multiple-choice' || q.qType === 'typing-en-vi') && (
              <button onClick={(e) => { e.stopPropagation(); speakWord(q.word); }} className="w-10 h-10 rounded-full bg-brand-50 dark:bg-slate-800 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-100 transition-colors shadow-sm" title="Nghe phát âm">
                <Volume2 size={20} />
              </button>
            )}
          </div>
        )}
      </div>

      {q.qType === 'multiple-choice' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {q.options.map((opt, i) => {
            let cls = "bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 hover:border-brand-400 hover:shadow-lg hover:-translate-y-1 shadow-sm";
            if (selected) {
              if (opt === q.meaning) cls = "bg-emerald-50 border-emerald-500 text-emerald-700 shadow-md transform -translate-y-1 scale-105 z-10 animate-bounce-soft";
              else if (opt === selected) cls = "bg-red-50 border-red-500 text-red-700 animate-shake";
              else cls = "opacity-40 scale-95";
            }
            return (
              <button key={i} onClick={() => handleMCQAnswer(opt)} disabled={!!selected} className={`p-3 sm:p-4 rounded-xl text-base sm:text-lg font-bold transition-all duration-300 text-left flex items-center ${cls}`}>
                <span className={`w-6 h-6 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-black flex items-center justify-center mr-3 flex-shrink-0 ${selected && opt === q.meaning ? 'bg-emerald-200 text-emerald-800' : ''}`}>{i+1}</span> 
                {opt}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="relative max-w-lg mx-auto">
          <input 
            ref={inputRef}
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)} 
            onKeyDown={handleKeyDown}
            disabled={!!feedback || isChecking}
            placeholder="Gõ đáp án vào đây..." 
            className={`w-full py-2 sm:py-3 text-center bg-transparent text-xl sm:text-2xl font-bold border-b-2 focus:outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 ${
              feedback 
                ? feedback.isCorrect ? "border-emerald-500 text-emerald-600" : "border-red-500 text-red-600"
                : "border-slate-200 dark:border-slate-700 focus:border-brand-500 text-slate-800 dark:text-white"
            }`}
          />
          {isChecking && <Loader2 className="absolute right-0 top-3 animate-spin text-brand-500" size={24} />}
        </div>
      )}

      {feedback && !feedback.isCorrect && (
        <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up-banner">
          <div className={`w-full ${feedback.isCorrect ? 'bg-emerald-100 dark:bg-emerald-900 border-t-2 border-emerald-200 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-900 border-t-2 border-red-200 dark:border-red-800'} p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]`}>
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 ${feedback.isCorrect ? 'bg-emerald-200 text-emerald-700 dark:bg-emerald-800 dark:text-emerald-300' : 'bg-red-200 text-red-700 dark:bg-red-800 dark:text-red-300'}`}>
                  {feedback.isCorrect ? <CheckCircle2 size={32} /> : <XCircle size={32} />}
                </div>
                <div>
                  <h3 className={`text-2xl font-black mb-1 ${feedback.isCorrect ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'}`}>
                    {feedback.isCorrect ? "Tuyệt vời!" : "Chưa đúng rồi"}
                  </h3>
                  {!feedback.isCorrect && q.qType !== 'multiple-choice' && (
                    <div className="text-red-900 dark:text-red-200 font-medium text-lg">
                      Đáp án đúng: <span className="font-black text-xl">{(q.qType === 'typing-vi-en' || q.qType === 'listen-vi') ? q.word : q.meaning}</span>
                    </div>
                  )}
                  <p className={`text-sm mt-1 font-medium ${feedback.isCorrect ? 'text-emerald-600/80 dark:text-emerald-400/80' : 'text-red-600/80 dark:text-red-400/80'}`}>{feedback.reason}</p>
                </div>
              </div>
              <button 
                onClick={() => nextQuestion()} 
                className={`py-4 px-8 rounded-2xl font-black text-xl w-full sm:w-auto shadow-lg hover:-translate-y-1 transition-all ${
                  feedback.isCorrect ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30' : 'bg-red-500 hover:bg-red-400 text-white shadow-red-500/30'
                }`}
              >
                Tiếp tục
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// AI CHAT ROLEPLAY VIEW
// ══════════════════════════════════════════════════════════════════
function ChatRoleplayView({ vocabList, onBack, addXP }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hi there! We are going to practice English. Try to use as many words from your vocabulary list as possible. Ready?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usedWords, setUsedWords] = useState(new Set());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Check for used vocabulary words
    let newUsedWords = new Set(usedWords);
    let matchedWordsCount = 0;
    const userTextLower = userMessage.toLowerCase();
    
    vocabList.forEach(v => {
      const wordLower = v.word.toLowerCase();
      if (!usedWords.has(wordLower) && userTextLower.includes(wordLower)) {
        newUsedWords.add(wordLower);
        matchedWordsCount++;
      }
    });

    if (matchedWordsCount > 0) {
      setUsedWords(newUsedWords);
      addXP(matchedWordsCount * 10);
      showToast(`+${matchedWordsCount * 10} XP (Sử dụng đúng ${matchedWordsCount} từ mới!)`, "success");
    }

    try {
      const res = await axios.post(`${API_BASE}/chat/roleplay`, {
        messages: newMessages,
        vocabList: vocabList,
        topicName: "Practice English Conversation"
      });
      if (res.data.success) {
        setMessages([...newMessages, { role: 'ai', text: res.data.text }]);
      }
    } catch (err) {
      showToast("Lỗi kết nối AI", "error");
      setMessages([...newMessages, { role: 'ai', text: "Sorry, I am having trouble connecting to my brain. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const progress = Math.round((usedWords.size / vocabList.length) * 100) || 0;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[80vh]">
      <div className="mb-4 flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <button onClick={onBack} className="text-slate-500 hover:text-brand-500 flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Thoát</button>
        <div className="flex flex-col items-end">
          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Mục tiêu: Dùng từ vựng ({usedWords.size}/{vocabList.length})</span>
          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{width: `${progress}%`}}/>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-4 flex flex-col">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
              {msg.text}
            </div>
            {msg.role === 'ai' && (
              <button onClick={() => speakWord(msg.text)} className="ml-2 mt-auto p-2 text-slate-400 hover:text-brand-500 self-end">
                <Volume2 size={16} />
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[75%] p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="text-xs font-bold text-slate-500 py-1 pl-1">Từ cần dùng:</span>
          {vocabList.map((v, i) => {
            const isUsed = usedWords.has(v.word.toLowerCase());
            return (
              <span key={i} className={`text-xs px-2 py-1 rounded-md border font-medium ${isUsed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {v.word}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Gõ tin nhắn tiếng Anh của bạn..."
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-all">
            <MessageSquare size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD VIEW
// ══════════════════════════════════════════════════════════════════
function AdminDashboardView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  const fetchUsers = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users?page=${pageNumber}&limit=10`);
      if (res.data.success) {
        setUsers(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalUsers(res.data.pagination?.total || res.data.data.length);
      }
    } catch (e) {
      showToast("Lỗi tải danh sách người dùng", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id, email) => {
    if (!confirm(`Bạn có chắc muốn xóa người dùng ${email}? Mọi dữ liệu của họ sẽ bị mất.`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/admin/users/${id}`);
      if (res.data.success) {
        showToast("Đã xóa người dùng", "success");
        setUsers(users.filter(u => u.user_id !== id));
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Lỗi xóa người dùng", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-2xl mx-auto mt-10">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3 mx-auto"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
        <div className="flex justify-center gap-4">
           <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
           <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quản Trị Hệ Thống</h2>
        <p className="text-slate-500 mt-1">Tổng cộng: {users.length} người dùng</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Email</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Quyền</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">XP</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Ngày Chuỗi</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">{u.email}</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-amber-500 font-bold">{u.xp || 0}</td>
                  <td className="py-3.5 px-5 text-orange-500 font-bold">{u.streak_days || 0}</td>
                  <td className="py-3.5 px-5 text-right">
                    {u.role !== 'admin' && (
                      <button onClick={() => handleDeleteUser(u.user_id, u.email)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// AUDIO TRANSCRIPTION VIEW
// ══════════════════════════════════════════════════════════════════
function AudioTranscriptionView() {
  const [file, setFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [result, setResult] = useState("");
  const [translation, setTranslation] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      if (selected.size > 10 * 1024 * 1024) {
        showToast("File quá lớn (tối đa 10MB)", "error");
        return;
      }
      setFile(selected);
      setResult("");
      setTranslation("");
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setAudioUrl(URL.createObjectURL(selected));
    }
  };

  const handleTranslate = async () => {
    if (!result) return;
    setIsTranslating(true);
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(result)}`;
      const { data } = await axios.get(url);
      const translatedText = data[0].map(x => x[0]).join('');
      setTranslation(translatedText);
    } catch (e) {
      showToast("Lỗi khi dịch văn bản", "error");
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setIsTranscribing(true);
    setResult("");
    setTranslation("");

    const formData = new FormData();
    formData.append("audio", file);

    try {
      const res = await axios.post(`${API_BASE}/transcribe`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setResult(res.data.text);
        showToast("Trích xuất thành công!", "success");
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Lỗi trích xuất âm thanh", "error");
    } finally {
      setIsTranscribing(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-20 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Trích xuất Văn bản (Luyện Nghe)</h2>
        <p className="text-slate-500 mt-1">Tải lên file âm thanh để lấy Transcript, sau đó có thể dịch bằng 1 click.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center cursor-pointer hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-all mb-6"
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange} 
            accept="audio/*" 
            className="hidden" 
          />
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center mb-4">
            <Headphones size={32} />
          </div>
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            {file ? file.name : "Nhấp vào đây để chọn file âm thanh"}
          </p>
          <p className="text-xs text-slate-400 mt-2">Hỗ trợ: mp3, wav, m4a, ogg (Tối đa 10MB)</p>
        </div>

        {audioUrl && (
          <div className="mb-6">
            <audio controls src={audioUrl} className="w-full h-12 rounded-xl outline-none" />
          </div>
        )}

        <button 
          onClick={handleTranscribe} 
          disabled={!file || isTranscribing}
          className="vip-btn w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-lg shadow-brand-500/20"
        >
          {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
          {isTranscribing ? "AI đang phân tích âm thanh..." : "Trích xuất Văn bản"}
        </button>

        {result && (
          <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-800 animate-slide-up">
            <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Transcript (Tiếng Anh):</h3>
            <div 
              className="bg-slate-50 dark:bg-slate-800 rounded-2xl p-6 text-slate-700 dark:text-slate-300 font-medium leading-relaxed mb-4 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
            />
            
            {!translation ? (
              <button 
                onClick={handleTranslate} 
                disabled={isTranslating}
                className="vip-btn w-full py-3 border-2 border-brand-500 text-brand-600 font-bold rounded-2xl hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isTranslating ? <Loader2 size={18} className="animate-spin" /> : <BookOpen size={18} />}
                Dịch sang Tiếng Việt
              </button>
            ) : (
              <div className="mt-6 animate-fade-in">
                <h3 className="font-bold text-lg mb-4 text-slate-900 dark:text-white">Bản Dịch:</h3>
                <div className="bg-brand-50 dark:bg-brand-900/10 rounded-2xl p-6 text-slate-700 dark:text-slate-300 font-medium leading-relaxed whitespace-pre-wrap">
                  {translation}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
