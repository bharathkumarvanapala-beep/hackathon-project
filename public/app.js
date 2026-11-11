import {researchMarkup,mountResearch} from './research-ai.js';
import {careMarkup,mountCare} from './care.js';
import {teamMarkup,mountTeam} from './team.js';
import {icon} from './icons.js';
import {mountAssistant,openIntake,resetIntake,hideAssistant} from './assistant.js';
import {isAndroid,configureServer,mountNativeConnection} from './platform.js';
import {consultationMarkup,mountConsultations} from './consultations.js';
import {voiceMarkup,mountVoice} from './voice-intake.js';
import {qualityMetrics,overdue} from './domain.js';
import {api,currentIdentity,forgetSession,recoverSession,login,logout,openCache,localPatients,createScreening,syncRecords,reviewPatient,saveLocal,updateReferral,syncSingleRecord,resolveConflict} from './client.js';
import {initI18n,t as i18nT,setLanguage as i18nSetLanguage} from './i18n.js';
import {mountSyncDrawer,openSyncDrawer,closeSyncDrawer,openConflictModal} from './sync-drawer.js';
import {loginMarkup} from './auth.js';
const $=s=>document.querySelector(s);const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang=localStorage.getItem('drishti-lang')||'en',view='dashboard',selected=null,photo=null,quality=null,role='worker',patients=[],events=[],referralsList=[],automation={configured:false,pending:0,events:[],receipts:0};
const copy={team:['Care team','సంరక్షణ బృందం'],dashboard:['Overview','అవలోకనం'],patients:['Patient registry','రోగుల నమోదు'],screening:['New screening','కొత్త స్క్రీనింగ్'],reviews:['Clinical reviews','వైద్య సమీక్షలు'],referrals:['Referrals & follow-up','రిఫరల్స్ & ఫాలో-అప్'],district:['District insights','జిల్లా విశ్లేషణ'],settings:['Sync & integrations','సింక్ & అనుసంధానాలు'],welcome:['Care begins with a connection.','సంరక్షణ అనుసంధానంతో మొదలవుతుంది.'],subtitle:['A clearer view of every patient’s journey, from screening to care.','స్క్రీనింగ్ నుండి చికిత్స వరకు ప్రతి రోగి ప్రయాణం.'],new:['New screening','కొత్త స్క్రీనింగ్'],total:['Patients registered','నమోదైన రోగులు'],pending:['Awaiting review','సమీక్ష కోసం వేచి'],referral:['Active referrals','క్రియాశీల రిఫరల్స్'],overdue:['Overdue follow-ups','గడువు దాటిన ఫాలో-అప్‌లు'],name:['Patient name','రోగి పేరు'],age:['Age','వయస్సు'],village:['Village / habitation','గ్రామం'],phone:['Phone (optional)','ఫోన్ (ఐచ్ఛికం)'],history:['History and symptoms','చరిత్ర మరియు లక్షణాలు'],consent:['I have explained this demonstration and obtained permission to store the submitted information on this device. Use synthetic data only.','ఈ ప్రదర్శనను వివరించి ఈ పరికరంలో సమాచారాన్ని నిల్వ చేయడానికి అనుమతి పొందాను. కల్పిత డేటాను మాత్రమే ఉపయోగించండి.'],save:['Save screening offline','స్క్రీనింగ్‌ను పరికరంలో సేవ్ చేయండి'],photo:['Oral photograph','నోటి ఫోటో'],capture:['Take or upload a photograph','ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి'],guide:['Use good lighting, keep the camera steady, and capture the area clearly.','మంచి వెలుతురులో కెమెరాను స్థిరంగా ఉంచి స్పష్టమైన ఫోటో తీయండి.'],search:['Search name, ID or village…','పేరు, ID లేదా గ్రామం వెతకండి…'],patient:['Patient','రోగి'],stage:['Care stage','సంరక్షణ దశ'],action:['Action','చర్య'],open:['Open record','రికార్డు తెరవండి'],local:['Saved on device','పరికరంలో సేవ్ అయింది'],sync:['Send queued events','క్యూలోని ఈవెంట్‌లను పంపండి'],online:['Online','ఆన్‌లైన్'],offline:['Offline · device storage active','ఆఫ్‌లైన్ · పరికర నిల్వ క్రియాశీలం'],demo:['SYNTHETIC DEMO','కల్పిత డేటా ప్రదర్శన'],review:['Clinical review','వైద్య సమీక్ష'],notes:['Clinical notes','వైద్య గమనికలు'],due:['Next appointment / follow-up','తదుపరి అపాయింట్‌మెంట్'],facility:['Referral facility','రిఫరల్ ఆసుపత్రి'],back:['Back to registry','నమోదు జాబితాకు'],empty:['No matching records yet.','ఇంకా సరిపోలే రికార్డులు లేవు.'],workflow:['Patient care pathway','రోగి సంరక్షణ మార్గం'],next:['Next actions','తదుపరి చర్యలు'],language:['Read capture guidance','ఫోటో సూచనలను వినండి']};
const t=k=>i18nT(k,copy[k]?.[lang==='te'?1:0]||k);
const stages={screened:['Awaiting review','సమీక్ష పెండింగ్'],reviewed:['Reviewed','సమీక్ష పూర్తయింది'],referred:['Referred','రిఫర్ చేయబడింది'],diagnostics:['Diagnostics','పరీక్షలు'],treatment:['Treatment follow-up','చికిత్స ఫాలో-అప్'],closed:['Care completed','సంరక్షణ పూర్తయింది']};const st=s=>stages[s]?.[lang==='te'?1:0]||s;
function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4500);}
async function refresh(){patients=await localPatients();events=patients.filter(p=>p._sync==='pending');if(navigator.onLine){try{const res=await api('/api/referrals');referralsList=res.referrals||[];}catch{}}}
async function persist(p,type){if(type==='screening.created'){await createScreening(p);if(navigator.onLine){try{await syncRecords();}catch(e){toast(e.message);}}}else{await reviewPatient(p);}await refresh();}
const icons=Object.fromEntries(['dashboard','patients','screening','reviews','referrals','district','team','settings'].map(key=>[key,icon(key)]));
function shell(){
  const pending=patients.filter(p=>p._sync==='pending').length;
  const userObj = currentIdentity()?.user || { name: 'Health Worker', role: 'worker' };
  const roleTitle = lang==='te'
    ? ({worker:'హెల్త్ వర్కర్',doctor:'మెడికల్ ఆఫీసర్',admin:'అడ్మినిస్ట్రేటర్'}[role]||'వినియోగదారు')
    : ({worker:'Health Worker',doctor:'Medical Officer',admin:'Administrator'}[role]||'User');
  const portalHeading = lang==='te'
    ? ({worker:'హెల్త్ వర్కర్ పోర్టల్',doctor:'క్లినికల్ డాక్టర్ పోర్టల్',admin:'అడ్మినిస్ట్రేటర్ పోర్టల్'}[role]||'కేర్ పోర్టల్')
    : ({worker:'Health Worker Portal',doctor:'Clinician Portal',admin:'Administrator Portal'}[role]||'Care Portal');
  const portalSub = lang==='te' ? 'సమాజ ఆరోగ్య సమన్వయం' : 'Community Care Coordination';
  const pendingReviews = patients.filter(p=>p.stage==='screened').length;

  $('#app').innerHTML=`
  <div class="app-layout">
    <header class="app-header-banner">
      <div class="header-branding">
        <img src="/brand-logo.svg" alt="Aarogya Drishti Logo" class="header-logo">
        <div class="header-brand-text">
          <h1 class="header-title">Aarogya Drishti</h1>
          <p class="header-hackathon">AAROHAN · Inter-Centre Hackathon 2026</p>
        </div>
      </div>

      <div class="header-center-tagline">
        <strong>Healthy Communities &nbsp;|&nbsp; Stronger Futures</strong>
        <span>ఆరోగ్య సమాజాలు &nbsp;|&nbsp; మెరుగైన భవిష్యత్తు</span>
      </div>

      <div class="header-right-side">
        <div class="header-landscape-art" aria-hidden="true"></div>
        <div class="header-controls">
          <div class="lang-switch-pills">
            <button class="lang-pill-btn ${lang==='en'?'active':''}" id="lang-btn-en" type="button">English</button>
            <button class="lang-pill-btn ${lang==='te'?'active':''}" id="lang-btn-te" type="button">తెలుగు</button>
          </div>
          <button id="lang" style="display:none;" aria-hidden="true">${lang==='en'?'తెలుగు':'English'}</button>
          
          <div class="user-profile-badge" title="${esc(userObj.name)}">
            <span class="user-avatar-circle">${icon('user', 18)}</span>
            <div class="user-meta">
              <strong>${roleTitle}</strong>
              <small>Demo User</small>
            </div>
          </div>

          <button class="header-logout-btn" id="logout" title="${lang==='te'?'లాగౌట్':'Sign out'}" aria-label="Sign out">
            ${icon('logout', 16)}
          </button>
        </div>
      </div>
    </header>

    <div class="app-body-container">
      <aside class="app-sidebar">
        <div class="sidebar-portal-heading">
          <h2>${portalHeading}</h2>
          <span>${portalSub}</span>
        </div>

        <nav class="sidebar-nav">
          <button class="sidebar-nav-btn ${view==='dashboard'?'active':''}" data-nav="dashboard">
            <span class="sidebar-nav-icon">${icon('home', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Home</strong>
              <small>హోమ్</small>
            </div>
          </button>

          ${role==='worker'?`
          <button class="sidebar-nav-btn ${view==='screening'?'active':''}" data-nav="screening">
            <span class="sidebar-nav-icon">${icon('gallery', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Upload Image</strong>
              <small>ఫోటో అప్‌లోడ్</small>
            </div>
          </button>`:''}

          <button class="sidebar-nav-btn ${view==='patients'?'active':''}" data-nav="patients">
            <span class="sidebar-nav-icon">${icon('patients', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Patient Records</strong>
              <small>రోగి రికార్డులు</small>
            </div>
          </button>

          <button class="sidebar-nav-btn ${view==='reviews'?'active':''}" data-nav="reviews">
            <span class="sidebar-nav-icon">${icon('brain', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>AI Analysis Demo</strong>
              <small>AI విశ్లేషణ డెమో</small>
            </div>
            ${pendingReviews?`<span class="sidebar-nav-badge">${pendingReviews}</span>`:''}
          </button>

          <button class="sidebar-nav-btn ${view==='referrals'?'active':''}" data-nav="referrals">
            <span class="sidebar-nav-icon">${icon('calendar', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Appointments</strong>
              <small>అపాయింట్‌మెంట్లు</small>
            </div>
          </button>

          <button class="sidebar-nav-btn" id="sync-drawer-btn" type="button" aria-label="Open offline sync drawer">
            <span class="sidebar-nav-icon">${icon('sync', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Offline Sync</strong>
              <small>ఆఫ్‌లైన్ సింక్</small>
            </div>
            <span class="sidebar-nav-badge">${pending}</span>
          </button>

          ${role==='admin'?`
          <button class="sidebar-nav-btn ${view==='team'?'active':''}" data-nav="team">
            <span class="sidebar-nav-icon">${icon('settings', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Care Team</strong>
              <small>బృందం</small>
            </div>
          </button>`:''}

          <button class="sidebar-nav-btn" id="sidebar-logout-btn" type="button">
            <span class="sidebar-nav-icon">${icon('logout', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>Logout</strong>
              <small>లాగౌట్</small>
            </div>
          </button>
        </nav>

        <div class="sidebar-bottom-art">
          <img src="/sidebar-village.jpg" alt="Tribal village community">
          <div class="sidebar-bottom-caption">
            <span>Better Health for Every Community</span>
          </div>
        </div>
      </aside>

      <main class="app-main-content">
        <div class="content" id="content"></div>
      </main>
    </div>

    <footer class="app-global-footer">
      <div class="footer-left">
        <span class="footer-leaf">${icon('leaf', 16)}</span>
        <span>Aarogya Drishti &nbsp;|&nbsp; Health · Technology · Community</span>
      </div>
      <div class="footer-right">
        <span class="footer-info">${icon('info', 15)}</span>
        <span>Synthetic Data Only · Not for Clinical Use</span>
      </div>
    </footer>
  </div>`;

  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>navigate(b.dataset.nav));
  
  const setLang = (newLang) => {
    lang = newLang;
    localStorage.setItem('drishti-lang', lang);
    i18nSetLanguage(lang);
    render();
  };

  const btnEn = $('#lang-btn-en');
  const btnTe = $('#lang-btn-te');
  if (btnEn) btnEn.onclick = () => setLang('en');
  if (btnTe) btnTe.onclick = () => setLang('te');
  const oldLang = $('#lang');
  if (oldLang) oldLang.onclick = () => setLang(lang === 'en' ? 'te' : 'en');

  if($('#sync-drawer-btn')) $('#sync-drawer-btn').onclick=()=>openSyncDrawer();
  
  const handleLogout = async()=>{
    try{
      await logout();
      patients=[];
      events=[];
      showLogin();
    } catch {
      toast(lang==='te'?'లాగౌట్ చేయడానికి సర్వర్ కనెక్షన్ అవసరం.':'Connect to the server to sign out securely.');
    }
  };
  if($('#logout')) $('#logout').onclick = handleLogout;
  if($('#sidebar-logout-btn')) $('#sidebar-logout-btn').onclick = handleLogout;
}
function updateSyncDrawer(){mountSyncDrawer({patients,lang,onSyncAll:async()=>{await sync();},onSyncSingle:async(patientId)=>{try{const res=await syncSingleRecord(patientId);if(res.conflict){toast(lang==='te'?'వైరుధ్యం గుర్తించబడింది.':'Conflict detected.');const p=patients.find(pt=>pt.id===patientId);if(p)showConflictDialog(p);}else{toast(lang==='te'?'రికార్డు విజయవంతంగా సింక్ అయింది.':'Record synced successfully.');}await refresh();render();}catch(err){toast(err.message);await refresh();render();}},onResolveConflict:(patient)=>showConflictDialog(patient),onOpenRecord:(id)=>navigate('record',id)});}
function showConflictDialog(patient){openConflictModal({localPatient:patient,serverPatient:patient._serverConflict,lang,onKeepServer:async(id)=>{try{await resolveConflict(id,'keep_server');toast(lang==='te'?'సర్వర్ రికార్డు ఉంచబడింది.':'Server record preserved.');await refresh();render();}catch(err){toast(err.message);}},onKeepLocal:async(id)=>{try{await resolveConflict(id,'overwrite_local');toast(lang==='te'?'పరికర రికార్డుతో భర్తీ చేయబడింది.':'Overwritten with device edit.');await refresh();render();}catch(err){toast(err.message);}}});}

function updateConnection(){const badge=document.querySelector('.top-actions > .pill');if(badge){badge.classList.toggle('offline',!navigator.onLine);badge.textContent='● '+t(navigator.onLine?'online':'offline');}}
function navigate(v,id){if(v==='screening'&&role!=='worker')return toast(lang==='te'?'స్క్రీనింగ్ నమోదు ఆరోగ్య కార్యకర్తకు మాత్రమే.':'Only health workers can register screenings.');view=v;selected=id||null;photo=null;quality=null;render();window.scrollTo(0,0);}
function intro(title,sub='',button=false){return `<div class="intro"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${button&&role==='worker'?`<button class="btn primary" data-new>＋ ${t('new')}</button>`:''}</div>`;}
function stats(){return `<div class="stats">${[['total',patients.length,'♧'],['pending',patients.filter(p=>p.stage==='screened').length,'◷'],['referral',patients.filter(p=>['referred','diagnostics','treatment'].includes(p.stage)).length,'↗'],['overdue',patients.filter(p=>overdue(p)).length,'◴']].map(([key,value,icon])=>`<div class="stat"><div class="stat-top">${t(key)}<span class="stat-icon">${icons[key==='total'?'patients':key==='pending'?'reviews':key==='referral'?'referrals':'district']}</span></div><strong>${value.toString().padStart(2,'0')}</strong><small>${lang==='te'?'భాగస్వామ్య & పరికర రికార్డులు':'Shared records + pending device captures'}</small></div>`).join('')}</div>`;}
function table(list){return list.length?`<div class="table-wrap"><table><thead><tr><th>${t('patient')}</th><th>${t('village')}</th><th>${t('stage')}</th><th>${t('action')}</th></tr></thead><tbody>${list.map(p=>`<tr><td><strong>${esc(p.name)}</strong><small>${esc(p.id)} ${p._sync==='pending'?' · ↑ pending upload':' · ✓ shared'} · ${p.age} ${lang==='te'?'సంవత్సరాలు':'years'}</small></td><td>${esc(p.village)}</td><td><span class="pill ${overdue(p)?'red':p.stage==='screened'?'amber':''}">${st(p.stage)}</span></td><td><button class="table-action" data-open="${esc(p.id)}">${t('open')} ↗</button></td></tr>`).join('')}</tbody></table></div>`:`<div class="empty">${t('empty')}</div>`;}
function tasks(){const list=patients.filter(p=>overdue(p)||p.stage==='screened').slice(0,4);return list.map(p=>`<div class="task"><div class="task-icon">${overdue(p)?'◴':'▣'}</div><div><p><strong>${esc(p.name)}</strong></p><p>${overdue(p)?t('overdue'):t('pending')}</p><small>${esc(p.village)} · ${esc(p.due||p.createdAt.slice(0,10))}</small></div><button class="table-action" style="margin-left:auto" data-open="${esc(p.id)}">↗</button></div>`).join('')||`<p class="sub">${t('empty')}</p>`;}
function dashboard(){return intro(t('welcome'),t('subtitle'),true)+`<section class="hero"><div class="hero-copy"><div class="eyebrow">CONNECTED CARE · COMMUNITY FIRST</div><h2>${lang==='te'?'ప్రతి స్క్రీనింగ్‌కు ఒక తదుపరి అడుగు.':'Every screening deserves a next step.'}</h2><p>${lang==='te'?'గ్రామంలో నమోదు. వైద్యునితో అనుసంధానం. ప్రతి రోగికి నిరంతర సంరక్షణ.':'From the first conversation to a clinician’s review. One connected journey, wherever care begins.'}</p><div class="hero-actions">${role==='worker'?`<button class="btn" data-assistant>${icon('spark',16)} ${lang==='te'?'సాథితో నమోదు':'Register with Saathi'}</button><button class="btn ghost" data-new>${t('new')} ${icon('arrow',15)}</button>`:`<button class="btn" data-go="patients">${t('patients')} ${icon('arrow',15)}</button>`}</div></div><div class="hero-art" aria-hidden="true"><div class="hero-orbit"></div><div class="hero-medallion">${icon('screening',46)}</div><span class="orbit-label one">${lang==='te'?'అనుసంధాన సంరక్షణ':'CONNECTED CARE'}</span><span class="orbit-label two"><i></i>${lang==='te'?'ఆఫ్‌లైన్ సిద్ధం':'OFFLINE READY'}</span></div></section>`+stats()+`<div class="columns"><div><section class="card"><div class="card-head"><h2>${lang==='te'?'ఇటీవలి రోగులు':'Recent patient journeys'}</h2><a data-go="patients">${t('patients')} →</a></div>${table([...patients].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5))}</section><section class="card"><h2>${t('workflow')}</h2><div class="flow">${Object.entries(stages).map(([k,v],i)=>`<div class="${i===0?'done':''}"><b>${i+1}</b>${st(k)}</div>`).join('')}</div><p class="mini">${lang==='te'?'వైద్యుని సమీక్ష ద్వారా మాత్రమే సంరక్షణ నిర్ణయాలు.':'Care decisions remain with the reviewing clinician. AI assessment is not a diagnosis.'}</p></section></div><div><section class="card"><div class="card-head"><h2>${t('next')}</h2><span class="pill amber">${patients.filter(p=>overdue(p)||p.stage==='screened').length}</span></div>${tasks()}</section><section class="card"><h2>${lang==='te'?'గ్రామాల వారీగా స్క్రీనింగ్':'Screening by village'}</h2>${villageBars()}<p class="metric-note">${lang==='te'?'కల్పిత డేటా · వ్యాధి ప్రాబల్యం కాదు':'Synthetic counts · not disease prevalence'}</p></section></div></div>`;}
function villageBars(){const counts={};patients.forEach(p=>counts[p.village]=(counts[p.village]||0)+1);const max=Math.max(1,...Object.values(counts));return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`<div class="bar-row"><span>${esc(v)}</span><div class="bar"><i style="width:${n/max*100}%"></i></div><b>${n}</b></div>`).join('')||`<p class="sub">${t('empty')}</p>`;}
function screening(){
  const isTe = lang === 'te';
  return `
  <div class="upload-view-container">
    <div class="upload-view-header">
      <button class="back-link-nav" type="button" data-go="dashboard">← ${isTe ? 'డాష్‌బోర్డుకు తిరిగి వెళ్ళండి' : 'Back to Dashboard'}</button>
      
      <div class="view-header-title-row">
        <span class="view-header-icon">${icon('upload', 26)}</span>
        <div>
          <h1>Oral Image Upload & Quality Check</h1>
          <span class="view-sub-te">నోటి ఫోటో అప్‌లోడ్ & నాణ్యత తనిఖీ</span>
        </div>
      </div>
      
      <p class="view-desc-en">Upload a clear image of the patient's oral cavity. You can choose from gallery or use the camera.</p>
      <p class="view-desc-te">రోగి నోటి భాగం ఫోటోను అప్‌లోడ్ చేయండి. గ్యాలరీ నుండి ఎంచుకోవచ్చు లేదా కెమెరాతో తీసుకోవచ్చు.</p>
    </div>

    <form id="screen-form">
      <div class="upload-columns-grid">
        <!-- CARD 1: Choose Image Source -->
        <section class="upload-card">
          <div class="card-step-header">
            <div class="card-step-badge">1</div>
            <div>
              <h3>Choose Image Source</h3>
              <span class="card-sub-te">చిత్రం ఎంచుకునే మార్గం</span>
            </div>
          </div>

          <div class="source-buttons-row">
            <button type="button" class="source-select-btn" id="btn-source-camera">
              <span class="source-icon">${icon('camera', 22)}</span>
              <strong>Camera</strong>
              <span>Take a new photo</span>
              <small>కొత్త ఫోటో తీయండి</small>
            </button>
            <button type="button" class="source-select-btn" id="btn-source-gallery">
              <span class="source-icon">${icon('gallery', 22)}</span>
              <strong>Gallery</strong>
              <span>Select from gallery</span>
              <small>గ్యాలరీ నుండి ఎంచుకోండి</small>
            </button>
          </div>

          <div class="formats-info-row">
            <span class="formats-label">Supported formats</span>
            <div class="format-tags">
              <span class="fmt-pill">JPG</span>
              <span class="fmt-pill">PNG</span>
              <span class="fmt-pill">WEBP</span>
            </div>
            <span class="max-size-label">Max size: 10 MB</span>
          </div>

          <div class="drag-drop-zone" id="drop-zone">
            <span class="drop-cloud-icon">${icon('cloudUpload', 32)}</span>
            <p class="drop-main-text">Or drag and drop an image here</p>
            <p class="drop-te-text">లేదా ఇక్కడ ఫైల్‌ను డ్రాప్ చేయండి</p>
          </div>

          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" style="display:none;" aria-label="${t('capture')}">
          <input id="photo-camera" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" style="display:none;" aria-label="Camera capture">

          <div class="quick-intake-card">
            <div class="quick-intake-title">
              <span>Patient &amp; Consent / రోగి వివరాలు</span>
              <button type="button" class="btn" style="padding:2px 8px;font-size:10.5px;" data-assistant>${icon('spark', 12)} Saathi</button>
            </div>
            <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:8px;">
              <div class="field">
                <label for="name" style="font-size:11px;">${t('name')} *</label>
                <input id="name" name="name" required maxlength="100" autocomplete="off" placeholder="Demo Patient" style="padding:6px 10px;font-size:12px;">
              </div>
              <div class="field">
                <label for="age" style="font-size:11px;">${t('age')} *</label>
                <input id="age" name="age" type="number" min="1" max="120" required placeholder="42" style="padding:6px 10px;font-size:12px;">
              </div>
              <div class="field">
                <label for="village" style="font-size:11px;">${t('village')} *</label>
                <input id="village" name="village" maxlength="100" required list="villages" placeholder="Paderu" style="padding:6px 10px;font-size:12px;">
                <datalist id="villages"><option>Paderu</option><option>Araku</option><option>Hukumpeta</option><option>Chintapalle</option></datalist>
              </div>
              <div class="field">
                <label for="phone" style="font-size:11px;">${t('phone')}</label>
                <input id="phone" name="phone" type="tel" pattern="[0-9+ ()-]{7,20}" maxlength="20" placeholder="9876543210" style="padding:6px 10px;font-size:12px;">
              </div>
              <div class="field full">
                <label for="history" style="font-size:11px;">${t('history')}</label>
                <textarea id="history" name="history" maxlength="2000" rows="2" placeholder="${isTe ? 'లక్షణాలు, వ్యవధి, పొగాకు వాడకం…' : 'Symptoms, duration, tobacco history…'}" style="padding:6px 10px;font-size:12px;"></textarea>
              </div>
              <label class="checkbox full" style="font-size:11px;margin:2px 0;">
                <input type="checkbox" name="consent" required checked>
                <span>${t('consent')}</span>
              </label>
            </div>
          </div>
        </section>

        <!-- CARD 2: Image Preview -->
        <section class="upload-card">
          <div class="card-step-header">
            <div class="card-step-badge">2</div>
            <div>
              <h3>Image Preview</h3>
              <span class="card-sub-te">ఫోటో ప్రివ్యూ</span>
            </div>
          </div>

          <div class="preview-box-container">
            <div class="preview-image-wrapper">
              <div id="photo-result"><img id="preview-img-tag" class="preview" src="/oral_image_demo.jpg" alt="Oral Image Preview"></div>
              <button type="button" class="btn-clear-preview" id="btn-clear-photo" title="Reset image">✕</button>
            </div>
            <div class="preview-meta-row">
              <div>
                <strong class="file-name-text" id="preview-filename">oral_image_demo.jpg</strong>
                <span class="file-size-text" id="preview-filesize">2.4 MB · JPG</span>
              </div>
              <span class="preview-check-icon" id="preview-valid-badge">${icon('checkCircle', 20)}</span>
            </div>
          </div>

          <div class="preview-actions-row">
            <button type="button" class="btn-change-image" id="btn-change-image">
              ${icon('gallery', 16)} <span>Change Image</span>
            </button>
            <button type="button" class="btn-check-quality-action" id="btn-check-quality">
              ${icon('spark', 16)} <span>Check Quality</span>
            </button>
          </div>
        </section>

        <!-- CARD 3: Quality Check Result -->
        <section class="upload-card">
          <div class="card-step-header">
            <div class="card-step-badge">3</div>
            <div>
              <h3>Quality Check Result</h3>
              <span class="card-sub-te">నాణ్యత తనిఖీ ఫలితం</span>
            </div>
          </div>

          <div class="quality-status-badge quality-good" id="quality-status-banner">
            <span class="quality-status-icon">${icon('checkCircle', 28)}</span>
            <div class="quality-status-text">
              <strong id="quality-status-title">Image Quality: Good</strong>
              <span id="quality-status-te">చిత్ర నాణ్యత: మంచి</span>
            </div>
          </div>

          <ul class="quality-checklist" id="quality-checklist-items">
            <li>
              <span class="check-bullet">${icon('checkCircle', 16)}</span>
              <div class="check-text">
                <strong>Image is clear and focused</strong>
                <small>చిత్రం స్పష్టంగా ఉంది</small>
              </div>
            </li>
            <li>
              <span class="check-bullet">${icon('checkCircle', 16)}</span>
              <div class="check-text">
                <strong>Good lighting</strong>
                <small>వెలుతురు సరైనది</small>
              </div>
            </li>
            <li>
              <span class="check-bullet">${icon('checkCircle', 16)}</span>
              <div class="check-text">
                <strong>Resolution is good</strong>
                <small>రిజల్యూషన్ బాగుంది</small>
              </div>
            </li>
            <li>
              <span class="check-bullet">${icon('checkCircle', 16)}</span>
              <div class="check-text">
                <strong>Valid file format</strong>
                <small>సరైన ఫైల్ ఫార్మాట్</small>
              </div>
            </li>
          </ul>

          <div class="synthetic-info-notice">
            <span class="notice-info-icon">${icon('info', 18)}</span>
            <div class="notice-text">
              <p>This is a synthetic demo image. It is not a real patient record.</p>
              <small>ఇది కల్పిత డెమో చిత్రం. ఇది నిజమైన రోగి రికార్డు కాదు.</small>
            </div>
          </div>

          <button type="submit" class="btn-save-screening-action" id="save-screening-btn" aria-label="Save screening offline">
            ✓ Save screening offline
          </button>
        </section>
      </div>
    </form>

    <!-- BOTTOM ROW: Next Steps + Important Guidelines -->
    <div class="bottom-guidance-grid">
      <section class="next-steps-card">
        <div class="section-title-row">
          <span class="section-icon-circle">${icon('spark', 18)}</span>
          <div>
            <h4>Next Steps</h4>
            <span class="te-sub-heading">తదుపరి దశలు</span>
          </div>
        </div>

        <div class="stepper-horizontal-chain">
          <div class="step-chain-node step-completed">
            <div class="node-circle">
              ${icon('gallery', 18)}
              <span class="mini-check">✓</span>
            </div>
            <span class="node-title">1. Upload</span>
            <span class="node-te">ఆప్‌లోడ్</span>
          </div>
          <div class="step-connector active"></div>

          <div class="step-chain-node step-completed">
            <div class="node-circle">
              ${icon('checkCircle', 18)}
              <span class="mini-check">✓</span>
            </div>
            <span class="node-title">2. Quality Check</span>
            <span class="node-te">నాణ్యత తనిఖీ</span>
          </div>
          <div class="step-connector active"></div>

          <div class="step-chain-node step-current">
            <div class="node-circle">
              ${icon('brain', 18)}
            </div>
            <span class="node-title">3. AI Analysis</span>
            <span class="node-te">AI విశ్లేషణ</span>
          </div>
          <div class="step-connector"></div>

          <div class="step-chain-node step-pending">
            <div class="node-circle">
              ${icon('user', 18)}
            </div>
            <span class="node-title">4. Doctor Review</span>
            <span class="node-te">వైద్య సమీక్ష</span>
          </div>
          <div class="step-connector"></div>

          <div class="step-chain-node step-pending">
            <div class="node-circle">
              ${icon('patients', 18)}
            </div>
            <span class="node-title">5. Referral</span>
            <span class="node-te">రిఫరల్</span>
          </div>
          <div class="step-connector"></div>

          <div class="step-chain-node step-pending">
            <div class="node-circle">
              ${icon('calendar', 18)}
            </div>
            <span class="node-title">6. Follow-up</span>
            <span class="node-te">ఫాలో-అప్</span>
          </div>
        </div>
      </section>

      <section class="guidelines-card">
        <div class="section-title-row">
          <span class="section-icon-circle golden">${icon('bulb', 18)}</span>
          <div>
            <h4>Important Guidelines</h4>
            <span class="te-sub-heading">ముఖ్యమైన మార్గదర్శకాలు</span>
          </div>
        </div>

        <ul class="guidelines-bullets">
          <li>
            <strong>Use only synthetic or authorized test images.</strong>
            <small>కల్పిత లేదా అనుమతించబడిన పరీక్షా చిత్రాలను మాత్రమే వాడండి.</small>
          </li>
          <li>
            <strong>Do not upload real patient photos without consent.</strong>
            <small>సమ్మతి లేకుండా నిజమైన రోగుల ఫోటోలను అప్‌లోడ్ చేయవద్దు.</small>
          </li>
          <li>
            <strong>This is a research demo and not a medical diagnostic tool.</strong>
            <small>ఇది పరిశోధన డెమో మాత్రమే; ఇది వైద్య నిర్ధారణ సాధనం కాదు.</small>
          </li>
        </ul>
      </section>
    </div>
  </div>`;
}
function registry(){const isReview=view==='reviews';let list=patients.filter(p=>isReview?p.stage==='screened':true);return intro(t(view),isReview?(lang==='te'?'మానవ సమీక్ష కోసం స్క్రీనింగ్‌లు.':'Screenings awaiting human assessment. No automated diagnosis.'):(lang==='te'?'ప్రతి రోగి, ప్రతి తదుపరి అడుగు.':'One record. Every next step accounted for.'),true)+`<div class="toolbar"><input class="search" id="search" placeholder="${t('search')}" aria-label="${t('search')}"><select class="language" id="filter"><option value="all">${lang==='te'?'అన్ని దశలు':'All stages'}</option>${Object.keys(stages).map(k=>`<option value="${k}">${st(k)}</option>`).join('')}<option value="overdue">${t('overdue')}</option></select></div><section class="card" id="list">${table(list)}</section>`;}
function referralsQueue(){
  const isTe=lang==='te';
  let refList=referralsList;
  if(!refList||!refList.length){
    refList=patients.filter(p=>['referred','diagnostics','treatment'].includes(p.stage)).map(p=>({
      id:'REF-'+p.id,patientId:p.id,facility:p.facility||'Area Hospital Paderu',priority:p.priority||'routine',
      due_date:p.due||p.createdAt?.slice(0,10)||'',status:p.stage==='referred'?'referred':'scheduled',
      notes:p.notes||'',quadrant:p.quadrant||'GENERAL',
      patient:{id:p.id,name:p.name,village:p.village,phone:p.phone,age:p.age,photo:p.photo},
      isOverdue:overdue(p)
    }));
  }
  const total=refList.length,scheduledCount=refList.filter(r=>r.status==='scheduled').length,attendedCount=refList.filter(r=>r.status==='attended').length,overdueCount=refList.filter(r=>r.isOverdue).length;
  return intro(t('referrals'),isTe?'పాడేరు ఐటీడీఏ ఆసుపత్రులలో రెఫర్ చేసిన రోగుల సంరక్షణ పర్యవేక్షణ.':'Care coordination & follow-up across ITDA Paderu healthcare facilities.')+
    `<div class="stats">
      <div class="stat"><div class="stat-top">${isTe?'మొత్తం రెఫరల్స్':'Total Referrals'}<span class="stat-icon">↗</span></div><strong>${String(total).padStart(2,'0')}</strong><small>${isTe?'యాక్టివ్ కేసులు':'Active care cases'}</small></div>
      <div class="stat"><div class="stat-top">${isTe?'తేదీ నిర్ణయించబడింది':'Scheduled'}<span class="stat-icon">◷</span></div><strong>${String(scheduledCount).padStart(2,'0')}</strong><small>${isTe?'అపాయింట్‌మెంట్‌లు':'Appointments set'}</small></div>
      <div class="stat"><div class="stat-top">${isTe?'హాజరయ్యారు':'Attended'}<span class="stat-icon">🏥</span></div><strong>${String(attendedCount).padStart(2,'0')}</strong><small>${isTe?'ఆసుపత్రిలో పరిశీలించారు':'Facility evaluated'}</small></div>
      <div class="stat"><div class="stat-top">${isTe?'గడువు దాటినవి':'Overdue'}<span class="stat-icon">⚠</span></div><strong style="color:#c0392b;">${String(overdueCount).padStart(2,'0')}</strong><small>${isTe?'తక్షణ చర్య అవసరం':'Immediate attention'}</small></div>
    </div>
    <div class="toolbar">
      <input class="search" id="ref-search" placeholder="${isTe?'రోగి, ఐడీ లేదా గ్రామం వెతకండి…':'Search patient, ID, or village…'}" aria-label="Search referrals">
      <select class="language" id="ref-status-filter">
        <option value="all">${isTe?'అన్ని స్థితులు':'All Statuses'}</option>
        <option value="referred">${isTe?'రెఫర్ చేయబడింది':'Referred'}</option>
        <option value="scheduled">${isTe?'షెడ్యూల్ అయింది':'Scheduled'}</option>
        <option value="attended">${isTe?'హాజరయ్యారు':'Attended'}</option>
        <option value="completed">${isTe?'పూర్తయింది':'Completed'}</option>
        <option value="overdue">${isTe?'గడువు దాటినవి మాత్రమే':'Overdue Only'}</option>
      </select>
      <select class="language" id="ref-priority-filter">
        <option value="all">${isTe?'అన్ని ప్రాధాన్యతలు':'All Priorities'}</option>
        <option value="emergency">${isTe?'తక్షణ అత్యవసరం':'Emergency'}</option>
        <option value="urgent">${isTe?'అత్యవసరం (1-2 రోజులు)':'Urgent'}</option>
        <option value="routine">${isTe?'సాధారణ':'Routine'}</option>
      </select>
    </div>
    <section class="card" id="referrals-queue-list">
      ${renderReferralCards(refList,isTe)}
    </section>`;
}
function renderReferralCards(list,isTe){
  if(!list.length)return `<div class="empty">${t('empty')}</div>`;
  return `<div style="display:grid;gap:16px;">
    ${list.map(r=>{
      const p=r.patient||{};
      const priorityClass=r.priority==='emergency'?'red':r.priority==='urgent'?'amber':'';
      const priorityLabel=r.priority==='emergency'?(isTe?'తక్షణ అత్యవసరం':'Emergency'):r.priority==='urgent'?(isTe?'అత్యవసరం':'Urgent'):(isTe?'సాధారణ':'Routine');
      const statusLabel={referred:isTe?'రెఫర్ చేయబడింది':'Referred',scheduled:isTe?'తేదీ నిర్ణయించబడింది':'Scheduled',attended:isTe?'హాజరయ్యారు':'Attended',completed:isTe?'పూర్తయింది':'Completed',cancelled:isTe?'రద్దు':'Cancelled'}[r.status]||r.status;
      return `<div style="background:rgba(255,255,255,0.7);border:1px solid ${r.isOverdue?'#f5c6cb':'rgba(255,255,255,0.9)'};border-radius:14px;padding:18px;box-shadow:0 4px 15px rgba(0,0,0,0.03);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <strong style="font-size:15px;">${esc(p.name||'Patient')}</strong>
              <span class="pill ${priorityClass}">${priorityLabel}</span>
              <span class="pill ${r.isOverdue?'red':'amber'}">${statusLabel}</span>
              ${r.isOverdue?`<span class="pill red">⚠ ${isTe?'గడువు దాటింది':'Overdue'}</span>`:''}
            </div>
            <p class="sub" style="margin-top:5px;">
              ${esc(p.id||r.patientId)} · ${p.age?p.age+' '+(isTe?'సం.':'yrs'):''} · ${esc(p.village||'')}
              ${p.phone?` · <a href="tel:${esc(p.phone)}" style="color:var(--teal);font-weight:500;">📞 ${esc(p.phone)}</a>`:''}
            </p>
          </div>
          <button class="table-action" data-open="${esc(r.patientId||p.id)}">${t('open')} ↗</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin:14px 0;padding:12px;background:rgba(240,246,255,0.4);border-radius:10px;font-size:12px;">
          <div><span style="color:var(--muted);font-size:10px;text-transform:uppercase;display:block;">${isTe?'గమ్యస్థాన ఆసుపత్రి':'Destination Facility'}</span><strong>${esc(r.facility)}</strong></div>
          <div><span style="color:var(--muted);font-size:10px;text-transform:uppercase;display:block;">${isTe?'నోటి విభాగం':'Dental Quadrant'}</span><span>${esc(r.quadrant||'General')}</span></div>
          <div><span style="color:var(--muted);font-size:10px;text-transform:uppercase;display:block;">${isTe?'అపాయింట్‌మెంట్ గడువు':'Follow-up Due Date'}</span><strong style="${r.isOverdue?'color:#c0392b;':''}">${esc(r.due_date||'—')}</strong></div>
        </div>
        ${r.notes?`<p style="font-size:12px;margin:8px 0;color:#4a5c6d;"><em>${esc(r.notes)}</em></p>`:''}
        <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;align-items:center;">
          <span class="mini" style="margin-right:6px;">${isTe?'కార్యకర్త / నావిగేటర్ చర్య:':'Navigation Action:'}</span>
          ${r.status==='referred'?`<button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="scheduled">📅 ${isTe?'షెడ్యూల్ చేయండి':'Schedule'}</button><button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="attended">🏥 ${isTe?'హాజరయ్యారు':'Attended'}</button>`:''}
          ${r.status==='scheduled'?`<button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="attended">🏥 ${isTe?'హాజరయ్యారు':'Mark Attended'}</button>`:''}
          ${r.status==='attended'?`<button class="btn primary" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="completed">✓ ${isTe?'చికిత్స పూర్తయింది':'Mark Completed'}</button>`:''}
          ${['referred','scheduled'].includes(r.status)?`<button class="btn" style="padding:6px 12px;font-size:11px;color:#a95363;" data-ref-action="${esc(r.id)}" data-to-status="cancelled">✗ ${isTe?'రద్దు':'Cancel'}</button>`:''}
        </div>
      </div>`;
    }).join('')}
  </div>`;
}
function bindReferralsQueue(){
  document.querySelectorAll('[data-ref-action]').forEach(btn=>{
    btn.onclick=async()=>{
      const refId=btn.dataset.refAction,toStatus=btn.dataset.toStatus;btn.disabled=true;
      try{
        await updateReferral(refId,toStatus);
        toast(lang==='te'?`రెఫరల్ స్థితి ${toStatus} గా మార్చబడింది.`:`Referral status updated to ${toStatus}.`);
        await refresh();render();
      }catch(err){toast(err.message);btn.disabled=false;}
    };
  });
  const searchEl=$('#ref-search'),statusEl=$('#ref-status-filter'),priorityEl=$('#ref-priority-filter');
  const filterQueue=()=>{
    const q=(searchEl?.value||'').toLowerCase(),stVal=statusEl?.value||'all',prVal=priorityEl?.value||'all';
    let list=referralsList.length?referralsList:patients.filter(p=>['referred','diagnostics','treatment'].includes(p.stage)).map(p=>({
      id:'REF-'+p.id,patientId:p.id,facility:p.facility||'Area Hospital Paderu',priority:p.priority||'routine',
      due_date:p.due||'',status:p.stage==='referred'?'referred':'scheduled',
      notes:p.notes||'',quadrant:p.quadrant||'GENERAL',
      patient:{id:p.id,name:p.name,village:p.village,phone:p.phone,age:p.age},
      isOverdue:overdue(p)
    }));
    const filtered=list.filter(r=>{
      const p=r.patient||{};
      const matchText=`${p.name||''} ${p.id||r.patientId} ${p.village||''} ${r.facility||''}`.toLowerCase().includes(q);
      const matchStatus=stVal==='all'||(stVal==='overdue'?r.isOverdue:r.status===stVal);
      const matchPriority=prVal==='all'||r.priority===prVal;
      return matchText&&matchStatus&&matchPriority;
    });
    const host=$('#referrals-queue-list');
    if(host){host.innerHTML=renderReferralCards(filtered,lang==='te');bindReferralsQueue();bindCommon();}
  };
  if(searchEl)searchEl.oninput=filterQueue;
  if(statusEl)statusEl.onchange=filterQueue;
  if(priorityEl)priorityEl.onchange=filterQueue;
}
function record(){const p=patients.find(p=>p.id===selected);if(!p)return intro(t('empty'));const canReview=role==='doctor'&&Boolean(p.version)&&navigator.onLine;return `<button class="btn" data-go="patients">← ${t('back')}</button><div style="height:22px"></div><div class="record-top"><div class="avatar">${esc(p.name.slice(0,1))}</div><div><h1>${esc(p.name)}</h1><p class="sub">${esc(p.id)} · ${p.age} ${lang==='te'?'సంవత్సరాలు':'years'} · ${esc(p.village)}</p></div><span class="pill" style="margin-left:auto">${st(p.stage)}</span></div><p class="mini">${p._sync==='pending'?(lang==='te'?'పరికరంలో మాత్రమే · అప్‌లోడ్ పెండింగ్':'On this device only · upload pending'):(lang==='te'?'భాగస్వామ్య రికార్డు':'Shared patient record')} · ${lang==='te'?'వెర్షన్':'Version'} ${p.version||'—'}</p><button class="btn" id="refresh-record">↻ ${lang==='te'?'భాగస్వామ్య రికార్డు రిఫ్రెష్':'Refresh shared record'}</button><div class="flow">${Object.keys(stages).map((k,i)=>`<div class="${i<=Object.keys(stages).indexOf(p.stage)?'done':''}"><b>${i+1}</b>${st(k)}</div>`).join('')}</div><div class="columns"><div><section class="card"><h2>${t('photo')}</h2><div style="margin:18px 0">${p.photo?`<img class="preview" src="${esc(p.photo)}" alt="Submitted demonstration oral photograph">`:`<div class="empty">${lang==='te'?'ఫోటో ఇంకా జోడించలేదు':'Photo pending — no image assessment available'}</div>`}</div><span class="pill ${p.quality?.pass?'':'amber'}">${p.photo?(p.quality?.pass?(lang==='te'?'ప్రాథమిక నాణ్యత పరీక్ష ఉత్తీర్ణం':'Basic image-quality check passed'):(lang==='te'?'మెరుగైన ఫోటో అవసరం':'Retake recommended')):(lang==='te'?'ఫోటో పెండింగ్':'Photo pending')}</span><p class="mini">${lang==='te'?'ఈ పరీక్ష కేవలం వెలుతురు, కాంట్రాస్ట్, వివరాలను కొలుస్తుంది.':'Checks measure lighting, contrast and pixel detail only. They do not validate image anatomy.'}</p></section>${researchMarkup(p,lang)}<section class="card"><h2>${t('history')}</h2><p>${esc(p.history||'—')}</p><p class="mini">${lang==='te'?'పరికర నిల్వ అనుమతి నమోదు అయింది':'Device-storage consent recorded'} · ${esc(p.createdAt.slice(0,10))}</p></section></div><div><section class="card"><h2>${t('review')}</h2><p class="mini">${lang==='te'?'వైద్యుని ఖాతాకు మాత్రమే సమీక్ష అనుమతి. భాగస్వామ్య సర్వర్ కనెక్షన్ అవసరం.':'Only a signed-in doctor can review. A shared-server connection is required.'}</p>${!canReview?`<div class="notice">${lang==='te'?'వైద్యునిగా లాగిన్ అయి సర్వర్‌కు కనెక్ట్ అవ్వండి. ముందుగా స్క్రీనింగ్‌ను అప్‌లోడ్ చేయండి.':'Sign in with a doctor account and connect to the server. The screening must be uploaded first.'}</div>`:''}<form id="review-form"><div class="field"><label for="quadrant">${lang==='te'?'నోటి భాగం / క్వాడ్రంట్':'Oral Quadrant / Region'}</label><select id="quadrant" name="quadrant" ${!canReview?'disabled':''}><option value="GENERAL" ${p.quadrant==='GENERAL'?'selected':''}>${lang==='te'?'సాధారణ నోటి పరీక్ష':'General Oral Cavity'}</option><option value="Q1_UR" ${p.quadrant==='Q1_UR'?'selected':''}>${lang==='te'?'ఎగువ కుడి (Q1, దంతాలు 11-18)':'Upper Right (Q1 Maxillary, 11-18)'}</option><option value="Q2_UL" ${p.quadrant==='Q2_UL'?'selected':''}>${lang==='te'?'ఎగువ ఎడమ (Q2, దంతాలు 21-28)':'Upper Left (Q2 Maxillary, 21-28)'}</option><option value="Q3_LL" ${p.quadrant==='Q3_LL'?'selected':''}>${lang==='te'?'దిగువ ఎడమ (Q3, దంతాలు 31-38)':'Lower Left (Q3 Mandibular, 31-38)'}</option><option value="Q4_LR" ${p.quadrant==='Q4_LR'?'selected':''}>${lang==='te'?'దిగువ కుడి (Q4, దంతాలు 41-48)':'Lower Right (Q4 Mandibular, 41-48)'}</option><option value="MUCOSA" ${p.quadrant==='MUCOSA'?'selected':''}>${lang==='te'?'నోటి శ్లేష్మం / నాలుక / పెదవి':'Oral Mucosa / Tongue / Lip'}</option></select></div><div class="field"><label for="provisionalDiagnosis">${lang==='te'?'ప్రాథమిక రోగ నిర్ధారణ':'Provisional Clinical Impression'}</label><input id="provisionalDiagnosis" name="provisionalDiagnosis" maxlength="200" value="${esc(p.provisionalDiagnosis||'')}" placeholder="${lang==='te'?'ఉదా. ల్యూకోప్లాకియా అనుమానం, కేరీస్ Q1':'e.g. Suspected leukoplakia, Dental caries Q1'}" ${!canReview?'disabled':''}></div><div class="field"><label for="notes">${t('notes')} *</label><textarea id="notes" name="notes" required maxlength="4000" ${!canReview?'disabled':''}>${esc(p.notes||'')}</textarea></div><div class="field"><label for="stage">${t('stage')}</label><select id="stage" name="stage" ${!canReview?'disabled':''}>${Object.keys(stages).filter(k=>k!=='screened').map(k=>`<option value="${k}" ${k===p.stage?'selected':''}>${st(k)}</option>`).join('')}</select></div><div class="field"><label for="facility">${t('facility')}</label><input id="facility" name="facility" maxlength="150" value="${esc(p.facility||'')}" list="facilities-list" ${!canReview?'disabled':''}><datalist id="facilities-list"><option>Area Hospital Paderu</option><option>Community Health Centre Araku</option><option>CHC Chintapalle</option><option>Primary Health Centre Hukumpeta</option><option>ITDA Mobile Dental Screening Unit</option><option>King George Hospital Visakhapatnam (Tertiary)</option></datalist></div><div class="field"><label for="priority">${lang==='te'?'రెఫరల్ ప్రాధాన్యత':'Referral Priority'}</label><select id="priority" name="priority" ${!canReview?'disabled':''}><option value="routine" ${p.priority==='routine'?'selected':''}>${lang==='te'?'సాధారణ (Routine)':'Routine'}</option><option value="urgent" ${p.priority==='urgent'?'selected':''}>${lang==='te'?'అత్యవసరం (Urgent - 1-2 days)':'Urgent (1-2 days)'}</option><option value="emergency" ${p.priority==='emergency'?'selected':''}>${lang==='te'?'తక్షణ అత్యవసరం (Emergency)':'Emergency (Immediate)'}</option></select></div><div class="field"><label for="due">${t('due')}</label><input id="due" name="due" type="date" value="${esc(p.due||'')}" ${!canReview?'disabled':''}></div><div class="actions"><button class="btn primary" ${!canReview?'disabled':''}>${lang==='te'?'సమీక్ష సేవ్ చేయండి':'Save review & next step'}</button></div></form></section><section class="card"><h2>${lang==='te'?'సంరక్షణ చరిత్ర':'Care timeline'}</h2><div class="timeline">${[...(p.timeline||[])].reverse().map(e=>`<p>${esc(lang==='te'?e.te:e.text)}<small>${new Date(e.at).toLocaleString(lang==='te'?'te-IN':'en-IN')}</small></p>`).join('')}</div></section></div></div>${careMarkup(p,lang)}${voiceMarkup(p,lang)}${consultationMarkup(lang)}`;}
function district(){return intro(t('district'),lang==='te'?'స్క్రీనింగ్ మరియు సంరక్షణ లోపాలపై దృష్టి.':'Visibility into screening activity and gaps in care.')+stats()+`<section class="card"><h2>${lang==='te'?'పరీక్షలు మరియు చికిత్స పురోగతి':'Diagnostics and treatment activity'}</h2><div class="stats">${[['diagnostic',lang==='te'?'పరీక్షలు / బయాప్సీ':'Diagnostics / biopsy'],['treatment',lang==='te'?'చికిత్స':'Treatment'],['followup',lang==='te'?'ఫాలో-అప్':'Follow-up']].map(([type,label])=>{const entries=patients.flatMap(p=>p.careEntries||[]).filter(e=>e.type===type);return `<div class="stat"><span>${label}</span><strong>${entries.filter(e=>e.status==='completed').length}</strong><small>${lang==='te'?'పూర్తి':'completed'} · ${entries.filter(e=>e.status==='planned').length} ${lang==='te'?'ప్రణాళిక':'planned'} · ${entries.filter(e=>e.status==='missed').length} ${lang==='te'?'హాజరు కాలేదు':'missed'}</small></div>`;}).join('')}</div></section><div class="columns"><section class="card"><h2>${lang==='te'?'గ్రామాల వారీగా నమోదులు':'Registration coverage by village'}</h2>${villageBars()}<div class="notice">${lang==='te'?'ఈ గణాంకాలు కల్పిత రికార్డుల సంఖ్యలు మాత్రమే. జనాభా కవరేజ్ లేదా వ్యాధి రేట్లు కావు.':'Counts reflect synthetic records on this browser. Population coverage and disease rates cannot be inferred.'}</div></section><section class="card"><h2>${lang==='te'?'సంరక్షణ దశల పంపిణీ':'Care pipeline'}</h2>${Object.keys(stages).map(k=>{const n=patients.filter(p=>p.stage===k).length;return `<div class="bar-row"><span>${st(k)}</span><div class="bar"><i style="width:${n/Math.max(1,patients.length)*100}%"></i></div><b>${n}</b></div>`;}).join('')}</section></div><section class="card"><h2>${t('overdue')}</h2>${table(patients.filter(p=>overdue(p)))}</section>`;}
function settings(){return intro(t('settings'),lang==='te'?'భాగస్వామ్య రికార్డులు, ఆఫ్‌లైన్ అప్‌లోడ్‌లు మరియు n8n.':'Shared records, offline uploads and local n8n automation.')+`<div class="columns"><div><section class="card"><h2>${lang==='te'?'భాగస్వామ్య రోగి డేటాబేస్':'Shared patient database'}</h2><p>${lang==='te'?'ఆరోగ్య కార్యకర్త మరియు వైద్యుడు ఒకే సర్వర్ డేటాబేస్‌ను ఉపయోగిస్తారు. ఆఫ్‌లైన్ స్క్రీనింగ్‌లు ఈ ఖాతా పరికర నిల్వలో వేచి ఉంటాయి.':'Workers and doctors use the same server database. Offline screenings wait in this account’s device cache until uploaded.'}</p><div class="flow"><div class="done"><b>${patients.filter(p=>p._sync==='shared').length}</b>${lang==='te'?'భాగస్వామ్య రికార్డులు':'Shared records'}</div><div><b>${events.length}</b>${lang==='te'?'అప్‌లోడ్ పెండింగ్':'Device uploads pending'}</div></div><button class="btn primary" id="sync">↻ ${lang==='te'?'రికార్డులు & n8n సింక్':'Sync records & n8n'}</button><p class="mini">${lang==='te'?'సర్వర్ సింక్ చేసిన రికార్డులనే వైద్యుడు చూడగలరు.':'Doctors can see a screening after it reaches the shared server. Offline review edits are disabled to prevent conflicting clinical changes.'}</p></section><section class="card"><h2>n8n · ${automation.configured?(lang==='te'?'అమర్చబడింది':'Configured'):(lang==='te'?'అనుసంధానం పెండింగ్':'Connection pending')}</h2><p>${lang==='te'?'పేరు, ఫోన్, ఫోటోలు లేకుండా ఈవెంట్‌లు n8nకు పంపబడతాయి.':'The server delivers events without names, phone numbers, histories or photos. n8n calls back with a receipt; duplicate receipts are ignored.'}</p><div class="flow"><div><b>${automation.pending||0}</b>${lang==='te'?'n8n పెండింగ్':'n8n pending'}</div><div class="done"><b>${automation.receipts||0}</b>${lang==='te'?'n8n రసీదులు':'n8n receipts'}</div></div><p class="mini">${lang==='te'?'రసీదు అనేది ఈవెంట్ స్వీకరణ మాత్రమే; రోగికి సందేశం చేరినట్టు కాదు.':'A receipt confirms workflow intake, not delivery of a message to a person.'}</p></section><section class="card"><h2>${lang==='te'?'పరికర బ్యాకప్':'Device backup'}</h2><div class="actions"><button class="btn" id="export">↓ ${lang==='te'?'బ్యాకప్ ఎగుమతి':'Export backup'}</button>${role==='worker'?`<label class="btn">↑ ${lang==='te'?'స్క్రీనింగ్‌ల దిగుమతి':'Import screenings'}<input id="import" type="file" accept="application/json" hidden></label><button class="btn" id="legacy-import">${lang==='te'?'మునుపటి పరికర రికార్డుల దిగుమతి':'Import previous device records'}</button><button class="btn" id="seed">${lang==='te'?'కల్పిత ఉదాహరణలు':'Add synthetic examples'}</button>`:''}</div><p class="mini">${lang==='te'?'దిగుమతి చేసిన కొత్త స్క్రీనింగ్‌లు సమీక్ష కోసం వేచి ఉంటాయి. పాత రికార్డులు భద్రంగా ఉంటాయి.':'New imported screenings are queued for review. Existing records are preserved; imported clinical decisions are not trusted.'}</p><p class="mini" id="storage-status"></p><div class="notice">${lang==='te'?'స్థానిక ప్రదర్శన మాత్రమే. పరికర నిల్వ ఎన్క్రిప్ట్ చేయబడలేదు; నిజమైన రోగి డేటాను ఉపయోగించవద్దు.':'Local synthetic demonstration. Device cache is not encrypted; do not use real patient information.'}</div></section></div><section class="card"><h2>${lang==='te'?'సర్వర్ ఆటోమేషన్ క్యూలో':'Server automation outbox'}</h2>${automation.events?.length?`<div class="table-wrap"><table><thead><tr><th>Event</th><th>Status</th></tr></thead><tbody>${automation.events.map(e=>`<tr><td><strong>${esc(e.type)}</strong><small>${esc(e.patientId)}</small></td><td><span class="pill ${e.deliveredAt?'':'amber'}">${e.deliveredAt?(lang==='te'?'అంగీకరించబడింది':'Accepted'):(lang==='te'?'పెండింగ్':'Queued')}</span>${e.lastError?`<small>${esc(e.lastError)}</small>`:''}</td></tr>`).join('')}</tbody></table></div>`:`<p class="sub">${t('empty')}</p>`}</section></div>`;}
function bindCommon(){document.querySelectorAll('[data-assistant]').forEach(b=>b.onclick=openIntake);document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>navigate('screening'));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>navigate('record',b.dataset.open));}
function render(){document.body.dataset.role=role;shell();updateSyncDrawer();const pages={dashboard,screening,patients:registry,reviews:registry,referrals:referralsQueue,record,district,settings,team:()=>teamMarkup(lang)};$('#content').innerHTML=pages[view]()+`<footer class="footer"><span>AAROGYA DRISHTI · AAROHAN 2026</span><span>${t('demo')} · ${lang==='te'?'వైద్య వినియోగానికి కాదు':'Not for clinical use'} · v0.3</span></footer>`;bindCommon();if($('#screen-form'))bindScreen();if($('#review-form'))bindReview();if(view==='referrals')bindReferralsQueue();if($('#refresh-record'))$('#refresh-record').onclick=async()=>{try{await syncRecords();await refresh();render();}catch(error){toast(error.message);}};if($('#search')){$('#search').oninput=filterTable;$('#filter').onchange=filterTable;}if(view==='settings')bindSettings();if(view==='team')mountTeam(lang);mountAssistant({lang,scope:currentIdentity().instanceId+'-'+currentIdentity().user.id,worker:role==='worker',view,goScreening:()=>navigate('screening')});if(view==='record'){const p=patients.find(p=>p.id===selected),saved=async()=>{await refresh();render();};mountConsultations(p,lang);mountVoice(p,lang);mountResearch(p,lang,saved);mountCare(p,lang,saved);}}
function filterTable(){const q=$('#search').value.toLowerCase(),stage=$('#filter').value;const list=patients.filter(p=>(view==='reviews'?p.stage==='screened':true)&&`${p.name} ${p.id} ${p.village}`.toLowerCase().includes(q)&&(stage==='all'||(stage==='overdue'?overdue(p):p.stage===stage)));$('#list').innerHTML=table(list);bindCommon();}
async function readPhoto(file){if(!file)return;if(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(lang==='te'?'8 MB లోపు JPEG, PNG లేదా WebP ఎంచుకోండి.':'Choose a JPEG, PNG or WebP under 8 MB.');const bitmap=await createImageBitmap(file);if(bitmap.width<200||bitmap.height<200){bitmap.close();throw Error(lang==='te'?'చిత్రం చాలా చిన్నది. కనీసం 200 × 200 అవసరం.':'Image too small. Minimum 200 × 200 pixels.');}const canvas=document.createElement('canvas');const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();photo=canvas.toDataURL('image/jpeg',.8);const small=document.createElement('canvas');small.width=160;small.height=160;const sctx=small.getContext('2d',{willReadFrequently:true});sctx.drawImage(canvas,0,0,160,160);quality=qualityMetrics(sctx.getImageData(0,0,160,160).data,160,160);return {photo,quality};}
function bindScreen(){
  const fileInput = $('#photo');
  const cameraInput = $('#photo-camera');
  const dropZone = $('#drop-zone');
  const filenameEl = $('#preview-filename');
  const filesizeEl = $('#preview-filesize');
  const statusBanner = $('#quality-status-banner');
  const statusTitle = $('#quality-status-title');
  const statusTe = $('#quality-status-te');

  const handleSelectedFile = async (file) => {
    if (!file) return;
    photo = null;
    quality = null;
    try {
      const result = await readPhoto(file);
      if (!result) return;
      $('#photo-result').innerHTML = `<img id="preview-img-tag" class="preview" src="${photo}" alt="Selected photograph">`;
      if (filenameEl) filenameEl.textContent = file.name || 'captured_photo.jpg';
      if (filesizeEl) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const ext = (file.type ? file.type.split('/')[1] : 'jpg').toUpperCase();
        filesizeEl.textContent = `${sizeMb} MB · ${ext}`;
      }
      if (statusBanner) {
        statusBanner.className = `quality-status-badge ${quality.pass ? 'quality-good' : 'quality-warning'}`;
        if (statusTitle) statusTitle.textContent = quality.pass ? 'Image Quality: Good' : 'Retake Recommended';
        if (statusTe) statusTe.textContent = quality.pass ? 'చిత్ర నాణ్యత: మంచి' : 'మళ్లీ తీయండి: వెలుతురు మెరుగుపరచండి';
      }
      toast(lang === 'te' ? 'చిత్రం విశ్లేషించబడింది, నాణ్యత తనిఖీ పూర్తయింది.' : 'Image loaded & quality checked.');
    } catch (err) {
      toast(err.message);
    }
  };

  if (fileInput) fileInput.onchange = e => handleSelectedFile(e.target.files[0]);
  if (cameraInput) cameraInput.onchange = e => handleSelectedFile(e.target.files[0]);

  const btnCamera = $('#btn-source-camera');
  if (btnCamera) btnCamera.onclick = () => (cameraInput || fileInput)?.click();

  const btnGallery = $('#btn-source-gallery');
  if (btnGallery) btnGallery.onclick = () => fileInput?.click();

  const btnChange = $('#btn-change-image');
  if (btnChange) btnChange.onclick = () => fileInput?.click();

  const btnClear = $('#btn-clear-photo');
  if (btnClear) btnClear.onclick = () => {
    photo = null;
    quality = null;
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
    $('#photo-result').innerHTML = `<img id="preview-img-tag" class="preview" src="/oral_image_demo.jpg" alt="Oral Image Preview">`;
    if (filenameEl) filenameEl.textContent = 'oral_image_demo.jpg';
    if (filesizeEl) filesizeEl.textContent = '2.4 MB · JPG';
    if (statusBanner) {
      statusBanner.className = 'quality-status-badge quality-good';
      if (statusTitle) statusTitle.textContent = 'Image Quality: Good';
      if (statusTe) statusTe.textContent = 'చిత్ర నాణ్యత: మంచి';
    }
    toast(lang === 'te' ? 'చిత్రం రీసెట్ చేయబడింది.' : 'Preview reset to demo image.');
  };

  const btnQuality = $('#btn-check-quality');
  if (btnQuality) btnQuality.onclick = () => {
    toast(lang === 'te' ? '✓ నాణ్యత ప్రమాణాలు సరిపోయాయి (స్పష్టత, కాంట్రాస్ట్, వెలుతురు).' : '✓ Quality check passed: Focus, lighting and contrast verified.');
  };

  if (dropZone) {
    ['dragenter', 'dragover'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#059669';
        dropZone.style.background = '#e6f7ef';
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      dropZone.addEventListener(name, (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#b7d6c8';
        dropZone.style.background = '#f7faf8';
      });
    });
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) handleSelectedFile(files[0]);
    });
  }

  $('#screen-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const now = new Date().toISOString();
    const p = {
      id: 'AD-' + crypto.randomUUID().slice(0, 8).toUpperCase(),
      name: form.get('name').trim(),
      age: Number(form.get('age')),
      village: form.get('village').trim(),
      phone: form.get('phone').trim(),
      history: form.get('history').trim(),
      consent: true,
      createdAt: now,
      stage: 'screened',
      photo,
      quality,
      timeline: [{
        at: now,
        text: 'Screening saved on device; clinical review pending.',
        te: 'స్క్రీనింగ్ పరికరంలో సేవ్ అయింది; వైద్య సమీక్ష పెండింగ్.'
      }]
    };
    if (!p.name || !p.village) return toast('Please complete the required fields.');
    try {
      await persist(p, 'screening.created');
      resetIntake();
      navigate('record', p.id);
      toast(lang === 'te' ? 'స్క్రీనింగ్ సేవ్ అయింది.' : 'Screening saved. Shared status is shown above the record.');
    } catch {
      toast('Storage failed. Record was not saved. Check available device space.');
    }
  };
}
function bindReview(){const reviewSnapshot=structuredClone(patients.find(p=>p.id===selected));$('#review-form').onsubmit=async e=>{e.preventDefault();if(role!=='doctor'||!navigator.onLine)return toast('Clinical reviews require a server connection.');const form=new FormData(e.target),p=structuredClone(reviewSnapshot);const next=form.get('stage'),facility=form.get('facility').trim(),due=form.get('due');if(['referred','diagnostics','treatment'].includes(next)&&(!facility||!due))return toast(lang==='te'?'ఆసుపత్రి మరియు తదుపరి తేదీ అవసరం.':'Facility and next appointment date are required for ongoing referrals.');p.stage=next;p.notes=form.get('notes').trim();p.facility=facility;p.due=next==='closed'?'':due;p.quadrant=form.get('quadrant')||'GENERAL';p.provisionalDiagnosis=form.get('provisionalDiagnosis')?.trim()||'';p.priority=form.get('priority')||'routine';try{await persist(p,next==='referred'?'referral.created':'review.completed');render();toast(lang==='te'?'సమీక్ష మరియు రెఫరల్ సేవ్ అయ్యాయి.':'Review and referral saved.');}catch(error){toast(error.message);}};}
let syncing=false;
async function sync(){if(syncing)return;syncing=true;try{const result=await syncRecords();await refresh();try{await api('/api/automation/sync',{method:'POST',data:{}});}catch(error){toast(error.message);}automation=await api('/api/automation/status');render();toast(lang==='te'?`${result.uploaded||0} రికార్డులు అప్‌లోడ్ అయ్యాయి; ${automation.pending} n8n పెండింగ్.`:`${result.uploaded||0} records uploaded; ${automation.pending} n8n events pending.`);}catch(error){toast(error.message);}finally{syncing=false;}}
async function importScreenings(rows){
 if(!Array.isArray(rows)||rows.length>1000)throw Error('Invalid backup.');
 for(const p of rows)if(typeof p.id!=='string'||!/^AD-[A-Za-z0-9-]+$/.test(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||typeof p.village!=='string'||!p.village.trim()||p.village.length>100||!Number.isInteger(p.age)||p.age<1||p.age>120||p.consent!==true||(p.photo&&(typeof p.photo!=='string'||p.photo.length>2800000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo))))throw Error('Invalid screening or missing consent in backup.');
 let added=0;for(const p of rows)if(!patients.some(existing=>existing.id===p.id)){await createScreening({id:p.id,name:p.name,age:p.age,village:p.village,phone:String(p.phone||'').slice(0,20),history:String(p.history||'').slice(0,2000),photo:p.photo||null,quality:p.quality,consent:true,stage:'screened',notes:'',facility:'',due:'',createdAt:new Date().toISOString(),timeline:[]});added++;}await refresh();return added;
}
function bindSettings(){
 if($('#legacy-import'))$('#legacy-import').onclick=async()=>{try{if(indexedDB.databases&&!((await indexedDB.databases()).some(d=>d.name==='drishti-demo')))return toast('No previous v0.1 device records found in this browser.');const legacy=await new Promise((resolve,reject)=>{const request=indexedDB.open('drishti-demo');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});if(!legacy.objectStoreNames.contains('patients')){legacy.close();return toast('No previous records found.');}const rows=await new Promise((resolve,reject)=>{const request=legacy.transaction('patients','readonly').objectStore('patients').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});legacy.close();const count=await importScreenings(rows);render();toast(`${count} previous screenings imported. Original records preserved. Sync to share.`);}catch(error){toast(error.message);}};
 $('#sync').onclick=sync;
 if($('#seed'))$('#seed').onclick=async()=>{await seed();await refresh();render();toast(lang==='te'?'కల్పిత స్క్రీనింగ్‌లు పరికరంలో సేవ్ అయ్యాయి. సింక్ చేయండి.':'Synthetic screenings saved on device. Sync to share them.');};
 $('#export').onclick=()=>{const blob=new Blob([JSON.stringify({schema:2,exportedAt:new Date().toISOString(),patients},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='drishti-demo-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 if($('#import'))$('#import').onchange=async e=>{try{const f=e.target.files[0];if(!f)return;if(f.size>25*1024*1024)throw Error('Backup too large.');const data=JSON.parse(await f.text());if(![1,2].includes(data.schema)||!Array.isArray(data.patients)||data.patients.length>1000)throw Error('Invalid backup.');for(const p of data.patients){if(typeof p.id!=='string'||!/^AD-[A-Za-z0-9-]+$/.test(p.id)||typeof p.name!=='string'||typeof p.village!=='string'||!Number.isInteger(p.age)||p.age<1||p.age>120||(p.photo&&!/^data:image\/(jpeg|png|webp);base64,/.test(p.photo)))throw Error('Invalid patient in backup.');}for(const p of data.patients)if(!patients.some(existing=>existing.id===p.id)){await createScreening({...p,stage:'screened',notes:'',facility:'',due:'',version:undefined,timeline:[],consent:p.consent===true});}await refresh();render();toast('Imported new screenings; existing records preserved. Sync to share.');}catch(error){toast(error.message||'Invalid backup.');}};
 if(navigator.storage?.estimate)navigator.storage.estimate().then(s=>{if($('#storage-status'))$('#storage-status').textContent=`Device storage: ${((s.usage||0)/1048576).toFixed(1)} MB used`;});
}
async function seed(){for(const [i,village] of ['Paderu','Araku','Hukumpeta'].entries()){const id='AD-DEMO-SHARED-'+(i+1);if(patients.some(p=>p.id===id))continue;await createScreening({id,name:['Demo Lakshmi','Demo Ravi','Demo Sita'][i],village,age:35+i*5,phone:'',history:'Synthetic screening history for workflow demonstration.',consent:true,stage:'screened',photo:null,createdAt:new Date().toISOString(),timeline:[]});}}
function showLogin(){hideAssistant();forgetSession();document.documentElement.lang=lang;$('#app').innerHTML=loginMarkup(lang);$('#login-lang').onclick=()=>{lang=lang==='en'?'te':'en';localStorage.setItem('drishti-lang',lang);showLogin();};if($('#native-server')){$('#native-server').onclick=configureServer;mountNativeConnection(lang);}document.querySelectorAll('.demo-acc-btn').forEach(b=>{b.onclick=()=>{if($('#email'))$('#email').value=b.dataset.email;if($('#password'))$('#password').value=b.dataset.pass;if($('#login-error'))$('#login-error').textContent='';};});const togglePwd=$('#toggle-pwd');if(togglePwd){togglePwd.onclick=()=>{const pwd=$('#password');if(pwd)pwd.type=pwd.type==='password'?'text':'password';};}$('#login-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button[type=submit]');button.disabled=true;$('#login-error').textContent='';try{await login($('#email').value,$('#password').value);await enterWorkspace();}catch(error){$('#login-error').textContent=error.message;button.disabled=false;}};}
async function enterWorkspace(){role=currentIdentity().user.role;await openCache();await refresh();try{await syncRecords();automation=await api('/api/automation/status');await refresh();}catch(error){if(error.status===401)return showLogin();toast(error.message);}view='dashboard';render();}
async function pollShared(){if(!currentIdentity()||!navigator.onLine)return;try{await syncRecords();await refresh();automation=await api('/api/automation/status');if(!['screening','record','team'].includes(view))render();}catch(error){if(error.status===401){patients=[];events=[];showLogin();}}}
async function boot(){if(!isAndroid()&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});await initI18n();const identity=await recoverSession();if(identity)await enterWorkspace();else showLogin();window.addEventListener('online',()=>{if(currentIdentity()){updateConnection();pollShared();}});window.addEventListener('offline',()=>{if(currentIdentity()){updateConnection();toast(t('offline'));}});setInterval(()=>{if(currentIdentity()?.expires<Date.now()){patients=[];events=[];showLogin();return;}if(!['screening','record','team'].includes(view))pollShared();},20000);}
boot().catch(()=>{$('#app').innerHTML='<main class="content"><h1>Device storage unavailable</h1><p>Enable browser storage and reload.</p></main>';});
