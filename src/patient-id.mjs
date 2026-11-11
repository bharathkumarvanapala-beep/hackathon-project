/**
 * Aarogya Drishti — Standardized Patient Identifier Utility
 *
 * Generates and validates unique, privacy-conscious patient identifiers.
 * Format: AD-YYYYMMDD-XXXX (e.g. AD-20261029-7F3A)
 * Backwards compatible with existing legacy IDs (e.g. AD-E1A2B3C4).
 */

import { randomBytes } from 'node:crypto';

/**
 * Generates a clean, standardized patient identifier.
 *
 * @param {string} [prefix='AD'] - Program or district prefix (e.g. 'AD' for Aarogya Drishti).
 * @param {Date} [date=new Date()] - Date of registration.
 * @returns {string} Unique identifier.
 */
export function generatePatientId(prefix = 'AD', date = new Date()) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const randomSuffix = randomBytes(2).toString('hex').toUpperCase(); // 4 hex chars = 65,536 combinations per day per prefix
  return `${prefix}-${yyyy}${mm}${dd}-${randomSuffix}`;
}

/**
 * Validates a patient identifier format.
 *
 * @param {unknown} id - Candidate identifier.
 * @returns {boolean} True if format is valid.
 */
export function isValidPatientId(id) {
  if (typeof id !== 'string') {
    return false;
  }
  const trimmed = id.trim();
  // Validates format: AD- followed by alphanumeric characters and hyphens, 6 to 80 characters long
  return /^AD-[A-Za-z0-9-]+$/.test(trimmed) && trimmed.length >= 6 && trimmed.length <= 80;
}
