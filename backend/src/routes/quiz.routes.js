const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quiz.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.get('/today', authenticateToken, quizController.getTodayReviews);
router.post('/update', authenticateToken, quizController.updateReview);

module.exports = router;
