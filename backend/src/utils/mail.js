const nodemailer = require('nodemailer');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmailIdentifier(value) {
  return EMAIL_REGEX.test(String(value || '').trim().toLowerCase());
}

function getSmtpUser() {
  return String(process.env.SMTP_USER || process.env.GMAIL_USER || '').trim();
}

function getSmtpPass() {
  return String(process.env.SMTP_PASS || process.env.APP_PASSWORD || '').replace(/\s+/g, '').trim();
}

function isSmtpConfigured() {
  const host = String(process.env.SMTP_HOST || (getSmtpUser() ? 'smtp.gmail.com' : '')).trim();
  return Boolean(host && getSmtpUser() && getSmtpPass());
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const host = String(process.env.SMTP_HOST || 'smtp.gmail.com').trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: getSmtpUser(),
      pass: getSmtpPass(),
    },
  });
}

function getFromAddress() {
  const user = getSmtpUser();
  return String(process.env.SMTP_FROM || (user ? `SuRakshaFile <${user}>` : 'SuRakshaFile <noreply@surakshafile.local>')).trim();
}

async function sendEmail({ to, subject, text, html }) {
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('SMTP is not configured');
  }

  const info = await transporter.sendMail({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  return info;
}

async function sendOtpEmail({ to, otp, displayName }) {
  const greeting = displayName ? `Hello ${displayName},` : 'Hello,';
  const subject = 'Your SuRakshaFile login OTP';
  const text = [
    greeting,
    '',
    `Your one-time password (OTP) for SuRakshaFile is: ${otp}`,
    '',
    'This code expires in 5 minutes.',
    'If you did not request this code, you can ignore this email.',
    '',
    'SuRakshaFile — Cyber complaint support',
  ].join('\n');

  const html = `
    <p>${greeting}</p>
    <p>Your one-time password (OTP) for <strong>SuRakshaFile</strong> is:</p>
    <p style="font-size:24px;font-weight:bold;letter-spacing:4px;">${otp}</p>
    <p>This code expires in <strong>5 minutes</strong>.</p>
    <p>If you did not request this code, you can ignore this email.</p>
    <p style="color:#64748b;font-size:12px;">SuRakshaFile — Cyber complaint support</p>
  `;

  return sendEmail({ to, subject, text, html });
}

module.exports = {
  isEmailIdentifier,
  isSmtpConfigured,
  sendEmail,
  sendOtpEmail,
};
