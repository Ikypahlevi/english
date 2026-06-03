import React, { useState, useEffect } from "react";
import { Trophy, Medal, Flame, Loader2, ArrowLeft } from "lucide-react";
import axios from "axios";
import { API_BASE } from "../utils/api.js";
import { showToast } from "../utils/toast.jsx";

export default function LeaderboardView() {
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API_BASE}/stats/leaderboard`);
      if (data.success) {
        setLeaders(data.data);
      }
    } catch (err) {
      showToast("Lỗi tải bảng xếp hạng", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up max-w-3xl mx-auto pb-20">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-[2rem] p-8 sm:p-10 text-white mb-8 shadow-2xl shadow-orange-500/20 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">Bảng Vàng Thành Tích</h2>
            <p className="text-orange-100 font-medium text-lg">
              Đua top nhận học bổng và danh hiệu cao quý
            </p>
          </div>
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/20 rotate-3 hover:rotate-6 transition-transform">
            <Trophy size={40} className="text-white" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-20 text-center">
             {/* Skeleton loaders implemented here for VIP feel */}
             <div className="space-y-4 px-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-slate-200 dark:bg-slate-800 rounded-xl animate-pulse"></div>
                ))}
             </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {leaders.map((user, idx) => (
              <div key={user.user_id} className={`p-5 flex items-center gap-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${idx < 3 ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''}`}>
                <div className="w-12 h-12 flex-shrink-0 flex items-center justify-center font-bold text-lg rounded-2xl">
                  {idx === 0 ? <Medal size={28} className="text-yellow-500" /> :
                   idx === 1 ? <Medal size={28} className="text-slate-400" /> :
                   idx === 2 ? <Medal size={28} className="text-amber-600" /> :
                   <span className="text-slate-400">{idx + 1}</span>}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-lg">{user.email}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm">
                    <span className="text-brand-500 font-medium flex items-center gap-1">
                      <Trophy size={14} /> {user.xp} XP
                    </span>
                    <span className="text-orange-500 font-medium flex items-center gap-1">
                      <Flame size={14} /> {user.streak_days} chuỗi ngày
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
