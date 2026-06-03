const express = require('express');
const router = express.Router();
const aiController = require('../controllers/ai.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');

router.post('/chat', authenticateToken, aiController.chat);
router.post('/transcribe', authenticateToken, upload.single("audio"), aiController.transcribe);
router.post('/check-answer', authenticateToken, aiController.checkAnswer);

module.exports = router;
