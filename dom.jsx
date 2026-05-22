import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  BookOpen, Layers, GraduationCap, Upload, ChevronLeft, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, Sparkles, Loader2, Volume2,
  Lightbulb, Trash2, FolderOpen, ArrowLeft, Database, Sun, Moon,
  FileSpreadsheet, LayoutDashboard, BookMarked, BrainCircuit, Zap,
  ChevronDown, ChevronUp, FileText,
} from "lucide-react";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

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

// ── Gemini helper ───────────────────────────────────────────────────
async function callGeminiAPI(prompt) {
  try {
    const res = await axios.post(`${API_BASE}/gemini`, { prompt });
    return res.data.result;
  } catch { return null; }
}

// ══════════════════════════════════════════════════════════════════
// APP ROOT
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [topics, setTopics] = useState([]);
  const [selectedTopic, setSelectedTopic] = useState(null);
  const [vocabList, setVocabList] = useState([]);
  const [isLoadingTopics, setIsLoadingTopics] = useState(true);
  const [isLoadingVocab, setIsLoadingVocab] = useState(false);
  const [activeTab, setActiveTab] = useState("list");
  const [isXlsxLoaded, setIsXlsxLoaded] = useState(false);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [selectedSheets, setSelectedSheets] = useState([]);
  const [isQuizOngoing, setIsQuizOngoing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dark, setDark] = useDarkMode();

  // ── Fetch topics ──────────────────────────────────────────────
  const fetchTopics = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/topics`);
      setTopics(res.data.data || []);
    } catch (err) {
      console.error("Lỗi khi tải danh sách chủ điểm:", err);
    } finally {
      setIsLoadingTopics(false);
    }
  }, []);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

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
      console.error("Lỗi khi tải từ vựng:", err);
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
      alert("Thư viện đọc Excel đang được tải, vui lòng thử lại sau vài giây.");
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
    setSelectedSheets(prev =>
      prev.includes(wsname) ? prev.filter(s => s !== wsname) : [...prev, wsname]
    );
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
      alert("Không tìm thấy dữ liệu hợp lệ trong các sheet đã chọn.");
      return;
    }
    setIsSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/topics/import`, apiPayload);
      await fetchTopics();
      setPendingWorkbook(null);
      setSelectedSheets([]);
      alert(`✅ ${response.data.message}`);
    } catch (err) {
      alert("❌ Import thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTopic = useCallback(async (topicId, topicName) => {
    if (!window.confirm(`Xóa buổi "${topicName}" và toàn bộ từ vựng?`)) return;
    try {
      await axios.delete(`${API_BASE}/topics/${topicId}`);
      if (selectedTopic?.topic_id === topicId) { setSelectedTopic(null); setVocabList([]); }
      await fetchTopics();
    } catch { alert("Lỗi khi xóa chủ điểm."); }
  }, [selectedTopic, fetchTopics]);

  const handleDeleteVocab = useCallback(async (vocabId, word) => {
    if (!window.confirm(`Xóa từ vựng "${word}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/vocabularies/${vocabId}`);
      setVocabList(prev => prev.filter(v => v.vocabulary_id !== vocabId));
      await fetchTopics();
    } catch { alert("Lỗi khi xóa từ vựng."); }
  }, [fetchTopics]);

  // Stats
  const totalVocab = useMemo(() => topics.reduce((s, t) => s + Number(t.vocab_count || 0), 0), [topics]);

  // ── Loading screen ────────────────────────────────────────────
  if (isLoadingTopics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-brand-500/30 animate-float">
            <GraduationCap size={40} className="text-white" />
          </div>
          <Loader2 size={24} className="animate-spin text-brand-500 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">Đang kết nối Database...</p>
        </div>
      </div>
    );
  }

  // ── NAV items ─────────────────────────────────────────────────
  const navItems = [
    { id: "list",      icon: BookOpen,      label: "Từ vựng" },
    { id: "flashcard", icon: Layers,         label: "Flashcards" },
    { id: "quiz",      icon: BrainCircuit,   label: "Kiểm tra" },
  ];

  return (
    <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 sticky top-0 h-screen shadow-sm transition-colors duration-300">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg shadow-brand-500/30">
            <GraduationCap size={22} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">EngMaster</h1>
            <p className="text-xs text-slate-400 dark:text-slate-500">Học từ vựng thông minh</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-5 space-y-1">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`nav-item w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all ${
                activeTab === id
                  ? "nav-active text-white"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Icon size={18} />
              <span>{label}</span>
              {activeTab === id && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />
              )}
            </button>
          ))}
        </nav>

        {/* Stats */}
        <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
          <div className="rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 p-4 text-white shadow-lg shadow-brand-500/20">
            <p className="text-xs font-semibold opacity-80 uppercase tracking-wider mb-2">Thống kê</p>
            <div className="flex justify-between">
              <div className="text-center">
                <p className="text-2xl font-bold">{topics.length}</p>
                <p className="text-xs opacity-70">Bộ đề</p>
              </div>
              <div className="w-px bg-white/20" />
              <div className="text-center">
                <p className="text-2xl font-bold">{totalVocab}</p>
                <p className="text-xs opacity-70">Từ vựng</p>
              </div>
            </div>
          </div>
        </div>

        {/* Dark Mode Toggle */}
        <div className="px-4 pb-6">
          <button
            onClick={() => setDark(d => !d)}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all group"
          >
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
        <button onClick={() => setDark(d => !d)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {dark ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-slate-600" />}
        </button>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 md:px-8 py-6 md:py-8 mt-14 md:mt-0 max-w-5xl w-full mx-auto">

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
              <FlashcardQuizWrapper topics={topics} mode="flashcard" />
            </div>
          )}
          {activeTab === "quiz" && (
            <div className="animate-slide-up">
              <FlashcardQuizWrapper topics={topics} mode="quiz" setIsQuizOngoing={setIsQuizOngoing} />
            </div>
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/90 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 flex transition-colors duration-300">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-all ${
                activeTab === id ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"
              }`}
            >
              <Icon size={20} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* ── SHEET SELECTION MODAL ─────────────────────────────── */}
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
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Chọn trang tính</h3>
              <p className="text-brand-200 text-sm truncate max-w-[200px]">{pendingWorkbook.file.name}</p>
            </div>
            <div className="ml-auto text-sm bg-white/20 px-3 py-1 rounded-full font-medium">
              {selectedSheets.length}/{pendingWorkbook.wb.SheetNames.length}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setSelectedSheets([...pendingWorkbook.wb.SheetNames])} className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 font-medium transition-colors">
            Chọn tất cả
          </button>
          <button onClick={() => setSelectedSheets([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium transition-colors">
            Bỏ chọn
          </button>
        </div>

        {/* Sheet list */}
        <div className="max-h-60 overflow-y-auto px-6 py-4 space-y-2">
          {pendingWorkbook.wb.SheetNames.map((wsname) => {
            const isSelected = selectedSheets.includes(wsname);
            return (
              <button
                key={wsname}
                onClick={() => toggleSheetSelection(wsname)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 flex items-center gap-3 transition-all duration-200 ${
                  isSelected
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-400 dark:border-brand-600 text-brand-800 dark:text-brand-300 shadow-sm"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
                }`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  isSelected ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"
                }`}>
                  {isSelected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="font-medium flex-1 truncate">{wsname}</span>
                <FileText size={16} className={isSelected ? "text-brand-400" : "text-slate-300 dark:text-slate-600"} />
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            Hủy bỏ
          </button>
          <button
            onClick={handleImportSelectedSheets}
            disabled={selectedSheets.length === 0 || isSaving}
            className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSaving ? <><Loader2 size={18} className="animate-spin" /> Đang lưu...</> : `Nhập ${selectedSheets.length} sheet`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// VOCAB LIST VIEW (Tab 1)
// ══════════════════════════════════════════════════════════════════
function VocabListView({ topics, selectedTopic, vocabList, isLoadingVocab, selectTopic, backToTopics, handleFileUpload, processFile, handleDeleteTopic, handleDeleteVocab, totalVocab }) {

  // ── Drag-and-drop ──────────────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  // ── Topic Detail View ─────────────────────────────────────
  if (selectedTopic) {
    return (
      <div className="animate-slide-up">
        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={backToTopics}
            className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group"
          >
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
            Danh sách
          </button>
          <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{selectedTopic.topic_name}</span>
        </div>

        {/* Topic header */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-4">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 flex items-center justify-between">
            <div className="text-white">
              <h2 className="text-xl font-bold">{selectedTopic.topic_name}</h2>
              <p className="text-brand-200 text-sm mt-0.5">{vocabList.length} từ vựng • {selectedTopic.session_name}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center text-white font-bold text-xl">
              {vocabList.length}
            </div>
          </div>

          {isLoadingVocab ? (
            <div className="py-20 text-center">
              <Loader2 size={36} className="animate-spin text-brand-500 mx-auto mb-3" />
              <p className="text-slate-400 dark:text-slate-500">Đang tải từ vựng...</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-12 text-center">#</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tiếng Anh</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Phát âm IPA</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider">Tiếng Việt</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase tracking-wider w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {vocabList.map((item, index) => (
                    <tr
                      key={item.vocabulary_id}
                      className={`border-b border-slate-100 dark:border-slate-800 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 transition-colors group ${
                        index % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-slate-800/20"
                      }`}
                    >
                      <td className="py-3.5 px-5 text-center text-slate-400 dark:text-slate-600 text-sm">{index + 1}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100">{item.word}</td>
                      <td className="py-3.5 px-5 text-brand-500 dark:text-brand-400 font-mono text-sm">{item.ipa}</td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">{item.meaning}</td>
                      <td className="py-3.5 px-5">
                        <button
                          onClick={() => handleDeleteVocab(item.vocabulary_id, item.word)}
                          className="p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                          title="Xóa từ vựng này"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {vocabList.length === 0 && (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400 dark:text-slate-600">
                        Không có từ vựng trong chủ điểm này.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Topic List View ───────────────────────────────────────
  const groupedTopics = topics.reduce((acc, topic) => {
    const groupName = topic.session_name || "Chủ điểm hệ thống";
    if (!acc[groupName]) acc[groupName] = [];
    acc[groupName].push(topic);
    return acc;
  }, {});

  return (
    <div>
      {/* Page header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kho Từ Vựng</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
          {topics.length} bộ đề • {totalVocab} từ vựng
        </p>
      </div>

      {/* Drag & Drop Upload Zone */}
      <div
        ref={dropRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative mb-8 border-2 border-dashed rounded-3xl p-8 text-center transition-all duration-300 cursor-pointer ${
          isDragging
            ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 scale-[1.01]"
            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50/30 dark:hover:bg-brand-900/10"
        }`}
      >
        <label className="absolute inset-0 cursor-pointer rounded-3xl" htmlFor="excel-upload" />
        <input id="excel-upload" type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
        <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${
          isDragging ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30 scale-110" : "bg-brand-50 dark:bg-brand-900/20 text-brand-500"
        }`}>
          <Upload size={28} />
        </div>
        <p className="font-semibold text-slate-700 dark:text-slate-300 mb-1">
          {isDragging ? "Thả file vào đây!" : "Kéo thả file Excel vào đây"}
        </p>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Hoặc <span className="text-brand-600 dark:text-brand-400 font-medium underline">nhấn để chọn file</span> · Hỗ trợ .xlsx, .xls, .csv
        </p>
      </div>

      {/* Topic groups */}
      {topics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-5">
            <FolderOpen size={36} className="text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">Chưa có dữ liệu</p>
          <p className="text-sm text-slate-400 dark:text-slate-500">Hãy tải lên file Excel để bắt đầu học.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedTopics).map(([groupName, groupTopics]) => (
            <FileGroup
              key={groupName}
              groupName={groupName}
              groupTopics={groupTopics}
              selectTopic={selectTopic}
              handleDeleteTopic={handleDeleteTopic}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── File Group Component ───────────────────────────────────────────
function FileGroup({ groupName, groupTopics, selectTopic, handleDeleteTopic }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalWords = groupTopics.reduce((s, t) => s + Number(t.vocab_count || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      {/* Group header */}
      <div
        className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-b border-slate-100 dark:border-slate-800"
        onClick={() => setCollapsed(c => !c)}
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-500/20 flex-shrink-0">
            <FileSpreadsheet size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm leading-tight">{groupName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{groupTopics.length} sheet • {totalWords} từ</p>
          </div>
        </div>
        <button className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          {collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>
      </div>

      {/* Topic cards */}
      {!collapsed && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupTopics.map(topic => (
            <div
              key={topic.topic_id}
              className="topic-card relative group bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer"
            >
              <div
                onClick={() => selectTopic(topic)}
                className="p-4 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-500/20 flex-shrink-0">
                  {topic.vocab_count}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{topic.topic_name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                    {topic.vocab_count} từ vựng • {new Date(topic.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 flex-shrink-0 group-hover:text-brand-500 group-hover:translate-x-1 transition-all" />
              </div>
              {/* Delete button */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.topic_id, topic.topic_name); }}
                className="absolute top-2 right-10 p-1.5 text-slate-300 dark:text-slate-700 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                title="Xóa bộ đề này"
              >
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
// FLASHCARD / QUIZ WRAPPER (Tab 2 & 3)
// ══════════════════════════════════════════════════════════════════
function FlashcardQuizWrapper({ topics, mode, setIsQuizOngoing }) {
  const [selectedTopicIds, setSelectedTopicIds] = useState([]);
  const [loadedVocab, setLoadedVocab] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const toggleTopic = (id) => {
    setSelectedTopicIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const totalWords = useMemo(() =>
    topics.filter(t => selectedTopicIds.includes(t.topic_id))
      .reduce((sum, t) => sum + Number(t.vocab_count || 0), 0),
  [selectedTopicIds, topics]);

  const handleStart = async () => {
    if (selectedTopicIds.length === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        selectedTopicIds.map(id => axios.get(`${API_BASE}/topics/${id}/vocabularies`))
      );
      setLoadedVocab(results.flatMap(res => res.data.data || []));
      setIsReady(true);
    } catch (err) {
      alert("Lỗi khi tải từ vựng: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isReady && loadedVocab.length > 0) {
    if (mode === "flashcard") return <FlashcardView vocabList={loadedVocab} onBack={() => setIsReady(false)} />;
    if (mode === "quiz") return <QuizView vocabList={loadedVocab} setIsQuizOngoing={setIsQuizOngoing} onBack={() => setIsReady(false)} />;
  }

  const groupedTopics = topics.reduce((acc, topic) => {
    const g = topic.session_name || "Hệ thống";
    if (!acc[g]) acc[g] = [];
    acc[g].push(topic);
    return acc;
  }, {});

  const modeIcon = mode === "flashcard" ? Layers : BrainCircuit;
  const ModeIcon = modeIcon;
  const modeLabel = mode === "flashcard" ? "Flashcards" : "Kiểm tra trắc nghiệm";
  const modeColor = mode === "flashcard" ? "from-violet-500 to-purple-600" : "from-brand-600 to-brand-500";

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className={`bg-gradient-to-r ${modeColor} rounded-3xl p-8 text-white text-center mb-6 shadow-xl relative overflow-hidden`}>
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
            <ModeIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold mb-1">{modeLabel}</h2>
          <p className="text-white/70 text-sm">
            Chọn bộ từ vựng bạn muốn {mode === "flashcard" ? "ôn tập" : "kiểm tra"} bên dưới
          </p>
        </div>
      </div>

      {topics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 py-16 text-center">
          <p className="text-slate-400 dark:text-slate-500">Chưa có dữ liệu. Hãy tải file Excel ở tab Từ vựng.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          {/* Quick select */}
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400 mr-2">Chọn nhanh:</span>
            <button onClick={() => setSelectedTopicIds(topics.map(t => t.topic_id))}
              className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 font-medium transition-colors">
              Tất cả
            </button>
            <button onClick={() => setSelectedTopicIds([])}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors">
              Bỏ chọn
            </button>
          </div>

          {/* Topic selection grouped */}
          <div className="px-4 py-4 space-y-4 max-h-72 overflow-y-auto">
            {Object.entries(groupedTopics).map(([groupName, groupTopics]) => (
              <div key={groupName}>
                <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-wider px-2 mb-2 flex items-center gap-2">
                  <FileSpreadsheet size={12} /> {groupName}
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupTopics.map(topic => {
                    const isSelected = selectedTopicIds.includes(topic.topic_id);
                    return (
                      <button
                        key={topic.topic_id}
                        onClick={() => toggleTopic(topic.topic_id)}
                        className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                          isSelected
                            ? "bg-brand-50 dark:bg-brand-900/20 border-brand-400 dark:border-brand-600 text-brand-700 dark:text-brand-300 shadow-sm"
                            : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                          isSelected ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"
                        }`}>
                          {isSelected && <CheckCircle2 size={10} className="text-white" strokeWidth={3} />}
                        </div>
                        <span className="truncate max-w-[120px]">{topic.topic_name}</span>
                        <span className={`text-xs ${isSelected ? "text-brand-400" : "text-slate-400"}`}>({topic.vocab_count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Start button */}
          <div className="px-6 pb-6 pt-2">
            {selectedTopicIds.length > 0 && (
              <p className="text-sm text-center text-brand-600 dark:text-brand-400 font-medium mb-4">
                Đã chọn {selectedTopicIds.length} bộ đề • <span className="font-bold">{totalWords} từ vựng</span>
              </p>
            )}
            <button
              onClick={handleStart}
              disabled={selectedTopicIds.length === 0 || isLoading}
              className={`w-full py-3.5 font-semibold rounded-2xl transition-all text-white shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 bg-gradient-to-r ${modeColor} hover:shadow-xl hover:scale-[1.01]`}
            >
              {isLoading ? <><Loader2 size={18} className="animate-spin" /> Đang tải...</> : `Bắt đầu ${totalWords > 0 ? `(${totalWords} từ)` : ""}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// FLASHCARD VIEW
// ══════════════════════════════════════════════════════════════════
function FlashcardView({ vocabList, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [example, setExample] = useState(null);
  const [mnemonic, setMnemonic] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMnemonicLoading, setIsMnemonicLoading] = useState(false);

  useEffect(() => { setIsFlipped(false); setExample(null); setMnemonic(null); }, [currentIndex]);

  const handleNext = () => setCurrentIndex(prev => (prev + 1) % vocabList.length);
  const handlePrev = () => setCurrentIndex(prev => (prev - 1 + vocabList.length) % vocabList.length);
  const currentWord = vocabList[currentIndex];

  const playAudio = (text, e) => {
    if (e) e.stopPropagation();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US"; utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateExample = async () => {
    setIsAiLoading(true);
    try {
      const prompt = `Viết một câu ví dụ tiếng Anh ngắn, tự nhiên với từ "${currentWord.word}" (nghĩa: ${currentWord.meaning}). Dịch sang tiếng Việt. Trả về JSON: {"english": "...", "vietnamese": "..."}`;
      const result = await callGeminiAPI(prompt);
      if (result) setExample(result);
    } catch { } finally { setIsAiLoading(false); }
  };

  const generateMnemonic = async () => {
    setIsMnemonicLoading(true);
    try {
      const prompt = `Tạo mẹo nhớ từ vựng vui nhộn cho từ "${currentWord.word}" (phát âm: ${currentWord.ipa}, nghĩa: ${currentWord.meaning}). Trả về JSON: {"mnemonic": "..."}`;
      const result = await callGeminiAPI(prompt);
      if (result) setMnemonic(result.mnemonic);
    } catch { } finally { setIsMnemonicLoading(false); }
  };

  if (!currentWord) return null;

  const progress = ((currentIndex + 1) / vocabList.length) * 100;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 transition-colors group">
          <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Chọn lại
        </button>
        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {currentIndex + 1} <span className="text-slate-300 dark:text-slate-600">/</span> {vocabList.length}
        </span>
        <button onClick={() => setIsFlipped(!isFlipped)} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors">
          <RotateCcw size={15} /> Lật thẻ
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-6 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Flip card */}
      <div className="flip-card w-full aspect-video cursor-pointer mb-6" onClick={() => setIsFlipped(!isFlipped)}>
        <div className={`flip-inner w-full h-full ${isFlipped ? "flipped" : ""}`}>
          {/* Front */}
          <div className="flip-front bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center p-8 text-center shadow-xl shadow-slate-200/50 dark:shadow-black/30">
            <p className="text-xs font-bold text-brand-400 uppercase tracking-[3px] mb-6">TIẾNG ANH</p>
            <h2 className="text-5xl sm:text-7xl font-bold text-slate-900 dark:text-white mb-4">{currentWord.word}</h2>
            {currentWord.ipa && (
              <p className="text-lg text-brand-500 dark:text-brand-400 font-mono bg-brand-50 dark:bg-brand-900/30 px-4 py-1.5 rounded-full">{currentWord.ipa}</p>
            )}
            <button
              onClick={(e) => playAudio(currentWord.word, e)}
              className="mt-4 p-3 text-brand-500 hover:text-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-full transition-colors"
            >
              <Volume2 size={24} />
            </button>
            <p className="absolute bottom-5 text-xs text-slate-300 dark:text-slate-600">Chạm để xem nghĩa</p>
          </div>

          {/* Back */}
          <div className="flip-back bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center text-white shadow-xl shadow-brand-500/30">
            <p className="text-xs font-bold text-brand-300 uppercase tracking-[3px] mb-6">TIẾNG VIỆT</p>
            <h2 className="text-3xl sm:text-5xl font-bold mb-6 leading-tight">{currentWord.meaning}</h2>
            <div className="flex items-center gap-3 opacity-80">
              <p className="text-lg">{currentWord.word}</p>
              <button onClick={(e) => playAudio(currentWord.word, e)} className="p-1.5 text-brand-200 hover:text-white hover:bg-white/10 rounded-full transition-colors">
                <Volume2 size={18} />
              </button>
            </div>
            {currentWord.ipa && <p className="font-mono text-sm text-brand-300 mt-1">{currentWord.ipa}</p>}
            <p className="absolute bottom-5 text-xs text-brand-400">Chạm để quay lại</p>
          </div>
        </div>
      </div>

      {/* AI Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        {!mnemonic && (
          <button onClick={generateMnemonic} disabled={isMnemonicLoading}
            className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 font-medium text-sm transition-all hover:shadow-md disabled:opacity-70">
            {isMnemonicLoading ? <Loader2 size={18} className="animate-spin" /> : <Lightbulb size={18} />}
            ✨ Mẹo nhớ từ (AI)
          </button>
        )}
        {!example && (
          <button onClick={generateExample} disabled={isAiLoading}
            className="flex items-center justify-center gap-2 py-3.5 px-5 rounded-2xl bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 border border-brand-100 dark:border-brand-900/40 hover:bg-brand-100 dark:hover:bg-brand-900/30 font-medium text-sm transition-all hover:shadow-md disabled:opacity-70">
            {isAiLoading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
            ✨ Câu ví dụ (AI)
          </button>
        )}
      </div>

      {/* AI results */}
      <div className="space-y-3 mb-6">
        {mnemonic && (
          <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 animate-slide-up">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-sm mb-2">
              <Lightbulb size={16} /> Mẹo nhớ từ:
            </div>
            <p className="text-slate-800 dark:text-slate-200 font-medium">{mnemonic}</p>
          </div>
        )}
        {example && (
          <div className="p-5 rounded-2xl bg-brand-50 dark:bg-brand-900/10 border border-brand-100 dark:border-brand-900/30 animate-slide-up">
            <div className="flex items-center gap-2 text-brand-700 dark:text-brand-400 font-semibold text-sm mb-2">
              <Sparkles size={16} /> Câu ví dụ:
            </div>
            <p className="text-slate-900 dark:text-slate-100 font-semibold mb-1">{example.english}</p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">{example.vietnamese}</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-center gap-6">
        <button onClick={handlePrev} className="w-14 h-14 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-600 dark:hover:text-brand-400 transition-all hover:shadow-lg flex items-center justify-center">
          <ChevronLeft size={22} />
        </button>
        <div className="flex gap-1.5">
          {vocabList.slice(Math.max(0, currentIndex - 2), Math.min(vocabList.length, currentIndex + 3)).map((_, i) => {
            const actualIdx = Math.max(0, currentIndex - 2) + i;
            return (
              <div key={actualIdx} className={`rounded-full transition-all ${actualIdx === currentIndex ? "w-6 h-2 bg-brand-500" : "w-2 h-2 bg-slate-200 dark:bg-slate-700"}`} />
            );
          })}
        </div>
        <button onClick={handleNext} className="w-14 h-14 rounded-full bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-600 dark:hover:text-brand-400 transition-all hover:shadow-lg flex items-center justify-center">
          <ChevronRight size={22} />
        </button>
      </div>
    </div>
  );
}

// ── Approximate match helper ──────────────────────────────────────
function isApproximateMatch(typed, correct) {
  if (!typed || !correct) return false;
  const removeAccents = (str) => str.toLowerCase()
    .replace(/[àáạảãâăằắặẳẵâầấậẩẫ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const t = removeAccents(typed), c = removeAccents(correct);
  if (t === c) return true;
  const parts = correct.split(/[,;|/]/).map(removeAccents);
  if (parts.includes(t)) return true;
  if (c.includes(t) && t.length >= c.length * 0.5 && t.length >= 3) return true;
  return false;
}

// ══════════════════════════════════════════════════════════════════
// QUIZ VIEW
// ══════════════════════════════════════════════════════════════════
function QuizView({ vocabList, setIsQuizOngoing, onBack }) {
  const [gameState, setGameState] = useState("start");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [wordsPerQuiz, setWordsPerQuiz] = useState(50);
  const [quizType, setQuizType] = useState("multiple_choice");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [wrongQuestionsQueue, setWrongQuestionsQueue] = useState([]);
  const [mistakeRounds, setMistakeRounds] = useState(0);
  const [isSubmittingAnswer, setIsSubmittingAnswer] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (setIsQuizOngoing) setIsQuizOngoing(["playing", "reviewing_wrong"].includes(gameState));
    return () => { if (setIsQuizOngoing) setIsQuizOngoing(false); };
  }, [gameState, setIsQuizOngoing]);

  React.useEffect(() => {
    if (gameState === "playing" && !isAnswerChecked && inputRef.current)
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
    if (gameState === "playing" && !isAnswerChecked && quizType.startsWith("listening")) {
      const currentQ = questions[currentQuestionIndex];
      setTimeout(() => {
        if (currentQ && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(currentQ.wordObject.word);
          u.lang = "en-US"; u.rate = 0.85;
          window.speechSynthesis.speak(u);
        }
      }, 300);
    }
  }, [currentQuestionIndex, isAnswerChecked, gameState, quizType, questions]);

  const startQuiz = (isNext = false) => {
    if (vocabList.length < 4) { alert("Cần ít nhất 4 từ vựng để tạo bài kiểm tra!"); return; }
    let nextChunk = chunkIndex;
    if (isNext === true) {
      nextChunk++;
      if (nextChunk * wordsPerQuiz >= vocabList.length) nextChunk = 0;
      setChunkIndex(nextChunk);
    }
    const startIndex = nextChunk * wordsPerQuiz;
    const chunkWords = vocabList.slice(startIndex, Math.min(startIndex + wordsPerQuiz, vocabList.length));
    const quizWords = [...chunkWords].sort(() => 0.5 - Math.random());
    const generatedQuestions = quizWords.map(word => {
      let promptText = word.word, promptSub = word.ipa, correctAnswerText = word.meaning, options = [];
      if (quizType === "typing_vi_to_en") { promptText = word.meaning; promptSub = ""; correctAnswerText = word.word; }
      else if (quizType === "multiple_choice") {
        const wrong = vocabList.filter(w => w.vocabulary_id !== word.vocabulary_id).sort(() => 0.5 - Math.random()).slice(0, 3).map(w => w.meaning);
        options = [...wrong, word.meaning].sort(() => 0.5 - Math.random());
      } else if (quizType.startsWith("listening")) { promptSub = ""; if (quizType === "listening_en_to_en") correctAnswerText = word.word; }
      return { wordObject: word, promptText, promptSub, correctAnswerText, options, type: quizType, correctAnswer: word.meaning };
    });
    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0); setScore(0); setGameState("playing");
    setSelectedAnswer(null); setTypedAnswer(""); setIsAnswerChecked(false);
    setWrongQuestionsQueue([]); setMistakeRounds(0); setCheckResult(null);
  };

  const proceedToNext = (wasCorrect) => {
    const isLast = currentQuestionIndex === questions.length - 1;
    const nextWrong = wasCorrect ? wrongQuestionsQueue : [...wrongQuestionsQueue, questions[currentQuestionIndex]];
    if (isLast) {
      if (nextWrong.length > 0) { setWrongQuestionsQueue(nextWrong); setGameState("reviewing_wrong"); }
      else setGameState("result");
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTypedAnswer(""); setSelectedAnswer(null); setIsAnswerChecked(false); setCheckResult(null);
      if (!wasCorrect) setWrongQuestionsQueue(nextWrong);
    }
  };

  const startMistakeReview = () => {
    setQuestions([...wrongQuestionsQueue].sort(() => 0.5 - Math.random()));
    setCurrentQuestionIndex(0); setWrongQuestionsQueue([]); setMistakeRounds(p => p + 1);
    setGameState("playing"); setTypedAnswer(""); setSelectedAnswer(null); setIsAnswerChecked(false); setCheckResult(null);
  };

  const handleAnswerClick = (option) => {
    if (isAnswerChecked) return;
    setSelectedAnswer(option); setIsAnswerChecked(true);
    const isCorrect = option === questions[currentQuestionIndex].correctAnswerText || option === questions[currentQuestionIndex].correctAnswer;
    if (isCorrect && mistakeRounds === 0) setScore(p => p + 1);
    setTimeout(() => proceedToNext(isCorrect), 1500);
  };

  const handleTypeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (isAnswerChecked || !typedAnswer.trim() || isSubmittingAnswer) return;
    const currentQ = questions[currentQuestionIndex];
    let finalIsCorrect = isApproximateMatch(typedAnswer, currentQ.correctAnswerText);
    let finalReason = "";
    if (!finalIsCorrect && currentQ.type.endsWith("to_vi")) {
      setIsSubmittingAnswer(true);
      try {
        const res = await axios.post(`${API_BASE}/check-answer`, {
          word: currentQ.wordObject.word, correctMeaning: currentQ.correctAnswerText, userAnswer: typedAnswer
        });
        if (res.data.success) { finalIsCorrect = res.data.data.isCorrect; finalReason = res.data.data.reason; }
      } catch { finalReason = "Lỗi server"; }
      setIsSubmittingAnswer(false);
    }
    setCheckResult({ isCorrect: finalIsCorrect, reason: finalReason });
    setIsAnswerChecked(true);
    if (finalIsCorrect && mistakeRounds === 0) setScore(p => p + 1);
    setTimeout(() => proceedToNext(finalIsCorrect), 2500);
  };

  // ── Start screen ─────────────────────────────────────────
  if (gameState === "start") {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-8 text-white text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
              <BrainCircuit size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-1">Cài đặt bài kiểm tra</h2>
            <p className="text-brand-200 text-sm">{vocabList.length} từ vựng sẵn sàng</p>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Hình thức</label>
              <select value={quizType} onChange={e => setQuizType(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-brand-500 font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <option value="multiple_choice">Trắc nghiệm</option>
                <option value="typing_en_to_vi">Gõ từ: Anh ➔ Việt (AI chấm)</option>
                <option value="typing_vi_to_en">Gõ từ: Việt ➔ Anh</option>
                <option value="listening_en_to_vi">Nghe ➔ Gõ Việt (AI chấm)</option>
                <option value="listening_en_to_en">Nghe ➔ Gõ Anh</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Số lượng từ mỗi bài</label>
              <select value={wordsPerQuiz} onChange={e => { setWordsPerQuiz(Number(e.target.value)); setChunkIndex(0); }}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:border-brand-500 font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                {[10, 20, 30, 50, 100].map(n => <option key={n} value={n}>{n} từ</option>)}
                <option value={vocabList.length}>Tất cả ({vocabList.length} từ)</option>
              </select>
            </div>

            <div className="flex gap-3 pt-2">
              {onBack && (
                <button onClick={onBack} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                  ← Chọn lại
                </button>
              )}
              <button onClick={() => startQuiz(false)}
                className="flex-1 py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/30">
                {chunkIndex > 0 ? `Nhóm ${chunkIndex + 1}` : `Bắt đầu (${Math.min(wordsPerQuiz, vocabList.length)} từ)`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Review wrong screen ───────────────────────────────────
  if (gameState === "reviewing_wrong") {
    return (
      <div className="max-w-xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-rose-200 dark:border-rose-900/40 overflow-hidden shadow-sm animate-scale-in text-center p-10">
          <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/20 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-5">
            <RotateCcw size={36} />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Chưa xong đâu!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">
            Bạn còn <span className="font-bold text-rose-500">{wrongQuestionsQueue.length} câu</span> sai. Hãy ôn lại để ghi nhớ lâu hơn!
          </p>
          <button onClick={startMistakeReview}
            className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white font-semibold rounded-2xl hover:from-rose-600 hover:to-pink-600 transition-all shadow-lg shadow-rose-500/30">
            Bắt đầu sửa lỗi ({wrongQuestionsQueue.length} câu)
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ─────────────────────────────────────────
  if (gameState === "result") {
    const totalQ = Math.min(wordsPerQuiz, vocabList.length);
    const pct = Math.round((score / totalQ) * 100);
    const isPerfect = pct === 100 && mistakeRounds === 0;
    return (
      <div className="max-w-xl mx-auto animate-scale-in">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm text-center">
          <div className={`p-8 ${isPerfect ? "bg-gradient-to-r from-emerald-500 to-teal-500" : "bg-gradient-to-r from-brand-600 to-brand-500"} text-white`}>
            <div className="text-6xl mb-4">{isPerfect ? "🏆" : pct >= 70 ? "🎉" : "💪"}</div>
            <h2 className="text-3xl font-black">{isPerfect ? "Xuất sắc!" : pct >= 70 ? "Hoàn thành!" : "Cố gắng thêm!"}</h2>
          </div>
          <div className="p-8">
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="text-7xl font-black text-brand-600 dark:text-brand-400">{score}</span>
              <span className="text-3xl text-slate-300 dark:text-slate-600 mb-2">/ {totalQ}</span>
            </div>
            <p className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-1">{pct}% chính xác</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm mb-8">
              {isPerfect ? "Tuyệt vời! Bạn trả lời đúng 100% ngay vòng đầu." : `Hoàn thành sau ${mistakeRounds} lượt ôn lại.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => startQuiz(false)} className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
                Làm lại
              </button>
              <button onClick={() => startQuiz(true)} className="flex-1 py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/30">
                {(chunkIndex + 1) * wordsPerQuiz >= vocabList.length ? "Quay đầu" : `${wordsPerQuiz} từ tiếp`}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Playing ───────────────────────────────────────────────
  const currentQ = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="max-w-2xl mx-auto animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
          mistakeRounds > 0
            ? "bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"
            : "bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400"
        }`}>
          {mistakeRounds > 0 ? `🔄 Sửa lỗi` : "📋 Vòng 1"} · Câu {currentQuestionIndex + 1}/{questions.length}
        </span>
        <span className="text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full">
          ⭐ {score} điểm
        </span>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-5 overflow-hidden">
        <div className="h-full bg-gradient-to-r from-brand-500 to-violet-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Question card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center mb-5 shadow-sm">
        <div className="flex justify-center items-center gap-3 mb-2">
          {currentQ.type.startsWith("listening") ? (
            <button
              onClick={() => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentQ.wordObject?.word); u.lang = "en-US"; u.rate = 0.85; window.speechSynthesis.speak(u); } }}
              className="p-5 text-white bg-brand-500 hover:bg-brand-600 rounded-full transition-all hover:scale-105 active:scale-95 shadow-lg shadow-brand-500/30"
            >
              <Volume2 size={36} />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{currentQ.promptText || currentQ.wordObject?.word}</h3>
              {currentQ.type !== "typing_vi_to_en" && (
                <button onClick={() => { if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentQ.wordObject?.word || currentQ.promptText); u.lang = "en-US"; u.rate = 0.85; window.speechSynthesis.speak(u); } }}
                  className="p-2 text-brand-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-full transition-colors">
                  <Volume2 size={24} />
                </button>
              )}
            </div>
          )}
        </div>
        {currentQ.promptSub && !currentQ.type.startsWith("listening") && (
          <p className="text-slate-400 dark:text-slate-500 font-mono text-sm mt-1">{currentQ.promptSub}</p>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-600 mt-4">
          {currentQ.type === "multiple_choice" ? "Chọn nghĩa đúng" : currentQ.type.startsWith("listening") ? "Nghe và gõ lại" : "Gõ đáp án chính xác"}
        </p>
      </div>

      {/* Answers */}
      {currentQ.type === "multiple_choice" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentQ.options.map((option, index) => {
            const isCorrectOpt = option === currentQ.correctAnswerText || option === currentQ.correctAnswer;
            let cls = "bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-brand-50 dark:hover:bg-brand-900/10";
            if (isAnswerChecked) {
              if (isCorrectOpt) cls = "bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-500 dark:border-emerald-600 text-emerald-800 dark:text-emerald-300 font-semibold";
              else if (option === selectedAnswer) cls = "bg-red-50 dark:bg-red-900/20 border-2 border-red-500 dark:border-red-600 text-red-800 dark:text-red-300";
              else cls = "bg-slate-50 dark:bg-slate-800 border-2 border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-600 opacity-50";
            }
            return (
              <button key={index} onClick={() => handleAnswerClick(option)} disabled={isAnswerChecked}
                className={`p-4 rounded-2xl text-base transition-all duration-200 text-center ${cls}`}>
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleTypeSubmit} className="flex flex-col gap-4">
          <input type="text" ref={inputRef} value={typedAnswer} onChange={e => setTypedAnswer(e.target.value)}
            disabled={isAnswerChecked || isSubmittingAnswer} autoFocus
            className={`w-full p-4 rounded-2xl border-2 text-center text-xl font-semibold focus:outline-none transition-all ${
              isAnswerChecked
                ? checkResult?.isCorrect
                  ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                  : "border-red-500 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300"
                : "border-slate-200 dark:border-slate-700 focus:border-brand-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            }`}
            placeholder="Gõ câu trả lời vào đây..." />

          {isAnswerChecked && !checkResult?.isCorrect && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30 text-center animate-slide-up">
              <p className="text-xs text-amber-600 dark:text-amber-500 mb-2">Đáp án chuẩn là:</p>
              <p className="font-bold text-2xl text-slate-800 dark:text-slate-200">{currentQ.correctAnswerText}</p>
              {checkResult?.reason && (
                <div className="flex items-center justify-center gap-2 mt-3 bg-rose-100 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 px-4 py-2 rounded-xl text-sm">
                  <Sparkles size={14} /> Nhận xét AI: {checkResult.reason}
                </div>
              )}
            </div>
          )}

          <button type="submit" disabled={isAnswerChecked || !typedAnswer.trim() || isSubmittingAnswer}
            className="w-full py-4 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/30 disabled:opacity-40 disabled:cursor-not-allowed flex justify-center items-center gap-2">
            {isSubmittingAnswer ? <><Loader2 size={18} className="animate-spin" /> AI đang kiểm tra...</> : "Xác nhận"}
          </button>
        </form>
      )}
    </div>
  );
}
