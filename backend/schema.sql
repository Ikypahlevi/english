-- File mô tả cấu trúc database cho tham khảo
-- Database: english (đã có sẵn)
-- Chạy file này nếu chưa có bảng

CREATE DATABASE IF NOT EXISTS english DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE english;

CREATE TABLE IF NOT EXISTS topics (
    topic_id INT AUTO_INCREMENT PRIMARY KEY,
    topic_name VARCHAR(255) NOT NULL,
    session_name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX IF NOT EXISTS idx_topic_id ON vocabularies(topic_id);
