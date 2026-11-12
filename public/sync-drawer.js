/**
 * Aarogya Drishti — Role-Aware Offline Sync Drawer & Conflict Resolution Component
 *
 * Provides durable IndexedDB synchronization visibility across ALL 6 portals:
 * - ASHA / Worker: offline patient screenings, photos, & auto-saved drafts
 * - Medical Officer (Doctor): offline clinical reviews, care entries, & triage queue
 * - Specialist: offline biopsy/pathology orders & lab findings
 * - Hospital Coordinator: offline referral updates & patient navigation logs
 * - District Admin: offline snapshot across district records, referrals, & n8n outbox
 * - Patient: offline personal health record vault & appointment cache
 */

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

let drawerHost = null;
let modalHost = null;
let currentCallbacks = {};

function roleMeta(role, isTe) {
  const map = {
    worker: { label: isTe ? 'ఆశా వర్కర్ పోర్టల్' : 'ASHA / Worker Portal', thirdLabel: isTe ? 'ఫోటోలు' : 'Photos Cached' },
    asha: { label: isTe ? 'ఆశా వర్కర్ పోర్టల్' : 'ASHA / Worker Portal', thirdLabel: isTe ? 'ఫోటోలు' : 'Photos Cached' },
    doctor: { label: isTe ? 'వైద్యాధికారి పోర్టల్' : 'Medical Officer Portal', thirdLabel: isTe ? 'సమీక్ష పెండింగ్' : 'Awaiting Review' },
    specialist: { label: isTe ? 'స్పెషలిస్ట్ పోర్టల్' : 'Specialist Portal', thirdLabel: isTe ? 'బయాప్సీ / ల్యాబ్స్' : 'Biopsies & Labs' },
    hospital: { label: isTe ? 'హాస్పిటల్ కోఆర్డినేటర్' : 'Hospital Coordinator', thirdLabel: isTe ? 'రెఫరల్స్' : 'Referrals Cached' },
    navigator: { label: isTe ? 'హాస్పిటల్ కోఆర్డినేటర్' : 'Hospital Coordinator', thirdLabel: isTe ? 'రెఫరల్స్' : 'Referrals Cached' },
    admin: { label: isTe ? 'జిల్లా అడ్మిన్ పోర్టల్' : 'District Admin Portal', thirdLabel: isTe ? 'n8n పెండింగ్' : 'n8n Pending' },
    patient: { label: isTe ? 'రోగి పోర్టల్' : 'Patient Portal', thirdLabel: isTe ? 'సంప్రదింపులు' : 'Consults Cached' }
  };
  return map[role] || map.worker;
}

