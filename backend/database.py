"""
Database Models & Persistence Layer for InnerEye Medical Platform
Scalable to millions of patients with proper indexing & query optimization
"""

import os
import datetime
import json
from typing import List, Dict, Any, Optional
from sqlalchemy import (
    create_engine, Column, String, Integer, Float, DateTime, 
    Boolean, Text, ForeignKey, Index, JSON, func
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from contextlib import contextmanager

# Database Configuration - supports SQLite (default) or PostgreSQL
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./medical_platform.db")

# Create engine with optimizations
engine = create_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,  # Verify connections before use
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    """User account model with secure password storage & audit trail"""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(32), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(32), default="patient", index=True)  # patient, hospital_admin, system_admin
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_login = Column(DateTime, nullable=True, index=True)
    last_ip = Column(String(45), nullable=True)  # IPv4 (15) or IPv6 (39)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    
    # Relationships
    logins = relationship("LoginAudit", back_populates="user", cascade="all, delete-orphan")
    patients = relationship("Patient", back_populates="created_by_user", foreign_keys="Patient.created_by")
    medical_records = relationship("MedicalRecord", back_populates="user", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_username_active', 'username', 'is_active'),
        Index('idx_last_login', 'last_login'),
        Index('idx_role', 'role'),
    )


class LoginAudit(Base):
    """Login history for security audit & compliance"""
    __tablename__ = "login_audits"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    login_time = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    login_time_utc = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(512), nullable=True)
    status = Column(String(32), default="success")  # success, failed, locked
    failure_reason = Column(String(255), nullable=True)
    device_info = Column(Text, nullable=True)
    session_duration_seconds = Column(Integer, nullable=True)

    # Relationship
    user = relationship("User", back_populates="logins")

    __table_args__ = (
        Index('idx_user_login_time', 'user_id', 'login_time'),
        Index('idx_login_time', 'login_time'),
        Index('idx_ip_address', 'ip_address'),
    )


