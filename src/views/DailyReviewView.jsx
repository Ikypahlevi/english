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
import FlashcardView from "../views/FlashcardView.jsx";
import IntegratedQuizView from "../views/IntegratedQuizView.jsx";

export default function DailyReviewView({ addXP, setIsQuizOngoing }) {
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