function renderRoleCachedVault({
  role,
  isTe,
  patients,
  referralsList,
  investigationsList,
  navigationList,
  consultationsList,
  aiAnalysesList,
  automation,
  hasScreeningDraft
}) {
  if (role === 'patient') {
    const p = patients[0];
    if (!p) {
      return `<div class="sync-empty-mini">${isTe ? 'ఆఫ్‌లైన్ కోసం వ్యక్తిగత రికార్డు ఇంకా లోడ్ కాలేదు.' : 'No personal health record cached on this device yet.'}</div>`;
    }
    return `
      <div class="sync-vault-card">
        <div class="sync-vault-row">
          <div>
            <strong>${esc(p.name)}</strong>
            <small>${esc(p.id)} · ${esc(p.village || '')}</small>
          </div>
          <span class="pill green">${isTe ? 'ఆఫ్‌లైన్ సిద్ధం' : 'Cached ✓'}</span>
        </div>
        <div class="sync-vault-meta">
          <span>${isTe ? 'దశ' : 'Stage'}: <strong>${esc(p.stage)}</strong></span>
          <span>${isTe ? 'ఫోటో' : 'Photo'}: <strong>${p.photo ? '✓' : '—'}</strong></span>
          <span>${isTe ? 'సలహా' : 'Notes'}: <strong>${p.notes ? '✓' : '—'}</strong></span>
        </div>
      </div>`;
  }

  if (role === 'specialist') {
    if (!investigationsList.length && !patients.length) {
      return `<div class="sync-empty-mini">${isTe ? 'క్యాష్ చేసిన బయాప్సీ ఆర్డర్లు లేవు.' : 'No cached investigation orders yet.'}</div>`;
    }
    return investigationsList.slice(0, 4).map((inv) => `
      <div class="sync-vault-card">
        <div class="sync-vault-row">
          <div>
            <strong style="text-transform:uppercase;">${esc(inv.test_type)}</strong>
            <small>${esc(inv.patient_id)} · ${esc(inv.facility)}</small>
          </div>
          <span class="pill ${inv.status === 'completed' || inv.status === 'reported' ? 'green' : 'amber'}">${esc(inv.status)}</span>
        </div>
        <button class="btn ghost" style="font-size:10px;padding:4px 8px;margin-top:6px;" data-drawer-open="${esc(inv.patient_id)}">↗ ${isTe ? 'రోగి రికార్డు' : 'Open Patient'}</button>
      </div>`).join('') || `<div class="sync-empty-mini">${patients.length} ${isTe ? 'రోగులు క్యాష్ అయ్యారు.' : 'patients cached offline.'}</div>`;
  }

  if (['hospital', 'navigator'].includes(role)) {
    const items = referralsList.slice(0, 4);
    if (!items.length) {
      return `<div class="sync-empty-mini">${navigationList.length} ${isTe ? 'నావిగేషన్ లాగ్‌లు క్యాష్ అయ్యాయి.' : 'navigation logs cached on device.'}</div>`;
    }
    return items.map((r) => `
      <div class="sync-vault-card">
        <div class="sync-vault-row">
          <div>
            <strong>${esc(r.patient?.name || r.patientId)}</strong>
            <small>${esc(r.facility)} · ${esc(r.due_date || '')}</small>
          </div>
          <span class="pill ${r.isOverdue ? 'red' : 'amber'}">${esc(r.status)}</span>
        </div>
        <button class="btn ghost" style="font-size:10px;padding:4px 8px;margin-top:6px;" data-drawer-open="${esc(r.patientId)}">↗ ${isTe ? 'తెరవండి' : 'Open'}</button>
      </div>`).join('');
  }

  if (role === 'admin') {
    return `
      <div class="sync-vault-card">
        <div class="sync-vault-meta">
          <span>${isTe ? 'రోగులు' : 'Patients'}: <strong>${patients.length}</strong></span>
          <span>${isTe ? 'రెఫరల్స్' : 'Referrals'}: <strong>${referralsList.length}</strong></span>
          <span>${isTe ? 'బయాప్సీలు' : 'Labs'}: <strong>${investigationsList.length}</strong></span>
          <span>${isTe ? 'AI స్కాన్లు' : 'AI Runs'}: <strong>${aiAnalysesList.length}</strong></span>
          <span>${isTe ? 'కాల్స్' : 'Consults'}: <strong>${consultationsList.length}</strong></span>
          <span>${isTe ? 'n8n రసీదులు' : 'Receipts'}: <strong>${automation?.receipts || 0}</strong></span>
        </div>
      </div>
      ${patients.slice(0, 4).map((p) => `
        <div class="sync-vault-card">
          <div class="sync-vault-row">
            <div>
              <strong>${esc(p.name)}</strong>
              <small>${esc(p.id)} · ${esc(p.village)}</small>
            </div>
            <button class="btn ghost" style="font-size:10px;padding:4px 8px;" data-drawer-open="${esc(p.id)}">↗</button>
          </div>
        </div>`).join('')}`;
  }

  // ASHA / Worker & Doctor default vault: cached screening drafts + patient records
  const draftNotice = hasScreeningDraft
    ? `<div class="sync-vault-card" style="border-color:#fde68a;background:#fffbeb;">
         <div class="sync-vault-row">
           <div>
             <strong>📝 ${isTe ? 'అసంపూర్ణ స్క్రీనింగ్ డ్రాఫ్ట్ సేవ్ అయింది' : 'Unsaved Screening Draft Preserved'}</strong>
             <small>${isTe ? 'బ్రౌజర్ రీలోడ్ చేసినా సురక్షితంగా ఉంటుంది' : 'Retained locally across refreshes'}</small>
           </div>
           <button class="btn" style="font-size:10px;padding:5px 9px;" data-drawer-view="screening">${isTe ? 'కొనసాగించు' : 'Resume →'}</button>
         </div>
       </div>`
    : '';

  const list = role === 'doctor'
    ? [...patients].sort((a, b) => (a.stage === 'screened' ? -1 : 1) - (b.stage === 'screened' ? -1 : 1)).slice(0, 4)
    : patients.slice(0, 4);

  return draftNotice + (list.map((p) => `
    <div class="sync-vault-card">
      <div class="sync-vault-row">
        <div>
          <strong>${esc(p.name)}</strong>
          <small>${esc(p.id)} · ${esc(p.village)} · ${p.photo ? '📷' : '—'}</small>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span class="pill ${p.stage === 'screened' ? 'amber' : 'green'}" style="font-size:9px;">${esc(p.stage)}</span>
          <button class="btn ghost" style="font-size:10px;padding:4px 8px;" data-drawer-open="${esc(p.id)}">↗</button>
        </div>
      </div>
    </div>`).join('') || `<div class="sync-empty-mini">${isTe ? 'ఇంకా ఆఫ్‌లైన్ రికార్డులు క్యాష్ కాలేదు.' : 'No patient records cached on this device yet.'}</div>`);
}

