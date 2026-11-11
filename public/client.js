import {isAndroid,nativeRequest} from './platform.js';
const sessionStore=isAndroid()?localStorage:sessionStorage;const sessionKey=isAndroid()?'drishti-native-session':'drishti-session';
let identity=null,cache=null;let syncing=false;
export function currentIdentity(){return identity;}
export function forgetSession(){identity=null;sessionStore.removeItem(sessionKey);}
export async function api(path,{method='GET',data}={}){let response,result;if(isAndroid()){const native=await nativeRequest(path,method,data,identity?.csrf);response={ok:native.status>=200&&native.status<300,status:native.status};result=native.body;}else{try{response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&identity?{'X-CSRF-Token':identity.csrf}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(path.includes('/research-ai')||path==='/api/ai/status'?30000:15000)});}catch(netErr){if(path==='/api/auth/me')throw netErr;const err=new Error('Cannot connect to server at http://localhost:4173. Please make sure the server is running (node server.mjs).');err.status=0;throw err;}result=await response.json();}if(!response.ok){if(response.status===401){identity=null;sessionStore.removeItem(sessionKey);}const error=Error(result.error||'Request failed.');error.status=response.status;throw error;}return result;}
export async function recoverSession(){try{identity=await api('/api/auth/me');sessionStore.setItem(sessionKey,JSON.stringify(identity));return identity;}catch(error){if(error.status){sessionStore.removeItem(sessionKey);identity=null;return null;}try{const cached=JSON.parse(sessionStore.getItem(sessionKey));if(cached?.expires>Date.now()){identity=cached;return identity;}}catch{}return null;}}
export async function login(email,password){identity=await api('/api/auth/login',{method:'POST',data:{email,password}});sessionStore.setItem(sessionKey,JSON.stringify(identity));return identity;}
export async function logout(){await api('/api/auth/logout',{method:'POST',data:{}});sessionStore.removeItem(sessionKey);identity=null;cache?.close();cache=null;}
export async function openCache(){cache?.close();cache=await new Promise((resolve,reject)=>{const request=indexedDB.open(`drishti-shared-${identity.instanceId}-${identity.user.id}`,1);request.onupgradeneeded=()=>{request.result.createObjectStore('patients',{keyPath:'id'});};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
function action(mode,run){return new Promise((resolve,reject)=>{const tr=cache.transaction('patients',mode);const request=run(tr.objectStore('patients'));tr.oncomplete=()=>resolve(request?.result);tr.onerror=()=>reject(tr.error);});}
export const localPatients=()=>action('readonly',s=>s.getAll());
export const saveLocal=patient=>action('readwrite',s=>s.put(patient));
export async function createScreening(patient){if(identity.user.role!=='worker')throw Error('Only health workers can register screenings.');await saveLocal({...patient,_sync:'pending',_owner:identity.user.id});}
export async function syncRecords(){
  if(syncing)return {busy:true,uploaded:0,conflicts:0,failed:0};
  if(!navigator.onLine)throw Error('Offline. Records remain saved on this device.');
  syncing=true;let uploaded=0,conflicts=0,failed=0;
  try{
    const local=await localPatients();
    let serverPatients=null;
    for(const patient of local.filter(p=>p._sync==='pending'||p._sync==='conflict')){
      if(identity.user.role!=='worker'||patient._owner!==identity.user.id)continue;
      try{
        const {patient:remote}=await api('/api/patients',{method:'POST',data:patient});
        await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
        uploaded++;
      }catch(error){
        if(error.status===409){
          conflicts++;
          try{
            if(!serverPatients){
              const res=await api('/api/patients');
              serverPatients=res.patients||[];
            }
            const remoteConflict=serverPatients.find(sp=>sp.id===patient.id)||null;
            await saveLocal({...patient,_sync:'conflict',_syncError:error.message,_serverConflict:remoteConflict});
          }catch{
            await saveLocal({...patient,_sync:'conflict',_syncError:error.message});
          }
        }else{
          failed++;
          await saveLocal({...patient,_syncError:error.message});
        }
      }
    }
    const result=await api('/api/patients');
    for(const remote of result.patients){
      const pending=local.find(p=>p.id===remote.id&&(p._sync==='pending'||p._sync==='conflict'));
      if(!pending||uploaded)await saveLocal({...remote,_sync:'shared'});
    }
    return {uploaded,conflicts,failed};
  }finally{syncing=false;}
}

export async function syncSingleRecord(patientId){
  if(!navigator.onLine)throw Error('Offline. Cannot sync single record.');
  const local=await localPatients();
  const patient=local.find(p=>p.id===patientId);
  if(!patient)throw Error('Record not found on device.');
  try{
    const {patient:remote}=await api('/api/patients',{method:'POST',data:patient});
    await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
    return {success:true,patient:remote};
  }catch(error){
    if(error.status===409){
      try{
        const res=await api('/api/patients');
        const remoteConflict=(res.patients||[]).find(sp=>sp.id===patient.id)||null;
        await saveLocal({...patient,_sync:'conflict',_syncError:error.message,_serverConflict:remoteConflict});
        return {conflict:true,error:error.message,serverRecord:remoteConflict};
      }catch{
        await saveLocal({...patient,_sync:'conflict',_syncError:error.message});
        return {conflict:true,error:error.message};
      }
    }
    await saveLocal({...patient,_syncError:error.message});
    throw error;
  }
}

export async function resolveConflict(patientId,resolution){
  const local=await localPatients();
  const patient=local.find(p=>p.id===patientId);
  if(!patient)throw Error('Record not found.');
  if(resolution==='keep_server'){
    let serverRecord=patient._serverConflict;
    if(!serverRecord&&navigator.onLine){
      const res=await api('/api/patients');
      serverRecord=(res.patients||[]).find(sp=>sp.id===patientId);
    }
    if(!serverRecord)throw Error('Server record unavailable to resolve conflict.');
    await saveLocal({...serverRecord,_sync:'shared',_syncError:null,_serverConflict:null});
    return {resolved:true,patient:serverRecord,kept:'server'};
  }
  if(resolution==='keep_local'||resolution==='overwrite_local'){
    if(!navigator.onLine)throw Error('Online connection required to overwrite conflict.');
    let serverRecord=patient._serverConflict;
    if(!serverRecord){
      const res=await api('/api/patients');
      serverRecord=(res.patients||[]).find(sp=>sp.id===patientId);
    }
    const updatedLocal={...patient,version:serverRecord?.version||patient.version||1,_sync:'pending',_syncError:null,_serverConflict:null};
    if(serverRecord&&serverRecord.createdBy&&serverRecord.createdBy!==identity.user.id){
      updatedLocal.id='AD-'+crypto.randomUUID().slice(0,8).toUpperCase();
      updatedLocal.name=patient.name+' (Device copy)';
    }
    const {patient:remote}=await api('/api/patients',{method:'POST',data:updatedLocal});
    await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
    return {resolved:true,patient:remote,kept:'local'};
  }
  throw Error('Invalid resolution strategy: use "keep_server" or "overwrite_local".');
}
export async function reviewPatient(patient){if(!navigator.onLine)throw Error('Clinical reviews require a connection to the shared server.');if(!patient.version)throw Error('Upload this screening before clinical review.');const {patient:remote}=await api(`/api/patients/${encodeURIComponent(patient.id)}/review`,{method:'PATCH',data:{version:patient.version,stage:patient.stage,notes:patient.notes,facility:patient.facility,due:patient.due,quadrant:patient.quadrant,provisionalDiagnosis:patient.provisionalDiagnosis,priority:patient.priority}});await saveLocal({...remote,_sync:'shared'});return remote;}
export async function listReferrals(query=''){return api(`/api/referrals${query?`?${query}`:''}`);}
export async function updateReferral(referralId,status,notes=''){return api(`/api/referrals/${encodeURIComponent(referralId)}`,{method:'PATCH',data:{status,notes}});}
export async function createReferral(patientId,data){return api(`/api/patients/${encodeURIComponent(patientId)}/referrals`,{method:'POST',data});}


