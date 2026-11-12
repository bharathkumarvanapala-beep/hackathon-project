import {isAndroid,nativeRequest} from './platform.js';
const sessionStore=isAndroid()?localStorage:sessionStorage;const sessionKey=isAndroid()?'drishti-native-session':'drishti-session';
let identity=null,cache=null;let syncing=false;
export function currentIdentity(){return identity;}
export function forgetSession(){identity=null;sessionStore.removeItem(sessionKey);}
export async function api(path,{method='GET',data}={}){let response,result;if(isAndroid()){const native=await nativeRequest(path,method,data,identity?.csrf);response={ok:native.status>=200&&native.status<300,status:native.status};result=native.body;}else{try{response=await fetch(path,{method,credentials:'same-origin',cache:'no-store',headers:{...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'&&identity?{'X-CSRF-Token':identity.csrf}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(path.includes('/research-ai')||path==='/api/ai/status'?30000:15000)});}catch(netErr){if(path==='/api/auth/me')throw netErr;const err=new Error('Cannot connect to server at http://localhost:4173. Please make sure the server is running (node server.mjs).');err.status=0;throw err;}result=await response.json();}if(!response.ok){if(response.status===401){identity=null;sessionStore.removeItem(sessionKey);}const error=Error(result.error||'Request failed.');error.status=response.status;throw error;}return result;}
export async function recoverSession(){try{identity=await api('/api/auth/me');sessionStore.setItem(sessionKey,JSON.stringify(identity));return identity;}catch(error){if(error.status){sessionStore.removeItem(sessionKey);identity=null;return null;}try{const cached=JSON.parse(sessionStore.getItem(sessionKey));if(cached?.expires>Date.now()){identity=cached;return identity;}}catch{}return null;}}
export async function login(email,password){identity=await api('/api/auth/login',{method:'POST',data:{email,password}});sessionStore.setItem(sessionKey,JSON.stringify(identity));return identity;}
export async function logout(){await api('/api/auth/logout',{method:'POST',data:{}});sessionStore.removeItem(sessionKey);identity=null;cache?.close();cache=null;}

export async function openCache(){
  cache?.close();
  cache=await new Promise((resolve,reject)=>{
    const request=indexedDB.open(`drishti-shared-${identity.instanceId}-${identity.user.id}`,2);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('patients'))db.createObjectStore('patients',{keyPath:'id'});
      if(!db.objectStoreNames.contains('outbox'))db.createObjectStore('outbox',{keyPath:'id'});
      if(!db.objectStoreNames.contains('datasets'))db.createObjectStore('datasets',{keyPath:'key'});
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

function storeAction(storeName,mode,run){
  if(!cache)return Promise.resolve(mode==='readonly'?[]:undefined);
  return new Promise((resolve,reject)=>{
    const tr=cache.transaction(storeName,mode);
    const request=run(tr.objectStore(storeName));
    tr.oncomplete=()=>resolve(request?.result);
    tr.onerror=()=>reject(tr.error);
  });
}

export const localPatients=()=>storeAction('patients','readonly',s=>s.getAll()).then(r=>r||[]);
export const saveLocal=patient=>storeAction('patients','readwrite',s=>s.put(patient));
export const localOutbox=()=>storeAction('outbox','readonly',s=>s.getAll()).then(r=>(r||[]).sort((a,b)=>(a.createdAt||'').localeCompare(b.createdAt||'')));
export const saveOutboxItem=item=>storeAction('outbox','readwrite',s=>s.put(item));
export const deleteOutboxItem=id=>storeAction('outbox','readwrite',s=>s.delete(id));

export async function saveCachedDataset(key,value){
  if(!cache)return;
  await storeAction('datasets','readwrite',s=>s.put({key,value,updatedAt:new Date().toISOString()}));
}

export async function getCachedDataset(key,fallback=null){
  if(!cache)return fallback;
  const rec=await storeAction('datasets','readonly',s=>s.get(key));
  return rec?rec.value:fallback;
}

export async function getLastSyncAt(){
  return getCachedDataset('lastSyncAt',null);
}

async function queueOutboxAction({type,label,patientId=null,patientName='',method,path,data}){
  const item={
    id:'OB-'+crypto.randomUUID().slice(0,8).toUpperCase(),
    type,
    label,
    patientId,
    patientName,
    method,
    path,
    data,
    status:'pending',
    error:null,
    createdAt:new Date().toISOString(),
    ownerId:identity?.user?.id||'unknown'
  };
  await saveOutboxItem(item);
  return item;
}

export async function createScreening(patient){
  if(identity.user.role!=='worker')throw Error('Only health workers can register screenings.');
  await saveLocal({...patient,_sync:'pending',_owner:identity.user.id});
}

async function replayOutboxItem(item,versionAdvanceMap){
  let payload=item.data;
  if(item.patientId&&Number.isInteger(payload?.version)&&versionAdvanceMap?.has(item.patientId)){
    const adv=versionAdvanceMap.get(item.patientId);
    if(payload.version===adv.baseVersion){
      payload={...payload,version:adv.latestVersion};
    }
  }
  const res=await api(item.path,{method:item.method,data:payload});
  await deleteOutboxItem(item.id);
  if(res?.patient){
    if(versionAdvanceMap&&Number.isInteger(item.data?.version)){
      const prevAdv=versionAdvanceMap.get(item.patientId);
      versionAdvanceMap.set(item.patientId,{baseVersion:prevAdv?prevAdv.baseVersion:item.data.version,latestVersion:res.patient.version});
    }
    await saveLocal({...res.patient,_sync:'shared',_syncError:null,_serverConflict:null});
  }
  return res;
}

export async function syncOutboxItem(itemId){
  if(!navigator.onLine)throw Error('Offline. Cannot sync queued action.');
  const items=await localOutbox();
  const item=items.find(i=>i.id===itemId);
  if(!item)throw Error('Queued action not found.');
  try{
    const result=await replayOutboxItem(item,null);
    await saveCachedDataset('lastSyncAt',new Date().toISOString());
    return {success:true,result};
  }catch(error){
    if(error.status===409){
      await saveOutboxItem({...item,status:'conflict',error:error.message});
      if(item.patientId){
        try{
          const res=await api('/api/patients');
          const remoteConflict=(res.patients||[]).find(sp=>sp.id===item.patientId)||null;
          const local=(await localPatients()).find(p=>p.id===item.patientId);
          if(local)await saveLocal({...local,_sync:'conflict',_syncError:error.message,_serverConflict:remoteConflict});
        }catch{}
      }
      return {conflict:true,error:error.message};
    }
    await saveOutboxItem({...item,status:'failed',error:error.message});
    throw error;
  }
}

export async function syncRecords(){
  if(syncing)return {busy:true,uploaded:0,conflicts:0,failed:0};
  if(!navigator.onLine)throw Error('Offline. Records remain saved on this device.');
  syncing=true;let uploaded=0,conflicts=0,failed=0;
  try{
    const local=await localPatients();
    let serverPatients=null;
    // 1. Sync pending worker patient screenings
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

    // 2. Replay role-wide offline outbox actions FIFO (reviews, referrals, biopsies, navigation, care)
    const outbox=await localOutbox();
    const versionAdvanceMap=new Map();
    for(const item of outbox){
      if(item.ownerId&&item.ownerId!==identity.user.id)continue;
      try{
        await replayOutboxItem(item,versionAdvanceMap);
        uploaded++;
      }catch(error){
        if(error.status===409){
          conflicts++;
          await saveOutboxItem({...item,status:'conflict',error:error.message});
          if(item.patientId){
            try{
              if(!serverPatients){
                const pRes=await api('/api/patients');
                serverPatients=pRes.patients||[];
              }
              const remoteConflict=serverPatients.find(sp=>sp.id===item.patientId)||null;
              const localRec=local.find(p=>p.id===item.patientId);
              if(localRec)await saveLocal({...localRec,_sync:'conflict',_syncError:error.message,_serverConflict:remoteConflict});
            }catch{}
          }
        }else{
          failed++;
          await saveOutboxItem({...item,status:'failed',error:error.message});
        }
      }
    }

    // 3. Refresh authoritative shared patients from server
    const result=await api('/api/patients');
    const latestOutbox=await localOutbox();
    const outboxPatientIds=new Set(latestOutbox.map(i=>i.patientId).filter(Boolean));
    for(const remote of result.patients){
      const pending=local.find(p=>p.id===remote.id&&(p._sync==='pending'||p._sync==='conflict'));
      if((!pending&&!outboxPatientIds.has(remote.id))||uploaded)await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
    }
    await saveCachedDataset('lastSyncAt',new Date().toISOString());
    return {uploaded,conflicts,failed};
  }finally{syncing=false;}
}

export async function syncSingleRecord(patientId){
  if(!navigator.onLine)throw Error('Offline. Cannot sync single record.');
  const local=await localPatients();
  const patient=local.find(p=>p.id===patientId);
  if(!patient)throw Error('Record not found on device.');

  // Check if queued outbox review/actions exist for this patient
  const outbox=(await localOutbox()).filter(i=>i.patientId===patientId);
  if(outbox.length&&identity.user.role!=='worker'){
    let lastRes=null;
    const versionAdvanceMap=new Map();
    for(const item of outbox){
      try{
        lastRes=await replayOutboxItem(item,versionAdvanceMap);
      }catch(error){
        if(error.status===409){
          await saveOutboxItem({...item,status:'conflict',error:error.message});
          const res=await api('/api/patients').catch(()=>({patients:[]}));
          const remoteConflict=(res.patients||[]).find(sp=>sp.id===patientId)||null;
          await saveLocal({...patient,_sync:'conflict',_syncError:error.message,_serverConflict:remoteConflict});
          return {conflict:true,error:error.message,serverRecord:remoteConflict};
        }
        throw error;
      }
    }
    await saveCachedDataset('lastSyncAt',new Date().toISOString());
    return {success:true,patient:lastRes?.patient||patient};
  }

  try{
    const {patient:remote}=await api('/api/patients',{method:'POST',data:patient});
    await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
    await saveCachedDataset('lastSyncAt',new Date().toISOString());
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
  const outboxItems=(await localOutbox()).filter(i=>i.patientId===patientId);

  if(resolution==='keep_server'){
    let serverRecord=patient._serverConflict;
    if(!serverRecord&&navigator.onLine){
      const res=await api('/api/patients');
      serverRecord=(res.patients||[]).find(sp=>sp.id===patientId);
    }
    if(!serverRecord)throw Error('Server record unavailable to resolve conflict.');
    for(const item of outboxItems)await deleteOutboxItem(item.id);
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
    const reviewItem=outboxItems.find(i=>i.type==='review.save');
    if(reviewItem){
      const payload={...reviewItem.data,version:serverRecord?.version||patient.version};
      const {patient:remote}=await api(reviewItem.path,{method:reviewItem.method,data:payload});
      await deleteOutboxItem(reviewItem.id);
      await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
      return {resolved:true,patient:remote,kept:'local'};
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

export async function reviewPatient(patient){
  if(!patient.version)throw Error('Upload this screening before clinical review.');
  const path=`/api/patients/${encodeURIComponent(patient.id)}/review`;
  const data={version:patient.version,stage:patient.stage,notes:patient.notes,facility:patient.facility,due:patient.due,quadrant:patient.quadrant,provisionalDiagnosis:patient.provisionalDiagnosis,priority:patient.priority};
  const queueOffline=async()=>{
    await queueOutboxAction({type:'review.save',label:`Clinical review (${patient.stage})`,patientId:patient.id,patientName:patient.name,method:'PATCH',path,data});
    const offlineCopy={...patient,_sync:'pending',_syncError:null,updatedAt:new Date().toISOString()};
    await saveLocal(offlineCopy);
    return offlineCopy;
  };
  if(!navigator.onLine)return queueOffline();
  try{
    const {patient:remote}=await api(path,{method:'PATCH',data});
    await saveLocal({...remote,_sync:'shared',_syncError:null,_serverConflict:null});
    return remote;
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}

export async function listReferrals(query=''){return api(`/api/referrals${query?`?${query}`:''}`);}

export async function updateReferral(referralId,status,notes='',meta={}){
  const path=`/api/referrals/${encodeURIComponent(referralId)}`;
  const data={status,notes};
  const queueOffline=async()=>{
    await queueOutboxAction({type:'referral.update',label:`Referral → ${status}`,patientId:meta.patientId||null,patientName:meta.patientName||referralId,method:'PATCH',path,data});
    const cachedRefs=await getCachedDataset('referrals',[]);
    const updated=cachedRefs.map(r=>r.id===referralId?{...r,status,notes:notes||r.notes,_sync:'pending'}:r);
    await saveCachedDataset('referrals',updated);
    return {ok:true,offlineQueued:true};
  };
  if(!navigator.onLine)return queueOffline();
  try{
    return await api(path,{method:'PATCH',data});
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}

export async function createReferral(patientId,data){return api(`/api/patients/${encodeURIComponent(patientId)}/referrals`,{method:'POST',data});}
export async function fetchDashboardStats(){return api('/api/dashboard/stats');}
export async function fetchAiAnalyses(){return api('/api/ai/analyses');}
export async function fetchAiStatus(){return api('/api/ai/status');}
export async function fetchConsultationsList(){return api('/api/consultations');}
export async function fetchAdminUsers(){return api('/api/admin/users');}
export async function fetchAdminAudit(){return api('/api/admin/audit');}
export async function fetchFacilities(){return api('/api/facilities');}
export async function listInvestigations(query=''){return api(`/api/investigations${query?`?${query}`:''}`);}

export async function createInvestigation(data){
  const queueOffline=async()=>{
    const tempId='INV-OFFLINE-'+crypto.randomUUID().slice(0,6).toUpperCase();
    await queueOutboxAction({type:'investigation.create',label:`Order ${data.testType||'biopsy'} (${data.facility||''})`,patientId:data.patientId,patientName:data.patientName||data.patientId,method:'POST',path:'/api/investigations',data});
    const cached=await getCachedDataset('investigations',[]);
    await saveCachedDataset('investigations',[{id:tempId,patient_id:data.patientId,test_type:data.testType||'biopsy',facility:data.facility||'Area Hospital Paderu',status:'ordered',clinical_findings:data.clinicalFindings||'',ordered_at:new Date().toISOString(),_sync:'pending'},...cached]);
    return {ok:true,offlineQueued:true};
  };
  if(!navigator.onLine)return queueOffline();
  try{
    return await api('/api/investigations',{method:'POST',data});
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}

export async function updateInvestigation(id,data){
  const path=`/api/investigations/${encodeURIComponent(id)}`;
  const queueOffline=async()=>{
    await queueOutboxAction({type:'investigation.update',label:`Lab report (${data.status||'completed'})`,patientId:data.patientId||null,patientName:data.patientName||id,method:'PATCH',path,data});
    const cached=await getCachedDataset('investigations',[]);
    await saveCachedDataset('investigations',cached.map(inv=>inv.id===id?{...inv,...data,clinical_findings:data.clinicalFindings||inv.clinical_findings,_sync:'pending'}:inv));
    return {ok:true,offlineQueued:true};
  };
  if(!navigator.onLine)return queueOffline();
  try{
    return await api(path,{method:'PATCH',data});
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}

export async function listNavigation(query=''){return api(`/api/navigation${query?`?${query}`:''}`);}

export async function createNavigation(data){
  const queueOffline=async()=>{
    const tempId='NAV-OFFLINE-'+crypto.randomUUID().slice(0,6).toUpperCase();
    await queueOutboxAction({type:'navigation.create',label:`Navigation (${data.contactStatus||'contacted'})`,patientId:data.patientId,patientName:data.patientName||data.patientId,method:'POST',path:'/api/navigation',data});
    const cached=await getCachedDataset('navigation',[]);
    await saveCachedDataset('navigation',[{id:tempId,patient_id:data.patientId,contact_status:data.contactStatus||'contacted',barrier_identified:data.barrierIdentified||'',attendance_confirmed:data.attendanceConfirmed?1:0,notes:data.notes||'',navigator_name:identity?.user?.name||'Coordinator',updated_at:new Date().toISOString(),_sync:'pending'},...cached]);
    return {ok:true,offlineQueued:true};
  };
  if(!navigator.onLine)return queueOffline();
  try{
    return await api('/api/navigation',{method:'POST',data});
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}

export async function saveCareEntry(patient,data){
  const path=`/api/patients/${encodeURIComponent(patient.id)}/care`;
  const queueOffline=async()=>{
    await queueOutboxAction({type:'care.create',label:`Care entry (${data.title||data.type})`,patientId:patient.id,patientName:patient.name,method:'POST',path,data:{...data,version:patient.version}});
    const entry={id:crypto.randomUUID(),...data,author:identity?.user?.name||'Doctor',at:new Date().toISOString(),_sync:'pending'};
    const updated={...patient,careEntries:[...(patient.careEntries||[]),entry],_sync:'pending'};
    await saveLocal(updated);
    return {patient:updated,offlineQueued:true};
  };
  if(!navigator.onLine)return queueOffline();
  try{
    const result=await api(path,{method:'POST',data:{...data,version:patient.version}});
    await saveLocal({...result.patient,_sync:'shared'});
    return result;
  }catch(err){
    if(err.status===0)return queueOffline();
    throw err;
  }
}
