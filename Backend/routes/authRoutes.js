const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const {
  register, verifyOTP, resendOTP, login, adminLogin,
  getMe, updateProfile, changePassword,
  forgotPassword, resetPassword, validatePasswordStrength
} = require('../controllers/authController');

router.post('/register',            register);
router.post('/verify-otp',          verifyOTP);
router.post('/resend-otp',          resendOTP);
router.post('/login',               login);
router.post('/admin-login',          adminLogin);
router.post('/forgot-password',     forgotPassword);
router.put ('/reset-password',      resetPassword);
router.post('/validate-password',   validatePasswordStrength);
router.get ('/me',                  protect, getMe);
router.put ('/update',              protect, updateProfile);
router.put ('/change-password',     protect, changePassword);

module.exports = router;
