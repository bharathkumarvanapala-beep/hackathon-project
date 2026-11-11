/**
 * Aarogya Drishti — Bilingual Translation Engine (English & Telugu)
 *
 * Centralizes bilingual dictionaries with fallback support, dynamic language switching,
 * and localized date formatting for rural healthcare workflows.
 */

let currentLang = localStorage.getItem('drishti-lang') || 'en';

const inMemoryDicts = {
  en: {
    app_name: 'Aarogya Drishti',
    team: 'Care team',
    dashboard: 'Overview',
    patients: 'Patient registry',
    screening: 'New screening',
    reviews: 'Clinical reviews',
    referrals: 'Care navigation & referrals',
    district: 'District insights',
    settings: 'Sync & integrations',
    welcome: 'Care begins with a connection.',
    subtitle: 'A clearer view of every patient’s journey, from screening to care.',
    total: 'Patients registered',
    pending: 'Awaiting review',
    referral: 'Active referrals',
    overdue: 'Overdue follow-ups',
    new: 'New screening',
    open: 'Open record',
    back: 'Back',
    empty: 'No matching records yet.',
    search: 'Search name, ID or village…',
    online: 'Online',
    offline: 'Offline · device storage active',
    demo: 'SYNTHETIC DEMO',
    sync_now: 'Sync records & n8n',
    sync_drawer: 'Offline Sync Drawer',
    conflict_detected: 'Conflict Detected'
  },
  te: {
    app_name: 'ఆరోగ్య దృష్టి',
    team: 'సంరక్షణ బృందం',
    dashboard: 'అవలోకనం',
    patients: 'రోగుల నమోదు',
    screening: 'కొత్త స్క్రీనింగ్',
    reviews: 'వైద్య సమీక్షలు',
    referrals: 'కేర్ నావిగేషన్ & రిఫరల్స్',
    district: 'జిల్లా విశ్లేషణ',
    settings: 'సింక్ & అనుసంధానాలు',
    welcome: 'సంరక్షణ అనుసంధానంతో మొదలవుతుంది.',
    subtitle: 'స్క్రీనింగ్ నుండి చికిత్స వరకు ప్రతి రోగి ప్రయాణం.',
    total: 'నమోదైన రోగులు',
    pending: 'సమీక్ష కోసం వేచి',
    referral: 'క్రియాశీల రిఫరల్స్',
    overdue: 'గడువు దాటిన ఫాలో-అప్‌లు',
    new: 'కొత్త స్క్రీనింగ్',
    open: 'రికార్డు తెరవండి',
    back: 'వెనుకకు',
    empty: 'ఇంకా సరిపోలే రికార్డులు లేవు.',
    search: 'పేరు, ID లేదా గ్రామం వెతకండి…',
    online: 'ఆన్‌లైన్',
    offline: 'ఆఫ్‌లైన్ · పరికర నిల్వ క్రియాశీలం',
    demo: 'కల్పిత డేటా ప్రదర్శన',
    sync_now: 'రికార్డులు & n8n సింక్',
    sync_drawer: 'ఆఫ్‌లైన్ సింక్ డ్రాయర్',
    conflict_detected: 'వైరుధ్యం గుర్తించబడింది'
  }
};

let externalDicts = {};

export async function initI18n() {
  try {
    const [enRes, teRes] = await Promise.all([
      fetch('/i18n/en.json').then((r) => (r.ok ? r.json() : null)),
      fetch('/i18n/te.json').then((r) => (r.ok ? r.json() : null)),
    ]);
    if (enRes) externalDicts.en = enRes;
    if (teRes) externalDicts.te = teRes;
  } catch {}
}

export function getLanguage() {
  return currentLang;
}

export function setLanguage(lang) {
  if (['en', 'te'].includes(lang)) {
    currentLang = lang;
    localStorage.setItem('drishti-lang', lang);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }
  }
  return currentLang;
}

export function t(key, fallback = '') {
  const dict = externalDicts[currentLang] || inMemoryDicts[currentLang] || {};
  if (dict[key]) return dict[key];
  const enDict = externalDicts.en || inMemoryDicts.en || {};
  return enDict[key] || fallback || key;
}

export function formatDate(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(currentLang === 'te' ? 'te-IN' : 'en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoStr;
  }
}
