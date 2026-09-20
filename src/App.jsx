import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen, Layers, GraduationCap, Upload, ChevronLeft, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, Sparkles, Loader2, Volume2,
  Lightbulb, Trash2, FolderOpen, ArrowLeft, Database, Sun, Moon,
  FileSpreadsheet, LayoutDashboard, BookMarked, BrainCircuit, Zap,
  ChevronDown, ChevronUp, FileText, LogOut, User, Flame, CalendarClock, MessageSquare, Users, Headphones, Trophy, Keyboard
} from "lucide-react";
import confetti from "canvas-confetti";
import localforage from "localforage";
import axios, { API_BASE } from "./utils/api.js";
import { playSound, speakWord } from "./utils/audio.js";
import { showToast, ToastContainer } from "./utils/toast.jsx";
import useDarkMode from "./hooks/useDarkMode.js";
import AuthScreen from "./views/AuthScreen.jsx";
import SheetSelectModal from "./components/SheetSelectModal.jsx";
import VocabListView from "./views/VocabListView.jsx";
import FlashcardQuizWrapper from "./views/FlashcardQuizWrapper.jsx";
import AdminDashboardView from "./views/AdminDashboardView.jsx";
import AudioTranscriptionView from "./views/AudioTranscriptionView.jsx";
import DashboardView from "./views/DashboardView.jsx";
import LeaderboardView from "./views/LeaderboardView.jsx";

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