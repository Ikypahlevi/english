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
import axios, { API_BASE } from "../utils/api.js";
import { playSound, speakWord } from "../utils/audio.js";
import { showToast, ToastContainer } from "../utils/toast.jsx";
import useDarkMode from "../hooks/useDarkMode.js";

export default function IntegratedQuizView({ vocabList, setIsQuizOngoing, onBack, addXP, updateSRS, onComplete }) {
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
    
    // Tìm các đáp án hợp lệ từ danh sách từ vựng (từ đồng nghĩa / các nghĩa khác của cùng 1 từ)
    let validTargets = [];
    if (isEnglishInput) {
      validTargets = vocabList.filter(v => normalizeStr(v.meaning) === normalizeStr(q.meaning)).map(v => v.word);
    } else {
      validTargets = vocabList.filter(v => normalizeStr(v.word) === normalizeStr(q.word)).map(v => v.meaning);
    }
    if (!validTargets.includes(targetStr)) validTargets.push(targetStr);

    const normInput = normalizeStr(input);

    const checkWordsMatch = (str1, str2) => {
      if (!str1 || !str2) return false;
      return str1.split(' ').sort().join(' ') === str2.split(' ').sort().join(' ');
    };

    const checkAgainstTarget = (tStr) => {
      const nTarget = normalizeStr(tStr);
      const tParts = tStr.split(/[,|;]/).map(normalizeStr);
      return (normInput === nTarget || tParts.includes(normInput) || checkWordsMatch(normInput, nTarget) || tParts.some(part => checkWordsMatch(normInput, part)));
    };

    let matchFound = false;
    for (const tStr of validTargets) {
      if (checkAgainstTarget(tStr)) {
        isCorrect = true;
        resultFeedback = { isCorrect: true, reason: "Đúng (Khớp chính xác)", userAnswer: input.trim() };
        matchFound = true;
        break;
      }
    }

    if (!matchFound) {
      try {
        // Dùng AI chấm cho các trường hợp từ đồng nghĩa/nghĩa khác (nếu API hoạt động)
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
        // Fallback: Kiểm tra xem input có nằm trong bất kỳ target hợp lệ nào không
        let fallbackCorrect = false;
        for (const tStr of validTargets) {
          const nTarget = normalizeStr(tStr);
          if (nTarget.includes(normInput) && normInput.length >= 3) {
            fallbackCorrect = true;
            break;
          }
        }
        isCorrect = fallbackCorrect;
        resultFeedback = { isCorrect, reason: isCorrect ? "Chấp nhận (Gần đúng)" : `Sai. Đáp án đúng: ${targetStr}`, userAnswer: input.trim() };
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
        <div className="mt-6 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800/50 rounded-2xl p-5 sm:p-6 animate-scale-in text-center shadow-lg">
          <div className="flex flex-col items-center justify-center gap-1">
            <XCircle size={48} className="text-red-500 mb-1" />
            <h3 className="text-xl font-black text-red-700 dark:text-red-400">Chưa đúng rồi</h3>
            {q.qType !== 'multiple-choice' && (
              <div className="text-red-900 dark:text-red-200 font-medium text-base mt-2">
                Đáp án đúng: <span className="font-black text-xl ml-1">{(q.qType === 'typing-vi-en' || q.qType === 'listen-vi') ? q.word : q.meaning}</span>
              </div>
            )}
            <p className="text-sm font-medium text-red-600/80 dark:text-red-400/80 mt-1">{feedback.reason}</p>
            
            <button 
              onClick={() => nextQuestion()} 
              className="mt-5 py-3 px-10 rounded-xl font-bold text-lg bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 transition-all hover:-translate-y-1"
            >
              Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>
  );
}