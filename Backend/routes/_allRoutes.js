// ─── Chatbot Routes ───────────────────────────────────────────────────────────
const express  = require('express');
const chatbot  = express.Router();
const { sendMessage, getChatHistory, deleteSession } = require('../controllers/chatbotController');
const { protect } = require('../middleware/auth');

chatbot.post('/message',                  protect, sendMessage);
chatbot.get('/history',                   protect, getChatHistory);
chatbot.delete('/history/:sessionId',     protect, deleteSession);

module.exports.chatbotRoutes = chatbot;

// ─── Calendar Routes ──────────────────────────────────────────────────────────
const calRouter = express.Router();
const { CalendarEvent } = require('../models/Extras');

calRouter.get('/', protect, async (req, res) => {
  const events = await CalendarEvent.find({ user: req.user.id }).sort('startDate');
  res.json({ success: true, data: events });
});
calRouter.post('/', protect, async (req, res) => {
  const event = await CalendarEvent.create({ user: req.user.id, ...req.body });
  res.status(201).json({ success: true, data: event });
});
calRouter.put('/:id', protect, async (req, res) => {
  const event = await CalendarEvent.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json({ success: true, data: event });
});
calRouter.delete('/:id', protect, async (req, res) => {
  await CalendarEvent.findByIdAndDelete(req.params.id);
  res.json({ success: true, message: 'Event deleted' });
});

module.exports.calendarRoutes = calRouter;

// ─── Admin Routes ─────────────────────────────────────────────────────────────
const adminRouter = express.Router();
const { getDashboardStats, getPendingLawyers, verifyLawyer, getAllUsers, toggleUserActive, getAnalytics } = require('../controllers/adminController');
const { authorize } = require('../middleware/auth');

adminRouter.use(protect);
adminRouter.use(authorize('admin'));
adminRouter.get('/stats',              getDashboardStats);
adminRouter.get('/analytics',          getAnalytics);
adminRouter.get('/lawyers/pending',    getPendingLawyers);
adminRouter.put('/lawyers/:id/verify', verifyLawyer);
adminRouter.get('/users',              getAllUsers);
adminRouter.put('/users/:id/toggle',   toggleUserActive);

module.exports.adminRoutes = adminRouter;

// ─── User Routes ──────────────────────────────────────────────────────────────
const userRouter = express.Router();
const User = require('../models/User');

userRouter.get('/profile/:id', protect, async (req, res) => {
  const user = await User.findById(req.params.id).select('-password');
  res.json({ success: true, data: user });
});

module.exports.userRoutes = userRouter;

// ─── Document Routes ──────────────────────────────────────────────────────────
const docRouter = express.Router();
const multer = require('multer');
const path   = require('path');
const { Document } = require('../models/Extras');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

docRouter.post('/', protect, upload.single('file'), async (req, res) => {
  try {
    const doc = await Document.create({
      title: req.body.title || req.file.originalname,
      case: req.body.caseId || undefined,
      uploadedBy: req.user.id,
      fileUrl:  `/uploads/${req.file.filename}`,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      tags: req.body.tags ? req.body.tags.split(',') : [],
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
docRouter.get('/case/:caseId', protect, async (req, res) => {
  const docs = await Document.find({ case: req.params.caseId }).populate('uploadedBy', 'name');
  res.json({ success: true, data: docs });
});

module.exports.documentRoutes = docRouter;

// ─── Notification Routes ──────────────────────────────────────────────────────
const notifRouter = express.Router();
const { Notification } = require('../models/Extras');

notifRouter.get('/', protect, async (req, res) => {
  const notifs = await Notification.find({ user: req.user.id }).sort('-createdAt').limit(30);
  res.json({ success: true, data: notifs });
});
notifRouter.put('/:id/read', protect, async (req, res) => {
  await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
  res.json({ success: true });
});
notifRouter.put('/read-all', protect, async (req, res) => {
  await Notification.updateMany({ user: req.user.id }, { isRead: true });
  res.json({ success: true });
});

module.exports.notificationRoutes = notifRouter;
