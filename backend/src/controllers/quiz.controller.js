const pool = require("../config/db");

exports.getTodayReviews = async (req, res) => {
  try {
    // FIXED: Removed "WHERE t.user_id = ?" which breaks SRS for global topics.
    // Instead, we only fetch vocabularies that the user HAS studied and needs review today.
    const [rows] = await pool.execute(`
      SELECT v.*, t.topic_name, p.repetition, p.ease_factor, p.interval_days
      FROM vocabularies v
      JOIN topics t ON v.topic_id = t.topic_id
      JOIN vocab_progress p ON v.vocabulary_id = p.vocabulary_id AND p.user_id = ?
      WHERE p.next_review_date <= CURDATE()
      ORDER BY p.next_review_date ASC, v.vocabulary_id ASC
      LIMIT 100
    `, [req.user.user_id]);
    
    // Also, if the user hasn't studied ANY words, give them some new words
    if (rows.length === 0) {
      const [newWords] = await pool.execute(`
        SELECT v.*, t.topic_name
        FROM vocabularies v
        JOIN topics t ON v.topic_id = t.topic_id
        LEFT JOIN vocab_progress p ON v.vocabulary_id = p.vocabulary_id AND p.user_id = ?
        WHERE p.vocabulary_id IS NULL
        LIMIT 10
      `, [req.user.user_id]);
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
