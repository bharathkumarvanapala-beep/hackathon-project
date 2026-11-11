/**
 * Aarogya Drishti — ITDA Paderu Facility Directory & Dental Topology
 *
 * Defines standardized health facilities, dental quadrant mapping,
 * and referral state machine transitions for rural oral care coordination.
 */

export const ITDA_FACILITIES = [
  {
    id: 'AH_PADERU',
    name: 'Area Hospital Paderu',
    village: 'Paderu',
    level: 'Secondary Referral / Dental Dept',
    hasDentalSurgeon: true,
    hasBiopsyFacility: true,
  },
  {
    id: 'CHC_ARAKU',
    name: 'Community Health Centre Araku',
    village: 'Araku Valley',
    level: 'Primary CHC',
    hasDentalSurgeon: true,
    hasBiopsyFacility: false,
  },
  {
    id: 'CHC_CHINTAPALLE',
    name: 'CHC Chintapalle',
    village: 'Chintapalle',
    level: 'Primary CHC',
    hasDentalSurgeon: true,
    hasBiopsyFacility: false,
  },
  {
    id: 'PHC_HUKUMPETA',
    name: 'Primary Health Centre Hukumpeta',
    village: 'Hukumpeta',
    level: 'PHC Outreach Unit',
    hasDentalSurgeon: false,
    hasBiopsyFacility: false,
  },
  {
    id: 'MOBILE_DENTAL_01',
    name: 'ITDA Mobile Dental Screening Unit',
    village: 'Paderu Division (Agency Track)',
    level: 'Mobile Outreach',
    hasDentalSurgeon: true,
    hasBiopsyFacility: false,
  },
  {
    id: 'KGH_VIZAG',
    name: 'King George Hospital Visakhapatnam (Tertiary)',
    village: 'Visakhapatnam',
    level: 'Tertiary Dental & Oncology Referral',
    hasDentalSurgeon: true,
    hasBiopsyFacility: true,
  },
];

export const DENTAL_QUADRANTS = [
  {
    code: 'Q1_UR',
    name: 'Upper Right (Maxillary Right)',
    te: 'ఎగువ కుడి (Q1)',
    teethRange: '11-18',
  },
  {
    code: 'Q2_UL',
    name: 'Upper Left (Maxillary Left)',
    te: 'ఎగువ ఎడమ (Q2)',
    teethRange: '21-28',
  },
  {
    code: 'Q3_LL',
    name: 'Lower Left (Mandibular Left)',
    te: 'దిగువ ఎడమ (Q3)',
    teethRange: '31-38',
  },
  {
    code: 'Q4_LR',
    name: 'Lower Right (Mandibular Right)',
    te: 'దిగువ కుడి (Q4)',
    teethRange: '41-48',
  },
  {
    code: 'MUCOSA',
    name: 'Oral Mucosa / Tongue / Lip',
    te: 'నోటి శ్లేష్మం / నాలుక / పెదవి',
    teethRange: 'Soft Tissue',
  },
  {
    code: 'GENERAL',
    name: 'Generalized Cavity Finding',
    te: 'సాధారణ నోటి పరీక్ష',
    teethRange: 'Full Dentition',
  },
];

export const REFERRAL_PRIORITIES = ['routine', 'urgent', 'emergency'];

export const REFERRAL_STATUSES = ['referred', 'scheduled', 'attended', 'completed', 'cancelled'];

const VALID_TRANSITIONS = {
  referred: ['scheduled', 'attended', 'cancelled'],
  scheduled: ['attended', 'scheduled', 'cancelled'],
  attended: ['completed', 'scheduled', 'cancelled'],
  completed: [],
  cancelled: ['referred'], // Re-referral allowed
};

/**
 * Validates if a state transition in the referral state machine is legal.
 *
 * @param {string} from Current status
 * @param {string} to Target status
 * @returns {boolean}
 */
export function isValidReferralTransition(from, to) {
  if (from === to) return true;
  const allowed = VALID_TRANSITIONS[from];
  return Boolean(allowed && allowed.includes(to));
}

/**
 * Checks if a referral is overdue based on its due date and current status.
 *
 * @param {string} dueDate ISO date string (YYYY-MM-DD)
 * @param {string} status Referral status
 * @param {Date} [currentDate] Reference date (default: today)
 * @returns {boolean}
 */
export function isReferralOverdue(dueDate, status, currentDate = new Date()) {
  if (!dueDate || ['completed', 'cancelled'].includes(status)) return false;
  const todayStr = currentDate.toISOString().slice(0, 10);
  return dueDate < todayStr;
}
