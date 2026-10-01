import React, { useState, useEffect } from "react";
import axios, { API_BASE } from "../../utils/api";
import { Users, BookOpen, Layout, Zap, Loader2 } from "lucide-react";

export default function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin/stats`);
      if (res.data.success) {
        setStats(res.data.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-rose-500" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tổng quan Hệ thống</h1>
      
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Tổng Người dùng" value={stats?.users.total} icon={Users} color="bg-blue-500" />
        <StatCard title="Đang trực tuyến (Hôm nay)" value={stats?.users.activeToday} icon={Zap} color="bg-emerald-500" />
        <StatCard title="Tổng Chủ đề" value={stats?.content.topics} icon={Layout} color="bg-brand-500" />
        <StatCard title="Tổng Từ vựng" value={stats?.content.vocab} icon={BookOpen} color="bg-violet-500" />
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }) {
  return (
    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${color} shadow-lg`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white">{value || 0}</p>
      </div>
    </div>
  );
}
