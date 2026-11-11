import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual,randomUUID,createHash} from 'node:crypto';
import {applyMigrations} from './migrations.mjs';

export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function passwordMatches(password,hash){const [salt,expected]=hash.split(':');return timingSafeEqual(Buffer.from(expected,'hex'),scryptSync(password,salt,64));}
export const DEFAULT_DEMO_ACCOUNTS = [
  { id: '11111111-0001-4000-8000-000000000001', email: 'asha@drishti.demo', name: 'ASHA Health Worker (Parvati)', role: 'worker', password: 'Drishti@2026' },
  { id: '11111111-0002-4000-8000-000000000002', email: 'doctor@drishti.demo', name: 'Dr. K. Srinivas (Medical Officer)', role: 'doctor', password: 'Drishti@2026' },
  { id: '11111111-0003-4000-8000-000000000003', email: 'specialist@drishti.demo', name: 'Dr. V. Ramana (Dental Specialist / MDS)', role: 'specialist', password: 'Drishti@2026' },
  { id: '11111111-0004-4000-8000-000000000004', email: 'hospital@drishti.demo', name: 'Area Hospital Paderu Coordinator', role: 'navigator', password: 'Drishti@2026' },
  { id: '11111111-0005-4000-8000-000000000005', email: 'admin@drishti.demo', name: 'ITDA District Health Administrator', role: 'admin', password: 'Drishti@2026' },
  { id: '11111111-0006-4000-8000-000000000006', email: 'patient@drishti.demo', name: 'Lakshmi Gemmeli (Patient)', role: 'patient', password: 'Drishti@2026' },
  { id: '9af38ff7-42c5-4576-95ca-e082a8d45941', email: 'worker@drishti.local', name: 'Health worker', role: 'worker', password: 'Worker@1234' },
  { id: '564cba39-130e-4068-abd3-6fdf30e6be49', email: 'doctor@drishti.local', name: 'Medical officer', role: 'doctor', password: 'Doctor@1234' },
  { id: '4648c900-3777-475d-b213-52e6aac5cd83', email: 'admin@drishti.local', name: 'District administrator', role: 'admin', password: 'Admin@1234' }
];

export function ensureDemoAccounts(db, directory) {
  const file = join(directory, 'demo-accounts.json');
  for (const acc of DEFAULT_DEMO_ACCOUNTS) {
    const existing = db.prepare('SELECT id, password_hash FROM users WHERE email=?').get(acc.email);
    if (!existing) {
      db.prepare('INSERT INTO users(id, email, name, role, password_hash) VALUES(?,?,?,?,?)')
        .run(acc.id, acc.email, acc.name, acc.role, passwordHash(acc.password));
    } else if (acc.password) {
      // Keep demo accounts synchronized with documented password
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(acc.password), existing.id);
    }
  }
  try {
    writeFileSync(file, JSON.stringify({
      notice: 'Aarogya Drishti Demonstration Accounts — Official Hackathon 2026',
      defaultPassword: 'Drishti@2026',
      accounts: DEFAULT_DEMO_ACCOUNTS
    }, null, 2), { mode: 0o600 });
  } catch {}
}

export function openStore(directory){
 mkdirSync(directory,{recursive:true});const db=new DatabaseSync(join(directory,'drishti.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`);
 applyMigrations(db);
 if(!db.prepare('SELECT value FROM meta WHERE key=?').get('instanceId'))db.prepare('INSERT INTO meta VALUES(?,?)').run('instanceId',randomUUID());
 ensureDemoAccounts(db, directory);
 try{chmodSync(directory,0o700);chmodSync(join(directory,'drishti.sqlite'),0o600);}catch{}return db;
}
export function transaction(db,work){db.exec('BEGIN IMMEDIATE');try{const value=work();db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}
export function audit(db,user,action,id=null,details=null,ip=null){
 const at=new Date().toISOString();
 const actor=typeof user==='string'?user:(user?.id||'system');
 const detailsStr=details&&typeof details==='object'?JSON.stringify(details):(details||null);
 db.prepare('INSERT INTO audit(actor,action,record_id,at,details,ip_address) VALUES(?,?,?,?,?,?)').run(actor,action,id,at,detailsStr,ip);
}
export function recordConsent(db,{patientId,version='v1.0-ITDA',language='en',termsText,userId}){
 const id=randomUUID(),grantedAt=new Date().toISOString();
 db.prepare(`INSERT INTO consents(id,patient_id,version,language,terms_text,status,granted_at,recorded_by) VALUES(?,?,?,?,?,'granted',?,?)`).run(id,patientId,version,language,termsText,grantedAt,userId);
 audit(db,userId,'consent.granted',patientId,{consentId:id,version,language});
 return {id,patientId,version,language,status:'granted',grantedAt};
}
export function withdrawConsent(db,patientId,userId,reason='Patient requested withdrawal'){
 const now=new Date().toISOString();
 const active=db.prepare(`SELECT * FROM consents WHERE patient_id=? AND status='granted' ORDER BY granted_at DESC LIMIT 1`).get(patientId);
 if(!active)throw new Error('No active consent found to withdraw.');
 db.prepare(`UPDATE consents SET status='withdrawn',withdrawn_at=? WHERE id=?`).run(now,active.id);
 audit(db,userId,'consent.withdrawn',patientId,{consentId:active.id,reason});
 return {patientId,status:'withdrawn',withdrawnAt:now,consentId:active.id};
}
export function isConsentActive(db,patientId){
 const row=db.prepare(`SELECT status FROM consents WHERE patient_id=? ORDER BY granted_at DESC LIMIT 1`).get(patientId);
 if(row)return row.status==='granted';
 const pRow=db.prepare(`SELECT body FROM patients WHERE id=?`).get(patientId);
 if(!pRow)return false;
 try{return JSON.parse(pRow.body).consent===true;}catch{return false;}
}
export function getPatientConsent(db,patientId){
 return db.prepare(`SELECT * FROM consents WHERE patient_id=? ORDER BY granted_at DESC LIMIT 1`).get(patientId)||null;
}
export function patientFrom(row){return {...JSON.parse(row.body),version:row.version,createdBy:row.created_by,updatedAt:row.updated_at};}
export function putEvent(db,type,patient){const event={id:randomUUID(),type,patientId:patient.id,createdAt:new Date().toISOString(),data:{stage:patient.stage,village:patient.village}};db.prepare('INSERT INTO events(id,patient_id,type,body) VALUES(?,?,?,?)').run(event.id,event.patientId,type,JSON.stringify(event));}

