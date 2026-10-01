import React, { useState } from "react";
import { LayoutDashboard, Users, Settings, Database, ArrowLeft } from "lucide-react";
import AdminOverview from "./AdminOverview";
import AdminUserManager from "./AdminUserManager";
import AdminContentManager from "./AdminContentManager";
import AdminSettings from "./AdminSettings";

export default function AdminLayout({ user, onBackToApp }) {
  const [activeTab, setActiveTab] = useState("overview");

  const tabs = [
    { id: "overview", label: "Tổng quan", icon: LayoutDashboard },
    { id: "users", label: "Quản lý Người dùng", icon: Users },
    { id: "system", label: "Dữ liệu Hệ thống", icon: Database },
    { id: "settings", label: "Cài đặt", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 -mx-4 md:-mx-6 -mt-6">
      {/* Sidebar */}
      <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col hidden md:flex">
        <div className="p-6 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-xl font-black bg-gradient-to-r from-rose-600 to-rose-400 bg-clip-text text-transparent">Admin Panel</h2>
        </div>
        <div className="p-4 flex-1 space-y-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  isActive
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                    : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
                }`}
              >
                <Icon size={18} />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={onBackToApp}
            className="w-full flex items-center gap-2 px-4 py-3 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium transition-all"
          >
            <ArrowLeft size={18} />
            Thoát Admin
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <h2 className="font-bold text-rose-500">Admin Panel</h2>
          <select 
            value={activeTab} 
            onChange={(e) => setActiveTab(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-sm font-medium p-2"
          >
            {tabs.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-10">
          <div className="max-w-6xl mx-auto animate-fade-in">
            {activeTab === "overview" && <AdminOverview />}
            {activeTab === "users" && <AdminUserManager currentUser={user} />}
            {activeTab === "system" && <AdminContentManager />}
            {activeTab === "settings" && <AdminSettings />}
          </div>
        </div>
      </div>
    </div>
  );
}
