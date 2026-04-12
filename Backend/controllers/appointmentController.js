const Appointment = require('../models/Appointment');
const { Notification, CalendarEvent } = require('../models/Extras');
const Lawyer  = require('../models/Lawyer');
const User    = require('../models/User');
const {
  sendAppointmentConfirmation,
  sendAppointmentStatusUpdate
} = require('../utils/emailService');

// @route GET /api/appointments
exports.getAppointments = async (req, res) => {
  try {
    const filter = {};
    if (req.user.role === 'citizen') filter.citizen = req.user.id;
    if (req.user.role === 'lawyer')  filter.lawyer  = req.user.id;

    const appointments = await Appointment.find(filter)
      .populate('citizen', 'name email phone')
      .populate('lawyer',  'name email phone')
      .populate('case',    'caseNumber title')
      .sort('-date');

    res.json({ success:true, count:appointments.length, data:appointments });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route POST /api/appointments — Book appointment
exports.bookAppointment = async (req, res) => {
  try {
    const { lawyerId, date, timeSlot, type, notes, caseId } = req.body;

    // Check slot availability
    const conflict = await Appointment.findOne({
      lawyer: lawyerId,
      date:   { $gte: new Date(new Date(date).setHours(0,0,0,0)), $lt: new Date(new Date(date).setHours(23,59,59,999)) },
      'timeSlot.start': timeSlot.start,
      status: { $nin: ['Cancelled'] },
    });
    if (conflict) return res.status(400).json({ success:false, message:'This time slot is not available. Please choose another.' });

    const lawyer     = await Lawyer.findOne({ user: lawyerId });
    const lawyerUser = await User.findById(lawyerId).select('name email');
    const citizen    = await User.findById(req.user.id).select('name email');

    const appointment = await Appointment.create({
      citizen: req.user.id,
      lawyer:  lawyerId,
      case:    caseId || undefined,
      date, timeSlot, type, notes,
      fee: lawyer?.consultationFee || 0,
    });

    // Calendar event for citizen
    await CalendarEvent.create({
      user:      req.user.id,
      title:     `Appointment with ${lawyerUser?.name||'Lawyer'} – ${type}`,
      startDate: date,
      type:      'Appointment',
      case:      caseId || undefined,
      color:     '#4f46e5',
    });

    // In-app notification for lawyer
    await Notification.create({
      user:    lawyerId,
      title:   '📅 New Appointment Request',
      message: `${citizen?.name} booked a ${type} on ${new Date(date).toLocaleDateString('en-IN')}`,
      type:    'appointment',
      link:    '/appointments',
    });

    // Send confirmation emails to both
    if (citizen && lawyerUser) {
      sendAppointmentConfirmation(citizen, lawyerUser, appointment).catch(console.error);
    }

    res.status(201).json({ success:true, data:appointment });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route PUT /api/appointments/:id/status — Update status
exports.updateStatus = async (req, res) => {
  try {
    const { status, cancelReason, meetingLink } = req.body;
    const appt = await Appointment.findById(req.params.id)
      .populate('citizen', 'name email')
      .populate('lawyer',  'name email');

    if (!appt) return res.status(404).json({ success:false, message:'Appointment not found' });

    appt.status = status;
    if (cancelReason) appt.cancelReason = cancelReason;
    if (meetingLink)  appt.meetingLink  = meetingLink;
    await appt.save();

    // Notify the other party
    const notifyUser = req.user.role==='lawyer' ? appt.citizen._id : appt.lawyer._id;
    const notifyEmail= req.user.role==='lawyer' ? appt.citizen.email : appt.lawyer.email;

    await Notification.create({
      user:    notifyUser,
      title:   `📅 Appointment ${status}`,
      message: `Your appointment on ${new Date(appt.date).toLocaleDateString('en-IN')} has been ${status.toLowerCase()}.`,
      type:    'appointment',
      link:    '/appointments',
    });

    // Send email to the other party
    const targetUser = req.user.role==='lawyer' ? appt.citizen : appt.lawyer;
    if (targetUser?.email) {
      sendAppointmentStatusUpdate(targetUser, appt, status).catch(console.error);
    }

    res.json({ success:true, data:appt });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};

// @route GET /api/appointments/slots — Available time slots
exports.getAvailableSlots = async (req, res) => {
  try {
    const { lawyerId, date } = req.query;
    const ALL_SLOTS = ['09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00'];

    const booked = await Appointment.find({
      lawyer: lawyerId,
      date:   { $gte: new Date(new Date(date).setHours(0,0,0,0)), $lt: new Date(new Date(date).setHours(23,59,59,999)) },
      status: { $nin: ['Cancelled'] },
    }).select('timeSlot');

    const bookedSlots = booked.map(a => a.timeSlot.start);
    const available   = ALL_SLOTS.filter(s => !bookedSlots.includes(s));

    res.json({ success:true, data:available });
  } catch(err) { res.status(500).json({ success:false, message:err.message }); }
};
