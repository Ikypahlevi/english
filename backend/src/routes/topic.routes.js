const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');
const validate = require('../middlewares/validate.middleware');
const { uploadExcelSchema } = require('../schemas/topic.schema');

router.post('/topics/import', authenticateToken, validate(uploadExcelSchema), topicController.uploadExcel);
router.get('/topics', authenticateToken, topicController.getTopics);
router.get('/topics/:topicId/vocabularies', authenticateToken, topicController.getVocabularies);
router.delete('/topics/:topicId', authenticateToken, topicController.deleteTopic);
router.delete('/vocabularies/:vocabId', authenticateToken, topicController.deleteVocab);

module.exports = router;