export function mountSyncDrawer({
  role = 'worker',
  user = {},
  patients = [],
  outbox = [],
  referralsList = [],
  investigationsList = [],
  navigationList = [],
  consultationsList = [],
  aiAnalysesList = [],
  automation = {},
  lastSyncAt = null,
  hasScreeningDraft = false,
  lang = 'en',
  onSyncAll,
  onSyncSingle,
  onSyncOutboxItem,
  onDiscardOutboxItem,
  onResolveConflict,
  onOpenRecord,
  onOpenView
}) {
  currentCallbacks = {
    onSyncAll,
    onSyncSingle,
    onSyncOutboxItem,
    onDiscardOutboxItem,
    onResolveConflict,
    onOpenRecord,
    onOpenView
  };
  const isTe = lang === 'te';
  const meta = roleMeta(role, isTe);

  if (!drawerHost) {
    drawerHost = document.createElement('div');
    drawerHost.id = 'sync-drawer-container';
    document.body.appendChild(drawerHost);

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSyncDrawer();
        closeConflictModal();
      }
    });
  }

  const queuedPatients = patients.filter(
    (p) => p._sync === 'pending' || p._sync === 'conflict' || Boolean(p._syncError)
  );
  // Deduplicate if an outbox review shares the same patientId already marked pending on patient
  const outboxIdsOnPatients = new Set(queuedPatients.map((p) => p.id));
  const extraOutbox = outbox.filter((o) => !o.patientId || !outboxIdsOnPatients.has(o.patientId) || o.type !== 'review.save');
  const totalQueued = queuedPatients.length + extraOutbox.length;
  const conflictCount = patients.filter((p) => p._sync === 'conflict').length + outbox.filter((o) => o.status === 'conflict').length;

  const thirdMetric =
    role === 'specialist'
      ? investigationsList.length
      : ['hospital', 'navigator'].includes(role)
      ? referralsList.length
      : role === 'admin'
      ? (automation?.pending || 0)
      : role === 'doctor'
      ? patients.filter((p) => p.stage === 'screened').length
      : role === 'patient'
      ? (consultationsList.length || referralsList.length)
      : patients.filter((p) => Boolean(p.photo)).length;

  const online = navigator.onLine;
  const syncTimeLabel = lastSyncAt
    ? new Date(lastSyncAt).toLocaleString(isTe ? 'te-IN' : 'en-IN')
    : (isTe ? 'ఇంకా సింక్ కాలేదు' : 'Not synced yet');

  drawerHost.innerHTML = `
    <div class="sync-drawer-backdrop" id="sync-drawer-backdrop" aria-hidden="true"></div>
    <aside id="sync-drawer" class="sync-drawer" role="dialog" aria-modal="true" aria-label="${
      isTe ? 'ఆఫ్‌లైన్ సింక్ డ్రాయర్' : 'Offline Sync Drawer'
    }">
      <div class="sync-drawer-header">
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:18px;">🔄</span>
            <h2 style="margin:0;font-size:16px;">${
              isTe ? 'ఆఫ్‌లైన్ సింక్ & నిల్వ' : 'Offline Sync & Local Cache'
            }</h2>
          </div>
          <small style="color:var(--muted);font-size:11px;display:block;margin-top:3px;">
            ${esc(meta.label)} ·
            <span style="color:${online ? '#059669' : '#d97706'};font-weight:700;">
              ● ${online ? (isTe ? 'ఆన్‌లైన్' : 'Online') : (isTe ? 'ఆఫ్‌లైన్ · IndexedDB' : 'Offline · IndexedDB Active')}
            </span>
          </small>
          <small style="color:var(--muted);font-size:10px;display:block;margin-top:2px;">
            ${isTe ? 'చివరి సింక్:' : 'Last sync:'} ${esc(syncTimeLabel)}
            ${conflictCount > 0 ? ` · <span style="color:#c0392b;font-weight:600;">⚠ ${conflictCount} ${isTe ? 'వైరుధ్యాలు' : 'conflicts'}</span>` : ''}
          </small>
        </div>
        <button class="icon-btn" id="sync-drawer-close" aria-label="${
          isTe ? 'మూసివేయి' : 'Close drawer'
        }">✕</button>
      </div>

      <div class="sync-drawer-telemetry">
        <div class="sync-tel-cell">
          <span>${isTe ? 'క్యాష్ రోగులు' : 'Cached Patients'}</span>
          <strong>${patients.length}</strong>
        </div>
        <div class="sync-tel-cell ${totalQueued > 0 ? 'has-pending' : ''}">
          <span>${isTe ? 'సింక్ క్యూ' : 'Queued Syncs'}</span>
          <strong>${totalQueued}</strong>
        </div>
        <div class="sync-tel-cell">
          <span>${esc(meta.thirdLabel)}</span>
          <strong>${thirdMetric}</strong>
        </div>
      </div>

      <div class="sync-drawer-toolbar" style="display:flex;gap:8px;flex-direction:column;">
        <button class="btn primary" id="sync-drawer-sync-all" style="width:100%;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>↻</span> ${
            online
              ? (isTe ? 'అన్ని రికార్డులు సింక్ & రిఫ్రెష్ చేయి' : 'Sync All Pending & Refresh Cache')
              : (isTe ? 'ఆఫ్‌లైన్: ఇంటర్నెట్ వచ్చినప్పుడు సింక్ అవుతుంది' : 'Offline Mode: Queued Safely on Device')
          }
        </button>
        ${role !== 'patient' ? `
          <button class="btn" id="sync-drawer-open-settings" type="button" style="width:100%;font-size:11px;padding:7px 10px;">
            ⚙ ${isTe ? 'పూర్తి సింక్, బ్యాకప్ & n8n నిర్వహణ' : 'Sync Settings, Backup & n8n Queue'}
          </button>` : ''}
      </div>

      <div class="sync-drawer-body">
        ${
          totalQueued > 0
            ? `
          <div class="sync-section-heading">${isTe ? 'అప్‌లోడ్ కోసం వేచి ఉన్న మార్పులు' : 'Pending Offline Outbox'} (${totalQueued})</div>
          ${queuedPatients.map((p) => {
            const isConflict = p._sync === 'conflict';
            const isError = Boolean(p._syncError) && !isConflict;
            const label = p.version ? (isTe ? 'క్లినికల్ సమీక్ష డ్రాఫ్ట్' : 'Offline Clinical Review') : (isTe ? 'కొత్త స్క్రీనింగ్' : 'New Patient Screening');
            return `
            <div class="sync-item-card ${isConflict ? 'has-conflict' : isError ? 'has-error' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <strong style="font-size:13px;display:block;">${esc(p.name)}</strong>
                  <small style="color:var(--muted);font-size:10px;">${esc(label)} · ${esc(p.id)} · ${esc(p.village || '')}</small>
                </div>
                ${
                  isConflict
                    ? `<span class="pill red" style="font-size:9px;">⚠ ${isTe ? 'వైరుధ్యం' : 'Conflict'}</span>`
                    : isError
                    ? `<span class="pill red" style="font-size:9px;">✕ ${isTe ? 'విఫలమైంది' : 'Failed'}</span>`
                    : `<span class="pill amber" style="font-size:9px;">⏳ ${isTe ? 'పెండింగ్' : 'Pending'}</span>`
                }
              </div>
              ${p._syncError ? `<div class="sync-error-snippet">${esc(p._syncError)}</div>` : ''}
              <div class="sync-item-actions">
                ${
                  isConflict
                    ? `<button class="btn primary" style="font-size:11px;padding:6px 10px;" data-drawer-conflict="${esc(p.id)}">
                        ⚠ ${isTe ? 'వైరుధ్య పరిష్కారం' : 'Resolve Conflict'}
                       </button>`
                    : `<button class="btn" style="font-size:11px;padding:6px 10px;" data-drawer-retry="${esc(p.id)}">
                        ↻ ${isTe ? 'మళ్లీ సింక్ చేయి' : 'Sync'}
                       </button>`
                }
                <button class="btn ghost" style="font-size:11px;padding:6px 10px;" data-drawer-open="${esc(p.id)}">
                  ↗ ${isTe ? 'చూడండి' : 'Open'}
                </button>
              </div>
            </div>`;
          }).join('')}
          ${extraOutbox.map((item) => {
            const isConflict = item.status === 'conflict';
            const isError = item.status === 'failed' || Boolean(item.error);
            return `
            <div class="sync-item-card ${isConflict ? 'has-conflict' : isError ? 'has-error' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <strong style="font-size:12.5px;display:block;">${esc(item.label)}</strong>
                  <small style="color:var(--muted);font-size:10px;">${esc(item.patientName || item.patientId || '')} · ${esc(new Date(item.createdAt).toLocaleTimeString(isTe ? 'te-IN' : 'en-IN'))}</small>
                </div>
                <span class="pill ${isConflict || isError ? 'red' : 'amber'}" style="font-size:9px;">
                  ${isConflict ? '⚠ Conflict' : isError ? '✕ Failed' : '⏳ Queued'}
                </span>
              </div>
              ${item.error ? `<div class="sync-error-snippet">${esc(item.error)}</div>` : ''}
              <div class="sync-item-actions">
                <button class="btn" style="font-size:11px;padding:6px 10px;" data-outbox-retry="${esc(item.id)}">↻ ${isTe ? 'సింక్' : 'Sync'}</button>
                <button class="btn ghost" style="font-size:11px;padding:6px 10px;" data-outbox-discard="${esc(item.id)}">✕ ${isTe ? 'తొలగించు' : 'Discard'}</button>
                ${item.patientId ? `<button class="btn ghost" style="font-size:11px;padding:6px 10px;" data-drawer-open="${esc(item.patientId)}">↗</button>` : ''}
              </div>
            </div>`;
          }).join('')}
        `
            : `
          <div class="sync-status-ok-banner">
            <span class="sync-check-badge">✓</span>
            <div>
              <strong>${isTe ? 'అన్ని రికార్డులు సర్వర్‌తో సింక్ అయ్యాయి' : 'All device changes synchronized'}</strong>
              <small>${isTe ? 'ఈ పోర్టల్ కోసం తాజా IndexedDB క్యాష్ సిద్ధంగా ఉంది.' : 'Offline IndexedDB vault is up to date for this portal.'}</small>
            </div>
          </div>`
        }

        <div class="sync-section-heading" style="margin-top:8px;">
          ${isTe ? 'పరికరంలో క్యాష్ చేయబడిన పోర్టల్ డేటా' : 'Offline-Ready Portal Vault'}
        </div>
        ${renderRoleCachedVault({
          role,
          isTe,
          patients,
          referralsList,
          investigationsList,
          navigationList,
          consultationsList,
          aiAnalysesList,
          automation,
          hasScreeningDraft
        })}
      </div>

      <div class="sync-drawer-footer">
        <p class="mini" style="margin:0;font-size:10px;color:var(--muted);">
          ${esc(user?.email || 'Session')} · IndexedDB v2 · ${
            navigator.serviceWorker?.controller
              ? (isTe ? 'PWA ఆఫ్‌లైన్ క్యాష్ యాక్టివ్' : 'PWA Offline Cache Active')
              : (isTe ? 'స్థానిక నిల్వ సురక్షితం' : 'Durable Local Vault Ready')
          }
        </p>
      </div>
    </aside>
  `;

  // Bind drawer events
  document.getElementById('sync-drawer-close')?.addEventListener('click', closeSyncDrawer);
  document.getElementById('sync-drawer-backdrop')?.addEventListener('click', closeSyncDrawer);

  document.getElementById('sync-drawer-open-settings')?.addEventListener('click', () => {
    closeSyncDrawer();
    if (currentCallbacks.onOpenView) currentCallbacks.onOpenView('settings');
  });

  document.getElementById('sync-drawer-sync-all')?.addEventListener('click', async () => {
    if (currentCallbacks.onSyncAll) {
      const btn = document.getElementById('sync-drawer-sync-all');
      if (btn) btn.disabled = true;
      try {
        await currentCallbacks.onSyncAll();
      } finally {
        if (btn) btn.disabled = false;
      }
    }
  });

  document.querySelectorAll('[data-drawer-retry]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const pId = btn.dataset.drawerRetry;
      btn.disabled = true;
      btn.textContent = isTe ? 'సింక్ అవుతోంది…' : 'Syncing…';
      try {
        if (currentCallbacks.onSyncSingle) await currentCallbacks.onSyncSingle(pId);
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-outbox-retry]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const obId = btn.dataset.outboxRetry;
      btn.disabled = true;
      btn.textContent = isTe ? 'సింక్…' : 'Syncing…';
      try {
        if (currentCallbacks.onSyncOutboxItem) await currentCallbacks.onSyncOutboxItem(obId);
      } finally {
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-outbox-discard]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const obId = btn.dataset.outboxDiscard;
      if (currentCallbacks.onDiscardOutboxItem) await currentCallbacks.onDiscardOutboxItem(obId);
    });
  });

  document.querySelectorAll('[data-drawer-conflict]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.drawerConflict;
      const patient = patients.find((p) => p.id === pId);
      if (patient && currentCallbacks.onResolveConflict) {
        currentCallbacks.onResolveConflict(patient);
      }
    });
  });

  document.querySelectorAll('[data-drawer-open]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const pId = btn.dataset.drawerOpen;
      closeSyncDrawer();
      if (currentCallbacks.onOpenRecord) currentCallbacks.onOpenRecord(pId);
    });
  });

  document.querySelectorAll('[data-drawer-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.drawerView;
      closeSyncDrawer();
      if (currentCallbacks.onOpenView) currentCallbacks.onOpenView(targetView);
    });
  });
}

