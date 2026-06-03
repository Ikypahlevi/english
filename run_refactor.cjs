const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'backend', 'src');
const dirs = ['config', 'middlewares', 'controllers', 'routes'];

// Create directories
fs.mkdirSync(srcDir, { recursive: true });
dirs.forEach(d => fs.mkdirSync(path.join(srcDir, d), { recursive: true }));

// 1. config/db.js
fs.writeFileSync(path.join(srcDir, 'config', 'db.js'), `const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "english",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
`);

// 2. middlewares/auth.middleware.js
fs.writeFileSync(path.join(srcDir, 'middlewares', 'auth.middleware.js'), `const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "engmaster_super_secret_key_12345";

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

module.exports = { authenticateToken, verifyAdmin };
`);

// 3. middlewares/upload.middleware.js
fs.writeFileSync(path.join(srcDir, 'middlewares', 'upload.middleware.js'), `const multer = require("multer");
// Use memory storage for Excel, but for large Audio we might need diskStorage to avoid OOM
// For now we stick to memoryStorage but add limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit to prevent OOM
});

module.exports = upload;
`);

// 4. controllers/auth.controller.js
fs.writeFileSync(path.join(srcDir, 'controllers', 'auth.controller.js'), `const pool = require("../config/db");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "engmaster_super_secret_key_12345";

exports.register = async (req, res) => {
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
};

exports.login = async (req, res) => {
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
};

exports.getStats = async (req, res) => {
  try {
    const [stats] = await pool.execute("SELECT xp, streak_days FROM user_stats WHERE user_id = ?", [req.user.user_id]);
    res.json({ success: true, data: stats[0] || { xp: 0, streak_days: 0 } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStats = async (req, res) => {
  const { xpGained } = req.body;
  try {
    await pool.execute(
      \`UPDATE user_stats 
       SET xp = xp + ?, 
           streak_days = CASE 
             WHEN last_active_date = CURDATE() THEN streak_days 
             WHEN last_active_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN streak_days + 1 
             WHEN last_active_date IS NULL THEN 1
             ELSE 1 
           END, 
           last_active_date = CURDATE() 
       WHERE user_id = ?\`,
       [xpGained || 0, req.user.user_id]
    );

    const [newStats] = await pool.execute("SELECT xp, streak_days FROM user_stats WHERE user_id = ?", [req.user.user_id]);
    res.json({ success: true, data: newStats[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
`);

// 5. controllers/topic.controller.js
fs.writeFileSync(path.join(srcDir, 'controllers', 'topic.controller.js'), `const pool = require("../config/db");

exports.uploadExcel = async (req, res) => {
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

      const [existing] = await connection.execute(
        "SELECT topic_id FROM topics WHERE topic_name = ? AND session_name = ?",
        [sheetName, fileName || sheetName]
      );
      if (existing.length > 0) {
        const idsToDelete = existing.map(e => e.topic_id);
        await connection.query("DELETE FROM topics WHERE topic_id IN (?)", [idsToDelete]);
      }

      const [topicResult] = await connection.execute(
        "INSERT INTO topics (user_id, topic_name, session_name) VALUES (?, ?, ?)",
        [req.user.user_id, sheetName, fileName || sheetName]
      );
      const topicId = topicResult.insertId;
      totalTopics++;

      const placeholders = vocabularies.map(() => "(?, ?, ?, ?)").join(", ");
      const values = vocabularies.flatMap((v) => [topicId, v.word || "", v.ipa || "", v.meaning || ""]);

      await connection.execute(\`INSERT INTO vocabularies (topic_id, word, ipa, meaning) VALUES \${placeholders}\`, values);
      totalVocabularies += vocabularies.length;
    }

    await connection.commit();
    res.status(200).json({ success: true, message: "Import thành công.", data: { topicsCreated: totalTopics } });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: "Import thất bại!", error: error.message });
  } finally {
    connection.release();
  }
};

exports.getTopics = async (req, res) => {
  try {
    const [rows] = await pool.execute(\`
      SELECT t.topic_id, t.topic_name, t.session_name, t.created_at,
             COUNT(v.vocabulary_id) AS vocab_count
      FROM topics t
      LEFT JOIN vocabularies v ON t.topic_id = v.topic_id
      GROUP BY t.topic_id
      ORDER BY t.created_at DESC
    \`);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getVocabularies = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM vocabularies WHERE topic_id = ? ORDER BY vocabulary_id ASC", [req.params.topicId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteTopic = async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM topics WHERE topic_id = ?", [req.params.topicId]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: "Không tìm thấy bộ từ vựng." });
    res.json({ success: true, message: "Đã xóa bộ từ vựng thành công." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteVocab = async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM vocabularies WHERE vocabulary_id = ?", [req.params.vocabId]);
    if (result.affectedRows === 0) return res.status(403).json({ success: false, message: "Không tìm thấy hoặc không có quyền xóa." });
    res.json({ success: true, message: "Đã xóa từ vựng." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
`);

