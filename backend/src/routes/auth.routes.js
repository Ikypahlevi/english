const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/stats', authenticateToken, authController.getStats);
router.get('/leaderboard', authenticateToken, authController.getLeaderboard);
router.post('/stats/update', authenticateToken, authController.updateStats);

module.exports = router;
