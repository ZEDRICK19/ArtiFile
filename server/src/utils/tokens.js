const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signToken(user, rememberMe = false) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      email: user.email
    },
    env.jwtSecret,
    { expiresIn: rememberMe ? '30d' : env.jwtExpiresIn }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret);
}

function cookieOptions(rememberMe = false) {
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/',
    maxAge
  };
}

function setAuthCookie(res, token, rememberMe = false) {
  res.cookie(env.cookieName, token, cookieOptions(rememberMe));
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.isProduction,
    path: '/'
  });
}

module.exports = { signToken, verifyToken, setAuthCookie, clearAuthCookie };
