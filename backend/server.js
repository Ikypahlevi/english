require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "engmaster_super_secret_key_12345";

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://english-brown-seven.vercel.app"
  ]
}));
app.use(express.json({ limit: "50mb" }));

// Handle JSON syntax errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error(err);
    return res.status(400).json({ success: false, message: "Lỗi định dạng dữ liệu JSON." });
  }
  next();
});

// --- Auth Middleware ---
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, message: "Vui lòng đăng nhập." });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ success: false, message: "Phiên đăng nhập hết hạn." });
    req.user = user;
    next();
  });
}

// ========== AUTH & STATS API ==========

app.post("/api/auth/register", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ success: false, message: "Thiếu email hoặc mật khẩu." });

  try {
    const [existing] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) return res.status(400).json({ success: false, message: "Email đã tồn tại." });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [result] = await connection.execute("INSERT INTO users (email, password_hash) VALUES (?, ?)", [email, hashedPassword]);
      const userId = result.insertId;
      await connection.execute("INSERT INTO user_stats (user_id, xp, streak_days) VALUES (?, 0, 0)", [userId]);
      await connection.commit();
      
      const token = jwt.sign({ user_id: userId, email }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ success: true, message: "Đăng ký thành công", token, user: { user_id: userId, email } });
    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(400).json({ success: false, message: "Sai email hoặc mật khẩu." });
    
    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(400).json({ success: false, message: "Sai email hoặc mật khẩu." });

    const token = jwt.sign({ user_id: user.user_id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, message: "Đăng nhập thành công", token, user: { user_id: user.user_id, email: user.email } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get("/api/stats", authenticateToken, async (req, res) => {
  try {
    const [stats] = await pool.execute("SELECT xp, streak_days FROM user_stats WHERE user_id = ?", [req.user.user_id]);
    res.json({ success: true, data: stats[0] || { xp: 0, streak_days: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/stats/update", authenticateToken, async (req, res) => {
  const { xpGained } = req.body;
  try {
    await pool.execute(
      `UPDATE user_stats 
       SET xp = xp + ?, 
           streak_days = CASE 
             WHEN last_active_date = CURDATE() THEN streak_days 
             WHEN last_active_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN streak_days + 1 
             WHEN last_active_date IS NULL THEN 1
             ELSE 1 
           END, 
           last_active_date = CURDATE() 
       WHERE user_id = ?`,
       [xpGained || 0, req.user.user_id]
    );

    const [newStats] = await pool.execute("SELECT xp, streak_days FROM user_stats WHERE user_id = ?", [req.user.user_id]);
    res.json({ success: true, data: newStats[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ========== PROTECTED DATA API ENDPOINTS ==========

app.post("/api/topics/import", authenticateToken, async (req, res) => {
  const sheetsData = req.body;
  if (!Array.isArray(sheetsData) || sheetsData.length === 0) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let totalTopics = 0, totalVocabularies = 0;

    for (const sheet of sheetsData) {
      const { sheetName, fileName, vocabularies } = sheet;
      if (!vocabularies || vocabularies.length === 0) continue;

      const [topicResult] = await connection.execute(
        "INSERT INTO topics (user_id, topic_name, session_name) VALUES (?, ?, ?)",
        [req.user.user_id, sheetName, fileName || sheetName]
      );
      const topicId = topicResult.insertId;
      totalTopics++;

      const placeholders = vocabularies.map(() => "(?, ?, ?, ?)").join(", ");
      const values = vocabularies.flatMap((v) => [topicId, v.word || "", v.ipa || "", v.meaning || ""]);

      await connection.execute(`INSERT INTO vocabularies (topic_id, word, ipa, meaning) VALUES ${placeholders}`, values);
      totalVocabularies += vocabularies.length;
    }

    await connection.commit();
    res.status(200).json({ success: true, message: `Import thành công.`, data: { topicsCreated: totalTopics } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Import thất bại!", error: error.message });
  } finally {
    connection.release();
  }
});

app.get("/api/topics", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT t.topic_id, t.topic_name, t.session_name, t.created_at,
             COUNT(v.vocabulary_id) AS vocab_count
      FROM topics t
      LEFT JOIN vocabularies v ON t.topic_id = v.topic_id
      WHERE t.user_id = ?
      GROUP BY t.topic_id
      ORDER BY t.created_at DESC
    `, [req.user.user_id]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/topics/:topicId/vocabularies", authenticateToken, async (req, res) => {
  try {
    // Xác thực topic thuộc về user
    const [topicCheck] = await pool.execute("SELECT topic_id FROM topics WHERE topic_id = ? AND user_id = ?", [req.params.topicId, req.user.user_id]);
    if (topicCheck.length === 0) return res.status(403).json({ success: false, message: "Không có quyền truy cập." });

    const [rows] = await pool.execute("SELECT * FROM vocabularies WHERE topic_id = ? ORDER BY vocabulary_id ASC", [req.params.topicId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/topics/:topicId", authenticateToken, async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM topics WHERE topic_id = ? AND user_id = ?", [req.params.topicId, req.user.user_id]);
    if (result.affectedRows === 0) return res.status(403).json({ success: false, message: "Không tìm thấy hoặc không có quyền xóa." });
    res.json({ success: true, message: "Đã xóa chủ điểm." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/vocabularies/:vocabId", authenticateToken, async (req, res) => {
  try {
    // Kiểm tra quyền sở hữu gián tiếp qua topics
    const [check] = await pool.execute(`
      SELECT v.vocabulary_id FROM vocabularies v
      JOIN topics t ON v.topic_id = t.topic_id
      WHERE v.vocabulary_id = ? AND t.user_id = ?
    `, [req.params.vocabId, req.user.user_id]);
    
    if (check.length === 0) return res.status(403).json({ success: false, message: "Không có quyền truy cập." });

    await pool.execute("DELETE FROM vocabularies WHERE vocabulary_id = ?", [req.params.vocabId]);
    res.json({ success: true, message: "Đã xóa từ vựng." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/topics", authenticateToken, async (req, res) => {
  try {
    await pool.execute("DELETE v FROM vocabularies v JOIN topics t ON v.topic_id = t.topic_id WHERE t.user_id = ?", [req.user.user_id]);
    await pool.execute("DELETE FROM topics WHERE user_id = ?", [req.user.user_id]);
    res.json({ success: true, message: "Đã xóa toàn bộ dữ liệu của bạn." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/check-answer", authenticateToken, async (req, res) => {
  const { word, correctMeaning, userAnswer } = req.body;
  if (!word || !correctMeaning || !userAnswer) return res.status(400).json({ success: false, message: "Thiếu dữ liệu" });

  try {
    const apiKey = process.env.GEMINI_API_KEY || ""; 
    const prompt = `Bạn là giám khảo máy móc chấm điểm từ vựng tiếng Anh.
Từ gốc: "${word}"
Nghĩa chuẩn: "${correctMeaning}"
Câu trả lời của người dùng: "${userAnswer}"

Luật chấm điểm:
1. Chỉ chấm điểm dựa trên ngữ nghĩa (chấp nhận từ đồng nghĩa, bao hàm ý nghĩa, bỏ qua hoa/thường, dấu câu).
2. TUYỆT ĐỐI KHÔNG giải thích thêm.
3. Bắt buộc CHỈ trả về duy nhất chuỗi JSON chuẩn: {"isCorrect": boolean, "reason": "string ngắn giải thích lý do"}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      })
    });
    
    if (!response.ok) throw new Error(`API AI Error - Status: ${response.status}`);
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("AI trả về kết quả rỗng");

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Không giải mã được JSON");
    const result = JSON.parse(jsonMatch[0]);
    res.json({ success: true, data: result });
  } catch (error) {
    const normalizedUser = String(userAnswer).trim().toLowerCase();
    const normalizedCorrect = String(correctMeaning).trim().toLowerCase();
    const fallbackCorrect = normalizedCorrect.includes(normalizedUser) && normalizedUser.length >= 3;
    res.json({ success: true, data: { isCorrect: fallbackCorrect, reason: fallbackCorrect ? "Đúng (AI Fallback)" : "Sai (AI Fallback)" } });
  }
});

// ========== BỔ SUNG: API Sinh Ảnh AI Miễn Phí (Giai đoạn 3 Preview) ==========
app.post("/api/generate-image", authenticateToken, async (req, res) => {
  const { word } = req.body;
  if (!word) return res.status(400).json({ success: false, message: "Thiếu từ vựng" });
  try {
    // Sử dụng Pollinations AI (Miễn phí, không cần key)
    const prompt = encodeURIComponent(`An illustration representing the english word "${word}", simple, clear, educational style`);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=400&height=300&nologo=true`;
    res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi tạo ảnh" });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`\n🚀 EngMaster API đang chạy tại: http://localhost:${PORT}`);
});
