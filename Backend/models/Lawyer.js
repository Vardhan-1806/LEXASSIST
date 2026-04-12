const mongoose = require('mongoose');

const lawyerSchema = new mongoose.Schema({
  user:           { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  barCouncilId:   { type: String, required: true, unique: true },
  specializations:{ type: [String], enum: ['Criminal', 'Civil', 'Family', 'Corporate', 'Property', 'Labour', 'Cyber', 'Taxation', 'Constitutional', 'Environmental', 'Other'] },
  experience:     { type: Number, default: 0 },  // years
  bio:            { type: String },
  education:      [{ degree: String, institution: String, year: Number }],
  languages:      [String],
  location:       { city: String, state: String, pincode: String },
  consultationFee:{ type: Number, default: 0 },
  availability: [{
    day:       { type: String, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
    startTime: String,  // "09:00"
    endTime:   String,  // "17:00"
    isAvailable: { type: Boolean, default: true }
  }],
  rating:         { type: Number, default: 0, min: 0, max: 5 },
  totalReviews:   { type: Number, default: 0 },
  isVerified:     { type: Boolean, default: false },
  isRejected:     { type: Boolean, default: false },
  verifiedAt:     Date,
  rejectedAt:     Date,
  rejectReason:   String,
  totalCases:     { type: Number, default: 0 },
  activeCases:    { type: Number, default: 0 },
  closedCases:    { type: Number, default: 0 },
  wonCases:       { type: Number, default: 0 },

  // AI Rating System (0-5, calculated automatically)
  aiRating: { type: Number, default: 0, min: 0, max: 5 },
  aiRatingBreakdown: {
    caseSuccessRate:  { type: Number, default: 0 }, // % cases won/settled
    avgCaseRisk:      { type: Number, default: 0 }, // avg risk of cases handled
    avgTimeToResolve: { type: Number, default: 0 }, // avg days to close case
    citizenRating:    { type: Number, default: 0 }, // avg citizen review rating
    priorityCasesHandled: { type: Number, default: 0 }, // high/critical cases handled
  },
  aiRatingLastUpdated: Date,
}, { timestamps: true });

// Text search index
lawyerSchema.index({ specializations: 'text', 'location.city': 'text' });

module.exports = mongoose.model('Lawyer', lawyerSchema);
// Already has: user, barCouncilId, specializations, experience, bio, education,
// languages, location, consultationFee, availability, rating, totalReviews,
// isVerified, verifiedAt, isRejected, rejectedAt, rejectReason, totalCases, activeCases

// We need to update to add AI rating fields
