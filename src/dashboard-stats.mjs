/**
 * Aarogya Drishti — Live SQLite District & Facility Aggregation
 *
 * Computes real-time operational statistics directly from SQLite tables across
 * every left-sidebar module (Patient Records, AI Vision, Referrals, Facilities,
 * Offline/Automation Events, Investigations, Navigation, and Care Team).
 */

import { ITDA_FACILITIES, isReferralOverdue } from './facilities.mjs';

const SUSPICIOUS_RE = /(suspicious|fibrosis|osmf|leukoplakia|erythroplakia|ulcer|dysplasia|lichen|malignant|high)/i;

function facilityKey(name = '') {
  const lower = String(name).toLowerCase();
  if (lower.includes('paderu') && !lower.includes('mobile')) return 'AH_PADERU';
  if (lower.includes('araku')) return 'CHC_ARAKU';
  if (lower.includes('chintapall')) return 'CHC_CHINTAPALLE';
  if (lower.includes('hukumpeta')) return 'PHC_HUKUMPETA';
  if (lower.includes('mobile') || lower.includes('shandy')) return 'MOBILE_DENTAL_01';
  if (lower.includes('king george') || lower.includes('kgh') || lower.includes('visakhapatnam') || lower.includes('vizag')) return 'KGH_VIZAG';
  return 'OTHER';
}

function normalizeRole(role) {
  if (role === 'asha') return 'worker';
  if (role === 'hospital') return 'navigator';
  return role;
}

