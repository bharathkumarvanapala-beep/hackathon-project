/**
 * Aarogya Drishti — Standardized Multilingual Consent Terms
 *
 * Defines official, versioned screening consent terms in English and Telugu.
 * Explicitly declares:
 * 1. Scope of screening: oral health inspection and care coordination.
 * 2. Nature of computational / AI analysis: research assistance only, not independent diagnosis.
 * 3. Secure image storage on local care server.
 * 4. Right to withdraw consent at any time without loss of care access.
 */

export const CONSENT_VERSIONS = {
  'v1.0-ITDA': {
    version: 'v1.0-ITDA',
    effectiveDate: '2026-01-01',
    en: {
      title: 'Aarogya Drishti Oral Health Screening Consent',
      summary: 'Consent for oral photographic screening, research assistance, and care referral.',
      body: 'I have been informed about the Aarogya Drishti oral health screening process. I understand that this screening is conducted to identify potential oral health concerns and coordinate care with qualified dental professionals. I understand that any computational or AI analysis is used solely for research assistance and does not constitute a final medical diagnosis. I consent to having oral photographs taken and stored securely for my healthcare review. I understand that I may withdraw this consent at any time without affecting my routine medical care.'
    },
    te: {
      title: 'ఆరోగ్య దృష్టి నోటి ఆరోగ్య స్క్రీనింగ్ సమ్మతి పత్రం',
      summary: 'నోటి ఛాయాచిత్ర స్క్రీనింగ్, పరిశోధన సహాయం మరియు సంరక్షణ నివేదన కోసం సమ్మతి.',
      body: 'నేను ఆరోగ్య దృష్టి నోటి ఆరోగ్య స్క్రీనింగ్ ప్రక్రియ గురించి తెలుసుకున్నాను. సంభావ్య నోటి ఆరోగ్య సమస్యలను గుర్తించడానికి మరియు అర్హత కలిగిన దంత నిపుణులతో సంరక్షణను సమన్వయం చేయడానికి ఈ స్క్రీనింగ్ నిర్వహించబడుతుందని నేను అర్థం చేసుకున్నాను. ఏదైనా కంప్యూటేషనల్ లేదా AI విశ్లేషణ కేవలం పరిశోధన సహాయం కోసం మాత్రమే ఉపయోగించబడుతుందని మరియు ఇది అంతిమ వైద్య నిర్ధారణ కాదని నేను అర్థం చేసుకున్నాను. నా ఆరోగ్య సమీక్ష కోసం నోటి ఛాయాచిత్రాలను తీయడానికి మరియు సురక్షితంగా నిల్వ చేయడానికి నేను సమ్మతిస్తున్నాను. నా సాధారణ వైద్య సంరక్షణపై ఎలాంటి ప్రభావం లేకుండా నేను ఎప్పుడైనా ఈ సమ్మతిని ఉపసంహరించుకోవచ్చని నేను అర్థం చేసుకున్నాను.'
    }
  }
};

export const CURRENT_CONSENT_VERSION = 'v1.0-ITDA';

/**
 * Retrieves the full consent terms for a given version and language.
 *
 * @param {string} [version='v1.0-ITDA'] - Consent version string.
 * @param {string} [language='en'] - 'en' for English, 'te' for Telugu.
 * @returns {{ version: string, language: string, title: string, summary: string, body: string }}
 */
export function getConsentTerms(version = CURRENT_CONSENT_VERSION, language = 'en') {
  const v = CONSENT_VERSIONS[version] || CONSENT_VERSIONS[CURRENT_CONSENT_VERSION];
  const lang = (language === 'te' || language === 'telugu') ? 'te' : 'en';
  const terms = v[lang] || v.en;
  return {
    version: v.version,
    language: lang,
    title: terms.title,
    summary: terms.summary,
    body: terms.body
  };
}
