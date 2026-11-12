import { icon } from './icons.js';
import { overdue } from './domain.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const SUSPICIOUS_RE = /(suspicious|fibrosis|osmf|leukoplakia|erythroplakia|ulcer|dysplasia|lichen|malignant|high)/i;

function normalizeFacilityId(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.includes('paderu') && !lower.includes('mobile')) return 'AH_PADERU';
  if (lower.includes('araku')) return 'CHC_ARAKU';
  if (lower.includes('chintapall')) return 'CHC_CHINTAPALLE';
  if (lower.includes('hukumpeta')) return 'PHC_HUKUMPETA';
  if (lower.includes('mobile') || lower.includes('shandy')) return 'MOBILE_DENTAL_01';
  if (lower.includes('king george') || lower.includes('kgh') || lower.includes('visakhapatnam') || lower.includes('vizag')) return 'KGH_VIZAG';
  return 'OTHER';
}

function normalizeRoleKey(role = '') {
  if (role === 'asha') return 'worker';
  if (role === 'hospital') return 'navigator';
  return role;
}

/**
 * Aggregates live statistics exclusively from server stats and loaded IndexedDB/API data.
 * Contains zero hardcoded counts or static sample arrays.
 */
export function computeLiveStats({
  patients = [],
  referralsList = [],
  investigationsList = [],
  navigationList = [],
  aiAnalysesList = [],
  consultationsList = [],
  adminUsersList = [],
  automation = {},
  aiStatusInfo = null,
  dashboardStats = null,
  facilityCatalog = [],
  fallbackFacilities = []
}) {
  if (dashboardStats) {
    return {
      ...dashboardStats,
      isLiveServer: true
    };
  }

  const stageBreakdown = {
    screened: 0,
    reviewed: 0,
    referred: 0,
    diagnostics: 0,
    treatment: 0,
    closed: 0
  };
  const villageMap = new Map();
  let totalScreenings = 0;
  let overduePatients = 0;
  let consentsGranted = 0;

  for (const p of patients) {
    const stage = Object.hasOwn(stageBreakdown, p.stage) ? p.stage : 'screened';
    stageBreakdown[stage]++;
    if (p.photo) totalScreenings++;
    if (p.consent === true) consentsGranted++;
    if (overdue(p)) overduePatients++;

    const village = (p.village || 'Unspecified').trim() || 'Unspecified';
    if (!villageMap.has(village)) {
      villageMap.set(village, { village, count: 0, pending: 0, active: 0, completed: 0 });
    }
    const v = villageMap.get(village);
    v.count++;
    if (stage === 'screened') v.pending++;
    else if (['referred', 'diagnostics', 'treatment', 'reviewed'].includes(stage)) v.active++;
    else if (stage === 'closed') v.completed++;
  }

  const villageBreakdown = Array.from(villageMap.values()).sort(
    (a, b) => b.count - a.count || a.village.localeCompare(b.village)
  );

  const referralStatusMap = new Map();
  const referralPriorityMap = new Map();
  const facMap = new Map();
  let activeReferralsCount = 0;
  let overdueReferralsCount = 0;

  const ensureFac = (fid) => {
    if (!facMap.has(fid)) {
      facMap.set(fid, {
        activeReferrals: 0,
        totalReferrals: 0,
        completedReferrals: 0,
        overdueReferrals: 0,
        investigationsCount: 0,
        pendingInvestigations: 0
      });
    }
    return facMap.get(fid);
  };

  for (const r of referralsList) {
    const st = r.status || 'referred';
    const pr = r.priority || 'routine';
    referralStatusMap.set(st, (referralStatusMap.get(st) || 0) + 1);
    referralPriorityMap.set(pr, (referralPriorityMap.get(pr) || 0) + 1);

    const isActive = !['completed', 'cancelled'].includes(st);
    const isOver = Boolean(r.isOverdue);
    if (isActive) activeReferralsCount++;
    if (isOver) overdueReferralsCount++;

    const bucket = ensureFac(normalizeFacilityId(r.facility));
    bucket.totalReferrals++;
    if (isActive) bucket.activeReferrals++;
    if (st === 'completed') bucket.completedReferrals++;
    if (isOver) bucket.overdueReferrals++;
  }

  if (!referralsList.length) {
    activeReferralsCount = stageBreakdown.referred + stageBreakdown.diagnostics + stageBreakdown.treatment;
  }

  const invTypeMap = new Map();
  const invStatusMap = new Map();
  let pendingInvestigations = 0;
  let completedInvestigations = 0;

  for (const inv of investigationsList) {
    const st = inv.status || 'ordered';
    const tt = inv.test_type || 'biopsy';
    invTypeMap.set(tt, (invTypeMap.get(tt) || 0) + 1);
    invStatusMap.set(st, (invStatusMap.get(st) || 0) + 1);
    const done = st === 'completed' || st === 'reported';
    if (done) completedInvestigations++;
    else if (st !== 'cancelled') pendingInvestigations++;

    const bucket = ensureFac(normalizeFacilityId(inv.facility));
    bucket.investigationsCount++;
    if (!done && st !== 'cancelled') bucket.pendingInvestigations++;
  }

  const consultStatusMap = new Map();
  for (const c of consultationsList) {
    const st = c.status || 'preparing';
    consultStatusMap.set(st, (consultStatusMap.get(st) || 0) + 1);
  }

  const aiClassMap = new Map();
  const aiPatientIds = new Set();
  let suspiciousFindings = 0;
  for (const a of aiAnalysesList) {
    aiPatientIds.add(a.patientId);
    const cls = a.modelClass || 'Unclassified';
    aiClassMap.set(cls, (aiClassMap.get(cls) || 0) + 1);
    if (SUSPICIOUS_RE.test(cls)) suspiciousFindings++;
  }

  const baseFacilities = facilityCatalog.length ? facilityCatalog : fallbackFacilities;
  const facilityNetwork = baseFacilities.map((f) => ({
    ...f,
    ...(facMap.get(normalizeFacilityId(f.name)) || {
      activeReferrals: 0,
      totalReferrals: 0,
      completedReferrals: 0,
      overdueReferrals: 0,
      investigationsCount: 0,
      pendingInvestigations: 0
    })
  }));

  const teamByRole = { worker: 0, doctor: 0, specialist: 0, navigator: 0, admin: 0, patient: 0 };
  for (const u of adminUsersList) {
    const rk = normalizeRoleKey(u.role);
    teamByRole[rk] = (teamByRole[rk] || 0) + 1;
  }

  return {
    isLiveServer: false,
    totalPatients: patients.length,
    totalScreenings,
    pendingReviews: stageBreakdown.screened,
    completedReviews: patients.length - stageBreakdown.screened,
    stageBreakdown,
    totalReferrals: referralsList.length,
    activeReferralsCount,
    overdueFollowUpsCount: Math.max(overdueReferralsCount, overduePatients),
    overdueReferralsCount,
    referralsByStatus: Array.from(referralStatusMap.entries()).map(([status, count]) => ({ status, count })),
    referralsByPriority: Array.from(referralPriorityMap.entries()).map(([priority, count]) => ({ priority, count })),
    totalInvestigations: investigationsList.length,
    pendingInvestigations,
    completedInvestigations,
    investigationsByType: Array.from(invTypeMap.entries()).map(([testType, count]) => ({ testType, count })),
    totalConsultations: consultationsList.length,
    consultationsByStatus: Array.from(consultStatusMap.entries()).map(([status, count]) => ({ status, count })),
    upcomingConsultations: consultationsList.slice(0, 5),
    suspiciousFindings,
    aiSummary: {
      totalAnalyses: aiAnalysesList.length,
      suspiciousFindings,
      normalOrBenignFindings: Math.max(0, aiAnalysesList.length - suspiciousFindings),
      pendingAiCount: Math.max(0, totalScreenings - aiPatientIds.size),
      activeModel: aiStatusInfo?.model || aiStatusInfo?.id || 'Gemini Vision / SigLIP2',
      classBreakdown: Array.from(aiClassMap.entries()).map(([modelClass, count]) => ({ modelClass, count })),
      recentAnalyses: aiAnalysesList.slice(0, 5)
    },
    villageBreakdown,
    facilityNetwork,
    navigationSummary: {
      total: navigationList.length,
      attendanceConfirmed: navigationList.filter((n) => Number(n.attendance_confirmed) === 1).length,
      contacted: navigationList.filter((n) => ['contacted', 'visit_scheduled'].includes(n.contact_status)).length,
      pending: navigationList.filter((n) => n.contact_status === 'pending' || n.contact_status === 'unreachable').length
    },
    consentsSummary: {
      granted: consentsGranted,
      withdrawn: Math.max(0, patients.length - consentsGranted)
    },
    syncSummary: {
      totalEvents: automation?.total || 0,
      pendingEvents: automation?.pending || 0,
      deliveredEvents: Math.max(0, (automation?.total || 0) - (automation?.pending || 0)),
      receiptsCount: automation?.receipts || 0
    },
    teamSummary: {
      totalUsers: adminUsersList.length,
      staffCount: Math.max(0, adminUsersList.length - (teamByRole.patient || 0)),
      byRole: teamByRole
    },
    recentAudit: []
  };
}

