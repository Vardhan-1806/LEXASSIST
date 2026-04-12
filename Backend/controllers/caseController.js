/**
 * LEXASSIST — Case Controller (COMPLETE)
 * - Lawyer can update timeline stages
 * - Citizen gets real-time notification when updated
 * - Case ID search for both citizen and lawyer
 * - AI priority scoring
 */

const Case    = require('../models/Case');
const User    = require('../models/User');
const { Notification, CalendarEvent } = require('../models/Extras');
const { sendEmail } = require('../utils/emailService');
const { calculateLawyerRating } = require('../utils/lawyerRating');

// Generate unique case number
const generateCaseNumber = async () => {
  const count = await Case.countDocuments();
  const year  = new Date().getFullYear();
  return `LEX-${year}-${String(count + 1).padStart(5,'0')}`;
};

// @route GET /api/cases
exports.getCases = async (req, res) => {
  try {
    const { status, priority, caseId, caseNumber } = req.query;
    const filter = {};

    // Search by case ID or case number (both citizen and lawyer)
    if (caseId || caseNumber) {
      const searchVal = caseId || caseNumber;
      filter.$or = [
        { caseNumber: new RegExp(searchVal,'i') },
        { caseId:     new RegExp(searchVal,'i') },
      ];
    } else {
      // Role-based filtering
      if (req.user.role === 'citizen') filter.citizen = req.user.id;
      if (req.user.role === 'lawyer')  filter.lawyer  = req.user.id;
    }

    if (status)   filter.status   = status;
    if (priority) filter.priority = priority;
    if (!req.query.includeArchived) filter.isArchived = false;

    const cases = await Case.find(filter)
      .populate('citizen','name email phone userId')
      .populate('lawyer', 'name email userId')
      .sort('-priorityScore -updatedAt');

    res.json({ success:true, count:cases.length, data:cases });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/cases/stats
exports.getCaseStats = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'citizen') filter.citizen = req.user.id;
    if (req.user.role === 'lawyer')  filter.lawyer  = req.user.id;

    const [total, active, pending, closed, highPriority, critical] = await Promise.all([
      Case.countDocuments(filter),
      Case.countDocuments({ ...filter, status:'Active' }),
      Case.countDocuments({ ...filter, status:'Pending' }),
      Case.countDocuments({ ...filter, status:{ $in:['Closed','Dismissed'] } }),
      Case.countDocuments({ ...filter, priority:'High' }),
      Case.countDocuments({ ...filter, priority:'Critical' }),
    ]);

    res.json({ success:true, data:{ total, active, pending, closed, highPriority, critical } });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/cases/search?q=
exports.searchCase = async (req, res) => {
  try {
    const q = req.query.q || '';
    const cases = await Case.find({
      $and: [
        { $or: [{ citizen:req.user.id }, { lawyer:req.user.id }] },
        { $or: [
          { caseNumber: new RegExp(q,'i') },
          { caseId:     new RegExp(q,'i') },
          { title:      new RegExp(q,'i') },
        ]}
      ]
    }).populate('citizen','name userId').populate('lawyer','name userId').limit(10);
    res.json({ success:true, data:cases });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/cases
exports.createCase = async (req, res) => {
  try {
    const caseNumber = await generateCaseNumber();

    // Lawyer can file on behalf of citizen (citizenId in body), or file for themselves
    let citizenId = req.user.id;
    if (req.user.role === 'lawyer' && req.body.citizenId) {
      citizenId = req.body.citizenId;
    }

    const count = await Case.countDocuments({ citizen: citizenId });
    const user  = await User.findById(citizenId).select('userId name');
    const caseId = `${user?.userId||'LEX'}-C${String(count+1).padStart(3,'0')}`;

    const newCase = await Case.create({
      ...req.body,
      caseNumber,
      caseId,
      citizen:   citizenId,
      lawyer:    req.user.role === 'lawyer' ? req.user.id : req.body.lawyerId || undefined,
      filedDate: new Date(),
      stages: [
        { name:'Case Filed',         description:'Case has been registered on LEXASSIST', isCompleted:true, completedAt:new Date() },
        { name:'Documents Submitted',description:'All required documents submitted', isCompleted:false },
        { name:'Hearing Scheduled',  description:'First hearing date assigned by court', isCompleted:false },
        { name:'Evidence Review',    description:'Evidence and arguments presented', isCompleted:false },
        { name:'Judgment',           description:'Final verdict by court', isCompleted:false },
      ],
      timeline: [{ event:`Case filed: ${req.body.title}`, date:new Date(), addedBy:req.user.id, role:'citizen' }]
    });

    // Add to citizen's calendar
    if (req.body.nextHearingDate) {
      await CalendarEvent.create({
        user:      req.user.id,
        title:     `Hearing: ${req.body.title}`,
        startDate: req.body.nextHearingDate,
        type:      'Hearing',
        case:      newCase._id,
        color:     '#ef4444',
      });
    }

    res.status(201).json({ success:true, data:newCase });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/cases/:id/stage/:stageIndex — Lawyer updates stage
exports.updateStage = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id).populate('citizen','name email');
    if (!caseDoc) return res.status(404).json({ success:false, message:'Case not found' });

    // Only lawyer or citizen can update
    const isLawyer  = caseDoc.lawyer?.toString() === req.user.id;
    const isCitizen = caseDoc.citizen._id.toString() === req.user.id;
    if (!isLawyer && !isCitizen && req.user.role !== 'admin')
      return res.status(403).json({ success:false, message:'Not authorized to update this case' });

    const stageIdx = parseInt(req.params.stageIndex);
    if (stageIdx < 0 || stageIdx >= caseDoc.stages.length)
      return res.status(400).json({ success:false, message:'Invalid stage index' });

    // Update stage
    caseDoc.stages[stageIdx].isCompleted = true;
    caseDoc.stages[stageIdx].completedAt  = new Date();
    caseDoc.stages[stageIdx].notes        = req.body.notes || '';
    caseDoc.stages[stageIdx].updatedBy    = req.user.id;
    caseDoc.stages[stageIdx].updatedAt    = new Date();

    // Add to timeline
    const stageName = caseDoc.stages[stageIdx].name;
    caseDoc.timeline.push({
      event:   `Stage completed: ${stageName}${req.body.notes ? ` — ${req.body.notes}` : ''}`,
      date:    new Date(),
      addedBy: req.user.id,
      role:    req.user.role,
    });

    // Auto-update case status
    const completedCount = caseDoc.stages.filter(s=>s.isCompleted).length;
    if (completedCount === caseDoc.stages.length) {
      caseDoc.status      = 'Closed';
      caseDoc.closedDate  = new Date();
      caseDoc.timeTakenDays = Math.ceil((new Date() - new Date(caseDoc.filedDate)) / 86400000);
      if (caseDoc.lawyer) calculateLawyerRating(caseDoc.lawyer).catch(console.error);
    } else if (completedCount > 0) {
      caseDoc.status = 'Active';
    }

    await caseDoc.save();

    // Notify citizen in real-time (in-app + email)
    if (isLawyer && caseDoc.citizen) {
      await Notification.create({
        user:    caseDoc.citizen._id,
        title:   `📋 Case Update: ${caseDoc.caseNumber}`,
        message: `Stage "${stageName}" has been completed by your lawyer.${req.body.notes ? ` Note: ${req.body.notes}` : ''}`,
        type:    'case',
        link:    '/cases',
      });

      // Email notification to citizen
      sendEmail({
        to:      caseDoc.citizen.email,
        subject: `📋 Case Update — ${caseDoc.caseNumber} | LEXASSIST`,
        html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px">
          <div style="background:linear-gradient(135deg,#0d1b35,#1f3461);padding:20px;border-radius:8px;text-align:center;margin-bottom:20px">
            <h2 style="color:#c9a84c;margin:0">LEX<span style="color:#fff">ASSIST</span></h2>
          </div>
          <h3 style="color:#0d1b35">Case Timeline Updated</h3>
          <p style="color:#64748b">Your case <strong>${caseDoc.caseNumber}</strong> has been updated.</p>
          <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:8px;margin:16px 0">
            <p style="margin:0;color:#16a34a;font-weight:600">✅ Stage Completed: ${stageName}</p>
            ${req.body.notes?`<p style="margin:8px 0 0;color:#64748b;font-size:0.84rem">Note from lawyer: ${req.body.notes}</p>`:''}
          </div>
          <a href="${process.env.CLIENT_URL||'http://localhost:5000'}/cases" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:11px 24px;border-radius:50px;font-weight:700;text-decoration:none">View Case →</a>
        </div>`
      }).catch(console.error);
    }

    res.json({ success:true, data:caseDoc, message:`Stage "${stageName}" marked as complete` });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/cases/:id
exports.updateCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.status(404).json({ success:false, message:'Case not found' });

    // Only owner or assigned lawyer
    const isCitizen = caseDoc.citizen.toString() === req.user.id;
    const isLawyer  = caseDoc.lawyer?.toString() === req.user.id;
    if (!isCitizen && !isLawyer && req.user.role!=='admin')
      return res.status(403).json({ success:false, message:'Not authorized' });

    Object.assign(caseDoc, req.body);

    // If hearing date changed, update calendar
    if (req.body.nextHearingDate) {
      await CalendarEvent.findOneAndUpdate(
        { case:caseDoc._id, type:'Hearing', user:caseDoc.citizen },
        { startDate:req.body.nextHearingDate, title:`Hearing: ${caseDoc.title}` },
        { upsert:true }
      );
    }

    await caseDoc.save();
    res.json({ success:true, data:caseDoc });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/cases/:id/timeline — Add timeline entry
exports.addTimeline = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id).populate('citizen','name email');
    if (!caseDoc) return res.status(404).json({ success:false, message:'Case not found' });

    caseDoc.timeline.push({ event:req.body.event, date:new Date(), addedBy:req.user.id, role:req.user.role });
    await caseDoc.save();

    // Notify citizen if lawyer added entry
    if (req.user.role === 'lawyer' && caseDoc.citizen) {
      await Notification.create({
        user:    caseDoc.citizen._id,
        title:   `📋 Case Note: ${caseDoc.caseNumber}`,
        message: req.body.event,
        type:    'case',
        link:    '/cases',
      });
    }

    res.json({ success:true, data:caseDoc });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/cases/:id/rate-lawyer — Citizen rates lawyer
exports.rateLawyer = async (req, res) => {
  try {
    const { rating, review } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ success:false, message:'Rating must be 1-5' });

    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.status(404).json({ success:false, message:'Case not found' });
    if (caseDoc.citizen.toString() !== req.user.id) return res.status(403).json({ success:false, message:'Only case owner can rate' });

    caseDoc.citizenRating = rating;
    caseDoc.citizenReview = review || '';
    await caseDoc.save();

    // Recalculate AI rating
    if (caseDoc.lawyer) await calculateLawyerRating(caseDoc.lawyer);

    res.json({ success:true, message:'Rating submitted successfully' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route DELETE /api/cases/:id
exports.deleteCase = async (req, res) => {
  try {
    const caseDoc = await Case.findById(req.params.id);
    if (!caseDoc) return res.status(404).json({ success:false, message:'Case not found' });
    if (caseDoc.citizen.toString() !== req.user.id && req.user.role !== 'admin')
      return res.status(403).json({ success:false, message:'Not authorized' });
    await caseDoc.deleteOne();
    res.json({ success:true, message:'Case deleted' });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};
