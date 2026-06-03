const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.get('/users', authenticateToken, verifyAdmin, adminController.getUsers);
router.delete('/users/:id', authenticateToken, verifyAdmin, adminController.deleteUser);

module.exports = router;