// 6. controllers/quiz.controller.js
fs.writeFileSync(path.join(srcDir, 'controllers', 'quiz.controller.js'), `const pool = require("../config/db");

exports.getTodayReviews = async (req, res) => {
  try {
    // FIXED: Removed "WHERE t.user_id = ?" which breaks SRS for global topics.
    // Instead, we only fetch vocabularies that the user HAS studied and needs review today.
    const [rows] = await pool.execute(\`
      SELECT v.*, t.topic_name, p.repetition, p.ease_factor, p.interval_days
      FROM vocabularies v
      JOIN topics t ON v.topic_id = t.topic_id
      JOIN vocab_progress p ON v.vocabulary_id = p.vocabulary_id AND p.user_id = ?
      WHERE p.next_review_date <= CURDATE()
      ORDER BY p.next_review_date ASC, v.vocabulary_id ASC
      LIMIT 100
    \`, [req.user.user_id]);
    
    // Also, if the user hasn't studied ANY words, give them some new words
    if (rows.length === 0) {
      const [newWords] = await pool.execute(\`
        SELECT v.*, t.topic_name
        FROM vocabularies v
        JOIN topics t ON v.topic_id = t.topic_id
        LEFT JOIN vocab_progress p ON v.vocabulary_id = p.vocabulary_id AND p.user_id = ?
        WHERE p.vocabulary_id IS NULL
        LIMIT 10
      \`, [req.user.user_id]);
      return res.json({ success: true, data: newWords });
    }
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateReview = async (req, res) => {
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

    let repetition = 0, ease_factor = 2.5, interval_days = 0;

    if (rows.length > 0) {
      const p = rows[0];
      repetition = p.repetition;
      ease_factor = p.ease_factor;
      interval_days = p.interval_days;
    }

    if (rating >= 3) {
      if (repetition === 0) interval_days = 1;
      else if (repetition === 1) interval_days = 6;
      else interval_days = Math.round(interval_days * ease_factor);
      repetition++;
    } else {
      repetition = 0;
      interval_days = 1;
    }

    ease_factor = ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02));
    if (ease_factor < 1.3) ease_factor = 1.3;

    if (rows.length > 0) {
      await connection.execute(
        "UPDATE vocab_progress SET repetition=?, ease_factor=?, interval_days=?, next_review_date=DATE_ADD(CURDATE(), INTERVAL ? DAY), last_review_date=CURDATE() WHERE progress_id=?",
        [repetition, ease_factor, interval_days, interval_days, rows[0].progress_id]
      );
    } else {
      await connection.execute(
        "INSERT INTO vocab_progress (user_id, vocabulary_id, repetition, ease_factor, interval_days, next_review_date, last_review_date) VALUES (?, ?, ?, ?, ?, DATE_ADD(CURDATE(), INTERVAL ? DAY), CURDATE())",
        [req.user.user_id, vocabulary_id, repetition, ease_factor, interval_days, interval_days]
      );
    }

    res.json({ success: true, message: "Đã cập nhật tiến độ." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    connection.release();
  }
};
`);

// 7. controllers/ai.controller.js
fs.writeFileSync(path.join(srcDir, 'controllers', 'ai.controller.js'), `const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.chat = async (req, res) => {
  const { messages, selectedTopic } = req.body;
  if (!messages || messages.length === 0) {
    return res.status(400).json({ success: false, message: "Thiếu dữ liệu tin nhắn." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const chat = model.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }]
      })),
      systemInstruction: {
        role: "system",
        parts: [{ text: \`You are a friendly, encouraging English tutor. Practice conversation with the user using the vocabulary from the topic: "\${selectedTopic}". Keep responses short (1-3 sentences) and conversational.\` }]
      }
    });

    const userMessage = messages[messages.length - 1].content;
    const result = await chat.sendMessage([{ text: userMessage }]);
    const responseText = result.response.text();
    
    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("AI Error:", error);
    res.status(500).json({ success: false, message: "Lỗi kết nối AI: " + error.message });
  }
};

exports.transcribe = async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "Không tìm thấy file âm thanh." });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Chưa cấu hình GEMINI_API_KEY.");

    const genAI = new GoogleGenerativeAI(apiKey);
    
    const prompt = \`Please transcribe the spoken English in this audio file. Format your response sentence-by-sentence (or dialogue-by-dialogue). 
For each transcribed English sentence:
1. Write the English sentence. If this is a test/quiz audio, try to identify the correct answer or key phrases and format them with an underline (using markdown HTML like <u>underlined text</u> or **bold**).
2. Immediately below it, provide the Vietnamese translation for that specific sentence.

Example Format:
**English:** She is <u>holding a pen</u>.
**Dịch:** Cô ấy đang cầm một cây bút.\`;

    const audioPart = {
      inlineData: {
        data: req.file.buffer.toString("base64"),
        mimeType: req.file.mimetype
      }
    };

    let result;
    let retries = 3;
    let delay = 2000;
    
    for (let i = 0; i < retries; i++) {
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        result = await model.generateContent([prompt, audioPart]);
        break; 
      } catch (error) {
        if (i === retries - 1) throw error; 
        if (error.message && error.message.includes("503")) {
          console.warn(\`[Gemini API 503] Server overloaded. Retrying \${i + 1}/\${retries} in \${delay}ms...\`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; 
        } else {
          throw error; 
        }
      }
    }

    const responseText = result.response.text();
    res.json({ success: true, text: responseText });
  } catch (error) {
    console.error("Transcription Error:", error);
    let errorMsg = error.message;
    if (errorMsg.includes("503")) {
      errorMsg = "Hệ thống AI đang quá tải (Google Server 503). Vui lòng thử lại sau ít phút.";
    }
    res.status(500).json({ success: false, message: "Lỗi nhận diện âm thanh: " + errorMsg });
  }
};
`);

