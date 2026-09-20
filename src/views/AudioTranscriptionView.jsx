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

export default function AudioTranscriptionView() {
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
      if (selected.size > 50 * 1024 * 1024) {
        showToast("File quá lớn (tối đa 50MB)", "error");
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