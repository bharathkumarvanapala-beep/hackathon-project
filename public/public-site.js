import { icon } from './icons.js';
import { ITDA_FACILITIES } from './facilities-data.js';

export function publicSiteMarkup(lang = 'en') {
  const te = lang === 'te';

  return `
  <div class="public-site">
    <!-- Top Navigation Bar -->
    <header class="public-nav">
      <div class="public-nav-container">
        <a href="#home" class="public-brand">
          <img src="/brand-logo.svg" alt="Aarogya Drishti" class="nav-logo" onerror="this.src='/icon.svg'">
          <div>
            <strong>Aarogya Drishti</strong>
            <small>ఆరోగ్య దృష్టి · ITDA Paderu</small>
          </div>
        </a>

        <nav class="public-nav-links">
          <a href="#home">${te ? 'హోమ్' : 'Home'}</a>
          <a href="#about">${te ? 'గురించి' : 'About'}</a>
          <a href="#how-it-works">${te ? 'పనిచేసే విధానం' : 'How It Works'}</a>
          <a href="#oral-awareness">${te ? 'నోటి ఆరోగ్యం' : 'Oral Health'}</a>
          <a href="#cancer-awareness">${te ? 'క్యాన్సర్ అవగాహన' : 'Cancer Awareness'}</a>
          <a href="#habits">${te ? 'మంచి అలవాట్లు' : 'Healthy Habits'}</a>
          <a href="#facilities">${te ? 'ఆసుపత్రులు' : 'Facilities'}</a>
          <a href="#faq">${te ? 'ప్రశ్నలు' : 'FAQ'}</a>
          <a href="#contact">${te ? 'సంప్రదించండి' : 'Contact'}</a>
        </nav>

        <div class="public-nav-actions">
          <button id="public-lang-btn" class="btn" style="padding:6px 12px;font-size:12px;">
            🌐 ${te ? 'English' : 'తెలుగు'}
          </button>
          <button id="nav-login-btn" class="btn primary" style="padding:8px 16px;font-size:12px;font-weight:600;">
            ${te ? 'లాగిన్ పోర్టల్' : 'Care Portal Login'} →
          </button>
        </div>
      </div>
    </header>

    <!-- 1. Hero Section -->
    <section id="home" class="public-hero">
      <div class="hero-backdrop"></div>
      <div class="public-container hero-content">
        <span class="pill" style="margin-bottom:16px;">
          🏛️ ${te ? 'ఐటీడీఏ పాడేరు · అల్లూరి సీతారామరాజు జిల్లా' : 'ITDA PADERU · ALLURI SITHARAMA RAJU DISTRICT'}
        </span>
        <h1>
          ${te
            ? 'మారుమూల గిరిజన ప్రాంతాల కోసం<br><span class="accent-text">క్లినికల్ పర్యవేక్షణతో కూడిన నోటి ఆరోగ్య స్క్రీనింగ్</span>'
            : 'Clinically Supervised Oral-Health Screening for <span class="accent-text">Remote Tribal Communities</span>'}
        </h1>
        <p class="hero-lead">
          ${te
            ? 'ఆశా కార్యకర్తల చేతిలో ఆఫ్‌లైన్ స్క్రీనింగ్, అధునాతన జెమిని AI నాణ్యత పరిశీలన, మరియు పాడేరు నెట్‌వర్క్ దంత నిపుణుల ప్రత్యక్ష పర్యవేక్షణ.'
            : 'Connecting frontline ASHA & ANM health workers in agency hamlets with specialist dental surgeons across the ITDA hospital network via offline-first mobile screening and Google Gemini AI decision support.'}
        </p>

        <div class="hero-cta-group">
          <button id="hero-login-btn" class="btn primary hero-btn">
            ${te ? 'కేర్ టీమ్ లాగిన్ అవ్వండి' : 'Access Care Team Portal'} →
          </button>
          <a href="#facilities" class="btn hero-btn ghost">
            ${te ? 'నెట్‌వర్క్ ఆసుపత్రులు' : 'Explore ITDA Facilities'} ↓
          </a>
        </div>

        <div class="hero-stats-banner">
          <div class="stat-pill">
            <strong>6</strong>
            <span>${te ? 'ఐటీడీఏ ఆసుపత్రులు' : 'ITDA Referral Centers'}</span>
          </div>
          <div class="stat-pill">
            <strong>100%</strong>
            <span>${te ? 'ద్విభాషా (తెలుగు / EN)' : 'Bilingual Telugu & EN'}</span>
          </div>
          <div class="stat-pill">
            <strong>14-Day</strong>
            <span>${te ? 'సత్వర బయాప్సీ మార్గం' : 'Fast-Track Triage Target'}</span>
          </div>
          <div class="stat-pill">
            <strong>Gemini AI</strong>
            <span>${te ? 'మల్టీమోడల్ విశ్లేషణ' : 'Multimodal Vision Support'}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- 2. About Section -->
    <section id="about" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'ప్రాజెక్ట్ నేపథ్యం' : 'ABOUT AAROGYA DRISHTI'}</span>
          <h2>${te ? 'గిరిజన ప్రాంతాలలో నోటి క్యాన్సర్ ముందస్తు గుర్తింపు' : 'Combating Oral Cancer in Tribal Agency Belts'}</h2>
          <p class="section-sub">
            ${te
              ? 'అల్లూరి సీతారామరాజు జిల్లాలో పొగాకు, గుట్కా మరియు తమలపాకుల వినియోగం వల్ల వచ్చే నోటి సమస్యలను ప్రాథమిక దశలోనే గుర్తించడం మా లక్ష్యం.'
              : 'Engineered specifically for the geographical and infrastructural realities of the Eastern Ghats agency tracts.'}
          </p>
        </div>

        <div class="grid-3">
          <div class="info-card">
            <div class="card-icon-wrap">🏔️</div>
            <h3>${te ? 'భౌగోళిక అడ్డంకుల అధిగమనం' : 'Overcoming Geographical Barriers'}</h3>
            <p>${te ? 'రవాణా సౌకర్యాలు తక్కువగా ఉన్న మారుమూల గూడేలలో ఆశా కార్యకర్తలు తమ మొబైల్ ద్వారా నేరుగా స్క్రీనింగ్ నిర్వహించగలరు.' : 'Frontline ASHAs screen patients at the doorstep in hilly terrains with no mobile connectivity using persistent offline storage.'}</p>
          </div>
          <div class="info-card">
            <div class="card-icon-wrap">🩺</div>
            <h3>${te ? 'డాక్టర్ ఆధ్వర్యంలో పర్యవేక్షణ' : 'Clinician-in-the-Loop Governance'}</h3>
            <p>${te ? 'AI కేవలం సహాయక సూచనలు మాత్రమే అందిస్తుంది; తుది నిర్ణయం ఎల్లప్పుడూ అర్హత కలిగిన దంత వైద్యుని చేతిలోనే ఉంటుంది.' : 'AI provides non-diagnostic candidate patterns. Every single referral and treatment plan is formally signed by a registered BDS/MBBS officer.'}</p>
          </div>
          <div class="info-card">
            <div class="card-icon-wrap">🔒</div>
            <h3>${te ? 'రోగి గోప్యత & చట్టబద్ధత' : 'DPDP Act 2023 & Privacy'}</h3>
            <p>${te ? 'తెలుగులో రికార్డ్ చేసిన రోగి సమ్మతి ఆధారంగా మాత్రమే ఫోటోలు తీయబడతాయి. ప్రైవేట్ ఎన్‌క్రిప్టెడ్ వాల్ట్‌లో మాత్రమే భద్రపరచబడతాయి.' : 'Informed consent is captured in Telugu or English. Oral photographs are decoupled and stored in zero-dependency, private local disk storage.'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 3. How It Works -->
    <section id="how-it-works" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'రక్షణ మార్గం' : 'HOW IT WORKS'}</span>
          <h2>${te ? 'గూడెం నుండి జిల్లా ఆసుపత్రి వరకు 4 దశల కేర్ పాత్‌వే' : 'The 4-Step Connected Care Journey'}</h2>
        </div>

        <div class="pathway-grid">
          <div class="step-card">
            <div class="step-badge">1</div>
            <h4>${te ? 'గ్రామ స్క్రీనింగ్' : 'Village Screening'}</h4>
            <p>${te ? 'ఆశా కార్యకర్త రోగి వివరాలు, పొగాకు అలవాట్లు, లక్షణాలు నమోదు చేసి, తెలుగులో సమ్మతి తీసుకుని నోటి ఫోటోలు తీస్తారు.' : 'ASHA worker meets patient, records habits & symptoms, secures bilingual consent, and takes calibrated oral photographs.'}</p>
          </div>
          <div class="step-card">
            <div class="step-badge">2</div>
            <h4>${te ? 'నాణ్యత & Gemini AI విశ్లేషణ' : 'Quality & Gemini AI'}</h4>
            <p>${te ? 'వెలుతురు మరియు బ్లర్ తనిఖీ చేసిన తర్వాత, Gemini API ద్వారా నమూనాలు (OSMF, ల్యూకోప్లాకియా) పరిశీలించబడతాయి.' : 'Automated illumination/blur verification checks photo quality; backend Gemini API analyzes candidate lesion patterns.'}</p>
          </div>
          <div class="step-card">
            <div class="step-badge">3</div>
            <h4>${te ? 'వైద్యుల రివ్యూ & టెలికన్సల్టేషన్' : 'Doctor Triage & Video'}</h4>
            <p>${te ? 'వైద్యుడు క్వాడ్రంట్ వారీగా పరిశీలించి, అవసరమైతే లైవ్‌కిట్/WebRTC ద్వారా వీడియో సంప్రదింపు నిర్వహిస్తారు.' : 'Medical Officer reviews case in triage queue, assigns dental quadrant, confirms urgency, or schedules WebRTC video consultation.'}</p>
          </div>
          <div class="step-card">
            <div class="step-badge">4</div>
            <h4>${te ? 'ఆసుపత్రి రిఫరల్ & బయాప్సీ' : 'Hospital Care & Biopsy'}</h4>
            <p>${te ? 'పాడేరు ఏరియా ఆసుపత్రి లేదా విశాఖ కేజీహెచ్‌కు రిఫర్ చేసి, బయాప్సీ మరియు చికిత్స ఫాలో-అప్ ట్రాక్ చేస్తారు.' : 'Seamless referral to Area Hospital Paderu or KGH Vizag; investigation orders (biopsy) and attendance are tracked.'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 4. Oral Health Awareness -->
    <section id="oral-awareness" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'ఆరోగ్య విద్య' : 'ORAL HEALTH AWARENESS'}</span>
          <h2>${te ? 'నోటి ఆరోగ్యం మరియు ముందస్తు సంకేతాలు' : 'Recognizing Early Oral Health Disorders'}</h2>
          <p class="section-sub">${te ? 'లక్షణాలను ముందే గుర్తిస్తే 90% నోటి సమస్యలను సులభంగా నయం చేయవచ్చు.' : 'Timely intervention prevents benign lesions from progressing into invasive carcinomas.'}</p>
        </div>

        <div class="grid-2">
          <div class="content-box">
            <h3>🦷 ${te ? 'సాధారణ నోటి సమస్యలు' : 'Common Oral Conditions in Agency Areas'}</h3>
            <ul class="styled-list">
              <li><strong>${te ? 'నోటి శ్లేష్మ పొర ఫైబ్రోసిస్ (OSMF):' : 'Oral Submucous Fibrosis (OSMF):'}</strong> ${te ? 'నోరు తెరవడం కష్టమవ్వడం, కారం తిన్నప్పుడు మంట రావడం. గుట్కా/తమలపాకు వల్ల వస్తుంది.' : 'Stiffness of oral mucosa, fibrous banding, and progressive inability to open mouth due to areca nut.'}</li>
              <li><strong>${te ? 'ల్యూకోప్లాకియా (తెల్లటి మచ్చలు):' : 'Leukoplakia (White Patches):'}</strong> ${te ? 'నాలుక లేదా బుగ్గపై తుడిచినా పోని తెల్లటి మచ్చలు. పొగతాగడం వల్ల ఎక్కువ.' : 'Firm white patches on cheek or tongue that cannot be scraped off; pre-cancerous indicator.'}</li>
              <li><strong>${te ? 'ఎరిత్రోప్లాకియా (ఎర్రటి మచ్చలు):' : 'Erythroplakia (Velvety Red Lesions):'}</strong> ${te ? 'నోటి లోపల ఎరుపు రంగు మచ్చలు. వీటికి వెంటనే డాక్టర్ పరీక్ష అవసరం.' : 'High-risk red patches with elevated malignant potential; warrants immediate biopsy.'}</li>
              <li><strong>${te ? 'చిగుళ్ల వ్యాధులు (Gingivitis):' : 'Gingivitis & Periodontitis:'}</strong> ${te ? 'చిగుళ్ల నుండి రక్తం కారడం, వాపు, పంటి వేర్లు కదలడం.' : 'Bleeding gums, bacterial plaque accumulation, and chronic inflammation.'}</li>
            </ul>
          </div>

          <div class="content-box highlight">
            <h3>🔍 ${te ? 'స్వీయ నోటి పరీక్ష (5 సులభమైన దశలు)' : 'Self-Examination in 5 Simple Steps'}</h3>
            <ol class="styled-numbered-list">
              <li>${te ? 'అద్దం ముందు నిలబడి మంచి వెలుతురులో పై మరియు కింది పెదవులను లోపల చూడండి.' : 'Check outer and inner surfaces of upper and lower lips under good light.'}</li>
              <li>${te ? 'రెండు వైపులా బుగ్గల లోపలి భాగాన్ని చేతి వేలితో తడిమి గట్టిపడినట్లు ఉందేమో చూడండి.' : 'Inspect bilateral buccal mucosa (cheeks) for white bands, rough patches, or blanching.'}</li>
              <li>${te ? 'నాలుకను బయటకు చాచి రెండు పక్కల అంచులు మరియు నాలుక కింద భాగం గమనించండి.' : 'Stick tongue out; examine dorsal, lateral borders, and floor of the mouth.'}</li>
              <li>${te ? 'నోటి పైకప్పు (అంగిలి) మరియు గొంతు భాగాన్ని తనిఖీ చేయండి.' : 'Tilt head back to examine hard and soft palate.'}</li>
              <li>${te ? 'రెండు వారాలకు మించి మానని పుండ్లు ఏవైనా ఉంటే వెంటనే ఆశా కార్యకర్తను సంప్రదించండి.' : 'If any ulcer or patch does not heal in 14 days, report immediately to your village ASHA.'}</li>
            </ol>
          </div>
        </div>
      </div>
    </section>

    <!-- 5. Cancer Awareness -->
    <section id="cancer-awareness" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill red">${te ? 'ముఖ్యమైన హెచ్చరిక' : 'CANCER AWARENESS'}</span>
          <h2>${te ? 'నోటి క్యాన్సర్ హెచ్చరిక సంకేతాలు & "14-రోజుల నియమం"' : 'Oral Cancer Warning Signs & The "14-Day Rule"'}</h2>
        </div>

        <div class="cancer-banner">
          <div class="rule-box">
            <span class="rule-num">14</span>
            <span class="rule-unit">${te ? 'రోజులు' : 'DAYS'}</span>
            <strong>${te ? 'గోల్డెన్ విండో' : 'CRITICAL WINDOW'}</strong>
          </div>
          <div class="rule-desc">
            <h3>${te ? '14 రోజులకు మించి నోటిలో పుండు మానకపోతే నిర్లక్ష్యం చేయవద్దు!' : 'Any non-healing mouth ulcer persisting beyond 14 days is suspicious.'}</h3>
            <p>${te ? 'నోటిలో నొప్పిలేని గడ్డలు, అకస్మాత్తుగా పళ్ళు ఊడటం, దవడ కదపడంలో ఇబ్బంది, లేదా చెవి వైపు లాగడం వంటి లక్షణాలు ఉంటే వెంటనే సమీప పీహెచ్‌సీ లేదా ఏరియా ఆసుపత్రికి వెళ్లాలి.' : 'Early diagnosis increases 5-year survival rates to over 85%. Our care network provides free biopsies and transport guidance across ITDA Paderu.'}</p>
          </div>
        </div>

        <div class="grid-3" style="margin-top:24px;">
          <div class="danger-card">
            <h4>⚠️ ${te ? 'మానని పుండు' : 'Non-Healing Ulcer'}</h4>
            <p>${te ? 'నొప్పి లేకపోయినా 2 వారాల కంటే ఎక్కువ కాలం ఉండే ఎరుపు లేదా తెలుపు అంచులతో కూడిన పుండు.' : 'Indurated ulcer with rolled borders persisting past 14 days without traumatic cause.'}</p>
          </div>
          <div class="danger-card">
            <h4>⚠️ ${te ? 'నోరు తెరవలేకపోవడం' : 'Restricted Opening'}</h4>
            <p>${te ? 'మూడు వేళ్లు కూడా నోట్లోకి పోనంతగా నోరు మూసుకుపోవడం (Trismus) OSMF లక్షణం.' : 'Unable to insert three vertically stacked fingers between upper and lower incisors.'}</p>
          </div>
          <div class="danger-card">
            <h4>⚠️ ${te ? 'మెడలో గడ్డలు' : 'Cervical Lymph Nodes'}</h4>
            <p>${te ? 'దవడ కింద లేదా మెడ భాగంలో నొప్పిలేని గట్టి గడ్డలు కనిపించడం.' : 'Hard, painless swollen lymph nodes under the jaw or along the neck line.'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 6. Healthy Habits -->
    <section id="habits" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'ఆరోగ్యకర జీవన విధానం' : 'HEALTHY HABITS'}</span>
          <h2>${te ? 'నోటి ఆరోగ్యాన్ని కాపాడుకునే సూత్రాలు' : 'Proven Habits for Lifelong Oral Health'}</h2>
        </div>

        <div class="grid-3">
          <div class="habit-box">
            <span class="habit-icon">🚫</span>
            <h4>${te ? 'పొగాకు & గుట్కా త్యజించండి' : 'Quit Tobacco & Areca Nut'}</h4>
            <p>${te ? 'పొగాకు, గుట్కా, ఖైనీ మరియు చుట్టల వాడకం నోటి క్యాన్సర్‌కు 85% కారణం. వీటిని వెంటనే ఆపాలి.' : 'Eliminate gutka, khaini, chutta, and paan masala. Contact the ITDA cessation counselor for assistance.'}</p>
          </div>
          <div class="habit-box">
            <span class="habit-icon">🪥</span>
            <h4>${te ? 'సరైన పద్ధతిలో బ్రషింగ్' : 'Brush Twice Daily'}</h4>
            <p>${te ? 'రోజూ ఉదయం మరియు రాత్రి నిద్రపోయే ముందు మృదువైన బ్రష్‌తో పళ్ళు మరియు నాలుకను శుభ్రం చేయండి.' : 'Use a soft-bristled toothbrush with circular motions for 2 full minutes. Clean tongue surfaces gently.'}</p>
          </div>
          <div class="habit-box">
            <span class="habit-icon">🥗</span>
            <h4>${te ? 'పోషకాహారం & యాంటీఆక్సిడెంట్లు' : 'Antioxidant-Rich Diet'}</h4>
            <p>${te ? 'స్థానిక కొర్రలు, జొన్నలు, ఉసిరి, నిమ్మ, బొప్పాయి, ఆకుకూరలు శరీర రోగనిరోధక శక్తిని పెంచుతాయి.' : 'Consume local millets (ragi, korra), fresh amla, drumstick leaves, and citrus to repair damaged mucosa.'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 7. Facilities Directory -->
    <section id="facilities" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'ఆసుపత్రుల నెట్‌వర్క్' : 'CONNECTED NETWORK'}</span>
          <h2>${te ? 'ఐటీడీఏ పాడేరు ఆరోగ్య కేంద్రాల డైరెక్టరీ' : 'ITDA Paderu Healthcare Facility Network'}</h2>
          <p class="section-sub">${te ? 'స్క్రీనింగ్ నుండి శస్త్రచికిత్స వరకు అనుసంధానించబడిన కేంద్రాలు.' : 'Directly integrated into the referral and video consultation system.'}</p>
        </div>

        <div class="facilities-grid">
          ${ITDA_FACILITIES.map(f => `
            <div class="facility-card">
              <div class="facility-header">
                <div>
                  <h4>${te && f.nameTe ? f.nameTe : f.name}</h4>
                  <span class="facility-village">📍 ${te && f.villageTe ? f.villageTe : f.village}</span>
                </div>
                <span class="pill ${f.hasBiopsyFacility ? 'green' : 'amber'}">
                  ${f.hasBiopsyFacility ? (te ? 'బయాప్సీ కేంద్రం' : 'Biopsy Available') : (te ? 'ప్రాథమిక కేంద్రం' : 'Primary Care')}
                </span>
              </div>
              <p class="facility-level">${te && f.levelTe ? f.levelTe : f.level}</p>
              <div class="facility-meta">
                <span>🩺 ${f.hasDentalSurgeon ? (te ? 'దంత వైద్యుడు కలరు' : 'Dental Surgeon On-Duty') : (te ? 'విజిటింగ్ డెంటిస్ట్' : 'Visiting Clinician')}</span>
                <span>📞 ${f.phone || '08935-252233'}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>

    <!-- 8. FAQ Section -->
    <section id="faq" class="public-section">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'తరచూ అడిగే ప్రశ్నలు' : 'FREQUENTLY ASKED QUESTIONS'}</span>
          <h2>${te ? 'మీ సందేహాలు - సమాధానాలు' : 'Questions & Transparency'}</h2>
        </div>

        <div class="faq-list">
          <div class="faq-item">
            <h4>${te ? '1. ఇంటర్నెట్ లేని అటవీ గ్రామాలలో ఈ వ్యవస్థ ఎలా పనిచేస్తుంది?' : '1. How does screening work in remote hamlets without cellular connectivity?'}</h4>
            <p>${te ? 'ఆరోగ్య దృష్టి పూర్తి ఆఫ్‌లైన్ సామర్థ్యం కలిగి ఉంది. ఆశా కార్యకర్త మొబైల్‌లోని ఇండెక్స్‌డ్-డీబీలో రోగి వివరాలు మరియు ఫోటోలు సురక్షితంగా సేవ్ అవుతాయి. నెట్‌వర్క్ పరిధిలోకి వచ్చినప్పుడు మాత్రమే ఆటోమేటిక్‌గా సర్వర్‌కు సింక్ అవుతాయి.' : 'Aarogya Drishti operates offline-first. Records and photos persist securely in the device’s private database. Once the worker returns to a network zone, synchronization completes with conflict resolution.'}</p>
          </div>
          <div class="faq-item">
            <h4>${te ? '2. Gemini AI నేరుగా వ్యాధి నిర్ధారణ చేస్తుందా?' : '2. Does the Gemini AI generate an autonomous medical diagnosis?'}</h4>
            <p>${te ? 'లేదు. AI కేవలం సహాయక సాధనం (Clinical Decision Support). ఇది ఫోటో నాణ్యత మరియు సంభావ్య నమూనాలను మాత్రమే వైద్యుని ముందుంచుతుంది. ప్రతి రిఫరల్ మరియు చికిత్స నిర్ణయం తప్పనిసరిగా డాక్టర్ సంతకం ద్వారానే జరుగుతుంది.' : 'No. The AI provides clinical research pattern observations only. It does NOT independently diagnose cancer. Final clinical responsibility remains exclusively with the registered medical/dental officer.'}</p>
          </div>
          <div class="faq-item">
            <h4>${te ? '3. రోగి డేటా మరియు ఫోటోలు సురక్షితంగా ఉంటాయా?' : '3. How is patient data and privacy protected?'}</h4>
            <p>${te ? 'పూర్తిగా సురక్షితం. భారత డిజిటల్ పర్సనల్ డేటా ప్రొటెక్షన్ చట్టం (DPDP 2023) ప్రకారం తెలుగులో సమ్మతి తీసుకున్న తర్వాతే ఫోటోలు తీయబడతాయి. ఫోటోలు డేటాబేస్ నుండి విడదీయబడి ప్రైవేట్ సర్వర్ డిస్క్‌లో SHA-256 హాష్‌తో భద్రపరచబడతాయి.' : 'In compliance with India’s DPDP Act 2023, consent is recorded in Telugu/English prior to intake. Patients may withdraw consent at any time, which halts automated processing immediately.'}</p>
          </div>
          <div class="faq-item">
            <h4>${te ? '4. వీడియో కన్సల్టేషన్ ఎలా జరుగుతుంది?' : '4. How does video consultation work between patient and specialist?'}</h4>
            <p>${te ? 'వైద్యుడు సమయం నిర్ణయించినప్పుడు, WebRTC/LiveKit ద్వారా సురక్షితమైన వీడియో గది తెరవబడుతుంది. ఆశా కార్యకర్త రోగి వద్ద ఉండి మొబైల్ లేదా ట్యాబ్లెట్ ద్వారా డాక్టర్‌తో ప్రత్యక్షంగా మాట్లాడిస్తారు.' : 'When scheduled, an authenticated peer-to-peer WebRTC / LiveKit connection connects the patient and assisting health worker directly with the Medical Officer or Specialist.'}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- 9. Contact Section -->
    <section id="contact" class="public-section alt-bg">
      <div class="public-container">
        <div class="section-title">
          <span class="pill">${te ? 'సంప్రదింపుల కేంద్రం' : 'CONTACT & HELPLINE'}</span>
          <h2>${te ? 'సహాయం మరియు వివరాల కోసం సంప్రదించండి' : 'Connect with the ITDA Health Mission'}</h2>
        </div>

        <div class="grid-3">
          <div class="contact-card">
            <span class="contact-icon">🏢</span>
            <h4>${te ? 'జిల్లా ఆరోగ్య కార్యాలయం' : 'District Health Office'}</h4>
            <p>ITDA Administrative Complex, Paderu<br>Alluri Sitharama Raju District, AP - 531024</p>
          </div>
          <div class="contact-card">
            <span class="contact-icon">📞</span>
            <h4>${te ? 'ఉచిత టెలి-రిఫరల్ హెల్ప్‌లైన్' : 'Tele-Referral Toll-Free'}</h4>
            <p><strong>104 / 108</strong> (24x7 Emergency Line)<br><strong>08935-252233</strong> (Dental Screening Desk)</p>
          </div>
          <div class="contact-card">
            <span class="contact-icon">✉️</span>
            <h4>${te ? 'నోడల్ అధికారి ఈమెయిల్' : 'Nodal Medical Officer'}</h4>
            <p>drishti.itda@gmail.com<br>health.asr@ap.gov.in</p>
          </div>
        </div>
      </div>
    </section>

    <!-- Footer -->
    <footer class="public-footer">
      <div class="public-container footer-flex">
        <div>
          <div class="footer-brand">
            <img src="/brand-logo.svg" alt="" style="height:28px;" onerror="this.src='/icon.svg'">
            <strong>Aarogya Drishti · ఆరోగ్య దృష్టి</strong>
          </div>
          <small>${te ? 'ఐటీడీఏ పాడేరు, ఆంధ్రప్రదేశ్ ప్రభుత్వం సమగ్ర గిరిజన అభివృద్ధి సంస్థ.' : 'Integrated Tribal Development Agency (ITDA) Paderu, Govt. of Andhra Pradesh.'}</small>
        </div>
        <div class="footer-links">
          <button id="footer-login-btn" class="btn primary" style="font-size:11px;">
            ${te ? 'పోర్టల్ ప్రవేశం' : 'Care Team Portal'} →
          </button>
        </div>
      </div>
    </footer>
  </div>
  `;
}

