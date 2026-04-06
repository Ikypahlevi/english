import React, { useState, useEffect, useMemo } from "react";
import {
  BookOpen,
  Layers,
  GraduationCap,
  Upload,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Sparkles,
  Plus,
  Loader2,
  Volume2,
  Lightbulb,
  Trash2,
  FolderOpen,
  ArrowLeft,
  Database,
} from "lucide-react";
import axios from "axios";

// Base URL của Backend Node.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

// Hàm gọi API Gemini dùng chung với cơ chế Exponential Backoff và cấu trúc JSON
const callGeminiAPI = async (prompt, retries = 5) => {
  const apiKey = "";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: "application/json" },
  };
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return JSON.parse(text);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i)));
    }
  }
  return null;
};

export default function App() {
  // === State: dữ liệu từ Database ===
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

  // === Fetch danh sách topics từ DB khi mount ===
  const fetchTopics = async () => {
    try {
      const res = await axios.get(`${API_BASE}/topics`);
      setTopics(res.data.data || []);
    } catch (err) {
      console.error("Lỗi khi tải danh sách chủ điểm:", err);
    } finally {
      setIsLoadingTopics(false);
    }
  };

  useEffect(() => { fetchTopics(); }, []);

  // === Fetch vocab khi user chọn 1 topic ===
  const selectTopic = async (topic) => {
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
  };

  const backToTopics = () => {
    setSelectedTopic(null);
    setVocabList([]);
  };

  const handleTabChange = (newTab) => {
    if (isQuizOngoing && newTab !== activeTab) {
      if (!window.confirm("Bạn đang kiểm tra dở, bạn có chắc muốn thoát ra không?")) return;
    }
    setActiveTab(newTab);
  };

  // Tải thư viện xlsx (SheetJS) động
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXlsxLoaded(true);
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!isXlsxLoaded || !window.XLSX) {
      alert("Thư viện đọc Excel đang được tải, vui lòng thử lại sau vài giây.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = window.XLSX.read(bstr, { type: "binary" });
      setPendingWorkbook({ file, wb });
      setSelectedSheets([]);
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const toggleSheetSelection = (wsname) => {
    setSelectedSheets(prev =>
      prev.includes(wsname) ? prev.filter(s => s !== wsname) : [...prev, wsname]
    );
  };

  // === Import: parse Excel → gửi thẳng API → refresh topics ===
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
            word: row[1] ? row[1].toString().trim() : "",
            ipa: row[2] ? row[2].toString().trim() : "",
            meaning: row[3] ? row[3].toString().trim() : "",
          });
        }
      }
      return { sheetName: wsname, vocabularies };
    }).filter(s => s.vocabularies.length > 0);

    if (apiPayload.length === 0) {
      alert("Không tìm thấy dữ liệu hợp lệ trong các sheet đã chọn.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await axios.post(`${API_BASE}/topics/import`, apiPayload);
      alert(`✅ ${response.data.message}`);
      await fetchTopics();
    } catch (err) {
      alert("❌ Import thất bại: " + (err.response?.data?.message || err.message));
    } finally {
      setIsSaving(false);
      setSelectedSheets([]);
      setPendingWorkbook(null);
    }
  };

  const handleDeleteTopic = async (topicId, topicName) => {
    if (!window.confirm(`Xóa buổi "${topicName}" và toàn bộ từ vựng?`)) return;
    try {
      await axios.delete(`${API_BASE}/topics/${topicId}`);
      await fetchTopics();
      if (selectedTopic?.topic_id === topicId) backToTopics();
    } catch (err) {
      alert("Xóa thất bại: " + err.message);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm("Bạn có chắc muốn xóa TOÀN BỘ dữ liệu?\nHành động này không thể hoàn tác!")) return;
    try {
      await axios.delete(`${API_BASE}/topics`);
      setTopics([]);
      backToTopics();
    } catch (err) {
      alert("Xóa thất bại: " + err.message);
    }
  };

  if (isLoadingTopics) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={48} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Đang tải dữ liệu từ Database...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-indigo-100">
      {/* Header & Navigation */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-indigo-600">
            <GraduationCap size={32} />
            <h1 className="text-2xl font-bold tracking-tight">EngMaster</h1>
          </div>
          <nav className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => handleTabChange("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <BookOpen size={18} /> Từ vựng
            </button>
            <button
              onClick={() => handleTabChange("flashcard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "flashcard" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Layers size={18} /> Flashcards
            </button>
            <button
              onClick={() => handleTabChange("quiz")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "quiz" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <CheckCircle2 size={18} /> Kiểm tra
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {activeTab === "list" && (
          <VocabListView
            topics={topics}
            selectedTopic={selectedTopic}
            vocabList={vocabList}
            isLoadingVocab={isLoadingVocab}
            selectTopic={selectTopic}
            backToTopics={backToTopics}
            handleFileUpload={handleFileUpload}
            handleDeleteTopic={handleDeleteTopic}
            handleClearAll={handleClearAll}
          />
        )}
        {activeTab === "flashcard" && (
          <FlashcardQuizWrapper topics={topics} mode="flashcard" />
        )}
        {activeTab === "quiz" && (
          <FlashcardQuizWrapper topics={topics} mode="quiz" setIsQuizOngoing={setIsQuizOngoing} />
        )}
      </main>

      {/* Modal Chọn Nhiều Sheet */}
      {pendingWorkbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Chọn trang tính (Sheet)</h3>
            <p className="text-slate-500 text-sm mb-4">
              Từ tệp: <span className="font-semibold text-indigo-600">{pendingWorkbook.file.name}</span>
              <span className="ml-2 text-xs text-indigo-500 font-medium">(đã chọn {selectedSheets.length}/{pendingWorkbook.wb.SheetNames.length})</span>
            </p>
            <div className="flex gap-2 mb-3">
              <button onClick={() => setSelectedSheets([...pendingWorkbook.wb.SheetNames])} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors">Chọn tất cả</button>
              <button onClick={() => setSelectedSheets([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium transition-colors">Bỏ chọn tất cả</button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 mb-6">
              {pendingWorkbook.wb.SheetNames.map((wsname) => {
                const isSelected = selectedSheets.includes(wsname);
                return (
                  <button
                    key={wsname}
                    onClick={() => toggleSheetSelection(wsname)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 flex items-center gap-3 transition-colors ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm"
                        : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                    }`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </span>
                    <span className="font-medium truncate flex-1">{wsname}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setPendingWorkbook(null); setSelectedSheets([]); }} className="flex-1 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">Hủy bỏ</button>
              <button
                onClick={handleImportSelectedSheets}
                disabled={selectedSheets.length === 0 || isSaving}
                className="flex-1 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSaving ? (<><Loader2 size={18} className="animate-spin" /> Đang lưu...</>) : (<>Nhập {selectedSheets.length > 0 ? `${selectedSheets.length} sheet` : "đã chọn"}</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================
// === Wrapper: chọn topics rồi mới hiện Flashcard/Quiz ===
// =============================================
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

  const totalWords = useMemo(() => {
    return topics.filter(t => selectedTopicIds.includes(t.topic_id))
      .reduce((sum, t) => sum + Number(t.vocab_count || 0), 0);
  }, [selectedTopicIds, topics]);

  const handleStart = async () => {
    if (selectedTopicIds.length === 0) return;
    setIsLoading(true);
    try {
      const results = await Promise.all(
        selectedTopicIds.map(id => axios.get(`${API_BASE}/topics/${id}/vocabularies`))
      );
      const allVocab = results.flatMap(res => res.data.data || []);
      setLoadedVocab(allVocab);
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

  return (
    <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
      <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
        {mode === "flashcard" ? <Layers size={40} /> : <CheckCircle2 size={40} />}
      </div>
      <h2 className="text-2xl font-bold text-slate-800 mb-2">
        {mode === "flashcard" ? "Flashcards" : "Kiểm tra trắc nghiệm"}
      </h2>
      <p className="text-slate-600 mb-6">
        Chọn buổi học bạn muốn {mode === "flashcard" ? "ôn tập" : "kiểm tra"}.
      </p>

      {topics.length === 0 ? (
        <p className="text-slate-400 py-8">Chưa có dữ liệu. Hãy import file Excel ở tab Từ vựng.</p>
      ) : (
        <>
          <div className="flex gap-2 justify-center mb-3">
            <button onClick={() => setSelectedTopicIds(topics.map(t => t.topic_id))} className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 font-medium transition-colors">Chọn tất cả</button>
            <button onClick={() => setSelectedTopicIds([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-50 text-slate-500 hover:bg-slate-100 font-medium transition-colors">Bỏ chọn</button>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-h-[30vh] overflow-y-auto py-1 mb-4">
            {topics.map((topic) => {
              const isSelected = selectedTopicIds.includes(topic.topic_id);
              return (
                <button
                  key={topic.topic_id}
                  onClick={() => toggleTopic(topic.topic_id)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                    isSelected ? "bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm" : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 text-xs transition-colors ${
                    isSelected ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-300 bg-white"
                  }`}>
                    {isSelected && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </span>
                  {topic.topic_name}
                  <span className={`text-xs ${isSelected ? "text-indigo-400" : "text-slate-400"}`}>({topic.vocab_count})</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-indigo-500 font-medium mb-6">
            {selectedTopicIds.length > 0 ? `Đã chọn ${selectedTopicIds.length} buổi • ${totalWords} từ` : "Chưa chọn buổi nào"}
          </p>
          <button
            onClick={handleStart}
            disabled={selectedTopicIds.length === 0 || isLoading}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isLoading ? <><Loader2 size={18} className="animate-spin" /> Đang tải...</> : `Bắt đầu (${totalWords} từ)`}
          </button>
        </>
      )}
    </div>
  );
}

// =============================================
// === TAB 1: DANH SÁCH TỪ VỰNG ===
// =============================================
function VocabListView({
  topics, selectedTopic, vocabList, isLoadingVocab,
  selectTopic, backToTopics, handleFileUpload,
  handleDeleteTopic, handleClearAll,
}) {
  // === Giao diện CHỌN TOPIC (khi chưa chọn topic nào) ===
  if (!selectedTopic) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Database size={20} className="text-indigo-500" /> Danh sách buổi học
            </h2>
            <p className="text-sm text-slate-500">{topics.length} buổi đã lưu trong Database</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200">
              <Upload size={18} />
              <span>Nhập từ file Excel</span>
              <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
            </label>
            {topics.length > 0 && (
              <button
                onClick={handleClearAll}
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors border border-red-200"
              >
                <Trash2 size={18} /> Xóa tất cả
              </button>
            )}
          </div>
        </div>

        {topics.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <FolderOpen size={48} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium">Chưa có dữ liệu</p>
            <p className="text-sm mt-1">Hãy nhập file Excel để bắt đầu.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {topics.map((topic) => (
              <div key={topic.topic_id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/80 transition-colors group">
                <button onClick={() => selectTopic(topic)} className="flex-1 text-left flex items-center gap-4">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0">
                    {topic.vocab_count}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{topic.topic_name}</p>
                    <p className="text-xs text-slate-400">{topic.vocab_count} từ vựng • {new Date(topic.created_at).toLocaleDateString("vi-VN")}</p>
                  </div>
                </button>
                <button
                  onClick={() => handleDeleteTopic(topic.topic_id, topic.topic_name)}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                  title="Xóa buổi này"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // === Giao diện CHI TIẾT TỪ VỰNG (khi đã chọn 1 topic) ===
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button onClick={backToTopics} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Quay lại">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-lg font-semibold text-slate-800">{selectedTopic.topic_name}</h2>
            <p className="text-sm text-slate-500">{vocabList.length} từ vựng</p>
          </div>
        </div>
      </div>

      {isLoadingVocab ? (
        <div className="py-16 text-center">
          <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-slate-500">Đang tải từ vựng...</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                <th className="py-3 px-6 font-semibold w-16 text-center">STT</th>
                <th className="py-3 px-6 font-semibold">Tiếng Anh</th>
                <th className="py-3 px-6 font-semibold">Phát âm IPA</th>
                <th className="py-3 px-6 font-semibold">Tiếng Việt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vocabList.map((item, index) => (
                <tr key={item.vocabulary_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-6 text-center text-slate-500">{index + 1}</td>
                  <td className="py-3 px-6 font-medium text-slate-800">{item.word}</td>
                  <td className="py-3 px-6 text-slate-600 font-mono text-sm">{item.ipa}</td>
                  <td className="py-3 px-6 text-slate-700">{item.meaning}</td>
                </tr>
              ))}
              {vocabList.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-8 text-center text-slate-500">
                    Không có từ vựng trong chủ điểm này.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// --- TAB 2: FLASHCARD ---
function FlashcardView({ vocabList, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [example, setExample] = useState(null);
  const [mnemonic, setMnemonic] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMnemonicLoading, setIsMnemonicLoading] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
    setExample(null);
    setMnemonic(null);
  }, [currentIndex]);

  const handleNext = () => setCurrentIndex((prev) => (prev + 1) % vocabList.length);
  const handlePrev = () => setCurrentIndex((prev) => (prev - 1 + vocabList.length) % vocabList.length);

  const currentWord = vocabList[currentIndex];

  const playAudio = (text, e) => {
    if (e) e.stopPropagation();
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const generateExample = async () => {
    setIsAiLoading(true);
    try {
      const prompt = `Viết một câu ví dụ tiếng Anh cực kỳ ngắn gọn, tự nhiên sử dụng từ vựng "${currentWord.word}" (mang nghĩa: ${currentWord.meaning}). Dịch sang tiếng Việt. Trả về JSON: {"english": "...", "vietnamese": "..."}`;
      const result = await callGeminiAPI(prompt);
      if (result) setExample(result);
    } catch (e) { console.error("Lỗi:", e); } finally { setIsAiLoading(false); }
  };

  const generateMnemonic = async () => {
    setIsMnemonicLoading(true);
    try {
      const prompt = `Tạo mẹo nhớ từ vựng vui nhộn cho từ "${currentWord.word}" (phát âm: ${currentWord.ipa}, nghĩa: ${currentWord.meaning}). Trả về JSON: {"mnemonic": "..."}`;
      const result = await callGeminiAPI(prompt);
      if (result) setMnemonic(result.mnemonic);
    } catch (e) { console.error("Lỗi:", e); } finally { setIsMnemonicLoading(false); }
  };

  if (!currentWord) return null;

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center">
      <div className="mb-6 flex justify-between w-full items-center px-4">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600" title="Quay lại">
              <ArrowLeft size={20} />
            </button>
          )}
          <span className="text-slate-500 font-medium">Card {currentIndex + 1} / {vocabList.length}</span>
        </div>
        <button onClick={() => setIsFlipped(!isFlipped)} className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-sm font-medium">
          <RotateCcw size={16} /> Lật thẻ
        </button>
      </div>

      <div className="w-full aspect-[4/3] sm:aspect-video cursor-pointer" style={{ perspective: "1000px" }} onClick={() => setIsFlipped(!isFlipped)}>
        <div className="relative w-full h-full transition-transform duration-500 shadow-xl rounded-3xl" style={{ transformStyle: "preserve-3d", transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)" }}>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-indigo-50 p-8 text-center" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
            <h2 className="text-5xl sm:text-7xl font-bold text-slate-800 mb-4">{currentWord.word}</h2>
            <div className="flex items-center gap-3">
              {currentWord.ipa && <p className="text-xl text-indigo-500 font-mono bg-indigo-50 px-4 py-1.5 rounded-full">{currentWord.ipa}</p>}
              <button onClick={(e) => playAudio(currentWord.word, e)} className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors" title="Nghe phát âm"><Volume2 size={28} /></button>
            </div>
            <p className="absolute bottom-6 text-sm text-slate-400">Chạm để xem nghĩa</p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600 rounded-3xl p-8 text-center text-white" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">{currentWord.meaning}</h2>
            <div className="opacity-80 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <p className="text-lg">{currentWord.word}</p>
                <button onClick={(e) => playAudio(currentWord.word, e)} className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-500 rounded-full transition-colors" title="Nghe"><Volume2 size={20} /></button>
              </div>
              <p className="font-mono text-sm">{currentWord.ipa}</p>
            </div>
            <button onClick={(e) => playAudio(currentWord.word, e)} className="mt-8 flex items-center justify-center gap-2 px-8 py-3 border-2 border-indigo-400/50 hover:border-white hover:bg-white/10 rounded-2xl transition-all text-white font-medium shadow-sm">
              <Volume2 size={20} /> Nghe lại phát âm
            </button>
            <p className="absolute bottom-6 text-sm text-indigo-200">Chạm để quay lại</p>
          </div>
        </div>
      </div>

      <div className="w-full mt-6 px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!mnemonic && (
          <button onClick={generateMnemonic} disabled={isMnemonicLoading} className="w-full py-3.5 rounded-2xl border border-amber-100 bg-white text-amber-600 font-medium flex justify-center items-center gap-2 hover:bg-amber-50 hover:shadow-sm transition-all shadow-sm disabled:opacity-70">
            {isMnemonicLoading ? <Loader2 size={20} className="animate-spin" /> : <Lightbulb size={20} />} ✨ Gợi ý Mẹo nhớ từ
          </button>
        )}
        {!example && (
          <button onClick={generateExample} disabled={isAiLoading} className="w-full py-3.5 rounded-2xl border border-indigo-100 bg-white text-indigo-600 font-medium flex justify-center items-center gap-2 hover:bg-indigo-50 hover:shadow-sm transition-all shadow-sm disabled:opacity-70">
            {isAiLoading ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />} ✨ Tạo câu ví dụ
          </button>
        )}
      </div>

      <div className="w-full px-4 flex flex-col gap-4 mt-2">
        {mnemonic && (
          <div className="w-full p-6 rounded-2xl border border-amber-100 bg-amber-50 text-left relative overflow-hidden">
            <div className="flex items-center gap-2 text-amber-800 font-semibold mb-3"><Lightbulb size={18} /> Mẹo nhớ từ:</div>
            <p className="text-slate-800 text-lg font-medium">{mnemonic}</p>
          </div>
        )}
        {example && (
          <div className="w-full p-6 rounded-2xl border border-indigo-100 bg-indigo-50 text-left relative overflow-hidden">
            <div className="flex items-center gap-2 text-indigo-800 font-semibold mb-3"><Sparkles size={18} /> Ví dụ thực tế:</div>
            <p className="text-slate-800 text-lg mb-1.5 font-medium">{example.english}</p>
            <p className="text-slate-600">{example.vietnamese}</p>
          </div>
        )}
      </div>

      <div className="flex gap-4 mt-8">
        <button onClick={handlePrev} className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50 hover:text-indigo-600 transition-colors"><ChevronLeft size={24} /></button>
        <button onClick={handleNext} className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50 hover:text-indigo-600 transition-colors"><ChevronRight size={24} /></button>
      </div>
    </div>
  );
}

// Function hỗ trợ kiểm tra tiếng Việt tương đối
function isApproximateMatch(typed, correct) {
  if (!typed || !correct) return false;
  const removeAccents = (str) => str.toLowerCase()
    .replace(/[àáạảãâăằắặẳẵâầấậẩẫ]/g, "a").replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i").replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u").replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d").replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
  const t = removeAccents(typed);
  const c = removeAccents(correct);
  if (t === c) return true;
  const parts = correct.split(/[,;|/]/).map(removeAccents);
  if (parts.includes(t)) return true;
  if (c.includes(t) && t.length >= c.length * 0.5 && t.length >= 3) return true;
  return false;
}

// --- TAB 3: BÀI KIỂM TRA ---
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
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (setIsQuizOngoing) setIsQuizOngoing(gameState === "playing");
    return () => { if (setIsQuizOngoing) setIsQuizOngoing(false); };
  }, [gameState, setIsQuizOngoing]);

  React.useEffect(() => {
    if (gameState === "playing" && !isAnswerChecked && inputRef.current) {
      setTimeout(() => { if (inputRef.current) inputRef.current.focus(); }, 50);
    }
    if (gameState === "playing" && !isAnswerChecked && quizType.startsWith("listening")) {
      const currentQ = questions[currentQuestionIndex];
      setTimeout(() => {
        if (currentQ && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentQ.wordObject.word);
          utterance.lang = "en-US"; utterance.rate = 0.85;
          window.speechSynthesis.speak(utterance);
        }
      }, 300);
    }
  }, [currentQuestionIndex, isAnswerChecked, gameState, quizType, questions]);

  const startQuiz = (isNext = false) => {
    if (vocabList.length < 4) {
      alert("Cần ít nhất 4 từ vựng để tạo bài kiểm tra!");
      return;
    }
    let nextChunk = chunkIndex;
    if (isNext === true) {
      nextChunk++;
      if (nextChunk * wordsPerQuiz >= vocabList.length) nextChunk = 0;
      setChunkIndex(nextChunk);
    }
    const startIndex = nextChunk * wordsPerQuiz;
    const endIndex = Math.min(startIndex + wordsPerQuiz, vocabList.length);
    const chunkWords = vocabList.slice(startIndex, endIndex);
    const quizWords = [...chunkWords].sort(() => 0.5 - Math.random());

    const generatedQuestions = quizWords.map((word) => {
      let promptText = word.word, promptSub = word.ipa, correctAnswerText = word.meaning, options = [];
      if (quizType === "typing_vi_to_en") { promptText = word.meaning; promptSub = ""; correctAnswerText = word.word; }
      else if (quizType === "multiple_choice") {
        const wrongAnswers = vocabList.filter((w) => w.vocabulary_id !== word.vocabulary_id).sort(() => 0.5 - Math.random()).slice(0, 3).map((w) => w.meaning);
        options = [...wrongAnswers, word.meaning].sort(() => 0.5 - Math.random());
      } else if (quizType === "listening_en_to_vi") { promptSub = ""; } else if (quizType === "listening_en_to_en") { promptSub = ""; correctAnswerText = word.word; }
      return { wordObject: word, promptText, promptSub, correctAnswerText, options, type: quizType, correctAnswer: word.meaning };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0); setScore(0); setGameState("playing");
    setSelectedAnswer(null); setTypedAnswer(""); setIsAnswerChecked(false);
  };

  const handleAnswerClick = (option) => {
    if (isAnswerChecked) return;
    setSelectedAnswer(option); setIsAnswerChecked(true);
    if (option === questions[currentQuestionIndex].correctAnswer) setScore(score + 1);
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(currentQuestionIndex + 1); setSelectedAnswer(null); setIsAnswerChecked(false); }
      else setGameState("result");
    }, 1500);
  };

  const handleTypeSubmit = (e) => {
    if (e) e.preventDefault();
    if (isAnswerChecked || !typedAnswer.trim()) return;
    setIsAnswerChecked(true);
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = isApproximateMatch(typedAnswer, currentQ.correctAnswerText);
    if (isCorrect) setScore(score + 1);
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) { setCurrentQuestionIndex(currentQuestionIndex + 1); setTypedAnswer(""); setIsAnswerChecked(false); }
      else setGameState("result");
    }, 2000);
  };

  if (gameState === "start") {
    return (
      <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 size={40} /></div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Cấu hình bài kiểm tra</h2>
        <p className="text-slate-600 mb-6">Đang kiểm tra {vocabList.length} từ vựng.</p>

        <div className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="flex flex-col items-start gap-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Hình thức</label>
            <select value={quizType} onChange={(e) => setQuizType(e.target.value)} className="px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-slate-700 bg-white shadow-sm cursor-pointer min-w-[200px]">
              <option value="multiple_choice">Trắc nghiệm</option>
              <option value="typing_en_to_vi">Gõ từ: Anh ➔ Việt</option>
              <option value="typing_vi_to_en">Gõ từ: Việt ➔ Anh</option>
              <option value="listening_en_to_vi">Nghe ➔ Gõ Việt</option>
              <option value="listening_en_to_en">Nghe ➔ Gõ Anh</option>
            </select>
          </div>
          <div className="flex flex-col items-start gap-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Số lượng</label>
            <select value={wordsPerQuiz} onChange={(e) => { setWordsPerQuiz(Number(e.target.value)); setChunkIndex(0); }} className="px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 font-medium text-slate-700 bg-white shadow-sm cursor-pointer min-w-[150px]">
              <option value={10}>10 từ</option><option value={20}>20 từ</option><option value={30}>30 từ</option>
              <option value={50}>50 từ</option><option value={100}>100 từ</option>
              <option value={vocabList.length}>Tất cả ({vocabList.length} từ)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          {onBack && <button onClick={onBack} className="px-8 py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors">← Chọn lại buổi</button>}
          <button onClick={() => startQuiz(false)} className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
            {chunkIndex > 0 ? `Kiểm tra Nhóm ${chunkIndex + 1}` : `Bắt đầu (${Math.min(wordsPerQuiz, vocabList.length)} từ)`}
          </button>
        </div>
      </div>
    );
  }

  if (gameState === "result") {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Kết quả của bạn</h2>
        <div className="text-6xl font-black text-indigo-600 my-6">{score} / {questions.length}</div>
        <p className="text-lg text-slate-600 mb-8">
          {percentage === 100 ? "Tuyệt vời! Bạn đã nhớ tất cả." : percentage >= 70 ? "Rất tốt! Tiếp tục phát huy." : "Cố gắng hơn nhé! Ôn lại Flashcard sẽ giúp ích."}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={() => startQuiz(false)} className="px-8 py-3 bg-white text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm">Làm lại nhóm từ hiện tại</button>
          <button onClick={() => startQuiz(true)} className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
            {((chunkIndex + 1) * wordsPerQuiz >= vocabList.length) ? `Quay lại ${wordsPerQuiz} từ đầu tiên` : `Kiểm tra ${wordsPerQuiz} từ tiếp theo`}
          </button>
        </div>
      </div>
    );
  }

  const currentQ = questions[currentQuestionIndex];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-6 px-2">
        <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">Câu {currentQuestionIndex + 1} / {questions.length}</span>
        <span className="text-sm text-slate-500 font-medium">Điểm: {score}</span>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center mb-6">
        <div className="flex justify-center items-center gap-3 mb-2">
          {currentQ.type.startsWith("listening") ? (
            <button onClick={(e) => { if (e) e.preventDefault(); if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentQ.wordObject?.word); u.lang = "en-US"; u.rate = 0.85; window.speechSynthesis.speak(u); } }} className="p-6 text-white bg-indigo-500 hover:bg-indigo-600 rounded-full transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-indigo-200 animate-pulse" title="Nghe lại"><Volume2 size={48} /></button>
          ) : (
            <>
              <h3 className="text-4xl font-bold text-slate-800">{currentQ.promptText || currentQ.wordObject?.word}</h3>
              {currentQ.type !== "typing_vi_to_en" && (
                <button onClick={(e) => { if (e) e.preventDefault(); if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentQ.wordObject?.word || currentQ.promptText); u.lang = "en-US"; u.rate = 0.85; window.speechSynthesis.speak(u); } }} className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer" title="Nghe phát âm"><Volume2 size={28} /></button>
              )}
            </>
          )}
        </div>
        {currentQ.promptSub && !currentQ.type.startsWith("listening") && <p className="text-slate-500 font-mono">{currentQ.promptSub}</p>}
        <p className="text-sm text-slate-400 mt-6">{currentQ.type === "multiple_choice" ? "Chọn nghĩa đúng" : currentQ.type.startsWith("listening") ? "Nghe và gõ lại" : "Gõ đáp án chính xác"}</p>
      </div>

      {currentQ.type === "multiple_choice" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentQ.options.map((option, index) => {
            let btnClass = "bg-white border-2 border-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50";
            if (isAnswerChecked) {
              if (option === currentQ.correctAnswerText || option === currentQ.correctAnswer) btnClass = "bg-green-100 border-2 border-green-500 text-green-800 font-medium";
              else if (option === selectedAnswer) btnClass = "bg-red-100 border-2 border-red-500 text-red-800";
              else btnClass = "bg-white border-2 border-slate-100 text-slate-400 opacity-50";
            }
            return (<button key={index} onClick={() => handleAnswerClick(option)} disabled={isAnswerChecked} className={`p-4 rounded-xl text-lg transition-all duration-200 w-full text-center ${btnClass}`}>{option}</button>);
          })}
        </div>
      ) : (
        <form onSubmit={handleTypeSubmit} className="flex flex-col gap-4">
          <input type="text" ref={inputRef} value={typedAnswer} onChange={(e) => setTypedAnswer(e.target.value)} disabled={isAnswerChecked} autoFocus
            className={`w-full p-4 rounded-xl border-2 text-center text-xl font-medium focus:outline-none transition-colors ${
              isAnswerChecked ? (isApproximateMatch(typedAnswer, currentQ.correctAnswerText) ? "border-green-500 bg-green-50 text-green-800" : "border-red-500 bg-red-50 text-red-800") : "border-slate-200 focus:border-indigo-500 bg-white text-slate-800"
            }`} placeholder="Gõ câu trả lời vào đây..." />
          {isAnswerChecked && !isApproximateMatch(typedAnswer, currentQ.correctAnswerText) && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-center">
              <p className="text-sm mb-1 opacity-80">Đáp án đúng là:</p>
              <div className="flex justify-center items-center gap-2">
                <p className="font-bold text-2xl">{currentQ.correctAnswerText}</p>
                {(currentQ.type === "typing_vi_to_en" || currentQ.type.startsWith("listening")) && (
                  <button type="button" onClick={(e) => { if (e) e.preventDefault(); if ("speechSynthesis" in window) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(currentQ.wordObject?.word); u.lang = "en-US"; u.rate = 0.85; window.speechSynthesis.speak(u); } }} className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-full transition-colors cursor-pointer" title="Nghe"><Volume2 size={24} /></button>
                )}
              </div>
            </div>
          )}
          <button type="submit" disabled={isAnswerChecked || !typedAnswer.trim()} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">Xác nhận</button>
        </form>
      )}
    </div>
  );
}
