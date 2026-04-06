const mysql = require("mysql2/promise");

/**
 * Tạo Connection Pool để tái sử dụng kết nối MySQL.
 * Pool tự quản lý việc mở/đóng connection, tránh tạo mới mỗi request.
 *
 * - host/user/password: thông tin XAMPP MySQL mặc định
 * - database: "english" (đã có sẵn 2 bảng topics + vocabularies)
 * - waitForConnections: chờ nếu pool đầy thay vì throw error
 * - connectionLimit: tối đa 10 connection đồng thời
 */
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "english",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
