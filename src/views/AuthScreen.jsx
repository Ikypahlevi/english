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

import { z } from "zod";

const authSchema = z.object({
  email: z.string().min(1, "Email không được để trống").email("Email không đúng định dạng"),
  password: z.string().min(6, "Mật khẩu phải chứa ít nhất 6 ký tự").max(50, "Mật khẩu không được vượt quá 50 ký tự")
});

export default function AuthScreen({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [formErrors, setFormErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setFormErrors({});
    
    try {
      // Zod Validation ở Client
      authSchema.parse({ email, password });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const errors = {};
        err.errors.forEach(e => errors[e.path[0]] = e.message);
        setFormErrors(errors);
        return; // Dừng lại nếu form lỗi
      }
    }

    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const res = await axios.post(`${API_BASE}${endpoint}`, { email, password });
      if (res.data.success) {
        localStorage.setItem("engmaster-token", res.data.token);
        localStorage.setItem("engmaster-user", JSON.stringify(res.data.user));
        showToast(res.data.message, "success");
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      if (err.response?.data?.errors) {
        setError(err.response.data.errors.join(' | '));
      } else {
        setError(err.response?.data?.message || "Đã có lỗi xảy ra");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-8 animate-scale-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-brand-500/30">
            <GraduationCap size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">EngMaster</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Đăng nhập để lưu tiến độ học tập</p>
        </div>

        {error && (
          <div className="p-3 mb-6 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 text-sm font-medium border border-rose-200 dark:border-rose-800/50 flex items-center gap-2">
            <XCircle size={16} /> {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Email</label>
            <input type="email" value={email} onChange={e => {setEmail(e.target.value); setFormErrors(prev => ({...prev, email: null}))}} required
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl focus:outline-none font-medium text-slate-900 dark:text-white ${formErrors.email ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-brand-500'}`} 
              placeholder="user@example.com" />
            {formErrors.email && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><XCircle size={12}/> {formErrors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Mật khẩu</label>
            <input type="password" value={password} onChange={e => {setPassword(e.target.value); setFormErrors(prev => ({...prev, password: null}))}} required
              className={`w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 rounded-2xl focus:outline-none font-medium text-slate-900 dark:text-white ${formErrors.password ? 'border-rose-500 focus:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus:border-brand-500'}`} 
              placeholder="••••••••" />
            {formErrors.password && <p className="text-rose-500 text-xs mt-1.5 flex items-center gap-1"><XCircle size={12}/> {formErrors.password}</p>}
          </div>
          
          <button type="submit" disabled={loading}
            className="vip-btn w-full py-4 mt-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-2xl hover:from-brand-700 hover:to-brand-600 transition-all shadow-lg shadow-brand-500/40 disabled:opacity-50 flex items-center justify-center overflow-hidden relative">
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? "Đăng nhập" : "Đăng ký")}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-medium text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
            {isLogin ? "Chưa có tài khoản? Đăng ký ngay" : "Đã có tài khoản? Đăng nhập"}
          </button>
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-red-50 text-red-600 rounded-xl m-4 border border-red-200 shadow-sm">
          <h2 className="text-xl font-bold mb-2">Đã xảy ra lỗi (Crash)</h2>
          <pre className="text-sm whitespace-pre-wrap font-mono bg-white p-4 rounded border border-red-100 overflow-auto max-h-96">
            {this.state.error && this.state.error.toString()}
            {"\n\n"}
            {this.state.error && this.state.error.stack}
          </pre>
          <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded font-medium hover:bg-red-700">Tải lại trang</button>
        </div>
      );
    }
    return this.props.children;
  }
}