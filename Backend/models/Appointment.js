const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  citizen:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lawyer:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  case:        { type: mongoose.Schema.Types.ObjectId, ref: 'Case' },
  date:        { type: Date, required: true },
  timeSlot:    { start: String, end: String },
  type:        { type: String, enum: ['Court Argument', 'Court Preparation'], default: 'Consultation' },
  mode:        { type: String, enum: ['In-Person', 'Online', 'Phone'], default: 'In-Person' },
  status:      { type: String, enum: ['Pending', 'Confirmed', 'Cancelled', 'Completed', 'No-Show'], default: 'Pending' },
  notes:       String,
  meetingLink: String,   // for online appointments
  fee:         Number,
  isPaid:      { type: Boolean, default: false },
  cancelReason:String,
  reminderSent:{ type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model('Appointment', appointmentSchema);
