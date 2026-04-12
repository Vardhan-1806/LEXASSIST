/**
 * LEXASSIST — Database Seeder (FIXED - No double hashing)
 * Run from project root: node DataBase_Ai_Data/seed.js
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI not found in .env!');
  process.exit(1);
}
console.log('🔗 Connecting to:', process.env.MONGO_URI.replace(/:([^:@]+)@/, ':****@'));

// Import models
const User        = require('../Backend/models/User');
const Lawyer      = require('../Backend/models/Lawyer');
const Case        = require('../Backend/models/Case');
const Appointment = require('../Backend/models/Appointment');
const { CalendarEvent, Notification } = require('../Backend/models/Extras');

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Clear everything
  await Promise.all([User,Lawyer,Case,Appointment,CalendarEvent,Notification].map(M=>M.deleteMany({})));
  console.log('🗑️  Cleared old data');

  // Pre-hash all passwords — bypasses pre-save hook double-hash issue
  const adminHash  = await bcrypt.hash('Admin@123!', 12);
  const lawyerHash = await bcrypt.hash('Lawyer@123!', 12);
  const userHash   = await bcrypt.hash('User@123!', 12);

  // Use insertMany (skips pre-save middleware - no double hashing)
  const users = await User.insertMany([
    { name:'Admin LEXASSIST', email:'admin@lexassist.com', password:adminHash, role:'admin', phone:'9000000000', isVerified:true, isActive:true, userId:'LEX-ADM-00001' },
    { name:'Adv. Priya Sharma', email:'priya@lexassist.com', password:lawyerHash, role:'lawyer', phone:'9876543210', isVerified:true, isActive:true, userId:'LEX-LAW-00001' },
    { name:'Adv. Rajan Mehta',  email:'rajan@lexassist.com', password:lawyerHash, role:'lawyer', phone:'9876543211', isVerified:true, isActive:true, userId:'LEX-LAW-00002' },
    { name:'Rajesh Kumar', email:'rajesh@example.com', password:userHash, role:'citizen', phone:'9000000001', isVerified:true, isActive:true, userId:'LEX-CIT-00001' },
    { name:'Meena Patel',  email:'meena@example.com',  password:userHash, role:'citizen', phone:'9000000002', isVerified:true, isActive:true, userId:'LEX-CIT-00002' },
  ]);

  const [admin, priya, rajan, rajesh, meena] = users;

  // Lawyer profiles
  await Lawyer.insertMany([
    { user:priya._id, barCouncilId:'BAR/DL/2010/001', specializations:['Family','Civil','Criminal'], experience:14, bio:'Expert in family disputes, matrimonial cases, and criminal litigation.', isVerified:true, verifiedAt:new Date(), location:{city:'Hyderabad',state:'Telangana',pincode:'500001'}, languages:['Telugu','Hindi','English'], aiRating:4.5 },
    { user:rajan._id, barCouncilId:'BAR/MH/2008/002', specializations:['Criminal','Constitutional'], experience:16, bio:'Former public prosecutor with expertise in criminal litigation.', isVerified:true, verifiedAt:new Date(), location:{city:'Hyderabad',state:'Telangana',pincode:'500002'}, languages:['Telugu','Hindi','English'], aiRating:4.2 },
  ]);

  // Cases
  const cases = await Case.insertMany([
    { caseNumber:'LEX-2024-00001', caseId:'LEX-CIT-00001-C001', title:'Property Boundary Dispute', caseType:'Property', description:'Dispute with neighbour over land boundary.', citizen:rajesh._id, lawyer:priya._id, court:'City Civil Court, Hyderabad', status:'Active', priority:'High', priorityScore:65, nextHearingDate:new Date(Date.now()+5*864e5), filedDate:new Date('2024-01-15'),
      stages:[{name:'Case Filed',isCompleted:true,completedAt:new Date('2024-01-15')},{name:'Documents Submitted',isCompleted:true,completedAt:new Date('2024-01-22')},{name:'Hearing Scheduled',isCompleted:true,completedAt:new Date('2024-02-01')},{name:'Evidence Review',isCompleted:false},{name:'Judgment',isCompleted:false}],
      timeline:[{event:'Case filed by Rajesh Kumar',date:new Date('2024-01-15'),addedBy:rajesh._id,role:'citizen'}] },
    { caseNumber:'LEX-2024-00002', caseId:'LEX-CIT-00002-C001', title:'Section 420 IPC — Online Fraud', caseType:'Criminal', description:'Online cheating and fraud case.', citizen:meena._id, lawyer:rajan._id, court:'Sessions Court, Hyderabad', status:'Active', priority:'Critical', priorityScore:85, nextHearingDate:new Date(Date.now()+3*864e5), filedDate:new Date('2024-01-10'),
      stages:[{name:'Case Filed',isCompleted:true,completedAt:new Date('2024-01-10')},{name:'Documents Submitted',isCompleted:true,completedAt:new Date('2024-01-18')},{name:'Hearing Scheduled',isCompleted:false},{name:'Evidence Review',isCompleted:false},{name:'Judgment',isCompleted:false}],
      timeline:[{event:'Case filed by Meena Patel',date:new Date('2024-01-10'),addedBy:meena._id,role:'citizen'}] },
  ]);

  // Appointments
  await Appointment.insertMany([
    { citizen:rajesh._id, lawyer:priya._id, case:cases[0]._id, date:new Date(Date.now()+2*864e5), timeSlot:{start:'10:00',end:'11:00'}, type:'Court Argument', status:'Confirmed' },
    { citizen:meena._id,  lawyer:rajan._id, case:cases[1]._id, date:new Date(Date.now()+5*864e5), timeSlot:{start:'14:00',end:'15:00'}, type:'Court Preparation', status:'Confirmed' },
  ]);

  // Calendar events
  await CalendarEvent.insertMany([
    { user:rajesh._id, title:'Property Case Hearing', startDate:new Date(Date.now()+5*864e5), type:'Hearing', case:cases[0]._id, color:'#ef4444' },
    { user:priya._id,  title:'Property Case Hearing — Rajesh Kumar', startDate:new Date(Date.now()+5*864e5), type:'Hearing', case:cases[0]._id, color:'#ef4444' },
    { user:meena._id,  title:'Criminal Case Hearing', startDate:new Date(Date.now()+3*864e5), type:'Hearing', case:cases[1]._id, color:'#ef4444' },
    { user:rajan._id,  title:'Fraud Case Hearing — Meena Patel', startDate:new Date(Date.now()+3*864e5), type:'Hearing', case:cases[1]._id, color:'#ef4444' },
    { user:rajesh._id, title:'Appointment with Adv. Priya Sharma', startDate:new Date(Date.now()+2*864e5), type:'Appointment', color:'#c9a84c' },
  ]);

  console.log('\n✅ Database seeded!\n');
  console.log('─────────────────────────────────────────────');
  console.log('🛡️  Admin:   admin@lexassist.com  / Admin@123!');
  console.log('⚖️  Lawyer:  priya@lexassist.com  / Lawyer@123!');
  console.log('⚖️  Lawyer2: rajan@lexassist.com  / Lawyer@123!');
  console.log('👨 Citizen: rajesh@example.com   / User@123!');
  console.log('👩 Citizen: meena@example.com    / User@123!');
  console.log('─────────────────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch(err => {
  console.error('❌ Seed failed:', err.message);
  process.exit(1);
});
