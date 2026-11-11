# Aarogya Drishti — Clinical Governance & CDSCO Regulatory Roadmap

> **Document Version:** 1.0  
> **Status:** Clinically Supervised Framework & Regulatory Evaluation Plan  
> **Target Jurisdiction:** Central Drugs Standard Control Organisation (CDSCO), Ministry of Health and Family Welfare, Government of India  
> **Target Pilot Region:** Integrated Tribal Development Agency (ITDA) Paderu, Alluri Sitharama Raju (ASR) District, Andhra Pradesh

---

## 1. Regulatory Context & SaMD Risk Classification

Under the **Medical Device Rules, 2017 (MDR-17)** and the **CDSCO Guidance on Software as a Medical Device (SaMD)**, healthcare software applications are classified based on the severity of the clinical condition and the degree to which clinical management relies upon the software's recommendations.

### A. Device Categorization
* **Generic Device Group:** Dental and Oral Diagnostic / Clinical Decision Support System (CDSS).
* **Device Classification:** **Class B (Low-Moderate Risk)** under Rule 4 of MDR-17.
* **SaMD Function Category:** **Informing & Triaging Clinical Management** (Does not drive or prescribe definitive treatment).

### B. Statement of Intended Purpose & Indications for Use (IFU)
Aarogya Drishti is an offline-capable, clinically supervised oral health screening and care coordination platform designed to:
1. Capture community-level oral demographic history and informed consent in native regional languages (Telugu and English).
2. Assess photography pixel quality (lighting, contrast, blur) on mobile handsets to assist frontline health workers (ASHAs and ANMs) in capturing evaluable oral imagery.
3. Serve as an extensible machine-learning evaluation framework to present unvalidated, preliminary pattern scores for oral conditions (e.g., suspected leukoplakia, oral submucous fibrosis, tooth agenesis) to qualified dental clinicians.
4. Coordinate structured referral pathways and attendance tracking across tribal primary and secondary healthcare centers.

### C. Contraindications & Explicit Boundaries
* **Not an Autonomous Diagnostic Device:** The software does **not** generate autonomous medical diagnoses. All outputs are labeled as preliminary machine patterns and require verification by a registered Dental Surgeon (BDS/MDS) or Medical Officer (MBBS).
* **Not for Acute Emergency Trauma:** The system is contraindicated for acute maxillofacial hemorrhages, compound mandibular fractures, or airway-compromising trauma.
* **Restricted Pediatric Research AI:** AI pattern analysis is contraindicated for patients under 18 years of age in research mode without parental/guardian legal consent and ethical board clearance.

---

## 2. Doctor-in-the-Loop Clinical Governance Framework

```
 ┌────────────────────────────────────────────────────────────┐
 │  Step 1: Community Intake (ASHA / ANM)                     │
 │  - Record bilingual informed consent (v1.0-ITDA)           │
 │  - Oral photo quality validation (illumination/blur)       │
 │  - Save offline in local encrypted/isolated cache          │
 └─────────────────────────────┬──────────────────────────────┘
                               │ Upload on Connectivity
 ┌─────────────────────────────▼──────────────────────────────┐
 │  Step 2: AI Pattern Scoring (Advisory Only)                │
 │  - Zero autonomous clinical decision-making                │
 │  - Softmax distribution over candidate oral findings        │
 │  - Mandatory clinical warning banners presented            │
 └─────────────────────────────┬──────────────────────────────┘
                               │ Doctor Access
 ┌─────────────────────────────▼──────────────────────────────┐
 │  Step 3: Clinician Review (Registered BDS/MDS/MBBS)        │
 │  - Mandatory doctor-in-the-loop review                     │
 │  - Selection of Oral Quadrant (Q1-Q4, Mucosa, General)     │
 │  - Independent Provisional Clinical Impression entered     │
 │  - Referral destination & follow-up timeline committed     │
 └─────────────────────────────┬──────────────────────────────┘
                               │ State Machine Transition
 ┌─────────────────────────────▼──────────────────────────────┐
 │  Step 4: Care Coordination (Facility Navigation)           │
 │  - Strict directional state machine:                       │
 │    referred ──► scheduled ──► attended ──► completed       │
 │  - Overdue triage & field worker follow-up alerts          │
 └────────────────────────────────────────────────────────────┘
```

### Core Clinical Governance Principles:
1. **Human Supremacy in Clinical Judgment:** AI pattern predictions are purely advisory. A reviewing clinician is empowered to override, disregard, or reclassify any automated score.
2. **Deterministic Attribution:** Every clinical decision, review note, referral status update, and quadrant assignment is cryptographically associated with the authenticated clinician's user ID, session token, and ISO timestamp in the immutable `clinical_reviews` and `audit` ledgers.
3. **Data Protection & Consent Gating (DPDP Act 2023):**
   - Active informed consent is required before capturing imagery or executing AI pattern analysis.
   - If a patient exercises their right to withdraw consent, the software instantly terminates AI inference access and logs the withdrawal reason in the audit ledger.

---

## 3. Clinical Evaluation Plan (CEP) & Pilot Protocol

