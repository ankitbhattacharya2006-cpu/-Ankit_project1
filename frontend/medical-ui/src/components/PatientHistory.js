import React, { useState, useEffect } from 'react';
import '../styles/PatientHistory.css';

const PatientHistory = ({ patientId, token }) => {
  const [patient, setPatient] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [newRecord, setNewRecord] = useState({
    record_type: '',
    title: '',
    organ: '',
    modality: '',
    severity: 'NORMAL',
  });
  const [showForm, setShowForm] = useState(false);

  const headers = (token) => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const fetchPatient = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/patient/${patientId}`, {
        headers: headers(token),
      });
      if (!res.ok) throw new Error('Failed to fetch patient');
      setPatient(await res.json());
    } catch (err) {
      setError(err.message);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/patient/${patientId}/history?limit=10&offset=${page * 10}`,
        { headers: headers(token) }
      );
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addRecord = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`http://127.0.0.1:8000/patient/${patientId}/record`, {
        method: 'POST',
        headers: headers(token),
        body: JSON.stringify(newRecord),
      });
      if (!res.ok) throw new Error('Failed to add record');
      setShowForm(false);
      setNewRecord({ record_type: '', title: '', organ: '', modality: '', severity: 'NORMAL' });
      fetchHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    fetchPatient();
    fetchHistory();
  }, [page]);

  if (loading) return <div className="ph-loading">Loading patient data...</div>;
  if (error) return <div className="ph-error">Error: {error}</div>;

  return (
    <div className="patient-history">
      {patient && (
        <div className="ph-header">
          <h2>{patient.patient_name}</h2>
          <div className="ph-stats">
            <span>📋 {patient.statistics.total_medical_records} Records</span>
            <span>⚠️ {patient.statistics.critical_findings} Critical</span>
            <span>🔬 {patient.statistics.total_analyses} Analyses</span>
          </div>
          <p><strong>ID:</strong> {patient.patient_id} | <strong>Bed:</strong> {patient.bed_number}</p>
        </div>
      )}

      <button className="ph-btn-add" onClick={() => setShowForm(!showForm)}>
        {showForm ? '✕ Cancel' : '+ Add Record'}
      </button>

      {showForm && (
        <form className="ph-form" onSubmit={addRecord}>
          <input
            type="text"
            placeholder="Record Type"
            value={newRecord.record_type}
            onChange={(e) => setNewRecord({ ...newRecord, record_type: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Title"
            value={newRecord.title}
            onChange={(e) => setNewRecord({ ...newRecord, title: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Organ"
            value={newRecord.organ}
            onChange={(e) => setNewRecord({ ...newRecord, organ: e.target.value })}
          />
          <input
            type="text"
            placeholder="Modality"
            value={newRecord.modality}
            onChange={(e) => setNewRecord({ ...newRecord, modality: e.target.value })}
          />
          <select
            value={newRecord.severity}
            onChange={(e) => setNewRecord({ ...newRecord, severity: e.target.value })}
          >
            <option>NORMAL</option>
            <option>MODERATE</option>
            <option>CRITICAL</option>
          </select>
          <button type="submit" className="ph-btn-submit">Add Record</button>
        </form>
      )}

      <div className="ph-records">
        {records.length ? (
          records.map((r) => (
            <div key={r.id} className={`ph-record ph-${r.severity.toLowerCase()}`}>
              <strong>{r.title}</strong> | {r.record_type} | {r.organ}
              <span>{r.severity}</span>
              <small>{r.record_date}</small>
            </div>
          ))
        ) : (
          <p>No records found</p>
        )}
      </div>

      {records.length > 0 && (
        <div className="ph-pagination">
          <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}>← Prev</button>
          <span>Page {page + 1}</span>
          <button onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
};

export default PatientHistory;
