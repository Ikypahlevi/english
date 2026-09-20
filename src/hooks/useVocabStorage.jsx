import { useState, useEffect, useCallback } from "react";
import localforage from "localforage";

// Cấu hình IndexedDB store riêng cho EngMaster
const vocabStore = localforage.createInstance({
  name: "engmaster",
  storeName: "vocab_sheets",
  description: "Lưu trữ từ vựng theo từng buổi học (sheet)",
});

const STORAGE_KEY = "engmaster_sheets";

/**
 * Custom Hook: useVocabStorage
 *
 * Quản lý toàn bộ logic lưu trữ offline với IndexedDB (qua localforage).
 * Cấu trúc dữ liệu:
 *   sheets = [ { sheetName: "Buổi 1", data: [{id, word, ipa, meaning}, ...] }, ... ]
 *
 * Returns:
 *   - sheets: danh sách tất cả các buổi học đã lưu
 *   - activeSheetIndex: index buổi học đang xem
 *   - setActiveSheetIndex: chọn buổi học
 *   - activeVocabList: danh sách từ vựng của buổi đang chọn
 *   - allVocabFlat: toàn bộ từ vựng gộp lại (dùng cho flashcard/quiz)
 *   - isLoading: đang đọc từ IndexedDB
 *   - importSheets: (sheetsToImport) => thêm nhiều sheet vào storage
 *   - deleteWord: (wordId) => xóa 1 từ khỏi sheet đang chọn
 *   - addWord: (word) => thêm 1 từ vào sheet đang chọn
 *   - clearAllData: () => xóa sạch toàn bộ dữ liệu offline
 *   - readSheetKeys: danh sách sheetKey đã import (dùng để đánh dấu "Đã nhập")
 */
export function useVocabStorage() {
  const [sheets, setSheets] = useState([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [readSheetKeys, setReadSheetKeys] = useState([]);

  // === 1. Khôi phục dữ liệu khi component mount ===
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedSheets = await vocabStore.getItem(STORAGE_KEY);
        const savedKeys = await vocabStore.getItem("engmaster_readKeys");
        if (savedSheets && Array.isArray(savedSheets)) {
          setSheets(savedSheets);
        }
        if (savedKeys && Array.isArray(savedKeys)) {
          setReadSheetKeys(savedKeys);
        }
      } catch (err) {
        console.error("Lỗi khi đọc dữ liệu từ IndexedDB:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // === 2. Persist sheets xuống IndexedDB mỗi khi thay đổi ===
  useEffect(() => {
    if (!isLoading) {
      vocabStore.setItem(STORAGE_KEY, sheets).catch(console.error);
    }
  }, [sheets, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      vocabStore.setItem("engmaster_readKeys", readSheetKeys).catch(console.error);
    }
  }, [readSheetKeys, isLoading]);

  // === 3. Import nhiều sheets cùng lúc (từ Excel multi-select) ===
  const importSheets = useCallback((sheetsToImport, fileNameForKeys) => {
    // sheetsToImport = [{ sheetName: string, data: [{id, word, ipa, meaning}] }]
    // fileNameForKeys = tên file gốc, dùng tạo sheetKey đánh dấu "Đã nhập"
    const validSheets = sheetsToImport.filter(s => s.data.length > 0);
    const emptySheets = sheetsToImport.filter(s => s.data.length === 0);

    if (validSheets.length > 0) {
      setSheets(prev => [...prev, ...validSheets]);
      // Tự động chuyển sang buổi mới nhập đầu tiên
      setActiveSheetIndex(prev => {
        // Đồng bộ: sau khi thêm, index sẽ trỏ đến sheet mới nhất
        return prev; // Giữ nguyên vị trí, user tự chọn
      });
    }

    // Ghi nhận các sheetKey đã đọc
    if (fileNameForKeys) {
      const newKeys = sheetsToImport.map(s => `${fileNameForKeys}_${s.sheetName}`);
      setReadSheetKeys(prev => {
        const combined = [...prev, ...newKeys.filter(k => !prev.includes(k))];
        return combined;
      });
    }

    return { importedCount: validSheets.length, emptyCount: emptySheets.length, emptyNames: emptySheets.map(s => s.sheetName) };
  }, []);

  // === 4. Xóa 1 từ khỏi sheet đang chọn ===
  const deleteWord = useCallback((wordId) => {
    setSheets(prev => prev.map((sheet, idx) => {
      if (idx !== activeSheetIndex) return sheet;
      return { ...sheet, data: sheet.data.filter(w => w.id !== wordId) };
    }));
  }, [activeSheetIndex]);

  // === 5. Thêm 1 từ thủ công vào sheet đang chọn ===
  const addWord = useCallback((newWordObj) => {
    setSheets(prev => {
      if (prev.length === 0) {
        // Chưa có sheet nào -> tạo sheet "Tùy chỉnh"
        return [{ sheetName: "Tùy chỉnh", data: [newWordObj] }];
      }
      return prev.map((sheet, idx) => {
        if (idx !== activeSheetIndex) return sheet;
        return { ...sheet, data: [...sheet.data, newWordObj] };
      });
    });
  }, [activeSheetIndex]);

  // === 6. Xóa 1 buổi học cụ thể ===
  const deleteSheet = useCallback((sheetIdx) => {
    setSheets(prev => prev.filter((_, i) => i !== sheetIdx));
    setActiveSheetIndex(prev => {
      if (prev >= sheetIdx && prev > 0) return prev - 1;
      return prev;
    });
  }, []);

  // === 7. Xóa sạch toàn bộ dữ liệu offline ===
  const clearAllData = useCallback(async () => {
    setSheets([]);
    setActiveSheetIndex(0);
    setReadSheetKeys([]);
    try {
      await vocabStore.clear();
    } catch (err) {
      console.error("Lỗi khi xóa IndexedDB:", err);
    }
    // Dọn luôn localStorage cũ nếu có
    localStorage.removeItem("engmaster_vocabList");
    localStorage.removeItem("engmaster_readSheets");
  }, []);

  // === Computed values ===
  const activeVocabList = sheets[activeSheetIndex]?.data || [];
  const allVocabFlat = sheets.flatMap(s => s.data);

  return {
    sheets,
    activeSheetIndex,
    setActiveSheetIndex,
    activeVocabList,
    allVocabFlat,
    isLoading,
    importSheets,
    deleteWord,
    addWord,
    deleteSheet,
    clearAllData,
    readSheetKeys,
  };
}
