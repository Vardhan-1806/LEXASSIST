/**
 * LEXASSIST — Auth Controller (FINAL CLEAN VERSION)
 */
const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const User   = require('../models/User');
const { sendOTPEmail, sendWelcomeEmail } = require('../utils/emailService');

const signToken = (id, expiry = '7d') =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: expiry });

const sendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  user.password = undefined;
  res.status(statusCode).json({ success: true, token, data: user });
};

// ── Password validation ───────────────────────────────────────
const validatePassword = (pw) => {
  const errs = [];
  if (!pw || pw.length < 8)           errs.push('At least 8 characters');
  if (!/[A-Z]/.test(pw))              errs.push('At least one uppercase letter (A-Z)');
  if (!/[a-z]/.test(pw))              errs.push('At least one lowercase letter (a-z)');
  if (!/[0-9]/.test(pw))              errs.push('At least one number (0-9)');
  if (!/[!@#$%^&*()_+\-=\[\]{}|,.<>?]/.test(pw)) errs.push('At least one special character (!@#$%^&*)');
  return errs;
};

// ── Generate 4-digit OTP ──────────────────────────────────────
const makeOTP = () => String(Math.floor(1000 + Math.random() * 9000));
const hashOTP = (otp) => crypto.createHash('sha256').update(otp).digest('hex');

// @route POST /api/auth/register — Step 1: Collect info, send OTP
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email and password are required' });

    if (phone && !/^[6-9]\d{9}$/.test(phone))
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number (starts with 6-9)' });

    const pwErrors = validatePassword(password);
    if (pwErrors.length > 0)
      return res.status(400).json({ success: false, message: pwErrors.join(' · '), errors: pwErrors });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing && existing.isVerified)
      return res.status(400).json({ success: false, message: 'This email is already registered. Please login.' });

    const otp       = makeOTP();
    const hashedOTP = hashOTP(otp);
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 min

    if (existing && !existing.isVerified) {
      // Update unverified user — use updateOne to avoid double-hashing
      const bcrypt = require('bcryptjs');
      const newHash = await bcrypt.hash(password, 12);
      await User.updateOne(
        { _id: existing._id },
        { $set: { name, password: newHash, role: role || 'citizen', phone: phone || '', otp: hashedOTP, otpExpires: otpExpiry } }
      );
    } else {
      await User.create({
        name, email: email.toLowerCase(), password,
        role: role || 'citizen', phone: phone || '',
        otp: hashedOTP, otpExpires: otpExpiry,
        isVerified: false,
      });
    }

    // Send OTP email
    const result = await sendOTPEmail(email, name, otp, 'registration');
    console.log(`📧 OTP [${otp}] → ${email} | sent: ${result.success}`);

    res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}. Check your inbox and spam folder.`,
      data:    { email, name, requiresOTP: true },
      devOTP:  process.env.NODE_ENV !== 'production' ? otp : undefined,
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/auth/verify-otp — Step 2: Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ success: false, message: 'Email and OTP are required' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found. Please register first.' });

    const hashed = hashOTP(String(otp));

    if (user.otp !== hashed)
      return res.status(400).json({ success: false, message: 'Incorrect OTP. Please check and try again.' });

    if (!user.otpExpires || user.otpExpires < new Date())
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });

    // Verify user — use updateOne to avoid pre-save hook issues
    await User.updateOne(
      { _id: user._id },
      { $set: { isVerified: true, otpVerified: true }, $unset: { otp: '', otpExpires: '' } }
    );

    const verifiedUser = await User.findById(user._id);

    // Send welcome email
    sendWelcomeEmail(verifiedUser).catch(console.error);

    sendToken(verifiedUser, 200, res);
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/auth/resend-otp
exports.resendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found with this email' });
    if (user.isVerified)
      return res.status(400).json({ success: false, message: 'Email already verified. Please login.' });

    const otp       = makeOTP();
    const hashedOTP = hashOTP(otp);

    await User.updateOne(
      { _id: user._id },
      { $set: { otp: hashedOTP, otpExpires: new Date(Date.now() + 10 * 60 * 1000) } }
    );

    const result = await sendOTPEmail(email, user.name, otp, 'verification');
    console.log(`📧 Resend OTP [${otp}] → ${email} | sent: ${result.success}`);

    res.json({ success: true, message: `New code sent to ${email}. Check inbox and spam.`,
      devOTP: process.env.NODE_ENV !== 'production' ? otp : undefined });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required' });

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user)
      return res.status(401).json({ success: false, message: 'No account found with this email. Please register.' });

    const isMatch = await user.matchPassword(password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Incorrect password. Please try again.' });

    if (!user.isActive)
      return res.status(401).json({ success: false, message: 'Account deactivated. Contact support.' });

    // If lawyer role, check if their Lawyer profile is verified by admin
    if (user.role === 'lawyer') {
      const Lawyer = require('../models/Lawyer');
      const lawyerProfile = await Lawyer.findOne({ user: user._id });
      if (lawyerProfile && !lawyerProfile.isVerified && !lawyerProfile.isRejected) {
        return res.status(403).json({
          success: false,
          message: 'Your lawyer profile is pending admin verification. You will receive an email once approved.',
          pendingVerification: true,
        });
      }
      if (lawyerProfile?.isRejected) {
        return res.status(403).json({
          success: false,
          message: `Your lawyer profile was not approved. Reason: ${lawyerProfile.rejectReason || 'Please contact admin.'}`,
          rejected: true,
        });
      }
    }

    if (!user.isVerified) {
      // Auto-send new OTP
      const otp       = makeOTP();
      const hashedOTP = hashOTP(otp);
      await User.updateOne(
        { _id: user._id },
        { $set: { otp: hashedOTP, otpExpires: new Date(Date.now() + 10 * 60 * 1000) } }
      );
      sendOTPEmail(user.email, user.name, otp, 'email verification').catch(console.error);
      console.log(`📧 Login OTP [${otp}] → ${user.email}`);

      return res.status(401).json({
        success:     false,
        message:     'Please verify your email first. A new code has been sent.',
        requiresOTP: true,
        email:       user.email,
        devOTP:      process.env.NODE_ENV !== 'production' ? otp : undefined,
      });
    }

    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });

    const expiry = rememberMe ? '24h' : '7d';
    const token  = signToken(user._id, expiry);
    user.password = undefined;

    res.json({ success: true, token, expiresIn: expiry, data: user });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/auth/me
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/auth/update
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, address, bio } = req.body;
    if (phone && !/^[6-9]\d{9}$/.test(phone))
      return res.status(400).json({ success: false, message: 'Enter a valid 10-digit Indian mobile number' });
    const user = await User.findByIdAndUpdate(
      req.user.id, { name, phone, address, bio }, { new: true, runValidators: false }
    );
    res.json({ success: true, data: user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/auth/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const errors = validatePassword(newPassword || '');
    if (errors.length > 0)
      return res.status(400).json({ success: false, message: 'Password does not meet requirements', errors });

    const user = await User.findById(req.user.id).select('+password');
    if (!(await user.matchPassword(currentPassword)))
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();
    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found with this email' });

    const otp       = makeOTP();
    const hashedOTP = hashOTP(otp);
    await User.updateOne(
      { _id: user._id },
      { $set: { otp: hashedOTP, otpExpires: new Date(Date.now() + 10 * 60 * 1000) } }
    );

    await sendOTPEmail(email, user.name, otp, 'password reset');
    console.log(`📧 Reset OTP [${otp}] → ${email}`);

    res.json({ success: true, message: 'Password reset code sent to your email',
      devOTP: process.env.NODE_ENV !== 'production' ? otp : undefined });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const errors = validatePassword(newPassword || '');
    if (errors.length > 0)
      return res.status(400).json({ success: false, message: 'Password does not meet requirements', errors });

    const user = await User.findOne({ email: email?.toLowerCase() });
    if (!user)
      return res.status(404).json({ success: false, message: 'No account found' });

    const hashed = hashOTP(String(otp));
    if (user.otp !== hashed)
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    if (!user.otpExpires || user.otpExpires < new Date())
      return res.status(400).json({ success: false, message: 'OTP expired. Request a new one.' });

    user.password = newPassword;
    user.otp      = undefined;
    user.otpExpires = undefined;
    await user.save();
    sendToken(user, 200, res);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.validatePasswordStrength = (req, res) => {
  const errors = validatePassword(req.body.password || '');
  res.json({
    success:  true,
    valid:    errors.length === 0,
    errors,
    strength: errors.length === 0 ? 'strong' : errors.length <= 2 ? 'medium' : 'weak',
  });
};

// ── @route POST /api/auth/admin-login ─────────────────────────
exports.adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const admin = await User.findOne({ email: email.toLowerCase(), role: 'admin', isVerified: true }).select('+password');
    if (!admin)
      return res.status(404).json({ success: false, message: 'No admin account found. Run: node seedAdmin.js from project root.' });

    if (!admin.isActive)
      return res.status(401).json({ success: false, message: 'Admin account deactivated.' });

    const ok = await admin.matchPassword(password);
    if (!ok)
      return res.status(401).json({ success: false, message: 'Incorrect password.' });

    await User.updateOne({ _id: admin._id }, { $set: { lastLogin: new Date() } });
    sendToken(admin, 200, res);
  } catch (err) {
    console.error('Admin login error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};
