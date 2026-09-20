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
import ChatRoleplayView from "../views/ChatRoleplayView.jsx";

export default function FlashcardQuizWrapper({ topics, mode, setIsQuizOngoing, addXP }) {
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