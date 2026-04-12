const Lawyer = require('../models/Lawyer');
const User   = require('../models/User');
const { sendNewLawyerAlert, sendEmail } = require('../utils/emailService');
const { Review } = require('../models/Extras');

// @route GET /api/lawyers
exports.getLawyers = async (req, res) => {
  try {
    const { specialization, city, minExp, maxFee, search, page = 1, limit = 12 } = req.query;
    const filter = { isVerified: true };

    if (specialization) filter.specializations = { $in: [specialization] };
    if (city) filter['location.city'] = new RegExp(city, 'i');
    if (minExp) filter.experience = { $gte: parseInt(minExp) };
    if (maxFee) filter.consultationFee = { $lte: parseInt(maxFee) };

    const lawyers = await Lawyer.find(filter)
      .populate('user', 'name email profilePhoto')
      .sort('-rating -totalReviews')
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Lawyer.countDocuments(filter);

    res.json({ success: true, count: lawyers.length, total, pages: Math.ceil(total / limit), data: lawyers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/lawyers/:id
exports.getLawyerById = async (req, res) => {
  try {
    const lawyer = await Lawyer.findById(req.params.id).populate('user', 'name email phone profilePhoto');
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer not found' });

    const reviews = await Review.find({ lawyer: lawyer.user })
      .populate('citizen', 'name profilePhoto')
      .sort('-createdAt')
      .limit(10);

    res.json({ success: true, data: { ...lawyer.toObject(), reviews } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/lawyers/register
exports.registerAsLawyer = async (req, res) => {
  try {
    const existing = await Lawyer.findOne({ user: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already registered as lawyer' });

    const lawyer = await Lawyer.create({ user: req.user.id, ...req.body, isVerified: false });
    await User.findByIdAndUpdate(req.user.id, { role: 'lawyer' });

    // Notify all admins by email
    const admins = await User.find({ role: 'admin' }).select('_id email');
    for (const admin of admins) {
      sendEmail({
        to: admin.email,
        subject: '⚖️ New Lawyer Registration – Action Required | LEXASSIST',
        html: `<div style="font-family:Arial,sans-serif;padding:28px;max-width:580px;margin:0 auto;background:#fff;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)"><div style="background:linear-gradient(135deg,#0d1b35,#1f3461);padding:20px;border-radius:8px;margin-bottom:20px;text-align:center"><h2 style="color:#c9a84c;margin:0">LEXASSIST Admin Alert</h2></div><h3 style="color:#0d1b35">New Lawyer Registration Requires Verification</h3><table style="width:100%;border-collapse:collapse;margin:16px 0"><tr><td style="padding:8px 0;font-weight:600;color:#0d1b35;width:40%">Name</td><td style="color:#64748b">${req.user.name}</td></tr><tr><td style="padding:8px 0;font-weight:600;color:#0d1b35">Bar Council ID</td><td style="color:#64748b">${req.body.barCouncilId || 'Not provided'}</td></tr><tr><td style="padding:8px 0;font-weight:600;color:#0d1b35">Specialization</td><td style="color:#64748b">${(req.body.specializations || []).join(', ') || 'Not specified'}</td></tr><tr><td style="padding:8px 0;font-weight:600;color:#0d1b35">Experience</td><td style="color:#64748b">${req.body.experience || 0} years</td></tr></table><a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard/admin" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:12px 28px;border-radius:50px;font-weight:700;text-decoration:none">Review & Verify →</a></div>`
      }).catch(console.error);
    }

    res.status(201).json({ success: true, data: lawyer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route PUT /api/lawyers/profile
exports.updateLawyerProfile = async (req, res) => {
  try {
    const lawyer = await Lawyer.findOneAndUpdate(
      { user: req.user.id }, req.body, { new: true, runValidators: true }
    );
    if (!lawyer) return res.status(404).json({ success: false, message: 'Lawyer profile not found' });
    res.json({ success: true, data: lawyer });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route POST /api/lawyers/:id/review
exports.addReview = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const existing = await Review.findOne({ lawyer: req.params.id, citizen: req.user.id });
    if (existing) return res.status(400).json({ success: false, message: 'Already reviewed this lawyer' });

    const review = await Review.create({ lawyer: req.params.id, citizen: req.user.id, rating, comment });

    const all = await Review.find({ lawyer: req.params.id });
    const avg = all.reduce((s, r) => s + r.rating, 0) / all.length;
    await Lawyer.findOneAndUpdate({ user: req.params.id }, { rating: avg.toFixed(1), totalReviews: all.length });

    res.status(201).json({ success: true, data: review });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// @route GET /api/lawyers/specializations
exports.getSpecializations = (req, res) => {
  const specs = ['Criminal', 'Civil', 'Family', 'Corporate', 'Property', 'Labour', 'Cyber', 'Taxation', 'Constitutional', 'Environmental', 'Other'];
  res.json({ success: true, data: specs });
};