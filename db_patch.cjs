const pool = require('./backend/src/config/db');

async function run() {
  let hasRole = false;
  let hasStatus = false;
  try {
    await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'");
    console.log('Added role column');
  } catch (e) {
    if (e.code === 'ECONNREFUSED') {
      console.log('Database connection failed. Ensure MySQL is running.');
      process.exit(1);
    }
    console.log('Role column probably exists');
  }
  
  try {
    await pool.query("ALTER TABLE users ADD COLUMN status VARCHAR(20) DEFAULT 'active'");
    console.log('Added status column');
  } catch (e) {}
  
  process.exit(0);
}
run();
