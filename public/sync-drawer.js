/**
 * Aarogya Drishti — Offline Sync Drawer & Conflict Resolution Component
 * 
 * Provides field workers in rural ITDA Paderu habitations with:
 * 1. An accessible slide-out drawer displaying individual queued records.
 * 2. Real-time retry triggers per record with status indicators.
 * 3. A side-by-side conflict resolution modal when concurrent edits collide (HTTP 409).
 */

const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

let drawerHost = null;
let modalHost = null;
let currentCallbacks = {};

export function mountSyncDrawer({
  patients = [],
  lang = 'en',
  onSyncAll,
  onSyncSingle,
  onResolveConflict,
  onOpenRecord
}) {
  currentCallbacks = { onSyncAll, onSyncSingle, onResolveConflict, onOpenRecord };
  const isTe = lang === 'te';

  // Ensure drawer host element exists
  if (!drawerHost) {
    drawerHost = document.createElement('div');
    drawerHost.id = 'sync-drawer-container';
    document.body.appendChild(drawerHost);

    // Close on escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeSyncDrawer();
        closeConflictModal();
      }
    });
  }

  const queued = patients.filter(
    (p) => p._sync === 'pending' || p._sync === 'conflict' || Boolean(p._syncError)
  );
  const conflictCount = patients.filter((p) => p._sync === 'conflict').length;
  const pendingCount = patients.filter((p) => p._sync === 'pending').length;

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
              isTe ? 'ఆఫ్‌లైన్ సింక్ డ్రాయర్' : 'Offline Sync Drawer'
            }</h2>
          </div>
          <small style="color:var(--muted);font-size:11px;">
            ${queued.length} ${isTe ? 'పరికర రికార్డులు వేచి ఉన్నాయి' : 'records awaiting sync'}
            ${
              conflictCount > 0
                ? ` · <span style="color:#c0392b;font-weight:600;">⚠ ${conflictCount} ${
                    isTe ? 'వైరుధ్యాలు' : 'conflicts'
                  }</span>`
                : ''
            }
          </small>
        </div>
        <button class="icon-btn" id="sync-drawer-close" aria-label="${
          isTe ? 'మూసివేయి' : 'Close drawer'
        }">✕</button>
      </div>

      <div class="sync-drawer-toolbar">
        <button class="btn primary" id="sync-drawer-sync-all" style="width:100%;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px;">
          <span>↻</span> ${isTe ? 'అన్ని రికార్డులను సమకాలీకరించండి' : 'Sync All Pending Records'}
        </button>
      </div>

      <div class="sync-drawer-body">
        ${
          queued.length === 0
            ? `
          <div class="sync-empty-state">
            <div class="sync-check-icon">✓</div>
            <strong>${isTe ? 'అన్ని రికార్డులు సర్వర్‌తో సింక్ అయ్యాయి' : 'All records synchronized'}</strong>
            <p class="mini" style="margin-top:6px;max-width:260px;">
              ${
                isTe
                  ? 'ఈ పరికరంలోని అన్ని స్క్రీనింగ్‌లు కేంద్ర సర్వర్‌కు సురక్షితంగా చేరాయి.'
                  : 'Every screening recorded on this device is safely synchronized with the clinic server.'
              }
            </p>
          </div>
        `
            : queued
                .map((p) => {
                  const isConflict = p._sync === 'conflict';
                  const isError = Boolean(p._syncError) && !isConflict;
                  return `
            <div class="sync-item-card ${isConflict ? 'has-conflict' : isError ? 'has-error' : ''}">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
                <div>
                  <strong style="font-size:13px;display:block;">${esc(p.name)}</strong>
                  <small style="color:var(--muted);font-size:10px;">${esc(p.id)} · ${esc(p.village || 'Village')}</small>
                </div>
                ${
                  isConflict
                    ? `<span class="pill red" style="font-size:9px;">⚠ ${isTe ? 'వైరుధ్యం' : 'Conflict'}</span>`
                    : isError
                    ? `<span class="pill red" style="font-size:9px;">✕ ${isTe ? 'విఫలమైంది' : 'Failed'}</span>`
                    : `<span class="pill amber" style="font-size:9px;">⏳ ${isTe ? 'పెండింగ్' : 'Pending'}</span>`
                }
              </div>

              ${
                p._syncError
                  ? `<div class="sync-error-snippet">${esc(p._syncError)}</div>`
                  : ''
              }

              <div class="sync-item-actions">
                ${
                  isConflict
                    ? `<button class="btn primary" style="font-size:11px;padding:6px 10px;" data-drawer-conflict="${esc(p.id)}">
                        ⚠ ${isTe ? 'వైరుధ్య పరిష్కారం' : 'Resolve Conflict'}
                       </button>`
                    : `<button class="btn" style="font-size:11px;padding:6px 10px;" data-drawer-retry="${esc(p.id)}">
                        ↻ ${isTe ? 'మళ్లీ సింక్ చేయి' : 'Retry'}
                       </button>`
                }
                <button class="btn ghost" style="font-size:11px;padding:6px 10px;" data-drawer-open="${esc(p.id)}">
                  ↗ ${isTe ? 'చూడండి' : 'Open'}
                </button>
              </div>
            </div>
          `;
                })
                .join('')
        }
      </div>

      <div class="sync-drawer-footer">
        <p class="mini" style="margin:0;font-size:10px;color:var(--muted);">
          ${
            isTe
              ? 'ఆఫ్‌లైన్ రికార్డులు ఈ బ్రౌజర్ IndexedDB లో సురక్షితంగా ఉంటాయి.'
              : 'Records remain durable in offline IndexedDB until safely delivered.'
          }
        </p>
      </div>
    </aside>
  `;

  // Bind drawer events
  document.getElementById('sync-drawer-close')?.addEventListener('click', closeSyncDrawer);
  document.getElementById('sync-drawer-backdrop')?.addEventListener('click', closeSyncDrawer);

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
        if (currentCallbacks.onSyncSingle) {
          await currentCallbacks.onSyncSingle(pId);
        }
      } finally {
        btn.disabled = false;
      }
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
      if (currentCallbacks.onOpenRecord) {
        currentCallbacks.onOpenRecord(pId);
      }
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
