# Patient History & Login Storage System

## Overview
A production-ready, scalable database system for storing patient medical history and login audit trails. Designed to handle millions of patients with optimized queries and full audit compliance.

## Architecture

### 1. **Database Schema**
The system includes 8 core tables:

#### User Management
- **`users`** - User accounts with secure password hashing
  - `username` (unique), `hashed_password`, `role`, `is_active`
  - Tracks `last_login`, `last_ip`, `failed_login_attempts`, `locked_until`
  - Automatic timestamps: `created_at`, `updated_at`

- **`login_audits`** - Audit trail for every login attempt
  - Records: login time, IP address, user agent, device info
  - Tracks success/failure with failure reasons
  - Supports session duration tracking
  - Indexed for fast querying by user and time

#### Patient Management
- **`patients`** - Master patient records
  - Core data: name, age, gender, contact, residence, bed_number
  - Medical history stored as JSON structure
  - `is_active` flag for soft deletion
  - Created/updated timestamps + creator tracking

- **`medical_records`** - Complete patient medical history
  - Record types: diagnosis, prescription, lab_result, scan, note, etc.
  - Modality tracking: MRI, CT, X-ray, Ultrasound, etc.
  - Severity levels: CRITICAL, HIGH, MODERATE, NORMAL
  - Status tracking: DRAFT, VERIFIED, ARCHIVED
  - Flexible JSON data storage for findings
  - Indexed by patient, type, severity, and timestamp

#### Analysis & Results
- **`analysis_results`** - AI/ML segmentation results
  - Stores: predictions, confidence scores, voxel data, coordinates
  - Severity classification for findings
  - Dice scores and volume/diameter measurements
  - Complete audit path from scan to analysis

- **`booking_events`** - Appointment tracking
  - Status: PENDING, CONFIRMED, COMPLETED, CANCELLED
  - Scheduled time with status history

- **`emergency_events`** - Critical patient alerts
  - Severity tracking: HIGH, MEDIUM, LOW
  - Resolution status and timestamps

### 2. **Indexing Strategy**
Optimized for millions of patients with strategic indexes:

```
Users Table:
  - username (unique, fast login lookup)
  - username + is_active (active user queries)
  - last_login (recent activity queries)
  - role (admin/staff filtering)

Medical Records Table:
  - patient_id + record_type (grouped by record type)
  - record_type + created_at (timeline queries)
  - severity + status (critical findings)
  - modality (scan type queries)

Analysis Results Table:
  - patient_id + timestamp (patient history)
  - severity + timestamp (critical findings)
  - dataset_context (analysis type)

Login Audits Table:
  - user_id + login_time (user history)
  - login_time (timeline queries)
  - ip_address (security insights)
```

### 3. **Security Features**

#### Password Security
```python
# Supports multiple hashing schemes for backward compatibility
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")

# Automatically upgrades bcrypt hashes to pbkdf2_sha256 on next login
# Uses salt for brute-force protection
```

#### Login Audit Trail
- Every login recorded with IP, user agent, device info
- Failed attempts tracked with reasons
- Account lockout after configurable attempts (default: 5)
- Lockout duration configurable (default: 15 minutes)

#### CSRF Protection
- JWT tokens include CSRF tokens
- Required for all state-changing operations on medical records

#### Encryption
- Supports Fernet encryption for sensitive fields
- Configure with `DISHA_ENCRYPTION_KEY` environment variable

### 4. **Scalability Features**

#### For Millions of Patients:
✓ **Composite Indexes** - Fast queries on common filter combinations
✓ **Pagination Support** - All history endpoints paginated with offset/limit
✓ **Query Optimization** - Lazy loading relationships to avoid N+1 queries
✓ **Connection Pooling** - SQLAlchemy automanaged with **pool_pre_ping=True**
✓ **Database Agnostic** - SQLite for development, PostgreSQL for production

