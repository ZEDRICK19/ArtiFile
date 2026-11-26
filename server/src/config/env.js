const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(required('PORT', '5000')),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  cookieName: process.env.COOKIE_NAME || 'artifile_token',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5000',
  gsuiteDomain: (process.env.GSUITE_DOMAIN || '@g.batstate-u.edu.ph').toLowerCase(),
  seedAdminEmail: required('SEED_ADMIN_EMAIL').toLowerCase(),
  seedAdminPassword: required('SEED_ADMIN_PASSWORD'),
  seedAdminName: required('SEED_ADMIN_NAME'),
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || '587'),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  mailFrom: process.env.MAIL_FROM || 'ArtiFile <no-reply@batstate-u.edu.ph>',
  uploadDir: path.resolve(__dirname, '../../uploads'),
  isProduction: (process.env.NODE_ENV || 'development') === 'production'
});

module.exports = env;
