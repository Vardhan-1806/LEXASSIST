const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { protect } = require('../middleware/auth');
router.get('/profile/:id', protect, async (req,res) => {
  const user = await User.findById(req.params.id).select('-password');
  res.json({success:true,data:user});
});
module.exports = router;
