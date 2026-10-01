import React, { useState, useEffect } from "react";
import axios, { API_BASE } from "../../utils/api";
import { showToast } from "../../utils/toast";
import { Trash2, FolderOpen, FileSpreadsheet, Loader2, RefreshCw } from "lucide-react";

export default function AdminContentManager() {
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/topics`);
      if (res.data.success) {
        setTopics(res.data.data);
      }
    } catch (e) {
      showToast("Lỗi tải danh sách chủ đề", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionName) => {
    if (!confirm(`Bạn có chắc muốn xóa TOÀN BỘ bài học thuộc bộ "${sessionName}"?`)) return;
    
    const sessionTopics = topics.filter(t => t.session_name === sessionName);
    try {
      for (const t of sessionTopics) {
        await axios.delete(`${API_BASE}/topics/${t.topic_id}`);
      }
      showToast(`Đã xóa bộ "${sessionName}"`, "success");
      fetchTopics();
    } catch (e) {
      showToast("Lỗi khi xóa", "error");
    }
  };

  const handleDeleteTopic = async (topicId, topicName) => {
    if (!confirm(`Xóa chủ đề "${topicName}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/topics/${topicId}`);
      showToast("Đã xóa chủ đề", "success");
      setTopics(topics.filter(t => t.topic_id !== topicId));
    } catch (e) {
      showToast("Lỗi khi xóa", "error");
    }
  };

  // Group topics by session_name
  const grouped = topics.reduce((acc, topic) => {
    const key = topic.session_name || "Chủ đề Khác";
    if (!acc[key]) acc[key] = [];
    acc[key].push(topic);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quản lý Dữ liệu Hệ thống</h1>
          <p className="text-slate-500 text-sm mt-1">Quản lý các bộ từ vựng chung đang hiển thị cho mọi người dùng.</p>
        </div>
        <button onClick={fetchTopics} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl font-medium transition-colors">
          <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-20"><Loader2 className="animate-spin text-rose-500" size={32} /></div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="text-center py-20 text-slate-500">Chưa có dữ liệu hệ thống nào.</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([sessionName, sessionTopics]) => (
            <div key={sessionName} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm p-5">
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                    <FolderOpen size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200">{sessionName}</h3>
                    <p className="text-xs text-slate-500">{sessionTopics.length} chủ đề con</p>
                  </div>
                </div>
                <button onClick={() => handleDeleteSession(sessionName)} className="p-2 text-rose-500 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 rounded-lg transition-colors" title="Xóa toàn bộ file">
                  <Trash2 size={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {sessionTopics.map(topic => (
                  <div key={topic.topic_id} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileSpreadsheet size={16} className="text-emerald-500 shrink-0" />
                      <span className="font-medium text-sm text-slate-700 dark:text-slate-300 truncate" title={topic.topic_name}>{topic.topic_name}</span>
                      <span className="text-xs text-slate-400 shrink-0">({topic.vocab_count} từ)</span>
                    </div>
                    <button onClick={() => handleDeleteTopic(topic.topic_id, topic.topic_name)} className="text-slate-400 hover:text-rose-500 transition-colors p-1 shrink-0">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
