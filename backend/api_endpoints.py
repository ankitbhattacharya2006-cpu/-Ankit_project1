"""
API Endpoints for Patient History & Login Tracking
Integrated with database.py for scalable patient data management
"""

from fastapi import HTTPException, Header, Form, Depends
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel
import json

# These will be imported in main.py from database module
# from database import (
#     get_db, User, Patient, MedicalRecord, LoginAudit, 
#     AnalysisResult, get_patient_medical_history, get_user_login_history
# )


# ============ PYDANTIC MODELS FOR API RESPONSES ============

class MedicalRecordResponse(BaseModel):
    id: int
    record_type: str
    title: str
    severity: str
    status: str
    created_at: str
    modality: Optional[str] = None
    description: Optional[str] = None

    class Config:
        from_attributes = True


class LoginHistoryResponse(BaseModel):
    login_time: str
    ip_address: Optional[str]
    user_agent: Optional[str]
    status: str
    failure_reason: Optional[str] = None
    device_info: Optional[str] = None

    class Config:
        from_attributes = True


class PatientDetailResponse(BaseModel):
    id: int
    patient_id: str
    patient_name: str
    email: Optional[str]
    phone: Optional[str]
    age: Optional[int]
    gender: Optional[str]
    bed_number: Optional[str]
    residence: Optional[str]
    is_active: bool
    created_at: str
    medical_history: Optional[str] = None
    total_records: int = 0
    critical_findings: int = 0
    total_analyses: int = 0

    class Config:
        from_attributes = True


class PatientListResponse(BaseModel):
    patient_id: str
    patient_name: str
    severity: Optional[str]
    email: Optional[str]
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True


class AddMedicalRecordRequest(BaseModel):
    record_type: str  # diagnosis, prescription, lab_result, scan, etc.
    title: str
    description: Optional[str] = None
    findings: Optional[str] = None
    organ: Optional[str] = None
    modality: Optional[str] = None  # MRI, CT, X-ray, Ultrasound
    severity: Optional[str] = "NORMAL"  # CRITICAL, HIGH, MODERATE, NORMAL
    status: Optional[str] = "DRAFT"  # DRAFT, VERIFIED
    data_content: Optional[str] = None  # JSON data


# ============ GET PATIENT DETAILS ============
def get_patient_details_endpoint(
    patient_id: str,
    db: Session,
) -> Dict[str, Any]:
    """Get detailed patient information with history summary"""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="PATIENT_NOT_FOUND")
    
    from database import get_patient_statistics
    stats = get_patient_statistics(patient.id)
    
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
        "email": patient.email,
        "phone": patient.phone,
        "age": patient.age,
        "gender": patient.gender,
        "bed_number": patient.bed_number,
        "residence": patient.residence,
        "is_active": patient.is_active,
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
        "medical_history": patient.medical_history,
        **stats
    }


# ============ GET PATIENT MEDICAL HISTORY ============
def get_patient_history_endpoint(
    patient_id: str,
    db: Session,
    limit: int = 50,
    offset: int = 0,
) -> Dict[str, Any]:
    """Get patient's medical record history (paginated)"""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="PATIENT_NOT_FOUND")
    
    from database import get_patient_medical_history
    
    # Get paginated records
    records = db.query(MedicalRecord).filter(
        MedicalRecord.patient_id == patient.id
    ).order_by(MedicalRecord.created_at.desc()).offset(offset).limit(limit).all()
    
    total = db.query(MedicalRecord).filter(
        MedicalRecord.patient_id == patient.id
    ).count()
    
    return {
        "patient_id": patient_id,
        "patient_name": patient.patient_name,
        "total_records": total,
        "records": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "title": r.title,
                "severity": r.severity,
                "status": r.status,
                "modality": r.modality,
                "description": r.description,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            } for r in records
        ],
        "pagination": {
            "offset": offset,
            "limit": limit,
            "total": total,
        }
    }


# ============ GET ANALYSIS RESULTS ============
def get_analysis_results_endpoint(
    patient_id: str,
    db: Session,
    limit: int = 50,
) -> Dict[str, Any]:
    """Get AI analysis results for patient"""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    
    if not patient:
        raise HTTPException(status_code=404, detail="PATIENT_NOT_FOUND")
    
    results = db.query(AnalysisResult).filter(
        AnalysisResult.patient_id == patient.id
    ).order_by(AnalysisResult.timestamp.desc()).limit(limit).all()
    
    return {
        "patient_id": patient_id,
        "analysis_count": len(results),
        "analyses": [
            {
                "analysis_id": r.analysis_id,
                "dataset_context": r.dataset_context,
                "prediction": r.prediction,
                "confidence": r.confidence,
                "severity": r.severity,
                "dice_score": r.dice_score,
                "volume": r.volume,
                "diameter": r.diameter,
                "timestamp": r.timestamp.isoformat() if r.timestamp else None,
                "detailed_report": json.loads(r.detailed_report) if r.detailed_report else [],
            } for r in results
        ]
    }


