export class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export const badRequest = (message) => new AppError(400, message);
export const unauthorized = (message = 'Unauthorized') => new AppError(401, message);
export const forbidden = (message = 'Forbidden') => new AppError(403, message);
export const notFound = (message = 'Not found') => new AppError(404, message);
export const conflict = (message) => new AppError(409, message);
