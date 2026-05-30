"""
DATABASE INTEGRATION GUIDE FOR main.py
========================================

This file explains how to integrate the scalable database system
for storing patient history and login details at scale.

TODOs in main.py:
1. Add imports at the top of main.py
2. Initialize database on startup  
3. Update signup/login endpoints to use database
4. Add new API endpoints for patient history & login tracking
5. Update process-scan endpoint to store results in database
"""

# ============ STEP 1: Add to imports section of main.py ============

# Add these imports after line 32 (after other FastAPI imports):
from database import (
    init_db, get_db, SessionLocal,
    User, Patient, MedicalRecord, LoginAudit, AnalysisResult,
    BookingEvent, EmergencyEvent,
    create_or_update_patient, get_patient_medical_history,
    get_user_login_history, get_patient_statistics,
)
from api_endpoints import (
    add_medical_record_endpoint, get_patient_details_endpoint,
    get_patient_history_endpoint, get_login_history_endpoint,
    get_critical_patients_endpoint, get_analysis_results_endpoint,
    record_login_audit, MedicalRecordResponse, LoginHistoryResponse,
    AddMedicalRecordRequest, PatientDetailResponse,
)


# ============ STEP 2: Initialize Database on Startup ============

# Add this after line ~100 (after CORS middleware setup, before first endpoint):

@app.on_event("startup")
async def startup_event():
    """Initialize database and create tables"""
    init_db()
    logger.info("Database initialized successfully")


# ============ STEP 3: Update auth_signup endpoint ============

# Replace the auth_signup endpoint (around line 1008) with:

@app.post("/auth/signup")
async def auth_signup(payload: AuthSignupRequest):
    try:
        username = validate_username(payload.username)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))

    validate_password_strength(payload.password or "")
    
    db = SessionLocal()
    try:
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            raise HTTPException(status_code=409, detail="USERNAME_ALREADY_EXISTS")

        role = normalize_role(payload.role)
        invite_code = (payload.admin_invite_code or "").strip()
        if role == "hospital_admin" and (not HOSPITAL_ADMIN_INVITE_CODE or invite_code != HOSPITAL_ADMIN_INVITE_CODE):
            raise HTTPException(status_code=403, detail="HOSPITAL_ADMIN_INVITE_REQUIRED")
        if role == "system_admin" and (not SYSTEM_ADMIN_INVITE_CODE or invite_code != SYSTEM_ADMIN_INVITE_CODE):
            raise HTTPException(status_code=403, detail="SYSTEM_ADMIN_INVITE_REQUIRED")

        # Create user in database
        new_user = User(
            username=username,
            hashed_password=pwd_context.hash(payload.password),
            role=role,
            is_active=True,
            created_at=datetime.datetime.now(datetime.timezone.utc),
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        security_logger.logger.info(f"[AUTH_SIGNUP] username={username} role={role} user_id={new_user.id}")
        token_data = issue_access_token(username, role)
        
        return {
            "status": "SIGNED_UP",
            "token": token_data["token"],
            "csrf_token": token_data["csrf_token"],
            "expires_at": token_data["expires_at"],
            "username": username,
            "role": role,
            "user_id": new_user.id,
        }
    finally:
        db.close()


# ============ STEP 4: Update auth_login endpoint ============

# Replace the auth_login endpoint (around line 1043) with:

@app.post("/auth/login")
async def auth_login(
    payload: AuthLoginRequest,
    x_forwarded_for: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None),
):
    try:
        username = validate_username(payload.username)
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error))

    ip_address = x_forwarded_for.split(",")[0].strip() if x_forwarded_for else "unknown"
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            security_logger.log_suspicious_activity(f"LOGIN_FAILED_UNKNOWN_USER username={username}")
            check_and_update_lockout(username, login_success=False)
            # Record failed login
            try:
                record_login_audit(
                    user_id=None,
                    ip_address=ip_address,
                    user_agent=user_agent or "",
                    status="failed",
                    failure_reason="user_not_found",
                    db=db,
                )
            except:
                pass
            raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

        lock_entry = FAILED_LOGIN_ATTEMPTS.get(username)
        if lock_entry and lock_entry.get("locked_until") and datetime.datetime.utcnow() < lock_entry["locked_until"]:
            check_and_update_lockout(username, login_success=False)
            raise HTTPException(status_code=423, detail="ACCOUNT_LOCKED")

        if not pwd_context.verify(payload.password, user.hashed_password):
            security_logger.log_suspicious_activity(f"LOGIN_FAILED_BAD_PASSWORD username={username}")
            check_and_update_lockout(username, login_success=False)
            
            # Record failed login attempt
            try:
                record_login_audit(
                    user_id=user.id,
                    ip_address=ip_address,
                    user_agent=user_agent or "",
                    status="failed",
                    failure_reason="incorrect_password",
                    db=db,
                )
            except:
                pass
            
            raise HTTPException(status_code=401, detail="INVALID_CREDENTIALS")

        check_and_update_lockout(username, login_success=True)
        role = user.role or "patient"
        
        # Update last login
        user.last_login = datetime.datetime.utcnow()
        user.last_ip = ip_address
        db.commit()
        
        # Record successful login
        try:
            record_login_audit(
                user_id=user.id,
                ip_address=ip_address,
                user_agent=user_agent or "",
                status="success",
                db=db,
            )
        except:
            pass
        
        security_logger.logger.info(f"[AUTH_LOGIN] username={username} role={role} ip={ip_address}")
        token_data = issue_access_token(username, role)
        
        return {
            "status": "LOGGED_IN",
            "token": token_data["token"],
            "csrf_token": token_data["csrf_token"],
            "expires_at": token_data["expires_at"],
            "username": username,
            "role": role,
            "user_id": user.id,
        }
    finally:
        db.close()