Before Aarogya Drishti can transition from research evaluation to formal clinical deployment, a prospective, multi-center clinical validation study must be conducted in the ITDA Paderu region.

### A. Study Design & Participating Sites
* **Design:** Prospective, observational, multi-center diagnostic accuracy and referral navigation study.
* **Participating Centers:**
  1. **Area Hospital Paderu** (Secondary Care / Referral Hub).
  2. **Community Health Centre Araku** (Community Referral Hub).
  3. **Community Health Centre Chintapalle** (Remote Tribal Hub).
  4. **Primary Health Centre Hukumpeta** (Frontline Primary Centre).
  5. **ITDA Mobile Dental Screening Unit 01** (Habitation Outreach).

### B. Study Population & Sample Size
* **Target Cohort:** $N = 1,200$ adult subjects ($\ge 18$ years) presenting for community oral health screening across 20 tribal habitations.
* **Inclusion Criteria:**
  - Habitual tobacco / betel quid chewers, bidi smokers, or individuals reporting oral pain, burning sensation, ulcerative lesions, or white/red mucosal patches.
  - Ability to provide verified informed consent in Telugu or English.
* **Exclusion Criteria:**
  - Severe systemic illness requiring immediate intensive hospitalization.
  - Refusal or withdrawal of informed consent.

### C. Reference Standard (Ground Truth)
All screened subjects triaged with suspicious mucosal lesions will undergo standard clinical examination and biopsy confirmation:
* **Primary Reference Standard:** Histopathological tissue biopsy evaluated independently by two certified Oral Pathologists (MDS) blinded to the AI model's scores.
* **Discrepancy Resolution:** Third senior pathologist consensus evaluation in cases of inter-observer discordance.

### D. Primary & Secondary Endpoints

| Metric | Target Benchmark | Clinical Justification |
| :--- | :--- | :--- |
| **Sensitivity (Screening)** | $\ge 90.0\%$ | High sensitivity is vital in rural agency screening to minimize false negatives for oral malignant/pre-malignant lesions. |
| **Specificity** | $\ge 82.0\%$ | Adequate specificity minimizes unnecessary travel burdens on tribal patients traveling from remote habitations to secondary facilities. |
| **Negative Predictive Value (NPV)** | $\ge 95.0\%$ | High confidence that screen-negative individuals are truly free of high-grade dysplasia. |
| **Image Rejection Rate** | $\le 8.0\%$ | Quality check algorithms must guide field workers to capture evaluable imagery on first attempt. |
| **Referral Attendance Rate** | $\ge 70.0\%$ | Care navigation state machine must improve clinical follow-up over historical baseline ($< 35\%$). |

---

## 4. Post-Market Surveillance (PMS) & Algorithm Drift Plan

Machine learning models deployed in healthcare can suffer from **dataset shift** (changes in camera sensors, village lighting conditions, seasonal dust, or shifting habits). Aarogya Drishti integrates continuous post-market surveillance mechanisms:

1. **Monthly Algorithm Calibration Reviews:**
   - Monthly cross-tabulation of AI candidate finding distributions vs reviewing clinicians' provisional impressions.
   - Sudden shifts in positive prediction rates ($> 15\%$ deviation month-over-month) trigger an immediate audit.
2. **Adverse Event & Missed Case Reporting:**
   - A dedicated clinical issue reporting workflow allows hospital dental surgeons to log false-negative or misclassified cases directly into the audit ledger.
   - Adverse incident logs are reviewed quarterly with the District Medical & Health Officer (DMHO) and ITDA Project Officer.
3. **Model Versioning & Traceability:**
   - All AI analyses record the immutable `model_name` and `model_version` in the `ai_analyses` table. If an adapter is updated (e.g. from SigLIP-2 v1.0 to v1.1), historical records maintain full traceability to the exact weights utilized at inference time.

---

## 5. CDSCO Regulatory Submission Timeline & Checklist

To achieve formal Class B medical device manufacturing/import license (Form MD-5 / Form MD-9) under CDSCO:

```
[Phase A: Pre-Clinical] ──► [Phase B: Ethics Clearance] ──► [Phase C: Multi-Center Trial] ──► [Phase D: CDSCO Submission]
- Software Architecture       - Institutional Ethics         - 1,200 Patient Cohort             - Device Master File (DMF)
- Zero-NPM Audit              - Committee (IEC)              - Histopathology Ground            - ISO 13485 QMS Audit
- Verification Tests (100%)   - Tribal Welfare Clearance       Truth Validation                 - Form MD-14 Application
```

### Pre-Submission Checklist:
- [x] Complete architectural isolation and zero external runtime dependencies.
- [x] Optimistic locking and version collision defenses implemented and verified.
- [x] Cryptographic database audit trails and versioned informed consent architecture.
- [x] Standardized Dental Quadrant catalog and ITDA Paderu facility master catalog.
- [x] Automated test suite verifying 100% pass rate across 28 test suites.
- [ ] Institutional Ethics Committee (IEC) protocol submission at King George Hospital (KGH) / Andhra Medical College.
- [ ] Formal ISO 13485 Quality Management System (QMS) software documentation audit.
- [ ] Clinical Investigation Report (CIR) compilation following completion of the 1,200-patient pilot.
