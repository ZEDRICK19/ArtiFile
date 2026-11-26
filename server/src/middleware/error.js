class AppError extends Error {
  constructor(message, statusCode, details) {
    super(message);
    this.statusCode = statusCode || 500;
    this.status = `${this.statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.details = details || null;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} was not found on this server.`, 404));
};

function handlePrismaError(error) {
  if (error.code === 'P2002') {
    const field = error.meta && error.meta.target ? error.meta.target.join(', ') : 'field';
    return new AppError(`A record already exists for ${field}.`, 409);
  }
  if (error.code === 'P2025') {
    return new AppError('The requested record was not found.', 404);
  }
  if (error.code === 'P2003') {
    return new AppError('This record is still referenced by other records and cannot be changed.', 409);
  }
  return null;
}

function errorHandler(error, req, res, next) {
  let err = error;

  if (error && error.name === 'ZodError') {
    const details = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message
    }));
    err = new AppError('Please check the submitted information.', 400, details);
  }

  if (error && error.code && String(error.code).startsWith('P')) {
    err = handlePrismaError(error) || err;
  }

  if (error && error.name === 'JsonWebTokenError') {
    err = new AppError('Invalid session token. Please log in again.', 401);
  }

  if (error && error.name === 'TokenExpiredError') {
    err = new AppError('Your session has expired. Please log in again.', 401);
  }

  const statusCode = err.statusCode || 500;
  const message = err.isOperational || statusCode < 500
    ? err.message
    : 'Something went wrong on our end. Please try again later.';

  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) {
    console.error(error);
  }

  return res.status(statusCode).json({
    success: false,
    status: statusCode,
    message,
    details: err.details || undefined
  });
}

module.exports = { AppError, asyncHandler, notFound, errorHandler };
