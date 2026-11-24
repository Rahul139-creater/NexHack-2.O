import crypto from 'crypto';

export function hashToken(token) {
  if (!token || typeof token !== 'string') {
    return '';
  }
  return crypto.createHash('sha256').update(token).digest('hex');
}
