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

// Dữ liệu mẫu dựa trên hình ảnh được cung cấp
const defaultVocab = [
  { id: 1, word: "Good", ipa: "/gʊd/", meaning: "Tốt" },
  { id: 2, word: "Thing", ipa: "/θɪŋ/", meaning: "Thứ, đồ vật" },
  { id: 3, word: "Task", ipa: "/tæsk/", meaning: "Nhiệm vụ" },
  { id: 4, word: "Manager", ipa: "/ˈmænɪdʒər/", meaning: "Người quản lý" },
  { id: 5, word: "Hotel", ipa: "/hoʊˈtɛl/", meaning: "Khách sạn" },
  { id: 6, word: "Bank", ipa: "/bæŋk/", meaning: "Ngân hàng" },
  { id: 7, word: "Book", ipa: "/bʊk/", meaning: "Quyển sách" },
  { id: 8, word: "Year", ipa: "/jɪər/", meaning: "Năm" },
  { id: 9, word: "Museum", ipa: "/mjuˈziːəm/", meaning: "Bảo tàng" },
  { id: 10, word: "People", ipa: "/ˈpiːpəl/", meaning: "Con người" },
];

export default function App() {
  const [vocabList, setVocabList] = useState(defaultVocab);
  const [activeTab, setActiveTab] = useState("list"); // 'list', 'flashcard', 'quiz'
  const [isXlsxLoaded, setIsXlsxLoaded] = useState(false);
  const [readSheets, setReadSheets] = useState([]);

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
      
      const newVocab = [];
      const freshlyReadSheets = [];
      const sheetNamesAdded = [];

      // Lặp qua tất cả các sheet theo thứ tự
      for (const wsname of wb.SheetNames) {
        const sheetKey = `${file.name}_${wsname}`;
        
        // Bỏ qua nếu sheet này đã đọc ròi
        if (readSheets.includes(sheetKey)) {
          continue;
        }

        const ws = wb.Sheets[wsname];
        // Chuyển đổi sheet thành mảng các mảng (array of arrays)
        const data = window.XLSX.utils.sheet_to_json(ws, { header: 1 });
        let addedFromThisSheet = false;

        // Bắt đầu từ dòng 1 (bỏ qua dòng 0 là Header: STT, Tiếng Anh, IPA, Tiếng Việt)
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (row && row.length >= 4 && row[1]) {
            // Đảm bảo có cột Tiếng Anh (cột B - index 1)
            newVocab.push({
              id: Date.now() + newVocab.length + i,
              word: row[1] ? row[1].toString().trim() : "",
              ipa: row[2] ? row[2].toString().trim() : "",
              meaning: row[3] ? row[3].toString().trim() : "",
            });
            addedFromThisSheet = true;
          }
        }

        freshlyReadSheets.push(sheetKey);
        if (addedFromThisSheet) {
          sheetNamesAdded.push(wsname);
          break; // Dừng lại sau khi thêm thành công 1 sheet
        }
      }

      if (newVocab.length > 0) {
        setVocabList([...vocabList, ...newVocab]);
        setReadSheets([...readSheets, ...freshlyReadSheets]);
        alert(`Đã thêm thành công ${newVocab.length} từ vựng từ khối dữ liệu mới: ${sheetNamesAdded.join(", ")}`);
      } else if (freshlyReadSheets.length === 0) {
        alert("Tất cả các sheet trong file này đều đã được đọc trước đó!");
      } else {
        setReadSheets([...readSheets, ...freshlyReadSheets]);
        alert(
          "Không tìm thấy dữ liệu hợp lệ trong các sheet mới. Vui lòng đảm bảo file Excel có cấu trúc cột: STT | Tiếng Anh | IPA | Tiếng Việt",
        );
      }
      // Reset input
      e.target.value = null;
    };
    reader.readAsBinaryString(file);
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
              onClick={() => setActiveTab("list")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "list" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <BookOpen size={18} /> Từ vựng
            </button>
            <button
              onClick={() => setActiveTab("flashcard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === "flashcard" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              <Layers size={18} /> Flashcards
            </button>
            <button
              onClick={() => setActiveTab("quiz")}
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
            {activeTab === "quiz" && <QuizView vocabList={vocabList} />}
          </>
        )}
      </main>
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

// --- TAB 3: BÀI KIỂM TRA ---
function QuizView({ vocabList }) {
  const [gameState, setGameState] = useState("start"); // 'start', 'playing', 'result'
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState([]);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isAnswerChecked, setIsAnswerChecked] = useState(false);

  // Tạo đề kiểm tra
  const startQuiz = () => {
    if (vocabList.length < 4) {
      alert("Cần ít nhất 4 từ vựng để tạo bài kiểm tra trắc nghiệm!");
      return;
    }

    // Chọn ngẫu nhiên 50 từ (hoặc ít hơn nếu danh sách nhỏ)
    const numQuestions = Math.min(50, vocabList.length);
    const shuffledList = [...vocabList].sort(() => 0.5 - Math.random());
    const quizWords = shuffledList.slice(0, numQuestions);

    const generatedQuestions = quizWords.map((word) => {
      // Lấy 3 đáp án sai ngẫu nhiên
      const wrongAnswers = vocabList
        .filter((w) => w.id !== word.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3)
        .map((w) => w.meaning);

      const options = [...wrongAnswers, word.meaning].sort(
        () => 0.5 - Math.random(),
      );

      return {
        word: word,
        options: options,
        correctAnswer: word.meaning,
      };
    });

    setQuestions(generatedQuestions);
    setCurrentQuestionIndex(0);
    setScore(0);
    setGameState("playing");
    setSelectedAnswer(null);
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

  if (gameState === "start") {
    return (
      <div className="max-w-xl mx-auto text-center bg-white p-10 rounded-2xl shadow-sm border border-slate-100">
        <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 size={40} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-4">
          Kiểm tra trắc nghiệm
        </h2>
        <p className="text-slate-600 mb-8">
          Bài kiểm tra sẽ chọn ngẫu nhiên các từ vựng trong danh sách của bạn để
          ôn tập. Yêu cầu danh sách có ít nhất 4 từ.
        </p>
        <button
          onClick={startQuiz}
          className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
        >
          Bắt đầu kiểm tra
        </button>
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
        <button
          onClick={startQuiz}
          className="px-8 py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200"
        >
          Làm lại bài kiểm tra
        </button>
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
        <h3 className="text-4xl font-bold text-slate-800 mb-2">
          {currentQ.word.word}
        </h3>
        {currentQ.word.ipa && (
          <p className="text-slate-500 font-mono">{currentQ.word.ipa}</p>
        )}
        <p className="text-sm text-slate-400 mt-6">
          Chọn nghĩa đúng của từ trên
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {currentQ.options.map((option, index) => {
          let btnClass =
            "bg-white border-2 border-slate-100 text-slate-700 hover:border-indigo-300 hover:bg-indigo-50";

          if (isAnswerChecked) {
            if (option === currentQ.correctAnswer) {
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
    </div>
  );
}
