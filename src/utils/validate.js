import { badRequest } from './AppError.js';

export function readString(value, field, { required = false, min = 0, max = 5000, trim = true } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return '';
  }

  if (typeof value !== 'string') throw badRequest(`${field} must be a string`);

  const result = trim ? value.trim() : value;
  if (result.length < min) throw badRequest(`${field} must be at least ${min} characters`);
  if (result.length > max) throw badRequest(`${field} must be at most ${max} characters`);

  return result;
}

export function readNumber(value, field, { required = false, min = -Infinity, max = Infinity } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }

  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) throw badRequest(`${field} must be a valid number`);
  if (number < min) throw badRequest(`${field} must be at least ${min}`);
  if (number > max) throw badRequest(`${field} must be at most ${max}`);

  return number;
}

export function readBoolean(value, field) {
  if (typeof value !== 'boolean') throw badRequest(`${field} must be true or false`);
  return value;
}

export function readDate(value, field) {
  if (!value) throw badRequest(`${field} is required`);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${field} must be a valid date`);
  return date;
}

export function readEnum(value, field, allowed, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string' || !allowed.includes(value)) {
    throw badRequest(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return value;
}

export function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function readQueryInt(value, fallback, { min = 1, max = 100 } = {}) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}
