const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express();
const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://english-brown-seven.vercel.app"
  ]
}));
app.use(express.json({ limit: "50mb" })); // Parse JSON body, tăng limit cho file lớn

// ========== API ENDPOINTS ==========

/**
 * POST /api/topics/import
 *
 * Nhận mảng JSON từ Frontend:
 * [
 *   {
 *     sheetName: "Buổi 1",
 *     vocabularies: [
 *       { word: "hello", ipa: "/həˈləʊ/", meaning: "xin chào" },
 *       ...
 *     ]
 *   },
 *   ...
 * ]
 *
 * Logic Transaction:
 *   1. Lấy 1 connection từ Pool
 *   2. BEGIN TRANSACTION
 *   3. Lặp từng sheet:
 *       a. INSERT vào bảng `topics` → lấy topic_id
 *       b. INSERT BATCH tất cả từ vựng của sheet vào `vocabularies`
 *   4. Nếu OK → COMMIT. Nếu lỗi → ROLLBACK toàn bộ.
 *   5. Trả connection về Pool.
 */
app.post("/api/topics/import", async (req, res) => {
  const sheetsData = req.body;

  // --- Validate input ---
  if (!Array.isArray(sheetsData) || sheetsData.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Dữ liệu không hợp lệ. Cần gửi mảng JSON chứa ít nhất 1 sheet.",
    });
  }

  // --- Lấy 1 connection riêng từ Pool để dùng cho Transaction ---
  const connection = await pool.getConnection();

  try {
    // Bắt đầu Transaction: tất cả INSERT sẽ nằm trong 1 "giao dịch"
    await connection.beginTransaction();

    let totalTopics = 0;
    let totalVocabularies = 0;

    for (const sheet of sheetsData) {
      const { sheetName, vocabularies } = sheet;

      // Bỏ qua sheet không có từ vựng hợp lệ
      if (!vocabularies || vocabularies.length === 0) continue;

      // --- Bước 1: INSERT vào bảng `topics` ---
      // Lưu tên sheet vào cả topic_name và session_name
      const [topicResult] = await connection.execute(
        "INSERT INTO topics (topic_name, session_name) VALUES (?, ?)",
        [sheetName, sheetName]
      );
      const topicId = topicResult.insertId; // Lấy topic_id vừa tạo
      totalTopics++;

      // --- Bước 2: INSERT BATCH vào bảng `vocabularies` ---
      // Tạo câu INSERT với nhiều VALUES cùng lúc để tối ưu hiệu suất
      // VD: INSERT INTO vocabularies (...) VALUES (?, ?, ?, ?), (?, ?, ?, ?), ...
      const placeholders = vocabularies.map(() => "(?, ?, ?, ?)").join(", ");
      const values = vocabularies.flatMap((v) => [
        topicId,
        v.word || "",
        v.ipa || "",
        v.meaning || "",
      ]);

      await connection.execute(
        `INSERT INTO vocabularies (topic_id, word, ipa, meaning) VALUES ${placeholders}`,
        values
      );
      totalVocabularies += vocabularies.length;
    }

    // --- Bước 3: COMMIT nếu tất cả đều thành công ---
    await connection.commit();

    res.status(200).json({
      success: true,
      message: `Import thành công ${totalTopics} chủ điểm với ${totalVocabularies} từ vựng.`,
      data: { topicsCreated: totalTopics, vocabulariesCreated: totalVocabularies },
    });
  } catch (error) {
    // --- ROLLBACK nếu có bất kỳ lỗi nào ---
    // Đảm bảo không có dữ liệu "nửa vời" bị ghi vào database
    await connection.rollback();
    console.error("❌ Import failed, ROLLBACK executed:", error.message);

    res.status(500).json({
      success: false,
      message: "Import thất bại! Toàn bộ thao tác đã được rollback.",
      error: error.message,
    });
  } finally {
    // --- Luôn trả connection về Pool dù thành công hay thất bại ---
    connection.release();
  }
});

/**
 * GET /api/topics
 * Lấy danh sách topics kèm số lượng từ vựng (vocab_count) — KHÔNG kèm data chi tiết
 */