# ============ STEP 5: Add new patient/history endpoints ============

# Add these new endpoints after the auth endpoints:

@app.get("/patient/{patient_id}")
async def get_patient_details(
    patient_id: str,
    authorization: Optional[str] = Header(None),
):
    """Get detailed patient information"""
    user = get_authenticated_user(authorization)
    db = SessionLocal()
    try:
        return get_patient_details_endpoint(patient_id, db)
    finally:
        db.close()


@app.get("/patient/{patient_id}/history")
async def get_patient_medical_history_endpoint(
    patient_id: str,
    limit: int = 50,
    offset: int = 0,
    authorization: Optional[str] = Header(None),
):
    """Get patient's medical record history"""
    user = get_authenticated_user(authorization)
    db = SessionLocal()
    try:
        return get_patient_history_endpoint(patient_id, db, limit, offset)
    finally:
        db.close()


@app.get("/patient/{patient_id}/analysis")
async def get_patient_analysis_endpoint(
    patient_id: str,
    limit: int = 50,
    authorization: Optional[str] = Header(None),
):
    """Get AI analysis results for patient"""
    user = get_authenticated_user(authorization)
    db = SessionLocal()
    try:
        return get_analysis_results_endpoint(patient_id, db, limit)
    finally:
        db.close()


@app.post("/patient/{patient_id}/record")
async def add_medical_record_endpoint_wrapper(
    patient_id: str,
    record_data: AddMedicalRecordRequest,
    authorization: Optional[str] = Header(None),
    x_csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token"),
):
    """Add new medical record for patient"""
    user = get_authenticated_user(authorization)
    verify_csrf_token(user, x_csrf_token)
    require_role(user, {"hospital_admin", "system_admin"})
    
    db = SessionLocal()
    try:
        return add_medical_record_endpoint(patient_id, user["username"], record_data, db)
    finally:
        db.close()


@app.get("/user/{username}/login-history")
async def get_user_login_history_endpoint(
    username: str,
    limit: int = 100,
    authorization: Optional[str] = Header(None),
    x_csrf_token: Optional[str] = Header(None, alias="X-CSRF-Token"),
):
    """Get user's login history (admin only)"""
    user = get_authenticated_user(authorization)
    verify_csrf_token(user, x_csrf_token)
    require_role(user, {"system_admin"})
    
    db = SessionLocal()
    try:
        return get_login_history_endpoint(username, db, limit)
    finally:
        db.close()


@app.get("/patients/critical")
async def get_critical_patients_endpoint_wrapper(
    limit: int = 100,
    authorization: Optional[str] = Header(None),
):
    """Get list of patients with critical findings"""
    user = get_authenticated_user(authorization)
    require_role(user, {"hospital_admin", "system_admin"})
    
    db = SessionLocal()
    try:
        return get_critical_patients_endpoint(db, limit)
    finally:
        db.close()


# ============ STEP 6: Update process-scan endpoint ============

# In the process-scan endpoint (around line 1100), after creating ClinicalFinding,
# add code to store it in database:

async def process_scan(...):
    # ... existing code ...
    
    # After creating the clinical finding response, store in database:
    db = SessionLocal()
    try:
        # Create or update patient
        patient_data = {
            "patient_id": subject_id,
            "patient_name": patient_name,
            "bed_number": bed_number,
            "residence": residence,
        }
        patient_result = create_or_update_patient(patient_data, db=db)
        patient_db_id = patient_result.get("id")
        
        # Store analysis result
        analysis = AnalysisResult(
            patient_id=patient_db_id,
            analysis_id=subject_id,
            dataset_context=dataset_context,
            prediction=prediction,
            confidence=confidence,
            volume=str(volume),
            diameter=str(diameter),
            severity=severity,
            dice_score=dice_score,
            detailed_report=json.dumps(detailed_report),
            voxels_data=json.dumps(voxels),
            coords=json.dumps(coords),
            timestamp=datetime.datetime.utcnow(),
        )
        db.add(analysis)
        db.commit()
    except Exception as e:
        logger.error(f"Failed to store analysis result: {e}")
    finally:
        db.close()
    
    return finding


# ============ DATABASE FEATURES ============

# The database system provides:
# ✓ Scalable patient storage (millions of patients)
# ✓ Secure password hashing with bcrypt/pbkdf2
# ✓ Login audit trail for compliance
# ✓ Medical record versioning
# ✓ Analysis result persistence
# ✓ Booking/appointment tracking
# ✓ Emergency event logging
# ✓ Full-text search optimization with indexes
# ✓ Support for SQLite (default) or PostgreSQL

# To switch to PostgreSQL, set environment variable:
# DATABASE_URL=postgresql://user:password@localhost/medical_platform
