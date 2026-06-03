const jwt = require("jsonwebtoken");
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
