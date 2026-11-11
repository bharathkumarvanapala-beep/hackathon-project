/**
 * Aarogya Drishti — Synthetic Data Generator
 *
 * Generates realistic, fully synthetic patient profiles for ITDA Paderu oral health
 * screening and care coordination workflows.
 *
 * CRITICAL CLINICAL & PRIVACY RULE:
 * NEVER use real patient names, real Aadhaar/Govt IDs, or real clinical photographs.
 * All records produced by this module are mathematically generated synthetic data
 * for automated testing, clinical workflow training, and offline sync verification.
 */

import { generatePatientId } from './patient-id.mjs';
import { getConsentTerms } from './consent-terms.mjs';

export const ITDA_PADERU_VILLAGES = [
  'Paderu',
  'Araku Valley',
  'Hukumpeta',
  'Dumbriguda',
  'Ananthagiri',
  'Chintapalli',
  'Munchingputtu',
  'G.Madugula',
  'Pedabayalu',
  'Koyyuru',
  'G.K.Veedhi'
];

export const SYNTHETIC_FIRST_NAMES = [
  'Somulu', 'Chittemma', 'Appala Raju', 'Gangaraju', 'Devamma',
  'Kondababu', 'Sanyasirao', 'Lakshmi', 'Parvathi', 'Rambabu',
  'Kausalya', 'Balaraju', 'Subbalakshmi', 'Malleswara Rao',
  'Satyavathi', 'Simhachalam', 'Durgarao', 'Mangamma'
];

export const SYNTHETIC_SURNAMES = [
  'Killo', 'Korra', 'Pangi', 'Gemmeli', 'Matsyaraju',
  'Vantala', 'Vanthala', 'Sagina', 'Chetti', 'Gollori'
];

export const SYNTHETIC_COMPLAINTS = [
  {
    en: 'Chronic betel-quid (paan) chewing for 10+ years; burning sensation in buccal mucosa when eating spicy foods.',
    te: '10 సంవత్సరాలకు పైగా తమలపాకు నమలడం; కారంగా ఉండే ఆహారం తిన్నప్పుడు బుగ్గ లోపలి భాగంలో నిరంతర మంట.'
  },
  {
    en: 'Severe throbbing pain in lower right first molar tooth with deep visible cavity.',
    te: 'కుడి కింది మొదటి దవడ పంటిలో తీవ్రమైన నొప్పి మరియు కనిపించే లోతైన రంధ్రం.'
  },
  {
    en: 'Bleeding, swollen gums and heavy subgingival calculus around lower incisors.',
    te: 'కింది ముందు పళ్ళ చుట్టూ రక్తం కారే చిగుళ్ళు మరియు భారీ గార పేరుకుపోవడం.'
  },
  {
    en: 'Mobility of upper left premolar tooth with recurrent swelling on adjoining gingiva.',
    te: 'పై ఎడమ పన్ను కదలడం మరియు చిగురులో వాపు.'
  },
  {
    en: 'Routine preventive screening at tribal ashram residential school; mild fluorosis discoloration.',
    te: 'గిరిజన ఆశ్రమ పాఠశాలలో సాధారణ స్క్రీనింగ్; తేలికపాటి ఫ్లోరోసిస్ మరకలు.'
  },
  {
    en: 'White non-wipable mucosal patch along left lateral border of tongue under research surveillance.',
    te: 'నాలుక ఎడమ అంచున తెల్లటి మచ్చ; పరిశోధన నిఘాలో ఉంది.'
  }
];

/**
 * Minimal, 100% valid 1x1 PNG pixel with correct magic bytes (\x89PNG\r\n\x1a\n).
 * Used as a synthetic oral test photo fixture.
 */
export const SYNTHETIC_PNG_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * Generates a single synthetic patient record with realistic demographics and consent.
 *
 * @param {object} [options={}]
 * @param {string} [options.village]
 * @param {number} [options.age]
 * @param {string} [options.language='te']
 * @param {boolean} [options.includePhoto=true]
 * @returns {object}
 */
export function generateSyntheticPatient(options = {}) {
  const language = options.language === 'en' ? 'en' : 'te';
  const village = options.village || ITDA_PADERU_VILLAGES[Math.floor(Math.random() * ITDA_PADERU_VILLAGES.length)];
  const firstName = SYNTHETIC_FIRST_NAMES[Math.floor(Math.random() * SYNTHETIC_FIRST_NAMES.length)];
  const surname = SYNTHETIC_SURNAMES[Math.floor(Math.random() * SYNTHETIC_SURNAMES.length)];
  const fullName = `${surname} ${firstName}`;
  const age = options.age || Math.floor(Math.random() * 50) + 18; // 18 - 68

  const randomPhone = `+9198480${Math.floor(10000 + Math.random() * 90000)}`;
  const complaintObj = SYNTHETIC_COMPLAINTS[Math.floor(Math.random() * SYNTHETIC_COMPLAINTS.length)];
  const history = language === 'te' ? complaintObj.te : complaintObj.en;

  const now = new Date().toISOString();
  const patientId = generatePatientId('AD-PAD');
  const consentTerms = getConsentTerms('v1.0-ITDA', language);

  return {
    id: patientId,
    name: fullName,
    age,
    village,
    phone: randomPhone,
    history,
    consent: true,
    consentVersion: consentTerms.version,
    consentLanguage: language,
    consentText: consentTerms.body,
    stage: 'screened',
    notes: '',
    facility: '',
    due: '',
    photo: options.includePhoto !== false ? SYNTHETIC_PNG_BASE64 : null,
    quality: { pass: true, synthetic: true },
    createdAt: now,
    timeline: [
      {
        at: now,
        text: 'Synthetic oral screening created for demonstration and testing.',
        te: 'ప్రదర్శన మరియు పరీక్ష కోసం సింథటిక్ నోటి స్క్రీనింగ్ సృష్టించబడింది.'
      }
    ]
  };
}

/**
 * Generates an array of synthetic patient records.
 *
 * @param {number} [count=10]
 * @param {object} [options={}]
 * @returns {Array<object>}
 */
export function generateSyntheticCohort(count = 10, options = {}) {
  const cohort = [];
  for (let i = 0; i < count; i++) {
    cohort.push(generateSyntheticPatient(options));
  }
  return cohort;
}
