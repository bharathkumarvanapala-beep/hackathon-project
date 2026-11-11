import { icon } from './icons.js';
import { isAndroid } from './platform.js';

export function loginMarkup(lang = 'en') {
  const te = lang === 'te';
  const demoPass = 'Drishti@2026';

  return `
  <main class="login-shell">
    <section class="login-story">
      <div class="brand">
        <img src="/brand-logo.svg" alt="Aarogya Drishti" onerror="this.src='/icon.svg'">
        <div>
          <strong>Aarogya Drishti</strong>
          <small>ఆరోగ్య దృష్టి · ITDA Paderu</small>
        </div>
      </div>
      <div>
        <div class="eyebrow">CONNECTED CARE · TRIBAL HEALTH FIRST</div>
        <h1>${te ? 'ప్రతి రోగికి అనుసంధానమైన<br>సంరక్షణ బృందం.' : 'One patient.<br>One connected care team.'}</h1>
        <p>${te
          ? 'మారుమూల గ్రామంలో ఆశా కార్యకర్త స్క్రీనింగ్ నుండి మండల డాక్టర్, జిల్లా స్పెషలిస్ట్ మరియు ఆసుపత్రి కోఆర్డినేటర్ వరకు పూర్తి సంరక్షణ ప్రయాణం.'
          : 'From frontline village screening to clinical review, specialist teleconsultation, and hospital referral navigation.'}
        </p>
        <div class="login-features">
          <span>${icon('offline', 17)} ${te ? 'ఆఫ్‌లైన్ స్క్రీనింగ్' : 'Offline Screening'}</span>
          <span>${icon('brain', 17)} ${te ? 'జెమిని AI సహాయం' : 'Gemini AI Vision'}</span>
          <span>${icon('video', 17)} ${te ? 'వీడియో కన్సల్టేషన్' : 'WebRTC Consultations'}</span>
          <span>${icon('shield', 17)} ${te ? 'పాత్ర ఆధారిత పోర్టల్' : '6 Role Portals'}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
        <button id="back-to-public-btn" class="btn ghost" style="padding:6px 12px;font-size:12px;border:1px solid rgba(255,255,255,0.4);color:#fff;cursor:pointer;">
          ← ${te ? 'ప్రజా వెబ్‌సైట్‌కు తిరిగి వెళ్లండి' : 'Back to Public Website'}
        </button>
        <small style="color:rgba(255,255,255,0.7);">AAROHAN HACKATHON 2026</small>
      </div>
    </section>

    <section class="login-panel">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <button id="back-public-link" class="btn" style="padding:5px 10px;font-size:11px;background:none;border:none;color:var(--text-secondary);cursor:pointer;">
          ← ${te ? 'ప్రజా వెబ్‌సైట్' : 'Public Website'}
        </button>
        <button class="language" id="login-lang">${te ? 'English' : 'తెలుగు'}</button>
      </div>

      <div class="login-card">
        <span class="pill">${te ? 'సురక్షిత కేర్ పోర్టల్ ప్రవేశం' : 'AUTHENTICATED CARE PORTAL'}</span>
        <h2>${te ? 'లాగిన్ అవ్వండి' : 'Sign in to your Portal'}</h2>
        <p class="sub">${te ? 'మీ పాత్రకు తగిన డెమో ఖాతాను ఎంచుకోండి లేదా ఆధారాలను నమోదు చేయండి.' : 'Select a demonstration role below or enter your credentials.'}</p>

        <!-- 6 Synthetic Demo Accounts Grid -->
        <div class="demo-accounts-pillbox" style="margin:14px 0;padding:12px;background:#f0fdf4;border:1px dashed #86efac;border-radius:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:11px;color:#166534;">
              ⚡ ${te ? 'డెమో 1-క్లిక్ లాగిన్ ఎంపికలు (6 పాత్రలు):' : 'Demo 1-Click Quick-Fill (6 Roles):'}
            </strong>
            <span style="font-size:10px;background:#bbf7d0;color:#14532d;padding:2px 6px;border-radius:8px;font-weight:600;">
              ${demoPass}
            </span>
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <button type="button" class="btn demo-acc-btn" data-email="asha@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>👩‍⚕️</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'ఆశా కార్యకర్త' : 'Health Worker'}</strong>
                <small style="color:#64748b;font-size:9.5px;">asha@drishti.demo</small>
              </div>
            </button>

            <button type="button" class="btn demo-acc-btn" data-email="doctor@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>🩺</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'మెడికల్ ఆఫీసర్' : 'Medical Officer'}</strong>
                <small style="color:#64748b;font-size:9.5px;">doctor@drishti.demo</small>
              </div>
            </button>

            <button type="button" class="btn demo-acc-btn" data-email="specialist@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>🔬</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'స్పెషలిస్ట్ డాక్టర్' : 'Specialist'}</strong>
                <small style="color:#64748b;font-size:9.5px;">specialist@drishti.demo</small>
              </div>
            </button>

            <button type="button" class="btn demo-acc-btn" data-email="hospital@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>🏥</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'హాస్పిటల్ కోఆర్డినేటర్' : 'Hospital Coord.'}</strong>
                <small style="color:#64748b;font-size:9.5px;">hospital@drishti.demo</small>
              </div>
            </button>

            <button type="button" class="btn demo-acc-btn" data-email="admin@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>🏛️</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'జిల్లా అడ్మిన్' : 'District Admin'}</strong>
                <small style="color:#64748b;font-size:9.5px;">admin@drishti.demo</small>
              </div>
            </button>

            <button type="button" class="btn demo-acc-btn" data-email="patient@drishti.demo" data-pass="${demoPass}" style="font-size:11px;padding:7px 8px;text-align:left;display:flex;align-items:center;gap:6px;background:#ffffff;border:1px solid #cbd5e1;cursor:pointer;">
              <span>👤</span>
              <div>
                <strong style="display:block;line-height:1.1;">${te ? 'రోగి పోర్టల్' : 'Patient'}</strong>
                <small style="color:#64748b;font-size:9.5px;">patient@drishti.demo</small>
              </div>
            </button>
          </div>
        </div>

        <form id="login-form">
          <div class="field">
            <label for="email">${te ? 'ఇమెయిల్ చిరునామా' : 'Email address'}</label>
            <input id="email" name="email" type="email" autocomplete="username" required placeholder="asha@drishti.demo" value="asha@drishti.demo">
          </div>

          <div class="field">
            <label for="password">${te ? 'పాస్‌వర్డ్' : 'Password'}</label>
            <div style="display:flex;gap:6px;align-items:center;">
              <input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" style="flex:1;" value="${demoPass}">
              <button type="button" id="toggle-pwd" class="btn" style="padding:8px 10px;font-size:11px;" title="Show/Hide Password">👁</button>
            </div>
          </div>

          <p id="login-error" role="alert" class="error-text"></p>

          <button class="btn primary" type="submit" style="width:100%;padding:10px;font-weight:600;font-size:13px;cursor:pointer;">
            ${te ? 'లాగిన్ అవ్వండి' : 'Sign in to Portal'} →
          </button>
        </form>

        ${isAndroid() ? `
          <button class="native-connect" id="native-server">${icon('settings', 16)} ${te ? 'సర్వర్ అనుసంధానం' : 'Connect care server'}</button>
          <button type="button" class="native-connect" id="native-test">${te ? 'కనెక్షన్ తనిఖీ' : 'Test connection'}</button>
          <p id="native-address" class="mini" style="overflow-wrap:anywhere"></p>
          <p id="native-connection-status" class="mini" role="status"></p>
        ` : `
          <div style="margin-top:12px;text-align:center;">
            <a class="native-connect" href="/downloads/android" style="font-size:11px;">${icon('screening', 14)} ${te ? 'Android APK డౌన్‌లోడ్' : 'Download Android App (APK)'} ↓</a>
          </div>
        `}

        <div class="notice" style="margin-top:14px;font-size:10.5px;">
          ${te
            ? 'ఈ సిస్టమ్ అధికారిక హ్యాకథాన్ మరియు పరిశోధన ప్రదర్శన కోసం రూపొందించబడింది. ఇది వైద్య చికిత్స ప్రత్యామ్నాయం కాదు.'
            : 'Demonstration and research prototype. AI assessments provide triage guidance and do not replace signed medical officer diagnosis.'}
        </div>
      </div>
    </section>
  </main>`;
}
