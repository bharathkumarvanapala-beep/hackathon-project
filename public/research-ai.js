import {api,currentIdentity,saveLocal} from './client.js';

const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({
  '&':'&amp;',
  '<':'&lt;',
  '>':'&gt;',
  '"':'&quot;',
  "'":'&#39;'
}[c]));

export function researchMarkup(p,lang){
  const te=lang==='te';
  const r=p.researchAI;
  const isDoctor=currentIdentity()?.user?.role==='doctor';

  let findingsHtml='';
  if(r&&Array.isArray(r.candidateFindings)&&r.candidateFindings.length){
    findingsHtml=`
      <div style="margin: 16px 0;">
        <h4 style="font-size: 11px; margin: 0 0 10px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.5px;">
          ${te?'నమూనా పోలిక స్కోర్లు (పరిశోధన మాత్రమే)':'Candidate Pattern Scores (Research Only)'}
        </h4>
        <div style="background: rgba(255, 255, 255, 0.4); padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.6);">
          ${r.candidateFindings.map((f)=>{
            const pct=Math.round((f.score||0)*100);
            return `
              <div class="bar-row" style="margin: 10px 0;">
                <span title="${esc(f.label)}">${esc(f.label)}</span>
                <div class="bar"><i style="width: ${pct}%"></i></div>
                <b>${pct}%</b>
              </div>
            `;
          }).join('')}
        </div>
        <p class="mini" style="margin-top: 8px;">
          ${te
            ?'ఈ స్కోర్లు యంత్ర నమూనా పోలికలు మాత్రమే. ఎక్కువ స్కోరు ఉన్నా అది తుది నిర్ధారణ కాదు.'
            :'Scores indicate unverified pattern similarity. A high score is not a clinical confirmation.'}
        </p>
      </div>
    `;
  }

  let warningsHtml='';
  if(r&&Array.isArray(r.warnings)&&r.warnings.length){
    warningsHtml=`
      <div class="notice" style="background: #fff8e8; border-color: #f7dfa5; color: #876228; margin: 12px 0;">
        <strong>${te?'మోడల్ పరిమితులు &amp; హెచ్చరికలు:':'Model Constraints &amp; Research Notice:'}</strong>
        <ul style="margin: 6px 0 0 18px; padding: 0; font-size: 11px; line-height: 1.6;">
          ${r.warnings.map((w)=>`<li>${esc(w)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  return `
    <section class="card" id="research-ai">
      <div class="card-head">
        <h2>${te?'పరిశోధన AI':'Research AI'}</h2>
        <span class="pill amber">${te?'వైద్య ధృవీకరణ లేదు':'Not clinically validated'}</span>
      </div>

      <div class="notice" style="background: #fdf5e6; border: 1px solid #f9dfad; color: #875c1c;">
        ${te
          ?'⚠️ పరిశోధన ప్రయోజనాల కోసం మాత్రమే. ఇది రోగ నిర్ధారణ కాదు. అర్హత కలిగిన దంతవైద్యుని సమీక్ష తప్పనిసరి. బహుళ-వర్గాల మోడల్స్‌లో ఒక పరిస్థితి కనిపించినా ఇతర సమస్యలు లేవని నిర్ధారించలేము.'
          :'⚠️ Research use only. This output is not a clinical diagnosis. Clinician review is mandatory. In multi-class models, high confidence in one finding does not rule out co-occurring oral conditions.'}
      </div>

      <p id="ai-status" class="mini" role="status">
        ${te?'స్థానిక మోడల్ కనెక్షన్ తనిఖీ…':'Checking local model connection…'}
      </p>

      ${r?`
        <div style="background: rgba(230, 240, 255, 0.4); padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.7); margin-bottom: 16px;">
          <p class="sub">${te?'ప్రధాన అంచనా వర్గం':'Primary Candidate Class'}: <strong style="font-size: 15px; color: var(--ink);">${esc(r.modelClass)}</strong></p>
          <p class="mini" style="margin-top: 4px;">
            ${esc(r.model)} · ${esc(r.revision?.slice(0, 16))} · ${esc(new Date(r.at).toLocaleString())}
          </p>
          ${warningsHtml}
          ${findingsHtml}

          <!-- BILINGUAL CLINICAL DECISION SUPPORT CARDS (PROBLEM DETECTION, ROOT CAUSE, NEXT FOLLOW-UP) -->
          ${r.problemDetection || r.modelClass ? `
            <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 10px;">
              <!-- 1. Problem Detection -->
              <div class="ai-clinical-card problem-card" style="background:#fff;border-left:4px solid #ea580c;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:10px;font-weight:800;color:#c2410c;text-transform:uppercase;">
                    1. Problem Detection · సమస్య గుర్తింపు
                  </span>
                  <span class="pill red" style="font-size:9.5px;padding:2px 6px;">
                    ${esc(r.problemDetection?.severity?.toUpperCase() || 'HIGH')} SEVERITY
                  </span>
                </div>
                <h4 style="margin:2px 0 2px;font-size:13.5px;font-weight:750;color:#0f172a;">
                  ${esc(r.problemDetection?.condition || r.modelClass)}
                </h4>
                <div style="font-size:11.5px;color:#9a3412;font-weight:600;margin-bottom:6px;">
                  ${esc(r.problemDetection?.conditionTe || 'అనుమానాస్పద అల్సర్ గాయం')}
                </div>
                <div style="background:#fff7ed;padding:8px 10px;border-radius:6px;font-size:11px;color:#9a3412;line-height:1.45;margin-bottom:6px;">
                  <strong>Doctor Finding:</strong> ${esc(r.problemDetection?.doctorObservation || r.observations || 'Indurated mucosal lesion requiring biopsy.')}
                </div>
                <div style="background:#f8fafc;padding:8px 10px;border-radius:6px;font-size:11px;color:#1e293b;line-height:1.45;">
                  <strong>Patient Understanding / రోగికి వివరణ:</strong><br>
                  ${esc(r.problemDetection?.patientExplanation || 'Persistent non-healing sore requiring specialist testing.')}<br>
                  <em style="color:#059669;">${esc(r.problemDetection?.patientExplanationTe || 'నోటిలో పుండు - తక్షణ ఆసుపత్రి పరీక్ష అవసరం.')}</em>
                </div>
              </div>

              <!-- 2. Root Cause -->
              <div class="ai-clinical-card root-cause-card" style="background:#fff;border-left:4px solid #4f46e5;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:10px;font-weight:800;color:#4338ca;text-transform:uppercase;">
                    2. Root Cause Analysis · మూల కారణాల విశ్లేషణ
                  </span>
                  <span class="pill" style="font-size:9.5px;background:#e0e7ff;color:#3730a3;">Etiology</span>
                </div>
                <h4 style="margin:2px 0 2px;font-size:12.5px;font-weight:700;color:#1e1b4b;">
                  ${esc(r.rootCause?.primaryEtiology || 'Chronic Mucosal Irritant Exposure (Tobacco / Gutka)')}
                </h4>
                <div style="font-size:11px;color:#4f46e5;font-weight:600;margin-bottom:6px;">
                  ${esc(r.rootCause?.primaryEtiologyTe || 'దీర్ఘకాలిక పొగాకు లేదా గుట్కా వాడకం వల్ల కణజాలం దెబ్బతినడం')}
                </div>
                <div style="font-size:11px;color:#334155;line-height:1.45;">
                  <strong>Mechanism &amp; Habits:</strong> ${esc(r.rootCause?.habitCorrelation || 'Direct mucosal injury from tobacco nitrosamines preventing ulcer healing.')}
                </div>
                <div style="margin-top:6px;font-size:10.5px;color:#4338ca;">
                  <em>${esc(r.rootCause?.habitCorrelationTe || 'పొగాకు, గుట్కా నమలడం వల్ల విడుదలయ్యే రసాయనాలు నాలుక కణాలను దెబ్బతీస్తాయి.')}</em>
                </div>
              </div>

              <!-- 3. Next Follow-Up Protocol -->
              <div class="ai-clinical-card followup-card" style="background:#fff;border-left:4px solid #16a34a;border-radius:10px;padding:12px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-size:10px;font-weight:800;color:#15803d;text-transform:uppercase;">
                    3. Next Follow-Up Protocol · తదుపరి చర్యలు &amp; చికిత్స
                  </span>
                  <span class="pill red" style="font-size:9.5px;">
                    ⏱️ ${esc(r.nextFollowUp?.urgency || 'Urgent (Within 7 Days)')}
                  </span>
                </div>
                <div style="margin-bottom:6px;">
                  <strong style="font-size:12px;color:#0f172a;">${esc(r.nextFollowUp?.facility || 'ITDA Area Hospital, Paderu')}</strong>
                  <div style="font-size:11px;color:#059669;font-weight:600;">${esc(r.nextFollowUp?.facilityTe || 'ఐటీడీఏ ఏరియా ఆసుపత్రి, పాడేరు')}</div>
                </div>
                <ul style="margin:0;padding-left:16px;font-size:11px;color:#1e293b;line-height:1.5;">
                  ${(r.nextFollowUp?.actionSteps || [
                    'Urgent incisional biopsy & histopathology',
                    'Teleconsultation with Oral Medicine Specialist',
                    'Immediate tobacco/gutka cessation'
                  ]).map(s => `<li>${esc(s)}</li>`).join('')}
                </ul>
                <div style="margin-top:10px;">
                  <button type="button" class="btn" style="background:#0284c7;color:#fff;font-size:11px;font-weight:700;padding:7px 12px;border-radius:7px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;" data-start-video-consult="${esc(p.id)}">
                    📹 ${te ? 'వీడియో కాల్ ప్రారంభించండి' : 'Start Video Consultation'}
                  </button>
                </div>
              </div>
            </div>
          ` : ''}
        </div>
      `:''}

      ${isDoctor?`
        <form id="ai-form">
          <div class="field" style="margin-bottom: 14px;">
            <label for="ai-model-select">${te?'మూల్యాంకన మోడల్ ఎంచుకోండి':'Select AI Adapter Model'}</label>
            <select id="ai-model-select" class="language" style="width: 100%; padding: 8px 10px;">
              <option value="">${te?'మోడల్‌లను లోడ్ చేస్తోంది…':'Loading models…'}</option>
            </select>
          </div>

          <label class="checkbox full" style="margin-bottom: 14px;">
            <input type="checkbox" id="ai-ack" required>
            <span>
              ${te
                ?'ఇది సమ్మతి ఉన్న వయోజన పరిశోధన చిత్రం. వైద్య చికిత్స నిర్ణయాలకు ఈ మోడల్‌ను ఉపయోగించనని ధృవీకరిస్తున్నాను.'
                :'This is an authorized adult research image. I acknowledge this output is for clinical research and will not be used as an automated diagnostic decision.'}
            </span>
          </label>

          <button class="btn primary" id="ai-run" disabled>
            ${te?'స్థానిక పరిశోధన AI అమలు':'Run Local Research AI'}
          </button>
        </form>
      `:`
        <p class="mini">
          ${te?'పరిశోధన AI విశ్లేషణను అభ్యర్థించడానికి వైద్యుని ఖాతా అవసరం.':'A doctor account is required to request research inference.'}
        </p>
      `}

      <div id="ai-history-section" style="margin-top: 16px; display: none;">
        <h4 style="font-size: 11px; margin: 0 0 8px; color: var(--muted); text-transform: uppercase;">
          ${te?'మునుపటి AI విశ్లేషణల రికార్డు':'Previous AI Analyses Ledger'}
        </h4>
        <div id="ai-analyses-list" style="font-size: 11px;"></div>
      </div>

      <p class="mini" style="margin-top: 14px;">
        ${te
          ?'చిత్రం మీ సర్వర్‌లోనే విశ్లేషించబడుతుంది. ఫోన్ ఆఫ్‌లైన్‌లో ఉన్నప్పుడు AI అందుబాటులో ఉండదు.'
          :'Inference runs on your local care server. AI is unavailable while offline.'}
      </p>
      <div id="ai-message" role="status" style="margin-top: 8px; font-size: 12px; font-weight: 500;"></div>
    </section>
  `;
}

export async function mountResearch(p,lang,onSaved){
  const host=document.querySelector('#research-ai');
  if(!host)return;
  const te=lang==='te';

  const statusEl=host.querySelector('#ai-status');
  const messageEl=host.querySelector('#ai-message');
  const button=host.querySelector('#ai-run');
  const modelSelect=host.querySelector('#ai-model-select');
  const historySec=host.querySelector('#ai-history-section');
  const historyList=host.querySelector('#ai-analyses-list');

  // Check consent upfront
  if(p.consent===false){
    if(button)button.disabled=true;
    if(messageEl){
      messageEl.textContent=te
        ?'రోగి సమ్మతి ఉపసంహరించబడింది. AI ప్రాసెసింగ్ నిలిపివేయబడింది.'
        :'Active patient consent is withdrawn. AI processing is disabled.';
      messageEl.style.color='#c0392b';
    }
    if(statusEl){
      statusEl.textContent=te?'సమ్మతి లేదు · నిలిపివేయబడింది':'Consent withdrawn · Disabled';
    }
    return;
  }

  // Fetch models & status
  try{
    const [statusResult,modelsResult]=await Promise.all([
      api('/api/ai/status').catch(()=>({available:false})),
      api('/api/ai/models').catch(()=>({models:[]}))
    ]);

    if(!host.isConnected)return;

    if(modelSelect&&modelsResult.models&&modelsResult.models.length){
      modelSelect.innerHTML=modelsResult.models.map((m)=>`
        <option value="${esc(m.id)}" ${m.active?'selected':''}>
          ${esc(m.name)} (${esc(m.classes?.length||2)} ${te?'వర్గాలు':'classes'}) ${m.active?(te?'★ చురుకైనది':'★ Active'):''}
        </option>
      `).join('');

      modelSelect.onchange=async()=>{
        const newModelId=modelSelect.value;
        try{
          await api('/api/ai/select-model',{method:'POST',data:{modelId:newModelId}});
          const newStatus=await api('/api/ai/status');
          updateStatus(newStatus);
        }catch(err){
          if(messageEl)messageEl.textContent=err.message;
        }
      };
    }

    function updateStatus(res){
      if(!statusEl)return;
      if(res.available){
        statusEl.textContent=`${res.model||'Model'} · ${te?'స్థానిక మోడల్ అనుసంధానం అయింది':'Local research model connected'} · ${res.license||'Research'}`;
      }else{
        statusEl.textContent=te?'స్థానిక AI అందుబాటులో లేదు.':'Local research AI unavailable.';
      }
      if(button){
        button.disabled=!res.available||!p.photo||!p.version||p.age<18||!navigator.onLine||p.consent===false;
      }
    }

    updateStatus(statusResult);

  }catch(err){
    if(statusEl&&host.isConnected){
      statusEl.textContent=te?'ఆఫ్‌లైన్ · AI సర్వర్ అవసరం':'Offline · AI requires local server connection';
    }
  }

  // Fetch historical analyses ledger
  try{
    const analysesResult=await api(`/api/patients/${encodeURIComponent(p.id)}/ai-analyses`);
    if(host.isConnected&&analysesResult?.analyses?.length&&historySec&&historyList){
      historySec.style.display='block';
      historyList.innerHTML=analysesResult.analyses.slice(0,5).map((a)=>`
        <div style="padding: 6px 0; border-bottom: 1px solid rgba(0,0,0,0.06); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${esc(a.modelClass)}</strong>
            <span style="color: var(--muted); margin-left: 6px;">(${esc(a.modelName.split('/').pop())})</span>
          </div>
          <span style="color: var(--muted);">${new Date(a.processedAt).toLocaleDateString()}</span>
        </div>
      `).join('');
    }
  }catch{}

  // Handle run form submit
  const form=host.querySelector('#ai-form');
  if(form){
    form.onsubmit=async(e)=>{
      e.preventDefault();
      if(!button||button.disabled)return;
      const ack=host.querySelector('#ai-ack');
      if(!ack?.checked)return;

      button.disabled=true;
      if(messageEl){
        messageEl.style.color='var(--teal)';
        messageEl.textContent=te?'విశ్లేషణ జరుగుతోంది…':'Running local inference…';
      }

      try{
        const selectedModel=modelSelect?.value||undefined;
        const result=await api(`/api/patients/${p.id}/research-ai`,{
          method:'POST',
          data:{
            version:p.version,
            researchAcknowledged:true,
            modelId:selectedModel
          }
        });

        await saveLocal({...result.patient,_sync:'shared'});
        if(messageEl){
          messageEl.textContent=te?'విశ్లేషణ పూర్తయింది.':'Inference complete.';
        }
        await onSaved();
      }catch(error){
        if(messageEl){
          messageEl.style.color='#c0392b';
          messageEl.textContent=error.message;
        }
        button.disabled=false;
      }
    };
  }
}
