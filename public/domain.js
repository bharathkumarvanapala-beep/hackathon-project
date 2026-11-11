export function qualityMetrics(pixels,width,height){
  let sum=0,sum2=0,edges=0,n=0;
  const nTotal=width*height;
  const gray=new Float32Array(nTotal);
  for(let y=0;y<height;y++){
    const row=y*width;
    for(let x=0;x<width;x++){
      const i=(row+x)*4;
      const v=0.299*pixels[i]+0.587*pixels[i+1]+0.114*pixels[i+2];
      gray[row+x]=v;
      sum+=v;sum2+=v*v;
      if(x>0&&y>0){
        const prev=(pixels[i-4]+pixels[i-3]+pixels[i-2])/3;
        edges+=Math.abs(v-prev);n++;
      }
    }
  }
  const brightness=sum/nTotal;
  const contrast=Math.sqrt(Math.max(0,sum2/nTotal-brightness*brightness));
  const detail=edges/Math.max(1,n);

  // Compute 2D Laplacian convolution variance for blur detection
  let lapSum=0,lapSumSq=0,lapCount=0;
  for(let y=1;y<height-1;y++){
    const row=y*width,prevRow=(y-1)*width,nextRow=(y+1)*width;
    for(let x=1;x<width-1;x++){
      const lap=gray[prevRow+x]+gray[nextRow+x]+gray[row+x-1]+gray[row+x+1]-(4*gray[row+x]);
      lapSum+=lap;lapSumSq+=lap*lap;lapCount++;
    }
  }
  const lapMean=lapCount>0?lapSum/lapCount:0;
  const blurScore=lapCount>0?Math.max(0,(lapSumSq/lapCount)-(lapMean*lapMean)):0;

  const issues=[];
  if(brightness<=45)issues.push('TOO_DARK');
  if(brightness>=225)issues.push('TOO_BRIGHT_GLARE');
  if(contrast<=18)issues.push('LOW_CONTRAST');
  if(blurScore<100&&detail<=3)issues.push('BLURRY');

  const pass=brightness>45&&brightness<225&&contrast>18&&detail>3;
  let score=100;
  if(brightness<=45||brightness>=225)score-=35;
  if(contrast<=18)score-=25;
  if(blurScore<100&&detail<=3)score-=30;
  score=Math.max(0,Math.min(100,score));

  const guidance={
    en:issues.includes('BLURRY')?'Hold camera steady (image blurry)':issues.includes('TOO_DARK')?'Use more light or camera flash (too dark)':issues.includes('TOO_BRIGHT_GLARE')?'Reduce glare/reflection (too bright)':issues.includes('LOW_CONTRAST')?'Improve lighting contrast':'Quality check passed',
    te:issues.includes('BLURRY')?'కెమెరా స్థిరంగా ఉంచండి (అస్పష్టంగా ఉంది)':issues.includes('TOO_DARK')?'వెలుతురు లేదా ఫ్లాష్ ఉపయోగించండి (చీకటిగా ఉంది)':issues.includes('TOO_BRIGHT_GLARE')?'కాంతి మెరుపు తగ్గించండి (చాలా కాంతి ఉంది)':issues.includes('LOW_CONTRAST')?'కాంట్రాస్ట్ మెరుగుపరచండి':'నాణ్యత బాగుంది'
  };

  return {brightness,contrast,detail,blurScore,issues,score,guidance,pass};
}
export function pendingEvents(events){return events.filter(e=>!e.delivered);}
export function makeEvent(type,patient){return {id:crypto.randomUUID(),type,patientId:patient.id,createdAt:new Date().toISOString(),data:{stage:patient.stage,village:patient.village},delivered:false};}
export function overdue(patient,today=new Date().toISOString().slice(0,10)){return Boolean(patient.due&&patient.due<today&&patient.stage!=='closed');}

export const QUADRANTS = {
  Q1_UR: { code: 'Q1_UR', en: 'Upper Right (Maxillary Q1)', te: 'ఎగువ కుడి (Q1)' },
  Q2_UL: { code: 'Q2_UL', en: 'Upper Left (Maxillary Q2)', te: 'ఎగువ ఎడమ (Q2)' },
  Q3_LL: { code: 'Q3_LL', en: 'Lower Left (Mandibular Q3)', te: 'దిగువ ఎడమ (Q3)' },
  Q4_LR: { code: 'Q4_LR', en: 'Lower Right (Mandibular Q4)', te: 'దిగువ కుడి (Q4)' },
  MUCOSA: { code: 'MUCOSA', en: 'Oral Mucosa / Tongue / Lip', te: 'నోటి శ్లేష్మం / నాలుక / పెదవి' },
  GENERAL: { code: 'GENERAL', en: 'General Cavity Examination', te: 'సాధారణ నోటి పరీక్ష' }
};

export const FACILITIES = [
  'Area Hospital Paderu',
  'Community Health Centre Araku',
  'CHC Chintapalle',
  'Primary Health Centre Hukumpeta',
  'ITDA Mobile Dental Screening Unit',
  'King George Hospital Visakhapatnam (Tertiary)'
];

export const PRIORITIES = {
  routine: { en: 'Routine', te: 'సాధారణ' },
  urgent: { en: 'Urgent (1-2 days)', te: 'అత్యవసరం (1-2 రోజులు)' },
  emergency: { en: 'Emergency (Immediate)', te: 'తక్షణ అత్యవసరం' }
};

export const REFERRAL_STATUS_LABELS = {
  referred: { en: 'Referred', te: 'రెఫర్ చేయబడింది' },
  scheduled: { en: 'Scheduled', te: 'తేదీ నిర్ణయించబడింది' },
  attended: { en: 'Attended', te: 'హాజరయ్యారు' },
  completed: { en: 'Care Completed', te: 'చికిత్స పూర్తయింది' },
  cancelled: { en: 'Cancelled', te: 'రద్దు చేయబడింది' }
};

