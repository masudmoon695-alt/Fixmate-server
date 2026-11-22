/**
 * Express 5 forwards rejected promises automatically, but wrapping keeps the
 * behaviour explicit and also works if the app is ever downgraded to Express 4.
 */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};
