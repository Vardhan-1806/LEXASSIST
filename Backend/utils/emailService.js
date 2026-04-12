/**
 * LEXASSIST — Email Service (PRODUCTION READY)
 * Gmail SMTP via Nodemailer
 */
const nodemailer = require('nodemailer');

let _transporter = null;

const getTransporter = () => {
  if (_transporter) return _transporter;

  const user = process.env.EMAIL_USER?.trim();
  const pass = process.env.EMAIL_PASS?.trim(); // Remove any trailing/leading spaces

  if (!user || !pass || user === 'yourgmail@gmail.com' || user === 'your_gmail@gmail.com') {
    console.warn('⚠️  Email not configured. Set EMAIL_USER + EMAIL_PASS in .env or Railway Variables.');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth:   { user, pass }, // Gmail app password - spaces OK
    tls:    { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout:   5000,
  });

  _transporter.verify((err) => {
    if (err) {
      console.error('❌ Gmail SMTP connection failed:', err.message);
      console.error('   Check: EMAIL_USER and EMAIL_PASS in Railway Variables');
      console.error('   Make sure Gmail App Password is 16 chars (no spaces needed in env)');
      _transporter = null; // Reset so next request retries
    } else {
      console.log(`✅ Gmail SMTP ready — sending as ${user}`);
    }
  });

  return _transporter;
};

// ── Base email wrapper ────────────────────────────────────────
const wrap = (content) => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#f8f5ef;font-family:Arial,sans-serif">
<div style="max-width:520px;margin:0 auto">
  <div style="background:linear-gradient(135deg,#0d1b35,#1f3461);padding:22px 28px;border-radius:12px 12px 0 0;text-align:center">
    <div style="font-size:1.6rem;font-weight:900;letter-spacing:1px">
      <span style="color:#c9a84c">LEX</span><span style="color:#fff">ASSIST</span>
    </div>
    <div style="color:rgba(255,255,255,0.5);font-size:0.75rem;margin-top:3px">AI-Powered Legal Platform</div>
  </div>
  <div style="background:#fff;padding:32px 28px;border-radius:0 0 12px 12px;box-shadow:0 4px 20px rgba(0,0,0,0.08)">
    ${content}
    <div style="margin-top:28px;padding-top:16px;border-top:1px solid #f1f5f9;text-align:center">
      <p style="color:#94a3b8;font-size:0.72rem;margin:0">© 2024 LEXASSIST &nbsp;|&nbsp; Free Legal Aid: <a href="tel:15100" style="color:#c9a84c;font-weight:600">15100</a></p>
    </div>
  </div>
