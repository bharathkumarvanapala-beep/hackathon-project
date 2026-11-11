# Aarogya Drishti / ఆరోగ్య దృష్టి
### Clinically Supervised Oral-Health Screening & Care Coordination Platform
**Target Deployment:** Integrated Tribal Development Agency (ITDA) Paderu, Alluri Sitharama Raju (ASR) District, Andhra Pradesh

[![Node.js Runtime](https://img.shields.io/badge/Node.js-v24.20.0+-339933?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/Database-SQLite_WAL-003B57?style=flat&logo=sqlite&logoColor=white)](https://sqlite.org/)
[![Zero NPM Dependencies](https://img.shields.io/badge/Dependencies-Zero_External_NPM-blue?style=flat)](package.json)
[![Tests Passing](https://img.shields.io/badge/Tests-28%20Passing%20(100%25)-brightgreen?style=flat)](tests/)
[![Accessibility](https://img.shields.io/badge/Accessibility-WCAG_2.1_AA-orange?style=flat)](public/glass.css)
[![Bilingual UI](https://img.shields.io/badge/Languages-English%20%7C%20%E0%B0%A4%E0%B1%86%E0%B0%B2%E0%B1%81%E0%B0%97%E0%B1%81-purple?style=flat)](public/i18n/)

---

## 1. Executive Summary

**Aarogya Drishti** is an enterprise-grade, offline-first oral-health screening, clinical decision support, and referral navigation system engineered for remote tribal habitations and agency healthcare facilities.

Unlike traditional demos or consumer wellness apps, Aarogya Drishti is built from the ground up for **clinical governance, zero-dependency data durability, and rigorous doctor-in-the-loop oversight**. It assists frontline health workers (ASHAs and ANMs) in capturing high-quality oral photography, verifying informed consent in native regional languages (Telugu and English), coordinating structured referrals across the ITDA Paderu hospital network, and enabling registered dental clinicians to review and manage patient care trajectories.

---

## 2. Core Architecture & Engineering Highlights

```
 ┌────────────────────────────────────────────────────────────┐
 │  Frontline Field Layer (Mobile Handsets / Tablets)         │
 │  - Saathi Bilingual Conversational Intake (Telugu/English) │
 │  - Client-Side & Server-Side Image Quality Assessment      │
 │  - Offline IndexedDB Cache & Offline Sync Drawer           │
 │  - WCAG 2.1 AA Compliance (44px touch targets, contrast)   │
 └─────────────────────────────┬──────────────────────────────┘
                               │ HTTPS / Cellular / Wi-Fi Sync
 ┌─────────────────────────────▼──────────────────────────────┐
 │  Core Application Server (Node.js v24.20.0+ Native)        │
 │  - Pure ES Modules · Zero external runtime dependencies    │
 │  - Dynamic Configuration Engine (src/config.mjs)           │
 │  - Cryptographic Session & Scrypt Authentication           │
 │  - Brute-Force Rate Limiting (10-attempt lockout)          │
 │  - Strict CSRF Protection & Origin Validation              │
 └─────────────────────────────┬──────────────────────────────┘
                               │
       ┌───────────────────────┴───────────────────────┐
       ▼                                               ▼
 ┌──────────────────────────────┐    ┌──────────────────────────────┐
 │  Data Durability Layer       │    │  Clinical AI & Governance    │
 │  - SQLite with WAL mode      │    │  - Replaceable Model Adapter │
 │  - 6 Schema Migrations       │    │    Framework (BaseAIAdapter) │
 │  - Decoupled Image Storage   │    │  - SigLIP-2 & Umlomo Engines │
 │    (Private Disk, 0o600)     │    │  - Multi-class Softmax Bars  │
 │  - Atomic Backup CLI Tool    │    │  - Strict Doctor Triage Gate │
 │    (PRAGMA wal_checkpoint)   │    │  - Referral State Machine    │
 └──────────────────────────────┘    └──────────────────────────────┘
```

### Architectural Distinctions:
* **Zero-NPM Runtime Independence:** Runs entirely on native Node.js v24 modules (`node:sqlite`, `node:crypto`, `node:fs`, `node:http`, `node:test`), eliminating supply-chain attack surfaces.
* **Decoupled Private Image Vault:** Oral photographs are decoupled from database rows and stored in a private directory (`.local/storage/images/`) with strict `0o600` file permissions and SHA-256 integrity hashing.
* **Optimistic Locking & Concurrency Defenses:** Every patient record maintains a version counter. Simultaneous clinical edits trigger HTTP 409 Conflict rather than silently overwriting another doctor's assessment.
* **Deterministic Referral State Machine:** Enforces directional patient transitions (`referred` $\to$ `scheduled` $\to$ `attended` $\to$ `completed`) across the 6 ITDA Paderu facilities.

---

## 3. Comprehensive Upgrade Inventory (Phases 1–10)

| Phase | Milestone | Core Deliverables & Technical Additions |
| :--- | :--- | :--- |
| **Phase 0** | Audit & Master Plan | Comprehensive gap analysis and 10-phase execution roadmap. |
| **Phase 1** | Foundation & Tooling | [`src/config.mjs`](src/config.mjs), [`.env.example`](.env.example), `npm run check`, health diagnostics endpoint (`GET /health`). |
| **Phase 2** | Database & Security | [`src/migrations.mjs`](src/migrations.mjs) (Migrations 001–003), dedicated `consents` and `referrals` tables, expanded role-based access control. |
| **Phase 3** | Consent & Decoupled Storage | [`src/patient-id.mjs`](src/patient-id.mjs), [`src/consent-terms.mjs`](src/consent-terms.mjs), [`src/image-storage.mjs`](src/image-storage.mjs) (magic byte detection, SHA-256 indexing, private disk storage). |
| **Phase 4** | Image Quality Pipeline | [`src/image-quality.mjs`](src/image-quality.mjs), OpenCV and pure-Node illumination/contrast/blur assessment pipeline, bilingual guidance. |
| **Phase 5** | Replaceable AI Framework | [`src/ai-adapter.mjs`](src/ai-adapter.mjs) (`BaseAIModelAdapter`, SigLIP-2, Umlomo, Registry), [`scripts/siglip2-inference.py`](scripts/siglip2-inference.py), Migration 005 (`ai_analyses` table). |
| **Phase 6** | Clinical Workflow & Referrals | [`src/facilities.mjs`](src/facilities.mjs) (ITDA Paderu catalog, 6 dental quadrants, priority queues), referral state machine validator, Migration 006 (`clinical_reviews` table). |
| **Phase 7** | Accessibility & Offline Sync | Bilingual UX ([`public/i18n/`](public/i18n/)), [`public/sync-drawer.js`](public/sync-drawer.js) (Offline Sync Drawer & 409 Conflict Resolution modal), WCAG 2.1 AA touch targets & focus visible. |
| **Phase 8** | Edge & Concurrency Tests | [`tests/concurrency_edge.test.mjs`](tests/concurrency_edge.test.mjs) (optimistic locking race tests), [`tests/security_edge.test.mjs`](tests/security_edge.test.mjs) (rate limiting, script injection rejection). |
| **Phase 9** | Deployment & Disaster Recovery | [`scripts/backup-restore.mjs`](scripts/backup-restore.mjs) (atomic WAL checkpoint CLI), [`docs/OPERATIONS.md`](docs/OPERATIONS.md) (systemd, Caddy, Nginx runbooks). |
| **Phase 10** | Clinical Governance & CDSCO | [`docs/CLINICAL_GOVERNANCE_AND_CDSCO_ROADMAP.md`](docs/CLINICAL_GOVERNANCE_AND_CDSCO_ROADMAP.md) (Class B SaMD evaluation plan, PMS plan, DPDP Act 2023 compliance). |

---

## 4. Role-Based Access Control (RBAC) Matrix

Aarogya Drishti enforces strict server-side role gating based on clinical responsibilities:

| User Role | Screening Intake | Photo Upload | Run Research AI | Switch AI Model | Clinical Review | Update Referral | System Audit |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Health Worker** (`worker`) | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Medical Officer** (`doctor`) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Dental Specialist** (`specialist`)| ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| **Care Navigator** (`navigator`) | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| **Administrator** (`admin`) | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |

*Demo accounts are pre-configured with 1-click quick-fill buttons on the sign-in page:*
* **Health Worker:** `worker@drishti.local` / `Worker@1234`
* **Medical Officer:** `doctor@drishti.local` / `Doctor@1234`
* **District Administrator:** `admin@drishti.local` / `Admin@1234`

---

## 5. Quickstart & Verification

### Prerequisites
* **Node.js:** v24.20.0 or newer (`node --version`).
* **Operating System:** Windows 10/11, macOS, or Linux (Ubuntu 22.04+ LTS).

### 1. Launch Development Server
```bash
npm start
```
The application will bind to `http://127.0.0.1:4173`.

### 2. Run Comprehensive Automated Test Suite
Run the unified syntax check and the complete test suite:
```bash
npm run check
```
*Executes all 28 automated tests across 15 test files with 100% pass rate.*

### 3. Automated Backup & Disaster Recovery CLI
```bash
# Create an atomic, verified backup in backups/
npm run backup

# Verify backup integrity (SHA-256 + SQLite PRAGMA integrity_check)
node scripts/backup-restore.mjs verify backups/backup-YYYYMMDD-HHmmss-fff

# Restore database and images from backup
npm run restore -- backups/backup-YYYYMMDD-HHmmss-fff
```

### 4. Seed Synthetic Testing Cohort
```bash
# Seed 5 synthetic ITDA Paderu patient records with Telugu consent
npm run seed
```

---

## 6. Documentation Index

Detailed operational, architectural, and clinical guides are available in the repository:

* [Operations Runbook & Production Deployment](docs/OPERATIONS.md) — Systemd unit files, Caddy/Nginx reverse proxy configs, automated cron schedules, and disaster recovery.
* [Clinical Governance & CDSCO Regulatory Roadmap](docs/CLINICAL_GOVERNANCE_AND_CDSCO_ROADMAP.md) — Class B SaMD risk classification, prospective clinical validation study protocol, and post-market surveillance.
* [Environment Configuration Template](.env.example) — Complete reference of all configurable parameters.

---

## 7. Clinical & Legal Disclaimers

> **IMPORTANT CLINICAL NOTICE:**  
> Aarogya Drishti is an experimental and clinical decision support system designed to assist qualified healthcare professionals. **It is NOT an autonomous diagnostic device and does NOT generate definitive medical diagnoses.** All automated pattern outputs, image quality ratings, and candidate findings are advisory and must be verified by a registered Dental Surgeon (BDS/MDS) or Medical Officer (MBBS).
>
> **DATA PRIVACY (DPDP ACT 2023):**  
> In compliance with India's Digital Personal Data Protection Act 2023, informed patient consent must be recorded in the patient's primary language prior to capturing photographs or initiating automated analysis. Patient consent may be withdrawn at any time, immediately halting automated processing.
