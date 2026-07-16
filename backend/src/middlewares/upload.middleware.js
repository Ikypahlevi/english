const multer = require("multer");
// Use memory storage for Excel, but for large Audio we might need diskStorage to avoid OOM
// For now we stick to memoryStorage but add limits
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit to prevent OOM
});

module.exports = upload;
