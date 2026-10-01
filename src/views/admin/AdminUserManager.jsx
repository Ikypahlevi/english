import React, { useState, useEffect } from "react";
import axios, { API_BASE } from "../../utils/api";
import { showToast } from "../../utils/toast";
import { Trash2, Shield, ShieldAlert, Lock, Unlock, Search, Loader2 } from "lucide-react";

export default function AdminUserManager({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchUsers(page);
  }, [page]);

  const fetchUsers = async (pageNumber) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/admin/users?page=${pageNumber}&limit=20`);
      if (res.data.success) {
        setUsers(res.data.data);
      }
    } catch (e) {
      showToast("Lỗi tải danh sách người dùng", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (id, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Xác nhận đổi quyền thành ${newRole.toUpperCase()}?`)) return;
    try {
      const res = await axios.patch(`${API_BASE}/admin/users/${id}/role`, { role: newRole });
      if (res.data.success) {
        setUsers(users.map(u => u.user_id === id ? { ...u, role: newRole } : u));
        showToast(res.data.message, "success");
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Lỗi cập nhật", "error");
    }
  };

  const handleUpdateStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'banned' : 'active';
    if (!confirm(`Xác nhận ${newStatus === 'banned' ? 'Khóa' : 'Mở khóa'} tài khoản này?`)) return;
    try {
      const res = await axios.patch(`${API_BASE}/admin/users/${id}/status`, { status: newStatus });
      if (res.data.success) {
        setUsers(users.map(u => u.user_id === id ? { ...u, status: newStatus } : u));
        showToast(res.data.message, "success");
      }
    } catch (e) {
      showToast(e.response?.data?.message || "Lỗi cập nhật", "error");
    }
  };

  const filteredUsers = users.filter(u => u.email.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý Người dùng</h1>
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm theo email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 w-full sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl outline-none focus:border-rose-500"
          />
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Email</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Trạng thái</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">XP / Chuỗi</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase text-right">Phân quyền</th>
                <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase text-right">Khóa/Mở</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" className="py-10 text-center"><Loader2 className="animate-spin mx-auto text-rose-500" /></td></tr>
              ) : filteredUsers.map(u => (
                <tr key={u.user_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="py-3.5 px-5 font-medium text-slate-900 dark:text-white">
                    {u.email}
                    {currentUser?.userId === u.user_id && <span className="ml-2 text-xs bg-brand-100 text-brand-600 px-2 py-0.5 rounded-full">You</span>}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${u.status === 'banned' ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {u.status === 'banned' ? 'BANNED' : 'ACTIVE'}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-slate-500">
                    <span className="text-amber-500 font-bold">{u.xp || 0}</span> / <span className="text-orange-500 font-bold">{u.streak_days || 0}</span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button 
                      onClick={() => handleUpdateRole(u.user_id, u.role)}
                      disabled={currentUser?.userId === u.user_id}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        u.role === 'admin' 
                          ? 'bg-rose-100 text-rose-600 hover:bg-rose-200' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                      } disabled:opacity-50`}
                    >
                      {u.role === 'admin' ? <ShieldAlert size={14} /> : <Shield size={14} />}
                      {u.role.toUpperCase()}
                    </button>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button 
                      onClick={() => handleUpdateStatus(u.user_id, u.status)}
                      disabled={currentUser?.userId === u.user_id || u.role === 'admin'}
                      className={`p-2 rounded-lg transition-colors ${
                        u.status === 'banned' ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                      } disabled:opacity-30`}
                      title={u.status === 'banned' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                    >
                      {u.status === 'banned' ? <Unlock size={18} /> : <Lock size={18} />}
                    </button>
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
