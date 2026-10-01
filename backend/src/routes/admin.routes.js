const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { updateRoleSchema, updateStatusSchema } = require('../schemas/admin.schema');

router.use(authenticateToken, verifyAdmin);

router.get('/stats', adminController.getStats);
router.get('/users', adminController.getUsers);
router.delete('/users/:id', adminController.deleteUser);
router.patch('/users/:id/role', validate(updateRoleSchema), adminController.updateUserRole);
router.patch('/users/:id/status', validate(updateStatusSchema), adminController.updateUserStatus);

module.exports = router;
