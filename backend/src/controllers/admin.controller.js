const pool = require("../config/db");

exports.getUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // Use connection.execute with actual numbers or connection.query
    const [users] = await pool.query(`
      SELECT u.user_id, u.email, u.role, u.status, u.created_at, s.xp, s.streak_days, s.last_active_date
      FROM users u
      LEFT JOIN user_stats s ON u.user_id = s.user_id
      ORDER BY s.xp DESC
      LIMIT ? OFFSET ?
    `, [limit, offset]);
    
    const [countResult] = await pool.query("SELECT COUNT(*) as total FROM users");
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
    await pool.query("DELETE FROM users WHERE user_id = ?", [req.params.id]);
    res.json({ success: true, message: "Đã xóa tài khoản." });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateUserRole = async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    if (req.user.user_id === parseInt(id)) {
        return res.status(400).json({ success: false, message: 'Không thể tự đổi quyền của mình' });
    }

    try {
        await pool.query('UPDATE users SET role = ? WHERE user_id = ?', [role, id]);
        res.json({ success: true, message: 'Đã cập nhật quyền' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateUserStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    if (req.user.user_id === parseInt(id)) {
        return res.status(400).json({ success: false, message: 'Không thể tự khóa tài khoản của mình' });
    }

    try {
        await pool.query('UPDATE users SET status = ? WHERE user_id = ?', [status, id]);
        res.json({ success: true, message: 'Đã cập nhật trạng thái' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getStats = async (req, res) => {
    try {
        const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) as totalUsers FROM users');
        const [[{ activeUsers }]] = await pool.query('SELECT COUNT(*) as activeUsers FROM users WHERE status = "active"');
        const [[{ bannedUsers }]] = await pool.query('SELECT COUNT(*) as bannedUsers FROM users WHERE status = "banned"');
        const [[{ totalTopics }]] = await pool.query('SELECT COUNT(*) as totalTopics FROM topics');
        const [[{ totalVocab }]] = await pool.query('SELECT COUNT(*) as totalVocab FROM vocabularies');
        
        const [[{ activeToday }]] = await pool.query('SELECT COUNT(*) as activeToday FROM user_stats WHERE last_active_date = CURDATE()');

        res.json({
            success: true,
            data: {
                users: { total: totalUsers, active: activeUsers, banned: bannedUsers, activeToday },
                content: { topics: totalTopics, vocab: totalVocab }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
