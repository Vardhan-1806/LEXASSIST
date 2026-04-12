const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const { sendMessage, getChatHistory, deleteSession, searchKB, analyzeDocument, getKBStats } = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');

const upload = multer({
  dest: 'uploads/temp/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.txt','.doc','.docx'];
    allowed.includes(path.extname(file.originalname).toLowerCase()) ? cb(null,true) : cb(new Error('Only PDF, TXT, DOC files allowed'));
  }
});

router.post('/message',              protect, sendMessage);
router.get('/history',               protect, getChatHistory);
router.get('/search',                protect, searchKB);
router.get('/stats',                 protect, getKBStats);
router.post('/analyze-doc',          protect, upload.single('document'), analyzeDocument);
router.delete('/history/:sessionId', protect, deleteSession);

module.exports = router;
