import jwt from 'jsonwebtoken';
import { asyncHandler } from '../utils/asyncHandler.js';
import { unauthorized } from '../utils/AppError.js';

/**
 * Reads "Authorization: Bearer <token>", verifies the JWT signature and
 * attaches the verified identity to req.user. Role is NEVER taken from here.
 */
export const verifyToken = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (!token || !/^Bearer$/i.test(scheme)) {
    throw unauthorized('Authentication token is missing');
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error('JWT_SECRET is not configured on the server');
    error.statusCode = 500;
    throw error;
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw unauthorized('Session expired, please sign in again');
    }
    throw unauthorized('Invalid authentication token');
  }

  if (!decoded || typeof decoded !== 'object') {
    throw unauthorized('Invalid authentication token');
  }

  const email = decoded.email || decoded.user?.email || null;
  const id = decoded.sub || decoded.id || decoded.userId || decoded.user?.id || null;

  if (!email && !id) {
    throw unauthorized('Token does not identify a user');
  }

  req.token = decoded;
  req.user = { email, id, name: decoded.name || null };
  next();
});