export function openSyncDrawer() {
  const drawer = document.getElementById('sync-drawer');
  const backdrop = document.getElementById('sync-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.add('is-open');
    backdrop.classList.add('is-open');
    drawer.focus?.();
  }
}

export function closeSyncDrawer() {
  const drawer = document.getElementById('sync-drawer');
  const backdrop = document.getElementById('sync-drawer-backdrop');
  if (drawer && backdrop) {
    drawer.classList.remove('is-open');
    backdrop.classList.remove('is-open');
  }
}

/**
 * Side-by-Side Conflict Resolution Modal
 */
export function openConflictModal({
  localPatient,
  serverPatient = {},
  lang = 'en',
  onKeepServer,
  onKeepLocal,
  onClose
}) {
  const isTe = lang === 'te';

  if (!modalHost) {
    modalHost = document.createElement('div');
    modalHost.id = 'conflict-modal-container';
    document.body.appendChild(modalHost);
  }

  const s = serverPatient || localPatient._serverConflict || {};

  modalHost.innerHTML = `
    <div id="conflict-modal" class="conflict-modal is-open" role="alertdialog" aria-modal="true" aria-labelledby="conflict-title">
      <div class="conflict-dialog">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div>
            <h2 id="conflict-title" style="margin:0 0 6px;color:#c0392b;font-size:18px;">
              ⚠ ${isTe ? 'డేటా వైరుధ్యం గుర్తించబడింది' : 'Sync Conflict Detected'}
            </h2>
            <p class="sub" style="margin:0;font-size:12px;">
              ${
                isTe
                  ? 'ఈ రోగి రికార్డు కేంద్ర సర్వర్‌లో వేరొక వినియోగదారు ద్వారా లేదా నెట్‌వర్క్ విభజనలో మార్చబడింది. సరైన సంస్కరణను ఎంచుకోండి:'
                  : 'This record was modified on the server while offline. Compare differences and choose which version to preserve.'
              }
            </p>
          </div>
          <button class="icon-btn" id="conflict-close-btn" aria-label="${isTe ? 'మూసివేయి' : 'Close'}">✕</button>
        </div>

        <div class="conflict-grid">
          <!-- Local Device Version -->
          <div class="conflict-col local">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <strong style="color:var(--gold);font-size:13px;">
                📱 ${isTe ? 'స్థానిక పరికర రికార్డు' : 'Local Device Version'}
              </strong>
              <span class="pill amber" style="font-size:9px;">Draft</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'పేరు' : 'Name'}:</label>
              <strong>${esc(localPatient.name)}</strong>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'గ్రామం' : 'Village'}:</label>
              <span>${esc(localPatient.village)}</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'దశ' : 'Stage'}:</label>
              <span>${esc(localPatient.stage || 'screened')}</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'గమనికలు' : 'Clinical Notes'}:</label>
              <p style="margin:4px 0;font-size:11px;">${esc(localPatient.notes || '—')}</p>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'చివరి మార్పు' : 'Last Modified'}:</label>
              <small>${esc(localPatient.createdAt?.slice(0, 16) || '—')}</small>
            </div>
          </div>

          <!-- Server Shared Version -->
          <div class="conflict-col server">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
              <strong style="color:var(--teal);font-size:13px;">
                ☁ ${isTe ? 'కేంద్ర సర్వర్ రికార్డు' : 'Clinic Server Version'}
              </strong>
              <span class="pill" style="font-size:9px;">Version ${s.version || '1'}</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'పేరు' : 'Name'}:</label>
              <strong>${esc(s.name || localPatient.name)}</strong>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'గ్రామం' : 'Village'}:</label>
              <span>${esc(s.village || localPatient.village)}</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'దశ' : 'Stage'}:</label>
              <span>${esc(s.stage || 'screened')}</span>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'గమనికలు' : 'Clinical Notes'}:</label>
              <p style="margin:4px 0;font-size:11px;">${esc(s.notes || '—')}</p>
            </div>
            <div class="conflict-field">
              <label>${isTe ? 'చివరి మార్పు' : 'Last Modified'}:</label>
              <small>${esc(s.updatedAt?.slice(0, 16) || s.createdAt?.slice(0, 16) || '—')}</small>
            </div>
          </div>
        </div>

        <div class="conflict-actions" style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px;">
          <button class="btn" id="conflict-keep-server" style="font-size:12px;">
            🛡 ${isTe ? 'సర్వర్ రికార్డు ఉంచండి (సిఫార్సు)' : 'Keep Server Record (Discard local edit)'}
          </button>
          <button class="btn primary" id="conflict-keep-local" style="font-size:12px;">
            ✏ ${isTe ? 'పరికర రికార్డుతో భర్తీ చేయండి' : 'Overwrite with Device Edit'}
          </button>
          <button class="btn ghost" id="conflict-cancel-btn" style="font-size:12px;">
            ${isTe ? 'రద్దు' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('conflict-close-btn')?.addEventListener('click', () => {
    closeConflictModal();
    if (onClose) onClose();
  });

  document.getElementById('conflict-cancel-btn')?.addEventListener('click', () => {
    closeConflictModal();
    if (onClose) onClose();
  });

  document.getElementById('conflict-keep-server')?.addEventListener('click', async () => {
    closeConflictModal();
    if (onKeepServer) await onKeepServer(localPatient.id);
  });

  document.getElementById('conflict-keep-local')?.addEventListener('click', async () => {
    closeConflictModal();
    if (onKeepLocal) await onKeepLocal(localPatient.id);
  });
}

export function closeConflictModal() {
  const modal = document.getElementById('conflict-modal');
  if (modal) {
    modal.classList.remove('is-open');
    setTimeout(() => {
      if (modalHost) modalHost.innerHTML = '';
    }, 250);
  }
}
