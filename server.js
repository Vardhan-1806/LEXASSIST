require('dotenv').config();
const express     = require('express');
const mongoose    = require('mongoose');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const session     = require('express-session');
const MongoStore  = require('connect-mongo');
const path        = require('path');
const rateLimit   = require('express-rate-limit');
const fs          = require('fs');

const app = express();

// ── Ensure directories exist ──────────────────────────────────
['uploads','uploads/documents','uploads/temp'].forEach(d => {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive:true });
});

// ── Security Middleware ───────────────────────────────────────
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin:      process.env.CLIENT_URL || 'http://localhost:5000',
  credentials: true,
  methods:     ['GET','POST','PUT','DELETE','PATCH'],
  allowedHeaders: ['Content-Type','Authorization'],
}));

// ── Rate Limiting ─────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { success:false, message:'Too many requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders:   false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success:false, message:'Too many login attempts. Please wait 15 minutes.' },
});
app.use('/api/', apiLimiter);
app.use('/api/auth/login',    authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Body Parsing ──────────────────────────────────────────────
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));

// ── Session ───────────────────────────────────────────────────
app.use(session({
  secret:            process.env.SESSION_SECRET || 'lexassist_secret_key_2024',
  resave:            false,
  saveUninitialized: false,
  store:             MongoStore.create({ mongoUrl: process.env.MONGO_URI }),
  cookie: {
    secure:   process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge:   7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax',
  }
}));

// ── Static Files ──────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'Frontend/public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
}));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: process.env.NODE_ENV === 'production' ? '7d' : '0',
}));

// ── API Routes ────────────────────────────────────────────────
app.get('/api/health', (req,res) => res.json({ status:'ok', timestamp:Date.now(), version:'1.0.0', uptime: process.uptime() }));

app.use('/api/auth',          require('./Backend/routes/authRoutes'));
app.use('/api/users',         require('./Backend/routes/userRoutes'));
app.use('/api/lawyers',       require('./Backend/routes/lawyerRoutes'));
app.use('/api/cases',         require('./Backend/routes/caseRoutes'));
app.use('/api/appointments',  require('./Backend/routes/appointmentRoutes'));
app.use('/api/calendar',      require('./Backend/routes/calendarRoutes'));
app.use('/api/chatbot',       require('./Backend/routes/chatbotRoutes'));
app.use('/api/admin',         require('./Backend/routes/adminRoutes'));
app.use('/api/documents',     require('./Backend/routes/documentRoutes'));
app.use('/api/notifications', require('./Backend/routes/notificationRoutes'));

// ── Page Routes ───────────────────────────────────────────────
const V    = path.join(__dirname, 'Frontend/views');
const page = f => (req, res) => {
  const fp = path.join(V, f);
  if (!fs.existsSync(fp)) return res.status(404).sendFile(path.join(V,'shared/404.html'));
  res.sendFile(fp);
};

// Auth
app.get('/',                     page('auth/landing.html'));
app.get('/login',                page('auth/login.html'));
app.get('/register',             page('auth/register.html'));

// Citizen
app.get('/dashboard/citizen',    page('citizen/dashboard.html'));
app.get('/cases',                page('citizen/cases.html'));
app.get('/chatbot',              page('citizen/chatbot.html'));
app.get('/lawyers',              page('citizen/lawyers.html'));
app.get('/documents',            page('citizen/documents.html'));
app.get('/documents/generate',   page('citizen/doc-generator.html'));
app.get('/similar-cases',        page('citizen/similar-cases.html'));
app.get('/legal-aid',            page('citizen/legal-aid.html'));
app.get('/profile',               page('shared/profile.html'));
app.get('/forgot-password',       page('shared/forgot-password.html'));

// Lawyer
app.get('/dashboard/lawyer',     page('lawyer/dashboard.html'));
app.get('/lawyer/documents',     page('lawyer/documents.html'));

// Admin
app.get('/dashboard/admin',      page('admin/dashboard.html'));
app.get('/admin/login',           page('admin/login.html'));

// Shared
app.get('/appointments',         page('shared/appointments.html'));
app.get('/calendar',             page('shared/calendar.html'));
app.get('/documents/shared/:token', page('shared/doc-share.html'));
app.get('/verify-email/:token',    (req,res) => res.redirect(`/api/auth/verify-email/${req.params.token}`));
app.get('/reset-password/:token',   page('shared/reset-password.html'));

// 404
app.use((req, res) => res.status(404).sendFile(path.join(V, 'shared/404.html')));

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌', err.stack);
  res.status(err.status || 500).json({ success:false, message: process.env.NODE_ENV==='production' ? 'Something went wrong' : err.message });
});

// ── Database + Server Start ───────────────────────────────────
mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS:          45000,
})
.then(() => {
  console.log('✅ MongoDB Connected');
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LEXASSIST → http://localhost:${PORT}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    // Start cron jobs
    try {
      const { startReminders } = require('./Backend/utils/reminderCron');
      startReminders();
    } catch(e) { console.warn('Cron job warning:', e.message); }
  });
})
.catch(err => {
  console.error('❌ Database connection failed:', err.message);
  process.exit(1);
});
