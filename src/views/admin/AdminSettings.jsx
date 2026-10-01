import React, { useState } from "react";
import { Settings2, HardDrive, Bell, Shield, Save, Loader2 } from "lucide-react";
import { showToast } from "../../utils/toast";

export default function AdminSettings() {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowRegistration: true,
    maxUploadSize: 50,
  });

  const handleSave = () => {
    setSaving(true);
    // Giả lập lưu API
    setTimeout(() => {
      setSaving(false);
      showToast("Đã lưu cài đặt hệ thống", "success");
    }, 1000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Cài đặt Hệ thống</h1>
        <p className="text-slate-500 text-sm mt-1">Quản lý các cấu hình chung của toàn bộ ứng dụng EngMaster.</p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        
        {/* Section 1 */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="text-rose-500" size={24} />
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Bảo mật & Truy cập</h3>
          </div>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Chế độ Bảo trì (Maintenance)</p>
                <p className="text-sm text-slate-500">Tạm thời khóa ứng dụng với người dùng thông thường để nâng cấp hệ thống.</p>
              </div>
              <input 
                type="checkbox" 
                checked={settings.maintenanceMode}
                onChange={e => setSettings({...settings, maintenanceMode: e.target.checked})}
                className="w-5 h-5 accent-rose-500" 
              />
            </label>

            <label className="flex items-center justify-between p-4 border border-slate-100 dark:border-slate-800 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors">
              <div>
                <p className="font-bold text-slate-700 dark:text-slate-300">Mở Đăng ký mới</p>
                <p className="text-sm text-slate-500">Cho phép người dùng mới tạo tài khoản trên hệ thống.</p>
              </div>
              <input 
                type="checkbox" 
                checked={settings.allowRegistration}
                onChange={e => setSettings({...settings, allowRegistration: e.target.checked})}
                className="w-5 h-5 accent-emerald-500" 
              />
            </label>
          </div>
        </div>

        {/* Section 2 */}
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="text-blue-500" size={24} />
            <h3 className="font-bold text-lg text-slate-800 dark:text-slate-200">Lưu trữ & Dữ liệu</h3>
          </div>
          
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">Giới hạn tải file âm thanh (MB)</label>
              <input 
                type="number" 
                value={settings.maxUploadSize}
                onChange={e => setSettings({...settings, maxUploadSize: e.target.value})}
                className="w-full px-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:border-brand-500 text-slate-800 dark:text-slate-200"
              />
              <p className="text-xs text-slate-500 mt-2">Dung lượng tối đa mà người dùng có thể tải lên cho tính năng bóc băng AI.</p>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-end">
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-lg shadow-rose-500/30 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </div>
    </div>
  );
}
