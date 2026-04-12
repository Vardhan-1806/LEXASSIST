/**
 * LEXASSIST — Admin Seeder
 * Run once: node seedAdmin.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

if (!process.env.MONGO_URI) { console.error('❌ MONGO_URI missing in .env'); process.exit(1); }

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  const User = require('./Backend/models/User');

  const existing = await User.findOne({ role: 'admin' });
  if (existing) {
    console.log('ℹ️  Admin already exists:', existing.email);
    console.log('   Login at: /admin/login');
    console.log('   Email:', existing.email);
    await mongoose.disconnect();
    process.exit(0);
  }

  const email = process.env.ADMIN_EMAIL    || 'admin@lexassist.com';
  const pass  = process.env.ADMIN_PASSWORD || 'Admin@123!';
  const hash  = await bcrypt.hash(pass, 12);

  await User.insertMany([{
    name: 'Admin LEXASSIST', email, password: hash,
    role: 'admin', isVerified: true, isActive: true,
    userId: 'LEX-ADM-00001', phone: '9000000000',
  }]);

  console.log('\n✅ Admin created successfully!');
  console.log('─────────────────────────────────');
  console.log('  URL:      http://localhost:5000/admin/login');
  console.log('  Email:   ', email);
  console.log('  Password:', pass);
  console.log('─────────────────────────────────\n');

  await mongoose.disconnect();
  process.exit(0);
};

run().catch(err => { console.error('❌', err.message); process.exit(1); });