class Patient(Base):
    """Patient master record"""
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(String(32), unique=True, index=True, nullable=False)  # e.g., REF-A401D7
    patient_name = Column(String(255), nullable=False, index=True)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(20), nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String(16), nullable=True)  # M, F, Other
    bed_number = Column(String(32), nullable=True)
    residence = Column(String(255), nullable=True)
    medical_history = Column(Text, nullable=True)  # JSON: {"conditions": [...], "allergies": [...]}
    contact_person = Column(String(255), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relationships
    medical_records = relationship("MedicalRecord", back_populates="patient", cascade="all, delete-orphan")
    created_by_user = relationship("User", back_populates="patients", foreign_keys=[created_by])
    analysis_results = relationship("AnalysisResult", back_populates="patient", cascade="all, delete-orphan")

    __table_args__ = (
        Index('idx_patient_id_active', 'patient_id', 'is_active'),
        Index('idx_patient_name', 'patient_name'),
        Index('idx_created_at', 'created_at'),
    )


class MedicalRecord(Base):
    """Patient medical records & history"""
    __tablename__ = "medical_records"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Doctor/Admin who entered
    record_type = Column(String(64), nullable=False, index=True)  # diagnosis, prescription, lab_result, etc.
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    findings = Column(Text, nullable=True)  # JSON structure with detailed findings
    organ = Column(String(64), nullable=True)
    modality = Column(String(64), nullable=True)  # MRI, CT, X-ray, Ultrasound, etc.
    severity = Column(String(32), default="NORMAL")  # CRITICAL, HIGH, MODERATE, NORMAL
    status = Column(String(32), default="DRAFT")  # DRAFT, VERIFIED, ARCHIVED
    data_content = Column(Text, nullable=True)  # JSON: voxels, coordinates, analysis_note
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    # Relationships
    patient = relationship("Patient", back_populates="medical_records")
    user = relationship("User", back_populates="medical_records")

    __table_args__ = (
        Index('idx_patient_record_type', 'patient_id', 'record_type'),
        Index('idx_record_type_created', 'record_type', 'created_at'),
        Index('idx_severity_status', 'severity', 'status'),
        Index('idx_modality', 'modality'),
    )


class AnalysisResult(Base):
    """AI analysis results for medical images"""
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    analysis_id = Column(String(64), unique=True, index=True, nullable=False)  # e.g., REF-A401D7
    dataset_context = Column(String(64), nullable=False)  # neuro_axial, pulmonary, cardio_thoracic
    prediction = Column(String(255), nullable=False)
    confidence = Column(Float, nullable=False)
    volume = Column(String(64), nullable=True)
    diameter = Column(String(64), nullable=True)
    severity = Column(String(32), default="NORMAL")  # CRITICAL, HIGH, MODERATE, NORMAL
    dice_score = Column(Float, nullable=True)
    detailed_report = Column(Text, nullable=True)  # JSON array of report lines
    voxels_data = Column(Text, nullable=True)  # JSON: [[x, y, z, label], ...]
    coords = Column(Text, nullable=True)  # JSON: {x, y, z}
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationship
    patient = relationship("Patient", back_populates="analysis_results")

    __table_args__ = (
        Index('idx_patient_analysis', 'patient_id', 'timestamp'),
        Index('idx_severity_timestamp', 'severity', 'timestamp'),
        Index('idx_dataset_context', 'dataset_context'),
    )


class BookingEvent(Base):
    """Appointment / booking history"""
    __tablename__ = "booking_events"

    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(String(64), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    booking_type = Column(String(64), nullable=False)
    status = Column(String(32), default="PENDING", index=True)  # PENDING, CONFIRMED, COMPLETED, CANCELLED
    scheduled_time = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    notes = Column(Text, nullable=True)

    __table_args__ = (
        Index('idx_patient_booking', 'patient_id', 'scheduled_time'),
        Index('idx_status_time', 'status', 'scheduled_time'),
    )


class EmergencyEvent(Base):
    """Emergency alerts & critical patient events"""
    __tablename__ = "emergency_events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(64), unique=True, index=True, nullable=False)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False, index=True)
    event_type = Column(String(64), nullable=False, index=True)
    severity = Column(String(32), default="HIGH", index=True)
    description = Column(Text, nullable=True)
    status = Column(String(32), default="ACTIVE", index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    resolved_at = Column(DateTime, nullable=True)

    __table_args__ = (
        Index('idx_patient_emergency', 'patient_id', 'created_at'),
        Index('idx_status_severity', 'status', 'severity'),
    )


# Database initialization
def init_db():
    """Create all tables"""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def get_db_context():
    """Context manager for database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Query optimization helpers
def get_patient_by_id(patient_id: str):
    """Get patient record by ID"""
    with get_db_context() as db:
        return db.query(Patient).filter(Patient.patient_id == patient_id).first()


def get_user_by_username(username: str):
    """Get user by username"""
    with get_db_context() as db:
        return db.query(User).filter(User.username == username.lower()).first()


def get_patient_medical_history(patient_id: int, limit: int = 50):
    """Get patient's medical record history"""
    with get_db_context() as db:
        return db.query(MedicalRecord).filter(
            MedicalRecord.patient_id == patient_id
        ).order_by(MedicalRecord.created_at.desc()).limit(limit).all()


def get_user_login_history(user_id: int, limit: int = 100):
    """Get user's login history for audit"""
    with get_db_context() as db:
        return db.query(LoginAudit).filter(
            LoginAudit.user_id == user_id
        ).order_by(LoginAudit.login_time.desc()).limit(limit).all()


def get_critical_patients(limit: int = 100):
    """Get patients with critical findings"""
    with get_db_context() as db:
        return db.query(Patient).join(AnalysisResult).filter(
            AnalysisResult.severity == "CRITICAL"
        ).order_by(AnalysisResult.timestamp.desc()).limit(limit).all()


def get_patient_statistics(patient_id: int) -> Dict[str, int]:
    """Get aggregated statistics for a patient"""
    with get_db_context() as db:
        total_records = db.query(func.count(MedicalRecord.id)).filter(
            MedicalRecord.patient_id == patient_id
        ).scalar()
        
        critical_count = db.query(func.count(AnalysisResult.id)).filter(
            AnalysisResult.patient_id == patient_id,
            AnalysisResult.severity == "CRITICAL"
        ).scalar()
        
        analysis_count = db.query(func.count(AnalysisResult.id)).filter(
            AnalysisResult.patient_id == patient_id
        ).scalar()
        
        return {
            "total_records": total_records or 0,
            "critical_findings": critical_count or 0,
            "total_analyses": analysis_count or 0,
        }
