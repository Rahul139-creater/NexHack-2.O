export class AppError extends Error {
  constructor(message, code, statusCode) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export const unauthenticated = (message = 'Unauthenticated') =>
  new AppError(message, 'UNAUTHENTICATED', 401);

export const forbidden = (message = 'Forbidden') =>
  new AppError(message, 'FORBIDDEN', 403);

export const notFound = (message = 'Not found') =>
  new AppError(message, 'NOT_FOUND', 404);

export const revisionConflict = (message = 'Revision conflict') =>
  new AppError(message, 'REVISION_CONFLICT', 409);

export const invalidState = (message = 'Invalid state') =>
  new AppError(message, 'INVALID_STATE', 409);

export const leaseLost = (message = 'Lease lost') =>
  new AppError(message, 'LEASE_LOST', 409);

export const validationError = (message = 'Validation error') =>
  new AppError(message, 'VALIDATION_ERROR', 400);

export function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      code: err.code
    });
  }

  // Handle Zod error
  if (err.name === 'ZodError') {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ') || 'Validation error';
    return res.status(400).json({
      error: message,
      code: 'VALIDATION_ERROR'
    });
  }

  // Handle JSON parse error from express.json()
  if (err.type === 'entity.parse.failed' || err.status === 400) {
    return res.status(400).json({
      error: 'Malformed JSON payload',
      code: 'VALIDATION_ERROR'
    });
  }

  console.error('Unhandled server error:', err);
  return res.status(500).json({
    error: err.message || 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
}
