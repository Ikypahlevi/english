-- File mô tả cấu trúc database cho tham khảo
-- Database: english (đã có sẵn)
-- Chạy file này nếu chưa có bảng

CREATE DATABASE IF NOT EXISTS english DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE english;

-- Bảng Người dùng (Đăng nhập/Đăng ký)
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bảng lưu trữ Thống kê và Gamification (XP, Streak)
CREATE TABLE IF NOT EXISTS user_stats (
    user_id INT PRIMARY KEY,
    xp INT DEFAULT 0,
    streak_days INT DEFAULT 0,
    last_active_date DATE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS topics (
    topic_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,  -- Liên kết với người dùng
    topic_name VARCHAR(255) NOT NULL,
    session_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocabularies (
    vocabulary_id INT AUTO_INCREMENT PRIMARY KEY,
    topic_id INT NOT NULL,
    word VARCHAR(255) NOT NULL,
    ipa VARCHAR(255),
    meaning VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_topic FOREIGN KEY (topic_id) REFERENCES topics(topic_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vocab_progress (
    progress_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    vocabulary_id INT NOT NULL,
    repetition INT DEFAULT 0,
    interval_days INT DEFAULT 0,
    ease_factor FLOAT DEFAULT 2.5,
    next_review_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (vocabulary_id) REFERENCES vocabularies(vocabulary_id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_vocab (user_id, vocabulary_id)
);

CREATE INDEX IF NOT EXISTS idx_vocab_progress_review ON vocab_progress(user_id, next_review_date);