// 8. controllers/admin.controller.js
fs.writeFileSync(path.join(srcDir, 'controllers', 'admin.controller.js'), `const pool = require("../config/db");

exports.getUsers = async (req, res) => {
  try {
    // Pagination logic (Page defaults to 1, limit to 20)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [users] = await pool.execute(\`
      SELECT u.user_id, u.email, u.role, u.created_at, s.xp, s.streak_days, s.last_active_date
      FROM users u
      LEFT JOIN user_stats s ON u.user_id = s.user_id
      ORDER BY s.xp DESC
      LIMIT ? OFFSET ?
    \`, [limit.toString(), offset.toString()]);
    
    // Also get total count for pagination metadata
    const [countResult] = await pool.execute("SELECT COUNT(*) as total FROM users");
    const total = countResult[0].total;

    res.json({ 
      success: true, 
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    if (req.user.user_id === parseInt(req.params.id)) {
      return res.status(400).json({ success: false, message: "Không thể tự xóa tài khoản của chính mình." });
    }
    await pool.execute("DELETE FROM users WHERE user_id = ?", [req.params.id]);
    res.json({ success: true, message: "Đã xóa tài khoản." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
`);

// 9. Routes
const routesDir = path.join(srcDir, 'routes');
fs.writeFileSync(path.join(routesDir, 'auth.routes.js'), `const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/stats', authenticateToken, authController.getStats);
router.post('/stats/update', authenticateToken, authController.updateStats);

module.exports = router;
`);

fs.writeFileSync(path.join(routesDir, 'topic.routes.js'), `const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.post('/upload-excel', authenticateToken, verifyAdmin, topicController.uploadExcel);
router.get('/', authenticateToken, topicController.getTopics);
router.get('/:topicId/vocabularies', authenticateToken, topicController.getVocabularies);
router.delete('/:topicId', authenticateToken, verifyAdmin, topicController.deleteTopic);
router.delete('/vocabularies/:vocabId', authenticateToken, verifyAdmin, topicController.deleteVocab);

module.exports = router;
`);

fs.writeFileSync(path.join(routesDir, 'quiz.routes.js'), `const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.get('/today', authenticateToken, quizController.getTodayReviews);
router.post('/update', authenticateToken, quizController.updateReview);

module.exports = router;
`);

fs.writeFileSync(path.join(routesDir, 'ai.routes.js'), `const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.post('/chat', authenticateToken, aiController.chat);
router.post('/transcribe', authenticateToken, upload.single("audio"), aiController.transcribe);

module.exports = router;
`);

fs.writeFileSync(path.join(routesDir, 'admin.routes.js'), `const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.get('/users', authenticateToken, verifyAdmin, adminController.getUsers);
router.delete('/users/:id', authenticateToken, verifyAdmin, adminController.deleteUser);

module.exports = router;
`);

// 10. Update server.js
fs.writeFileSync(path.join(__dirname, 'backend', 'server.js'), `require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const topicRoutes = require("./src/routes/topic.routes");
const quizRoutes = require("./src/routes/quiz.routes");
const aiRoutes = require("./src/routes/ai.routes");
const adminRoutes = require("./src/routes/admin.routes");

const app = express();
const PORT = process.env.PORT || 3001;

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

// ========== ROUTES ==========
app.use("/api/auth", authRoutes); // Auth and Stats mapped to authRoutes for now. In a real app we might split stats.
app.use("/api/stats", authRoutes); 
app.use("/api/topics", topicRoutes);
app.use("/api/upload-excel", topicRoutes); // mapped in topic routes
app.use("/api/vocabularies", topicRoutes); // mapped in topic routes
app.use("/api/reviews", quizRoutes);
app.use("/api", aiRoutes); // chat & transcribe
app.use("/api/admin", adminRoutes);

// Root Endpoint
app.get("/", (req, res) => res.send("EngMaster API is running (Refactored Structure)"));

app.listen(PORT, () => console.log(\`Server running on port \${PORT}\`));
`);

console.log("Backend refactoring complete!");
