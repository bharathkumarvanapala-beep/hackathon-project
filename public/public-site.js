import { icon } from './icons.js';
import { ITDA_FACILITIES } from './facilities-data.js';

export function publicSiteMarkup(lang = 'en') {
  const te = lang === 'te';

  return `
  <div class="public-site">
    <!-- Top Government Notification Bar -->
    <div class="gov-top-bar">
      <div class="gov-top-container">
        <div class="gov-top-left">
          <span>🏛️ Government of Andhra Pradesh</span>
          <span class="gov-sep">|</span>
          <span>Tribal Welfare / Tribal Health Initiative</span>
          <span class="gov-sep">|</span>
          <span>December 2026 Innovation Flagship Project</span>
        </div>
        <div class="gov-top-right">
          <span>📞 104 Health Advice</span>
          <span class="gov-sep">|</span>
          <span>Toll-Free Oncology Line: <strong>1800-425-4440</strong></span>
        </div>
      </div>
    </div>

    <!-- Main Navigation Bar -->
    <header class="public-nav">
      <div class="public-nav-container">
        <a href="#home" class="public-brand">
          <img src="/brand-logo.svg" alt="Aarogya Drishti" class="nav-logo" onerror="this.src='/icon.svg'">
          <div>
            <strong>ఆరోగ్య దృష్టి · AAROGYA DRISHTI</strong>
            <small>Connected Oral Oncology Care | ITDA Paderu</small>
          </div>
        </a>

        <nav class="public-nav-links">
          <a href="#home" class="nav-link-pill active">
            <span>🏛️</span> ${te ? 'ప్రజా పోర్టల్' : 'Public Portal'}
          </a>
          <button type="button" class="nav-link-btn" data-role-shortcut="asha">
            ${te ? 'ఆశా కార్యకర్త' : 'Community Health Worker'}
          </button>
          <button type="button" class="nav-link-btn" data-role-shortcut="doctor">
            ${te ? 'మెడికల్ ఆఫీసర్' : 'Teleconsultation / MO'}
          </button>
          <button type="button" class="nav-link-btn" data-role-shortcut="specialist">
            ${te ? 'బయాప్సీ / స్పెషలిస్ట్' : 'Biopsy / Path / OS'}
          </button>
          <button type="button" class="nav-link-btn" data-role-shortcut="admin">
            ${te ? 'జిల్లా మానిటరింగ్' : 'District Monitoring'}
          </button>
        </nav>

        <div class="public-nav-actions">
          <div class="lang-switch-pills">
            <button id="public-lang-en" class="lang-pill-btn ${lang === 'en' ? 'active' : ''}" type="button">EN</button>
            <button id="public-lang-te" class="lang-pill-btn ${lang === 'te' ? 'active' : ''}" type="button">TE (తెలుగు)</button>
          </div>
          <button id="nav-login-btn" class="btn primary nav-signin-btn" type="button">
            ${te ? 'హెల్త్ వర్కర్ సైన్ ఇన్' : 'Health Worker Sign In'} →
          </button>
        </div>
      </div>
    </header>

    <!-- 1. Hero Section -->
    <section id="home" class="public-hero-v2">
      <div class="public-container hero-grid-v2">
        <!-- Hero Left Column -->
        <div class="hero-left-v2">
          <div class="hero-agency-badge">
            <span class="pulse-dot"></span>
            <strong>ITDA Paderu Oral Cancer Initiative · ASR District</strong>
          </div>

          <h1>
            Early Detection Saves Lives:<br>
            <span class="accent-highlight">AI-Powered Oral Health Screening</span> for Remote & Tribal Communities
          </h1>

          <p class="hero-te-sub">
            గ్రామీణ ప్రాంతాలలో ముందస్తు నోటి క్యాన్సర్ పరీక్ష మరియు టెలిమెడిసిన్ సేవలు.
          </p>
          <p class="hero-en-sub">
            Bringing tertiary oncology intelligence to frontline ASHA workers across Alluri Sitharama Raju District.
          </p>

          <!-- Statutory Clinical Notice -->
          <div class="clinical-notice-box">
            <div class="notice-icon-circle">ℹ️</div>
            <div class="notice-text">
              <strong>Statutory Clinical Notice:</strong>
              <span>AI marks surrogate candidate findings for reviewing dental specialists only. Non-definitive. Diagnostic decisions and biopsies are authenticated solely by licensed medical officers under established oncology guidelines.</span>
            </div>
          </div>

          <!-- Hero Action Buttons -->
          <div class="hero-action-row">
            <a href="#facilities" class="btn primary hero-action-btn">
              📍 ${te ? 'సమీప ఆశా క్యాంప్ & PHC కనుగొనండి' : 'Find Nearest ASHA Camp & PHC'}
            </a>
            <button id="hero-login-btn" class="btn ghost-hero hero-action-btn" type="button">
              🔐 ${te ? 'క్లినీషియన్ పోర్టల్ లాగిన్' : 'Login to Clinician Portal'}
            </button>
          </div>

          <p class="hero-footnote">
            ✓ Government-supported ITDA Community Initiative &nbsp;|&nbsp; Data Protected under DPDP Act 2023
          </p>
        </div>

        <!-- Hero Right Column (Field Image Card) -->
        <div class="hero-right-v2">
          <div class="hero-image-card">
            <img src="/sidebar-village.jpg" alt="Frontline ASHA Worker Screening in Tribal Hamlet">
            <div class="hero-img-badge">
              <span>●</span> Offline-First Oral Screenings
            </div>
            <div class="hero-img-caption">
              <strong>High-Resolution Oral Mucosal Imaging</strong>
              <p>Automated image quality validation & fast-track queuing to PHC doctors across Eastern Ghats hamlets.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. Metrics Bar (4 Key Stats) -->
    <section class="metrics-bar-section">
      <div class="public-container">
        <div class="metrics-four-grid">
          <div class="metric-block">
            <span class="metric-label">SCREENINGS CONDUCTED</span>
            <strong class="metric-number">42,800+</strong>
            <small class="metric-sub">Across 11 Agency Mandals</small>
          </div>

          <div class="metric-block">
            <span class="metric-label">HAMLETS COVERED</span>
            <strong class="metric-number">18 Mandals</strong>
            <small class="metric-sub">Integrated PHC & CHC network</small>
          </div>

          <div class="metric-block">
            <span class="metric-label">DOCTOR TRIAGE PERIOD</span>
            <strong class="metric-number">&lt; 24 Hours</strong>
            <small class="metric-sub">Specialist review turnaround</small>
          </div>

          <div class="metric-block">
            <span class="metric-label">TREATMENT COST</span>
            <strong class="metric-number free-cost">100% Free</strong>
            <small class="metric-sub">Biopsy & surgical oncology</small>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. Section: A STEP-BY-STEP CLINICAL CARE PATHWAY -->
    <section id="how-it-works" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill-tag">A STEP-BY-STEP CLINICAL CARE PATHWAY</span>
          <h2>How It Works: The Connected Care Pathway</h2>
          <p class="section-sub">
            Organized for low-connectivity tribal hamlets, connecting 100-plus village residents directly with oncology surgeons at Paderu Area Hospital and KGH Visakhapatnam.
          </p>
        </div>

        <!-- 5-Step Connected Care Pathway Cards -->
        <div class="pathway-steps-grid">
          <!-- Step 1 -->
          <div class="pathway-card">
            <div class="pathway-step-num">1</div>
            <span class="pathway-badge-top">Doorstep Encounter</span>
            <h4>FRONTLINE FIELD VISIT</h4>
            <strong class="pathway-title-main">ASHA Village Visit</strong>
            <p>ASHA worker visits the doorstep with intraoral camera/phone. Captures mucosal images with focus guidance and 14-day symptom history.</p>
          </div>

          <!-- Step 2 -->
          <div class="pathway-card">
            <div class="pathway-step-num">2</div>
            <span class="pathway-badge-top">DPDP-2023 Encrypted</span>
            <h4>MULTIMODAL SCREENING</h4>
            <strong class="pathway-title-main">Gemini 1.5 Vision Check</strong>
            <p>Edge/cloud pipeline performs instant image quality triage, flags blurred/dark inputs, detects potential lesion candidates, & logs consent.</p>
          </div>

          <!-- Step 3 -->
          <div class="pathway-card">
            <div class="pathway-step-num">3</div>
            <span class="pathway-badge-top">Electronic Triage</span>
            <h4>TELECONSULT &amp; TRIAGE</h4>
            <strong class="pathway-title-main">24-Hour Doctor Review</strong>
            <p>Local Medical Officer reviews cases in 24 hours. Flags urgent cases for teleconsultation or biopsy referral to Paderu Area Hospital.</p>
          </div>

          <!-- Step 4 -->
          <div class="pathway-card">
            <div class="pathway-step-num">4</div>
            <span class="pathway-badge-top">Fast-Track Triage</span>
            <h4>SECONDARY CARE</h4>
            <strong class="pathway-title-main">Cancer Task Review</strong>
            <p>Oral Maxillofacial / ENT specialist at Area Hospital reviews candidate lesion images and approves digital biopsy voucher with transit assistance.</p>
          </div>

          <!-- Step 5 -->
          <div class="pathway-card">
            <div class="pathway-step-num">5</div>
            <span class="pathway-badge-top">Tertiary Hospital</span>
            <h4>TERTIARY NETWORK</h4>
            <strong class="pathway-title-main">Biopsy &amp; Surgery</strong>
            <p>Patient receives free biopsy examination and definitive care at King George Hospital (KGH) or Area Hospital Paderu with dedicated tribal coordinator.</p>
          </div>
        </div>

        <!-- Offline Sync Banner -->
        <div class="sync-banner-card">
          <div class="sync-banner-left">
            <span class="sync-banner-icon">📡</span>
            <div>
              <strong>ASHA Synchronization Bandwidth-Resilient Sync Architecture</strong>
              <p>Store-and-forward edge cache: records and photos queue locally when traversing mountain passes, instantly dispatching once cellular network is detected.</p>
            </div>
          </div>
          <button class="btn ghost-white" id="btn-explore-arch" type="button">
            Explore Field Deployment Architecture →
          </button>
        </div>
      </div>
    </section>

    <!-- 4. Section: CLINICAL AWARENESS & EARLY WARNING -->
    <section id="oral-awareness" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill-tag">CLINICAL AWARENESS &amp; EARLY WARNING</span>
          <h2>Recognize Early Symptoms: Oral Lesions &amp; Habit Risks</h2>
          <p class="section-sub">
            Early detection during pre-malignant stages (Leukoplakia, OSMF) enables complete remission. Learn what to look for and when to alert your village ASHA worker immediately.
          </p>
        </div>

        <!-- 4 Lesion Cards -->
        <div class="lesion-cards-grid">
          <!-- Card 1: Leukoplakia -->
          <div class="lesion-card">
            <span class="lesion-tag-pill warning">Pre-Cancerous / High Risk</span>
            <div class="lesion-illustration-box">
              <svg viewBox="0 0 100 70" class="lesion-svg" aria-hidden="true">
                <rect width="100" height="70" rx="8" fill="#fef2f2"/>
                <ellipse cx="50" cy="35" rx="36" ry="24" fill="#fca5a5" opacity="0.6"/>
                <path d="M 32 30 Q 50 20 68 30 Q 60 45 40 40 Z" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
                <circle cx="48" cy="32" r="6" fill="#f8fafc"/>
              </svg>
            </div>
            <h4>Leukoplakia</h4>
            <p>Adherent white patch on oral mucosa, cheek, tongue, or gums that cannot be scraped away. Heavy correlation with raw tobacco and bidi use.</p>
            <div class="lesion-risk-badge high">
              <span>●</span> Risk Assessment: High
            </div>
          </div>

          <!-- Card 2: Erythroplakia -->
          <div class="lesion-card">
            <span class="lesion-tag-pill danger">High Risk (90% Malignant)</span>
            <div class="lesion-illustration-box">
              <svg viewBox="0 0 100 70" class="lesion-svg" aria-hidden="true">
                <rect width="100" height="70" rx="8" fill="#fef2f2"/>
                <ellipse cx="50" cy="35" rx="36" ry="24" fill="#f87171" opacity="0.4"/>
                <ellipse cx="50" cy="35" rx="18" ry="12" fill="#dc2626"/>
                <circle cx="52" cy="33" r="8" fill="#b91c1c"/>
              </svg>
            </div>
            <h4>Erythroplakia</h4>
            <p>Velvety, well-demarcated red patch on oral floor. Represents significant malignant transformation risk and requires mandatory biopsy confirmation.</p>
            <div class="lesion-risk-badge urgent">
              <span>⚠️</span> Immediate Biopsy: 90% Malignant Risk
            </div>
          </div>

          <!-- Card 3: Non-Healing Ulcer -->
          <div class="lesion-card">
            <span class="lesion-tag-pill danger">Warning Sign (14+ Days)</span>
            <div class="lesion-illustration-box">
              <svg viewBox="0 0 100 70" class="lesion-svg" aria-hidden="true">
                <rect width="100" height="70" rx="8" fill="#fff7ed"/>
                <ellipse cx="50" cy="35" rx="34" ry="22" fill="#fed7aa"/>
                <ellipse cx="50" cy="35" rx="20" ry="14" fill="#ea580c" opacity="0.8"/>
                <ellipse cx="50" cy="35" rx="12" ry="7" fill="#7c2d12"/>
              </svg>
            </div>
            <h4>Non-Healing Ulcers</h4>
            <p>Any mouth ulcer or lesion whose pain persists for more than 14 days without trauma or improvement. Key alarm signal for squamous cell carcinoma.</p>
            <div class="lesion-risk-badge ulcer">
              <span>⏱️</span> 14+ Days = Biopsy
            </div>
          </div>

          <!-- Card 4: OSMF -->
          <div class="lesion-card">
            <span class="lesion-tag-pill alert">Restricted Jaw Opening</span>
            <div class="lesion-illustration-box">
              <svg viewBox="0 0 100 70" class="lesion-svg" aria-hidden="true">
                <rect width="100" height="70" rx="8" fill="#f0fdf4"/>
                <path d="M 25 20 Q 50 10 75 20 Q 80 50 50 55 Q 20 50 25 20 Z" fill="#d1fae5"/>
                <line x1="38" y1="26" x2="38" y2="46" stroke="#059669" stroke-width="2.5" stroke-dasharray="2,2"/>
                <line x1="50" y1="24" x2="50" y2="48" stroke="#059669" stroke-width="2.5" stroke-dasharray="2,2"/>
                <line x1="62" y1="26" x2="62" y2="46" stroke="#059669" stroke-width="2.5" stroke-dasharray="2,2"/>
              </svg>
            </div>
            <h4>Submucous Fibrosis (OSMF)</h4>
            <p>Progressive stiffening of cheek tissues causing restricted mouth opening (less than 3 fingers). Associated with areca nut and gutka addiction.</p>
            <div class="lesion-risk-badge jaw">
              <span>📏</span> Check Jaw Distance
            </div>
          </div>
        </div>

        <!-- Bottom Grid: Tribal Risk Factors & 3-Finger Test -->
        <div class="habits-test-split-grid" style="margin-top:30px;">
          <!-- Left: Tribal Risk Factors -->
          <div class="tribal-habits-card">
            <span class="pill-tag small">AGENCY BELT PRACTICE FOCUS</span>
            <h3>Tribal Risk Factors &amp; Habit Intervention</h3>
            <p class="card-intro-p">
              In ASR District tribal communities, traditional habits create severe vulnerability to aggressive OSCC. The Aarogya Drishti network provides counseling, cessation and biopsy.
            </p>

            <div class="habits-pill-list">
              <div class="habit-item-row">
                <span class="habit-bullet">1</span>
                <div>
                  <strong>Reverse Tobacco Smoking (Chutta)</strong>
                  <span>High palatal thermal injury and direct carcinogen exposure.</span>
                </div>
              </div>

              <div class="habit-item-row">
                <span class="habit-bullet">2</span>
                <div>
                  <strong>Areca &amp; Tobacco Quid (Khaini, Gutka, Paan)</strong>
                  <span>Prolonged contact on lower gingivobuccal sulcus.</span>
                </div>
              </div>

              <div class="habit-item-row">
                <span class="habit-bullet">3</span>
                <div>
                  <strong>Indigenous Alcohol (Jeelugu, Sarai)</strong>
                  <span>Synergistic mucosal permeability and tissue dehydration.</span>
                </div>
              </div>

              <div class="habit-item-row">
                <span class="habit-bullet">4</span>
                <div>
                  <strong>Nutritional Deficiencies (Iron, Micronutrients)</strong>
                  <span>Promotes mucosal atrophy and heightened susceptibility to malignant transformation.</span>
                </div>
              </div>
            </div>

            <p class="habit-footer-note">
              ✓ Free Habit-Cessation Therapy &amp; NRT available at all PHCs in ITDA Paderu
            </p>
          </div>

          <!-- Right: 3-Finger Mouth Test (Green Card) -->
          <div class="three-finger-card">
            <span class="pill-tag white-pill">3-FINGER SELF SCREENING</span>
            <h3>Perform the 3-Finger Mouth Test (3-వేళ్ల పరీక్ష)</h3>
            <p class="card-intro-p white-txt">
              Check yourself in three quick steps before contacting your village health worker:
            </p>

            <div class="steps-checklist-green">
              <div class="check-step-item">
                <span class="step-badge-green">1</span>
                <p>Can you insert <strong>3 vertically stacked fingers</strong> between your upper and lower front teeth? If no, suspect OSMF.</p>
              </div>

              <div class="check-step-item">
                <span class="step-badge-green">2</span>
                <p>Do you feel persistent <strong>burning or stinging</strong> when eating mildly spiced tribal forest cuisine?</p>
              </div>

              <div class="check-step-item">
                <span class="step-badge-green">3</span>
                <p>Is there any persistent <strong>lump, rough white/red patch, or ulcer</strong> for longer than two weeks?</p>
              </div>
            </div>

            <button class="btn white-btn-check" id="btn-verify-checkup" type="button">
              🔍 Verify Your Quick Checkup Now
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Section: AGENCY HEALTH INFRASTRUCTURE -->
    <section id="facilities" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill-tag">AGENCY HEALTH INFRASTRUCTURE</span>
          <h2>ITDA Paderu Healthcare Network &amp; Facility Locator</h2>
          <p class="section-sub">
            Connect to Primary Health Centres, Mobile Tele-Screening Vans, and District Area Hospital Triage...
          </p>
        </div>

        <div class="facilities-locator-split">
          <!-- Left: Central Map Box -->
          <div class="locator-map-card">
            <div class="map-illustration-box">
              <div class="map-pin-pulse">📍</div>
              <strong>ITDA Paderu Central Network Map</strong>
              <small>GPS &amp; Mobile Van Live Route Coverage</small>
            </div>
            <button class="btn primary-dark map-btn" id="btn-van-schedule" type="button">
              🚐 View Village Van Schedule
            </button>
          </div>

          <!-- Right: Facility Cards List -->
          <div class="locator-facilities-list">
            <!-- Facility 1 -->
            <div class="facility-item-box">
              <div class="fac-left">
                <span class="fac-cat-tag">DISTRICT REFERRAL CENTER</span>
                <h4>District Area Hospital Paderu</h4>
                <p>Main referral hospital for biopsy and surgery</p>
              </div>
              <div class="fac-right">
                <span class="fac-status-tag green">Daily OPD (8:00 AM - 4:00 PM)</span>
              </div>
            </div>

            <!-- Facility 2 -->
            <div class="facility-item-box">
              <div class="fac-left">
                <span class="fac-cat-tag">SUB-DIVISIONAL CENTER</span>
                <h4>Araku Valley Community Health Unit</h4>
                <p>Secondary triage &amp; teleconsultation</p>
              </div>
              <div class="fac-right">
                <span class="fac-status-tag blue">Tele-Doctor Connected</span>
              </div>
            </div>

            <!-- Facility 3 -->
            <div class="facility-item-box">
              <div class="fac-left">
                <span class="fac-cat-tag">PRIMARY HEALTH CENTER</span>
                <h4>Chintapalli Upgraded CHC</h4>
                <p>Screening clinic &amp; sample transport</p>
              </div>
              <div class="fac-right">
                <span class="fac-status-tag gray">Mon-Sat (9:00 AM - 1:00 PM)</span>
              </div>
            </div>

            <!-- Facility 4 -->
            <div class="facility-item-box">
              <div class="fac-left">
                <span class="fac-cat-tag">REMOTE PHC CLINIC</span>
                <h4>Gudem Kotha Veedhi (G.K. Veedhi) PHC</h4>
                <p>Mobile van regular stop</p>
              </div>
              <div class="fac-right">
                <span class="fac-status-tag green">24x7 Emergency Care</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Helplines Pill Row -->
        <div class="helplines-pill-row">
          <div class="helpline-pill-card">
            <span class="pill-icon">📞</span>
            <div>
              <strong>104 / 108</strong>
              <small>Toll-Free Government Medical Helpline</small>
            </div>
          </div>

          <div class="helpline-pill-card">
            <span class="pill-icon">🏥</span>
            <div>
              <strong>08935-252233</strong>
              <small>Government Area Hospital Paderu Reception Desk</small>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. Section: PATIENT RIGHTS & POLICY (FAQ) -->
    <section id="faq" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill-tag">PATIENT RIGHTS &amp; POLICY</span>
          <h2>Frequently Asked Questions (తరచుగా అడిగే ప్రశ్నలు)</h2>
          <p class="section-sub">
            Transparent guidelines on privacy safeguards, tribal community informed consent, and government financial coverage.
          </p>
        </div>

        <div class="faq-accordion-container">
          <details class="faq-acc-item" open>
            <summary class="faq-summary">
              <strong>Is oral screening and treatment covered under Dr. YSR Aarogyasri Scheme?</strong>
              <span class="faq-toggle-icon">▾</span>
            </summary>
            <div class="faq-body">
              <p>Yes. All diagnostic biopsies, histopathological examinations, surgeries, and oncology admissions are 100% cashless and covered under the Dr. YSR Aarogyasri / Ayushman Bharat scheme for all eligible agency families across Andhra Pradesh.</p>
            </div>
          </details>

          <details class="faq-acc-item">
            <summary class="faq-summary">
              <strong>How is my oral photograph and health data protected?</strong>
              <span class="faq-toggle-icon">▾</span>
            </summary>
            <div class="faq-body">
              <p>All patient records and oral images are encrypted in accordance with the Digital Personal Data Protection (DPDP) Act 2023. Explicit consent is captured by the ASHA worker, and records are shared solely with verified government medical officers for clinical review.</p>
            </div>
          </details>

          <details class="faq-acc-item">
            <summary class="faq-summary">
              <strong>What happens if the AI flags my oral photo as high risk?</strong>
              <span class="faq-toggle-icon">▾</span>
            </summary>
            <div class="faq-body">
              <p>AI observations trigger an urgent priority review in the Medical Officer’s queue. The doctor reviews the high-resolution photo within 24 hours and coordinates a teleconsultation or fast-tracks an Area Hospital biopsy appointment with free transit assistance.</p>
            </div>
          </details>

          <details class="faq-acc-item">
            <summary class="faq-summary">
              <strong>Can ASHA workers screen patients in villages without mobile internet?</strong>
              <span class="faq-toggle-icon">▾</span>
            </summary>
            <div class="faq-body">
              <p>Yes. Aarogya Drishti operates offline-first. Patient demographic records, consent, and mucosal photographs persist securely in local device IndexedDB storage and automatically synchronize once the worker returns to a cellular network zone.</p>
            </div>
          </details>
        </div>
      </div>
    </section>

    <!-- 7. Bottom Call-to-Action Banner -->
    <div class="bottom-green-cta-banner">
      <div class="public-container cta-banner-flex">
        <div class="cta-banner-text">
          <h3>Have Symptoms or Need an Oral Health Checkup?</h3>
          <p>Village screening camps run every week across 18 agency mandals. Speak with your local ASHA volunteer or visit your nearest PHC.</p>
        </div>
        <button class="btn cta-locate-btn" id="btn-bottom-locate" type="button">
          📍 Locate Nearest Camp
        </button>
      </div>
    </div>

    <!-- 8. Footer -->
    <footer class="public-footer-v2">
      <div class="public-container footer-v2-grid">
        <div class="footer-left">
          <strong>Aarogya Drishti</strong> &nbsp;·&nbsp;
          <span>Developed for Tribal Health &amp; Wellness Directorate, ITDA Paderu, Alluri Sitharama Raju District, Andhra Pradesh</span>
        </div>
        <div class="footer-right">
          <span>National Health Mission &nbsp;|&nbsp; ICMR Guidelines 2024 &nbsp;|&nbsp; DPDP Compliant</span>
        </div>
      </div>
    </footer>
  </div>`;
}
