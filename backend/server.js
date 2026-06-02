require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || "engmaster_super_secret_key_12345";
const upload = multer({ storage: multer.memoryStorage() });

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

function verifyAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: "Yêu cầu quyền Quản trị viên (Admin)." });
  }
  next();
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
      const [result] = await connection.execute("INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'user')", [email, hashedPassword]);
      const userId = result.insertId;
      await connection.execute("INSERT INTO user_stats (user_id, xp, streak_days) VALUES (?, 0, 0)", [userId]);
      await connection.commit();
      
      const token = jwt.sign({ user_id: userId, email, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
      res.json({ success: true, message: "Đăng ký thành công", token, user: { user_id: userId, email, role: 'user' } });
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

    const token = jwt.sign({ user_id: user.user_id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ success: true, message: "Đăng nhập thành công", token, user: { user_id: user.user_id, email: user.email, role: user.role } });
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

// ========== TOPICS & VOCABULARIES ==========

app.post("/api/upload-excel", authenticateToken, verifyAdmin, async (req, res) => {
  const { excelData } = req.body;
  if (!Array.isArray(excelData) || excelData.length === 0) {
    return res.status(400).json({ success: false, message: "Dữ liệu không hợp lệ." });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    let totalTopics = 0, totalVocabularies = 0;

    for (const sheet of excelData) {
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
      GROUP BY t.topic_id
      ORDER BY t.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/topics/:topicId/vocabularies", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM vocabularies WHERE topic_id = ? ORDER BY vocabulary_id ASC", [req.params.topicId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/topics/:topicId", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM topics WHERE topic_id = ?", [req.params.topicId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Không tìm thấy bộ từ vựng." });
    
    res.json({ success: true, message: "Đã xóa bộ từ vựng thành công." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/vocabularies/:vocabId", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM vocabularies WHERE vocabulary_id = ?", [req.params.vocabId]);
    if (result.affectedRows === 0) return res.status(403).json({ success: false, message: "Không tìm thấy hoặc không có quyền xóa." });
    res.json({ success: true, message: "Đã xóa từ vựng." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== SRS (SPACED REPETITION) API ==========

app.get("/api/reviews/today", authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*, t.topic_name, p.repetition, p.ease_factor, p.interval_days
      FROM vocabularies v
      JOIN topics t ON v.topic_id = t.topic_id
      LEFT JOIN vocab_progress p ON v.vocabulary_id = p.vocabulary_id AND p.user_id = ?
      WHERE t.user_id = ? 
        AND (p.next_review_date IS NULL OR p.next_review_date <= CURDATE())
      ORDER BY p.next_review_date ASC, v.vocabulary_id ASC
      LIMIT 100
    `, [req.user.user_id, req.user.user_id]);
    
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/api/reviews/update", authenticateToken, async (req, res) => {
  const { vocabulary_id, rating } = req.body;
  
  if (rating === undefined || !vocabulary_id) {
    return res.status(400).json({ success: false, message: "Thiếu dữ liệu đánh giá." });
  }

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute(
      "SELECT * FROM vocab_progress WHERE user_id = ? AND vocabulary_id = ?",
      [req.user.user_id, vocabulary_id]
    );
    
    let rep = 0, interval = 0, ease = 2.5;
    
    if (rows.length > 0) {
      rep = rows[0].repetition;
      interval = rows[0].interval_days;
      ease = rows[0].ease_factor;
    }
    
    if (rating >= 3) {
      if (rep === 0) interval = 1;
      else if (rep === 1) interval = 6;
      else interval = Math.round(interval * ease);
      rep += 1;
    } else {
      rep = 0;
      interval = 1;
    }
    
    ease = ease + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    if (ease < 1.3) ease = 1.3;
    
    await connection.execute(`
      INSERT INTO vocab_progress (user_id, vocabulary_id, repetition, interval_days, ease_factor, next_review_date)
      VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY))
      ON DUPLICATE KEY UPDATE 
        repetition = VALUES(repetition),
        interval_days = VALUES(interval_days),
        ease_factor = VALUES(ease_factor),
        next_review_date = VALUES(next_review_date)
    `, [req.user.user_id, vocabulary_id, rep, interval, ease, interval]);
    
    res.json({ success: true, message: "Đã cập nhật tiến độ." });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  } finally {
    connection.release();
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
    const prompt = encodeURIComponent(`An illustration representing the english word "${word}", simple, clear, educational style`);
    const imageUrl = `https://image.pollinations.ai/prompt/${prompt}?width=400&height=300&nologo=true`;
    res.json({ success: true, data: { imageUrl } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Lỗi tạo ảnh" });
  }
});

// ========== AI ROLEPLAY CHAT ==========
app.post("/api/chat/roleplay", authenticateToken, async (req, res) => {
  const { messages, vocabList, topicName } = req.body;
  if (!messages || !vocabList) return res.status(400).json({ success: false, message: "Thiếu dữ liệu." });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const targetWords = vocabList.map(v => `${v.word} (${v.meaning})`).join(", ");

    const systemPrompt = `You are a native English speaker roleplaying with an English learner.
Topic: ${topicName}
Your goal is to have a natural conversation with the user to help them practice English.
Target Vocabulary for the user to learn: ${targetWords}.

RULES:
1. Always respond in English.
2. Keep your responses short, conversational, and natural (1-3 sentences).
3. Naturally steer the conversation to encourage the user to use the Target Vocabulary.
4. If the user makes a major grammar mistake, you can gently correct them in parentheses at the end of your message.
5. If the user is struggling, give them a subtle hint about what they could say next.`;

    const history = messages.map(msg => ({
      role: msg.role === 'ai' ? 'model' : 'user',
      parts: [{ text: msg.text }]
    }));

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I will act as a conversational partner to help the user practice these words." }] },
        ...history.slice(0, -1)
      ],
    });

    const lastMessage = history[history.length - 1].parts[0].text;
    const result = await chat.sendMessage(lastMessage);
    const responseText = result.response.text();

    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ success: false, message: "Lỗi kết nối AI: " + error.message });
  }
});

// ========== AI AUDIO TRANSCRIPTION ==========
app.post("/api/transcribe", authenticateToken, upload.single("audio"), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Không tìm thấy file âm thanh." });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `Please transcribe the spoken English in this audio file. Then, provide a complete Vietnamese translation below the transcription. Format your response exactly like this:
**Transcript:**
[English text here]

**Dịch:**
[Vietnamese text here]`;

    const audioPart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    const result = await model.generateContent([prompt, audioPart]);
    const responseText = result.response.text();
    
    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("Transcription Error:", error);
    res.status(500).json({ success: false, message: "Lỗi nhận diện âm thanh: " + error.message });
  }
});

// ========== ADMIN APIs ==========
app.get("/api/admin/users", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(`
      SELECT u.user_id, u.email, u.role, u.created_at, s.xp, s.streak_days 
      FROM users u 
      LEFT JOIN user_stats s ON u.user_id = s.user_id 
      ORDER BY u.created_at DESC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/admin/users/:userId", authenticateToken, verifyAdmin, async (req, res) => {
  try {
    if (req.user.user_id == req.params.userId) {
      return res.status(400).json({ success: false, message: "Không thể tự xóa chính mình." });
    }
    const [result] = await pool.execute("DELETE FROM users WHERE user_id = ?", [req.params.userId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Không tìm thấy người dùng." });
    res.json({ success: true, message: "Đã xóa người dùng thành công." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ========== START SERVER ==========
app.listen(PORT, () => {
  console.log(`\n🚀 EngMaster API đang chạy tại: http://localhost:${PORT}`);
});
