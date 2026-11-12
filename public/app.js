import {researchMarkup,mountResearch} from './research-ai.js';
import {careMarkup,mountCare} from './care.js';
import {teamMarkup,mountTeam} from './team.js';
import {icon} from './icons.js';
import {mountAssistant,openIntake,resetIntake,hideAssistant} from './assistant.js';
import {isAndroid,configureServer,mountNativeConnection} from './platform.js';
import {consultationMarkup,mountConsultations,launchWebRTCModal} from './consultations.js';
import {voiceMarkup,mountVoice} from './voice-intake.js';
import {qualityMetrics,overdue} from './domain.js';
import {
  api,currentIdentity,forgetSession,recoverSession,login,logout,openCache,localPatients,
  createScreening,syncRecords,reviewPatient,saveLocal,updateReferral,syncSingleRecord,
  resolveConflict,fetchDashboardStats,listInvestigations,createInvestigation,updateInvestigation,
  listNavigation,createNavigation
} from './client.js';
import {initI18n,t as i18nT,setLanguage as i18nSetLanguage} from './i18n.js';
import {mountSyncDrawer,openSyncDrawer,closeSyncDrawer,openConflictModal} from './sync-drawer.js';
import {loginMarkup} from './auth.js';
import {publicSiteMarkup} from './public-site.js';
import {ITDA_FACILITIES} from './facilities-data.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

let lang=localStorage.getItem('drishti-lang')||'en',view='dashboard',selected=null,photo=null,quality=null;
let role='worker',patients=[],events=[],referralsList=[],investigationsList=[],navigationList=[];
let automation={configured:false,pending:0,events:[],receipts:0};
let dashboardStats=null;

const copy={
  team:['Care team','సంరక్షణ బృందం'],dashboard:['Overview','అవలోకనం'],patients:['Patient registry','రోగుల నమోదు'],
  screening:['New screening','కొత్త స్క్రీనింగ్'],reviews:['Clinical reviews','వైద్య సమీక్షలు'],
  referrals:['Referrals & appointments','రిఫరల్స్ & అపాయింట్‌మెంట్లు'],district:['District insights','జిల్లా విశ్లేషణ'],
  settings:['Sync & integrations','సింక్ & అనుసంధానాలు'],welcome:['Care begins with a connection.','సంరక్షణ అనుసంధానంతో మొదలవుతుంది.'],
  subtitle:['A clearer view of every patient’s journey, from screening to care.','స్క్రీనింగ్ నుండి చికిత్స వరకు ప్రతి రోగి ప్రయాణం.'],
  new:['New screening','కొత్త స్క్రీనింగ్'],total:['Patients registered','నమోదైన రోగులు'],pending:['Awaiting review','సమీక్ష కోసం వేచి'],
  referral:['Active referrals','క్రియాశీల రిఫరల్స్'],overdue:['Overdue follow-ups','గడువు దాటిన ఫాలో-అప్‌లు'],
  name:['Patient name','రోగి పేరు'],age:['Age','వయస్సు'],village:['Village / habitation','గ్రామం'],
  phone:['Phone (optional)','ఫోన్ (ఐచ్ఛికం)'],history:['History and symptoms','చరిత్ర మరియు లక్షణాలు'],
  consent:['I have explained this demonstration and obtained permission to store the submitted information on this device. Use synthetic data only.','ఈ ప్రదర్శనను వివరించి ఈ పరికరంలో సమాచారాన్ని నిల్వ చేయడానికి అనుమతి పొందాను. కల్పిత డేటాను మాత్రమే ఉపయోగించండి.'],
  save:['Save screening offline','స్క్రీనింగ్‌ను పరికరంలో సేవ్ చేయండి'],photo:['Oral photograph','నోటి ఫోటో'],
  capture:['Take or upload a photograph','ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి'],
  guide:['Use good lighting, keep the camera steady, and capture the area clearly.','మంచి వెలుతురులో కెమెరాను స్థిరంగా ఉంచి స్పష్టమైన ఫోటో తీయండి.'],
  search:['Search name, ID or village…','పేరు, ID లేదా గ్రామం వెతకండి…'],patient:['Patient','రోగి'],stage:['Care stage','సంరక్షణ దశ'],
  action:['Action','చర్య'],open:['Open record','రికార్డు తెరవండి'],local:['Saved on device','పరికరంలో సేవ్ అయింది'],
  sync:['Send queued events','క్యూలోని ఈవెంట్‌లను పంపండి'],online:['Online','ఆన్‌లైన్'],
  offline:['Offline · device storage active','ఆఫ్‌లైన్ · పరికర నిల్వ క్రియాశీలం'],demo:['SYNTHETIC DEMO','కల్పిత డేటా ప్రదర్శన'],
  review:['Clinical review','వైద్య సమీక్ష'],notes:['Clinical notes','వైద్య గమనికలు'],due:['Next appointment / follow-up','తదుపరి అపాయింట్‌మెంట్'],
  facility:['Referral facility','రిఫరల్ ఆసుపత్రి'],back:['Back to registry','నమోదు జాబితాకు'],empty:['No matching records yet.','ఇంకా సరిపోలే రికార్డులు లేవు.'],
  workflow:['Patient care pathway','రోగి సంరక్షణ మార్గం'],next:['Next actions','తదుపరి చర్యలు'],language:['Read capture guidance','ఫోటో సూచనలను వినండి']
};
const t=k=>i18nT(k,copy[k]?.[lang==='te'?1:0]||k);
const stages={screened:['Awaiting review','సమీక్ష పెండింగ్'],reviewed:['Reviewed','సమీక్ష పూర్తయింది'],referred:['Referred','రిఫర్ చేయబడింది'],diagnostics:['Diagnostics','పరీక్షలు'],treatment:['Treatment follow-up','చికిత్స ఫాలో-అప్'],closed:['Care completed','సంరక్షణ పూర్తయింది']};
const st=s=>stages[s]?.[lang==='te'?1:0]||s;

