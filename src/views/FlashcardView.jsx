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

export default function FlashcardView({ vocabList, onBack, addXP, updateSRS, onComplete }) {
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
      
      <div className="flip-card w-full h-[400px] sm:h-[480px] cursor-pointer mb-10 group" onClick={() => { playSound('flip'); setIsFlipped(!isFlipped); }}>
        <div className={`flip-inner w-full h-full ${isFlipped ? "flipped" : ""}`}>
          <div className="flip-front bg-white dark:bg-slate-900 rounded-[2rem] border-2 border-slate-100 dark:border-slate-800 flex flex-col items-center justify-center shadow-2xl shadow-brand-500/10 relative overflow-hidden group-hover:border-brand-300 transition-colors">
            <div className="absolute inset-0 opacity-5 dark:opacity-10 pointer-events-none">
              <img 
                src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(currentWord.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=800&height=600&nologo=true`} 
                alt="bg" 
                className="w-full h-full object-cover blur-xl scale-110"
                onError={(e) => e.target.style.display = 'none'}
              />
            </div>
            <div className="relative z-10 flex flex-col items-center justify-center w-full px-4 h-full pb-10">
              <div className="w-28 h-28 sm:w-40 sm:h-40 mb-6 rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 bg-slate-100 dark:bg-slate-800 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500">
                 <img 
                  src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(currentWord.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=400&height=400&nologo=true`} 
                  alt={currentWord.word} 
                  className="w-full h-full object-cover text-xs text-slate-400 flex items-center justify-center text-center"
                  loading="lazy"
                  onError={(e) => e.target.parentElement.style.display = 'none'}
                />
              </div>
              <div className="flex items-center gap-4 mb-3">
                <h2 className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight text-center break-words max-w-full px-2">{currentWord.word}</h2>
                <button onClick={(e) => { e.stopPropagation(); speakWord(currentWord.word); }} className="w-12 h-12 sm:w-14 sm:h-14 shrink-0 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center hover:bg-brand-100 dark:hover:bg-brand-800 hover:scale-110 transition-all shadow-md" title="Nghe phát âm">
                  <Volume2 size={24} />
                </button>
              </div>
              {currentWord.ipa && <p className="text-brand-500 font-mono text-lg sm:text-xl bg-brand-50 dark:bg-slate-800 px-4 py-1.5 rounded-xl inline-block font-medium mb-4">{currentWord.ipa}</p>}
            </div>
            <p className="absolute bottom-4 inset-x-0 text-sm text-slate-400 dark:text-slate-500 font-semibold z-10 animate-bounce">Nhấn Space để lật</p>
          </div>
          <div className="flip-back bg-gradient-to-br from-brand-600 to-brand-500 rounded-[2rem] flex flex-col justify-center items-center text-white shadow-2xl relative border-4 border-brand-400/30 overflow-y-auto p-6">
            <h2 className="text-3xl sm:text-5xl font-black text-center leading-tight">{currentWord.meaning}</h2>
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