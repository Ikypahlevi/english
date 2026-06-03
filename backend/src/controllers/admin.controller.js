const pool = require("../config/db");

exports.getUsers = async (req, res) => {
  try {
    // Pagination logic (Page defaults to 1, limit to 20)
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const [users] = await pool.execute(`
      SELECT u.user_id, u.email, u.role, u.created_at, s.xp, s.streak_days, s.last_active_date
      FROM users u
      LEFT JOIN user_stats s ON u.user_id = s.user_id
      ORDER BY s.xp DESC
      LIMIT ? OFFSET ?
    `, [limit.toString(), offset.toString()]);
    
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
