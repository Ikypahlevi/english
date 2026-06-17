import React from "react";
import { Zap, Flame, BookOpen, Layers } from "lucide-react";
import LeaderboardView from "./LeaderboardView.jsx";

export default function DashboardView({ userStats, totalTopics, totalVocab }) {
  return (
    <div className="animate-slide-up max-w-5xl mx-auto pb-20">
      <div className="mb-8">
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 dark:text-white mb-6">Tổng quan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Zap size={24} className="fill-amber-500 text-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] animate-pulse-slow" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">Tổng điểm XP</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{userStats.xp || 0}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 bg-orange-50 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Flame size={24} className="fill-orange-500 text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)] animate-pulse-slow" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">Chuỗi ngày</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{userStats.streak_days || 0}</p>
          </div>
          
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <BookOpen size={24} className="text-brand-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">Số chủ đề</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{totalTopics}</p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:shadow-brand-500/10 transition-all hover:-translate-y-1 group">
            <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
              <Layers size={24} className="text-purple-500" />
            </div>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mb-1">Từ vựng đã lưu</p>
            <p className="text-2xl sm:text-3xl font-black text-slate-800 dark:text-white">{totalVocab}</p>
          </div>
        </div>
      </div>

      <div className="mt-12">
        <LeaderboardView />
      </div>
    </div>
  );
}
