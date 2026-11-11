import { icon } from './icons.js';
import { isAndroid } from './platform.js';

export function loginMarkup(lang = 'en') {
  const te = lang === 'te';
  const defaultPass = 'Drishti@2026';

  return `
  <div class="institutional-gateway-page">
    <!-- 1. Topmost Official Header -->
    <header class="gateway-header">
      <div class="gateway-header-container">
        <!-- Brand -->
        <div class="gateway-brand">
          <span class="gateway-shield-icon">🛡️</span>
          <div>
            <div class="gateway-brand-title">
              <strong>Aarogya Drishti</strong>
              <span class="sep">|</span>
              <span class="te-brand">ఆరోగ్య దృష్టి</span>
            </div>
            <small class="gateway-brand-sub">ITDA Paderu • Alluri Sitharama Raju District • Govt of Andhra Pradesh</small>
          </div>
        </div>

        <!-- Middle Navigation Items -->
        <nav class="gateway-nav-links">
          <button type="button" class="nav-tag-badge active" data-role-select="doctor">
            🩺 Medical Officer Login
          </button>
          <button type="button" class="nav-tag-btn" data-role-select="asha">
            ASHA / ANM Gateway
          </button>
          <button type="button" class="nav-tag-btn" id="btn-abha-verify">
            ABHA / ABDM Verify
          </button>
          <button type="button" class="nav-tag-btn" id="btn-triage-sop">
            Compliance &amp; Triage SOP
          </button>
        </nav>

        <!-- Right Controls -->
        <div class="gateway-header-right">
          <div class="gateway-phone-badge">
            <span>📞</span>
            <div>
              <strong>104 /</strong>
              <small>1800-425-0000</small>
            </div>
          </div>

          <span class="compliance-badge-top">
            HIPAA • ABDM • AES-256
          </span>

          <div class="lang-switch-pills">
            <button id="login-lang-en" class="lang-pill-btn ${lang === 'en' ? 'active' : ''}" type="button">EN</button>
            <button id="login-lang-te" class="lang-pill-btn ${lang === 'te' ? 'active' : ''}" type="button">తెలుగు</button>
          </div>

          <button id="back-to-public-btn" class="btn ghost-exit" type="button" title="Back to Public Portal">
            ← ${te ? 'ప్రజా వెబ్‌సైట్' : 'Public Portal'}
          </button>
        </div>
      </div>
    </header>

    <!-- 2. Sub-Bar Division Header -->
    <div class="gateway-sub-bar">
      <div class="gateway-sub-container">
        <div class="gateway-sub-left">
          <span class="sub-check-icon">🛡️</span>
          <div>
            <strong>Integrated Tribal Oral Onco-Surveillance Gateway</strong>
            <small>Alluri Sitharama Raju District • ITDA Paderu Division</small>
          </div>
        </div>

        <div class="gateway-sub-right">
          <span class="sandboxed-tag">
            <span class="dot-live">●</span> NDHM / ABDM Sandboxed
          </span>

          <div class="quick-demo-dropdown-wrapper">
            <button class="btn quick-demo-btn" id="btn-quick-demo-menu" type="button">
              ⚡ Quick Demo Roles ▾
            </button>
            <div class="quick-demo-menu" id="quick-demo-menu" style="display:none;">
              <button type="button" class="quick-menu-item" data-fill-acc="asha@drishti.demo" data-fill-role="asha">
                👩‍⚕️ <strong>ASHA Worker</strong> (K. Somalamma)
              </button>
              <button type="button" class="quick-menu-item" data-fill-acc="doctor@drishti.demo" data-fill-role="doctor">
                🩺 <strong>Medical Officer</strong> (Dr. V. Rajeshwari)
              </button>
              <button type="button" class="quick-menu-item" data-fill-acc="specialist@drishti.demo" data-fill-role="specialist">
                🔬 <strong>Lab Pathologist</strong> (P. Balaraju)
              </button>
              <button type="button" class="quick-menu-item" data-fill-acc="hospital@drishti.demo" data-fill-role="hospital">
                🏥 <strong>Hospital Coord.</strong> (Paderu Desk)
              </button>
              <button type="button" class="quick-menu-item" data-fill-acc="admin@drishti.demo" data-fill-role="admin">
                🏛️ <strong>Project Officer</strong> (S. Muralidhar, IAS)
              </button>
              <button type="button" class="quick-menu-item" data-fill-acc="patient@drishti.demo" data-fill-role="patient">
                👤 <strong>Patient Portal</strong> (Demo Citizen)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <main class="gateway-main-body">
      <!-- 3. Pre-Configured Evaluator & Field Staff Test Accounts Box -->
      <section class="test-accounts-banner-card">
        <div class="test-accounts-header">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="checkbox-icon-blue">☑</span>
            <strong>Pre-Configured Evaluator &amp; Field Staff Test Accounts</strong>
          </div>
          <small class="click-profile-hint">Click any profile to auto-fill authentication fields</small>
        </div>

        <div class="test-accounts-four-grid">
          <!-- Card 1: ASHA / ANM -->
          <div class="staff-profile-card active-card" data-fill-id="AP-ASR-ASHA-9902" data-fill-email="asha@drishti.demo" data-fill-role="asha">
            <div class="staff-card-top">
              <span class="staff-role-label">ASHA / ANM</span>
              <span class="staff-key-icon">🗝️</span>
            </div>
            <strong class="staff-name">K. Somalamma</strong>
            <span class="staff-dept">G. Madugula Sub-Center PHC</span>
            <div class="staff-id-pill">+91 94901 88412 • OTP Auto</div>
          </div>

          <!-- Card 2: MO / Dentist -->
          <div class="staff-profile-card" data-fill-id="32-8812-9901" data-fill-email="doctor@drishti.demo" data-fill-role="doctor">
            <div class="staff-card-top">
              <span class="staff-role-label">MO / Dentist</span>
              <span class="staff-key-icon">🗝️</span>
            </div>
            <strong class="staff-name">Dr. V. Rajeshwari, MDS</strong>
            <span class="staff-dept">Area Hospital, Paderu</span>
            <div class="staff-id-pill">HPR: 32-8812-9901</div>
          </div>

          <!-- Card 3: Lab Pathologist -->
          <div class="staff-profile-card" data-fill-id="LAB-ASR-8409" data-fill-email="specialist@drishti.demo" data-fill-role="specialist">
            <div class="staff-card-top">
              <span class="staff-role-label">Lab Pathologist</span>
              <span class="staff-key-icon">🗝️</span>
            </div>
            <strong class="staff-name">P. Balaraju, M.Sc</strong>
            <span class="staff-dept">District Pathology Unit</span>
            <div class="staff-id-pill">LAB-ASR-8409</div>
          </div>

          <!-- Card 4: Project Officer -->
          <div class="staff-profile-card" data-fill-id="GOV-AP-ITDA-01" data-fill-email="admin@drishti.demo" data-fill-role="admin">
            <div class="staff-card-top">
              <span class="staff-role-label">Project Officer</span>
              <span class="staff-key-icon">🗝️</span>
            </div>
            <strong class="staff-name">S. Muralidhar, IAS</strong>
            <span class="staff-dept">ITDA Nodal Authority</span>
            <div class="staff-id-pill">GOV-AP-ITDA-01</div>
          </div>
        </div>
      </section>

      <!-- 4. Main Two-Column Gateway Layout -->
      <div class="gateway-columns-grid">
        <!-- Left Column: Dark Forest Green Card -->
        <div class="gateway-left-card">
          <div class="gateway-left-badge">
            <span>🛡️</span> DISHA • ABDM Milestone-3 Compliant
          </div>

          <h2>Institutional Gateway</h2>
          <span class="te-gateway-sub">సంస్థాగత సిబ్బంది లాగిన్ పోర్టల్</span>

          <p class="gateway-left-desc">
            Direct real-time link between community screening workers across 11 Agency Mandals and the District Onco-Pathology Triage Desk at Area Hospital Paderu.
          </p>

          <!-- Metrics Triage Progress -->
          <div class="triage-rate-box">
            <div class="triage-rate-header">
              <span>Agency Screenings Triage Rate</span>
              <strong>94.8%</strong>
            </div>
            <div class="triage-progress-bar">
              <div class="triage-progress-fill" style="width: 94.8%;"></div>
            </div>
            <div class="triage-rate-footer">
              <span>3,842 Active Cohorts</span>
              <span>18 Mandals Synced</span>
            </div>
          </div>

          <!-- Image Preview Card with Badge -->
          <div class="gateway-image-preview">
            <img src="/sidebar-village.jpg" alt="Clinical AI Review on Tablet">
            <div class="image-ai-tag">
              <span>💻 Oral Lesion AI Classifier v2.4</span>
              <span class="tag-live-dot">● Live</span>
            </div>
          </div>

          <!-- Left Card Footer Badges -->
          <div class="gateway-left-footer">
            <div class="footer-badge-row">
              <span>✓</span>
              <span>Biometric Data encrypted via Startek FM220U • UIDAI Compliant</span>
            </div>
            <div class="footer-badge-row">
              <span>📞</span>
              <span>Toll-Free Emergency Medical Escalation: <strong>104 / 1800-425-0000</strong></span>
            </div>
          </div>
        </div>

        <!-- Right Column: White Card (Access Tier Dispatch) -->
        <div class="gateway-right-card">
          <div class="dispatch-header-row">
            <div>
              <span class="dispatch-sub-tag">ACCESS TIER DISPATCH</span>
              <h3 class="dispatch-title">Select Duty Designation</h3>
            </div>
            <div class="lang-switch-pills small">
              <button class="lang-pill-btn ${lang === 'en' ? 'active' : ''}" id="card-lang-en" type="button">English</button>
              <button class="lang-pill-btn ${lang === 'te' ? 'active' : ''}" id="card-lang-te" type="button">తెలుగు</button>
            </div>
          </div>

          <!-- 4 Duty Designation Selector Buttons -->
          <div class="duty-designation-grid">
            <button type="button" class="designation-btn active" id="btn-desig-asha" data-role="asha" data-default-id="AP-ASR-ASHA-9902" data-hub-text="Authenticate &amp; Open Screening Hub">
              <span class="desig-icon">👩‍⚕️</span>
              <strong>ASHA / ANM</strong>
              <small>ఆశా కార్యకర్త</small>
            </button>

            <button type="button" class="designation-btn" id="btn-desig-doctor" data-role="doctor" data-default-id="32-8812-9901" data-hub-text="Authenticate &amp; Open Clinician Queue">
              <span class="desig-icon">🩺</span>
              <strong>Medical Officer</strong>
              <small>వైద్యాధికారి</small>
            </button>

            <button type="button" class="designation-btn" id="btn-desig-specialist" data-role="specialist" data-default-id="LAB-ASR-8409" data-hub-text="Authenticate &amp; Open Pathology Desk">
              <span class="desig-icon">🔬</span>
              <strong>Lab Pathologist</strong>
              <small>ల్యాబ్ కోఆర్డినేటర్</small>
            </button>

            <button type="button" class="designation-btn" id="btn-desig-admin" data-role="admin" data-default-id="GOV-AP-ITDA-01" data-hub-text="Authenticate &amp; Open District Portal">
              <span class="desig-icon">🏛️</span>
              <strong>ITDA Admin</strong>
              <small>జిల్లా మేజిస్ట్రేట్</small>
            </button>
          </div>

          <!-- Info Callout Banner for selected role -->
          <div class="desig-info-callout" id="desig-info-box">
            <span class="info-circle-blue">ℹ️</span>
            <div>
              <strong id="desig-info-title">Frontline Field Worker Access • Offline Sync Queue</strong>
              <p id="desig-info-desc">Authorized for village oral screening, patient biometric consent, and photo capture in remote habitations.</p>
            </div>
          </div>

          <!-- Login Form -->
          <form id="login-form" class="gateway-login-form">
            <!-- Worker ID / ABHA ID Field -->
            <div class="field-wrapper">
              <div class="field-meta-top">
                <span class="meta-label">ABHA / Employee ID | Instant Mobile OTP</span>
                <span class="meta-startek">🛡️ Startek Certified</span>
              </div>
              <label for="email" class="field-main-label">
                Government Healthcare Worker ID / ABHA HP ID
                <span class="te-label">ఆరోగ్య సేవకుడి ఐడి</span>
              </label>
              <div class="input-with-adornment">
                <span class="input-icon">🪪</span>
                <input id="email" name="email" type="text" autocomplete="username" required value="AP-ASR-ASHA-9902" placeholder="AP-ASR-ASHA-9902">
                <button type="button" class="btn-input-action" title="Listen voice prompt" id="btn-voice-prompt">🔊</button>
              </div>
            </div>

            <!-- PIN or Password Field -->
            <div class="field-wrapper">
              <div class="field-meta-top">
                <label for="password" class="field-main-label" style="margin:0;">
                  Authorized Biometric PIN or Password
                  <span class="te-label">పాస్‌వర్డ్ / పిన్</span>
                </label>
                <a href="#forgot" id="link-forgot-pwd" class="forgot-pwd-link">Forgot password?</a>
              </div>
              <div class="input-with-adornment">
                <span class="input-icon">🔒</span>
                <input id="password" name="password" type="password" autocomplete="current-password" required value="${defaultPass}" placeholder="Enter password">
                <button type="button" class="btn-input-action" id="toggle-pwd" title="Show/Hide Password">👁</button>
              </div>
            </div>

            <!-- 2FA Protocol Toggle Switch -->
            <div class="twofa-switch-row">
              <div class="twofa-text-col">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span class="twofa-lock-icon">🔒</span>
                  <strong>2FA Authenticator Protocol Active</strong>
                </div>
                <small>Account created &amp; verified by ITDA Magistrate Health Unit. Unapproved accounts require admin approval.</small>
              </div>
              <label class="toggle-switch">
                <input type="checkbox" id="toggle-2fa" checked>
                <span class="toggle-slider"></span>
              </label>
            </div>

            <p id="login-error" role="alert" class="gateway-error-text"></p>

            <!-- Submit Button -->
            <button class="btn primary gateway-submit-btn" id="btn-submit-gateway" type="submit">
              ➔ <span id="btn-submit-text">Authenticate &amp; Open Screening Hub</span>
            </button>
          </form>

          <!-- Footer Links Row -->
          <div class="dispatch-links-row">
            <span class="hint-question">❓ Need institutional account?</span>
            <a href="#contact" class="footer-sub-link">Contact ITDA Nodal Officer</a>
            <span class="dot-sep">•</span>
            <a href="#recovery" class="footer-sub-link">Recovery Email Setup</a>
            <span class="dot-sep">•</span>
            <a href="#admin-desk" class="footer-sub-link">System Admin Desk</a>
          </div>
        </div>
      </div>

      <!-- 5. Bottom Compliance Cards (3 Blocks) -->
      <section class="compliance-three-grid">
        <!-- Block 1 -->
        <div class="compliance-block-card">
          <span class="comp-icon">🔒</span>
          <div>
            <strong>Session Timeout SOP</strong>
            <p>Automatic lock after 15m idle in compliance with DISHA Act 2024.</p>
          </div>
        </div>

        <!-- Block 2 -->
        <div class="compliance-block-card">
          <span class="comp-icon">☑</span>
          <div>
            <strong>Offline PWA Storage</strong>
            <p>Encrypted IndexedDB stores up to 250 oral scans pending connectivity.</p>
          </div>
        </div>

        <!-- Block 3 -->
        <div class="compliance-block-card">
          <span class="comp-icon">🌐</span>
          <div>
            <strong>ABDM M3 Triage Registry</strong>
            <p>Real-time teleconsult dispatch to King George Hospital (KGH) Vizag.</p>
          </div>
        </div>
      </section>
    </main>

    <!-- 6. Official Institutional Footer -->
    <footer class="gateway-official-footer">
      <div class="gateway-footer-container">
        <div class="footer-left">
          <strong>© 2024-2026 Integrated Tribal Development Agency (ITDA), Paderu.</strong>
          <span class="dept-text">Department of Health, Medical &amp; Family Welfare, Government of Andhra Pradesh</span>
        </div>
        <div class="footer-right">
          <span>🔒 DISHA Safe</span>
          <span class="sep">•</span>
          <span>☁️ NIC Cloud Stored</span>
          <span class="sep">•</span>
          <span>Emergency IT Helpdesk: <strong>+91 8935 250001</strong></span>
          <span class="sep">•</span>
          <span>ASR District Health Cell</span>
        </div>
      </div>
    </footer>
  </div>`;
}
