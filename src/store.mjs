import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,existsSync,writeFileSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {randomBytes,scryptSync,timingSafeEqual,randomUUID,createHash} from 'node:crypto';
import {applyMigrations} from './migrations.mjs';

export const digest=value=>createHash('sha256').update(value).digest('hex');
export function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(password,salt,64).toString('hex')}`;}
export function passwordMatches(password,hash){const [salt,expected]=hash.split(':');return timingSafeEqual(Buffer.from(expected,'hex'),scryptSync(password,salt,64));}
export function openStore(directory){
 mkdirSync(directory,{recursive:true});const db=new DatabaseSync(join(directory,'drishti.sqlite'));
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;`);
 applyMigrations(db);
 if(!db.prepare('SELECT value FROM meta WHERE key=?').get('instanceId'))db.prepare('INSERT INTO meta VALUES(?,?)').run('instanceId',randomUUID());
 if(!db.prepare('SELECT id FROM users LIMIT 1').get()){
  const accounts=[['worker','Health worker','Worker@1234'],['doctor','Medical officer','Doctor@1234'],['admin','District administrator','Admin@1234']].map(([role,name,password])=>({id:randomUUID(),email:`${role}@drishti.local`,name,role,password}));
  const file=join(directory,'demo-accounts.json');if(existsSync(file))throw Error('Existing account file found with an empty database; refusing to overwrite.');
  const insert=db.prepare('INSERT INTO users(id,email,name,role,password_hash) VALUES(?,?,?,?,?)');db.exec('BEGIN');try{for(const u of accounts)insert.run(u.id,u.email,u.name,u.role,passwordHash(u.password));writeFileSync(file,JSON.stringify({notice:'Local synthetic demo accounts. Keep this file private.',accounts},null,2),{mode:0o600,flag:'wx'});db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
 }
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