</div>
</body></html>`;

// ── Core send function ────────────────────────────────────────
exports.sendEmail = async ({ to, subject, html }) => {
  const t = getTransporter();

  if (!t) {
    // Dev mode — show OTP in console for testing
    console.log('\n' + '═'.repeat(52));
    console.log('📧 EMAIL — Not sent (configure EMAIL_PASS in Railway)');
    console.log(`   TO:      ${to}`);
    console.log(`   SUBJECT: ${subject}`);
    // Extract and show OTP clearly
    const otpMatch = html?.match(/>(\d{4})</);
    if (otpMatch) console.log(`   🔐 OTP CODE: ${otpMatch[1]} ← Use this to verify`);
    console.log('═'.repeat(52) + '\n');
    return { success: true, dev: true };
  }

  try {
    const info = await t.sendMail({
      from:    `"⚖️ LEXASSIST" <${process.env.EMAIL_USER}>`,
      to, subject, html,
      text: html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(),
    });
    console.log(`✅ Email sent → ${to} [${info.messageId}]`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`❌ Email FAILED → ${to}: ${err.message}`);
    // Don't throw - return error so app continues
    return { success: false, error: err.message };
  }
};

// ── OTP Email ─────────────────────────────────────────────────
exports.sendOTPEmail = (to, name, otp, purpose = 'registration') =>
  exports.sendEmail({
    to,
    subject: `${otp} — Your LEXASSIST verification code`,
    html: wrap(`
      <h2 style="color:#0d1b35;margin:0 0 6px">Your Verification Code</h2>
      <p style="color:#64748b;margin:0 0 20px">Hi ${name}, use this 4-digit code to complete your ${purpose}:</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f8f5ef;border:2px dashed #c9a84c;border-radius:14px;padding:20px 36px">
          <div style="font-size:3rem;font-weight:900;letter-spacing:12px;color:#0d1b35;font-family:monospace">${otp}</div>
          <div style="color:#94a3b8;font-size:0.76rem;margin-top:6px">Valid for 10 minutes</div>
        </div>
      </div>
      <div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px">
        <p style="margin:0;color:#92400e;font-size:0.82rem">⚠️ Never share this code with anyone. LEXASSIST will never ask for your OTP.</p>
      </div>`
    ),
  });

// ── Welcome Email ─────────────────────────────────────────────
exports.sendWelcomeEmail = (user) =>
  exports.sendEmail({
    to:      user.email,
    subject: `🎉 Welcome to LEXASSIST, ${user.name.split(' ')[0]}!`,
    html: wrap(`
      <h2 style="color:#0d1b35">Welcome, ${user.name}! 🎉</h2>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#16a34a;font-weight:600">✅ Your account is verified and active!</p>
      </div>
      <p style="color:#64748b">Your User ID: <code style="background:#f1f5f9;padding:2px 8px;border-radius:4px;font-family:monospace;color:#0d1b35">${user.userId || 'Assigned shortly'}</code></p>
      <p style="color:#64748b">You can now access all LEXASSIST features — AI legal help, case tracking, and lawyer consultation.</p>
      ${user.role === 'lawyer' ? '<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:8px;margin-top:16px"><p style="margin:0;color:#92400e;font-size:0.84rem">⚖️ Your lawyer profile is pending admin verification. You\'ll be notified once approved.</p></div>' : ''}
      <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/login" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:12px 24px;border-radius:50px;font-weight:700;text-decoration:none;margin-top:18px">Go to Dashboard →</a>`
    ),
  });

// ── Lawyer Verified Email ─────────────────────────────────────
exports.sendLawyerVerifiedEmail = (lawyerEmail, lawyerName) =>
  exports.sendEmail({
    to:      lawyerEmail,
    subject: '✅ Your LEXASSIST Lawyer Profile is Verified!',
    html: wrap(`
      <h2 style="color:#0d1b35">🎉 Congratulations, ${lawyerName}!</h2>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#16a34a;font-weight:600">✅ Your lawyer profile has been verified by LEXASSIST admin.</p>
      </div>
      <p style="color:#64748b">You are now visible to citizens across India. You can receive court appointment bookings and manage cases.</p>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard/lawyer" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:12px 24px;border-radius:50px;font-weight:700;text-decoration:none;margin-top:16px">Go to Lawyer Dashboard →</a>`
    ),
  });

// ── Lawyer Rejected Email ─────────────────────────────────────
exports.sendLawyerRejectedEmail = (lawyerEmail, lawyerName, reason) =>
  exports.sendEmail({
    to:      lawyerEmail,
    subject: '❌ LEXASSIST Lawyer Profile — Action Required',
    html: wrap(`
      <h2 style="color:#0d1b35">Profile Verification Update</h2>
      <p style="color:#64748b">Dear ${lawyerName}, your lawyer profile requires attention.</p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:14px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#dc2626;font-weight:600">Reason: ${reason}</p>
      </div>
      <p style="color:#64748b">Please update your profile with the correct information and contact our support team.</p>`
    ),
  });

// ── Admin Alert: New Lawyer Registered ───────────────────────
exports.sendNewLawyerAlert = (adminEmail, lawyerName, barCouncilId, lawyerEmail) =>
  exports.sendEmail({
    to:      adminEmail,
    subject: `⚖️ New Lawyer Registration — Action Required | LEXASSIST`,
    html: wrap(`
      <h2 style="color:#0d1b35">⚖️ New Lawyer Registered</h2>
      <p style="color:#64748b">A new lawyer has registered and requires verification:</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.875rem;margin:16px 0">
        <tr><td style="padding:8px 0;color:#64748b;width:40%">Name</td><td style="font-weight:600;color:#0d1b35">${lawyerName}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Email</td><td style="color:#0d1b35">${lawyerEmail}</td></tr>
        <tr><td style="padding:8px 0;color:#64748b">Bar Council ID</td><td style="font-family:monospace;color:#0d1b35">${barCouncilId}</td></tr>
      </table>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/dashboard/admin" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:12px 24px;border-radius:50px;font-weight:700;text-decoration:none">Verify in Admin Portal →</a>`
    ),
  });

// ── Case Timeline Update Email ────────────────────────────────
exports.sendCaseTimelineUpdate = (citizenEmail, citizenName, caseNumber, stageName, notes) =>
  exports.sendEmail({
    to:      citizenEmail,
    subject: `📋 Case Update: ${caseNumber} | LEXASSIST`,
    html: wrap(`
      <h2 style="color:#0d1b35">Case Timeline Updated</h2>
      <p style="color:#64748b">Hi ${citizenName}, your case <strong>${caseNumber}</strong> has been updated.</p>
      <div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:14px;border-radius:8px;margin:16px 0">
        <p style="margin:0;color:#16a34a;font-weight:600">✅ Stage Completed: ${stageName}</p>
        ${notes ? `<p style="margin:8px 0 0;color:#64748b;font-size:0.84rem">Note from your lawyer: ${notes}</p>` : ''}
      </div>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/cases" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:11px 22px;border-radius:50px;font-weight:700;text-decoration:none;margin-top:14px">View Case →</a>`
    ),
  });

// ── Appointment Confirmation ──────────────────────────────────
exports.sendAppointmentConfirmation = async (citizen, lawyer, appointment) => {
  const date = new Date(appointment.date).toLocaleDateString('en-IN',{weekday:'long',day:'2-digit',month:'long',year:'numeric'});
  const html = wrap(`
    <h2 style="color:#0d1b35">✅ Court Appointment Confirmed</h2>
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem;margin:16px 0">
      <tr><td style="padding:7px 0;color:#64748b">Lawyer</td><td style="font-weight:600;color:#0d1b35">${lawyer.name}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b">Date</td><td style="font-weight:600;color:#0d1b35">${date}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b">Time</td><td style="color:#0d1b35">${appointment.timeSlot?.start}</td></tr>
      <tr><td style="padding:7px 0;color:#64748b">Purpose</td><td style="color:#0d1b35">${appointment.type}</td></tr>
    </table>
    <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/appointments" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:11px 22px;border-radius:50px;font-weight:700;text-decoration:none">View Appointments →</a>`
  );
  await exports.sendEmail({ to: citizen.email, subject: `✅ Court Appointment Confirmed | LEXASSIST`, html });
  await exports.sendEmail({ to: lawyer.email,  subject: `📅 New Court Booking from ${citizen.name} | LEXASSIST`, html });
};

// ── Hearing Reminder ──────────────────────────────────────────
exports.sendHearingReminder = (userEmail, userName, caseNumber, caseTitle, court, daysLeft) =>
  exports.sendEmail({
    to:      userEmail,
    subject: `${daysLeft === 0 ? '🚨 TODAY' : '⏰ Tomorrow'} — Hearing for ${caseNumber} | LEXASSIST`,
    html: wrap(`
      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;padding:16px;margin-bottom:20px">
        <h2 style="color:#dc2626;margin:0">${daysLeft === 0 ? '🚨 Court Hearing TODAY!' : '⏰ Court Hearing Tomorrow!'}</h2>
      </div>
      <p style="color:#64748b">Hi ${userName}, you have an upcoming court hearing.</p>
      <table style="width:100%;border-collapse:collapse;font-size:0.875rem;margin:16px 0">
        <tr><td style="padding:7px 0;color:#64748b">Case</td><td style="font-weight:600;color:#0d1b35">${caseTitle}</td></tr>
        <tr><td style="padding:7px 0;color:#64748b">Case No.</td><td style="color:#0d1b35">${caseNumber}</td></tr>
        <tr><td style="padding:7px 0;color:#64748b">Court</td><td style="color:#0d1b35">${court || 'As notified'}</td></tr>
      </table>
      <a href="${process.env.CLIENT_URL || 'http://localhost:5000'}/cases" style="display:inline-block;background:#c9a84c;color:#0d1b35;padding:11px 22px;border-radius:50px;font-weight:700;text-decoration:none">View Case Details →</a>`
    ),
  });
