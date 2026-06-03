import fs from 'fs';
import path from 'path';

const domPath = path.join(process.cwd(), 'dom.jsx');
let content = fs.readFileSync(domPath, 'utf8');

const getBlock = (startText, endText) => {
  const startIdx = content.indexOf(startText);
  if (startIdx === -1) return null;
  const endIdx = content.indexOf(endText, startIdx);
  if (endIdx === -1) return null;
  return content.substring(startIdx, endIdx + endText.length);
};

const commonImports = `import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { 
  BookOpen, Layers, GraduationCap, Upload, ChevronLeft, ChevronRight,
  RotateCcw, CheckCircle2, XCircle, Sparkles, Loader2, Volume2,
  Lightbulb, Trash2, FolderOpen, ArrowLeft, Database, Sun, Moon,
  FileSpreadsheet, LayoutDashboard, BookMarked, BrainCircuit, Zap,
  ChevronDown, ChevronUp, FileText, LogOut, User, Flame, CalendarClock, MessageSquare, Users, Headphones
} from "lucide-react";
import axios from "axios";
import { API_BASE } from "../utils/api.js";
import { playSound, speakWord } from "../utils/audio.js";
import { showToast } from "../utils/toast.jsx";
`;

const viewsDir = path.join(process.cwd(), 'src', 'views');
const componentsDir = path.join(process.cwd(), 'src', 'components');

fs.mkdirSync(viewsDir, { recursive: true });
fs.mkdirSync(componentsDir, { recursive: true });

// Extract AdminDashboardView
const adminBlock = getBlock('function AdminDashboardView', '\n}\n\n// ════════════════════════════════════════════════════════════');
if (adminBlock) {
  fs.writeFileSync(path.join(viewsDir, 'AdminDashboardView.jsx'), commonImports + "\nexport " + adminBlock.replace('function AdminDashboardView', 'default function AdminDashboardView'));
}

// Extract AudioTranscriptionView
const audioBlock = getBlock('function AudioTranscriptionView', '\n}\n\n// ════════════════════════════════════════════════════════════');
if (audioBlock) {
  fs.writeFileSync(path.join(viewsDir, 'AudioTranscriptionView.jsx'), commonImports + "\nexport " + audioBlock.replace('function AudioTranscriptionView', 'default function AudioTranscriptionView'));
}

console.log("Frontend refactor completed for Admin & Audio views");
