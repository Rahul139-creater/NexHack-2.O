import { hashToken } from '../utils/crypto.js';
import { User } from '../models/User.js';
import { unauthenticated } from './errorHandler.js';

export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw unauthenticated('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw unauthenticated('Token not provided');
    }

    const hashed = hashToken(token);
    const user = await User.findOne({ tokenHash: hashed });
    if (!user) {
      throw unauthenticated('Invalid API token');
    }

    req.user = user;
    req.rawToken = token;
    next();
  } catch (err) {
    next(err);
  }
}
