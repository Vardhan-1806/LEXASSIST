/**
 * LEXASSIST — Admin Controller (COMPLETE)
 * Full lawyer verification, user management, analytics
 */

const User        = require('../models/User');
const Lawyer      = require('../models/Lawyer');
const Case        = require('../models/Case');
const Appointment = require('../models/Appointment');
const { sendLawyerVerifiedEmail, sendLawyerRejectedEmail, sendEmail } = require('../utils/emailService');

// @route GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalCitizens, totalLawyers, totalCases, totalAppts, pendingVerifications, totalUsers, totalAllLawyers] = await Promise.all([
      User.countDocuments({ role:'citizen' }),
      Lawyer.countDocuments({ isVerified:true }),
      Case.countDocuments(),
      Appointment.countDocuments(),
      Lawyer.countDocuments({ isVerified:false }),
      User.countDocuments(),
      Lawyer.countDocuments(),
    ]);

    const recentUsers = await User.find().sort('-createdAt').limit(8).select('name email role createdAt isActive');
    const recentCases = await Case.find().sort('-createdAt').limit(5)
      .populate('citizen','name').select('title caseType status priority createdAt');

    res.json({ success:true, data:{ totalCitizens, totalLawyers, totalCases, totalAppts, pendingVerifications, totalUsers, totalAllLawyers, recentUsers, recentCases } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/admin/lawyers/pending
exports.getPendingLawyers = async (req, res) => {
  try {
    const lawyers = await Lawyer.find({ isVerified:false })
      .populate('user','name email phone createdAt isActive')
      .sort('-createdAt');
    res.json({ success:true, count:lawyers.length, data:lawyers });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/admin/lawyers
exports.getAllLawyers = async (req, res) => {
  try {
    const { status, page=1, limit=20 } = req.query;
    const filter = {};
    if (status === 'verified') filter.isVerified = true;
    if (status === 'pending')  filter.isVerified = false;
    if (status === 'rejected') filter.isRejected = true;

    const lawyers = await Lawyer.find(filter)
      .populate('user','name email phone createdAt')
      .sort('-createdAt')
      .skip((page-1)*limit).limit(+limit);
    const total = await Lawyer.countDocuments(filter);
    res.json({ success:true, count:lawyers.length, total, data:lawyers });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/admin/lawyers/:id
exports.getLawyerDetails = async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id)
      .populate('user','name email phone createdAt lastLogin isActive');
    if (!lawyer) return res.status(404).json({ success:false, message:'Lawyer not found' });

    const [appointments, cases] = await Promise.all([
      Appointment.countDocuments({ lawyer: lawyer.user._id }),
      Case.countDocuments({ lawyer: lawyer.user._id }),
    ]);

    res.json({ success:true, data:{ ...lawyer.toObject(), appointmentCount:appointments, caseCount:cases } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/admin/lawyers/:id/verify
exports.verifyLawyer = async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id).populate('user','name email');
    if (!lawyer) return res.status(404).json({ success:false, message:'Lawyer not found' });

    lawyer.isVerified   = true;
    lawyer.isRejected   = false;
    lawyer.verifiedAt   = new Date();
    lawyer.rejectedAt   = undefined;
    lawyer.rejectReason = undefined;
    await lawyer.save();

    await sendLawyerVerifiedEmail({ email: lawyer.user.email }, lawyer.user.name).catch(console.error);

    res.json({ success:true, message:'Lawyer verified and notified', data:lawyer });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/admin/lawyers/:id/reject
exports.rejectLawyer = async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success:false, message:'Rejection reason is required' });

    const lawyer = await Lawyer.findById(req.params.id).populate('user','name email');
    if (!lawyer) return res.status(404).json({ success:false, message:'Lawyer not found' });

    lawyer.isVerified   = false;
    lawyer.isRejected   = true;
    lawyer.rejectedAt   = new Date();
    lawyer.rejectReason = reason;
    await lawyer.save();

    await sendLawyerRejectedEmail({ email: lawyer.user.email }, lawyer.user.name, reason).catch(console.error);

    res.json({ success:true, message:'Lawyer rejected and notified' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const { role, page=1, limit=20, search } = req.query;
    const filter = {};
    if (role)   filter.role = role;
    if (search) filter.$or  = [{ name: new RegExp(search,'i') }, { email: new RegExp(search,'i') }];

    const users = await User.find(filter).sort('-createdAt').skip((page-1)*limit).limit(+limit).select('-password');
    const total = await User.countDocuments(filter);
    res.json({ success:true, count:users.length, total, data:users });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/admin/users/:id/toggle
exports.toggleUserActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success:false, message:'Cannot deactivate admin' });

    user.isActive = !user.isActive;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: `Your LEXASSIST account has been ${user.isActive ? 'activated' : 'deactivated'}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <h2 style="color:#0d1b35">Account ${user.isActive ? 'Activated' : 'Deactivated'}</h2>
        <p style="color:#64748b">Hi ${user.name}, your LEXASSIST account has been <strong>${user.isActive ? 'activated' : 'deactivated'}</strong> by an administrator.</p>
        ${user.isActive ? '<p style="color:#64748b">You can now log in and use the platform.</p>' : '<p style="color:#64748b">If you believe this is a mistake, please contact support.</p>'}
      </div>`
    }).catch(console.error);

    res.json({ success:true, message:`User ${user.isActive?'activated':'deactivated'}`, data:{ isActive:user.isActive } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success:false, message:'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success:false, message:'Cannot delete admin' });

    await sendEmail({
      to: user.email,
      subject: 'Your LEXASSIST account has been removed',
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
        <h2 style="color:#0d1b35">Account Removed</h2>
        <p style="color:#64748b">Hi ${user.name}, your LEXASSIST account has been permanently removed by an administrator. If you believe this is a mistake, please contact support.</p>
      </div>`
    }).catch(console.error);

    await user.deleteOne();
    res.json({ success:true, message:'User deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/admin/analytics
exports.getAnalytics = async (req, res) => {
  try {
    const [casesByType, casesByStatus, apptByStatus, monthlyReg] = await Promise.all([
      Case.aggregate([{ $group:{ _id:'$caseType', count:{$sum:1} } }, {$sort:{count:-1}}]),
      Case.aggregate([{ $group:{ _id:'$status',   count:{$sum:1} } }]),
      Appointment.aggregate([{ $group:{ _id:'$status', count:{$sum:1} } }]),
      User.aggregate([
        { $group:{ _id:{ month:{$month:'$createdAt'}, year:{$year:'$createdAt'} }, count:{$sum:1} } },
        { $sort:{ '_id.year':1, '_id.month':1 } },
        { $limit:12 }
      ]),
    ]);
    res.json({ success:true, data:{ casesByType, casesByStatus, apptByStatus, monthlyReg } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/admin/broadcast
exports.broadcastNotification = async (req, res) => {
  try {
    const { title, message, role, specificEmail } = req.body;

    let users = [];
    if (specificEmail) {
      const u = await User.findOne({ email: specificEmail.toLowerCase() });
      if (!u) return res.status(404).json({ success:false, message:`No user found with email ${specificEmail}` });
      users = [u];
    } else {
      const filter = role ? { role } : {};
      users = await User.find(filter).select('_id email name');
    }

    let sent = 0;
    for (const u of users) {
      if (u.email) {
        await sendEmail({
          to:      u.email,
          subject: title,
          html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
            <div style="background:linear-gradient(135deg,#0d1b35,#1f3461);padding:22px;text-align:center;border-radius:12px 12px 0 0">
              <div style="color:#c9a84c;font-size:1.4rem;font-weight:900">LEX<span style="color:#fff">ASSIST</span></div>
            </div>
            <div style="background:#fff;padding:28px;border-radius:0 0 12px 12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
              <h2 style="color:#0d1b35">${title}</h2>
              <p style="color:#64748b;line-height:1.7;white-space:pre-wrap">${message}</p>
              <hr style="border:none;border-top:1px solid #f1f5f9;margin:20px 0">
              <p style="color:#94a3b8;font-size:0.75rem;text-align:center">© 2024 LEXASSIST | Free Legal Aid: <a href="tel:15100" style="color:#c9a84c">15100</a></p>
            </div>
          </div>`
        }).catch(console.error);
        sent++;
      }
    }

    res.json({ success:true, message:`Broadcast sent to ${sent} user${sent!==1?'s':''} successfully` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};