function renderUrgentTasks({ patients, referralsList, lang, stageLabels }) {
  const isTe = lang === 'te';
  const referralItems = referralsList
    .filter((r) => !['completed', 'cancelled'].includes(r.status) && (r.isOverdue || r.priority === 'emergency' || r.priority === 'urgent'))
    .slice(0, 4);

  if (referralItems.length) {
    return referralItems
      .map((r) => {
        const p = r.patient || {};
        const tag = r.isOverdue
          ? (isTe ? 'గడువు దాటింది' : 'Overdue follow-up')
          : `${r.priority.toUpperCase()} · ${r.status}`;
        return `
        <div class="task">
          <div class="task-icon" style="${r.isOverdue || r.priority === 'emergency' ? 'background:#fef2f2;border-color:#fecaca;color:#dc2626;' : ''}">${r.isOverdue ? '◴' : '↗'}</div>
          <div>
            <p><strong>${esc(p.name || r.patientId)}</strong> · <span class="pill ${r.isOverdue || r.priority === 'emergency' ? 'red' : 'amber'}">${esc(tag)}</span></p>
            <small>${esc(r.facility)} · ${esc(p.village || '')} · ${esc(r.due_date || '')}</small>
          </div>
          <button class="table-action" style="margin-left:auto" data-open="${esc(r.patientId)}">↗</button>
        </div>`;
      })
      .join('');
  }

  const pendingList = patients.filter((p) => overdue(p) || p.stage === 'screened').slice(0, 4);
  return (
    pendingList
      .map(
        (p) => `
      <div class="task">
        <div class="task-icon">${overdue(p) ? '◴' : '▣'}</div>
        <div>
          <p><strong>${esc(p.name)}</strong></p>
          <p>${overdue(p) ? (isTe ? 'గడువు దాటిన ఫాలో-అప్' : 'Overdue follow-up') : esc(stageLabels[p.stage]?.[isTe ? 1 : 0] || p.stage)}</p>
          <small>${esc(p.village)} · ${esc(p.due || p.createdAt?.slice(0, 10) || '')}</small>
        </div>
        <button class="table-action" style="margin-left:auto" data-open="${esc(p.id)}">↗</button>
      </div>`
      )
      .join('') || `<p class="sub">${isTe ? 'పెండింగ్ చర్యలు లేవు.' : 'All pending tasks are cleared.'}</p>`
  );
}

