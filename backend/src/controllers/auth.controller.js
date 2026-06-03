const pool = require("../config/db");
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

exports.getLeaderboard = async (req, res) => {
  try {
    const [topUsers] = await pool.execute(`
      SELECT u.user_id, u.email, s.xp, s.streak_days 
      FROM users u
      JOIN user_stats s ON u.user_id = s.user_id
      ORDER BY s.xp DESC, s.streak_days DESC
      LIMIT 10
    `);
    
    // Mask email for privacy (e.g. j***@gmail.com)
    const maskedUsers = topUsers.map(user => {
      const parts = user.email.split('@');
      const maskedName = parts[0].length > 2 ? parts[0].substring(0, 2) + '***' : parts[0] + '***';
      return { ...user, email: `${maskedName}@${parts[1]}` };
    });

    res.json({ success: true, data: maskedUsers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.updateStats = async (req, res) => {
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
};
