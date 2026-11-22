import { ObjectId } from 'mongodb';

export function toObjectId(value) {
  if (value instanceof ObjectId) return value;
  if (typeof value !== 'string' || !ObjectId.isValid(value)) return null;
  return new ObjectId(value);
}

export function objectIdString(value) {
  if (!value) return '';
  return value instanceof ObjectId ? value.toString() : String(value);
}