/**
 * Renders the District Administrator Home / Overview Dashboard aligned with every
 * left-sidebar module (Patient Records, AI Vision, Referrals, District Insights,
 * ITDA Facilities, Offline Sync, Care Team).
 */
export function adminDashboardMarkup({
  lang,
  st,
  statsHtml,
  tableHtml,
  patients,
  referralsList,
  aiStatusInfo,
  adminUsersList,
  stageLabels
}) {
  const isTe = lang === 'te';
  const stages = st.stageBreakdown || {};
  const ai = st.aiSummary || { totalAnalyses: 0, suspiciousFindings: 0, pendingAiCount: 0, classBreakdown: [], recentAnalyses: [] };
  const nav = st.navigationSummary || { total: 0, attendanceConfirmed: 0, contacted: 0, pending: 0 };
  const sync = st.syncSummary || { totalEvents: 0, pendingEvents: 0, deliveredEvents: 0, receiptsCount: 0 };
  const team = st.teamSummary || { totalUsers: adminUsersList.length, staffCount: 0, byRole: {} };
  const consents = st.consentsSummary || { granted: 0, withdrawn: 0 };
  const villages = st.villageBreakdown || [];
  const maxVillageCount = Math.max(1, ...villages.map((v) => v.count || 0));
  const pendingDeviceCount = patients.filter((p) => p._sync === 'pending').length;
  const sharedCount = patients.filter((p) => p._sync !== 'pending').length;
  const aiModelLabel = aiStatusInfo?.model || ai.activeModel || 'Gemini Vision / SigLIP2';

  const referralStatusCounts = Object.fromEntries((st.referralsByStatus || []).map((r) => [r.status, r.count]));
  const invStatusTotal = st.totalInvestigations || 0;

  return `
  <div class="intro">
    <div>
      <h1>${isTe ? 'జిల్లా కమాండ్ & సంరక్షణ అవలోకనం' : 'ITDA Paderu · District Care Command'}</h1>
      <p class="sub">${isTe ? 'ఎడమ వైపు మాడ్యూల్స్ ప్రకారం SQLite ప్రత్యక్ష డేటా సారాంశం.' : 'Live operational view mapped directly across every District Admin module from SQLite.'}</p>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;">
      <button class="btn" id="btn-refresh-admin-dash" type="button">↻ ${isTe ? 'ప్రత్యక్ష డేటా రిఫ్రెష్' : 'Refresh Live Data'}</button>
      <button class="btn primary" data-go="district" type="button">${icon('district', 15)} ${isTe ? 'పూర్తి జిల్లా విశ్లేషణ' : 'District Insights'}</button>
    </div>
  </div>

  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">ITDA PADERU · ALLURI SITHARAMA RAJU DISTRICT</div>
      <h2>${isTe ? 'ప్రతి స్క్రీనింగ్ నుండి ఆసుపత్రి సంరక్షణ వరకు ప్రత్యక్ష సమన్వయం.' : 'Connected oral care across all agency mandals.'}</h2>
      <p>${isTe
        ? `${st.totalPatients} నమోదైన రోగులు · ${villages.length} గ్రామాలు · ${st.activeReferralsCount ?? 0} క్రియాశీల రెఫరల్స్ · ${ai.totalAnalyses} AI విశ్లేషణలు`
        : `${st.totalPatients} patients tracked across ${villages.length} villages · ${st.activeReferralsCount ?? 0} active referrals · ${ai.totalAnalyses} AI vision evaluations`}</p>
      <div class="hero-actions">
        <button class="btn" data-go="patients" type="button">${isTe ? 'రోగి రికార్డులు' : 'Patient Registry'} ${icon('arrow', 15)}</button>
        <button class="btn ghost" data-go="reviews" type="button">${isTe ? 'AI విజన్ క్యూ' : 'AI Vision Queue'}</button>
        <button class="btn ghost" data-go="referrals" type="button">${isTe ? 'రెఫరల్స్ క్యూ' : 'Referrals Queue'}</button>
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="hero-orbit"></div>
      <div class="hero-medallion">${icon('district', 46)}</div>
      <span class="orbit-label one">${isTe ? 'లైవ్ SQLite డేటా' : 'LIVE SQLITE'}</span>
      <span class="orbit-label two"><i></i>${villages.length} ${isTe ? 'గ్రామాలు' : 'VILLAGES'}</span>
    </div>
  </section>

  ${statsHtml}

  <div class="columns">
    <div>
      <!-- 1. Patient Records & 6-Stage Care Pathway -->
      <section class="card">
        <div class="card-head">
          <h2>📋 ${isTe ? 'రోగి రికార్డులు & సంరక్షణ దశలు' : 'Patient Records & Care Pathway'}</h2>
          <a data-go="patients">${isTe ? 'పూర్తి రిజిస్ట్రీ →' : 'Patient registry →'}</a>
        </div>
        ${tableHtml}
        <div style="margin-top:16px;">
          <div class="flow">
            ${Object.keys(stageLabels).map((k) => {
              const count = stages[k] ?? patients.filter((p) => p.stage === k).length;
              return `<div class="${count > 0 ? 'done' : ''}"><b>${count}</b>${esc(stageLabels[k]?.[isTe ? 1 : 0] || k)}</div>`;
            }).join('')}
          </div>
          <div class="dash-inline-pills">
            <span class="pill green">✓ ${isTe ? 'సక్రియ సమ్మతులు' : 'Active Consents'}: ${consents.granted}</span>
            ${consents.withdrawn ? `<span class="pill red">${isTe ? 'ఉపసంహరించబడిన సమ్మతులు' : 'Withdrawn'}: ${consents.withdrawn}</span>` : ''}
            <span class="pill">📷 ${isTe ? 'నోటి ఫోటోలు' : 'Oral Photos Captured'}: ${st.totalScreenings}</span>
          </div>
        </div>
      </section>

      <!-- 2. AI Analysis Demo / Gemini Vision Summary -->
      <section class="card">
        <div class="card-head">
          <h2>🧠 ${isTe ? 'AI విశ్లేషణ · జెమిని విజన్ ట్రయాజ్' : 'AI Analysis & Gemini Vision Triage'}</h2>
          <a data-go="reviews">${isTe ? 'AI విశ్లేషణకు వెళ్ళండి →' : 'Open AI Vision Demo →'}</a>
        </div>
        <div class="dash-mini-kpis">
          <div class="dash-mini-kpi">
            <span>${isTe ? 'మొత్తం AI స్కాన్లు' : 'AI Evaluations'}</span>
            <strong>${String(ai.totalAnalyses).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi alert">
            <span>${isTe ? 'అనుమానాస్పద సంకేతాలు' : 'Suspicious Flags'}</span>
            <strong>${String(ai.suspiciousFindings).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'సాధారణ / తేలికపాటి' : 'Routine / Benign'}</span>
            <strong>${String(ai.normalOrBenignFindings || 0).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'AI పెండింగ్ ఫోటోలు' : 'Pending AI Check'}</span>
            <strong>${String(ai.pendingAiCount || 0).padStart(2, '0')}</strong>
          </div>
        </div>
        <p class="mini" style="margin:8px 0 12px;">
          ${isTe ? 'యాక్టివ్ AI అడాప్టర్' : 'Active Adapter'}: <strong>${esc(aiModelLabel)}</strong> ·
          <span style="color:#b45309;">${isTe ? 'పరిశోధన సహాయం మాత్రమే (రోగ నిర్ధారణ కాదు)' : 'Research decision-support only (not a diagnosis)'}</span>
        </p>
        ${(ai.classBreakdown || []).length ? `
          <div style="margin-bottom:14px;">
            ${ai.classBreakdown.map((c) => `
              <div class="bar-row" style="margin:10px 0;">
                <span>${esc(c.modelClass)}</span>
                <div class="bar"><i style="width:${Math.min(100, (c.count / Math.max(1, ai.totalAnalyses)) * 100)}%;${SUSPICIOUS_RE.test(c.modelClass) ? 'background:#dc2626;' : ''}"></i></div>
                <b>${c.count}</b>
              </div>`).join('')}
          </div>` : ''}
        ${(ai.recentAnalyses || []).length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>${isTe ? 'రోగి' : 'Patient'}</th><th>${isTe ? 'AI పరిశీలన' : 'Candidate Pattern'}</th><th>${isTe ? 'స్కోరు' : 'Score'}</th><th>${isTe ? 'చర్య' : 'Action'}</th></tr>
              </thead>
              <tbody>
                ${ai.recentAnalyses.slice(0, 4).map((a) => `
                  <tr>
                    <td><strong>${esc(a.patientName || a.patientId)}</strong><small>${esc(a.village || '')}</small></td>
                    <td><span class="pill ${SUSPICIOUS_RE.test(a.modelClass) ? 'red' : 'green'}">${esc(a.modelClass)}</span></td>
                    <td>${a.topScore != null ? `${Math.round(a.topScore * 100)}%` : '—'}</td>
                    <td><button class="table-action" data-open="${esc(a.patientId)}">${isTe ? 'తెరవండి' : 'Open'} ↗</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : `<div class="empty">${isTe ? 'ఇంకా AI విశ్లేషణ రికార్డులు లేవు.' : 'No AI vision runs recorded yet.'}</div>`}
      </section>

      <!-- 3. Appointments, Referrals, Teleconsultations & Diagnostics -->
      <section class="card">
        <div class="card-head">
          <h2>📅 ${isTe ? 'రెఫరల్స్, అపాయింట్‌మెంట్లు & పరీక్షలు' : 'Referrals, Teleconsults & Diagnostics'}</h2>
          <a data-go="referrals">${isTe ? 'రెఫరల్స్ క్యూ →' : 'Open Referrals Queue →'}</a>
        </div>
        <div class="dash-mini-kpis">
          <div class="dash-mini-kpi">
            <span>${isTe ? 'రెఫర్ చేయబడింది' : 'Referred'}</span>
            <strong>${String(referralStatusCounts.referred || 0).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'షెడ్యూల్ అయింది' : 'Scheduled'}</span>
            <strong>${String(referralStatusCounts.scheduled || 0).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'హాజరు / పూర్తి' : 'Attended / Done'}</span>
            <strong>${String((referralStatusCounts.attended || 0) + (referralStatusCounts.completed || 0)).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'బయాప్సీ / ల్యాబ్స్' : 'Biopsies & Labs'}</span>
            <strong>${String(invStatusTotal).padStart(2, '0')}</strong>
          </div>
        </div>
        <div class="dash-inline-pills" style="margin:12px 0;">
          <span class="pill">📹 ${isTe ? 'టెలికన్సల్టేషన్లు' : 'Teleconsultations'}: ${st.totalConsultations || 0}</span>
          <span class="pill green">🧭 ${isTe ? 'రవాణా/నావిగేషన్' : 'Navigation Confirmed'}: ${nav.attendanceConfirmed}/${nav.total}</span>
          <span class="pill amber">🔬 ${isTe ? 'పూర్తయిన ల్యాబ్ రిపోర్టులు' : 'Lab Reports Ready'}: ${st.completedInvestigations || 0}/${invStatusTotal}</span>
        </div>
        ${(st.upcomingConsultations || []).length ? `
          <div class="table-wrap">
            <table>
              <thead>
                <tr><th>${isTe ? 'రోగి' : 'Patient'}</th><th>${isTe ? 'సమయం' : 'Scheduled'}</th><th>${isTe ? 'స్థితి' : 'Status'}</th><th>${isTe ? 'చర్య' : 'Action'}</th></tr>
              </thead>
              <tbody>
                ${st.upcomingConsultations.slice(0, 4).map((c) => `
                  <tr>
                    <td><strong>${esc(c.patientName || c.patientId)}</strong><small>${esc(c.village || '')}</small></td>
                    <td>${esc(new Date(c.scheduledAt).toLocaleDateString(isTe ? 'te-IN' : 'en-IN'))}</td>
                    <td><span class="pill ${c.status === 'completed' ? 'green' : 'amber'}">${esc(c.status)}</span></td>
                    <td><button class="table-action" data-open="${esc(c.patientId)}">${isTe ? 'తెరవండి' : 'Open'} ↗</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>` : ''}
      </section>
    </div>

    <div>
      <!-- 4. Next Actions & Urgent Triage Escalations -->
      <section class="card">
        <div class="card-head">
          <h2>⚡ ${isTe ? 'తక్షణ చర్యలు & గడువు దాటినవి' : 'Next Actions & Escalations'}</h2>
          <span class="pill amber">${st.pendingReviews + (st.overdueFollowUpsCount || 0)}</span>
        </div>
        ${renderUrgentTasks({ patients, referralsList, lang, stageLabels })}
      </section>

      <!-- 5. District Insights: Agency Village Coverage -->
      <section class="card">
        <div class="card-head">
          <h2>📊 ${isTe ? 'గ్రామాల వారీగా స్క్రీనింగ్ కవరేజ్' : 'Agency Village & Mandal Coverage'}</h2>
          <a data-go="district">${isTe ? 'పూర్తి విశ్లేషణ →' : 'District Insights →'}</a>
        </div>
        ${villages.slice(0, 8).map((v) => `
          <div class="bar-row" style="margin:12px 0;">
            <span>${esc(v.village)}</span>
            <div class="bar"><i style="width:${(v.count / maxVillageCount) * 100}%"></i></div>
            <b>${v.count}</b>
          </div>`).join('') || `<p class="sub">${isTe ? 'గ్రామాల డేటా లేదు.' : 'No village data recorded yet.'}</p>`}
        <p class="metric-note">${isTe ? 'ప్రత్యక్ష SQLite డేటా · ప్రతి గ్రామం & మండలం' : 'Live SQLite village counts across registered screenings'}</p>
      </section>

      <!-- 6. ITDA Facilities Network Caseload -->
      <section class="card">
        <div class="card-head">
          <h2>🏥 ${isTe ? 'ఐటీడీఏ ఆసుపత్రుల లోడ్' : 'ITDA Facilities Network Load'}</h2>
          <a data-go="facilities_portal">${isTe ? 'ఆసుపత్రులు →' : 'All Facilities →'}</a>
        </div>
        <div class="facility-load-list">
          ${(st.facilityNetwork || []).map((f) => `
            <div class="facility-load-row">
              <div>
                <strong>${esc(f.name)}</strong>
                <small>${esc(f.level)}${f.hasBiopsyFacility ? ' · 🔬 Biopsy' : ''}</small>
              </div>
              <div class="facility-load-counts">
                <span class="pill ${f.activeReferrals ? 'amber' : ''}">${f.activeReferrals} ${isTe ? 'యాక్టివ్' : 'Active'}</span>
                <span class="pill">${f.investigationsCount} ${isTe ? 'ల్యాబ్స్' : 'Labs'}</span>
                ${f.overdueReferrals ? `<span class="pill red">${f.overdueReferrals} ${isTe ? 'ఆలస్యం' : 'Overdue'}</span>` : ''}
              </div>
            </div>`).join('') || `<p class="sub">${isTe ? 'ఆసుపత్రి లోడ్ లేదు.' : 'No facility data yet.'}</p>`}
        </div>
      </section>

      <!-- 7. Offline Sync, Automation & Care Team Snapshot -->
      <section class="card">
        <div class="card-head">
          <h2>👥 ${isTe ? 'కేర్ టీమ్, ఆఫ్‌లైన్ సింక్ & ఆడిట్' : 'Care Team, Sync & Audit'}</h2>
          <a data-go="team">${isTe ? 'బృందం →' : 'Care Team →'}</a>
        </div>
        <div class="dash-mini-kpis" style="margin-bottom:12px;">
          <div class="dash-mini-kpi">
            <span>${isTe ? 'భాగస్వామ్య రికార్డులు' : 'Synced DB'}</span>
            <strong>${String(sharedCount).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'పరికర పెండింగ్' : 'Local Pending'}</span>
            <strong>${String(pendingDeviceCount).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'n8n ఈవెంట్లు' : 'Outbox Pending'}</span>
            <strong>${String(sync.pendingEvents || 0).padStart(2, '0')}</strong>
          </div>
          <div class="dash-mini-kpi">
            <span>${isTe ? 'క్రియాశీల సిబ్బంది' : 'Active Staff'}</span>
            <strong>${String(team.staffCount || 0).padStart(2, '0')}</strong>
          </div>
        </div>

        <div class="dash-inline-pills" style="margin-bottom:12px;">
          <span class="pill">ASHA: ${team.byRole?.worker || 0}</span>
          <span class="pill">MO: ${team.byRole?.doctor || 0}</span>
          <span class="pill">Specialist: ${team.byRole?.specialist || 0}</span>
          <span class="pill">Coordinator: ${team.byRole?.navigator || 0}</span>
          <span class="pill">Admin: ${team.byRole?.admin || 0}</span>
        </div>

        ${(st.recentAudit || []).length ? `
          <div class="audit-mini-feed">
            <strong style="font-size:11px;color:#043329;display:block;margin-bottom:6px;">${isTe ? 'తాజా సిస్టమ్ ఆడిట్ చర్యలు' : 'Recent Live Audit Trail'}</strong>
            ${st.recentAudit.slice(0, 5).map((a) => `
              <div class="audit-mini-row">
                <span><code>${esc(a.action)}</code> · ${esc(a.actorName || 'System')}</span>
                <small>${esc(a.recordId || '')}</small>
              </div>`).join('')}
          </div>` : ''}

        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
          <button class="btn" id="btn-open-sync-from-dash" type="button" style="font-size:11px;padding:7px 12px;">↻ ${isTe ? 'ఆఫ్‌లైన్ సింక్ తెరవండి' : 'Open Offline Sync'}</button>
          <button class="btn" data-go="team" type="button" style="font-size:11px;padding:7px 12px;">👥 ${isTe ? 'సిబ్బంది నిర్వహణ' : 'Manage Care Team'}</button>
        </div>
      </section>
    </div>
  </div>`;
}

