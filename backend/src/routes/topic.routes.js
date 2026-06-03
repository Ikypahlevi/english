const express = require('express');
const router = express.Router();
const topicController = require('../controllers/topic.controller');
const { authenticateToken, verifyAdmin } = require('../middlewares/auth.middleware');

router.post('/upload-excel', authenticateToken, verifyAdmin, topicController.uploadExcel);
router.get('/topics', authenticateToken, topicController.getTopics);
router.get('/topics/:topicId/vocabularies', authenticateToken, topicController.getVocabularies);
router.delete('/topics/:topicId', authenticateToken, verifyAdmin, topicController.deleteTopic);
router.delete('/vocabularies/:vocabId', authenticateToken, verifyAdmin, topicController.deleteVocab);

module.exports = router;
