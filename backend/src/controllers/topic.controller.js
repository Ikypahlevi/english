const pool = require("../config/db");

exports.uploadExcel = async (req, res) => {
  const excelData = Array.isArray(req.body) ? req.body : req.body.excelData;
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

      await connection.execute(`INSERT INTO vocabularies (topic_id, word, ipa, meaning) VALUES ${placeholders}`, values);
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
