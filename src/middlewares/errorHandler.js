import { AppError } from '../utils/AppError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  let statusCode = error.statusCode || error.status || 500;
  let message = error.message || 'Something went wrong';

  // MongoDB duplicate key (unique indexes are the last line of defence)
  if (error.code === 11000) {
    statusCode = 409;
    message = 'This record already exists';
  }

  // Invalid ObjectId cast
  if (error.name === 'BSONError' || error.name === 'BSONTypeError') {
    statusCode = 400;
    message = 'Invalid identifier';
  }

  if (statusCode >= 500) {
    console.error('[error]', error);
    if (!error.statusCode) message = 'Internal server error';
  }

  if (res.headersSent) return;

  res.status(statusCode).json({ success: false, message });
}

export function assert(condition, message, statusCode = 400) {
  if (!condition) throw new AppError(statusCode, message);
}
