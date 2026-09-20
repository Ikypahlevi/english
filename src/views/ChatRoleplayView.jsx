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

export default function ChatRoleplayView({ vocabList, onBack, addXP }) {
  const [messages, setMessages] = useState([
    { role: 'ai', text: `Hi there! We are going to practice English. Try to use as many words from your vocabulary list as possible. Ready?` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [usedWords, setUsedWords] = useState(new Set());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    const newMessages = [...messages, { role: 'user', text: userMessage }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Check for used vocabulary words
    let newUsedWords = new Set(usedWords);
    let matchedWordsCount = 0;
    const userTextLower = userMessage.toLowerCase();
    
    vocabList.forEach(v => {
      const wordLower = v.word.toLowerCase();
      if (!usedWords.has(wordLower) && userTextLower.includes(wordLower)) {
        newUsedWords.add(wordLower);
        matchedWordsCount++;
      }
    });

    if (matchedWordsCount > 0) {
      setUsedWords(newUsedWords);
      addXP(matchedWordsCount * 10);
      showToast(`+${matchedWordsCount * 10} XP (Sử dụng đúng ${matchedWordsCount} từ mới!)`, "success");
    }

    try {
      const res = await axios.post(`${API_BASE}/chat/roleplay`, {
        messages: newMessages,
        vocabList: vocabList,
        topicName: "Practice English Conversation"
      });
      if (res.data.success) {
        setMessages([...newMessages, { role: 'ai', text: res.data.text }]);
      }
    } catch (err) {
      showToast("Lỗi kết nối AI", "error");
      setMessages([...newMessages, { role: 'ai', text: "Sorry, I am having trouble connecting to my brain. Please try again later." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const progress = Math.round((usedWords.size / vocabList.length) * 100) || 0;

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[80vh]">
      <div className="mb-4 flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <button onClick={onBack} className="text-slate-500 hover:text-brand-500 flex items-center gap-1 font-medium"><ArrowLeft size={16}/> Thoát</button>
        <div className="flex flex-col items-end">
          <span className="font-bold text-slate-700 dark:text-slate-300 text-sm">Mục tiêu: Dùng từ vựng ({usedWords.size}/{vocabList.length})</span>
          <div className="w-32 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1">
            <div className="h-full bg-brand-500 rounded-full transition-all" style={{width: `${progress}%`}}/>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 mb-4 flex flex-col">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] p-4 rounded-2xl ${msg.role === 'user' ? 'bg-brand-500 text-white rounded-br-sm' : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm'}`}>
              {msg.text}
            </div>
            {msg.role === 'ai' && (
              <button onClick={() => speakWord(msg.text)} className="ml-2 mt-auto p-2 text-slate-400 hover:text-brand-500 self-end">
                <Volume2 size={16} />
              </button>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[75%] p-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
              <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl mb-2 overflow-x-auto whitespace-nowrap scrollbar-hide">
          <span className="text-xs font-bold text-slate-500 py-1 pl-1">Từ cần dùng:</span>
          {vocabList.map((v, i) => {
            const isUsed = usedWords.has(v.word.toLowerCase());
            return (
              <span key={i} className={`text-xs px-2 py-1 rounded-md border font-medium ${isUsed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}>
                {v.word}
              </span>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Gõ tin nhắn tiếng Anh của bạn..."
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 text-slate-900 dark:text-white"
            disabled={loading}
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="p-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 transition-all">
            <MessageSquare size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}