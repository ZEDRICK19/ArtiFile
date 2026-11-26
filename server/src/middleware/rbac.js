const { AppError } = require('./error');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication is required.', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You are not authorized to perform this action.', 403));
    }
    return next();
  };
}

const requireAdmin = requireRole('ADMIN');
const requireStudent = requireRole('STUDENT');

module.exports = { requireRole, requireAdmin, requireStudent };