# ============ ADD MEDICAL RECORD ============
def add_medical_record_endpoint(
    patient_id: str,
    username: str,
    record_data: AddMedicalRecordRequest,
    db: Session,
) -> Dict[str, Any]:
    """Add new medical record for patient"""
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="PATIENT_NOT_FOUND")
    
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="USER_NOT_FOUND")
    
    # Create new medical record
    new_record = MedicalRecord(
        patient_id=patient.id,
        user_id=user.id,
        record_type=record_data.record_type,
        title=record_data.title,
        description=record_data.description,
        findings=record_data.findings,
        organ=record_data.organ,
        modality=record_data.modality,
        severity=record_data.severity or "NORMAL",
        status=record_data.status or "DRAFT",
        data_content=record_data.data_content,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    
    db.add(new_record)
    db.commit()
    db.refresh(new_record)
    
    return {
        "id": new_record.id,
        "patient_id": patient_id,
        "record_type": new_record.record_type,
        "title": new_record.title,
        "severity": new_record.severity,
        "status": new_record.status,
        "created_at": new_record.created_at.isoformat(),
    }


# ============ GET USER LOGIN HISTORY ============
def get_login_history_endpoint(
    username: str,
    db: Session,
    limit: int = 100,
) -> Dict[str, Any]:
    """Get user's login history for audit purposes"""
    user = db.query(User).filter(User.username == username).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    
    from database import get_user_login_history
    
    logins = db.query(LoginAudit).filter(
        LoginAudit.user_id == user.id
    ).order_by(LoginAudit.login_time.desc()).limit(limit).all()
    
    return {
        "username": username,
        "total_logins": len(logins),
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "login_history": [
            {
                "login_time": l.login_time.isoformat() if l.login_time else None,
                "ip_address": l.ip_address,
                "user_agent": l.user_agent,
                "status": l.status,
                "failure_reason": l.failure_reason,
                "device_info": l.device_info,
            } for l in logins
        ]
    }


# ============ AGGREGATED PATIENT STATISTICS ============
def get_critical_patients_endpoint(
    db: Session,
    limit: int = 100,
) -> Dict[str, Any]:
    """Get list of patients with critical findings"""
    from database import get_critical_patients
    
    critical = db.query(Patient).join(AnalysisResult).filter(
        AnalysisResult.severity == "CRITICAL"
    ).order_by(AnalysisResult.timestamp.desc()).limit(limit).all()
    
    return {
        "critical_patient_count": len(critical),
        "patients": [
            {
                "patient_id": p.patient_id,
                "patient_name": p.patient_name,
                "email": p.email,
                "phone": p.phone,
                "age": p.age,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            } for p in critical
        ]
    }


# ============ RECORD LOGIN AUDIT ============
def record_login_audit(
    user_id: int,
    ip_address: str,
    user_agent: str,
    status: str,
    failure_reason: str = None,
    db: Session = None,
) -> None:
    """Record login attempt in audit log"""
    if db is None:
        from database import SessionLocal
        db = SessionLocal()
    
    audit = LoginAudit(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        status=status,
        failure_reason=failure_reason,
        login_time=datetime.utcnow(),
        login_time_utc=datetime.now(datetime.timezone.utc),
    )
    
    db.add(audit)
    db.commit()


# ============ CREATE OR UPDATE PATIENT ============
def create_or_update_patient(
    patient_data: Dict[str, Any],
    created_by_user_id: Optional[int] = None,
    db: Session = None,
) -> Dict[str, Any]:
    """Create or update patient record"""
    if db is None:
        from database import SessionLocal
        db = SessionLocal()
    
    patient = db.query(Patient).filter(
        Patient.patient_id == patient_data.get("patient_id")
    ).first()
    
    if patient:
        # Update existing patient
        for key, value in patient_data.items():
            if hasattr(patient, key):
                setattr(patient, key, value)
        patient.updated_at = datetime.utcnow()
    else:
        # Create new patient
        patient = Patient(
            patient_id=patient_data.get("patient_id"),
            patient_name=patient_data.get("patient_name"),
            email=patient_data.get("email"),
            phone=patient_data.get("phone"),
            age=patient_data.get("age"),
            gender=patient_data.get("gender"),
            bed_number=patient_data.get("bed_number"),
            residence=patient_data.get("residence"),
            medical_history=patient_data.get("medical_history"),
            created_by=created_by_user_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
    
    db.add(patient)
    db.commit()
    db.refresh(patient)
    
    return {
        "id": patient.id,
        "patient_id": patient.patient_id,
        "patient_name": patient.patient_name,
    }
