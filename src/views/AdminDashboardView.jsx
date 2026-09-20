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

export default function AdminDashboardView() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  const fetchUsers = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users?page=${pageNumber}&limit=10`);
      if (res.data.success) {
        setUsers(res.data.data);
        setTotalPages(res.data.pagination?.totalPages || 1);
        setTotalUsers(res.data.pagination?.total || res.data.data.length);
      }
    } catch (e) {
      showToast("Lỗi tải danh sách người dùng", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id, email) => {
    if (!confirm(`Bạn có chắc muốn xóa người dùng ${email}? Mọi dữ liệu của họ sẽ bị mất.`)) return;
    try {
      const res = await axios.delete(`${API_BASE}/admin/users/${id}`);
      if (res.data.success) {
        showToast("Đã xóa người dùng", "success");
        setUsers(users.filter(u => u.user_id !== id));
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Lỗi xóa người dùng", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6 animate-pulse max-w-2xl mx-auto mt-10">
        <div className="h-10 bg-slate-200 dark:bg-slate-800 rounded-xl w-1/3 mx-auto"></div>
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-2xl w-full"></div>
        <div className="flex justify-center gap-4">
           <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
           <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-xl w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Quản Trị Hệ Thống</h2>
        <p className="text-slate-500 mt-1">Tổng cộng: {users.length} người dùng</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Email</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Quyền</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">XP</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Ngày Chuỗi</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">{u.email}</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.role === 'admin' ? 'bg-rose-100 text-rose-600' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-amber-500 font-bold">{u.xp || 0}</td>
                  <td className="py-3.5 px-5 text-orange-500 font-bold">{u.streak_days || 0}</td>
                  <td className="py-3.5 px-5 text-right">
                    {u.role !== 'admin' && (
                      <button onClick={() => handleDeleteUser(u.user_id, u.email)} className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}