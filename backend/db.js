const mysql = require("mysql2/promise");

/**
 * Connection Pool — sử dụng Environment Variables khi deploy.
 * Fallback sang XAMPP localhost nếu không có biến môi trường.
 */
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
