const nodemailer = require('nodemailer');
const env = require('./env');

let transporter = null;

if (env.smtpHost) {
  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined
  });
}

async function sendMail({ to, subject, text, html }) {
  if (!transporter) {
    if (!env.isProduction) {
      console.log(`[ArtiFile mail skipped - SMTP not configured] To: ${to} | Subject: ${subject}`);
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: env.mailFrom,
      to,
      subject,
      text: text || '',
      html: html || undefined
    });
    return true;
  } catch (error) {
    console.error('[ArtiFile mail error]', error.message);
    return false;
  }
}

module.exports = { sendMail };
