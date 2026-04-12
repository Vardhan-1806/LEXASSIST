const mongoose = require('mongoose');

// ── Review ──────────────────────────────────────────────────
const reviewSchema = new mongoose.Schema({
  lawyer:    { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  citizen:   { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  rating:    { type: Number, required:true, min:1, max:5 },
  comment:   String,
  isVisible: { type: Boolean, default:true },
}, { timestamps:true });

// ── Document ─────────────────────────────────────────────────
const documentSchema = new mongoose.Schema({
  title:       { type: String, required:true },
  case:        { type: mongoose.Schema.Types.ObjectId, ref:'Case' },
  uploadedBy:  { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  fileUrl:     { type: String, required:true },
  fileType:    String,
  fileSize:    Number,
  originalName:String,
  isPublic:    { type: Boolean, default:false },
  tags:        [String],
  description: String,
  // Share functionality
  shareToken:  { type: String, unique:true, sparse:true },
  shareExpiry: Date,
  sharedWith:  [{ type: mongoose.Schema.Types.ObjectId, ref:'User' }],
  downloadCount:{ type: Number, default:0 },
}, { timestamps:true });

// ── Notification ──────────────────────────────────────────────
const notificationSchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title:   { type: String, required:true },
  message: { type: String, required:true },
  type:    { type: String, enum:['appointment','case','hearing','system','reminder','document'], default:'system' },
  isRead:  { type: Boolean, default:false },
  link:    String,
}, { timestamps:true });

// ── ChatHistory ───────────────────────────────────────────────
const chatHistorySchema = new mongoose.Schema({
  user:    { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  session: { type: String, required:true },
  messages:[{
    role:      { type: String, enum:['user','assistant'] },
    content:   String,
    timestamp: { type: Date, default:Date.now },
    sources:   [String],
  }],
}, { timestamps:true });

// ── CalendarEvent ─────────────────────────────────────────────
const calendarEventSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref:'User', required:true },
  title:       { type: String, required:true },
  description: String,
  startDate:   { type: Date, required:true },
  endDate:     Date,
  type:        { type: String, enum:['Hearing','Appointment','Deadline','Reminder','Other'], default:'Other' },
  case:        { type: mongoose.Schema.Types.ObjectId, ref:'Case' },
  color:       { type: String, default:'#4f46e5' },
  isAllDay:    { type: Boolean, default:false },
}, { timestamps:true });

module.exports = {
  Review:        mongoose.model('Review',        reviewSchema),
  Document:      mongoose.model('Document',      documentSchema),
  Notification:  mongoose.model('Notification',  notificationSchema),
  ChatHistory:   mongoose.model('ChatHistory',   chatHistorySchema),
  CalendarEvent: mongoose.model('CalendarEvent', calendarEventSchema),
};