/**
 * Renders the full District Insights / Live Metrics view cleanly from SQLite stats.
 */
export function districtInsightsMarkup({ lang, st, title, patients, stageLabels }) {
  const isTe = lang === 'te';
  const stages = st.stageBreakdown || {};
  const ai = st.aiSummary || { totalAnalyses: 0, suspiciousFindings: 0, classBreakdown: [] };
  const nav = st.navigationSummary || { total: 0, attendanceConfirmed: 0, contacted: 0, pending: 0 };
  const team = st.teamSummary || { staffCount: 0, byRole: {} };
  const villages = st.villageBreakdown || [];
  const maxVillage = Math.max(1, ...villages.map((v) => v.count || 0));

  return `
  <div class="intro">
    <div>
      <h1>${esc(title)}</h1>
      <p class="sub">${isTe ? 'ఐటీడీఏ పాడేరు ప్రత్యక్ష SQLite డేటాబేస్ విశ్లేషణ మరియు నివేదికలు.' : 'Live SQLite database aggregation across all ITDA Paderu agency mandals.'}</p>
    </div>
    <button class="btn primary" id="btn-refresh-stats" type="button">↻ ${isTe ? 'డేటాబేస్ రిఫ్రెష్' : 'Refresh Live SQLite'}</button>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-top">${isTe ? 'మొత్తం రోగులు' : 'Total Patients'}<span class="stat-icon">👥</span></div><strong>${String(st.totalPatients).padStart(2, '0')}</strong><small>${isTe ? 'రిజిస్టర్ అయినవారు' : 'Registered cohort'}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'నోటి స్క్రీనింగ్‌లు' : 'Oral Screenings'}<span class="stat-icon">📷</span></div><strong>${String(st.totalScreenings).padStart(2, '0')}</strong><small>${isTe ? 'ఫోటో రికార్డులు' : 'Photo captures'}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'సమీక్ష పెండింగ్' : 'Pending Reviews'}<span class="stat-icon">⏳</span></div><strong style="color:#d97706;">${String(st.pendingReviews).padStart(2, '0')}</strong><small>${isTe ? 'వైద్యుని కోసం వేచి' : 'Doctor queue'}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'క్రియాశీల రెఫరల్స్' : 'Active Referrals'}<span class="stat-icon">↗</span></div><strong>${String(st.activeReferralsCount ?? st.totalReferrals).padStart(2, '0')}</strong><small>${isTe ? 'మొత్తం' : 'Total'}: ${st.totalReferrals} · ${isTe ? 'ఆలస్యం' : 'Overdue'}: ${st.overdueFollowUpsCount || 0}</small></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-top">${isTe ? 'బయాప్సీ & ల్యాబ్ పరీక్షలు' : 'Investigations'}<span class="stat-icon">🔬</span></div><strong>${String(st.totalInvestigations).padStart(2, '0')}</strong><small>${isTe ? 'పూర్తయినవి' : 'Completed'}: ${st.completedInvestigations || 0}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'టెలికన్సల్టేషన్లు' : 'Teleconsultations'}<span class="stat-icon">📹</span></div><strong>${String(st.totalConsultations).padStart(2, '0')}</strong><small>${isTe ? 'వీడియో కాల్స్' : 'WebRTC rooms'}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'అనుమానిత AI ఫలితాలు' : 'AI Suspicious Alerts'}<span class="stat-icon">⚠</span></div><strong style="color:#dc2626;">${String(st.suspiciousFindings).padStart(2, '0')}</strong><small>${isTe ? 'మొత్తం AI స్కాన్లు' : 'Total AI runs'}: ${ai.totalAnalyses}</small></div>
    <div class="stat"><div class="stat-top">${isTe ? 'పూర్తయిన సమీక్షలు' : 'Signed Reviews'}<span class="stat-icon">✓</span></div><strong>${String(st.completedReviews).padStart(2, '0')}</strong><small>${isTe ? 'నావిగేషన్' : 'Navigated'}: ${nav.attendanceConfirmed}/${nav.total}</small></div>
  </div>

  <div class="columns">
    <div>
      <section class="card">
        <div class="card-head">
          <h2>${isTe ? 'గ్రామాల వారీగా రోగుల పంపిణీ' : 'Coverage by Agency Village'}</h2>
          <span class="pill">${villages.length} ${isTe ? 'గ్రామాలు' : 'Villages'}</span>
        </div>
        ${villages.map((v) => `
          <div class="bar-row">
            <span>${esc(v.village)}</span>
            <div class="bar"><i style="width:${(v.count / maxVillage) * 100}%"></i></div>
            <b>${v.count}</b>
          </div>`).join('') || `<p class="sub">${isTe ? 'డేటా లేదు.' : 'No village records yet.'}</p>`}
      </section>

      <section class="card">
        <h2>${isTe ? 'ఐటీడీఏ ఆసుపత్రుల వారీగా లోడ్' : 'ITDA Facility Network Caseload'}</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>${isTe ? 'ఆసుపత్రి' : 'Facility'}</th><th>${isTe ? 'రెఫరల్స్' : 'Referrals'}</th><th>${isTe ? 'బయాప్సీలు' : 'Labs'}</th><th>${isTe ? 'గడువు దాటినవి' : 'Overdue'}</th></tr>
            </thead>
            <tbody>
              ${(st.facilityNetwork || []).map((f) => `
                <tr>
                  <td><strong>${esc(f.name)}</strong><small>${esc(f.village)}</small></td>
                  <td>${f.activeReferrals} / ${f.totalReferrals}</td>
                  <td>${f.investigationsCount}</td>
                  <td>${f.overdueReferrals ? `<span class="pill red">${f.overdueReferrals}</span>` : '0'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </section>
    </div>

    <div>
      <section class="card">
        <h2>${isTe ? 'సంరక్షణ దశల పంపిణీ' : 'Care Pipeline Progression'}</h2>
        ${Object.keys(stageLabels).map((k) => {
          const n = stages[k] ?? patients.filter((p) => p.stage === k).length;
          return `
            <div class="bar-row">
              <span>${esc(stageLabels[k]?.[isTe ? 1 : 0] || k)}</span>
              <div class="bar"><i style="width:${(n / Math.max(1, st.totalPatients)) * 100}%"></i></div>
              <b>${n}</b>
            </div>`;
        }).join('')}
      </section>

      <section class="card">
        <h2>${isTe ? 'AI విజన్ వర్గీకరణ & పరీక్షల పంపిణీ' : 'AI Findings & Diagnostics Mix'}</h2>
        ${(ai.classBreakdown || []).map((c) => `
          <div class="bar-row">
            <span>${esc(c.modelClass)}</span>
            <div class="bar"><i style="width:${(c.count / Math.max(1, ai.totalAnalyses)) * 100}%;${SUSPICIOUS_RE.test(c.modelClass) ? 'background:#dc2626;' : ''}"></i></div>
            <b>${c.count}</b>
          </div>`).join('') || `<p class="sub">${isTe ? 'AI విశ్లేషణలు ఇంకా లేవు.' : 'No AI evaluations logged yet.'}</p>`}
        <div class="dash-inline-pills" style="margin-top:14px;">
          ${(st.investigationsByType || []).map((it) => `<span class="pill">${esc(it.testType)}: ${it.count}</span>`).join('')}
          ${(st.referralsByPriority || []).map((pr) => `<span class="pill ${pr.priority === 'emergency' ? 'red' : pr.priority === 'urgent' ? 'amber' : ''}">${esc(pr.priority)}: ${pr.count}</span>`).join('')}
          <span class="pill green">${isTe ? 'సిబ్బంది' : 'Active Staff'}: ${team.staffCount || 0}</span>
        </div>
      </section>

      ${(st.recentAudit || []).length ? `
        <section class="card">
          <h2>${isTe ? 'తాజా సిస్టమ్ ఆడిట్ లాగ్' : 'Recent District Audit Ledger'}</h2>
          <div class="audit-mini-feed">
            ${st.recentAudit.map((a) => `
              <div class="audit-mini-row">
                <span><code>${esc(a.action)}</code> · ${esc(a.actorName || 'System')}</span>
                <small>${esc(a.recordId || new Date(a.at).toLocaleTimeString())}</small>
              </div>`).join('')}
          </div>
        </section>` : ''}
    </div>
  </div>`;
}

/**
 * Live Gemini Vision / AI Triage header panel shown on the AI Analysis Demo view.
 */
export function aiReviewOverviewMarkup({ lang, aiStatusInfo, aiAnalysesList = [], pendingCount = 0 }) {
  const isTe = lang === 'te';
  const suspiciousCount = aiAnalysesList.filter((a) => SUSPICIOUS_RE.test(a.modelClass || '')).length;
  const modelLabel = aiStatusInfo?.model || 'Google Gemini 1.5 Flash (Vision)';

  return `
  <section class="card" style="margin-bottom:18px;border-left:4px solid #059669;">
    <div class="card-head" style="margin-bottom:10px;">
      <div>
        <h2>🧠 ${isTe ? 'జెమిని AI విజన్ & క్లినికల్ ట్రయాజ్ డెమో' : 'Gemini Vision & Research AI Triage Ledger'}</h2>
        <small class="sub">${isTe ? 'ప్రస్తుత మోడల్:' : 'Active Adapter:'} <strong>${esc(modelLabel)}</strong> · ${isTe ? 'పరిశోధన సహాయం మాత్రమే' : 'Research Advisory Only — Clinician Sign-Off Mandatory'}</small>
      </div>
      <div class="dash-inline-pills">
        <span class="pill green">${isTe ? 'AI స్కాన్లు' : 'AI Runs'}: ${aiAnalysesList.length}</span>
        <span class="pill red">${isTe ? 'అనుమానిత అలర్ట్‌లు' : 'High-Risk Flags'}: ${suspiciousCount}</span>
        <span class="pill amber">${isTe ? 'పెండింగ్ రివ్యూలు' : 'Pending Review'}: ${pendingCount}</span>
      </div>
    </div>
    ${aiAnalysesList.length ? `
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>${isTe ? 'రోగి' : 'Patient'}</th><th>${isTe ? 'గ్రామం' : 'Village'}</th><th>${isTe ? 'AI అంచనా' : 'Candidate Pattern'}</th><th>${isTe ? 'విశ్వాసం' : 'Confidence'}</th><th>${isTe ? 'మోడల్' : 'Adapter'}</th><th>${isTe ? 'చర్య' : 'Action'}</th></tr>
          </thead>
          <tbody>
            ${aiAnalysesList.slice(0, 6).map((a) => `
              <tr>
                <td><strong>${esc(a.patientName || a.patientId)}</strong><small>${esc(a.patientId)}</small></td>
                <td>${esc(a.village || '—')}</td>
                <td><span class="pill ${SUSPICIOUS_RE.test(a.modelClass) ? 'red' : 'green'}">${esc(a.modelClass)}</span></td>
                <td>${a.candidateFindings?.[0]?.score != null ? `${Math.round(a.candidateFindings[0].score * 100)}%` : '—'}</td>
                <td><small>${esc(a.modelName)}</small></td>
                <td><button class="table-action" data-open="${esc(a.patientId)}">${isTe ? 'తెరవండి' : 'Open'} ↗</button></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
  </section>`;
}

