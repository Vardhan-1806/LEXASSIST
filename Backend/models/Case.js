const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema({
  // Unique human-readable IDs
  caseNumber: { type: String, required: true, unique: true },
  caseId:     { type: String, unique: true, sparse: true }, // e.g. LEX-CIT-2024-00001

  title:       { type: String, required: true },
  caseType:    { type: String, enum: ['Criminal','Civil','Family','Property','Labour','Corporate','Constitutional','Consumer','Cyber','Other'], required: true },
  description: { type: String },
  citizen:     { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  lawyer:      { type: mongoose.Schema.Types.ObjectId, ref:'User' },
  court:       { type: String },
  judge:       { type: String },

  status: { type: String, enum:['Pending','Active','On Hold','Closed','Dismissed','Appeal'], default:'Pending' },

  // Enhanced Priority System (multi-parameter)
  priority:       { type: String, enum:['Critical','High','Medium','Low'], default:'Medium' },
  priorityScore:  { type: Number, default: 0 }, // 0-100
  priorityReason: String,
  priorityParams: {
    hearingProximity: { type: Number, default: 0 }, // days till hearing
    caseRisk:         { type: Number, default: 0 }, // 0-10 risk score
    caseTypeWeight:   { type: Number, default: 0 }, // criminal > civil > others
    documentsPending: { type: Boolean, default: false },
    lawyerAssigned:   { type: Boolean, default: false },
  },

  // Timeline stages (updatable by lawyer)
  stages: [{
    name:        String,
    description: String,
    date:        Date,
    completedAt: Date,
    isCompleted: { type: Boolean, default: false },
    notes:       String,
    updatedBy:   { type: mongoose.Schema.Types.ObjectId, ref:'User' },
    updatedAt:   Date,
  }],

  nextHearingDate: Date,
  filedDate:       Date,
  closedDate:      Date,
  timeTakenDays:   Number, // auto-calculated on close

  documents:       [{ type: mongoose.Schema.Types.ObjectId, ref:'Document' }],

  timeline: [{
    event:   String,
    date:    { type: Date, default: Date.now },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref:'User' },
    role:    { type: String, enum:['citizen','lawyer','system'] },
  }],

  requiredActions: [String],
  notes:           String,
  isArchived:      { type: Boolean, default: false },

  // Outcome (for AI rating)
  outcome:         { type: String, enum:['Won','Lost','Settled','Dismissed','Ongoing'] },
  citizenRating:   { type: Number, min:1, max:5 }, // citizen rates lawyer after case
  citizenReview:   String,
}, { timestamps: true });

// Auto-calculate case priority score before save
caseSchema.pre('save', function(next) {
  const RISK_WEIGHTS = { Criminal:10, Constitutional:9, Family:7, Property:6, Labour:6, Civil:5, Corporate:4, Consumer:4, Cyber:5, Other:3 };
  const now = new Date();
  let score = 0;

  // 1. Hearing proximity (max 40 points)
  if (this.nextHearingDate) {
    const days = Math.ceil((new Date(this.nextHearingDate) - now) / 86400000);
    this.priorityParams.hearingProximity = days;
    if (days <= 1)       score += 40;
    else if (days <= 3)  score += 35;
    else if (days <= 7)  score += 25;
    else if (days <= 14) score += 15;
    else if (days <= 30) score += 8;
  }

  // 2. Case type risk (max 30 points)
  const riskScore = RISK_WEIGHTS[this.caseType] || 3;
  this.priorityParams.caseRisk = riskScore;
  score += riskScore * 3;

  // 3. No lawyer assigned (max 15 points)
  if (!this.lawyer) { score += 15; this.priorityParams.lawyerAssigned = false; }
  else this.priorityParams.lawyerAssigned = true;

  // 4. Documents pending (max 10 points)
  if (this.requiredActions?.length > 0) { score += 10; this.priorityParams.documentsPending = true; }

  // 5. Status bonus
  if (this.status === 'Active') score += 5;

  this.priorityScore = Math.min(score, 100);

  // Set priority label
  if (score >= 70)      { this.priority = 'Critical'; this.priorityReason = `Critical: ${this.caseType} case${this.nextHearingDate ? ` with hearing in ${this.priorityParams.hearingProximity} days` : ''}. Immediate attention required.`; }
  else if (score >= 45) { this.priority = 'High'; this.priorityReason = `High priority: ${this.caseType} case requiring attention soon.`; }
  else if (score >= 20) { this.priority = 'Medium'; this.priorityReason = `Medium priority: ${this.caseType} case in progress.`; }
  else                  { this.priority = 'Low'; this.priorityReason = `Low priority: ${this.caseType} case with no immediate deadlines.`; }

  next();
});

caseSchema.index({ caseNumber: 1 });
caseSchema.index({ caseId: 1 });
caseSchema.index({ citizen: 1 });
caseSchema.index({ lawyer: 1 });
caseSchema.index({ priorityScore: -1 });

module.exports = mongoose.model('Case', caseSchema);
