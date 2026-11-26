const env = require('../config/env');
const prisma = require('../config/prisma');
const { verifyToken } = require('../utils/tokens');
const { AppError } = require('./error');

async function authenticate(req, res, next) {
  const token = req.cookies && req.cookies[env.cookieName];

  if (!token) {
    return next(new AppError('You must be logged in to access this resource.', 401));
  }

  try {
    const payload = verifyToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true
      }
    });

    if (!user) {
      return next(new AppError('Account not found. Please log in again.', 401));
    }

    if (!user.isActive) {
      return next(new AppError('This account has been deactivated. Please contact the OCA office.', 403));
    }

    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your session has expired. Please log in again.', 401));
    }
    return next(new AppError('Invalid session. Please log in again.', 401));
  }
}

module.exports = { authenticate };
