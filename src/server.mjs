import http from 'node:http';
import {isIPv4} from 'node:net';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,extname,sep,basename} from 'node:path';
import {randomBytes,timingSafeEqual,randomUUID,scrypt,createHmac} from 'node:crypto';
import {openStore,digest,passwordMatches,passwordHash,transaction,audit,patientFrom,putEvent,recordConsent,withdrawConsent,isConsentActive,getPatientConsent} from './store.mjs';
import {runResearchAI} from './research-ai.mjs';
import {voiceIntake} from './voice-intake.mjs';
import {loadConfig} from './config.mjs';
import {generatePatientId,isValidPatientId} from './patient-id.mjs';
import {getConsentTerms} from './consent-terms.mjs';
import {parseDataUrl,storePatientImage,getImageRecord,loadImageBuffer,resolvePhotoDataUrl} from './image-storage.mjs';
import {assessImageQuality} from './image-quality.mjs';
import {getDefaultAIRegistry} from './ai-adapter.mjs';
import {ITDA_FACILITIES,DENTAL_QUADRANTS,REFERRAL_PRIORITIES,REFERRAL_STATUSES,isValidReferralTransition,isReferralOverdue} from './facilities.mjs';
import {buildDashboardStats} from './dashboard-stats.mjs';
const stages=['screened','reviewed','referred','diagnostics','treatment','closed'];
const types={'.ttf':'font/ttf','.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new ApiError(status,message);};
function string(value,max,required=false){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Invalid or missing field.');return value.trim();}
function safeEqual(a,b){const x=Buffer.from(a||''),y=Buffer.from(b||'');return x.length===y.length&&timingSafeEqual(x,y);}
async function body(req,max=3_000_000){let length=0;const chunks=[];for await(const chunk of req){length+=chunk.length;if(length>max)fail(413,'Request too large.');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{fail(400,'Invalid JSON.');}}
function validatePatient(input){
 const id=string(input.id||generatePatientId('AD-PAD'),80,true);if(!isValidPatientId(id))fail(400,'Invalid patient ID.');const age=input.age;if(!Number.isInteger(age)||age<1||age>120||input.consent!==true)fail(400,'Age and recorded consent are required.');
 const photo=input.photo||null;
 if(photo){
  if(typeof photo!=='string'||photo.length>2_800_000)fail(400,'Invalid photograph.');
  const isDataUri=/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(photo);
  const isImageRef=/^\/api\/images\/IMG-[A-Za-z0-9_-]+$/.test(photo);
  if(!isDataUri&&!isImageRef)fail(400,'Invalid photograph.');
 }
 return {id,name:string(input.name,100,true),age,village:string(input.village,100,true),phone:string(input.phone||'',20),history:string(input.history||'',2000),consent:true,photo,quality:input.quality&&typeof input.quality.pass==='boolean'?{pass:input.quality.pass}:null,stage:'screened',notes:'',facility:'',due:'',createdAt:new Date().toISOString(),timeline:[]};
}
function validateDate(value){if(!value)return '';if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)fail(400,'Invalid appointment date.');return value;}
export async function startServer(options={}){
 const config=loadConfig(options);
 const lanHost=config.server.lanHost;
 const aiRegistry=options.aiRegistry||getDefaultAIRegistry(config);
 const infer=options.researchAI||((photo,opts)=>aiRegistry.runInference(photo,opts));let aiBusy=false,aiStatusPromise=null,aiCheckedAt=0;
 const directory=config.paths.dataDir;const db=openStore(directory);const root=await realpath(config.paths.publicDir);const secure=config.server.cookieSecure;const attempts=new Map();const videoRooms=new Map();let delivering=false;let latestActiveConsultation=null;const dummyPasswordHash=passwordHash(randomBytes(32).toString('hex'));
 const setting=key=>db.prepare('SELECT value FROM settings WHERE key=?').get(key)?.value;const instanceId=db.prepare('SELECT value FROM meta WHERE key=?').get('instanceId').value;
 const voice=voiceIntake({db,fail,fetcher:options.voiceFetch,config:options.voiceConfig||process.env});
 function integration(){return {url:config.automation.n8nWebhookUrl||setting('n8nUrl'),token:config.automation.n8nWebhookToken||setting('n8nToken')};}
 function session(req){const token=req.headers.cookie?.split(';').map(v=>v.trim()).find(v=>v.startsWith('drishti_session='))?.slice(16);if(!token)return null;return db.prepare('SELECT s.csrf,s.expires,s.token_hash,u.id,u.email,u.name,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.active=1').get(digest(token),Date.now());}
 function userShape(s){return {id:s.id,email:s.email,name:s.name,role:s.role};}
 function requireUser(req){const s=session(req);if(!s)fail(401,'Sign in to continue.');return s;}
 function csrf(req,s){if(!safeEqual(req.headers['x-csrf-token'],s.csrf))fail(403,'Session verification failed. Reload and sign in again.');}
 const roleAliases={worker:['worker','asha'],asha:['worker','asha'],navigator:['navigator','hospital'],hospital:['navigator','hospital']};
 function allowed(s,list){const eff=[s.role,...(roleAliases[s.role]||[])];if(!list.some(r=>eff.includes(r)))fail(403,'Your account cannot perform this action.');}
 function json(res,status,value,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(value));}
 async function deliver(){
  if(delivering)return {busy:true};const {url,token}=integration();if(!url||!token)fail(503,'Local n8n is not connected yet.');delivering=true;let delivered=0;
  try{for(const row of db.prepare('SELECT * FROM events WHERE delivered_at IS NULL ORDER BY rowid LIMIT 25').all()){
   try{const eventUrl=row.type==='voice.requested'?(setting('n8nVoiceUrl')||url.replace(/drishti-events$/, 'drishti-voice-intake')):row.type==='consultation.requested'?(setting('n8nConsultationUrl')||url.replace(/drishti-events$/, 'drishti-consultations')):url;const response=await fetch(eventUrl,{method:'POST',headers:{'Content-Type':'application/json','X-Webhook-Token':token},body:row.body,signal:AbortSignal.timeout(8000)});if(!response.ok)throw Error();const ack=await response.json();if(ack.accepted!==true||ack.eventId!==row.id)throw Error();db.prepare('UPDATE events SET delivered_at=?,attempts=attempts+1,last_error=NULL WHERE id=?').run(new Date().toISOString(),row.id);delivered++;}
   catch{db.prepare('UPDATE events SET attempts=attempts+1,last_error=? WHERE id=?').run('n8n delivery failed; will retry.',row.id);break;}
  }return {delivered,pending:db.prepare('SELECT count(*) AS n FROM events WHERE delivered_at IS NULL').get().n};}finally{delivering=false;}
 }
 const handle=async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' wss: https:; script-src 'self' 'unsafe-inline'; frame-src 'self' https://meet.jit.si; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  try{
   const path=new URL(req.url,'http://localhost').pathname,method=req.method;
   if(path.startsWith('/api/')){
    const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);const requestSecure=secure||(process.env.TRUST_CLOUDFLARE==='true'&&loopback&&req.headers['x-forwarded-proto']==='https');const origin=req.headers.origin;if(origin&&origin!==`http://${req.headers.host}`&&origin!==`https://${req.headers.host}`)fail(403,'Cross-origin request denied.');
    if(path==='/api/health'&&method==='GET'){
      return json(res,200,{
        ok:true,
        mode:'shared-demo',
        instanceId,
        timestamp:new Date().toISOString(),
        version:'0.3.0',
        system:{node:process.version,platform:process.platform},
        database:{status:'connected',journalMode:'WAL'},
        ai:{configuredModel:config.ai.defaultModel,candidateModel:config.ai.candidateModel,timeoutMs:config.ai.timeoutMs}
      });
    }
    if(path==='/api/consent/terms'&&method==='GET'){
      const url=new URL(req.url,'http://localhost');
      const version=url.searchParams.get('version')||'v1.0-ITDA';
      const lang=url.searchParams.get('lang')||'en';
      return json(res,200,{terms:getConsentTerms(version,lang)});
    }
    if(path==='/api/auth/login'&&method==='POST'){
     const input=await body(req,4096);
     const rawId=string(input.email||input.identifier||input.username,150,true).toLowerCase().trim();
     const idAliases={'ap-asr-asha-9902':'asha@drishti.demo','32-8812-9901':'doctor@drishti.demo','hpr: 32-8812-9901':'doctor@drishti.demo','lab-asr-8409':'specialist@drishti.demo','gov-ap-itda-01':'admin@drishti.demo'};
     const email=idAliases[rawId]||rawId;
     const password=string(input.password,256,true);
     const remote=(process.env.TRUST_CLOUDFLARE==='true'&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)?req.headers['cf-connecting-ip']:null)||req.socket.remoteAddress;const key=remote+'|'+email;const now=Date.now();if(attempts.size>10000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);let rate=attempts.get(key);if(!rate||rate.until<now){rate={count:0,until:now+15*60_000};attempts.set(key,rate);}if(rate.count>=10)fail(429,'Too many sign-in attempts. Try again in 15 minutes.');rate.count++;
     const u=db.prepare('SELECT * FROM users WHERE email=? AND active=1').get(email);const hash=u?.password_hash||dummyPasswordHash;const [salt,expected]=hash.split(':');const actual=await new Promise((resolve,reject)=>scrypt(password,salt,64,(error,key)=>error?reject(error):resolve(key)));if(!timingSafeEqual(Buffer.from(expected,'hex'),actual)||!u)fail(401,'Email or password is incorrect.');attempts.delete(key);
     const token=randomBytes(32).toString('base64url'),csrfToken=randomBytes(24).toString('base64url'),expires=now+12*60*60_000;db.prepare('DELETE FROM sessions WHERE expires<?').run(now);db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),u.id,csrfToken,expires);audit(db,u,'auth.login');return json(res,200,{user:userShape(u),csrf:csrfToken,expires,instanceId},{'Set-Cookie':`drishti_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${requestSecure?'; Secure':''}`});
    }
    if(path==='/api/automation/receipt'&&method==='POST'){
     const token=setting('callbackToken')||process.env.N8N_CALLBACK_TOKEN;if(!token||!safeEqual(req.headers['x-automation-token'],token))fail(401,'Invalid automation credential.');const input=await body(req,4096);const event=db.prepare('SELECT * FROM events WHERE id=?').get(string(input.eventId,80,true));if(!event)fail(404,'Event not found.');db.prepare('INSERT OR IGNORE INTO automation_receipts VALUES(?,?,?,?)').run(event.id,event.patient_id,event.type,new Date().toISOString());return json(res,200,{accepted:true,eventId:event.id});
    }
    if(path==='/api/consultations/ready'&&method==='POST'){
     const token=setting('callbackToken')||process.env.N8N_CALLBACK_TOKEN;if(!token||!safeEqual(req.headers['x-automation-token'],token))fail(401,'Invalid automation credential.');const input=await body(req,4096);const event=db.prepare('SELECT * FROM events WHERE id=? AND type=?').get(string(input.eventId,80,true),'consultation.requested');if(!event)fail(404,'Consultation event not found.');const roomUrl=string(input.roomUrl,500,true);const expected='https://meet.jit.si/Drishti-'+event.id;if(roomUrl!==expected)fail(400,'Unexpected consultation room.');transaction(db,()=>{db.prepare('UPDATE consultations SET status=?,room_url=? WHERE event_id=?').run('ready',roomUrl,event.id);db.prepare('INSERT OR IGNORE INTO automation_receipts VALUES(?,?,?,?)').run(event.id,event.patient_id,event.type,new Date().toISOString());});return json(res,200,{accepted:true,eventId:event.id});
    }
    if(['/api/voice/dispatch','/api/voice/reconcile'].includes(path)&&method==='POST'){
     const token=setting('callbackToken')||process.env.N8N_CALLBACK_TOKEN;
     if(!loopback||req.headers['x-forwarded-for']||req.headers['cf-connecting-ip']||!token||!safeEqual(req.headers['x-automation-token'],token))fail(401,'Private automation access required.');
     const input=await body(req,4096);return json(res,200,path.endsWith('/dispatch')?await voice.dispatch(string(input.eventId,80,true)):await voice.reconcile());
    }
    const s=requireUser(req);if(!['GET','HEAD'].includes(method))csrf(req,s);
    if(path==='/api/voice/status'&&method==='GET')return json(res,200,voice.status());
    if(path==='/api/voice/calls'&&method==='POST')return json(res,201,{call:voice.create(await body(req,4096),s)});
    if(path==='/api/voice/calls'&&method==='GET'){
     const id=new URL(req.url,'http://localhost').searchParams.get('patientId');if(!/^AD-[A-Za-z0-9-]+$/.test(id||''))fail(400,'Patient ID required.');return json(res,200,{calls:voice.list(id)});
    }
    if(path==='/api/ai/models'&&method==='GET')return json(res,200,{models:aiRegistry.listAdapters(),active:aiRegistry.activeModelId});
    if(path==='/api/ai/select-model'&&method==='POST'){
     allowed(s,['doctor','admin']);const input=await body(req,1024);
     const switched=aiRegistry.setActiveAdapter(string(input.modelId,100,true));
     if(!switched)fail(400,'Unknown model adapter ID.');
     aiStatusPromise=null;
     return json(res,200,{ok:true,active:aiRegistry.activeModelId});
    }
    if(path==='/api/ai/status'&&method==='GET'){if(!aiStatusPromise||Date.now()-aiCheckedAt>60000){aiCheckedAt=Date.now();aiStatusPromise=infer().catch(()=>({available:false,researchOnly:true,clinicallyValidated:false}));}return json(res,200,await aiStatusPromise);}
    const aiMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/research-ai$/);
    if(aiMatch&&method==='POST'){
     allowed(s,['doctor','specialist']);const input=await body(req,4096);if(input.researchAcknowledged!==true)fail(400,'Research-only acknowledgement required.');const row=db.prepare('SELECT * FROM patients WHERE id=?').get(aiMatch[1]);if(!row)fail(404,'Patient not found.');if(!isConsentActive(db,aiMatch[1]))fail(403,'Active patient consent is required before processing oral images with AI.');if(input.version!==row.version)fail(409,'Record changed. Refresh before running AI.');const p=patientFrom(row);if(!p.photo||p.age<18)fail(400,'An uploaded photograph and adult research record are required.');if(aiBusy)fail(429,'Local AI is busy. Try again shortly.');aiBusy=true;
      try{let result;try{const photoPayload=resolvePhotoDataUrl(db,p.photo,config.paths.storageDir);result=await infer(photoPayload,{modelId:input.modelId,history:p.history,age:p.age,patientName:p.name});}catch(error){fail(503,error.message);}if(db.prepare('SELECT version FROM patients WHERE id=?').get(p.id)?.version!==row.version)fail(409,'Record changed during inference. Refresh before retrying.');const now=new Date().toISOString();p.researchAI={...result,at:now,requestedBy:s.id};delete p.version;delete p.createdBy;delete p.updatedAt;const analysisId=randomUUID(),findingsJson=JSON.stringify(result.candidateFindings||[]),warningsJson=JSON.stringify(result.warnings||[]);transaction(db,()=>{db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);db.prepare(`INSERT INTO ai_analyses(id,patient_id,image_id,model_name,model_version,model_class,candidate_findings,warnings,status,requested_by,processed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).run(analysisId,p.id,p.imageId||null,result.model||'unknown',result.revision||'1.0',result.modelClass||'Normal',findingsJson,warningsJson,'completed',s.id,now);audit(db,s,'research_ai.completed',p.id,{model:result.model,modelClass:result.modelClass,analysisId});});return json(res,200,{patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(p.id)),analysis:{id:analysisId,modelClass:result.modelClass,candidateFindings:result.candidateFindings,warnings:result.warnings}});}finally{aiBusy=false;}
    }
    const aiAnalysesMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/ai-analyses$/);
    if(aiAnalysesMatch&&method==='GET'){
     const pId=aiAnalysesMatch[1];const row=db.prepare('SELECT id FROM patients WHERE id=?').get(pId);if(!row)fail(404,'Patient not found.');
     const rows=db.prepare('SELECT a.*,u.name AS requester_name FROM ai_analyses a LEFT JOIN users u ON u.id=a.requested_by WHERE a.patient_id=? ORDER BY a.processed_at DESC').all(pId);
     const analyses=rows.map(r=>{
      let candidateFindings=[];let warnings=[];
      try{candidateFindings=JSON.parse(r.candidate_findings||'[]');}catch{}
      try{warnings=JSON.parse(r.warnings||'[]');}catch{}
      return {id:r.id,patientId:r.patient_id,imageId:r.image_id,modelName:r.model_name,modelVersion:r.model_version,modelClass:r.model_class,candidateFindings,warnings,status:r.status,requestedBy:r.requested_by,requesterName:r.requester_name,processedAt:r.processed_at};
     });
     return json(res,200,{analyses});
    }
    if(path==='/api/ai/live-scan'&&method==='POST'){
     allowed(s,['doctor','specialist','worker','asha','admin','hospital']);
     const input=await body(req,10*1024*1024);
     const photoPayload=input.photo||input.image;
     if(!photoPayload)fail(400,'Oral image payload required.');
     const modelId=input.modelId||'google/gemini-flash';
     const patientId=input.patientId||null;
     const result=await infer(photoPayload,{
       modelId,
       history: input.history || '',
       age: input.age || null,
       patientName: input.patientName || input.name || '',
       imageName: input.imageName || input.filename || ''
     });
     if(patientId&&db.prepare('SELECT id FROM patients WHERE id=?').get(patientId)){
       const analysisId=randomUUID();
       const now=new Date().toISOString();
       const findingsJson=JSON.stringify(result.candidateFindings||[]);
       const warningsJson=JSON.stringify(result.warnings||[]);
       try{
         db.prepare(`INSERT INTO ai_analyses(id,patient_id,image_id,model_name,model_version,model_class,candidate_findings,warnings,status,requested_by,processed_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`)
           .run(analysisId,patientId,null,result.model||'Google Gemini 1.5 Flash (Vision)',result.revision||'1.0',result.modelClass||'Normal',findingsJson,warningsJson,'completed',s.id,now);
         audit(db,s,'research_ai.completed',patientId,{model:result.model,modelClass:result.modelClass,analysisId,fromLiveConsultation:true});
       }catch(e){console.warn('AI analysis record notice:',e);}
     }
     return json(res,200,{ok:true,result,model:result.model||'Google Gemini 1.5 Flash (Vision)'});
    }
    if(path==='/api/ai/analyses'&&method==='GET'){
     allowed(s,['admin','doctor','specialist','navigator','hospital','worker']);
     const rows=db.prepare(`
       SELECT a.*, u.name AS requester_name, p.body AS patient_body
       FROM ai_analyses a
       LEFT JOIN users u ON u.id=a.requested_by
       LEFT JOIN patients p ON p.id=a.patient_id
       ORDER BY a.processed_at DESC
       LIMIT 100
     `).all();
     const analyses=rows.map(r=>{
      let candidateFindings=[];let warnings=[];let patientName=r.patient_id;let village='';let stage='';
      try{candidateFindings=JSON.parse(r.candidate_findings||'[]');}catch{}
      try{warnings=JSON.parse(r.warnings||'[]');}catch{}
      try{const pb=JSON.parse(r.patient_body||'{}');patientName=pb.name||r.patient_id;village=pb.village||'';stage=pb.stage||'';}catch{}
      return {id:r.id,patientId:r.patient_id,patientName,village,stage,imageId:r.image_id,modelName:r.model_name,modelVersion:r.model_version,modelClass:r.model_class,candidateFindings,warnings,status:r.status,requestedBy:r.requested_by,requesterName:r.requester_name,processedAt:r.processed_at};
     });
     return json(res,200,{analyses});
    }
    const careMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/care$/);
    if(careMatch&&method==='POST'){
     allowed(s,['doctor','specialist']);const input=await body(req,1_200_000);const row=db.prepare('SELECT * FROM patients WHERE id=?').get(careMatch[1]);if(!row)fail(404,'Patient not found.');if(input.version!==row.version)fail(409,'Record changed. Refresh before saving.');const p=patientFrom(row);if(!['diagnostic','treatment','followup'].includes(input.type)||!['planned','completed','missed'].includes(input.status))fail(400,'Invalid care entry.');const date=validateDate(input.date);if(!date)fail(400,'Care date required.');const report=input.report||null;if(report&&(typeof report!=='string'||report.length>1_000_000||!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(report)))fail(400,'Use a scanned image report under 750 KB.');const entries=p.careEntries||[];if(entries.length>=100||entries.reduce((n,e)=>n+(e.report?.length||0),0)+(report?.length||0)>12_000_000)fail(400,'Record attachment limit reached.');const now=new Date().toISOString();const entry={id:randomUUID(),type:input.type,status:input.status,date,title:string(input.title,150,true),notes:string(input.notes,4000,true),facility:string(input.facility,150,true),report,author:s.name,at:now};p.careEntries=[...entries,entry];p.timeline.push({at:now,text:`${entry.type}: ${entry.title} (${entry.status}).`,te:`${entry.title} (${entry.status}).`});delete p.version;delete p.createdBy;delete p.updatedAt;transaction(db,()=>{db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);putEvent(db,'care.updated',p);audit(db,s,'care.'+entry.type,p.id);});return json(res,201,{patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(p.id))});
    }
    if(path==='/api/auth/me'&&method==='GET')return json(res,200,{user:userShape(s),csrf:s.csrf,expires:s.expires,instanceId});
    if(path==='/api/auth/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);return json(res,200,{ok:true},{'Set-Cookie':'drishti_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});}
    const imageMatch=path.match(/^\/api\/images\/(IMG-[A-Za-z0-9_-]+)$/);
    if(imageMatch&&method==='GET'){
     try{
      const {buffer,record}=loadImageBuffer(db,imageMatch[1],config.paths.storageDir);
      res.writeHead(200,{'Content-Type':record.mime_type,'Content-Length':record.file_size,'X-Content-Type-Options':'nosniff','Cache-Control':'private, max-age=86400'});
      return res.end(buffer);
      }catch{fail(404,'Image not found.');}
    }
    if(path==='/api/images/quality-check'&&method==='POST'){
     allowed(s,['worker','doctor','specialist','navigator','admin']);
     const input=await body(req,4_000_000);const photoStr=input.photo;if(!photoStr||typeof photoStr!=='string')fail(400,'Photograph payload is required.');
     return json(res,200,{ok:true,quality:assessImageQuality(photoStr)});
    }
    const patientImageMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/image$/);
    if(patientImageMatch&&method==='POST'){
     allowed(s,['worker','doctor']);const patientId=patientImageMatch[1];const row=db.prepare('SELECT * FROM patients WHERE id=?').get(patientId);if(!row)fail(404,'Patient not found.');
     if(!isConsentActive(db,patientId))fail(403,'Active patient consent is required before uploading or updating oral photographs.');
     const input=await body(req,4_000_000);const photoStr=input.photo;if(!photoStr||typeof photoStr!=='string')fail(400,'Photograph payload is required.');
     let buffer,mimeHint,imageRecord;try{({buffer,mimeHint}=parseDataUrl(photoStr));imageRecord=storePatientImage(db,{patientId,buffer,mimeHint,uploadedBy:s.id,storageDir:config.paths.storageDir});}catch(err){fail(400,'Image validation failed: '+err.message);}
     const p=patientFrom(row);p.photo=imageRecord.url;p.imageId=imageRecord.id;
     const qualityReport=assessImageQuality(photoStr);
     p.quality=qualityReport;
     const now=new Date().toISOString();
     const qualityNote=qualityReport.pass?'passed quality checks':'quality warning: retake recommended';
     const qualityNoteTe=qualityReport.pass?'నాణ్యత బాగుంది':'నాణ్యత హెచ్చరిక: మళ్లీ తీయడం మంచిది';
     p.timeline.push({at:now,text:`Oral photograph uploaded by ${s.name} (${qualityNote}).`,te:`${s.name} ద్వారా నోటి ఛాయాచిత్రం అప్‌లోడ్ చేయబడింది (${qualityNoteTe}).`});
     delete p.version;delete p.createdBy;delete p.updatedAt;
     transaction(db,()=>{db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,patientId);audit(db,s,'image.uploaded',patientId,{imageId:imageRecord.id,sha256:imageRecord.sha256,qualityScore:qualityReport.score});});
     return json(res,200,{ok:true,image:imageRecord,quality:qualityReport,patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(patientId))});
    }
    if(path==='/api/patients'&&method==='GET'){
     audit(db,s,'patients.list');
     const rows=db.prepare('SELECT * FROM patients ORDER BY updated_at DESC').all().map(patientFrom);
     if(s.role==='patient'){
       const myPatients=rows.filter(p=>p.name.includes('Lakshmi')||p.id==='AD-PAD-2026-0001'||p.id.includes('DEMO'));
       return json(res,200,{patients:myPatients.length?myPatients:rows.slice(0,1)});
     }
     return json(res,200,{patients:rows});
    }
    if(path==='/api/patients'&&method==='POST'){
     allowed(s,['worker']);const input=await body(req),p=validatePatient(input);const existing=db.prepare('SELECT * FROM patients WHERE id=?').get(p.id);if(existing){if(existing.created_by!==s.id)fail(409,'Patient ID already belongs to another screening.');return json(res,200,{patient:patientFrom(existing),duplicate:true});}
     const consentVersion=input.consentVersion||'v1.0-ITDA';
     const consentLang=(input.consentLanguage==='te'||input.consentLanguage==='telugu')?'te':'en';
     const consentText=input.consentText||getConsentTerms(consentVersion,consentLang).body;
     p.timeline=[{at:p.createdAt,text:'Screening received from health worker.',te:'ఆరోగ్య కార్యకర్త నుండి స్క్రీనింగ్ అందింది.'}];const now=new Date().toISOString();
     transaction(db,()=>{
      db.prepare('INSERT INTO patients VALUES(?,?,?,?,?)').run(p.id,JSON.stringify(p),1,s.id,now);
      if(p.photo&&p.photo.startsWith('data:image/')){
       try{
        const {buffer,mimeHint}=parseDataUrl(p.photo);
        const imageRecord=storePatientImage(db,{patientId:p.id,buffer,mimeHint,uploadedBy:s.id,storageDir:config.paths.storageDir});
        p.photo=imageRecord.url;
        p.imageId=imageRecord.id;if(!p.quality||!p.quality.issues)p.quality=assessImageQuality(buffer);
        db.prepare('UPDATE patients SET body=? WHERE id=?').run(JSON.stringify(p),p.id);
       }catch(err){fail(400,`Image storage error: ${err.message}`);}
      }
      recordConsent(db,{patientId:p.id,version:consentVersion,language:consentLang,termsText:consentText,userId:s.id});
      putEvent(db,'screening.created',p);
      audit(db,s,'screening.created',p.id);
     });
     return json(res,201,{patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(p.id))});
    }
    const consentGetMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/consent$/);
    if(consentGetMatch&&method==='GET'){
     const pId=consentGetMatch[1];const row=db.prepare('SELECT id FROM patients WHERE id=?').get(pId);if(!row)fail(404,'Patient not found.');
     const consent=getPatientConsent(db,pId);return json(res,200,{consent:consent||{status:'granted',version:'v1.0-ITDA',language:'en'}});
    }
    const consentWithdrawMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/consent\/withdraw$/);
    if(consentWithdrawMatch&&method==='POST'){
     allowed(s,['worker','doctor','admin']);const pId=consentWithdrawMatch[1];const input=await body(req,4096);const row=db.prepare('SELECT * FROM patients WHERE id=?').get(pId);if(!row)fail(404,'Patient not found.');
     const reason=string(input.reason||'Patient requested consent withdrawal',500);const p=patientFrom(row);const now=new Date().toISOString();
     p.consent=false;p.timeline.push({at:now,text:`Consent withdrawn (${reason}). AI processing halted.`,te:`సమ్మతి ఉపసంహరించబడింది. AI ప్రాసెసింగ్ నిలిపివేయబడింది.`});
     delete p.version;delete p.createdBy;delete p.updatedAt;
     transaction(db,()=>{try{withdrawConsent(db,pId,s.id,reason);}catch{}db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,pId);audit(db,s,'consent.withdrawn',pId,{reason});});
     return json(res,200,{patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(pId)),consent:{status:'withdrawn',withdrawnAt:now}});
    }
    const reviewMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/review$/);
    if(reviewMatch&&['PATCH','POST'].includes(method)){
     allowed(s,['doctor','specialist']);const input=await body(req,16000);const row=db.prepare('SELECT * FROM patients WHERE id=?').get(reviewMatch[1]);if(!row)fail(404,'Patient not found.');if(!Number.isInteger(input.version)||input.version!==row.version)fail(409,'Another clinician updated this record. Refresh before saving.');const p=patientFrom(row);const stage=string(input.stage,30,true);if(!stages.includes(stage)||stage==='screened')fail(400,'Invalid care stage.');const notes=string(input.notes,4000,true),facility=string(input.facility||'',150),due=validateDate(input.due||'');if(['referred','diagnostics','treatment'].includes(stage)&&(!facility||!due))fail(400,'Facility and next appointment date are required.');
     const quadrant=input.quadrant&&typeof input.quadrant==='string'?string(input.quadrant,20):null;
     const provisionalDiagnosis=input.provisionalDiagnosis&&typeof input.provisionalDiagnosis==='string'?string(input.provisionalDiagnosis,200):'';
     const priority=input.priority&&REFERRAL_PRIORITIES.includes(input.priority)?input.priority:'routine';
     const now=new Date().toISOString();Object.assign(p,{stage,notes,facility,due:stage==='closed'?'':due,quadrant,provisionalDiagnosis});
     p.timeline.push({at:now,text:`Reviewed by ${s.name}: ${stage}${quadrant?` [${quadrant}]`:''}.`,te:`${s.name} సమీక్ష: ${stage}${quadrant?` [${quadrant}]`:''}.`});delete p.version;delete p.createdBy;delete p.updatedAt;
     const reviewId=randomUUID();
     transaction(db,()=>{
      db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);
      db.prepare('INSERT INTO clinical_reviews(id,patient_id,reviewer_id,stage,quadrant,provisional_diagnosis,clinical_notes,facility,due_date,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(reviewId,p.id,s.id,stage,quadrant,provisionalDiagnosis,notes,facility,due,now);
      if(stage==='referred'){
        const refId=randomUUID();
        db.prepare('INSERT INTO referrals(id,patient_id,facility,priority,due_date,notes,status,created_by,created_at,updated_at,quadrant) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(refId,p.id,facility,priority,due,notes,'referred',s.id,now,now,quadrant);
      }
      putEvent(db,stage==='referred'?'referral.created':'review.completed',p);
      audit(db,s,'review.completed',p.id,{stage,quadrant,facility});
     });
     return json(res,200,{patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(p.id))});
    }
    if(path==='/api/facilities'&&method==='GET'){
     return json(res,200,{facilities:ITDA_FACILITIES,quadrants:DENTAL_QUADRANTS,priorities:REFERRAL_PRIORITIES,statuses:REFERRAL_STATUSES});
    }
    const patientReferralsMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/referrals$/);
    if(patientReferralsMatch&&method==='POST'){
     allowed(s,['doctor','specialist']);const pId=patientReferralsMatch[1];const row=db.prepare('SELECT * FROM patients WHERE id=?').get(pId);if(!row)fail(404,'Patient not found.');
     const input=await body(req,4096);const facility=string(input.facility,150,true);const dueDate=validateDate(input.dueDate || input.due_date);if(!dueDate)fail(400,'Due date required.');
     const priority=input.priority&&REFERRAL_PRIORITIES.includes(input.priority)?input.priority:'routine';
     const notes=string(input.notes||'',2000);const quadrant=input.quadrant&&typeof input.quadrant==='string'?string(input.quadrant,20):null;
     const now=new Date().toISOString();const refId=randomUUID();const p=patientFrom(row);
     p.stage='referred';p.facility=facility;p.due=dueDate;if(quadrant)p.quadrant=quadrant;
     p.timeline.push({at:now,text:`Referral created to ${facility} (${priority})${quadrant?` [${quadrant}]`:''}.`,te:`${facility} కు రెఫరల్ సృష్టించబడింది (${priority}).`});
     delete p.version;delete p.createdBy;delete p.updatedAt;
     transaction(db,()=>{
      db.prepare('INSERT INTO referrals(id,patient_id,facility,priority,due_date,notes,status,created_by,created_at,updated_at,quadrant) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(refId,pId,facility,priority,dueDate,notes,'referred',s.id,now,now,quadrant);
      db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,pId);
      putEvent(db,'referral.created',p);audit(db,s,'referral.created',pId,{referralId:refId,facility,priority});
     });
     const createdRef=db.prepare('SELECT r.*,u.name AS referrer_name FROM referrals r LEFT JOIN users u ON u.id=r.created_by WHERE r.id=?').get(refId);
     return json(res,201,{ok:true,referral:{...createdRef,isOverdue:isReferralOverdue(createdRef.due_date,createdRef.status)},patient:patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(pId))});
    }
    if(patientReferralsMatch&&method==='GET'){
     const pId=patientReferralsMatch[1];if(!db.prepare('SELECT id FROM patients WHERE id=?').get(pId))fail(404,'Patient not found.');
     const rows=db.prepare('SELECT r.*,u.name AS referrer_name FROM referrals r LEFT JOIN users u ON u.id=r.created_by WHERE r.patient_id=? ORDER BY r.created_at DESC').all(pId);
     const referrals=rows.map(r=>({...r,isOverdue:isReferralOverdue(r.due_date,r.status)}));
     return json(res,200,{referrals});
    }
    const patientReviewsMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/clinical-reviews$/);
    if(patientReviewsMatch&&method==='GET'){
     const pId=patientReviewsMatch[1];if(!db.prepare('SELECT id FROM patients WHERE id=?').get(pId))fail(404,'Patient not found.');
     const reviews=db.prepare('SELECT cr.*,u.name AS reviewer_name FROM clinical_reviews cr LEFT JOIN users u ON u.id=cr.reviewer_id WHERE cr.patient_id=? ORDER BY cr.created_at DESC').all(pId);
     return json(res,200,{reviews});
    }
    if(path==='/api/referrals'&&method==='GET'){
     const url=new URL(req.url,'http://localhost');
     const statusFilter=url.searchParams.get('status');
     const priorityFilter=url.searchParams.get('priority');
     const villageFilter=url.searchParams.get('village');
     const overdueOnly=url.searchParams.get('overdue')==='true';
     const rows=db.prepare('SELECT r.*,p.body AS patient_body,u.name AS referrer_name FROM referrals r JOIN patients p ON p.id=r.patient_id LEFT JOIN users u ON u.id=r.created_by ORDER BY r.due_date ASC,r.created_at DESC').all();
     const referrals=[];
     for(const row of rows){
      let patient={name:'Unknown',village:'',phone:''};
      try{const pb=JSON.parse(row.patient_body);patient={id:pb.id,name:pb.name,age:pb.age,village:pb.village,phone:pb.phone,photo:pb.photo,stage:pb.stage};}catch{}
      const isOverdue=isReferralOverdue(row.due_date,row.status);
      if(statusFilter&&statusFilter!=='all'&&row.status!==statusFilter)continue;
      if(priorityFilter&&priorityFilter!=='all'&&row.priority!==priorityFilter)continue;
      if(villageFilter&&villageFilter!=='all'&&patient.village!==villageFilter)continue;
      if(overdueOnly&&!isOverdue)continue;
      const {patient_body,...refFields}=row;
      referrals.push({...refFields,patient,isOverdue});
     }
     return json(res,200,{referrals});
    }
    const referralUpdateMatch=path.match(/^\/api\/referrals\/([A-Za-z0-9-]+)$/);
    if(referralUpdateMatch&&method==='PATCH'){
     allowed(s,['doctor','specialist','navigator','worker','admin']);
     const refId=referralUpdateMatch[1];
     const ref=db.prepare('SELECT * FROM referrals WHERE id=?').get(refId);
     if(!ref)fail(404,'Referral not found.');
     const input=await body(req,4096);
     const newStatus=string(input.status,30,true);
     if(!REFERRAL_STATUSES.includes(newStatus))fail(400,'Invalid referral status.');
     if(!isValidReferralTransition(ref.status,newStatus))fail(400,`Invalid referral transition from ${ref.status} to ${newStatus}.`);
     const notes=input.notes?string(input.notes,2000):(ref.notes||'');
     const now=new Date().toISOString();
     const patientRow=db.prepare('SELECT * FROM patients WHERE id=?').get(ref.patient_id);
     let updatedPatient=null;
     transaction(db,()=>{
      db.prepare('UPDATE referrals SET status=?,notes=?,updated_at=? WHERE id=?').run(newStatus,notes,now,refId);
      if(patientRow){
       const p=patientFrom(patientRow);
       p.timeline.push({at:now,text:`Referral (${ref.facility}) status changed to ${newStatus} by ${s.name}.`,te:`రెఫరల్ (${ref.facility}) స్థితి ${newStatus} గా మార్చబడింది (${s.name}).`});
       if(newStatus==='completed'&&p.stage==='referred')p.stage='treatment';
       delete p.version;delete p.createdBy;delete p.updatedAt;
       db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);
       updatedPatient=patientFrom(db.prepare('SELECT * FROM patients WHERE id=?').get(p.id));
      }
      audit(db,s,'referral.status_updated',ref.patient_id,{referralId:refId,from:ref.status,to:newStatus,facility:ref.facility});
     });
     const updatedRef=db.prepare('SELECT r.*,u.name AS referrer_name FROM referrals r LEFT JOIN users u ON u.id=r.created_by WHERE r.id=?').get(refId);
     return json(res,200,{ok:true,referral:{...updatedRef,isOverdue:isReferralOverdue(updatedRef.due_date,updatedRef.status)},patient:updatedPatient});
    }
    if(path==='/api/consultations'&&method==='GET'){
     const patientId=new URL(req.url,'http://localhost').searchParams.get('patientId');
     if(patientId!==null){
      if(!/^AD-[A-Za-z0-9-]+$/.test(patientId))fail(400,'Patient ID required.');
      return json(res,200,{consultations:db.prepare('SELECT id,patient_id AS patientId,scheduled_at AS scheduledAt,status,room_url AS roomUrl FROM consultations WHERE patient_id=? ORDER BY scheduled_at DESC').all(patientId)});
     }
     allowed(s,['admin','doctor','specialist','navigator','hospital']);
     const rows=db.prepare('SELECT c.id,c.patient_id AS patientId,c.scheduled_at AS scheduledAt,c.status,c.room_url AS roomUrl,p.body AS patientBody,u.name AS creatorName FROM consultations c LEFT JOIN patients p ON p.id=c.patient_id LEFT JOIN users u ON u.id=c.created_by ORDER BY c.scheduled_at DESC LIMIT 100').all();
     const consultations=rows.map(r=>{
      let patientName=r.patientId,village='';
      try{const pb=JSON.parse(r.patientBody||'{}');patientName=pb.name||r.patientId;village=pb.village||'';}catch{}
      return {id:r.id,patientId:r.patientId,patientName,village,scheduledAt:r.scheduledAt,status:r.status,roomUrl:r.roomUrl,creatorName:r.creatorName||''};
     });
     return json(res,200,{consultations});
    }
    if(path==='/api/consultations/active'&&method==='GET'){
     if(!latestActiveConsultation){
       const firstConsult=db.prepare('SELECT id,patient_id FROM consultations ORDER BY created_at DESC LIMIT 1').get();
       if(firstConsult){
         const pRow=db.prepare('SELECT body FROM patients WHERE id=?').get(firstConsult.patient_id);
         const pName=pRow?JSON.parse(pRow.body).name:'Chetti Kondababu';
         latestActiveConsultation={id:firstConsult.id,patientId:firstConsult.patient_id,patientName:pName,startedAt:Date.now()};
       }
     }
     return json(res,200,{ok:true,active:latestActiveConsultation});
    }
    if(path==='/api/consultations'&&method==='POST'){
     allowed(s,['doctor','specialist']);const input=await body(req,4096);const patientId=string(input.patientId,80,true);if(!db.prepare('SELECT id FROM patients WHERE id=?').get(patientId))fail(404,'Patient not found.');const date=new Date(input.scheduledAt);if(!Number.isFinite(date.getTime())||date.getTime()<Date.now()-300000)fail(400,'Choose a current or future consultation time.');const id=randomUUID(),eventId=randomUUID(),now=new Date().toISOString();const event={id:eventId,type:'consultation.requested',patientId,createdAt:now,data:{consultationId:id,scheduledAt:date.toISOString()}};transaction(db,()=>{db.prepare('INSERT INTO consultations(id,patient_id,scheduled_at,created_by,event_id,created_at) VALUES(?,?,?,?,?,?)').run(id,patientId,date.toISOString(),s.id,eventId,now);db.prepare('INSERT INTO events(id,patient_id,type,body) VALUES(?,?,?,?)').run(eventId,patientId,event.type,JSON.stringify(event));audit(db,s,'consultation.requested',patientId);});return json(res,201,{consultation:{id,patientId,scheduledAt:date.toISOString(),status:'preparing'}});
    }
    const consultAcceptMatch=path.match(/^\/api\/consultations\/([A-Za-z0-9-]+)\/accept$/);
    if(consultAcceptMatch&&method==='POST'){
     allowed(s,['doctor','specialist','hospital','navigator']);const cId=consultAcceptMatch[1];const consult=db.prepare('SELECT * FROM consultations WHERE id=?').get(cId);if(!consult)fail(404,'Consultation not found.');const roomUrl='https://meet.jit.si/Drishti-'+cId;db.prepare("UPDATE consultations SET status='ready', room_url=? WHERE id=?").run(roomUrl,cId);return json(res,200,{ok:true,consultation:{...consult,status:'ready',roomUrl}});
    }
function createLiveKitToken(apiKey,apiSecret,identity,name,roomName,metadata={}){
  const header={alg:'HS256',typ:'JWT'};
  const now=Math.floor(Date.now()/1000);
  const payload={
    exp:now+3600*6,
    nbf:now-5,
    iss:apiKey,
    sub:identity,
    name:name,
    metadata:typeof metadata==='string'?metadata:JSON.stringify(metadata),
    video:{
      room:roomName,
      roomJoin:true,
      canPublish:true,
      canSubscribe:true,
      canPublishData:true
    }
  };
  const b64u=str=>Buffer.from(str).toString('base64url');
  const tokenData=b64u(JSON.stringify(header))+'.'+b64u(JSON.stringify(payload));
  const signature=createHmac('sha256',apiSecret).update(tokenData).digest('base64url');
  return tokenData+'.'+signature;
}

    const consultTokenMatch=path.match(/^\/api\/consultations\/([A-Za-z0-9-]+)\/token$/);
    if(consultTokenMatch&&method==='POST'){
     const cId=consultTokenMatch[1];
     const consult=db.prepare('SELECT * FROM consultations WHERE id=?').get(cId);
     if(!consult)fail(404,'Consultation not found.');
     const roomName='drishti-'+cId;
     const roomKey='room_'+cId;
     if(!videoRooms.has(roomKey)){videoRooms.set(roomKey,{participants:new Map(),signals:[]});}
     const room=videoRooms.get(roomKey);
     room.participants.set(s.id,{id:s.id,name:s.name,role:s.role,joinedAt:Date.now()});
     const pRow=db.prepare('SELECT body FROM patients WHERE id=?').get(consult.patient_id);
     const pName=pRow?JSON.parse(pRow.body).name:'Patient';
     latestActiveConsultation={id:cId,patientId:consult.patient_id,patientName:pName,startedAt:Date.now()};
     const livekitToken=createLiveKitToken(config.livekit.apiKey,config.livekit.apiSecret,s.id,s.name,roomName,{role:s.role,patientId:consult.patient_id});
     audit(db,s,'consultation.joined',consult.patient_id,{consultationId:cId,roomName});
     return json(res,200,{
       ok:true,
       roomToken:livekitToken,
       roomId:cId,
       roomName,
       participant:{id:s.id,name:s.name,role:s.role},
       participants:Array.from(room.participants.values()),
       livekitConfig:{
         enabled:true,
         url:config.livekit.url,
         token:livekitToken,
         roomName
       }
     });
    }
    const consultSignalMatch=path.match(/^\/api\/consultations\/([A-Za-z0-9-]+)\/signals$/);
    if(consultSignalMatch&&method==='POST'){
     const cId=consultSignalMatch[1];const roomKey='room_'+cId;if(!videoRooms.has(roomKey)){videoRooms.set(roomKey,{participants:new Map(),signals:[]});}const room=videoRooms.get(roomKey);const input=await body(req,65536);const signal={fromId:s.id,fromName:s.name,targetId:input.targetId||null,type:input.type,data:input.data,at:Date.now()};room.signals.push(signal);if(room.signals.length>100)room.signals.splice(0,room.signals.length-50);return json(res,200,{ok:true});
    }
    if(consultSignalMatch&&method==='GET'){
     const cId=consultSignalMatch[1];const roomKey='room_'+cId;const room=videoRooms.get(roomKey);if(!room)return json(res,200,{signals:[],participants:[]});const mySignals=room.signals.filter(sig=>sig.fromId!==s.id&&(!sig.targetId||sig.targetId===s.id));room.signals=room.signals.filter(sig=>!mySignals.includes(sig));return json(res,200,{signals:mySignals,participants:Array.from(room.participants.values())});
    }
    const consultOutcomeMatch=path.match(/^\/api\/consultations\/([A-Za-z0-9-]+)\/outcome$/);
    if(consultOutcomeMatch&&method==='POST'){
     allowed(s,['doctor','specialist']);const cId=consultOutcomeMatch[1];const consult=db.prepare('SELECT * FROM consultations WHERE id=?').get(cId);if(!consult)fail(404,'Consultation not found.');const input=await body(req,4096);const notes=string(input.notes||'',2000,true);const outcome=string(input.outcome||'completed',50);const now=new Date().toISOString();transaction(db,()=>{db.prepare("UPDATE consultations SET status='completed' WHERE id=?").run(cId);const patientRow=db.prepare('SELECT * FROM patients WHERE id=?').get(consult.patient_id);if(patientRow){const p=patientFrom(patientRow);p.timeline.push({at:now,text:`Teleconsultation completed by ${s.name}: ${notes}`,te:`టెలికన్సల్టేషన్ పూర్తయింది (${s.name}): ${notes}`});delete p.version;delete p.createdBy;delete p.updatedAt;db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);}audit(db,s,'consultation.outcome_saved',consult.patient_id,{consultationId:cId,outcome});});return json(res,200,{ok:true,consultationId:cId,status:'completed',notes});
    }
    if(path==='/api/investigations'&&method==='GET'){
     allowed(s,['doctor','specialist','hospital','navigator','worker','admin']);const url=new URL(req.url,'http://localhost');const patientId=url.searchParams.get('patientId');let query='SELECT i.*, u.name AS doctor_name FROM investigations i LEFT JOIN users u ON u.id=i.ordered_by';const params=[];if(patientId){query+=' WHERE i.patient_id=?';params.push(patientId);}query+=' ORDER BY i.ordered_at DESC LIMIT 100';const rows=db.prepare(query).all(...params);return json(res,200,{investigations:rows});
    }
    if(path==='/api/investigations'&&method==='POST'){
     allowed(s,['doctor','specialist']);const input=await body(req,4096);const patientId=string(input.patientId,80,true);const patientRow=db.prepare('SELECT * FROM patients WHERE id=?').get(patientId);if(!patientRow)fail(404,'Patient not found.');const testType=string(input.testType||input.type,50,true);const validTypes=['biopsy','histopathology','cytology','radiology_opg','routine_blood'];if(!validTypes.includes(testType))fail(400,'Invalid investigation test type.');const facility=string(input.facility||'Area Hospital Paderu',150,true);const clinicalFindings=string(input.clinicalFindings||input.notes||'',2000);const id=randomUUID(),now=new Date().toISOString();transaction(db,()=>{db.prepare('INSERT INTO investigations(id,patient_id,referral_id,test_type,facility,ordered_by,status,clinical_findings,ordered_at) VALUES(?,?,?,?,?,?,?,?,?)').run(id,patientId,input.referralId||null,testType,facility,s.id,'ordered',clinicalFindings,now);const p=patientFrom(patientRow);p.timeline.push({at:now,text:`Investigation ordered (${testType} at ${facility}) by ${s.name}.`,te:`పరీక్ష ఆదేశించబడింది (${testType} - ${facility}) ${s.name} ద్వారా.`});delete p.version;delete p.createdBy;delete p.updatedAt;db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,patientId);audit(db,s,'investigation.ordered',patientId,{investigationId:id,testType,facility});});return json(res,201,{ok:true,investigation:{id,patientId,testType,type:testType,facility,status:'ordered',orderedAt:now}});
    }
    const invPatchMatch=path.match(/^\/api\/investigations\/([A-Za-z0-9-]+)$/);
    if(invPatchMatch&&method==='PATCH'){
     allowed(s,['doctor','specialist','hospital','navigator','admin']);const invId=invPatchMatch[1];const inv=db.prepare('SELECT * FROM investigations WHERE id=?').get(invId);if(!inv)fail(404,'Investigation not found.');const input=await body(req,16000);const status=input.status?string(input.status,30,true):inv.status;const findings=input.clinicalFindings!==undefined?string(input.clinicalFindings,4000):(input.resultSummary!==undefined?string(input.resultSummary,4000):inv.clinical_findings);const reportUrl=input.reportUrl?string(input.reportUrl,500):inv.report_url;const now=new Date().toISOString();const reportedAt=status==='completed'||status==='reported'?(inv.reported_at||now):null;transaction(db,()=>{db.prepare('UPDATE investigations SET status=?,clinical_findings=?,report_url=?,reported_at=? WHERE id=?').run(status,findings,reportUrl,reportedAt,invId);const patientRow=db.prepare('SELECT * FROM patients WHERE id=?').get(inv.patient_id);if(patientRow){const p=patientFrom(patientRow);p.timeline.push({at:now,text:`Investigation ${inv.test_type} updated to ${status} by ${s.name}.`,te:`పరీక్ష ${inv.test_type} స్థితి ${status} గా నవీకరించబడింది (${s.name}).`});delete p.version;delete p.createdBy;delete p.updatedAt;db.prepare('UPDATE patients SET body=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(p),now,p.id);}audit(db,s,'investigation.updated',inv.patient_id,{investigationId:invId,status});});return json(res,200,{ok:true,investigation:{...inv,status,clinical_findings:findings,report_url:reportUrl,reported_at:reportedAt}});
    }
    if(path==='/api/navigation'&&method==='GET'){
     allowed(s,['hospital','navigator','doctor','specialist','admin','worker']);const url=new URL(req.url,'http://localhost');const patientId=url.searchParams.get('patientId');let query='SELECT n.*, u.name as navigator_name, p.body as patient_body FROM patient_navigation n JOIN patients p ON p.id=n.patient_id LEFT JOIN users u ON u.id=n.navigator_id';const params=[];if(patientId){query+=' WHERE n.patient_id=?';params.push(patientId);}query+=' ORDER BY n.updated_at DESC LIMIT 100';const rows=db.prepare(query).all(...params);const result=rows.map(r=>{let patient={};try{patient=JSON.parse(r.patient_body);}catch{}const {patient_body,...nav}=r;return {...nav,patient};});return json(res,200,{navigation:result});
    }
    if(path==='/api/navigation'&&method==='POST'){
     allowed(s,['hospital','navigator','doctor','specialist','admin']);const input=await body(req,4096);const patientId=string(input.patientId,80,true);if(!db.prepare('SELECT id FROM patients WHERE id=?').get(patientId))fail(404,'Patient not found.');const contactStatus=input.contactStatus&&['pending','contacted','unreachable','visit_scheduled'].includes(input.contactStatus)?input.contactStatus:'contacted';const barrier=string(input.barrierIdentified||'',500);const notes=string(input.notes||'',2000);const attendance=input.attendanceConfirmed?1:0;const followup=input.followupDue?validateDate(input.followupDue):'';const id=randomUUID(),now=new Date().toISOString();db.prepare('INSERT INTO patient_navigation(id,patient_id,referral_id,navigator_id,contact_status,barrier_identified,attendance_confirmed,notes,followup_due,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,patientId,input.referralId||null,s.id,contactStatus,barrier,attendance,notes,followup,now);audit(db,s,'navigation.recorded',patientId,{navigationId:id,contactStatus});return json(res,201,{ok:true,navigation:{id,patientId,contactStatus,notes,updatedAt:now}});
    }
    if(path==='/api/dashboard/stats'&&method==='GET'){
     allowed(s,['admin','doctor','specialist','navigator','hospital']);
     return json(res,200,{ok:true,stats:buildDashboardStats(db,s,aiRegistry)});
    }
    if(path==='/api/automation/status'&&method==='GET'){const {url,token}=integration();const counts=db.prepare('SELECT count(*) AS total,sum(CASE WHEN delivered_at IS NULL THEN 1 ELSE 0 END) AS pending FROM events').get();return json(res,200,{configured:Boolean(url&&token),pending:counts.pending||0,total:counts.total,receipts:db.prepare('SELECT count(*) AS n FROM automation_receipts').get().n,events:db.prepare('SELECT id,patient_id AS patientId,type,delivered_at AS deliveredAt,attempts,last_error AS lastError FROM events ORDER BY rowid DESC LIMIT 30').all()});}
    if(path==='/api/automation/sync'&&method==='POST')return json(res,200,await deliver());
    if(path==='/api/auth/change-password'&&method==='POST'){
     const input=await body(req,4096);
     const currentPassword=string(input.currentPassword,256,true);
     const newPassword=string(input.newPassword,256,true);
     if(newPassword.length<10)fail(400,'New password must be at least 10 characters long.');
     const userRow=db.prepare('SELECT * FROM users WHERE id=?').get(s.id);
     if(!userRow||!passwordMatches(currentPassword,userRow.password_hash))fail(401,'Current password is incorrect.');
     const newHash=passwordHash(newPassword);
     transaction(db,()=>{
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(newHash,s.id);
      db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash!=?').run(s.id,s.token_hash);
      audit(db,s,'auth.password_changed',s.id,{ip:req.socket.remoteAddress});
     });
     return json(res,200,{ok:true,message:'Password changed successfully.'});
    }
    const consentsListMatch=path.match(/^\/api\/patients\/(AD-[A-Za-z0-9-]+)\/consents$/);
    if(consentsListMatch&&method==='GET'){
     const pId=consentsListMatch[1];const row=db.prepare('SELECT id FROM patients WHERE id=?').get(pId);if(!row)fail(404,'Patient not found.');
     const rows=db.prepare('SELECT * FROM consents WHERE patient_id=? ORDER BY granted_at DESC').all(pId);
     return json(res,200,{consents:rows});
    }
    if(path==='/api/admin/users'&&method==='GET'){allowed(s,['admin']);return json(res,200,{users:db.prepare('SELECT id,email,name,role,active FROM users ORDER BY role,name').all()});}
    if(path==='/api/admin/users/bulk'&&method==='POST'){
     allowed(s,['admin']);const input=await body(req,40000);if(!Array.isArray(input.users)||!input.users.length||input.users.length>100)fail(400,'Supply between 1 and 100 users.');const emails=new Set();const accounts=[];
     for(const candidate of input.users){const email=string(candidate.email,150,true).toLowerCase(),name=string(candidate.name,100,true),role=candidate.role;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!['worker','doctor','specialist','navigator'].includes(role))fail(400,'Valid email, name and clinical/care role required.');if(emails.has(email)||db.prepare('SELECT id FROM users WHERE email=?').get(email))fail(409,'An account email already exists in this batch or database.');emails.add(email);accounts.push({id:randomUUID(),email,name,role,password:randomBytes(18).toString('base64url')});}
     const prepared=[];for(const account of accounts){const salt=randomBytes(16).toString('hex');const hash=await new Promise((resolve,reject)=>scrypt(account.password,salt,64,(error,key)=>error?reject(error):resolve(key.toString('hex'))));prepared.push({...account,passwordHash:salt+':'+hash});}
     try{transaction(db,()=>{for(const account of prepared)db.prepare('INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)').run(account.id,account.email,account.name,account.role,account.passwordHash);audit(db,s,'accounts.bulk_created');});}catch(error){fail(409,'Account creation conflict. No accounts from this batch were saved.');}return json(res,201,{accounts});
    }
    if(path==='/api/admin/audit'&&method==='GET'){allowed(s,['admin']);return json(res,200,{audit:db.prepare('SELECT a.*,u.name FROM audit a JOIN users u ON u.id=a.actor ORDER BY a.id DESC LIMIT 100').all()});}
    fail(404,'API route not found.');
   }
   if(path==='/downloads/android'&&method==='GET'){try{const apkPath=process.env.ANDROID_APK_PATH||resolve('dist/android/Aarogya-Drishti-0.3.3-debug.apk');const filename=basename(apkPath);if(!/^[A-Za-z0-9._-]+\.apk$/.test(filename))fail(500,'Android package filename is invalid.');const apk=await readFile(apkPath);res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Disposition':`attachment; filename="${filename}"`,'Cache-Control':'no-store'});return res.end(apk);}catch{fail(404,'Android package has not been built on this server.');}}
   if(!['GET','HEAD'].includes(method))fail(405,'Method not allowed.');const pathname=decodeURIComponent(path);const file=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+sep))fail(403,'Access denied.');let actual;try{actual=await realpath(file);}catch{fail(404,'Not found.');}if(!actual.startsWith(root+sep))fail(403,'Access denied.');const data=await readFile(actual);res.writeHead(200,{'Content-Type':types[extname(actual)]||'application/octet-stream','Cache-Control':'no-cache, no-store, must-revalidate','Pragma':'no-cache','Expires':'0'});res.end(method==='HEAD'?undefined:data);
  }catch(e){if(!res.headersSent)json(res,e.status||500,{error:e.status?e.message:(e.message||'The server could not complete the request.')});else res.end();}
 };
 const server=http.createServer(handle);let lanServer=null;
 const interval=setInterval(()=>{if(integration().url)deliver().catch(()=>{});},15000);interval.unref();server.on('close',()=>{clearInterval(interval);if(lanServer?.listening)lanServer.close(()=>db.close());else db.close();});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.server.port,config.server.host,resolve);});
 if(lanHost){lanServer=http.createServer(handle);try{await new Promise((resolve,reject)=>{lanServer.once('error',reject);lanServer.listen(config.server.lanPort,lanHost,resolve);});server.lanAddress=lanServer.address();}catch(error){server.close();throw error;}}
 return server;
}