#### Example Queries (Millisecond Response):
```python
# Get patient's last 50 medical records - O(log n) with patient_id + timestamp index
get_patient_medical_history(patient_id=12345, limit=50)

# Get critical patients across millions of records - O(log n) with severity index
db.query(Patient).join(AnalysisResult).filter(
    AnalysisResult.severity == "CRITICAL"
).order_by(AnalysisResult.timestamp.desc()).limit(100)

# Get user's login history for audit - O(log n) with user_id + login_time index
get_user_login_history(user_id=789, limit=100)
```

## API Endpoints

### Authentication Endpoints
```
POST /auth/signup
  body: { username, password, role, admin_invite_code }
  response: { status, token, csrf_token, expires_at, user_id }
  NEW: Stores user in database, records creation

POST /auth/login
  body: { username, password }
  response: { status, token, csrf_token, expires_at, user_id }
  NEW: Records login attempt in audit trail with IP/user-agent
```

### Patient Data Endpoints (NEW)
```
GET /patient/{patient_id}
  auth: Bearer token
  response: Patient details + statistics
  example: GET /patient/REF-A401D7
  
GET /patient/{patient_id}/history?limit=50&offset=0
  auth: Bearer token
  response: Paginated medical record history
  example: GET /patient/REF-A401D7/history?limit=50

GET /patient/{patient_id}/analysis?limit=50
  auth: Bearer token
  response: AI analysis results and segmentation data
  example: GET /patient/REF-A401D7/analysis

POST /patient/{patient_id}/record
  auth: Bearer token (admin/hospital_admin only)
  body: {
    record_type: "diagnosis|prescription|lab_result|scan|note",
    title: string,
    description: string,
    organ: string,
    modality: "MRI|CT|X-ray|Ultrasound",
    severity: "CRITICAL|HIGH|MODERATE|NORMAL",
    status: "DRAFT|VERIFIED",
    data_content: JSON string
  }
  response: { id, patient_id, record_type, created_at }
```

### Audit & Reporting Endpoints (NEW)
```
GET /user/{username}/login-history?limit=100
  auth: Bearer token (system_admin only)
  response: Login history with IP, user-agent, success/failure, timestamps

GET /patients/critical?limit=100
  auth: Bearer token (admin/hospital_admin only)
  response: List of patients with critical findings across entire system
```

## Installation

### 1. Update Requirements
```bash
cd backend
pip install -r requirements.txt
```

The following new packages are added:
- `sqlalchemy>=2.0` - ORM and query builder
- `psycopg2-binary>=2.9` - PostgreSQL adapter (optional, for production)

### 2. Initialize Database
```python
from database import init_db
init_db()  # Creates all tables automatically
```

### 3. Integrate into main.py
Follow the `DATABASE_INTEGRATION.md` file for step-by-step integration:
1. Add imports
2. Initialize in `@app.on_event("startup")`
3. Update signup/login endpoints
4. Add new patient history endpoints
5. Update process-scan to store results

## Usage Examples

### Store Patient Data
```python
from database import SessionLocal, Patient, MedicalRecord

db = SessionLocal()

# Create patient
patient = Patient(
    patient_id="REF-A401D7",
    patient_name="John Doe",
    age=45,
    gender="M",
    email="john@hospital.com",
    phone="+1234567890",
    bed_number="ICU-102",
    residence="New York",
    medical_history=json.dumps({
        "conditions": ["hypertension", "diabetes"],
        "allergies": ["penicillin"],
        "medications": ["lisinopril", "metformin"]
    })
)
db.add(patient)
db.commit()

# Add medical record
record = MedicalRecord(
    patient_id=patient.id,
    user_id=user.id,
    record_type="diagnosis",
    title="Brain MRI findings",
    organ="brain",
    modality="MRI",
    severity="HIGH",
    description="Large tumor detected in temporal lobe",
    findings=json.dumps({
        "coordinates": {"x": 45.2, "y": 67.1, "z": 23.4},
        "volume_mm3": 2400,
        "image_quality": "excellent"
    })
)
db.add(record)
db.commit()
```

