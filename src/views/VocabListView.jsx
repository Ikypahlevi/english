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

export default function VocabListView({ user, topics, selectedTopic, vocabList, isLoadingVocab, selectTopic, backToTopics, handleFileUpload, processFile, handleDeleteTopic, handleDeleteVocab, handleDeleteGroup, totalVocab }) {
  const [isDragging, setIsDragging] = useState(false);
  const dropRef = useRef(null);

  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); };

  const sortedSessions = useMemo(() => {
    const uniqueTopics = new Map();
    topics.forEach(topic => {
      const key = `${topic.session_name || "Chủ điểm hệ thống"}|||${topic.topic_name}`;
      if (!uniqueTopics.has(key) || topic.topic_id > uniqueTopics.get(key).topic_id) {
         uniqueTopics.set(key, topic);
      }
    });

    const grouped = Array.from(uniqueTopics.values()).reduce((acc, topic) => {
      const groupName = topic.session_name || "Chủ điểm hệ thống";
      if (!acc[groupName]) acc[groupName] = [];
      acc[groupName].push(topic);
      return acc;
    }, {});

    return Object.entries(grouped).map(([groupName, groupTopics]) => {
      groupTopics.sort((a, b) => a.topic_name.localeCompare(b.topic_name, undefined, { numeric: true }));
      return [groupName, groupTopics];
    }).sort((a, b) => {
      const matchA = a[0].match(/\d+/);
      const matchB = b[0].match(/\d+/);
      if (matchA && matchB) {
        return parseInt(matchA[0], 10) - parseInt(matchB[0], 10);
      }
      return a[0].localeCompare(b[0], undefined, { numeric: true });
    });
  }, [topics]);

  if (selectedTopic) {
    return (
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={backToTopics} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-brand-600 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Danh sách
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm mb-4">
          <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 flex items-center justify-between text-white">
            <div>
              <h2 className="text-xl font-bold">{selectedTopic.topic_name}</h2>
              <p className="text-brand-200 text-sm mt-0.5">{vocabList.length} từ vựng</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center font-bold text-xl">{vocabList.length}</div>
          </div>

          {isLoadingVocab ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 animate-pulse">
                  <div className="w-8 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-100 dark:bg-slate-800/50 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase w-12 text-center">#</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Tiếng Anh</th>
                    <th className="py-4 px-5 text-xs font-bold text-slate-400 uppercase">Tiếng Việt</th>
                    <th className="py-4 px-5 w-14"></th>
                  </tr>
                </thead>
                <tbody>
                  {vocabList.map((item, index) => (
                    <tr key={item.vocabulary_id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-brand-50/50 dark:hover:bg-brand-900/10 group">
                      <td className="py-3.5 px-5 text-center text-slate-400 text-sm">{index + 1}</td>
                      <td className="py-3.5 px-5 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <div className="relative group/img cursor-pointer">
                           <div className="p-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-500">
                             <Sparkles size={14} />
                           </div>
                           <div className="absolute left-0 bottom-full mb-2 hidden group-hover/img:block z-50 w-40 h-40 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden origin-bottom-left animate-scale-in">
                             <img src={`https://image.pollinations.ai/prompt/illustration%20of%20${encodeURIComponent(item.word)}%2C%20minimalist%20vector%20art%20style%2C%20white%20background?width=200&height=200&nologo=true`} alt={item.word} className="w-full h-full object-cover" loading="lazy" />
                           </div>
                        </div>
                        {item.word} 
                        <button onClick={(e) => { e.stopPropagation(); speakWord(item.word); }} className="ml-2 text-slate-400 hover:text-brand-500 transition-colors" title="Nghe phát âm">
                          <Volume2 size={16} />
                        </button>
                        {item.ipa && <span className="ml-2 text-xs font-normal text-brand-500 font-mono bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded">{item.ipa}</span>}
                      </td>
                      <td className="py-3.5 px-5 text-slate-600 dark:text-slate-300">{item.meaning}</td>
                      <td className="py-3.5 px-5 text-right">
                        <button onClick={() => handleDeleteVocab(item.vocabulary_id, item.word)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl opacity-0 group-hover:opacity-100 transition-all">
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }



  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Kho Từ Vựng Của Bạn</h2>
        <p className="text-slate-500 mt-1">{topics.length} bộ đề • {totalVocab} từ vựng</p>
      </div>

      <div ref={dropRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
        className={`relative mb-8 border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
          isDragging ? "border-brand-500 bg-brand-50 scale-[1.01]" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-brand-300"
        }`}>
          <label className="absolute inset-0 cursor-pointer" htmlFor="excel-upload" />
          <input id="excel-upload" type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={handleFileUpload} />
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center transition-all ${isDragging ? "bg-brand-500 text-white shadow-lg" : "bg-brand-50 text-brand-500"}`}>
            <Upload size={28} />
          </div>
          <p className="font-semibold text-slate-700 dark:text-slate-300">Thả file Excel vào đây để thêm từ vựng</p>
      </div>

      {topics.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 py-16 text-center rounded-2xl border border-slate-200 dark:border-slate-800">
          <FolderOpen size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Chưa có dữ liệu, hãy tải lên file Excel.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {sortedSessions.map(([groupName, groupTopics]) => (
            <FileGroup key={groupName} user={user} groupName={groupName} groupTopics={groupTopics} selectTopic={selectTopic} handleDeleteTopic={handleDeleteTopic} handleDeleteGroup={handleDeleteGroup} />
          ))}
        </div>
      )}
    </div>
  );
}

function FileGroup({ user, groupName, groupTopics, selectTopic, handleDeleteTopic, handleDeleteGroup }) {
  const [collapsed, setCollapsed] = useState(false);
  const totalWords = groupTopics.reduce((s, t) => s + Number(t.vocab_count || 0), 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800" onClick={() => setCollapsed(!collapsed)}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white"><FileSpreadsheet size={18} /></div>
          <div>
            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{groupName}</p>
            <p className="text-xs text-slate-500">{groupTopics.length} sheet • {totalWords} từ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); handleDeleteGroup(groupName, groupTopics); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="Xóa toàn bộ file">
            <Trash2 size={16} />
          </button>
          <button className="text-slate-400 p-1">{collapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}</button>
        </div>
      </div>
      {!collapsed && (
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {groupTopics.map(topic => (
            <div key={topic.topic_id} className="relative group bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all">
              <div onClick={() => selectTopic(topic)} className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold">{topic.vocab_count}</div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{topic.topic_name}</p>
                </div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); handleDeleteTopic(topic.topic_id, topic.topic_name); }} className="absolute top-4 right-4 p-1.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}