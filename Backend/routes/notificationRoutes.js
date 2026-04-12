const express  = require('express');
const router   = express.Router();
const { protect } = require('../middleware/auth');
const { Notification } = require('../models/Extras');

// @route GET /api/notifications
router.get('/', protect, async (req, res) => {
  try {
    const { page=1, limit=20 } = req.query;
    const notifs = await Notification.find({ user:req.user.id })
      .sort('-createdAt').skip((page-1)*limit).limit(+limit);
    const unread = await Notification.countDocuments({ user:req.user.id, isRead:false });
    res.json({ success:true, count:notifs.length, unread, data:notifs });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route PUT /api/notifications/read-all
router.put('/read-all', protect, async (req, res) => {
  try {
    await Notification.updateMany({ user:req.user.id, isRead:false }, { isRead:true });
    res.json({ success:true, message:'All marked as read' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route PUT /api/notifications/:id/read
router.put('/:id/read', protect, async (req, res) => {
  try {
    await Notification.findOneAndUpdate({ _id:req.params.id, user:req.user.id }, { isRead:true });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

// @route DELETE /api/notifications/:id
router.delete('/:id', protect, async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id:req.params.id, user:req.user.id });
    res.json({ success:true });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
});

module.exports = router;
