import { openStore, transaction } from '../src/store.mjs';

const db = openStore('.local');
const patients = db.prepare('SELECT id, body FROM patients').all();
const doctor = db.prepare("SELECT id FROM users WHERE role='doctor' LIMIT 1").get();
const worker = db.prepare("SELECT id FROM users WHERE role='worker' LIMIT 1").get();
const facilities = ['Area Hospital Paderu', 'Community Health Centre Chintapalle', 'CHC Araku Valley'];
const priorities = ['urgent', 'routine', 'emergency'];

transaction(db, () => {
  patients.slice(0, 3).forEach((pRow, idx) => {
    const p = JSON.parse(pRow.body);
    const refId = 'REF-' + p.id;
    const now = new Date().toISOString();
    const dueDate = new Date(Date.now() + 86400000 * (idx + 2)).toISOString().slice(0, 10);
    const facility = facilities[idx % facilities.length];
    const priority = priorities[idx % priorities.length];
    
    p.stage = 'referred';
    p.facility = facility;
    p.priority = priority;
    p.due = dueDate;
    p.notes = 'Teleconsultation recommended by primary screening.';
    
    db.prepare('INSERT OR REPLACE INTO referrals(id, patient_id, facility, priority, due_date, notes, status, created_by, created_at, updated_at, quadrant) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
      .run(refId, p.id, facility, priority, dueDate, p.notes, idx === 0 ? 'scheduled' : 'referred', worker.id, now, now, 'UPPER_RIGHT');
      
    db.prepare('UPDATE patients SET body=? WHERE id=?').run(JSON.stringify(p), p.id);
    
    const consultId = 'CONSULT-' + p.id;
    db.prepare('INSERT OR REPLACE INTO consultations(id, patient_id, scheduled_at, created_by, event_id, created_at, status, room_url) VALUES(?,?,?,?,?,?,?,?)')
      .run(consultId, p.id, now, doctor.id, 'EVT-' + consultId, now, 'ready', 'https://meet.jit.si/Drishti-' + consultId);
  });
});

console.log('Seeded Referrals:', db.prepare('SELECT count(*) as c FROM referrals').get().c);
console.log('Seeded Consultations:', db.prepare('SELECT count(*) as c FROM consultations').get().c);
db.close();

