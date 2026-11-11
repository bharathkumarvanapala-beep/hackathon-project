/**
 * Aarogya Drishti — Database Migrations Runner
 *
 * Implements forward-only, transactional migrations for SQLite/PostgreSQL.
 * Never drops production data. Tracks applied versions in schema_migrations.
 */

export const migrations = [
  {
    version: 1,
    name: '001_initial_baseline',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS meta(
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS users(
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('worker', 'doctor', 'admin', 'specialist', 'navigator')),
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS sessions(
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id),
          csrf TEXT NOT NULL,
          expires INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS patients(
          id TEXT PRIMARY KEY,
          body TEXT NOT NULL,
          version INTEGER NOT NULL,
          created_by TEXT NOT NULL REFERENCES users(id),
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS events(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          type TEXT NOT NULL,
          body TEXT NOT NULL,
          delivered_at TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_error TEXT
        );

        CREATE TABLE IF NOT EXISTS audit(
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor TEXT NOT NULL,
          action TEXT NOT NULL,
          record_id TEXT,
          at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS automation_receipts(
          event_id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL,
          type TEXT NOT NULL,
          received_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS consultations(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          scheduled_at TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'preparing',
          room_url TEXT,
          created_by TEXT NOT NULL REFERENCES users(id),
          event_id TEXT NOT NULL UNIQUE,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS settings(
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 2,
    name: '002_consents_and_audit_enhancements',
    up(db) {
      // 1. Dedicated, versioned multilingual consents table
      db.exec(`
        CREATE TABLE IF NOT EXISTS consents(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          version TEXT NOT NULL,
          language TEXT NOT NULL CHECK(language IN ('en', 'te')),
          terms_text TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'granted' CHECK(status IN ('granted', 'withdrawn')),
          granted_at TEXT NOT NULL,
          withdrawn_at TEXT,
          recorded_by TEXT NOT NULL REFERENCES users(id)
        );
        CREATE INDEX IF NOT EXISTS idx_consents_patient ON consents(patient_id);
      `);

      // 2. Enhance audit table with details and IP columns if not already present
      const columns = db.prepare('PRAGMA table_info(audit)').all().map((c) => c.name);
      if (!columns.includes('details')) {
        db.exec('ALTER TABLE audit ADD COLUMN details TEXT;');
      }
      if (!columns.includes('ip_address')) {
        db.exec('ALTER TABLE audit ADD COLUMN ip_address TEXT;');
      }
    },
  },
  {
    version: 3,
    name: '003_referrals_and_care_records',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS referrals(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          facility TEXT NOT NULL,
          priority TEXT NOT NULL DEFAULT 'routine' CHECK(priority IN ('routine', 'urgent', 'emergency')),
          due_date TEXT NOT NULL,
          notes TEXT,
          status TEXT NOT NULL DEFAULT 'referred' CHECK(status IN ('referred', 'scheduled', 'attended', 'completed', 'cancelled')),
          created_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_referrals_patient ON referrals(patient_id);

        CREATE TABLE IF NOT EXISTS care_records(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          type TEXT NOT NULL CHECK(type IN ('diagnostic', 'treatment', 'followup')),
          title TEXT NOT NULL,
          facility TEXT NOT NULL,
          date TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('planned', 'completed', 'missed')),
          notes TEXT NOT NULL,
          report_url TEXT,
          author_id TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_care_patient ON care_records(patient_id);
      `);
    },
  },
  {
    version: 4,
    name: '004_images_storage',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS images(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          sha256 TEXT NOT NULL,
          file_path TEXT NOT NULL,
          mime_type TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          uploaded_by TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_images_patient ON images(patient_id);
        CREATE INDEX IF NOT EXISTS idx_images_sha ON images(sha256);
      `);
    },
  },
  {
    version: 5,
    name: '005_ai_analyses_ledger',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS ai_analyses(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          image_id TEXT,
          model_name TEXT NOT NULL,
          model_version TEXT NOT NULL,
          model_class TEXT NOT NULL,
          candidate_findings TEXT NOT NULL,
          warnings TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'completed',
          requested_by TEXT NOT NULL REFERENCES users(id),
          processed_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ai_patient ON ai_analyses(patient_id);
      `);
    },
  },
  {
    version: 6,
    name: '006_clinical_quadrants_and_referral_ledger',
    up(db) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS clinical_reviews(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          reviewer_id TEXT NOT NULL REFERENCES users(id),
          stage TEXT NOT NULL,
          quadrant TEXT,
          provisional_diagnosis TEXT,
          clinical_notes TEXT NOT NULL,
          facility TEXT,
          due_date TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_reviews_patient ON clinical_reviews(patient_id);
      `);

      const refColumns = db.prepare('PRAGMA table_info(referrals)').all().map((c) => c.name);
      if (!refColumns.includes('quadrant')) {
        db.exec('ALTER TABLE referrals ADD COLUMN quadrant TEXT;');
      }
      db.exec('CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);');
    },
  },
  {
    version: 7,
    name: '007_roles_investigations_and_navigation',
    up(db) {
      db.exec(`
        PRAGMA foreign_keys = OFF;
        CREATE TABLE IF NOT EXISTS users_v7(
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          name TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('worker', 'asha', 'doctor', 'specialist', 'hospital', 'navigator', 'admin', 'patient')),
          password_hash TEXT NOT NULL,
          active INTEGER NOT NULL DEFAULT 1
        );
        INSERT OR IGNORE INTO users_v7 SELECT id, email, name, role, password_hash, active FROM users;
        DROP TABLE users;
        ALTER TABLE users_v7 RENAME TO users;
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS investigations(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          referral_id TEXT,
          test_type TEXT NOT NULL CHECK(test_type IN ('biopsy', 'histopathology', 'cytology', 'radiology_opg', 'routine_blood')),
          facility TEXT NOT NULL,
          ordered_by TEXT NOT NULL REFERENCES users(id),
          status TEXT NOT NULL DEFAULT 'ordered' CHECK(status IN ('ordered', 'sample_collected', 'processing', 'reported', 'completed', 'cancelled')),
          clinical_findings TEXT,
          report_url TEXT,
          ordered_at TEXT NOT NULL,
          reported_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_investigations_patient ON investigations(patient_id);

        CREATE TABLE IF NOT EXISTS patient_navigation(
          id TEXT PRIMARY KEY,
          patient_id TEXT NOT NULL REFERENCES patients(id),
          referral_id TEXT,
          navigator_id TEXT NOT NULL REFERENCES users(id),
          contact_status TEXT NOT NULL DEFAULT 'pending' CHECK(contact_status IN ('pending', 'contacted', 'unreachable', 'visit_scheduled')),
          barrier_identified TEXT,
          attendance_confirmed INTEGER DEFAULT 0,
          notes TEXT,
          followup_due TEXT,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_navigation_patient ON patient_navigation(patient_id);
      `);
    },
  },
];

/**
 * Runs all pending migrations in order inside a transaction.
 *
 * @param {import('node:sqlite').DatabaseSync} db - Active database handle.
 * @returns {number} Count of applied migrations.
 */
export function applyMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations(
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = db.prepare('SELECT version FROM schema_migrations').all();
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  let appliedCount = 0;
  for (const m of migrations) {
    if (!appliedVersions.has(m.version)) {
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec('BEGIN IMMEDIATE');
      try {
        m.up(db);
        db.prepare('INSERT INTO schema_migrations(version, name, applied_at) VALUES(?, ?, ?)').run(
          m.version,
          m.name,
          new Date().toISOString()
        );
        db.exec('COMMIT');
        db.exec('PRAGMA foreign_keys = ON;');
        appliedCount++;
      } catch (error) {
        db.exec('ROLLBACK');
        db.exec('PRAGMA foreign_keys = ON;');
        throw new Error(`Migration ${m.version} (${m.name}) failed: ${error.message}`);
      }
    }
  }

  return appliedCount;
}
