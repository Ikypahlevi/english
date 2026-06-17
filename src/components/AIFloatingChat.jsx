import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2, Bot, Trash2 } from "lucide-react";
import axios from "axios";
import { showToast } from "../utils/toast.jsx";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api";

export default function AIFloatingChat({ user }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "model", content: "Hi there! I'm your AI English Tutor. We can talk about anything. How are you today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg = { role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const payload = { messages: [...messages, userMsg], selectedTopic: "" };
      const res = await axios.post(`${API_BASE}/ai/chat`, payload, {
        headers: { Authorization: `Bearer ${localStorage.getItem('engmaster-token')}` }
      });
      if (res.data.success) {
        setMessages(prev => [...prev, { role: "model", content: res.data.text }]);
      }
    } catch (e) {
      showToast("Lỗi kết nối AI", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    if (window.confirm("Xóa toàn bộ cuộc hội thoại?")) {
      setMessages([{ role: "model", content: "Hi there! I'm your AI English Tutor. We can talk about anything. How are you today?" }]);
    }
  };

  if (!user) return null;

  return (
    <>
      {!isOpen && (
        <button 
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-gradient-to-r from-brand-600 to-brand-500 rounded-full text-white flex items-center justify-center shadow-2xl shadow-brand-500/40 hover:scale-110 transition-transform z-50 group"
        >
          <MessageSquare size={28} className="group-hover:animate-pulse" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-[90vw] max-w-sm md:w-[400px] h-[500px] max-h-[70vh] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50 border border-slate-200 dark:border-slate-800 animate-slide-up">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 p-4 flex items-center justify-between text-white shadow-md z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">AI Tutor</h3>
                <p className="text-xs text-brand-100">Đang hoạt động</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClear} className="p-2 hover:bg-white/20 rounded-xl transition-colors" title="Xóa hội thoại">
                <Trash2 size={18} />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-slate-950">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                  <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                    <Bot size={16} className="text-brand-600 dark:text-brand-400" />
                  </div>
                )}
                <div className={`px-4 py-3 rounded-2xl max-w-[80%] ${
                  msg.role === 'user' 
                    ? 'bg-brand-600 text-white rounded-tr-sm shadow-md' 
                    : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm shadow-sm border border-slate-100 dark:border-slate-700'
                }`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center mr-2">
                  <Bot size={16} className="text-brand-600" />
                </div>
                <div className="px-4 py-3 bg-white dark:bg-slate-800 rounded-2xl rounded-tl-sm border border-slate-100 dark:border-slate-700 flex items-center gap-2 shadow-sm">
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800">
            <form onSubmit={e => { e.preventDefault(); handleSend(); }} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Nhắn tin với AI..."
                className="flex-1 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/50 dark:text-white"
              />
              <button 
                type="submit" 
                disabled={!input.trim() || isLoading}
                className="w-12 h-12 bg-brand-600 hover:bg-brand-700 text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors shrink-0"
              >
                <Send size={20} className={input.trim() ? "ml-1" : ""} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
