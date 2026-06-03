import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, BookOpen } from "lucide-react";

let toastTimeout;
const toastSubscribers = new Set();

export const showToast = (message, type = 'success') => {
  toastSubscribers.forEach(cb => cb({ message, type, id: Date.now() }));
};

export function ToastContainer() {
  const [toast, setToast] = useState(null);
  
  useEffect(() => {
    const cb = (newToast) => {
      setToast(newToast);
      if (toastTimeout) clearTimeout(toastTimeout);
      toastTimeout = setTimeout(() => setToast(null), 3000);
    };
    toastSubscribers.add(cb);
    return () => toastSubscribers.delete(cb);
  }, []);

  if (!toast) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] animate-slide-up">
      <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-medium text-sm ${
        toast.type === 'error' ? 'bg-rose-500 text-white' : 
        toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-white'
      }`}>
        {toast.type === 'error' ? <XCircle size={18} /> : 
         toast.type === 'success' ? <CheckCircle2 size={18} /> : <BookOpen size={18} />}
        {toast.message}
      </div>
    </div>
  );
}