app.get("/api/topics", async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.topic_id, t.topic_name, t.session_name, t.created_at,
             COUNT(v.vocabulary_id) AS vocab_count
      FROM topics t
      LEFT JOIN vocabularies v ON t.topic_id = v.topic_id
      GROUP BY t.topic_id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * GET /api/topics/:topicId/vocabularies
 * Lấy danh sách từ vựng theo topic_id (chỉ khi user chọn topic đó)
 */
app.get("/api/topics/:topicId/vocabularies", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM vocabularies WHERE topic_id = ? ORDER BY vocabulary_id ASC",
      [req.params.topicId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/topics/:topicId
 * Xóa 1 topic và toàn bộ từ vựng liên quan (CASCADE)
 */
app.delete("/api/topics/:topicId", async (req, res) => {
  try {
    await pool.execute("DELETE FROM topics WHERE topic_id = ?", [req.params.topicId]);
    res.json({ success: true, message: "Đã xóa chủ điểm." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * DELETE /api/topics
 * Xóa toàn bộ topics + vocabularies
 */
app.delete("/api/topics", async (req, res) => {
  try {
    await pool.execute("DELETE FROM vocabularies");
    await pool.execute("DELETE FROM topics");
    res.json({ success: true, message: "Đã xóa toàn bộ dữ liệu." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * POST /api/check-answer
 * Chấm điểm câu trả lời qua AI (Gemini)
 */
app.post("/api/check-answer", async (req, res) => {
  const { word, correctMeaning, userAnswer } = req.body;
  if (!word || !correctMeaning || !userAnswer) return res.status(400).json({ success: false, message: "Thiếu dữ liệu" });

  try {
    // Đọc API Key từ môi trường (Nên tạo file .env và nạp thông qua dotenv package)
    const apiKey = process.env.GEMINI_API_KEY || ""; 
    
    const prompt = `Bạn là giám khảo máy móc chấm điểm từ vựng tiếng Anh.
Từ gốc: "${word}"
Nghĩa chuẩn: "${correctMeaning}"
Câu trả lời của người dùng: "${userAnswer}"

Luật chấm điểm:
1. Chỉ chấm điểm dựa trên ngữ nghĩa (chấp nhận từ đồng nghĩa, bao hàm ý nghĩa, bỏ qua hoa/thường, dấu câu).
2. TUYỆT ĐỐI KHÔNG giải thích thêm.
3. Bắt buộc CHỈ trả về duy nhất chuỗi JSON chuẩn theo format sau (không markdown, không code block):
{
  "isCorrect": boolean,
  "reason": "string ngắn giải thích lý do"
}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      // Yêu cầu AI luôn trả về cấu trúc JSON hợp lệ
      generationConfig: { responseMimeType: "application/json" },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
       throw new Error(`API AI Error - Status: ${response.status}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      throw new Error("AI trả về kết quả rỗng");
    }

    // Quan trọng: Dùng Regex cắt đúng đoạn JSON ({ ... }) từ văn bản để phòng hờ AI sinh ra markdown hoặc text dư thừa
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
       throw new Error("Không giải mã được JSON từ phản hồi của AI");
    }

    const result = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: result });

  } catch (error) {
    // Tình huống B: Fallback khi AI có lỗi mạng/Rate limit (Hạn chế nghẽn server)
    console.warn("⚠️ AI fallback được sử dụng do lỗi:", error.message);
    
    const normalizedUser = String(userAnswer).trim().toLowerCase();
    const normalizedCorrect = String(correctMeaning).trim().toLowerCase();
    const correctParts = normalizedCorrect.split(/[,;|/]/).map(p => p.trim());
    
    const fallbackCorrect = correctParts.includes(normalizedUser) || 
                           (normalizedCorrect.includes(normalizedUser) && normalizedUser.length >= (normalizedCorrect.length * 0.5) && normalizedUser.length >= 3);

    res.json({ 
        success: true, 
        data: { 
            isCorrect: fallbackCorrect, 
            reason: fallbackCorrect ? "Đúng (Chấm tự động dự phòng)" : "Chưa chính xác (Hệ thống dự phòng)" 
        } 
    });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`\n🚀 EngMaster API đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   POST   /api/topics/import`);
  console.log(`   GET    /api/topics`);
  console.log(`   GET    /api/topics/:id/vocabularies`);
  console.log(`   DELETE /api/topics/:id`);
  console.log(`   DELETE /api/topics\n`);
});
