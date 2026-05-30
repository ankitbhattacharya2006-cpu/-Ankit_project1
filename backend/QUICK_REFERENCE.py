#!/usr/bin/env python3
"""
QUICK REFERENCE: Patient & Login Storage System
================================================

Cheat sheet for using the new database system.
"""

# ============ INSTALLATION ============

# 1. Install dependencies
# $ cd backend
# $ pip install -r requirements.txt

# 2. Initialize database (automatic on startup)
from database import init_db
init_db()  # Creates all tables


# ============ CORE MODELS (Quick Reference) ============

# User Table
# - username (unique)
# - hashed_password (auto-hashed with pbkdf2_sha256)
# - role (patient, hospital_admin, system_admin)
# - last_login, last_ip
# - failed_login_attempts, locked_until

# Patient Table
# - patient_id (unique) e.g., "REF-A401D7"
# - patient_name, age, gender, email, phone
# - bed_number, residence
# - medical_history (JSON)

# MedicalRecord Table
# - record_type (diagnosis, prescription, lab_result, scan, consultation, note)
# - severity (CRITICAL, HIGH, MODERATE, NORMAL)
# - status (DRAFT, VERIFIED, ARCHIVED)
# - modality (MRI, CT, X-ray, Ultrasound)
# - findings (JSON data)

# LoginAudit Table
# - Records every login with IP, user-agent, status
# - Full compliance audit trail


# ============ COMMON OPERATIONS ============

from database import SessionLocal, User, Patient, MedicalRecord, LoginAudit
from passlib.context import CryptContext
import json

db = SessionLocal()

# ---- CREATE USER ----
pwd_context = CryptContext(schemes=["pbkdf2_sha256"])
user = User(
    username="dr_smith",
    hashed_password=pwd_context.hash("Password123!"),
    role="hospital_admin",
    email="dr@hospital.com"
)
db.add(user)
db.commit()

# ---- CREATE PATIENT ----
patient = Patient(
    patient_id="REF-001",
    patient_name="Jane Doe",
    age=45,
    gender="F",
    email="jane@email.com",
    medical_history=json.dumps({
        "conditions": ["hypertension"],
        "allergies": ["penicillin"]
    })
)
db.add(patient)
db.commit()

# ---- ADD MEDICAL RECORD ----
record = MedicalRecord(
    patient_id=patient.id,
    user_id=user.id,
    record_type="diagnosis",
    title="Brain MRI Findings",
    organ="brain",
    modality="MRI",
    severity="HIGH",
    status="VERIFIED",
    findings=json.dumps({
        "tumor": "Detected in temporal lobe",
        "size": "2.5cm"
    })
)
db.add(record)
db.commit()

# ---- QUERY PATIENT HISTORY ----
history = db.query(MedicalRecord).filter(
    MedicalRecord.patient_id == patient.id
).order_by(MedicalRecord.created_at.desc()).limit(50).all()

for record in history:
    print(f"{record.title} - {record.severity} - {record.created_at}")

# ---- QUERY LOGIN HISTORY ----
logins = db.query(LoginAudit).filter(
    LoginAudit.user_id == user.id
).order_by(LoginAudit.login_time.desc()).limit(100).all()

for login in logins:
    print(f"{login.login_time} - {login.ip_address} - {login.status}")

# ---- GET PATIENT STATISTICS ----
from database import get_patient_statistics
stats = get_patient_statistics(patient.id)
print(f"Total records: {stats['total_records']}")
print(f"Critical findings: {stats['critical_findings']}")
print(f"Analyses: {stats['total_analyses']}")

db.close()


# ============ NEW API ENDPOINTS ============

# Patient Endpoints
GET    /patient/{patient_id}                     # Patient details + stats
GET    /patient/{patient_id}/history             # Medical record history
GET    /patient/{patient_id}/analysis            # AI analysis results
POST   /patient/{patient_id}/record              # Add medical record

# Audit Endpoints
GET    /user/{username}/login-history           # Login audit trail
GET    /patients/critical                        # Patients with critical findings


# ============ ENVIRONMENT CONFIGURATION ============

