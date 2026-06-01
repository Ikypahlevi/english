-- Thêm cột role vào bảng users
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';

-- Đặt tài khoản admin
UPDATE users SET role = 'admin' WHERE email = 'admin@engmaster.com';
