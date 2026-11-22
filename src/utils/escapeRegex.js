/** Escape user input before using it inside a RegExp (MongoDB search). */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