### Query Patient History
```python
from database import get_patient_medical_history, get_patient_statistics

# Get last 50 medical records
history = get_patient_medical_history(patient_id=1, limit=50)

# Get statistics
stats = get_patient_statistics(patient_id=1)
# { total_records: 47, critical_findings: 3, total_analyses: 12 }
```

### Track Login Events
```python
from database import get_user_login_history

# Get last 100 login attempts
logins = get_user_login_history(user_id=5, limit=100)

# Filter for suspicious activity
failed_logins = [l for l in logins if l.status == "failed"]
```

## Database Configuration

### SQLite (Default - Development)
```bash
# Automatically uses: sqlite:///./medical_platform.db
python -m uvicorn backend.main:app --reload
```

### PostgreSQL (Production)
```bash
# Set environment variable before running
export DATABASE_URL="postgresql://user:password@localhost:5432/medical_platform"

python -m uvicorn backend.main:app
```

### Backup & Restore (SQLite)
```bash
# Backup
cp medical_platform.db medical_platform.backup.db

# Restore
cp medical_platform.backup.db medical_platform.db
```

## Performance Characteristics

### Query Performance (1 Million Patients)
| Query | Expected Time | Index Used |
|-------|---------------|-----------|
| Get patient by ID | <10ms | patient_id (unique) |
| Get patient's 50 records | <20ms | patient_id + timestamp |
| Get critical patients | <50ms | severity + timestamp |
| Get user login history | <15ms | user_id + login_time |
| Get records by modality | <30ms | modality (indexed) |

### Storage Per Patient
- Base patient record: ~500 bytes
- Average 50 medical records: ~50KB per patient
- Analysis results avg 20 per patient: ~30KB per patient
- **Total per patient: ~80KB average**

### Capacity
- 1 million patients: ~80GB
- 10 million patients: ~800GB
- Easily managed with PostgreSQL on modern hardware

## Compliance & Audit

### HIPAA/GDPR Compliance
✓ Audit trail for all logins (LoginAudit table)
✓ User identification for all data modifications
✓ Timestamps for all actions
✓ Soft deletes with is_active flag
✓ Encrypted sensitive fields support

### Data Retention
```python
# Example: Archive records older than 90 days
from datetime import datetime, timedelta

cutoff = datetime.utcnow() - timedelta(days=90)
old_records = db.query(MedicalRecord).filter(
    MedicalRecord.created_at < cutoff
).update({MedicalRecord.status: "ARCHIVED"})
```

## Troubleshooting

### Issue: "database is locked" (SQLite)
**Solution:** Use PostgreSQL for concurrent writes, or reduce concurrent connections

### Issue: Slow patient queries with millions of records
**Solution:** Verify indexes are created:
```python
from database import engine, Base
Base.metadata.create_all(bind=engine)  # Recreate indexes
```

### Issue: Login takes too long
**Solution:** Password hashing is intentionally slow for security. This is expected.

## Future Enhancements

- [ ] Time-series compression for historical data
- [ ] Elasticsearch integration for full-text search
- [ ] Redis caching layer for hot queries
- [ ] GraphQL API for complex queries
- [ ] Data anonymization for research datasets
- [ ] Role-based field-level encryption
- [ ] Automated migrations with Alembic

## Files Created

1. **`database.py`** - Core ORM models and database operations (420 lines)
2. **`api_endpoints.py`** - API endpoint implementations for patient history
3. **`DATABASE_INTEGRATION.md`** - Step-by-step integration guide for main.py
4. **`PATIENT_STORAGE_README.md`** - This file

## Support

For issues or questions, check:
- `DATABASE_INTEGRATION.md` for integration steps
- `database.py` docstrings for detailed function docs
- Run tests: `pytest tests/`