# Development (SQLite - Default)
# No configuration needed, uses: ./medical_platform.db

# Production (PostgreSQL)
export DATABASE_URL="postgresql://user:password@localhost:5432/medical"
# python -m uvicorn backend.main:app


# ============ HELPER FUNCTIONS ============

from database import (
    get_patient_medical_history,
    get_user_login_history,
    get_critical_patients,
    get_patient_statistics,
)

# Get patient's last 50 medical records
history = get_patient_medical_history(patient_id=1, limit=50)

# Get user's login history
logins = get_user_login_history(user_id=1, limit=100)

# Get statistics for patient
stats = get_patient_statistics(patient_id=1)
# Returns: {total_records, critical_findings, total_analyses}


# ============ KEY FILES ============

# database.py                      ← Core ORM models & helper functions
# api_endpoints.py                 ← Ready-to-use endpoint implementations
# DATABASE_INTEGRATION.md          ← Step-by-step integration guide
# PATIENT_STORAGE_README.md        ← Full documentation
# quick_start_demo.py              ← Runnable examples
# IMPLEMENTATION_SUMMARY.md        ← Overview of everything


# ============ COMMON PATTERNS ============

# Pattern 1: Store analysis result
def store_analysis(patient_id_str, analysis_data, db):
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_id_str
    ).first()
    
    from database import AnalysisResult
    analysis = AnalysisResult(
        patient_id=patient.id,
        analysis_id=patient_id_str,
        dataset_context="neuro_axial",
        prediction=analysis_data['prediction'],
        confidence=analysis_data['confidence'],
        severity="CRITICAL" if analysis_data['confidence'] > 0.9 else "NORMAL",
        voxels_data=json.dumps(analysis_data['voxels']),
        coords=json.dumps(analysis_data['coords']),
    )
    db.add(analysis)
    db.commit()

# Pattern 2: Record login attempt
def record_login(user_id, ip_address, success, db):
    from database import LoginAudit
    audit = LoginAudit(
        user_id=user_id,
        ip_address=ip_address,
        status="success" if success else "failed",
        failure_reason="bad_password" if not success else None,
    )
    db.add(audit)
    db.commit()

# Pattern 3: Query critical patients
def get_critical():
    from database import AnalysisResult
    return db.query(Patient).join(AnalysisResult).filter(
        AnalysisResult.severity == "CRITICAL"
    ).order_by(AnalysisResult.timestamp.desc()).limit(100).all()


# ============ PERFORMANCE TIPS ============

# ✓ Always use limit/offset for large queries
history = db.query(MedicalRecord).filter(
    MedicalRecord.patient_id == patient_id
).order_by(MedicalRecord.created_at.desc()).limit(50).offset(0)

# ✓ Use filter before join for better performance
critical = db.query(Patient).join(AnalysisResult).filter(
    AnalysisResult.severity == "CRITICAL"
).limit(100)

# ✓ Close database sessions to avoid connection leaks
db = SessionLocal()
try:
    # ... operations ...
finally:
    db.close()

# ✓ Use unique indexes for lookups
user = db.query(User).filter(User.username == "dr_smith").first()  # Fast!
patient = db.query(Patient).filter(Patient.patient_id == "REF-001").first()  # Fast!


# ============ TROUBLESHOOTING ============

# Q: Database lock (SQLite)?
# A: Use PostgreSQL for concurrent writes

# Q: Slow queries?
# A: Check PATIENT_STORAGE_README.md for index info

# Q: How to migrate to PostgreSQL?
# A: Set DATABASE_URL env var, tables auto-migrate

# Q: How to backup/restore?
# A: SQLite: cp medical_platform.db backup.db
#    PostgreSQL: pg_dump / pg_restore


# ============ NEXT STEPS ============

# 1. Run: pip install -r requirements.txt
# 2. Read: DATABASE_INTEGRATION.md
# 3. Test: python quick_start_demo.py
# 4. Integrate: Follow 6 steps in DATABASE_INTEGRATION.md
# 5. Deploy: Set DATABASE_URL for PostgreSQL (optional)
