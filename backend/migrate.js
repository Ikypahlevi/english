require('dotenv').config();
const pool = require('./db');

async function migrate() {
  try {
    const [result] = await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    console.log("Added role column.");
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') {
      console.log("Role column already exists.");
    } else {
      console.error("Error adding role column:", e);
    }
  }

  try {
    const [result2] = await pool.query("UPDATE users SET role = 'admin' WHERE email = 'admin@engmaster.com'");
    console.log("Updated admin role, rows affected:", result2.affectedRows);
  } catch (e) {
    console.error("Error updating admin role:", e);
  }

  process.exit(0);
}

migrate();
