# 🎯 EngMaster - Nền tảng Học Tiếng Anh Thông Minh

EngMaster là một ứng dụng Web Full-stack tương tác cao, kết hợp giữa phương pháp học tập lặp lại ngắt quãng (Spaced Repetition - SRS), cơ chế trò chơi hóa (Gamification) và Trí tuệ Nhân tạo (AI). Ứng dụng giúp người học duy trì động lực, ghi nhớ từ vựng hiệu quả và luyện nghe thông minh.

## ✨ Tính năng nổi bật

- **Flashcard & Spaced Repetition (SRS):** Ôn tập từ vựng khoa học dựa trên mức độ ghi nhớ.
- **Bài tập tương tác:** Hỗ trợ các bài thi trắc nghiệm và gõ chữ (Typing) với thuật toán đối chiếu thông minh (tự động loại bỏ dấu câu, chuẩn hoá tiếng Việt và nhận diện từ đồng nghĩa).
- **Trích xuất văn bản AI (Audio Transcription):** Tải lên các file âm thanh (hỗ trợ tới 50MB) để AI tự động bóc tách thành văn bản (Transcript) bằng Google Gemini.
- **Nhập liệu động qua Excel:** Tính năng Drag & Drop cho phép tải lên file Excel chứa danh sách từ vựng, hệ thống sẽ tự động phân rã và sắp xếp thành các chủ điểm bài học.
- **Giao diện hiện đại:** Hỗ trợ Dark Mode, hiệu ứng âm thanh (Web Audio API), phát âm từ vựng (Text-to-Speech) và UI/UX mượt mà với Tailwind CSS.

## 🚀 Hướng dẫn cài đặt và chạy dự án

Dự án được chia làm 2 phần: Frontend (React/Vite) ở thư mục gốc và Backend (Node.js/Express) ở thư mục `backend/`.

### Yêu cầu hệ thống
- Node.js (phiên bản 16+)
- MySQL (hoặc XAMPP)

### 1. Cài đặt Cơ sở dữ liệu (Database)
1. Mở MySQL và tạo một database mới tên là `english` (hoặc tên tuỳ chọn).
2. Chạy file SQL tại `backend/database/schema.sql` để tạo các bảng dữ liệu.

### 2. Cài đặt và chạy Backend
Mở một terminal mới và chạy các lệnh sau:
```bash
cd backend
npm install
```
Tạo file `.env` trong thư mục `backend/` và cấu hình các biến môi trường:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=english
JWT_SECRET=your_secret_key_here
GEMINI_API_KEY=your_gemini_api_key_here
```
Khởi động Backend server:
```bash
node server.js
```
*(Server sẽ chạy mặc định tại cổng 3001)*

### 3. Cài đặt và chạy Frontend
Mở một terminal khác ở thư mục gốc của dự án:
```bash
npm install
```
Tạo file `.env` ở thư mục gốc nếu cần tuỳ chỉnh đường dẫn API (mặc định đã trỏ về `http://localhost:3001/api`):
```env
VITE_API_BASE=http://localhost:3001/api
```
Khởi động Frontend server:
```bash
npm run dev
```
*(Ứng dụng sẽ tự động mở trên trình duyệt, thường là tại `http://localhost:5173`)*

---
*Dự án được xây dựng với Component-based Architecture, dễ dàng bảo trì và mở rộng tính năng trong tương lai.*