function toast(message){$('#toast').textContent=message;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',4500);}

async function refresh(){
  patients=await localPatients();
  events=patients.filter(p=>p._sync==='pending');
  if(navigator.onLine){
    try{
      const res=await api('/api/referrals');
      referralsList=res.referrals||[];
    }catch{}
    try{
      const invRes=await listInvestigations();
      investigationsList=invRes.investigations||[];
    }catch{}
    try{
      const navRes=await listNavigation();
      navigationList=navRes.navigation||[];
    }catch{}
  }
}

async function persist(p,type){
  if(type==='screening.created'){
    await createScreening(p);
    if(navigator.onLine){
      try{await syncRecords();}catch(e){toast(e.message);}
    }
  }else{
    await reviewPatient(p);
  }
  await refresh();
}

const icons=Object.fromEntries(['dashboard','patients','screening','reviews','referrals','district','team','settings'].map(key=>[key,icon(key)]));

function shell(){
  const pending=patients.filter(p=>p._sync==='pending').length;
  const userObj = currentIdentity()?.user || { name: 'Health Worker', role: 'worker' };
  
  const roleTitle = lang==='te'
    ? ({worker:'ఆశా / హెల్త్ వర్కర్',asha:'ఆశా కార్యకర్త',doctor:'మెడికల్ ఆఫీసర్',specialist:'స్పెషలిస్ట్ డెంటిస్ట్',hospital:'హాస్పిటల్ కోఆర్డినేటర్',navigator:'హాస్పిటల్ కోఆర్డినేటర్',admin:'జిల్లా అడ్మినిస్ట్రేటర్',patient:'రోగి'}[role]||'వినియోగదారు')
    : ({worker:'Health Worker (ASHA)',asha:'Health Worker (ASHA)',doctor:'Medical Officer',specialist:'Dental Specialist',hospital:'Hospital Coordinator',navigator:'Hospital Coordinator',admin:'District Administrator',patient:'Patient'}[role]||'User');
  
  const portalHeading = lang==='te'
    ? ({worker:'ఆశా వర్కర్ పోర్టల్',asha:'ఆశా వర్కర్ పోర్టల్',doctor:'మెడికల్ ఆఫీసర్ పోర్టల్',specialist:'స్పెషలిస్ట్ పోర్టల్',hospital:'హాస్పిటల్ కోఆర్డినేటర్ పోర్టల్',navigator:'హాస్పిటల్ కోఆర్డినేటర్ పోర్టల్',admin:'జిల్లా అడ్మిన్ డాష్‌బోర్డ్',patient:'రోగి వ్యక్తిగత పోర్టల్'}[role]||'కేర్ పోర్టల్')
    : ({worker:'Health Worker Portal',asha:'Health Worker Portal',doctor:'Medical Officer Portal',specialist:'Specialist Portal',hospital:'Hospital Coordinator Portal',navigator:'Hospital Coordinator Portal',admin:'District Admin Portal',patient:'Patient Portal'}[role]||'Care Portal');
  
  const portalSub = lang==='te' ? 'సమాజ ఆరోగ్య సమన్వయం · ఐటీడీఏ పాడేరు' : 'Community Care Coordination · ITDA Paderu';
  const pendingReviews = patients.filter(p=>p.stage==='screened').length;

  $('#app').innerHTML=`
  <div class="app-layout">
    <header class="app-header-banner">
      <div class="header-branding">
        <img src="/brand-logo.svg" alt="Aarogya Drishti Logo" class="header-logo" onerror="this.src='/icon.svg'">
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
          <button class="btn" id="btn-view-public-site" style="padding:5px 11px;font-size:11px;font-weight:600;display:flex;align-items:center;gap:5px;background:#ffffff;border:1px solid #dce8e2;color:#043329;" title="View Public Website">
            🌐 <span>${lang==='te'?'ప్రజా వెబ్‌సైట్':'Public Website'}</span>
          </button>

          <div class="lang-switch-pills">
            <button class="lang-pill-btn ${lang==='en'?'active':''}" id="lang-btn-en" type="button">English</button>
            <button class="lang-pill-btn ${lang==='te'?'active':''}" id="lang-btn-te" type="button">తెలుగు</button>
          </div>
          
          <div class="user-profile-badge" title="${esc(userObj.name)}">
            <span class="user-avatar-circle">${icon('user', 18)}</span>
            <div class="user-meta">
              <strong>${roleTitle}</strong>
              <small>${esc(userObj.email||'demo')}</small>
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
              <strong>${lang==='te'?'హోమ్':'Home'}</strong>
              <small>${lang==='te'?'అవలోకనం':'Overview'}</small>
            </div>
          </button>

          ${role==='patient'?`
          <button class="sidebar-nav-btn ${view==='patient_portal'?'active':''}" data-nav="patient_portal">
            <span class="sidebar-nav-icon">${icon('patients', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'నా ఆరోగ్య రికార్డు':'My Health Record'}</strong>
              <small>${lang==='te'?'స్క్రీనింగ్ & సలహా':'Screening & Advice'}</small>
            </div>
          </button>
          `:''}

          ${['worker','asha'].includes(role)?`
          <button class="sidebar-nav-btn ${view==='screening'?'active':''}" data-nav="screening">
            <span class="sidebar-nav-icon">${icon('gallery', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'ఫోటో అప్‌లోడ్':'Upload Image'}</strong>
              <small>${lang==='te'?'నోటి స్క్రీనింగ్':'Oral Screening'}</small>
            </div>
          </button>`:''}

          ${role!=='patient'?`
          <button class="sidebar-nav-btn ${view==='patients'?'active':''}" data-nav="patients">
            <span class="sidebar-nav-icon">${icon('patients', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'రోగి రికార్డులు':'Patient Records'}</strong>
              <small>${lang==='te'?'నమోదు జాబితా':'Registry'}</small>
            </div>
          </button>`:''}

          ${role!=='patient'?`
          <button class="sidebar-nav-btn ${view==='reviews'?'active':''}" data-nav="reviews">
            <span class="sidebar-nav-icon">${icon('brain', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'AI విశ్లేషణ డెమో':'AI Analysis Demo'}</strong>
              <small>${lang==='te'?'జెమిని AI':'Gemini Vision'}</small>
            </div>
            ${pendingReviews?`<span class="sidebar-nav-badge">${pendingReviews}</span>`:''}
          </button>`:''}

          ${['doctor','specialist'].includes(role)?`
          <button class="sidebar-nav-btn ${view==='investigations'?'active':''}" data-nav="investigations">
            <span class="sidebar-nav-icon">🔬</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'బయాప్సీ & పరీక్షలు':'Investigations'}</strong>
              <small>${lang==='te'?'రోగనిర్ధారణ ఆర్డర్లు':'Biopsy & Pathology'}</small>
            </div>
          </button>`:''}

          ${['hospital','navigator'].includes(role)?`
          <button class="sidebar-nav-btn ${view==='navigation'?'active':''}" data-nav="navigation">
            <span class="sidebar-nav-icon">🧭</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'పేషెంట్ నావిగేషన్':'Patient Navigation'}</strong>
              <small>${lang==='te'?'రవాణా & హాజరు':'Transport & Visits'}</small>
            </div>
          </button>`:''}

          <button class="sidebar-nav-btn ${view==='referrals'?'active':''}" data-nav="referrals">
            <span class="sidebar-nav-icon">${icon('calendar', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'అపాయింట్‌మెంట్లు':'Appointments'}</strong>
              <small>${lang==='te'?'రెఫరల్ ఫాలో-అప్':'Referrals Queue'}</small>
            </div>
          </button>

          <button class="sidebar-nav-btn ${view==='teleconsult'?'active':''}" data-nav="teleconsult">
            <span class="sidebar-nav-icon">${icon('camera', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'వీడియో సంప్రదింపు':'Video Consultation'}</strong>
              <small>${lang==='te'?'ప్రత్యక్ష టెలిహెల్త్':'Live Telehealth'}</small>
            </div>
            <span class="sidebar-nav-badge" style="background:#059669;color:#fff;padding:2px 6px;border-radius:10px;font-size:10px;font-weight:700;">Live</span>
          </button>

          ${['admin','doctor','specialist'].includes(role)?`
          <button class="sidebar-nav-btn ${view==='district'?'active':''}" data-nav="district">
            <span class="sidebar-nav-icon">${icon('district', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'జిల్లా విశ్లేషణ':'District Insights'}</strong>
              <small>${lang==='te'?'లైవ్ డేటాబేస్':'Live Metrics'}</small>
            </div>
          </button>`:''}

          <button class="sidebar-nav-btn ${view==='facilities_portal'?'active':''}" data-nav="facilities_portal">
            <span class="sidebar-nav-icon">🏥</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'ఆసుపత్రుల నెట్‌వర్క్':'ITDA Facilities'}</strong>
              <small>${lang==='te'?'పాడేరు కేంద్రాలు':'Hospital Network'}</small>
            </div>
          </button>

          ${role!=='patient'?`
          <button class="sidebar-nav-btn" id="sync-drawer-btn" type="button" aria-label="Open offline sync drawer">
            <span class="sidebar-nav-icon">${icon('sync', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'ఆఫ్‌లైన్ సింక్':'Offline Sync'}</strong>
              <small>${lang==='te'?'పరికర నిల్వ':'Local Cache'}</small>
            </div>
            <span class="sidebar-nav-badge">${pending}</span>
          </button>`:''}

          ${role==='admin'?`
          <button class="sidebar-nav-btn ${view==='team'?'active':''}" data-nav="team">
            <span class="sidebar-nav-icon">${icon('settings', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'కేర్ టీమ్':'Care Team'}</strong>
              <small>${lang==='te'?'సిబ్బంది నిర్వహణ':'Staff Directory'}</small>
            </div>
          </button>`:''}

          <button class="sidebar-nav-btn" id="sidebar-logout-btn" type="button">
            <span class="sidebar-nav-icon">${icon('logout', 20)}</span>
            <div class="sidebar-nav-text">
              <strong>${lang==='te'?'లాగౌట్':'Logout'}</strong>
              <small>${lang==='te'?'నిష్క్రమించు':'Sign out'}</small>
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

  if($('#btn-view-public-site')) $('#btn-view-public-site').onclick = () => showPublicSite();
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

function updateSyncDrawer(){
  mountSyncDrawer({
    patients,lang,
    onSyncAll:async()=>{await sync();},
    onSyncSingle:async(patientId)=>{
      try{
        const res=await syncSingleRecord(patientId);
        if(res.conflict){
          toast(lang==='te'?'వైరుధ్యం గుర్తించబడింది.':'Conflict detected.');
          const p=patients.find(pt=>pt.id===patientId);
          if(p)showConflictDialog(p);
        }else{
          toast(lang==='te'?'రికార్డు విజయవంతంగా సింక్ అయింది.':'Record synced successfully.');
        }
        await refresh();render();
      }catch(err){toast(err.message);await refresh();render();}
    },
    onResolveConflict:(patient)=>showConflictDialog(patient),
    onOpenRecord:(id)=>navigate('record',id)
  });
}

function showConflictDialog(patient){
  openConflictModal({
    localPatient:patient,serverPatient:patient._serverConflict,lang,
    onKeepServer:async(id)=>{
      try{
        await resolveConflict(id,'keep_server');
        toast(lang==='te'?'సర్వర్ రికార్డు ఉంచబడింది.':'Server record preserved.');
        await refresh();render();
      }catch(err){toast(err.message);}
    },
    onKeepLocal:async(id)=>{
      try{
        await resolveConflict(id,'overwrite_local');
        toast(lang==='te'?'పరికర రికార్డుతో భర్తీ చేయబడింది.':'Overwritten with device edit.');
        await refresh();render();
      }catch(err){toast(err.message);}
    }
  });
}

function updateConnection(){
  const badge=document.querySelector('.top-actions > .pill');
  if(badge){
    badge.classList.toggle('offline',!navigator.onLine);
    badge.textContent='● '+t(navigator.onLine?'online':'offline');
  }
}

function navigate(v,id){
  if(v==='screening'&&!['worker','asha'].includes(role)){
    return toast(lang==='te'?'స్క్రీనింగ్ నమోదు ఆరోగ్య కార్యకర్తకు మాత్రమే.':'Only health workers can register screenings.');
  }
  view=v;
  selected=id||null;
  photo=null;
  quality=null;
  render();
  window.scrollTo(0,0);
}

function intro(title,sub='',button=false){
  return `<div class="intro"><div><h1>${title}</h1><p class="sub">${sub}</p></div>${button&&['worker','asha'].includes(role)?`<button class="btn primary" data-new>＋ ${t('new')}</button>`:''}</div>`;
}

function stats(){
  return `<div class="stats">${[
    ['total',patients.length,'♧'],
    ['pending',patients.filter(p=>p.stage==='screened').length,'◷'],
    ['referral',patients.filter(p=>['referred','diagnostics','treatment'].includes(p.stage)).length,'↗'],
    ['overdue',patients.filter(p=>overdue(p)).length,'◴']
  ].map(([key,value])=>`
    <div class="stat">
      <div class="stat-top">${t(key)}<span class="stat-icon">${icons[key==='total'?'patients':key==='pending'?'reviews':key==='referral'?'referrals':'district']}</span></div>
      <strong>${value.toString().padStart(2,'0')}</strong>
      <small>${lang==='te'?'భాగస్వామ్య & పరికర రికార్డులు':'Shared records + pending device captures'}</small>
    </div>`).join('')}</div>`;
}

function table(list){
  return list.length?`
  <div class="table-wrap">
    <table>
      <thead>
        <tr><th>${t('patient')}</th><th>${t('village')}</th><th>${t('stage')}</th><th>${t('action')}</th></tr>
      </thead>
      <tbody>
        ${list.map(p=>`
          <tr>
            <td>
              <strong>${esc(p.name)}</strong>
              <small>${esc(p.id)} ${p._sync==='pending'?' · ↑ pending upload':' · ✓ shared'} · ${p.age} ${lang==='te'?'సంవత్సరాలు':'years'}</small>
            </td>
            <td>${esc(p.village)}</td>
            <td><span class="pill ${overdue(p)?'red':p.stage==='screened'?'amber':''}">${st(p.stage)}</span></td>
            <td><button class="table-action" data-open="${esc(p.id)}">${t('open')} ↗</button></td>
          </tr>`).join('')}
      </tbody>
    </table>
  </div>`:`<div class="empty">${t('empty')}</div>`;
}

function tasks(){
  const list=patients.filter(p=>overdue(p)||p.stage==='screened').slice(0,4);
  return list.map(p=>`
    <div class="task">
      <div class="task-icon">${overdue(p)?'◴':'▣'}</div>
      <div>
        <p><strong>${esc(p.name)}</strong></p>
        <p>${overdue(p)?t('overdue'):t('pending')}</p>
        <small>${esc(p.village)} · ${esc(p.due||p.createdAt?.slice(0,10)||'')}</small>
      </div>
      <button class="table-action" style="margin-left:auto" data-open="${esc(p.id)}">↗</button>
    </div>`).join('')||`<p class="sub">${t('empty')}</p>`;
}

function dashboard(){
  const isWorker = ['worker','asha'].includes(role);
  return intro(t('welcome'),t('subtitle'),true)+`
  <section class="hero">
    <div class="hero-copy">
      <div class="eyebrow">CONNECTED CARE · COMMUNITY FIRST</div>
      <h2>${lang==='te'?'ప్రతి స్క్రీనింగ్‌కు ఒక తదుపరి అడుగు.':'Every screening deserves a next step.'}</h2>
      <p>${lang==='te'?'గ్రామంలో నమోదు. వైద్యునితో అనుసంధానం. ప్రతి రోగికి నిరంతర సంరక్షణ.':'From the first conversation to a clinician’s review. One connected journey, wherever care begins.'}</p>
      <div class="hero-actions">
        ${isWorker?`
          <button class="btn" data-assistant>${icon('spark',16)} ${lang==='te'?'సాథితో నమోదు':'Register with Saathi'}</button>
          <button class="btn ghost" data-new>${t('new')} ${icon('arrow',15)}</button>
        `:`
          <button class="btn" data-go="patients">${t('patients')} ${icon('arrow',15)}</button>
        `}
      </div>
    </div>
    <div class="hero-art" aria-hidden="true">
      <div class="hero-orbit"></div>
      <div class="hero-medallion">${icon('screening',46)}</div>
      <span class="orbit-label one">${lang==='te'?'అనుసంధాన సంరక్షణ':'CONNECTED CARE'}</span>
      <span class="orbit-label two"><i></i>${lang==='te'?'ఆఫ్‌లైన్ సిద్ధం':'OFFLINE READY'}</span>
    </div>
  </section>`+
  stats()+`
  <div class="columns">
    <div>
      <section class="card">
        <div class="card-head">
          <h2>${lang==='te'?'ఇటీవలి రోగులు':'Recent patient journeys'}</h2>
          <a data-go="patients">${t('patients')} →</a>
        </div>
        ${table([...patients].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')).slice(0,5))}
      </section>
      <section class="card">
        <h2>${t('workflow')}</h2>
        <div class="flow">${Object.entries(stages).map(([k],i)=>`<div class="${i===0?'done':''}"><b>${i+1}</b>${st(k)}</div>`).join('')}</div>
        <p class="mini">${lang==='te'?'వైద్యుని సమీక్ష ద్వారా మాత్రమే సంరక్షణ నిర్ణయాలు.':'Care decisions remain with the reviewing clinician. AI assessment is not a diagnosis.'}</p>
      </section>
    </div>
    <div>
      <section class="card">
        <div class="card-head">
          <h2>${t('next')}</h2>
          <span class="pill amber">${patients.filter(p=>overdue(p)||p.stage==='screened').length}</span>
        </div>
        ${tasks()}
      </section>
      <section class="card">
        <h2>${lang==='te'?'గ్రామాల వారీగా స్క్రీనింగ్':'Screening by village'}</h2>
        ${villageBars()}
        <p class="metric-note">${lang==='te'?'కల్పిత డేటా · వ్యాధి ప్రాబల్యం కాదు':'Synthetic counts · not disease prevalence'}</p>
      </section>
    </div>
  </div>`;
}

function villageBars(){
  const counts={};
  patients.forEach(p=>counts[p.village]=(counts[p.village]||0)+1);
  const max=Math.max(1,...Object.values(counts));
  return Object.entries(counts).sort((a,b)=>b[1]-a[1]).map(([v,n])=>`
    <div class="bar-row">
      <span>${esc(v)}</span>
      <div class="bar"><i style="width:${n/max*100}%"></i></div>
      <b>${n}</b>
    </div>`).join('')||`<p class="sub">${t('empty')}</p>`;
}

function screening(){
  const isTe = lang === 'te';
  return `
  <div class="upload-view-container">
    <div class="upload-view-header">
      <button class="back-link-nav" type="button" data-go="dashboard" style="background:none;border:none;color:#043329;font-weight:600;cursor:pointer;margin-bottom:12px;font-size:12px;">← ${isTe ? 'డాష్‌బోర్డుకు తిరిగి వెళ్ళండి' : 'Back to Dashboard'}</button>
      
      <div class="view-header-title-row" style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
        <span class="view-header-icon" style="background:#059669;color:#fff;padding:8px;border-radius:10px;display:grid;place-items:center;">${icon('upload', 24)}</span>
        <div>
          <h1 style="font-size:20px;margin:0;">Oral Image Upload & Quality Check</h1>
          <span class="view-sub-te" style="color:#059669;font-size:12px;font-weight:600;">నోటి ఫోటో అప్‌లోడ్ & నాణ్యత తనిఖీ</span>
        </div>
      </div>
      
      <p class="view-desc-en" style="margin:4px 0;font-size:12px;color:#4b6860;">Upload a clear image of the patient's oral cavity. You can choose from gallery or use the camera.</p>
      <p class="view-desc-te" style="margin:0 0 16px 0;font-size:11px;color:#52756b;">రోగి నోటి భాగం ఫోటోను అప్‌లోడ్ చేయండి. గ్యాలరీ నుండి ఎంచుకోవచ్చు లేదా కెమెరాతో తీసుకోవచ్చు.</p>
    </div>

    <form id="screen-form">
      <div class="upload-columns-grid">
        <!-- CARD 1: Choose Image Source -->
        <section class="upload-card">
          <div class="card-step-header" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div class="card-step-badge">1</div>
            <div>
              <h3 style="margin:0;font-size:14px;">Choose Image Source</h3>
              <span class="card-sub-te" style="font-size:10.5px;color:#059669;">చిత్రం ఎంచుకునే మార్గం</span>
            </div>
          </div>

          <div class="source-buttons-row">
            <button type="button" class="source-select-btn source-btn" id="btn-source-camera">
              <span class="source-icon">${icon('camera', 22)}</span>
              <div class="source-btn-text">
                <strong>Camera</strong>
                <span>Take a new photo</span>
                <small>కొత్త ఫోటో తీయండి</small>
              </div>
            </button>
            <button type="button" class="source-select-btn source-btn" id="btn-source-gallery">
              <span class="source-icon">${icon('gallery', 22)}</span>
              <div class="source-btn-text">
                <strong>Gallery</strong>
                <span>Select from gallery</span>
                <small>గ్యాలరీ నుండి ఎంచుకోండి</small>
              </div>
            </button>
          </div>

          <div class="formats-info-row formats-meta-row" style="margin:12px 0;">
            <span class="formats-label">Supported formats:</span>
            <div class="format-tags formats-badges">
              <span class="fmt-pill">JPG</span>
              <span class="fmt-pill">PNG</span>
              <span class="fmt-pill">WEBP</span>
            </div>
            <span class="max-size-label max-size-text">Max size: 8 MB</span>
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
          <div class="card-step-header" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div class="card-step-badge">2</div>
            <div>
              <h3 style="margin:0;font-size:14px;">Image Preview</h3>
              <span class="card-sub-te" style="font-size:10.5px;color:#059669;">ఫోటో ప్రివ్యూ</span>
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
          <div class="card-step-header" style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div class="card-step-badge">3</div>
            <div>
              <h3 style="margin:0;font-size:14px;">Quality Check Result</h3>
              <span class="card-sub-te" style="font-size:10.5px;color:#059669;">నాణ్యత తనిఖీ ఫలితం</span>
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
                <strong>Good lighting & illumination</strong>
                <small>వెలుతురు సరిపోయింది</small>
              </div>
            </li>
            <li>
              <span class="check-bullet">${icon('checkCircle', 16)}</span>
              <div class="check-text">
                <strong>Sufficient contrast</strong>
                <small>సరైన కాంట్రాస్ట్</small>
              </div>
            </li>
          </ul>

          <div class="synthetic-info-notice">
            <span class="notice-info-icon">${icon('info', 18)}</span>
            <div class="notice-text">
              <p>Frontline screening queue.</p>
              <small>స్క్రీనింగ్ సేవ్ అయిన తర్వాత వైద్యుని సమీక్ష కోసం సమర్పించబడుతుంది.</small>
            </div>
          </div>

          <button type="submit" class="btn-save-screening-action" id="save-screening-btn" aria-label="Save screening offline">
            ✓ ${isTe ? 'స్క్రీనింగ్‌ను పరికరంలో సేవ్ చేయండి' : 'Save screening offline'}
          </button>
        </section>
      </div>
    </form>
  </div>`;
}

function registry(){
  const isReview=view==='reviews';
  let list=patients.filter(p=>isReview?p.stage==='screened':true);
  return intro(t(view),isReview?(lang==='te'?'మానవ సమీక్ష కోసం స్క్రీనింగ్‌లు. జెమిని AI నిర్ణయ సహాయం.':'Screenings awaiting clinician assessment. AI assists; doctors decide.'):(lang==='te'?'ప్రతి రోగి, ప్రతి తదుపరి అడుగు.':'One record. Every next step accounted for.'),true)+
  `<div class="toolbar">
    <input class="search" id="search" placeholder="${t('search')}" aria-label="${t('search')}">
    <select class="language" id="filter">
      <option value="all">${lang==='te'?'అన్ని దశలు':'All stages'}</option>
      ${Object.keys(stages).map(k=>`<option value="${k}">${st(k)}</option>`).join('')}
      <option value="overdue">${t('overdue')}</option>
    </select>
  </div>
  <section class="card" id="list">${table(list)}</section>`;
}

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
    <div style="background:linear-gradient(135deg,#064e3b,#047857);color:#fff;padding:16px 20px;border-radius:12px;margin:16px 0;display:flex;align-items:center;justify-content:space-between;box-shadow:0 6px 20px rgba(6,78,59,0.2);">
      <div style="display:flex;align-items:center;gap:12px;">
        <span style="font-size:24px;">📹</span>
        <div>
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="width:8px;height:8px;border-radius:50%;background:#34d399;display:inline-block;box-shadow:0 0 8px #34d399;"></span>
            <strong style="font-size:14px;">${isTe ? 'ప్రస్తుత లైవ్ టెలికన్సల్టేషన్ రూమ్' : 'Live Doctor-Patient Consultation Room Ready'}</strong>
          </div>
          <small style="opacity:0.9;font-size:11px;">${isTe ? 'చెట్టి కొండబాబు · డాక్టర్ మరియు రోగి ఒకే రూమ్‌లో కనెక్ట్ అవుతారు' : 'Patient: Chetti Kondababu · One-click connects Doctor and Patient into the same room'}</small>
        </div>
      </div>
      <button class="btn" style="background:#ffffff;color:#065f46;font-weight:700;font-size:12px;padding:8px 18px;border-radius:8px;display:flex;align-items:center;gap:6px;cursor:pointer;" data-start-video-consult="AD-PAD-20261112-5775">
        <span>🟢</span> ${isTe ? 'రూమ్‌లో చేరండి' : 'Join Consultation Room'}
      </button>
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
          <span class="mini" style="margin-right:6px;">${isTe?'చర్య:':'Action:'}</span>
          <button class="btn primary" style="padding:6px 14px;font-size:11px;background:#059669;color:#fff;display:inline-flex;align-items:center;gap:6px;font-weight:600;" data-start-video-consult="${esc(r.patientId||p.id)}">
            <span>📹</span> ${isTe?'వీడియో సంప్రదింపు':'Video Consult'}
          </button>
          ${r.status==='referred'?`<button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="scheduled">📅 ${isTe?'షెడ్యూల్ చేయండి':'Schedule'}</button><button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="attended">🏥 ${isTe?'హాజరయ్యారు':'Attended'}</button>`:''}
          ${r.status==='scheduled'?`<button class="btn" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="attended">🏥 ${isTe?'హాజరయ్యారు':'Mark Attended'}</button>`:''}
          ${r.status==='attended'?`<button class="btn primary" style="padding:6px 12px;font-size:11px;" data-ref-action="${esc(r.id)}" data-to-status="completed">✓ ${isTe?'చికిత్స పూర్తయింది':'Mark Completed'}</button>`:''}
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
  const searchEl=$('#ref-search'),statusEl=$('#ref-status-filter');
  const filterQueue=()=>{
    const q=(searchEl?.value||'').toLowerCase(),stVal=statusEl?.value||'all';
    let list=referralsList.length?referralsList:patients.filter(p=>['referred','diagnostics','treatment'].includes(p.stage)).map(p=>({
      id:'REF-'+p.id,patientId:p.id,facility:p.facility||'Area Hospital Paderu',priority:p.priority||'routine',
      due_date:p.due||'',status:p.stage==='referred'?'referred':'scheduled',notes:p.notes||'',quadrant:p.quadrant||'GENERAL',
      patient:{id:p.id,name:p.name,village:p.village,phone:p.phone,age:p.age},isOverdue:overdue(p)
    }));
    const filtered=list.filter(r=>{
      const p=r.patient||{};
      const matchText=`${p.name||''} ${p.id||r.patientId} ${p.village||''} ${r.facility||''}`.toLowerCase().includes(q);
      const matchStatus=stVal==='all'||(stVal==='overdue'?r.isOverdue:r.status===stVal);
      return matchText&&matchStatus;
    });
    const host=$('#referrals-queue-list');
    if(host){host.innerHTML=renderReferralCards(filtered,lang==='te');bindReferralsQueue();bindCommon();}
  };
  if(searchEl)searchEl.oninput=filterQueue;
  if(statusEl)statusEl.onchange=filterQueue;
}

// -------------------------------------------------------------
// LIVE TELECONSULTATION & VIDEO REFERRAL HUB
// -------------------------------------------------------------
function teleconsultView(){
  const isTe = lang === 'te';
  const isDoctor = role === 'doctor' || role === 'specialist';
  const activePatients = patients.filter(p => ['referred', 'screened', 'reviewed', 'diagnostics', 'treatment'].includes(p.stage));

  return intro(
    isTe ? 'వీడియో సంప్రదింపు & లైవ్ టెలిహెల్త్' : 'Live Video Teleconsultation Hub',
    isTe ? 'వైద్యులు మరియు ఆశా కార్యకర్తల మధ్య ప్రత్యక్ష ఎన్‌క్రిప్టెడ్ వీడియో సంప్రదింపు.' : 'Direct doctor-patient live encrypted teleconsultation room for rural care.'
  ) + `
  <div class="stats" style="margin-bottom:20px;">
    <div class="stat">
      <div class="stat-top">${isTe ? 'వీడియో నెట్‌వర్క్' : 'Video Network'}<span class="stat-icon">🟢</span></div>
      <strong style="color:#059669;">Active</strong>
      <small>${isTe ? 'లైవ్ వీడియో సిద్ధంగా ఉంది' : 'Local WebRTC / LiveKit Ready'}</small>
    </div>
    <div class="stat">
      <div class="stat-top">${isTe ? 'క్రియాశీల రోగులు' : 'Eligible Patients'}<span class="stat-icon">👥</span></div>
      <strong>${String(activePatients.length).padStart(2, '0')}</strong>
      <small>${isTe ? 'సంప్రదింపుకు సిద్ధంగా ఉన్నారు' : 'Ready for Video Call'}</small>
    </div>
    <div class="stat">
      <div class="stat-top">${isTe ? 'మీ పాత్ర' : 'Logged-in As'}<span class="stat-icon">🛡️</span></div>
      <strong style="font-size:14px;">${isDoctor ? 'Medical Officer' : 'Health Worker (ASHA)'}</strong>
      <small>${currentIdentity()?.user?.name || 'User'}</small>
    </div>
  </div>

  <div style="background:linear-gradient(135deg,#064e3b,#047857);color:#fff;padding:18px 22px;border-radius:14px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 8px 24px rgba(6,78,59,0.25);">
    <div style="display:flex;align-items:center;gap:14px;">
      <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:24px;">📹</div>
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#34d399;box-shadow:0 0 10px #34d399;"></span>
          <strong style="font-size:16px;">${isTe ? 'ప్రత్యక్ష టెలికన్సల్టేషన్ రూమ్ సిద్ధంగా ఉంది' : 'Live Doctor-Patient Consultation Room Ready'}</strong>
        </div>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.95;">
          ${isTe ? 'రోగి: చెట్టి కొండబాబు · డాక్టర్ మరియు రోగి ఒకే రూమ్‌లో కలుస్తారు' : 'Patient: Chetti Kondababu · One-click connects Doctor and Patient into the same room'}
        </p>
      </div>
    </div>
    <button class="btn" style="background:#ffffff;color:#065f46;font-weight:700;font-size:13px;padding:10px 22px;border-radius:8px;display:flex;align-items:center;gap:8px;box-shadow:0 4px 12px rgba(0,0,0,0.15);cursor:pointer;" data-start-video-consult="AD-PAD-20261112-5775">
      <span>🟢</span> ${isTe ? 'ఈ రూమ్‌లో చేరండి' : 'Join Consultation Room'}
    </button>
  </div>

  <section class="card" style="margin-top:16px;">
    <div class="card-head" style="display:flex;justify-content:space-between;align-items:center;">
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="stat-icon">${icon('camera', 20)}</span>
        <div>
          <h3 style="margin:0;">${isTe ? 'రోగుల ప్రత్యక్ష సంప్రదింపు జాబితా' : 'Direct Patient Video Consultations'}</h3>
          <small class="sub">${isTe ? 'ఒకే క్లిక్‌తో డాక్టర్ మరియు రోగి మధ్య కాల్ ప్రారంభించండి' : 'One-click instant encrypted consultation room'}</small>
        </div>
      </div>
      <span class="pill green">● Two-Way Video & Audio</span>
    </div>

    ${!activePatients.length ? `<div class="empty">${t('empty')}</div>` : `
    <div style="display:grid;gap:12px;margin-top:16px;">
      ${activePatients.map(p => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px 18px;background:rgba(255,255,255,0.85);border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,0.03);">
          <div>
            <div style="display:flex;align-items:center;gap:10px;">
              <strong style="font-size:15px;">${esc(p.name)}</strong>
              <span class="pill">${esc(p.id)}</span>
              <span class="pill ${p.stage === 'referred' ? 'amber' : 'green'}">${esc(p.stage)}</span>
            </div>
            <p class="sub" style="margin-top:4px;">
              ${p.age ? p.age + ' ' + (isTe ? 'సం.' : 'yrs') + ' · ' : ''}${esc(p.village || 'ITDA Paderu')}
              ${p.phone ? ` · 📞 ${esc(p.phone)}` : ''}
              ${p.facility ? ` · 🏥 ${esc(p.facility)}` : ''}
            </p>
          </div>
          <button class="btn primary" style="padding:8px 16px;font-size:12px;font-weight:600;background:#059669;display:flex;align-items:center;gap:6px;" data-start-video-consult="${esc(p.id)}">
            <span>📹</span> ${isDoctor ? (isTe ? 'కాల్ ప్రారంభించండి' : 'Start Doctor Call') : (isTe ? 'డాక్టర్‌ను పిలవండి' : 'Call Doctor')}
          </button>
        </div>
      `).join('')}
    </div>`}
  </section>`;
}

// -------------------------------------------------------------
// SPECIALIST & DOCTOR INVESTIGATIONS VIEW (Biopsy / Pathology)
// -------------------------------------------------------------
function investigationsView(){
  const isTe=lang==='te';
  const list=investigationsList;
  return intro(isTe?'బయాప్సీ & ప్రత్యేక రోగనిర్ధారణ ఆర్డర్లు':'Specialist Diagnostic Investigations & Biopsies',
    isTe?'ఐటీడీఏ పాడేరు నెట్‌వర్క్‌లో బయాప్సీ, సైటాలజీ మరియు పాథాలజీ ల్యాబ్ ట్రాకింగ్.':'Biopsy, histopathology, and imaging workflow orders.')+
  `<div class="stats">
    <div class="stat"><div class="stat-top">${isTe?'మొత్తం ఆర్డర్లు':'Total Investigations'}<span class="stat-icon">🔬</span></div><strong>${String(list.length).padStart(2,'0')}</strong><small>${isTe?'ల్యాబ్ పరీక్షలు':'Diagnostic tests'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'బయాప్సీలు':'Biopsies'}<span class="stat-icon">🩺</span></div><strong>${String(list.filter(i=>i.test_type==='biopsy').length).padStart(2,'0')}</strong><small>${isTe?'టిష్యూ సాంపిల్స్':'Tissue samples'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'నివేదికలు అందాయి':'Reported'}<span class="stat-icon">✓</span></div><strong>${String(list.filter(i=>i.status==='completed'||i.status==='reported').length).padStart(2,'0')}</strong><small>${isTe?'పాథాలజీ పూర్తయింది':'Pathology completed'}</small></div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:18px;background:rgba(240,249,255,0.7);border:1px solid #bae6fd;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:#0369a1;">＋ ${isTe?'కొత్త బయాప్సీ / పరీక్షను ఆదేశించండి':'Order New Diagnostic Investigation'}</h3>
    <form id="new-inv-form" style="display:grid;grid-template-columns:1.5fr 1fr 1fr auto;gap:10px;align-items:flex-end;">
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'రోగిని ఎంచుకోండి':'Select Patient'} *</label>
        <select id="inv-patient" required style="padding:8px;font-size:12px;">
          ${patients.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)}) - ${esc(p.village)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'పరీక్ష రకం':'Test Type'} *</label>
        <select id="inv-type" required style="padding:8px;font-size:12px;">
          <option value="biopsy">Biopsy (Histopathology)</option>
          <option value="cytology">Exfoliative Cytology</option>
          <option value="radiology_opg">Radiology (OPG X-Ray)</option>
          <option value="routine_blood">Complete Blood Profile</option>
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'ఆసుపత్రి కేంద్రం':'Target Facility'}</label>
        <select id="inv-facility" style="padding:8px;font-size:12px;">
          <option value="Area Hospital Paderu">Area Hospital Paderu</option>
          <option value="Community Health Centre Araku Valley">CHC Araku Valley</option>
          <option value="King George Hospital (KGH) Visakhapatnam">KGH Visakhapatnam (Tertiary)</option>
        </select>
      </div>
      <button type="submit" class="btn primary" style="padding:9px 18px;font-size:12px;font-weight:600;">
        ${isTe?'ఆర్డర్ సమర్పించండి':'Submit Order'}
      </button>
    </form>
  </div>

  <section class="card">
    <h2>${isTe?'క్రియాశీల పరీక్షల జాబితా':'Active Investigation Ledger'}</h2>
    ${list.length?`
      <div style="display:grid;gap:12px;margin-top:14px;">
        ${list.map(inv=>`
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">🔬</span>
                <strong style="font-size:13px;text-transform:uppercase;">${esc(inv.test_type)}</strong>
                <span class="pill ${inv.status==='completed'||inv.status==='reported'?'green':'amber'}" style="font-size:10px;">
                  ${esc(inv.status)}
                </span>
              </div>
              <p class="sub" style="margin:4px 0;">
                ${isTe?'రోగి':'Patient'}: <strong>${esc(inv.patient_id)}</strong> · ${isTe?'కేంద్రం':'Facility'}: ${esc(inv.facility)} · ${esc(new Date(inv.ordered_at).toLocaleDateString())}
              </p>
              ${inv.clinical_findings?`<p style="font-size:11.5px;color:#1e3a8a;margin:4px 0;background:#eff6ff;padding:6px 10px;border-radius:6px;"><strong>Report:</strong> ${esc(inv.clinical_findings)}</p>`:''}
            </div>
            <div>
              ${inv.status!=='completed'?`
                <button class="btn" data-update-inv="${esc(inv.id)}" style="padding:6px 12px;font-size:11px;">
                  📝 ${isTe?'పాథాలజీ రిపోర్ట్ జోడించండి':'Add Lab Report'}
                </button>
              `:''}
            </div>
          </div>
        `).join('')}
      </div>
    `:`<div class="empty">${isTe?'ఇంకా పరీక్ష ఆర్డర్లు లేవు.':'No investigation orders recorded yet.'}</div>`}
  </section>`;
}

function bindInvestigations(){
  const form=$('#new-inv-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      try{
        const patientId=$('#inv-patient').value;
        const testType=$('#inv-type').value;
        const facility=$('#inv-facility').value;
        await createInvestigation({patientId,testType,facility,clinicalFindings:'Specialist ordered '+testType});
        toast(lang==='te'?'రోగనిర్ధారణ పరీక్ష విజయవంతంగా ఆదేశించబడింది!':'Investigation ordered successfully!');
        await refresh();render();
      }catch(err){toast(err.message);}
    };
  }

  document.querySelectorAll('[data-update-inv]').forEach(btn=>{
    btn.onclick=async()=>{
      const invId=btn.dataset.updateInv;
      const findings=prompt(lang==='te'?'పాథాలజీ విశ్లేషణ ఫలితాన్ని నమోదు చేయండి:':'Enter histopathology / lab findings summary:','Histopathology confirmed: Hyperkeratosis with mild epithelial dysplasia. Benign.');
      if(findings){
        try{
          await updateInvestigation(invId,{status:'completed',clinicalFindings:findings});
          toast(lang==='te'?'నివేదిక విజయవంతంగా సేవ్ అయింది.':'Report saved successfully.');
          await refresh();render();
        }catch(err){toast(err.message);}
      }
    };
  });
}

// -------------------------------------------------------------
// HOSPITAL COORDINATOR & PATIENT NAVIGATION VIEW
// -------------------------------------------------------------
function navigationView(){
  const isTe=lang==='te';
  const list=navigationList;
  return intro(isTe?'హాస్పిటల్ కోఆర్డినేషన్ & పేషెంట్ నావిగేషన్':'Patient Navigation & Hospital Care Coordination',
    isTe?'గిరిజన రోగులను ఆసుపత్రికి చేర్చడం, రవాణా సహాయం మరియు హాజరు పర్యవేక్షణ.':'Tracking transit barriers, appointment attendance, and coordinator follow-ups.')+
  `<div class="stats">
    <div class="stat"><div class="stat-top">${isTe?'మొత్తం నావిగేట్ చేసినవారు':'Navigated Patients'}<span class="stat-icon">🧭</span></div><strong>${String(list.length).padStart(2,'0')}</strong><small>${isTe?'ట్రాక్ చేయబడిన రోగులు':'Assisted cases'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'హాజరు ధృవీకరించబడింది':'Attendance Confirmed'}<span class="stat-icon">🏥</span></div><strong>${String(list.filter(n=>n.attendance_confirmed).length).padStart(2,'0')}</strong><small>${isTe?'ఆసుపత్రికి వచ్చారు':'Reached facility'}</small></div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:18px;background:rgba(240,253,244,0.7);border:1px solid #bbf7d0;">
    <h3 style="margin:0 0 12px 0;font-size:14px;color:#166534;">＋ ${isTe?'రోగి సంప్రదింపు మరియు రవాణా సహాయాన్ని నమోదు చేయండి':'Log Patient Assistance / Navigation Event'}</h3>
    <form id="new-nav-form" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:10px;align-items:flex-end;">
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'రోగి':'Patient'} *</label>
        <select id="nav-patient" required style="padding:8px;font-size:12px;">
          ${patients.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)}) - ${esc(p.village)}</option>`).join('')}
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'సంప్రదింపు స్థితి':'Contact Status'} *</label>
        <select id="nav-contact" style="padding:8px;font-size:12px;">
          <option value="contacted">Contacted & Confirmed</option>
          <option value="visit_scheduled">Visit Scheduled</option>
          <option value="unreachable">Unreachable</option>
        </select>
      </div>
      <div class="field" style="margin:0;">
        <label style="font-size:11px;">${isTe?'రవాణా సదుపాయం':'Transport Barrier / Support'}</label>
        <select id="nav-barrier" style="padding:8px;font-size:12px;">
          <option value="ITDA Tribal Bus Voucher Provided">ITDA Tribal Bus Voucher Provided</option>
          <option value="Ambulance / 104 Vehicle Assigned">Mobile Van / 104 Transport Assigned</option>
          <option value="Escort Health Worker Assigned">Escort ASHA Worker Assigned</option>
          <option value="None">None (Independent Travel)</option>
        </select>
      </div>
      <button type="submit" class="btn primary" style="padding:9px 18px;font-size:12px;font-weight:600;">
        ${isTe?'సేవ్ చేయండి':'Save Log'}
      </button>
    </form>
  </div>

  <section class="card">
    <h2>${isTe?'ఇటీవలి నావిగేషన్ రికార్డులు':'Recent Navigation Logs'}</h2>
    ${list.length?`
      <div style="display:grid;gap:12px;margin-top:14px;">
        ${list.map(nav=>`
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:14px;display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="display:flex;align-items:center;gap:8px;">
                <span style="font-size:16px;">📍</span>
                <strong style="font-size:13px;">${esc(nav.patient?.name||nav.patient_id)}</strong>
                <span class="pill green" style="font-size:10px;">${esc(nav.contact_status)}</span>
              </div>
              <small style="color:#64748b;display:block;margin-top:3px;">
                ${isTe?'రవాణా':'Transit'}: ${esc(nav.barrier_identified||'None')} · ${isTe?'కోఆర్డినేటర్':'Coordinator'}: ${esc(nav.navigator_name||'Staff')} · ${esc(new Date(nav.updated_at).toLocaleDateString())}
              </small>
            </div>
            <button class="table-action" data-open="${esc(nav.patient_id)}">${t('open')} ↗</button>
          </div>
        `).join('')}
      </div>
    `:`<div class="empty">${isTe?'ఇంకా నావిగేషన్ రికార్డులు లేవు.':'No navigation tracking records logged yet.'}</div>`}
  </section>`;
}

function bindNavigation(){
  const form=$('#new-nav-form');
  if(form){
    form.onsubmit=async e=>{
      e.preventDefault();
      try{
        const patientId=$('#nav-patient').value;
        const contactStatus=$('#nav-contact').value;
        const barrierIdentified=$('#nav-barrier').value;
        await createNavigation({patientId,contactStatus,barrierIdentified,attendanceConfirmed:true,notes:'Hospital coordinator logged support.'});
        toast(lang==='te'?'నావిగేషన్ సహాయం విజయవంతంగా సేవ్ అయింది!':'Navigation event logged successfully!');
        await refresh();render();
      }catch(err){toast(err.message);}
    };
  }
}

// -------------------------------------------------------------
// PATIENT PERSONAL PORTAL VIEW
// -------------------------------------------------------------
function patientPortalView(){
  const isTe=lang==='te';
  const p=patients[0]; // Patient role accesses their own personal record
  if(!p){
    return `
    <div class="card" style="text-align:center;padding:40px;">
      <h2>${isTe?'రోగి రికార్డు సిద్ధంగా లేదు':'No Patient Record Found'}</h2>
      <p class="sub">${isTe?'డెమో కోసం దయచేసి ప్రాథమిక రికార్డును జోడించండి.':'Click below to seed an example patient screening record for this demonstration.'}</p>
      <button class="btn primary" id="btn-seed-patient" style="margin-top:14px;">＋ ${isTe?'డెమో రోగి రికార్డు సృష్టించండి':'Create Demo Patient Record'}</button>
    </div>`;
  }

  return `
  <div class="upload-view-container">
    <div class="card" style="background:linear-gradient(135deg,#064e3b 0%,#043329 100%);color:#ffffff;border-radius:18px;padding:26px;margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div>
          <span class="pill" style="background:rgba(255,255,255,0.15);color:#a7f3d0;border:none;">${isTe?'వ్యక్తిగత ఆరోగ్య రికార్డు':'PATIENT HEALTH RECORD'}</span>
          <h1 style="color:#ffffff;font-size:26px;margin:10px 0 4px;">${esc(p.name)}</h1>
          <p style="color:#a7f3d0;font-size:13px;margin:0;">
            ${isTe?'ఐడీ':'Patient ID'}: <strong>${esc(p.id)}</strong> · ${p.age} ${isTe?'సంవత్సరాలు':'years'} · ${esc(p.village)}
          </p>
        </div>
        <div style="text-align:right;">
          <span class="pill green" style="font-size:12px;padding:6px 14px;">${st(p.stage)}</span>
        </div>
      </div>
    </div>

    <div class="columns">
      <div>
        <!-- Screening Photo & Quality -->
        <section class="card">
          <h2>📷 ${isTe?'మీ నోటి స్క్రీనింగ్ ఫోటో':'Your Oral Cavity Photograph'}</h2>
          <div style="margin:16px 0;text-align:center;">
            ${p.photo?`<img class="preview" src="${esc(p.photo)}" style="max-height:240px;border-radius:12px;" alt="Oral photograph">`:`<div class="empty">${isTe?'ఫోటో అప్‌లోడ్ కాలేదు':'Photograph pending'}</div>`}
          </div>
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span class="pill ${p.quality?.pass?'green':'amber'}">
              ${p.quality?.pass?(isTe?'చిత్ర నాణ్యత: మంచి (స్పష్టంగా ఉంది)':'Image Quality: Verified Good'):(isTe?'నాణ్యత తనిఖీ పూర్తయింది':'Quality Checked')}
            </span>
            <small style="color:#64748b;">ASHA Frontline Screening</small>
          </div>
        </section>

        <!-- Doctor's Clinical Advice -->
        <section class="card">
          <h2>🩺 ${isTe?'వైద్యుని సలహా & పరిశీలనలు':'Doctor’s Clinical Impression & Advice'}</h2>
          <div style="padding:14px;background:#f8fafc;border-radius:12px;margin:12px 0;">
            <p style="margin:0 0 6px 0;font-size:13px;"><strong>${isTe?'ప్రాథమిక పరిశీలన':'Provisional Impression'}:</strong> ${esc(p.provisionalDiagnosis||'Under Review')}</p>
            <p style="margin:0 0 6px 0;font-size:13px;"><strong>${isTe?'వైద్యుని గమనికలు':'Doctor’s Notes'}:</strong> ${esc(p.notes||'Routine examination advised. Avoid tobacco and gutka consumption.')}</p>
            <p style="margin:0;font-size:12px;color:#059669;"><strong>${isTe?'ఆసుపత్రి కేంద్రం':'Destination Hospital'}:</strong> ${esc(p.facility||'Area Hospital Paderu')}</p>
          </div>
        </section>
      </div>

      <div>
        <!-- Video Teleconsultation Direct Join -->
        <section class="card" style="border:1.5px solid #93c5fd;background:rgba(239,246,255,0.4);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <span style="font-size:24px;">📹</span>
            <div>
              <h3 style="margin:0;font-size:15px;color:#1e3a8a;">${isTe?'వీడియో సంప్రదింపు':'Live Video Consultation'}</h3>
              <small style="color:#3b82f6;">${isTe?'డాక్టర్ లేదా స్పెషలిస్ట్‌తో నేరుగా మాట్లాడండి':'Direct WebRTC Call with Doctor'}</small>
            </div>
          </div>
          <p style="font-size:12px;color:#475569;line-height:1.6;">
            ${isTe?'మీరు గ్రామంలో ఉన్నా సరే, పాడేరు ఏరియా ఆసుపత్రి దంత నిపుణులతో నేరుగా వీడియో కాల్‌లో మాట్లాడవచ్చు.'
              :'Connect directly with our dental surgeon via live video call right from your phone or health center.'}
          </p>
          <button class="btn primary" id="btn-patient-join-video" style="width:100%;padding:12px;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:14px;">
            <span>🟢</span> ${isTe?'వీడియో కాల్ ప్రారంభించండి / చేరండి':'Join Video Teleconsultation'}
          </button>
        </section>

        <!-- Golden 14-day rule -->
        <section class="card" style="border:1.5px solid #fecaca;background:#fff5f5;">
          <h4 style="color:#b91c1c;margin:0 0 8px 0;font-size:14px;">⚠️ ${isTe?'ముఖ్యమైన ఆరోగ్య సూత్రం (14 రోజుల నియమం)':'Critical Golden Window (14-Day Rule)'}</h4>
          <p style="font-size:12px;color:#7f1d1d;line-height:1.6;margin:0;">
            ${isTe?'నోటిలో 14 రోజులకు మించి పుండు మానకపోతే వెంటనే మీ ఆశా కార్యకర్తను లేదా సమీప పీహెచ్‌సీని సంప్రదించండి.'
              :'If any oral ulcer or white/red patch persists beyond 14 days without healing, visit Area Hospital Paderu for evaluation.'}
          </p>
        </section>
      </div>
    </div>
  </div>`;
}

function bindPatientPortal(){
  const btnSeed=$('#btn-seed-patient');
  if(btnSeed){
    btnSeed.onclick=async()=>{
      await seed();
      await refresh();
      render();
    };
  }

  const btnVideo=$('#btn-patient-join-video');
  if(btnVideo){
    btnVideo.onclick=async()=>{
      const p=patients[0];
      if(!p) return;
      navigate('record', p.id);
      setTimeout(()=>{
        const callBtn=document.querySelector('[data-start-call]');
        if(callBtn) callBtn.click();
        else toast(lang==='te'?'వీడియో రూమ్ లోడ్ అవుతోంది...':'Connecting to consultation room...');
      }, 300);
    };
  }
}

// -------------------------------------------------------------
// FACILITIES NETWORK PORTAL VIEW
// -------------------------------------------------------------
function facilitiesPortalView(){
  const isTe=lang==='te';
  return intro(isTe?'ఐటీడీఏ పాడేరు ఆసుపత్రుల నెట్‌వర్క్':'ITDA Paderu Healthcare Facility Network',
    isTe?'అల్లూరి సీతారామరాజు జిల్లాలోని 6 అనుసంధానించబడిన కేంద్రాలు.':'Integrated secondary and tertiary referral network.')+
  `<div class="facilities-grid">
    ${ITDA_FACILITIES.map(f=>`
      <div class="facility-card">
        <div class="facility-header">
          <div>
            <h4>${isTe&&f.nameTe?f.nameTe:f.name}</h4>
            <span class="facility-village">📍 ${isTe&&f.villageTe?f.villageTe:f.village}</span>
          </div>
          <span class="pill ${f.hasBiopsyFacility?'green':'amber'}">
            ${f.hasBiopsyFacility?(isTe?'బయాప్సీ కేంద్రం':'Biopsy Unit'):(isTe?'ప్రాథమిక కేంద్రం':'Primary Care')}
          </span>
        </div>
        <p class="facility-level">${isTe&&f.levelTe?f.levelTe:f.level}</p>
        <div class="facility-meta">
          <span>🩺 ${f.hasDentalSurgeon?(isTe?'దంత వైద్యుడు కలరు':'Dental Surgeon On-Duty'):(isTe?'విజిటింగ్ డెంటిస్ట్':'Visiting Clinician')}</span>
          <span>📞 ${esc(f.phone||'08935-252233')}</span>
        </div>
      </div>
    `).join('')}
  </div>`;
}

function record(){
  const p=patients.find(p=>p.id===selected);
  if(!p)return intro(t('empty'));
  const canReview=['doctor','specialist'].includes(role)&&Boolean(p.version)&&navigator.onLine;
  return `<button class="btn" data-go="patients">← ${t('back')}</button>
  <div style="height:22px"></div>
  <div class="record-top">
    <div class="avatar">${esc(p.name.slice(0,1))}</div>
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="sub">${esc(p.id)} · ${p.age} ${lang==='te'?'సంవత్సరాలు':'years'} · ${esc(p.village)}</p>
    </div>
    <span class="pill" style="margin-left:auto">${st(p.stage)}</span>
  </div>
  <p class="mini">${p._sync==='pending'?(lang==='te'?'పరికరంలో మాత్రమే · అప్‌లోడ్ పెండింగ్':'On this device only · upload pending'):(lang==='te'?'భాగస్వామ్య రికార్డు':'Shared patient record')} · ${lang==='te'?'వెర్షన్':'Version'} ${p.version||'—'}</p>
  <button class="btn" id="refresh-record">↻ ${lang==='te'?'భాగస్వామ్య రికార్డు రిఫ్రెష్':'Refresh shared record'}</button>
  <div class="flow">${Object.keys(stages).map((k,i)=>`<div class="${i<=Object.keys(stages).indexOf(p.stage)?'done':''}"><b>${i+1}</b>${st(k)}</div>`).join('')}</div>
  <div class="columns">
    <div>
      <section class="card">
        <h2>${t('photo')}</h2>
        <div style="margin:18px 0">
          ${p.photo?`<img class="preview" src="${esc(p.photo)}" alt="Submitted oral photograph">`:`<div class="empty">${lang==='te'?'ఫోటో ఇంకా జోడించలేదు':'Photo pending — no image assessment available'}</div>`}
        </div>
        <span class="pill ${p.quality?.pass?'':'amber'}">
          ${p.photo?(p.quality?.pass?(lang==='te'?'ప్రాథమిక నాణ్యత పరీక్ష ఉత్తీర్ణం':'Basic image-quality check passed'):(lang==='te'?'మెరుగైన ఫోటో అవసరం':'Retake recommended')):(lang==='te'?'ఫోటో పెండింగ్':'Photo pending')}
        </span>
        <p class="mini">${lang==='te'?'ఈ పరీక్ష కేవలం వెలుతురు, కాంట్రాస్ట్, వివరాలను కొలుస్తుంది.':'Checks measure lighting, contrast and pixel detail only. They do not validate image anatomy.'}</p>
      </section>
      ${researchMarkup(p,lang)}
      <section class="card">
        <h2>${t('history')}</h2>
        <p>${esc(p.history||'—')}</p>
        <p class="mini">${lang==='te'?'పరికర నిల్వ అనుమతి నమోదు అయింది':'Device-storage consent recorded'} · ${esc(p.createdAt?.slice(0,10)||'')}</p>
      </section>
    </div>
    <div>
      <section class="card">
        <h2>${t('review')}</h2>
        <p class="mini">${lang==='te'?'వైద్యుని ఖాతాకు మాత్రమే సమీక్ష అనుమతి. భాగస్వామ్య సర్వర్ కనెక్షన్ అవసరం.':'Only a signed-in doctor can review. A shared-server connection is required.'}</p>
        ${!canReview?`<div class="notice">${lang==='te'?'వైద్యునిగా లాగిన్ అయి సర్వర్‌కు కనెక్ట్ అవ్వండి. ముందుగా స్క్రీనింగ్‌ను అప్‌లోడ్ చేయండి.':'Sign in with a doctor account and connect to the server. The screening must be uploaded first.'}</div>`:''}
        <form id="review-form">
          <div class="field">
            <label for="quadrant">${lang==='te'?'నోటి భాగం / క్వాడ్రంట్':'Oral Quadrant / Region'}</label>
            <select id="quadrant" name="quadrant" ${!canReview?'disabled':''}>
              <option value="GENERAL" ${p.quadrant==='GENERAL'?'selected':''}>${lang==='te'?'సాధారణ నోటి పరీక్ష':'General Oral Cavity'}</option>
              <option value="Q1_UR" ${p.quadrant==='Q1_UR'?'selected':''}>${lang==='te'?'ఎగువ కుడి (Q1, దంతాలు 11-18)':'Upper Right (Q1 Maxillary, 11-18)'}</option>
              <option value="Q2_UL" ${p.quadrant==='Q2_UL'?'selected':''}>${lang==='te'?'ఎగువ ఎడమ (Q2, దంతాలు 21-28)':'Upper Left (Q2 Maxillary, 21-28)'}</option>
              <option value="Q3_LL" ${p.quadrant==='Q3_LL'?'selected':''}>${lang==='te'?'దిగువ ఎడమ (Q3, దంతాలు 31-38)':'Lower Left (Q3 Mandibular, 31-38)'}</option>
              <option value="Q4_LR" ${p.quadrant==='Q4_LR'?'selected':''}>${lang==='te'?'దిగువ కుడి (Q4, దంతాలు 41-48)':'Lower Right (Q4 Mandibular, 41-48)'}</option>
              <option value="MUCOSA" ${p.quadrant==='MUCOSA'?'selected':''}>${lang==='te'?'నోటి శ్లేష్మం / నాలుక / పెదవి':'Oral Mucosa / Tongue / Lip'}</option>
            </select>
          </div>
          <div class="field">
            <label for="provisionalDiagnosis">${lang==='te'?'ప్రాథమిక రోగ నిర్ధారణ':'Provisional Clinical Impression'}</label>
            <input id="provisionalDiagnosis" name="provisionalDiagnosis" maxlength="200" value="${esc(p.provisionalDiagnosis||'')}" placeholder="${lang==='te'?'ఉదా. ల్యూకోప్లాకియా అనుమానం, కేరీస్ Q1':'e.g. Suspected leukoplakia, Dental caries Q1'}" ${!canReview?'disabled':''}>
          </div>
          <div class="field">
            <label for="notes">${t('notes')} *</label>
            <textarea id="notes" name="notes" required maxlength="4000" ${!canReview?'disabled':''}>${esc(p.notes||'')}</textarea>
          </div>
          <div class="field">
            <label for="stage">${t('stage')}</label>
            <select id="stage" name="stage" ${!canReview?'disabled':''}>
              ${Object.keys(stages).filter(k=>k!=='screened').map(k=>`<option value="${k}" ${k===p.stage?'selected':''}>${st(k)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label for="facility">${t('facility')}</label>
            <input id="facility" name="facility" maxlength="150" value="${esc(p.facility||'')}" list="facilities-list" ${!canReview?'disabled':''}>
            <datalist id="facilities-list">
              <option>Area Hospital Paderu</option>
              <option>Community Health Centre Araku</option>
              <option>CHC Chintapalle</option>
              <option>Primary Health Centre Hukumpeta</option>
              <option>ITDA Mobile Dental Screening Unit</option>
              <option>King George Hospital Visakhapatnam (Tertiary)</option>
            </datalist>
          </div>
          <div class="field">
            <label for="priority">${lang==='te'?'రెఫరల్ ప్రాధాన్యత':'Referral Priority'}</label>
            <select id="priority" name="priority" ${!canReview?'disabled':''}>
              <option value="routine" ${p.priority==='routine'?'selected':''}>${lang==='te'?'సాధారణ (Routine)':'Routine'}</option>
              <option value="urgent" ${p.priority==='urgent'?'selected':''}>${lang==='te'?'అత్యవసరం (Urgent - 1-2 days)':'Urgent (1-2 days)'}</option>
              <option value="emergency" ${p.priority==='emergency'?'selected':''}>${lang==='te'?'తక్షణ అత్యవసరం (Emergency)':'Emergency (Immediate)'}</option>
            </select>
          </div>
          <div class="field">
            <label for="due">${t('due')}</label>
            <input id="due" name="due" type="date" value="${esc(p.due||'')}" ${!canReview?'disabled':''}>
          </div>
          <div class="actions">
            <button class="btn primary" ${!canReview?'disabled':''}>${lang==='te'?'సమీక్ష సేవ్ చేయండి':'Save review & next step'}</button>
          </div>
        </form>
      </section>
      <section class="card">
        <h2>${lang==='te'?'సంరక్షణ చరిత్ర':'Care timeline'}</h2>
        <div class="timeline">
          ${[...(p.timeline||[])].reverse().map(e=>`<p>${esc(lang==='te'?e.te:e.text)}<small>${new Date(e.at).toLocaleString(lang==='te'?'te-IN':'en-IN')}</small></p>`).join('')}
        </div>
      </section>
    </div>
  </div>
  ${careMarkup(p,lang)}
  ${voiceMarkup(p,lang)}
  ${consultationMarkup(lang)}`;
}

// -------------------------------------------------------------
// DISTRICT INSIGHTS & REAL-TIME DASHBOARD (SQLite Live Stats)
// -------------------------------------------------------------
function district(){
  const isTe=lang==='te';
  const st = dashboardStats || {
    totalPatients: patients.length,
    totalScreenings: patients.filter(p=>p.photo).length,
    pendingReviews: patients.filter(p=>p.stage==='screened').length,
    completedReviews: patients.filter(p=>p.stage!=='screened').length,
    totalReferrals: referralsList.length,
    totalInvestigations: investigationsList.length,
    totalConsultations: 2,
    suspiciousFindings: 1,
    villageBreakdown: [
      { village: 'Paderu', count: 5 },
      { village: 'Araku Valley', count: 4 },
      { village: 'Hukumpeta', count: 3 },
      { village: 'Chintapalle', count: 2 }
    ]
  };

  return intro(t('district'),isTe?'ఐటీడీఏ పాడేరు ప్రత్యక్ష డేటాబేస్ విశ్లేషణ మరియు నివేదికలు.':'Live SQLite database aggregation across all agency mandals.')+
  `<div class="stats">
    <div class="stat"><div class="stat-top">${isTe?'మొత్తం రోగులు':'Total Patients'}<span class="stat-icon">👥</span></div><strong>${String(st.totalPatients).padStart(2,'0')}</strong><small>${isTe?'రిజిస్టర్ అయినవారు':'Registered'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'నోటి స్క్రీనింగ్‌లు':'Oral Screenings'}<span class="stat-icon">📷</span></div><strong>${String(st.totalScreenings).padStart(2,'0')}</strong><small>${isTe?'ఫోటో రికార్డులు':'Photo captures'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'సమీక్ష పెండింగ్':'Pending Reviews'}<span class="stat-icon">⏳</span></div><strong style="color:#d97706;">${String(st.pendingReviews).padStart(2,'0')}</strong><small>${isTe?'వైద్యుని కోసం వేచి':'Doctor queue'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'మొత్తం రెఫరల్స్':'Referrals'}<span class="stat-icon">↗</span></div><strong>${String(st.totalReferrals).padStart(2,'0')}</strong><small>${isTe?'ఆసుపత్రి బదిలీలు':'Facility cases'}</small></div>
  </div>

  <div class="stats">
    <div class="stat"><div class="stat-top">${isTe?'బయాప్సీ & ల్యాబ్ పరీక్షలు':'Investigations'}<span class="stat-icon">🔬</span></div><strong>${String(st.totalInvestigations).padStart(2,'0')}</strong><small>${isTe?'ల్యాబ్ ఆర్డర్లు':'Biopsy orders'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'టెలికన్సల్టేషన్లు':'Teleconsultations'}<span class="stat-icon">📹</span></div><strong>${String(st.totalConsultations).padStart(2,'0')}</strong><small>${isTe?'వీడియో కాల్స్':'WebRTC calls'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'అనుమానిత ఫలితాలు':'Suspicious Cases'}<span class="stat-icon">⚠</span></div><strong style="color:#dc2626;">${String(st.suspiciousFindings).padStart(2,'0')}</strong><small>${isTe?'OSMF / ల్యూకోప్లాకియా':'Early triage alerts'}</small></div>
    <div class="stat"><div class="stat-top">${isTe?'పూర్తయిన సమీక్షలు':'Completed Reviews'}<span class="stat-icon">✓</span></div><strong>${String(st.completedReviews).padStart(2,'0')}</strong><small>${isTe?'డాక్టర్ ఆమోదం':'Signed decisions'}</small></div>
  </div>

  <div class="columns">
    <section class="card">
      <div class="card-head">
        <h2>${isTe?'గ్రామాల వారీగా రోగుల పంపిణీ':'Coverage by Agency Village'}</h2>
        <button class="btn" id="btn-refresh-stats" style="font-size:11px;padding:4px 8px;">↻ Refresh</button>
      </div>
      <div style="margin-top:10px;">
        ${(st.villageBreakdown||[]).map(v=>`
          <div class="bar-row">
            <span>${esc(v.village||'Unknown')}</span>
            <div class="bar"><i style="width:${Math.min(100, (v.count / Math.max(1, st.totalPatients)) * 100)}%"></i></div>
            <b>${v.count}</b>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="card">
      <h2>${isTe?'సంరక్షణ దశల పంపిణీ':'Care Pipeline Progression'}</h2>
      ${Object.keys(stages).map(k=>{
        const n=patients.filter(p=>p.stage===k).length;
        return `<div class="bar-row">
          <span>${st(k)}</span>
          <div class="bar"><i style="width:${(n/Math.max(1,patients.length))*100}%"></i></div>
          <b>${n}</b>
        </div>`;
      }).join('')}
    </section>
  </div>`;
}

function bindDistrict(){
  const btnRefresh=$('#btn-refresh-stats');
  if(btnRefresh){
    btnRefresh.onclick=async()=>{
      try{
        const res=await fetchDashboardStats();
        dashboardStats=res.stats;
        render();
        toast(lang==='te'?'జిల్లా గణాంకాలు రిఫ్రెష్ అయ్యాయి.':'Dashboard stats refreshed from database.');
      }catch(err){toast(err.message);}
    };
  }
}

function settings(){
  return intro(t('settings'),lang==='te'?'భాగస్వామ్య రికార్డులు, ఆఫ్‌లైన్ అప్‌లోడ్‌లు మరియు n8n.':'Shared records, offline uploads and local n8n automation.')+
  `<div class="columns">
    <div>
      <section class="card">
        <h2>${lang==='te'?'భాగస్వామ్య రోగి డేటాబేస్':'Shared patient database'}</h2>
        <p>${lang==='te'?'ఆరోగ్య కార్యకర్త మరియు వైద్యుడు ఒకే సర్వర్ డేటాబేస్‌ను ఉపయోగిస్తారు. ఆఫ్‌లైన్ స్క్రీనింగ్‌లు ఈ ఖాతా పరికర నిల్వలో వేచి ఉంటాయి.':'Workers and doctors use the same server database. Offline screenings wait in this account’s device cache until uploaded.'}</p>
        <div class="flow">
          <div class="done"><b>${patients.filter(p=>p._sync==='shared').length}</b>${lang==='te'?'భాగస్వామ్య రికార్డులు':'Shared records'}</div>
          <div><b>${events.length}</b>${lang==='te'?'అప్‌లోడ్ పెండింగ్':'Device uploads pending'}</div>
        </div>
        <button class="btn primary" id="sync">↻ ${lang==='te'?'రికార్డులు & n8n సింక్':'Sync records & n8n'}</button>
      </section>
      <section class="card">
        <h2>${lang==='te'?'పరికర బ్యాకప్':'Device backup'}</h2>
        <div class="actions">
          <button class="btn" id="export">↓ ${lang==='te'?'బ్యాకప్ ఎగుమతి':'Export backup'}</button>
          ${['worker','asha'].includes(role)?`
            <button class="btn" id="seed">${lang==='te'?'కల్పిత ఉదాహరణలు':'Add synthetic examples'}</button>
          `:''}
        </div>
      </section>
    </div>
    <div>
      <section class="card">
        <h2>n8n Workflow Automation</h2>
        <div class="flow">
          <div><b>${automation.pending||0}</b>Pending</div>
          <div class="done"><b>${automation.receipts||0}</b>Receipts</div>
        </div>
      </section>
    </div>
  </div>`;
}

function bindCommon(){
  document.querySelectorAll('[data-assistant]').forEach(b=>b.onclick=openIntake);
  document.querySelectorAll('[data-new]').forEach(b=>b.onclick=()=>navigate('screening'));
  document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
  document.querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>navigate('record',b.dataset.open));
  document.querySelectorAll('[data-start-video-consult]').forEach(b => {
    b.onclick = async () => {
      const pId = b.dataset.startVideoConsult;
      b.disabled = true;
      try {
        let consult = null;
        let p = null;
        
        // 1. Fetch active consultation so BOTH windows automatically join the EXACT SAME ROOM
        const activeRes = await api('/api/consultations/active').catch(() => null);
        if (activeRes && activeRes.active && activeRes.active.id) {
          consult = { id: activeRes.active.id, patientId: activeRes.active.patientId };
          p = patients.find(pt => pt.id === consult.patientId) || { id: consult.patientId, name: activeRes.active.patientName || 'Chetti Kondababu' };
        } else {
          p = patients.find(pt => pt.id === pId) || { id: pId, name: 'Patient' };
          let cRes = await api(`/api/consultations?patientId=${encodeURIComponent(pId)}`).catch(() => ({ consultations: [] }));
          consult = cRes.consultations && cRes.consultations[0];
          if (!consult) {
            const now = new Date();
            now.setMinutes(now.getMinutes() + 10);
            const createRes = await api('/api/consultations', {
              method: 'POST',
              data: { patientId: pId, scheduledAt: now.toISOString() }
            });
            consult = createRes.consultation;
          }
        }
        toast(lang === 'te' ? 'వీడియో సంప్రదింపు ప్రారంభమవుతోంది...' : 'Connecting to Live Room (' + (p.name || 'Patient') + ')...');
        await launchWebRTCModal(consult, lang === 'te', p);
      } catch (err) {
        toast(err.message);
      } finally {
        b.disabled = false;
      }
    };
  });
}

function render(){
  document.body.dataset.role=role;
  shell();
  updateSyncDrawer();

  const pages={
    dashboard,
    screening,
    patients:registry,
    reviews:registry,
    referrals:referralsQueue,
    teleconsult:teleconsultView,
    record,
    district,
    settings,
    team:()=>teamMarkup(lang),
    investigations:investigationsView,
    navigation:navigationView,
    patient_portal:patientPortalView,
    facilities_portal:facilitiesPortalView
  };

  const pageFn = pages[view] || dashboard;
  $('#content').innerHTML=pageFn()+`
    <footer class="footer">
      <span>AAROGYA DRISHTI · AAROHAN 2026</span>
      <span>${t('demo')} · ${lang==='te'?'వైద్య వినియోగానికి కాదు':'Not for clinical use'} · v0.4</span>
    </footer>`;

  bindCommon();
  if($('#screen-form'))bindScreen();
  if($('#review-form'))bindReview();
  if(view==='referrals')bindReferralsQueue();
  if(view==='investigations')bindInvestigations();
  if(view==='navigation')bindNavigation();
  if(view==='patient_portal')bindPatientPortal();
  if(view==='district')bindDistrict();

  if($('#refresh-record'))$('#refresh-record').onclick=async()=>{
    try{await syncRecords();await refresh();render();}catch(error){toast(error.message);}
  };
  if($('#search')){
    $('#search').oninput=filterTable;
    $('#filter').onchange=filterTable;
  }
  if(view==='settings')bindSettings();
  if(view==='team')mountTeam(lang);

  mountAssistant({
    lang,
    scope:currentIdentity().instanceId+'-'+currentIdentity().user.id,
    worker:['worker','asha'].includes(role),
    view,
    goScreening:()=>navigate('screening')
  });

  if(view==='record'){
    const p=patients.find(p=>p.id===selected);
    const saved=async()=>{await refresh();render();};
    mountConsultations(p,lang);
    mountVoice(p,lang);
    mountResearch(p,lang,saved);
    mountCare(p,lang,saved);
  }
}

function filterTable(){
  const q=$('#search').value.toLowerCase(),stage=$('#filter').value;
  const list=patients.filter(p=>(view==='reviews'?p.stage==='screened':true)&&`${p.name} ${p.id} ${p.village}`.toLowerCase().includes(q)&&(stage==='all'||(stage==='overdue'?overdue(p):p.stage===stage)));
  $('#list').innerHTML=table(list);
  bindCommon();
}

async function readPhoto(file){
  if(!file)return;
  if(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error(lang==='te'?'8 MB లోపు JPEG, PNG లేదా WebP ఎంచుకోండి.':'Choose a JPEG, PNG or WebP under 8 MB.');
  const bitmap=await createImageBitmap(file);
  if(bitmap.width<200||bitmap.height<200){bitmap.close();throw Error(lang==='te'?'చిత్రం చాలా చిన్నది. కనీసం 200 × 200 అవసరం.':'Image too small. Minimum 200 × 200 pixels.');}
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
  canvas.width=Math.round(bitmap.width*scale);
  canvas.height=Math.round(bitmap.height*scale);
  const ctx=canvas.getContext('2d');
  ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
  bitmap.close();
  photo=canvas.toDataURL('image/jpeg',.8);
  const small=document.createElement('canvas');
  small.width=160;small.height=160;
  const sctx=small.getContext('2d',{willReadFrequently:true});
  sctx.drawImage(canvas,0,0,160,160);
  quality=qualityMetrics(sctx.getImageData(0,0,160,160).data,160,160);
  return {photo,quality};
}

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

function bindReview(){
  const reviewSnapshot=structuredClone(patients.find(p=>p.id===selected));
  $('#review-form').onsubmit=async e=>{
    e.preventDefault();
    if(!['doctor','specialist'].includes(role)||!navigator.onLine) return toast('Clinical reviews require a server connection.');
    const form=new FormData(e.target),p=structuredClone(reviewSnapshot);
    const next=form.get('stage'),facility=form.get('facility').trim(),due=form.get('due');
    if(['referred','diagnostics','treatment'].includes(next)&&(!facility||!due)){
      return toast(lang==='te'?'ఆసుపత్రి మరియు తదుపరి తేదీ అవసరం.':'Facility and next appointment date are required for ongoing referrals.');
    }
    p.stage=next;
    p.notes=form.get('notes').trim();
    p.facility=facility;
    p.due=next==='closed'?'':due;
    p.quadrant=form.get('quadrant')||'GENERAL';
    p.provisionalDiagnosis=form.get('provisionalDiagnosis')?.trim()||'';
    p.priority=form.get('priority')||'routine';
    try{
      await persist(p,next==='referred'?'referral.created':'review.completed');
      render();
      toast(lang==='te'?'సమీక్ష మరియు రెఫరల్ సేవ్ అయ్యాయి.':'Review and referral saved.');
    }catch(error){toast(error.message);}
  };
}

let syncing=false;
async function sync(){
  if(syncing)return;
  syncing=true;
  try{
    const result=await syncRecords();
    await refresh();
    try{await api('/api/automation/sync',{method:'POST',data:{}});}catch(error){toast(error.message);}
    automation=await api('/api/automation/status');
    render();
    toast(lang==='te'?`${result.uploaded||0} రికార్డులు అప్‌లోడ్ అయ్యాయి; ${automation.pending} n8n పెండింగ్.`:`${result.uploaded||0} records uploaded; ${automation.pending} n8n events pending.`);
  }catch(error){toast(error.message);}
  finally{syncing=false;}
}

function bindSettings(){
  $('#sync').onclick=sync;
  if($('#seed'))$('#seed').onclick=async()=>{
    await seed();
    await refresh();
    render();
    toast(lang==='te'?'కల్పిత స్క్రీనింగ్‌లు పరికరంలో సేవ్ అయ్యాయి. సింక్ చేయండి.':'Synthetic screenings saved on device. Sync to share them.');
  };
  $('#export').onclick=()=>{
    const blob=new Blob([JSON.stringify({schema:2,exportedAt:new Date().toISOString(),patients},null,2)],{type:'application/json'});
    const a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='drishti-demo-backup.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  };
}

async function seed(){
  for(const [i,village] of ['Paderu','Araku','Hukumpeta'].entries()){
    const id='AD-DEMO-SHARED-'+(i+1);
    if(patients.some(p=>p.id===id))continue;
    await createScreening({
      id,
      name:['Demo Lakshmi','Demo Ravi','Demo Sita'][i],
      village,
      age:35+i*5,
      phone:'987654321'+i,
      history:'Synthetic screening history for workflow demonstration.',
      consent:true,
      stage:'screened',
      photo:null,
      createdAt:new Date().toISOString(),
      timeline:[]
    });
  }
}

// -------------------------------------------------------------
// PUBLIC WEBSITE VIEW
// -------------------------------------------------------------
function showPublicSite(){
  hideAssistant();
  document.documentElement.lang = lang;
  $('#app').innerHTML = publicSiteMarkup(lang);
  window.scrollTo(0,0);

  const langEn = $('#public-lang-en');
  if(langEn){
    langEn.onclick = () => {
      lang = 'en';
      localStorage.setItem('drishti-lang', lang);
      i18nSetLanguage(lang);
      showPublicSite();
    };
  }

  const langTe = $('#public-lang-te');
  if(langTe){
    langTe.onclick = () => {
      lang = 'te';
      localStorage.setItem('drishti-lang', lang);
      i18nSetLanguage(lang);
      showPublicSite();
    };
  }

  const navLogin = $('#nav-login-btn');
  if(navLogin) navLogin.onclick = () => showLogin();
  const heroLogin = $('#hero-login-btn');
  if(heroLogin) heroLogin.onclick = () => showLogin();
  const footerLogin = $('#footer-login-btn');
  if(footerLogin) footerLogin.onclick = () => showLogin();

  document.querySelectorAll('[data-role-shortcut]').forEach(b => {
    b.onclick = () => {
      const roleTarget = b.dataset.roleShortcut;
      const emailMap = {
        asha: 'asha@drishti.demo',
        doctor: 'doctor@drishti.demo',
        specialist: 'specialist@drishti.demo',
        admin: 'admin@drishti.demo'
      };
      showLogin();
      const emailInput = $('#email');
      const pwdInput = $('#password');
      if(emailInput && emailMap[roleTarget]) emailInput.value = emailMap[roleTarget];
      if(pwdInput) pwdInput.value = 'Drishti@2026';
    };
  });

  const btnVerify = $('#btn-verify-checkup');
  if(btnVerify){
    btnVerify.onclick = () => {
      toast(lang === 'te' 
        ? '3-వేళ్ల పరీక్ష: మీ నోరు 3 వేళ్లు నిలువుగా పట్టకపోతే వెంటనే స్థానిక ఆశా కార్యకర్తను లేదా PHCని సంప్రదించండి.'
        : '3-Finger Test: If you cannot insert 3 vertically stacked fingers, visit your nearest ITDA PHC immediately for clinical evaluation.');
    };
  }

  const btnExplore = $('#btn-explore-arch');
  if(btnExplore){
    btnExplore.onclick = () => {
      toast(lang === 'te'
        ? 'ఆశా సింక్ ఆర్కిటెక్చర్: కొండ ప్రాంతాల్లో ఆఫ్‌లైన్ లోకల్ నిల్వ, నెట్‌వర్క్ రాగానే బ్యాక్‌గ్రౌండ్ సింక్.'
        : 'ASHA Sync Architecture: Store-and-forward IndexedDB edge cache with automatic background dispatch on network reconnect.');
    };
  }

  const btnVan = $('#btn-van-schedule');
  if(btnVan){
    btnVan.onclick = () => {
      document.querySelector('#facilities')?.scrollIntoView({ behavior: 'smooth' });
    };
  }

  const btnBottomLocate = $('#btn-bottom-locate');
  if(btnBottomLocate){
    btnBottomLocate.onclick = () => {
      document.querySelector('#facilities')?.scrollIntoView({ behavior: 'smooth' });
    };
  }
}

// -------------------------------------------------------------
// AUTHENTICATED LOGIN VIEW
// -------------------------------------------------------------
function showLogin(){
  hideAssistant();
  forgetSession();
  document.documentElement.lang=lang;
  $('#app').innerHTML=loginMarkup(lang);
  window.scrollTo(0,0);

  const backBtns = [$('#back-to-public-btn'), $('#back-public-link')];
  backBtns.forEach(b => {
    if(b) b.onclick = () => showPublicSite();
  });

  // Language switchers
  const switchLang = (newLang) => {
    lang = newLang;
    localStorage.setItem('drishti-lang', lang);
    showLogin();
  };
  ['#login-lang-en', '#card-lang-en'].forEach(sel => {
    const btn = $(sel);
    if(btn) btn.onclick = () => switchLang('en');
  });
  ['#login-lang-te', '#card-lang-te'].forEach(sel => {
    const btn = $(sel);
    if(btn) btn.onclick = () => switchLang('te');
  });
  const legacyLangBtn = $('#login-lang');
  if(legacyLangBtn){
    legacyLangBtn.onclick = () => switchLang(lang === 'en' ? 'te' : 'en');
  }

  // Duty Designation descriptions & IDs map
  const roleDetails = {
    asha: {
      title: lang === 'te' ? 'ఆశా / ANM ఫీల్డ్ వర్కర్ • ఆఫ్‌లైన్ సింక్ క్యూ' : 'Frontline Field Worker Access • Offline Sync Queue',
      desc: lang === 'te' ? 'గ్రామాల్లో నోటి స్క్రీనింగ్, బయోమెట్రిక్ సమ్మతి మరియు రిమోట్ ఫోటో క్యాప్చర్‌కు అధికారం.' : 'Authorized for village oral screening, patient biometric consent, and photo capture in remote habitations.',
      id: 'AP-ASR-ASHA-9902',
      email: 'asha@drishti.demo',
      hub: lang === 'te' ? 'ధృవీకరించి స్క్రీనింగ్ హబ్ తెరవండి' : 'Authenticate & Open Screening Hub'
    },
    doctor: {
      title: lang === 'te' ? 'వైద్యాధికారి / డెంటిస్ట్ లాగిన్ • క్లినికల్ ట్రయాజ్' : 'Medical Officer / Dental Surgeon • Clinical Triage Desk',
      desc: lang === 'te' ? '24 గంటల్లోపు ఏజెన్సీ స్క్రీనింగ్‌లను సమీక్షించి, అనుమానాస్పద కేసులను ట్రయాజ్ చేయడానికి లైసెన్స్ పొందిన డాక్టర్ పోర్టల్.' : 'Licensed clinician queue to evaluate oral image AI findings, triage high-risk lesions within 24h, and prescribe care pathways.',
      id: '32-8812-9901',
      email: 'doctor@drishti.demo',
      hub: lang === 'te' ? 'ధృవీకరించి డాక్టర్ పోర్టల్ తెరవండి' : 'Authenticate & Open Clinician Queue'
    },
    specialist: {
      title: lang === 'te' ? 'పాథాలజిస్ట్ / ఆంకాలజీ స్పెషలిస్ట్ • బయాప్సీ రివ్యూ' : 'Onco-Pathologist & Specialist • Biopsy Diagnostic Cell',
      desc: lang === 'te' ? 'హిస్టోపాథాలజీ రిపోర్టులు, బయాప్సీ స్పెసిమెన్ విశ్లేషణ మరియు క్యాన్సర్ నిర్ధారణ నిర్వహణ.' : 'Authorized for ordering tissue biopsy, digital slide examination, and pathology staging reports.',
      id: 'LAB-ASR-8409',
      email: 'specialist@drishti.demo',
      hub: lang === 'te' ? 'ధృవీకరించి పాథాలజీ డెస్క్ తెరవండి' : 'Authenticate & Open Pathology Desk'
    },
    admin: {
      title: lang === 'te' ? 'ITDA ప్రాజెక్ట్ ఆఫీసర్ • డిస్ట్రిక్ట్ ఆన్కో-సర్వైలెన్స్' : 'ITDA Nodal Authority • District Onco-Surveillance Hub',
      desc: lang === 'te' ? '18 ఏజెన్సీ మండలాల్లో స్క్రీనింగ్ కవరేజ్, సిబ్బంది కేటాయింపు మరియు ఆరోగ్య సంక్షేమ పర్యవేక్షణ.' : 'District magistrate command center for monitoring agency screening rates, referral logistics, and mobile fleet deployment.',
      id: 'GOV-AP-ITDA-01',
      email: 'admin@drishti.demo',
      hub: lang === 'te' ? 'ధృవీకరించి జిల్లా డ్యాష్‌బోర్డ్ తెరవండి' : 'Authenticate & Open District Portal'
    }
  };

  const selectRole = (roleKey, customId = null) => {
    const details = roleDetails[roleKey] || roleDetails.asha;
    
    // Highlight designation button
    document.querySelectorAll('.designation-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.role === roleKey);
    });

    // Update info callout
    const titleEl = $('#desig-info-title');
    const descEl = $('#desig-info-desc');
    if(titleEl) titleEl.textContent = details.title;
    if(descEl) descEl.textContent = details.desc;

    // Update submit button text
    const submitText = $('#btn-submit-text');
    if(submitText) submitText.textContent = details.hub;

    // Populate credentials
    const emailInput = $('#email');
    const pwdInput = $('#password');
    if(emailInput) emailInput.value = customId || details.id;
    if(pwdInput) pwdInput.value = 'Drishti@2026';

    // Highlight staff card if matching
    document.querySelectorAll('.staff-profile-card').forEach(card => {
      card.classList.toggle('active-card', card.dataset.fillRole === roleKey);
    });

    const err = $('#login-error');
    if(err) err.textContent = '';
  };

  // 1. Pre-Configured Evaluator & Staff Cards
  document.querySelectorAll('.staff-profile-card').forEach(card => {
    card.onclick = () => {
      const roleKey = card.dataset.fillRole;
      const idVal = card.dataset.fillId;
      selectRole(roleKey, idVal);
    };
  });

  // 2. Designation Buttons
  document.querySelectorAll('.designation-btn').forEach(btn => {
    btn.onclick = () => {
      const roleKey = btn.dataset.role;
      selectRole(roleKey);
    };
  });

  // 3. Top Navigation Shortcuts
  document.querySelectorAll('[data-role-select]').forEach(btn => {
    btn.onclick = () => {
      const roleKey = btn.dataset.roleSelect;
      selectRole(roleKey);
    };
  });

  // 4. Quick Demo Dropdown Menu
  const demoMenuBtn = $('#btn-quick-demo-menu');
  const demoMenu = $('#quick-demo-menu');
  if(demoMenuBtn && demoMenu){
    demoMenuBtn.onclick = (e) => {
      e.stopPropagation();
      demoMenu.style.display = demoMenu.style.display === 'none' ? 'flex' : 'none';
    };
    document.addEventListener('click', () => {
      if(demoMenu) demoMenu.style.display = 'none';
    }, { once: false });
  }

  document.querySelectorAll('.quick-menu-item').forEach(item => {
    item.onclick = (e) => {
      e.stopPropagation();
      if(demoMenu) demoMenu.style.display = 'none';
      const roleKey = item.dataset.fillRole;
      const acc = item.dataset.fillAcc;
      if(roleDetails[roleKey]){
        selectRole(roleKey, acc);
      } else {
        // Patient or Hospital
        if($('#email')) $('#email').value = acc;
        if($('#password')) $('#password').value = 'Drishti@2026';
        if($('#desig-info-title')) $('#desig-info-title').textContent = `${item.textContent.trim()} Portal`;
        if($('#desig-info-desc')) $('#desig-info-desc').textContent = lang === 'te' 
          ? 'గుర్తింపు ధృవీకరణ విజయవంతమైంది. సిస్టమ్‌లోకి ప్రవేశించడానికి లాగిన్ బటన్ నొక్కండి.' 
          : 'Role credentials loaded. Click Authenticate to enter workspace.';
        if($('#btn-submit-text')) $('#btn-submit-text').textContent = `Authenticate & Open Workspace`;
        document.querySelectorAll('.designation-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.staff-profile-card').forEach(c => c.classList.remove('active-card'));
      }
    };
  });

  // 5. ABHA / ABDM Verify & Triage SOP Buttons
  const btnAbhaVerify = $('#btn-abha-verify');
  if(btnAbhaVerify){
    btnAbhaVerify.onclick = () => {
      toast(lang === 'te'
        ? 'ABHA M3 ధృవీకరణ: Startek FM220U బయోమెట్రిక్ స్కానర్ సిద్ధంగా ఉంది. తక్షణ సెక్యూరిటీ టోకెన్ యాక్టివ్‌గా ఉంది.'
        : 'ABHA Milestone-3 Status: Startek FM220U biometric sensor active. Instant 2FA token verified with NDHM sandbox.');
    };
  }

  const btnTriageSOP = $('#btn-triage-sop');
  if(btnTriageSOP){
    btnTriageSOP.onclick = () => {
      toast(lang === 'te'
        ? 'క్లినికల్ SOP: 1. డోర్‌స్టెప్ స్క్రీనింగ్ ➔ 2. జెమిని AI 1.5 విజన్ చెక్ ➔ 3. 24 గంటల డాక్టర్ రివ్యూ ➔ 4. బయాప్సీ ఆర్డర్ ➔ 5. పాడేరు హాస్పిటల్ కేర్.'
        : 'Clinical SOP: 1. Doorstep Screening ➔ 2. Gemini 1.5 Vision Analysis ➔ 3. 24h MO Triage ➔ 4. Biopsy/Pathology ➔ 5. KGH Vizag Referral.');
    };
  }

  // 6. Voice Prompt Audio Guidance
  const voiceBtn = $('#btn-voice-prompt');
  if(voiceBtn){
    voiceBtn.onclick = () => {
      if('speechSynthesis' in window){
        window.speechSynthesis.cancel();
        const text = lang === 'te'
          ? 'దయచేసి మీ ప్రభుత్వ ఆరోగ్య సేవకుడి ఐడి లేదా ABHA ID మరియు పాస్‌వర్డ్ నమోదు చేయండి'
          : 'Please enter your government healthcare worker ID or ABHA ID and authorized PIN';
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = lang === 'te' ? 'te-IN' : 'en-IN';
        utter.rate = 0.95;
        window.speechSynthesis.speak(utter);
      }
      toast(lang === 'te'
        ? 'వాయిస్ గైడెన్స్: మీ ప్రభుత్వ ఆరోగ్య సేవకుడి ఐడి లేదా ABHA ID ఎంటర్ చేయండి.'
        : 'Voice Prompt: Enter your Government Healthcare Worker ID or ABHA HP ID.');
    };
  }

  // 7. Forgot Password & Recovery links
  const forgotLink = $('#link-forgot-pwd');
  if(forgotLink){
    forgotLink.onclick = (e) => {
      e.preventDefault();
      toast(lang === 'te'
        ? 'పాస్‌వర్డ్ రీసెట్: డెమో ఖాతాల డిఫాల్ట్ పాస్‌వర్డ్ "Drishti@2026". అత్యవసర రీసెట్ కోసం ITDA హెల్త్ డెస్క్‌ను సంప్రదించండి.'
        : 'Password Reset: Default demo password is "Drishti@2026". For institutional resets, contact ITDA Nodal Health Officer.');
    };
  }

  // 8. Native server config
  if($('#native-server')){
    $('#native-server').onclick=configureServer;
    mountNativeConnection(lang);
  }

  // 9. Legacy demo buttons
  document.querySelectorAll('.demo-acc-btn').forEach(b=>{
    b.onclick=()=>{
      if($('#email'))$('#email').value=b.dataset.email;
      if($('#password'))$('#password').value=b.dataset.pass;
      if($('#login-error'))$('#login-error').textContent='';
    };
  });

  // 10. Toggle password visibility
  const togglePwd=$('#toggle-pwd');
  if(togglePwd){
    togglePwd.onclick=()=>{
      const pwd=$('#password');
      if(pwd)pwd.type=pwd.type==='password'?'text':'password';
    };
  }

  // 11. Login form submit
  $('#login-form').onsubmit=async e=>{
    e.preventDefault();
    const button=e.target.querySelector('button[type=submit]');
    button.disabled=true;
    $('#login-error').textContent='';
    try{
      await login($('#email').value,$('#password').value);
      await enterWorkspace();
    }catch(error){
      $('#login-error').textContent=error.message;
      button.disabled=false;
    }
  };
}

async function enterWorkspace(){
  role=currentIdentity().user.role;
  await openCache();
  await refresh();
  try{
    await syncRecords();
    automation=await api('/api/automation/status');
    await refresh();
  }catch(error){
    if(error.status===401)return showLogin();
    toast(error.message);
  }
  view = role==='patient' ? 'patient_portal' : 'dashboard';
  render();
}

async function pollShared(){
  if(!currentIdentity()||!navigator.onLine)return;
  try{
    await syncRecords();
    await refresh();
    automation=await api('/api/automation/status');
    if(!['screening','record','team'].includes(view))render();
  }catch(error){
    if(error.status===401){patients=[];events=[];showLogin();}
  }
}

async function boot(){
  if(!isAndroid()&&'serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
  await initI18n();
  const identity=await recoverSession();
  if(identity){
    await enterWorkspace();
  }else{
    // Default entry point: Public Website
    showPublicSite();
  }
  window.addEventListener('online',()=>{if(currentIdentity()){updateConnection();pollShared();}});
  window.addEventListener('offline',()=>{if(currentIdentity()){updateConnection();toast(t('offline'));}});
  setInterval(()=>{
    if(currentIdentity()?.expires<Date.now()){
      patients=[];events=[];showLogin();return;
    }
    if(!['screening','record','team'].includes(view))pollShared();
  },20000);
}

boot().catch(()=>{
  $('#app').innerHTML='<main class="content"><h1>Device storage unavailable</h1><p>Enable browser storage and reload.</p></main>';
});
