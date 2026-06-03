require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./src/routes/auth.routes");
const topicRoutes = require("./src/routes/topic.routes");
const quizRoutes = require("./src/routes/quiz.routes");
const aiRoutes = require("./src/routes/ai.routes");
const adminRoutes = require("./src/routes/admin.routes");

const app = express();
const PORT = process.env.PORT || 3001;

// ========== MIDDLEWARE ==========
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://english-brown-seven.vercel.app"
  ]
}));
app.use(express.json({ limit: "50mb" }));

// Handle JSON syntax errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error(err);
    return res.status(400).json({ success: false, message: "Lỗi định dạng dữ liệu JSON." });
  }
  next();
});

// ========== ROUTES ==========
app.use("/api/auth", authRoutes); // Auth and Stats mapped to authRoutes for now. In a real app we might split stats.
app.use("/api/stats", authRoutes); 
app.use("/api/topics", topicRoutes);
app.use("/api/upload-excel", topicRoutes); // mapped in topic routes
app.use("/api/vocabularies", topicRoutes); // mapped in topic routes
app.use("/api/reviews", quizRoutes);
app.use("/api", aiRoutes); // chat & transcribe
app.use("/api/admin", adminRoutes);

// Root Endpoint
app.get("/", (req, res) => res.send("EngMaster API is running (Refactored Structure)"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