export function buildDashboardStats(db, user, aiRegistry) {
  const todayStr = new Date().toISOString().slice(0, 10);

  const patientRows = db.prepare('SELECT id, body, version, updated_at FROM patients ORDER BY updated_at DESC').all();
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
  let patientConsentActive = 0;

  for (const row of patientRows) {
    let p = {};
    try {
      p = JSON.parse(row.body);
    } catch {
      continue;
    }
    const stage = Object.hasOwn(stageBreakdown, p.stage) ? p.stage : 'screened';
    stageBreakdown[stage]++;
    if (p.photo) totalScreenings++;
    if (p.consent === true) patientConsentActive++;
    if (p.due && p.due < todayStr && stage !== 'closed') overduePatients++;

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

  const villageBreakdown = Array.from(villageMap.values()).sort((a, b) => b.count - a.count || a.village.localeCompare(b.village));

  // Referrals & overdue follow-ups
  const referralRows = db.prepare('SELECT id, patient_id, facility, priority, due_date, status, quadrant, updated_at FROM referrals').all();
  let activeReferralsCount = 0;
  let overdueReferralsCount = 0;
  const referralStatusMap = new Map();
  const referralPriorityMap = new Map();
  const facilityMetricsMap = new Map();

  const ensureFacilityBucket = (key) => {
    if (!facilityMetricsMap.has(key)) {
      facilityMetricsMap.set(key, {
        activeReferrals: 0,
        totalReferrals: 0,
        completedReferrals: 0,
        overdueReferrals: 0,
        investigationsCount: 0,
        pendingInvestigations: 0
      });
    }
    return facilityMetricsMap.get(key);
  };

  for (const r of referralRows) {
    const status = r.status || 'referred';
    const priority = r.priority || 'routine';
    referralStatusMap.set(status, (referralStatusMap.get(status) || 0) + 1);
    referralPriorityMap.set(priority, (referralPriorityMap.get(priority) || 0) + 1);

    const isActive = !['completed', 'cancelled'].includes(status);
    const isOverdue = isReferralOverdue(r.due_date, status);
    if (isActive) activeReferralsCount++;
    if (isOverdue) overdueReferralsCount++;

    const bucket = ensureFacilityBucket(facilityKey(r.facility));
    bucket.totalReferrals++;
    if (isActive) bucket.activeReferrals++;
    if (status === 'completed') bucket.completedReferrals++;
    if (isOverdue) bucket.overdueReferrals++;
  }

  // Clinical reviews & Investigations
  const completedReviews = db.prepare('SELECT count(*) AS c FROM clinical_reviews').get().c;
  const investigationRows = db.prepare('SELECT id, patient_id, test_type, facility, status FROM investigations').all();
  let pendingInvestigations = 0;
  let completedInvestigations = 0;
  const invTypeMap = new Map();
  const invStatusMap = new Map();

  for (const inv of investigationRows) {
    const st = inv.status || 'ordered';
    const tt = inv.test_type || 'biopsy';
    invStatusMap.set(st, (invStatusMap.get(st) || 0) + 1);
    invTypeMap.set(tt, (invTypeMap.get(tt) || 0) + 1);

    const isDone = st === 'completed' || st === 'reported';
    if (isDone) completedInvestigations++;
    else if (st !== 'cancelled') pendingInvestigations++;

    const bucket = ensureFacilityBucket(facilityKey(inv.facility));
    bucket.investigationsCount++;
    if (!isDone && st !== 'cancelled') bucket.pendingInvestigations++;
  }

  // Consultations
  const consultationRows = db.prepare(`
    SELECT c.id, c.patient_id AS patientId, c.scheduled_at AS scheduledAt, c.status, c.room_url AS roomUrl, p.body AS patientBody
    FROM consultations c
    LEFT JOIN patients p ON p.id = c.patient_id
    ORDER BY c.scheduled_at DESC
  `).all();

  const consultStatusMap = new Map();
  const upcomingConsultations = [];
  for (const c of consultationRows) {
    const st = c.status || 'preparing';
    consultStatusMap.set(st, (consultStatusMap.get(st) || 0) + 1);
    let patientName = c.patientId;
    let village = '';
    try {
      const pb = JSON.parse(c.patientBody || '{}');
      patientName = pb.name || c.patientId;
      village = pb.village || '';
    } catch {}
    if (upcomingConsultations.length < 6) {
      upcomingConsultations.push({
        id: c.id,
        patientId: c.patientId,
        patientName,
        village,
        scheduledAt: c.scheduledAt,
        status: st,
        roomUrl: c.roomUrl || null
      });
    }
  }

  // AI Analyses / Gemini Vision
  const aiRows = db.prepare(`
    SELECT a.id, a.patient_id AS patientId, a.model_name AS modelName, a.model_class AS modelClass,
           a.candidate_findings AS candidateFindings, a.status, a.processed_at AS processedAt,
           p.body AS patientBody, u.name AS requesterName
    FROM ai_analyses a
    LEFT JOIN patients p ON p.id = a.patient_id
    LEFT JOIN users u ON u.id = a.requested_by
    ORDER BY a.processed_at DESC
  `).all();

  let suspiciousFindings = 0;
  const aiClassMap = new Map();
  const analyzedPatients = new Set();
  const recentAnalyses = [];

  for (const a of aiRows) {
    analyzedPatients.add(a.patientId);
    const cls = a.modelClass || 'Unclassified';
    aiClassMap.set(cls, (aiClassMap.get(cls) || 0) + 1);
    if (SUSPICIOUS_RE.test(cls)) suspiciousFindings++;

    if (recentAnalyses.length < 6) {
      let patientName = a.patientId;
      let village = '';
      let stage = 'screened';
      try {
        const pb = JSON.parse(a.patientBody || '{}');
        patientName = pb.name || a.patientId;
        village = pb.village || '';
        stage = pb.stage || 'screened';
      } catch {}
      let candidateFindings = [];
      try {
        candidateFindings = JSON.parse(a.candidateFindings || '[]');
      } catch {}
      recentAnalyses.push({
        id: a.id,
        patientId: a.patientId,
        patientName,
        village,
        stage,
        modelName: a.modelName,
        modelClass: cls,
        topScore: candidateFindings[0]?.score ?? null,
        requesterName: a.requesterName || 'Clinician',
        processedAt: a.processedAt
      });
    }
  }

  const pendingAiCount = Math.max(0, totalScreenings - analyzedPatients.size);

  // ITDA Facility Network combined with SQLite counts
  const facilityNetwork = ITDA_FACILITIES.map((fac) => {
    const metrics = facilityMetricsMap.get(fac.id) || {
      activeReferrals: 0,
      totalReferrals: 0,
      completedReferrals: 0,
      overdueReferrals: 0,
      investigationsCount: 0,
      pendingInvestigations: 0
    };
    return {
      ...fac,
      ...metrics
    };
  });

  // Patient Navigation summary
  const navRows = db.prepare('SELECT contact_status, attendance_confirmed FROM patient_navigation').all();
  const navigationSummary = {
    total: navRows.length,
    attendanceConfirmed: navRows.filter((n) => Number(n.attendance_confirmed) === 1).length,
    contacted: navRows.filter((n) => ['contacted', 'visit_scheduled'].includes(n.contact_status)).length,
    pending: navRows.filter((n) => n.contact_status === 'pending' || n.contact_status === 'unreachable').length
  };

  // Consents summary
  const consentRows = db.prepare('SELECT status, count(*) AS count FROM consents GROUP BY status').all();
  const consentsSummary = {
    granted: consentRows.find((r) => r.status === 'granted')?.count ?? patientConsentActive,
    withdrawn: consentRows.find((r) => r.status === 'withdrawn')?.count ?? 0
  };

  // Automation / Offline Sync queue
  const eventCounts = db.prepare('SELECT count(*) AS total, sum(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS pending FROM events').get();
  const receiptsCount = db.prepare('SELECT count(*) AS n FROM automation_receipts').get().n;
  const syncSummary = {
    totalEvents: eventCounts.total || 0,
    pendingEvents: eventCounts.pending || 0,
    deliveredEvents: Math.max(0, (eventCounts.total || 0) - (eventCounts.pending || 0)),
    receiptsCount
  };

  // Care Team summary
  const userRows = db.prepare('SELECT role, count(*) AS count FROM users WHERE active = 1 GROUP BY role').all();
  const teamByRole = { worker: 0, doctor: 0, specialist: 0, navigator: 0, admin: 0, patient: 0 };
  let totalActiveUsers = 0;
  for (const r of userRows) {
    const key = normalizeRole(r.role);
    teamByRole[key] = (teamByRole[key] || 0) + r.count;
    totalActiveUsers += r.count;
  }

  // Recent Audit Activity (admin-only visibility)
  let recentAudit = [];
  if (user?.role === 'admin') {
    recentAudit = db.prepare(`
      SELECT a.id, a.action, a.record_id AS recordId, a.at, u.name AS actorName, u.role AS actorRole
      FROM audit a
      LEFT JOIN users u ON u.id = a.actor
      ORDER BY a.id DESC
      LIMIT 8
    `).all();
  }

  return {
    totalPatients: patientRows.length,
    totalScreenings,
    pendingReviews: stageBreakdown.screened,
    completedReviews,
    stageBreakdown,
    totalReferrals: referralRows.length,
    activeReferralsCount,
    overdueFollowUpsCount: Math.max(overdueReferralsCount, overduePatients),
    overdueReferralsCount,
    referralsByStatus: Array.from(referralStatusMap.entries()).map(([status, count]) => ({ status, count })),
    referralsByPriority: Array.from(referralPriorityMap.entries()).map(([priority, count]) => ({ priority, count })),
    referralsByFacility: facilityNetwork
      .filter((f) => f.totalReferrals > 0)
      .map((f) => ({ facility: f.name, count: f.totalReferrals })),
    totalInvestigations: investigationRows.length,
    pendingInvestigations,
    completedInvestigations,
    investigationsByType: Array.from(invTypeMap.entries()).map(([testType, count]) => ({ testType, count })),
    investigationsByStatus: Array.from(invStatusMap.entries()).map(([status, count]) => ({ status, count })),
    totalConsultations: consultationRows.length,
    consultationsByStatus: Array.from(consultStatusMap.entries()).map(([status, count]) => ({ status, count })),
    upcomingConsultations,
    suspiciousFindings,
    aiSummary: {
      totalAnalyses: aiRows.length,
      suspiciousFindings,
      normalOrBenignFindings: Math.max(0, aiRows.length - suspiciousFindings),
      pendingAiCount,
      activeModel: aiRegistry?.activeModelId || 'google/gemini-flash',
      classBreakdown: Array.from(aiClassMap.entries()).map(([modelClass, count]) => ({ modelClass, count })),
      recentAnalyses
    },
    villageBreakdown,
    facilityNetwork,
    navigationSummary,
    consentsSummary,
    syncSummary,
    teamSummary: {
      totalUsers: totalActiveUsers,
      staffCount: totalActiveUsers - (teamByRole.patient || 0),
      byRole: teamByRole
    },
    recentAudit
  };
}

