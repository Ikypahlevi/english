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

export default function SheetSelectModal({ pendingWorkbook, selectedSheets, isSaving, toggleSheetSelection, setSelectedSheets, handleImportSelectedSheets, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-700">
        <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Chọn trang tính</h3>
              <p className="text-brand-200 text-sm truncate max-w-[200px]">{pendingWorkbook.file.name}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-6 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
          <button onClick={() => setSelectedSheets([...pendingWorkbook.wb.SheetNames])} className="text-xs px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 font-medium">Chọn tất cả</button>
          <button onClick={() => setSelectedSheets([])} className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 font-medium">Bỏ chọn</button>
        </div>

        <div className="max-h-60 overflow-y-auto px-6 py-4 space-y-2">
          {pendingWorkbook.wb.SheetNames.map((wsname) => {
            const isSelected = selectedSheets.includes(wsname);
            return (
              <button key={wsname} onClick={() => toggleSheetSelection(wsname)}
                className={`w-full text-left px-4 py-3 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                  isSelected ? "bg-brand-50 dark:bg-brand-900/20 border-brand-400 dark:border-brand-600 text-brand-800 dark:text-brand-300" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                }`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${isSelected ? "bg-brand-600 border-brand-600" : "border-slate-300 dark:border-slate-600"}`}>
                  {isSelected && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                </div>
                <span className="font-medium flex-1 truncate">{wsname}</span>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3 px-6 py-5 border-t border-slate-100 dark:border-slate-800">
          <button onClick={onCancel} className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl">Hủy</button>
          <button onClick={handleImportSelectedSheets} disabled={selectedSheets.length === 0 || isSaving}
            className="flex-1 py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-semibold rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : "Nhập dữ liệu"}
          </button>
        </div>
      </div>
    </div>
  );
}