const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);
router.get('/stats', authenticateToken, authController.getStats);
router.get('/stats/leaderboard', authenticateToken, authController.getLeaderboard);
router.post('/stats/update', authenticateToken, authController.updateStats);

module.exports = router;
