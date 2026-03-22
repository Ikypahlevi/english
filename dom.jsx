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
} from "lucide-react";

// Hàm gọi API Gemini dùng chung với cơ chế Exponential Backoff và cấu trúc JSON
const callGeminiAPI = async (prompt, retries = 5) => {
  const apiKey = ""; // API key được môi trường tự động tiêm vào
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
      await new Promise((res) => setTimeout(res, 1000 * Math.pow(2, i))); // Retry: 1s, 2s, 4s, 8s, 16s
    }
  }
  return null;
};

export default function App() {
  const [vocabList, setVocabList] = useState([]);
  const [activeTab, setActiveTab] = useState("list"); // 'list', 'flashcard', 'quiz'
  const [isXlsxLoaded, setIsXlsxLoaded] = useState(false);
  const [readSheets, setReadSheets] = useState([]);
  const [pendingWorkbook, setPendingWorkbook] = useState(null);
  const [isQuizOngoing, setIsQuizOngoing] = useState(false);

  const handleTabChange = (newTab) => {
    if (isQuizOngoing && newTab !== activeTab) {
      if (!window.confirm("Bạn đang kiểm tra dở, bạn có chắc muốn thoát ra không? Làm vậy hệ thống sẽ không ghi nhận điểm cho bài này.")) {
        return;
      }
    }
    setActiveTab(newTab);
  };

  // Tải thư viện xlsx (SheetJS) động để đọc file Excel mà không cần cài đặt npm
  useEffect(() => {
    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
    script.async = true;
    script.onload = () => setIsXlsxLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
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
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
  };

  const handleSheetSelection = (wsname) => {
    if (!pendingWorkbook) return;
    const { wb, file } = pendingWorkbook;
    const sheetKey = `${file.name}_${wsname}`;
    const ws = wb.Sheets[wsname];
    
    // Chuyển đổi sheet thành mảng các mảng (array of arrays)
    const data = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
    const newVocab = [];

    // Bắt đầu từ dòng 1 (bỏ qua dòng 0 là Header: STT, Tiếng Anh, IPA, Tiếng Việt)
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row && row.length >= 4 && row[1]) {
        newVocab.push({
          id: Date.now() + i,
          word: row[1] ? row[1].toString().trim() : "",
          ipa: row[2] ? row[2].toString().trim() : "",
          meaning: row[3] ? row[3].toString().trim() : "",
        });
      }
    }

    if (newVocab.length > 0) {
      setVocabList(prev => [...prev, ...newVocab]);
      if (!readSheets.includes(sheetKey)) {
        setReadSheets(prev => [...prev, sheetKey]);
      }
      alert(`Đã thêm thành công ${newVocab.length} từ vựng từ sheet: ${wsname}`);
    } else {
      if (!readSheets.includes(sheetKey)) {
        setReadSheets(prev => [...prev, sheetKey]);
      }
      alert(`Không tìm thấy dữ liệu hợp lệ trong sheet "${wsname}". Vui lòng đảm bảo file Excel có cấu trúc cột: STT | Cột 2 (Tiếng Anh) | Cột 3 (IPA) | Cột 4 (Tiếng Việt)`);
    }
    setPendingWorkbook(null);
  };

  const deleteWord = (id) => {
    setVocabList(vocabList.filter((word) => word.id !== id));
  };

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
        {vocabList.length === 0 && activeTab !== "list" ? (
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-slate-100">
            <div className="text-slate-400 mb-4 flex justify-center">
              <BookOpen size={48} />
            </div>
            <h2 className="text-xl font-semibold text-slate-700">
              Danh sách từ vựng trống
            </h2>
            <p className="text-slate-500 mt-2 mb-6">
              Vui lòng thêm từ vựng ở mục Danh sách để bắt đầu học.
            </p>
            <button
              onClick={() => setActiveTab("list")}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Đi tới Danh sách
            </button>
          </div>
        ) : (
          <>
            {activeTab === "list" && (
              <VocabListView
                vocabList={vocabList}
                setVocabList={setVocabList}
                handleFileUpload={handleFileUpload}
                deleteWord={deleteWord}
              />
            )}
            {activeTab === "flashcard" && (
              <FlashcardView vocabList={vocabList} />
            )}
            {activeTab === "quiz" && <QuizView vocabList={vocabList} setIsQuizOngoing={setIsQuizOngoing} />}
          </>
        )}
      </main>

      {/* Modal Chọn Sheet */}
      {pendingWorkbook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-800 mb-2">Chọn trang tính (Sheet)</h3>
            <p className="text-slate-500 text-sm mb-4">
              Từ tệp: <span className="font-semibold text-indigo-600">{pendingWorkbook.file.name}</span>
            </p>
            <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-2 mb-6 pointer-events-auto">
              {pendingWorkbook.wb.SheetNames.map((wsname) => {
                const sheetKey = `${pendingWorkbook.file.name}_${wsname}`;
                const isRead = readSheets.includes(sheetKey);
                return (
                  <button
                    key={wsname}
                    onClick={() => handleSheetSelection(wsname)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 flex justify-between items-center transition-colors ${
                      isRead 
                        ? "bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100" 
                        : "bg-white border-indigo-100 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm"
                    }`}
                  >
                    <span className="font-medium truncate pr-4">{wsname}</span>
                    {isRead ? (
                      <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-md whitespace-nowrap">Đã nhập</span>
                    ) : (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-md whitespace-nowrap font-medium">Chọn</span>
                    )}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setPendingWorkbook(null)}
              className="w-full py-3 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition-colors"
            >
              Hủy bỏ thao tác
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// --- TAB 1: DANH SÁCH TỪ VỰNG ---
function VocabListView({
  vocabList,
  setVocabList,
  handleFileUpload,
  deleteWord,
}) {
  const [newWord, setNewWord] = useState("");
  const [newIpa, setNewIpa] = useState("");
  const [newMeaning, setNewMeaning] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const handleAiFill = async () => {
    if (!newWord.trim()) return;

    setIsAiLoading(true);
    try {
      const prompt = `Bạn là một từ điển tiếng Anh - Việt. Cho từ tiếng Anh sau: "${newWord}". Hãy trả về định dạng JSON chứa 2 trường: "ipa" (phát âm IPA) và "meaning" (nghĩa tiếng Việt ngắn gọn, phổ biến nhất). Ví dụ: {"ipa": "/həˈləʊ/", "meaning": "Xin chào"}`;
      const result = await callGeminiAPI(prompt);
      if (result) {
        setNewIpa(result.ipa || "");
        setNewMeaning(result.meaning || "");
      }
    } catch (e) {
      console.error("AI Error:", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddWord = () => {
    if (!newWord.trim() || !newMeaning.trim()) return;
    const newVocab = {
      id: Date.now(),
      word: newWord.trim(),
      ipa: newIpa.trim(),
      meaning: newMeaning.trim(),
    };
    setVocabList([...vocabList, newVocab]);
    setNewWord("");
    setNewIpa("");
    setNewMeaning("");
    setShowAddForm(false);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            Danh sách từ vựng
          </h2>
          <p className="text-sm text-slate-500">
            Tổng cộng: {vocabList.length} từ
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-medium transition-colors border border-indigo-200"
          >
            <Plus size={18} /> Thêm từ
          </button>
          <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors border border-green-200">
            <Upload size={18} />
            <span>Nhập từ file Excel</span>
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {showAddForm && (
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-end animate-in fade-in slide-in-from-top-2">
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tiếng Anh
            </label>
            <input
              type="text"
              value={newWord}
              onChange={(e) => setNewWord(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="VD: Future"
            />
          </div>
          <div className="flex-1 w-full relative">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5 opacity-0 hidden md:block">
              AI
            </label>
            <button
              onClick={handleAiFill}
              disabled={isAiLoading || !newWord.trim()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-xl hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 transition-all shadow-sm font-medium"
            >
              {isAiLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Sparkles size={18} />
              )}
              <span>✨ AI Điền tự động</span>
            </button>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              IPA
            </label>
            <input
              type="text"
              value={newIpa}
              onChange={(e) => setNewIpa(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              placeholder="/ˈfjuːtʃər/"
            />
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Tiếng Việt
            </label>
            <input
              type="text"
              value={newMeaning}
              onChange={(e) => setNewMeaning(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Tương lai"
            />
          </div>
          <button
            onClick={handleAddWord}
            disabled={!newWord.trim() || !newMeaning.trim()}
            className="w-full md:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium disabled:opacity-50 transition-colors"
          >
            Lưu
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
              <th className="py-3 px-6 font-semibold w-16 text-center">STT</th>
              <th className="py-3 px-6 font-semibold">Tiếng Anh</th>
              <th className="py-3 px-6 font-semibold">Phát âm IPA</th>
              <th className="py-3 px-6 font-semibold">Tiếng Việt</th>
              <th className="py-3 px-6 font-semibold w-24 text-center">
                Hành động
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vocabList.map((item, index) => (
              <tr
                key={item.id}
                className="hover:bg-slate-50/50 transition-colors"
              >
                <td className="py-3 px-6 text-center text-slate-500">
                  {index + 1}
                </td>
                <td className="py-3 px-6 font-medium text-slate-800">
                  {item.word}
                </td>
                <td className="py-3 px-6 text-slate-600 font-mono text-sm">
                  {item.ipa}
                </td>
                <td className="py-3 px-6 text-slate-700">{item.meaning}</td>
                <td className="py-3 px-6 text-center">
                  <button
                    onClick={() => deleteWord(item.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Xóa từ này"
                  >
                    <XCircle size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {vocabList.length === 0 && (
              <tr>
                <td colSpan="5" className="py-8 text-center text-slate-500">
                  Chưa có từ vựng nào. Hãy nhập file Excel để bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- TAB 2: FLASHCARD ---
function FlashcardView({ vocabList }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [example, setExample] = useState(null);
  const [mnemonic, setMnemonic] = useState(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isMnemonicLoading, setIsMnemonicLoading] = useState(false);

  // Reset flip state when card changes
  useEffect(() => {
    setIsFlipped(false);
    setExample(null);
    setMnemonic(null);
  }, [currentIndex]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % vocabList.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + vocabList.length) % vocabList.length);
  };

  const currentWord = vocabList[currentIndex];

  // Hàm phát âm sử dụng API nội bộ của trình duyệt
  const playAudio = (text, e) => {
    if (e) e.stopPropagation(); // Ngăn chặn sự kiện click lan truyền làm lật thẻ

    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel(); // Dừng âm thanh đang phát (nếu có)
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US"; // Giọng tiếng Anh Mỹ
      utterance.rate = 0.85; // Giảm tốc độ đọc một chút cho dễ nghe
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Trình duyệt của bạn không hỗ trợ tính năng phát âm.");
    }
  };

  const generateExample = async () => {
    setIsAiLoading(true);
    try {
      const prompt = `Viết một câu ví dụ tiếng Anh cực kỳ ngắn gọn, tự nhiên và dễ hiểu sử dụng từ vựng "${currentWord.word}" (mang nghĩa: ${currentWord.meaning}). Sau đó dịch câu đó sang tiếng Việt. Trả về định dạng JSON chứa 2 trường: "english" (câu tiếng Anh) và "vietnamese" (câu dịch tiếng Việt).`;
      const result = await callGeminiAPI(prompt);
      if (result) {
        setExample(result);
      }
    } catch (e) {
      console.error("Lỗi khi tạo ví dụ:", e);
    } finally {
      setIsAiLoading(false);
    }
  };

  const generateMnemonic = async () => {
    setIsMnemonicLoading(true);
    try {
      const prompt = `Tạo một mẹo nhớ từ vựng tiếng Anh (mnemonic) vui nhộn, dễ nhớ cho từ "${currentWord.word}" (phát âm: ${currentWord.ipa}, nghĩa: ${currentWord.meaning}). Mẹo nhớ có thể dựa trên sự tương đồng về âm thanh với tiếng Việt, hoặc tưởng tượng ra một hình ảnh hài hước. Trả về định dạng JSON với 1 trường duy nhất: "mnemonic" (chứa nội dung mẹo nhớ ngắn gọn 1-2 câu).`;
      const result = await callGeminiAPI(prompt);
      if (result) {
        setMnemonic(result.mnemonic);
      }
    } catch (e) {
      console.error("Lỗi khi tạo mẹo nhớ:", e);
    } finally {
      setIsMnemonicLoading(false);
    }
  };

  if (!currentWord) return null;

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center">
      <div className="mb-6 flex justify-between w-full items-center px-4">
        <span className="text-slate-500 font-medium">
          Card {currentIndex + 1} / {vocabList.length}
        </span>
        <button
          onClick={() => setIsFlipped(!isFlipped)}
          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 text-sm font-medium"
        >
          <RotateCcw size={16} /> Lật thẻ
        </button>
      </div>

      {/* Thẻ Flashcard - Đã sửa lỗi font chữ ngược bằng Inline Styles an toàn */}
      <div
        className="w-full aspect-[4/3] sm:aspect-video cursor-pointer"
        style={{ perspective: "1000px" }}
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div
          className="relative w-full h-full transition-transform duration-500 shadow-xl rounded-3xl"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Mặt trước (Tiếng Anh) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-3xl border-2 border-indigo-50 p-8 text-center"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <h2 className="text-5xl sm:text-7xl font-bold text-slate-800 mb-4">
              {currentWord.word}
            </h2>
            <div className="flex items-center gap-3">
              {currentWord.ipa && (
                <p className="text-xl text-indigo-500 font-mono bg-indigo-50 px-4 py-1.5 rounded-full">
                  {currentWord.ipa}
                </p>
              )}
              <button
                onClick={(e) => playAudio(currentWord.word, e)}
                className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-100 rounded-full transition-colors"
                title="Nghe phát âm"
              >
                <Volume2 size={28} />
              </button>
            </div>
            <p className="absolute bottom-6 text-sm text-slate-400">
              Chạm để xem nghĩa
            </p>
          </div>

          {/* Mặt sau (Tiếng Việt) */}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center bg-indigo-600 rounded-3xl p-8 text-center text-white"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 leading-tight">
              {currentWord.meaning}
            </h2>
            <div className="opacity-80 flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <p className="text-lg">{currentWord.word}</p>
                <button
                  onClick={(e) => playAudio(currentWord.word, e)}
                  className="p-1.5 text-indigo-200 hover:text-white hover:bg-indigo-500 rounded-full transition-colors"
                  title="Nghe phát âm"
                >
                  <Volume2 size={20} />
                </button>
              </div>
              <p className="font-mono text-sm">{currentWord.ipa}</p>
            </div>

            {/* Nút bấm ở vị trí bạn yêu cầu */}
            <button
              onClick={(e) => playAudio(currentWord.word, e)}
              className="mt-8 flex items-center justify-center gap-2 px-8 py-3 border-2 border-indigo-400/50 hover:border-white hover:bg-white/10 rounded-2xl transition-all text-white font-medium shadow-sm"
            >
              <Volume2 size={20} /> Nghe lại phát âm
            </button>

            <p className="absolute bottom-6 text-sm text-indigo-200">
              Chạm để quay lại
            </p>
          </div>
        </div>
      </div>

      {/* AI Features Section */}
      <div className="w-full mt-6 px-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!mnemonic && (
          <button
            onClick={generateMnemonic}
            disabled={isMnemonicLoading}
            className="w-full py-3.5 rounded-2xl border border-amber-100 bg-white text-amber-600 font-medium flex justify-center items-center gap-2 hover:bg-amber-50 hover:shadow-sm transition-all shadow-sm disabled:opacity-70"
          >
            {isMnemonicLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Lightbulb size={20} />
            )}
            ✨ Gợi ý Mẹo nhớ từ
          </button>
        )}
        {!example && (
          <button
            onClick={generateExample}
            disabled={isAiLoading}
            className="w-full py-3.5 rounded-2xl border border-indigo-100 bg-white text-indigo-600 font-medium flex justify-center items-center gap-2 hover:bg-indigo-50 hover:shadow-sm transition-all shadow-sm disabled:opacity-70"
          >
            {isAiLoading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              <Sparkles size={20} />
            )}
            ✨ Tạo câu ví dụ
          </button>
        )}
      </div>

      {/* AI Results */}
      <div className="w-full px-4 flex flex-col gap-4 mt-2">
        {mnemonic && (
          <div className="w-full p-6 rounded-2xl border border-amber-100 bg-amber-50 text-left relative overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Lightbulb size={64} />
            </div>
            <div className="flex items-center gap-2 text-amber-800 font-semibold mb-3 relative z-10">
              <Lightbulb size={18} /> Mẹo nhớ từ (Mnemonic):
            </div>
            <p className="text-slate-800 text-lg font-medium relative z-10">
              {mnemonic}
            </p>
          </div>
        )}

        {example && (
          <div className="w-full p-6 rounded-2xl border border-indigo-100 bg-indigo-50 text-left relative overflow-hidden animate-in fade-in slide-in-from-top-2">
            <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
              <Sparkles size={64} />
            </div>
            <div className="flex items-center gap-2 text-indigo-800 font-semibold mb-3 relative z-10">
              <Sparkles size={18} /> Ví dụ thực tế:
            </div>
            <p className="text-slate-800 text-lg mb-1.5 font-medium relative z-10">
              {example.english}
            </p>
            <p className="text-slate-600 relative z-10">{example.vietnamese}</p>
          </div>
        )}
      </div>

      {/* Điều hướng */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={handlePrev}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={handleNext}
          className="flex items-center justify-center w-14 h-14 rounded-full bg-white text-slate-600 shadow-sm border border-slate-100 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
}

// Function hỗ trợ kiểm tra tiếng Việt tương đối (không dấu, gần nghĩa)
function isApproximateMatch(typed, correct) {
  if (!typed || !correct) return false;
  const removeAccents = (str) => str.toLowerCase()
    .replace(/[àáạảãâăằắặẳẵâầấậẩẫ]/g, "a")
    .replace(/[èéẹẻẽêềếệểễ]/g, "e")
    .replace(/[ìíịỉĩ]/g, "i")
    .replace(/[òóọỏõôồốộổỗơờớợởỡ]/g, "o")
    .replace(/[ùúụủũưừứựửữ]/g, "u")
    .replace(/[ỳýỵỷỹ]/g, "y")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
    
  const t = removeAccents(typed);
  const c = removeAccents(correct);
  if (t === c) return true;
  
  // Tách theo dấu phẩy, chấm phẩy (để bắt được nhiều nghĩa)
  const parts = correct.split(/[,;|/]/).map(removeAccents);
  if (parts.includes(t)) return true;
  
  // Chấp nhận nếu phần nhập vào chứa 1 từ khóa có độ dài bằng 50%
  if (c.includes(t) && t.length >= c.length * 0.5 && t.length >= 3) return true;
  
  return false;
}

// --- TAB 3: BÀI KIỂM TRA ---
function QuizView({ vocabList, setIsQuizOngoing }) {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'result'
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

  // Đồng bộ trạng thái chơi với thẻ App để cảnh báo thoát
  React.useEffect(() => {
    if (setIsQuizOngoing) setIsQuizOngoing(gameState === "playing");
    return () => { if (setIsQuizOngoing) setIsQuizOngoing(false); }
  }, [gameState, setIsQuizOngoing]);

  // Autofocus tự động khi chuyển câu
  React.useEffect(() => {
    if (gameState === "playing" && !isAnswerChecked && inputRef.current) {
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 50);
    }
    
    // Tự động phát âm thanh nếu ở chế độ nghe
    if (gameState === "playing" && !isAnswerChecked && quizType.startsWith("listening")) {
      const currentQ = questions[currentQuestionIndex];
      // Thêm setTimeout ngắn để trình duyệt không block autoplay
      setTimeout(() => {
        if (currentQ && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(currentQ.wordObject.word);
          utterance.lang = "en-US";
          utterance.rate = 0.85;
          window.speechSynthesis.speak(utterance);
        }
      }, 300);
    }
  }, [currentQuestionIndex, isAnswerChecked, gameState, quizType, questions]);

  // Tạo đề kiểm tra
  const startQuiz = (isNext = false) => {
    if (vocabList.length < 4) {
      alert("Cần ít nhất 4 từ vựng để tạo bài kiểm tra trắc nghiệm!");
      return;
    }

    let nextChunk = chunkIndex;
    // Cập nhật lên chunk tiếp theo nếu người dùng chọn
    if (isNext === true) {
      nextChunk++;
      if (nextChunk * wordsPerQuiz >= vocabList.length) {
        nextChunk = 0; // Quay lại từ đầu nếu đã chạy hết danh sách
      }
      setChunkIndex(nextChunk);
    }

    const startIndex = nextChunk * wordsPerQuiz;
    const endIndex = Math.min(startIndex + wordsPerQuiz, vocabList.length);
    const chunkWords = vocabList.slice(startIndex, endIndex);

    // Xáo trộn lung tung vị trí các từ trong chunk này
    const quizWords = [...chunkWords].sort(() => 0.5 - Math.random());

    const generatedQuestions = quizWords.map((word) => {
      let promptText = word.word;
      let promptSub = word.ipa;
      let correctAnswerText = word.meaning;
      let options = [];

      if (quizType === "typing_vi_to_en") {
        promptText = word.meaning;
        promptSub = "";
        correctAnswerText = word.word;
      } else if (quizType === "multiple_choice") {
        const wrongAnswers = vocabList
          .filter((w) => w.id !== word.id)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map((w) => w.meaning);
        options = [...wrongAnswers, word.meaning].sort(() => 0.5 - Math.random());
      } else if (quizType === "listening_en_to_vi") {
        promptSub = "";
        correctAnswerText = word.meaning;
      } else if (quizType === "listening_en_to_en") {
        promptSub = "";
        correctAnswerText = word.word;
      }

      return {
        wordObject: word,
        promptText,
        promptSub,
        correctAnswerText,
        options,
        type: quizType,
        correctAnswer: word.meaning // Vẫn giữ cho tương thích cũ nếu cần
      };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setGameState("playing");
    setSelectedAnswer(null);
    setTypedAnswer("");
    setIsAnswerChecked(false);
  };

  const handleAnswerClick = (option) => {
    if (isAnswerChecked) return;

    setSelectedAnswer(option);
    setIsAnswerChecked(true);

    if (option === questions[currentQuestionIndex].correctAnswer) {
      setScore(score + 1);
    }

    // Chuyển câu hỏi sau 1.5s
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setIsAnswerChecked(false);
      } else {
        setGameState("result");
      }
    }, 1500);
  };

  const handleTypeSubmit = (e) => {
    if (e) e.preventDefault();
    if (isAnswerChecked || !typedAnswer.trim()) return;
    
    setIsAnswerChecked(true);
    const currentQ = questions[currentQuestionIndex];
    
    // Sử dụng thuật toán so sánh chuỗi gần nghĩa/tiếng Việt không dấu
    const isCorrect = isApproximateMatch(typedAnswer, currentQ.correctAnswerText);
    
    if (isCorrect) {
      setScore(score + 1);
    }
    
    setTimeout(() => {
      if (currentQuestionIndex < questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setTypedAnswer("");
        setIsAnswerChecked(false);
      } else {
        setGameState("result");
      }
    }, 2000); // Đợi 2s để người dùng kịp đọc đáp án đúng nếu sai
  };

  if (gameState === "start") {
    return (
      <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">
          Kiểm tra trắc nghiệm
        </h2>
        <p className="text-slate-600 mb-6">
          Bài kiểm tra sẽ chia từ vựng của bạn thành các nhóm nhỏ theo tiến độ. Yêu cầu danh sách có ít nhất 4 từ.
        </p>

        <div className="mb-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          <div className="flex flex-col items-start gap-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Hình thức</label>
            <select 
              value={quizType}
              onChange={(e) => setQuizType(e.target.value)}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium text-slate-700 bg-white shadow-sm cursor-pointer min-w-[200px]"
            >
              <option value="multiple_choice">Trắc nghiệm</option>
              <option value="typing_en_to_vi">Gõ từ: Anh ➔ Việt</option>
              <option value="typing_vi_to_en">Gõ từ: Việt ➔ Anh</option>
              <option value="listening_en_to_vi">Nghe ➔ Gõ Việt</option>
              <option value="listening_en_to_en">Nghe ➔ Gõ Anh</option>
            </select>
          </div>

          <div className="flex flex-col items-start gap-2">
            <label className="text-sm font-medium text-slate-500 uppercase tracking-wider">Số lượng</label>
            <select 
              value={wordsPerQuiz}
              onChange={(e) => {
                 setWordsPerQuiz(Number(e.target.value));
                 setChunkIndex(0); // Reset nhóm khi thay đổi số lượng
              }}
              className="px-4 py-2.5 border-2 border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium text-slate-700 bg-white shadow-sm cursor-pointer min-w-[150px]"
            >
              <option value={10}>10 từ</option>
              <option value={20}>20 từ</option>
              <option value={30}>30 từ</option>
              <option value={50}>50 từ</option>
              <option value={100}>100 từ</option>
              <option value={vocabList.length}>Tất cả ({vocabList.length} từ)</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => startQuiz(false)}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
            {chunkIndex > 0 ? `Kiểm tra Nhóm ${chunkIndex + 1}` : `Bắt đầu (${Math.min(wordsPerQuiz, vocabList.length)} từ)`}
          </button>
          
          {chunkIndex > 0 && (
            <button
              onClick={() => { setChunkIndex(0); setTimeout(() => startQuiz(false), 0); }}
              className="px-8 py-3 bg-white text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
            >
              Làm lại từ đầu
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameState === "result") {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">
          Kết quả của bạn
        </h2>
        <div className="text-6xl font-black text-indigo-600 my-6">
          {score} / {questions.length}
        </div>
        <p className="text-lg text-slate-600 mb-8">
          {percentage === 100
            ? "Tuyệt vời! Bạn đã nhớ tất cả."
            : percentage >= 70
              ? "Rất tốt! Tiếp tục phát huy nhé."
              : "Cố gắng hơn nữa nhé! Ôn lại Flashcard sẽ giúp ích đấy."}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => startQuiz(false)}
            className="px-8 py-3 bg-white text-indigo-600 font-medium rounded-xl border border-indigo-200 hover:bg-indigo-50 transition-colors shadow-sm"
          >
            Làm lại nhóm từ hiện tại
          </button>
          
          <button
            onClick={() => startQuiz(true)}
            className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
          >
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
        <span className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
          Câu {currentQuestionIndex + 1} / {questions.length}
        </span>
        <span className="text-sm text-slate-500 font-medium">
          Điểm: {score}
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center mb-6">
        <div className="flex justify-center items-center gap-3 mb-2">
          {currentQ.type.startsWith("listening") ? (
             <button
              onClick={(e) => {
                if (e) e.preventDefault();
                if ("speechSynthesis" in window) {
                  window.speechSynthesis.cancel();
                  const utterance = new SpeechSynthesisUtterance(currentQ.wordObject?.word);
                  utterance.lang = "en-US";
                  utterance.rate = 0.85;
                  window.speechSynthesis.speak(utterance);
                }
              }}
              className="p-6 text-white bg-indigo-500 hover:bg-indigo-600 rounded-full transition-transform hover:scale-105 active:scale-95 cursor-pointer shadow-lg shadow-indigo-200 animate-pulse"
              title="Nghe lại"
            >
              <Volume2 size={48} />
            </button>
          ) : (
            <>
              <h3 className="text-4xl font-bold text-slate-800">
                {currentQ.promptText || currentQ.wordObject?.word}
              </h3>
              {currentQ.type !== "typing_vi_to_en" && (
                <button
                  onClick={(e) => {
                    if (e) e.preventDefault();
                    if ("speechSynthesis" in window) {
                      window.speechSynthesis.cancel();
                      const utterance = new SpeechSynthesisUtterance(currentQ.wordObject?.word || currentQ.promptText);
                      utterance.lang = "en-US";
                      utterance.rate = 0.85;
                      window.speechSynthesis.speak(utterance);
                    }
                  }}
                  className="p-2 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors cursor-pointer"
                  title="Nghe phát âm"
                >
                  <Volume2 size={28} />
                </button>
              )}
            </>
          )}
        </div>
        {currentQ.promptSub && !currentQ.type.startsWith("listening") && (
          <p className="text-slate-500 font-mono">{currentQ.promptSub}</p>
        )}
        <p className="text-sm text-slate-400 mt-6">
          {currentQ.type === "multiple_choice" ? "Chọn nghĩa đúng của từ trên" : currentQ.type.startsWith("listening") ? "Nghe và gõ lại đáp án chính xác" : "Gõ đáp án chính xác"}
        </p>
      </div>

      {currentQ.type === "multiple_choice" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {currentQ.options.map((option, index) => {
            let btnClass =
              "bg-white border-2 border-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50";

            if (isAnswerChecked) {
              if (option === currentQ.correctAnswerText || option === currentQ.correctAnswer) {
                btnClass =
                  "bg-green-100 border-2 border-green-500 text-green-800 font-medium";
              } else if (option === selectedAnswer) {
                btnClass = "bg-red-100 border-2 border-red-500 text-red-800";
              } else {
                btnClass =
                  "bg-white border-2 border-slate-100 text-slate-400 opacity-50";
              }
            }

            return (
              <button
                key={index}
                onClick={() => handleAnswerClick(option)}
                disabled={isAnswerChecked}
                className={`p-4 rounded-xl text-lg transition-all duration-200 w-full text-center ${btnClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      ) : (
        <form onSubmit={handleTypeSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            ref={inputRef}
            value={typedAnswer}
            onChange={(e) => setTypedAnswer(e.target.value)}
            disabled={isAnswerChecked}
            autoFocus
            className={`w-full p-4 rounded-xl border-2 text-center text-xl font-medium focus:outline-none transition-colors ${
              isAnswerChecked 
                ? (isApproximateMatch(typedAnswer, currentQ.correctAnswerText) 
                    ? "border-green-500 bg-green-50 text-green-800 focus:border-green-500" 
                    : "border-red-500 bg-red-50 text-red-800 focus:border-red-500")
                : "border-slate-200 focus:border-indigo-500 bg-white text-slate-800"
            }`}
            placeholder="Gõ câu trả lời vào đây..."
          />
          
          {isAnswerChecked && !isApproximateMatch(typedAnswer, currentQ.correctAnswerText) && (
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-center animate-in fade-in slide-in-from-top-2">
              <p className="text-sm mb-1 opacity-80">Đáp án đúng là:</p>
              <div className="flex justify-center items-center gap-2">
                <p className="font-bold text-2xl">{currentQ.correctAnswerText}</p>
                {currentQ.type === "typing_vi_to_en" || currentQ.type.startsWith("listening") ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      if (e) e.preventDefault();
                      if ("speechSynthesis" in window) {
                        window.speechSynthesis.cancel();
                        const utterance = new SpeechSynthesisUtterance(currentQ.wordObject?.word);
                        utterance.lang = "en-US";
                        utterance.rate = 0.85;
                        window.speechSynthesis.speak(utterance);
                      }
                    }}
                    className="p-1.5 text-amber-600 hover:text-amber-800 hover:bg-amber-100 rounded-full transition-colors cursor-pointer"
                    title="Nghe phát âm"
                  >
                    <Volume2 size={24} />
                  </button>
                ) : null}
              </div>
            </div>
          )}
          
          <button
            type="submit"
            disabled={isAnswerChecked || !typedAnswer.trim()}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            Xác nhận
          </button>
        </form>
      )}
    </div>
  );
}
