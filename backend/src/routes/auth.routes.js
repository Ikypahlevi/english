const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { registerSchema, loginSchema } = require('../schemas/auth.schema');

router.post('/auth/register', validate(registerSchema), authController.register);
router.post('/auth/login', validate(loginSchema), authController.login);
router.get('/stats', authenticateToken, authController.getStats);
router.get('/stats/leaderboard', authenticateToken, authController.getLeaderboard);
router.post('/stats/update', authenticateToken, authController.updateStats);

module.exports = router;
