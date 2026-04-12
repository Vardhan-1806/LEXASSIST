const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const crypto   = require('crypto');

const userSchema = new mongoose.Schema({
  userId:       { type: String, unique: true, sparse: true },
  name:         { type: String, required: true, trim: true },
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:     { type: String, required: true, minlength: 6, select: false },
  role:         { type: String, enum:['citizen','lawyer','admin'], default:'citizen' },
  phone:        { type: String, trim: true },
  address:      { type: String },
  profilePhoto: { type: String, default: '' },
  bio:          { type: String },
  isVerified:   { type: Boolean, default: false },
  isActive:     { type: Boolean, default: true },
  lastLogin:    { type: Date },
  otp:          String,
  otpExpires:   Date,
  otpVerified:  { type: Boolean, default: false },
  resetPasswordToken:   String,
  resetPasswordExpires: Date,
  rememberToken:        String,
  rememberTokenExpires: Date,
}, { timestamps: true });

// Auto-generate userId
userSchema.pre('save', async function(next) {
  if (!this.userId && this.isNew) {
    try {
      const count = await mongoose.model('User').countDocuments();
      const roleCode = { citizen:'CIT', lawyer:'LAW', admin:'ADM' }[this.role] || 'USR';
      this.userId = `LEX-${roleCode}-${String(count + 1).padStart(5,'0')}`;
    } catch(e) {}
  }
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = async function(entered) {
  return await bcrypt.compare(entered, this.password);
};

userSchema.methods.generateOTP = function() {
  const otp       = String(Math.floor(1000 + Math.random() * 9000)); // 4 digits
  this.otp        = crypto.createHash('sha256').update(otp).digest('hex');
  this.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
  return otp;
};

userSchema.methods.verifyOTP = function(enteredOTP) {
  const hashed = crypto.createHash('sha256').update(String(enteredOTP)).digest('hex');
  return this.otp === hashed && this.otpExpires > new Date();
};

userSchema.methods.generatePasswordResetToken = function() {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken   = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
  return token;
};

module.exports = mongoose.model('User', userSchema);
