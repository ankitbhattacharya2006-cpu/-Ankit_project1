import React, { useState, useEffect } from 'react';
import PatientHistory from '../components/PatientHistory';
import PatientAnalysis from '../components/PatientAnalysis';
import AdminDashboard from '../components/AdminDashboard';
import '../styles/PatientDashboard.css';

const PatientDashboard = ({ token, userRole }) => {
  const [activeTab, setActiveTab] = useState('history');
  const [patientId, setPatientId] = useState('');
  const [inputPatientId, setInputPatientId] = useState('');

  return (
    <div className="patient-dashboard">
      <header className="pd-header">
        <h1>🏥 Patient Dashboard</h1>
        <p>View patient history, analysis results, and medical records</p>
      </header>

      <div className="pd-container">
        {userRole === 'system_admin' || userRole === 'hospital_admin' ? (
          <>
            <div className="pd-tabs">
              <button
                className={`pd-tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => setActiveTab('history')}
              >
                Patient History
              </button>
              <button
                className={`pd-tab ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveTab('admin')}
              >
                Admin Console
              </button>
            </div>

            {activeTab === 'history' && (
              <div className="pd-section">
                <div className="pd-search">
                  <input
                    type="text"
                    placeholder="Enter Patient ID (e.g., MONAI-12345)"
                    value={inputPatientId}
                    onChange={(e) => setInputPatientId(e.target.value)}
                    className="pd-input"
                  />
                  <button
                    onClick={() => setPatientId(inputPatientId)}
                    className="pd-btn"
                  >
                    Search
                  </button>
                </div>

                {patientId && (
                  <>
                    <PatientHistory patientId={patientId} token={token} />
                    <PatientAnalysis patientId={patientId} token={token} />
                  </>
                )}
              </div>
            )}

            {activeTab === 'admin' && (
              <AdminDashboard token={token} userRole={userRole} />
            )}
          </>
        ) : (
          <div className="pd-message">
            <p>Patient Dashboard is available for admins only.</p>
            <p>Your role: <strong>{userRole}</strong></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
