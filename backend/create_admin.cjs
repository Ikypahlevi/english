const pool = require('./src/config/db');

async function createAdmin() {
  try {
    const email = 'admin@engmaster.com';
    const password = 'admin123';

    let hash;
    try {
      const bcryptjs = require('bcryptjs');
      hash = await bcryptjs.hash(password, 10);
    } catch (e) {
      const b = require('bcrypt');
      hash = await b.hash(password, 10);
    }

    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      console.log('Admin account already exists. Updating role and password...');
      await pool.query('UPDATE users SET password_hash = ?, role = "admin", status = "active" WHERE email = ?', [hash, email]);
    } else {
      console.log('Creating new admin account...');
      const [result] = await pool.query(
        'INSERT INTO users (email, password_hash, role, status) VALUES (?, ?, "admin", "active")',
        [email, hash]
      );
      await pool.query('INSERT INTO user_stats (user_id, xp, streak_days) VALUES (?, 0, 0)', [result.insertId]);
    }

    console.log('----------------------------------------------------');
    console.log('Admin account created/updated successfully!');
    console.log('Email: admin@engmaster.com');
    console.log('Password: admin123');
    console.log('----------------------------------------------------');

  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('LỖI: Không thể kết nối đến MySQL. Hãy chắc chắn rằng bạn đã BẬT MySQL trong XAMPP!');
    } else {
      console.error('Error creating admin:', error);
    }
  } finally {
    await pool.end();
  }
}

createAdmin();
