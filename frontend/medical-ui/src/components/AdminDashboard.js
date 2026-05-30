import React, { useState, useEffect } from 'react';
import '../styles/AdminDashboard.css';

const AdminDashboard = ({ token, userRole }) => {
  const [view, setView] = useState('login-history');
  const [loginHistory, setLoginHistory] = useState([]);
  const [criticalPatients, setCriticalPatients] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const fetchLoginHistory = async (username) => {
    if (!username) return;
    setLoading(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/user/${username}/login-history?limit=50`, {
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch login history');
      const data = await res.json();
      setLoginHistory(data.login_history || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCriticalPatients = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/patients/critical?limit=50', {
        headers,
      });
      if (!res.ok) throw new Error('Failed to fetch critical patients');
      const data = await res.json();
      setCriticalPatients(data.critical_patients || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === 'login-history' && selectedUser) {
      fetchLoginHistory(selectedUser);
    } else if (view === 'critical') {
      fetchCriticalPatients();
    }
  }, [view]);

  if (userRole !== 'system_admin' && userRole !== 'hospital_admin') {
    return <div className="ad-error">Access Denied: Admin only</div>;
  }

  return (
    <div className="admin-dashboard">
      <h2>🔐 Admin Dashboard</h2>

      <div className="ad-tabs">
        <button
          className={`ad-tab ${view === 'login-history' ? 'active' : ''}`}
          onClick={() => setView('login-history')}
        >
          Login History
        </button>
        {userRole === 'system_admin' && (
          <button
            className={`ad-tab ${view === 'critical' ? 'active' : ''}`}
            onClick={() => setView('critical')}
          >
            Critical Patients
          </button>
        )}
      </div>

      {error && <div className="ad-error">Error: {error}</div>}

      {view === 'login-history' && (
        <div className="ad-section">
          <input
            type="text"
            placeholder="Enter username to view login history"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            className="ad-input"
          />
          <button onClick={() => fetchLoginHistory(selectedUser)} className="ad-btn">
            Search
          </button>

          {loading && <p>Loading...</p>}
          {loginHistory.length > 0 && (
            <div className="ad-table">
              <table>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>IP Address</th>
                    <th>Status</th>
                    <th>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {loginHistory.map((log) => (
                    <tr key={log.id} className={`ad-${log.status}`}>
                      <td>{new Date(log.login_time).toLocaleString()}</td>
                      <td>{log.ip_address}</td>
                      <td>
                        <span className={`ad-badge ad-${log.status}`}>
                          {log.status === 'success' ? '✓ Success' : '✗ Failed'}
                        </span>
                      </td>
                      <td className="ad-ua">{log.user_agent.substring(0, 50)}...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'critical' && (
        <div className="ad-section">
          <button onClick={fetchCriticalPatients} className="ad-btn">
            Refresh Critical Patients
          </button>

          {loading && <p>Loading...</p>}
          {criticalPatients.length > 0 && (
            <div className="ad-critical">
              {criticalPatients.map((p) => (
                <div key={p.patient_id} className="ad-critical-card">
                  <div className="adc-header">
                    <h4>{p.patient_name}</h4>
                    <span className="adc-critical">🚨 CRITICAL</span>
                  </div>
                  <p><strong>ID:</strong> {p.patient_id}</p>
                  <p><strong>Bed:</strong> {p.bed_number} | <strong>Location:</strong> {p.residence}</p>
                  <p><strong>Prediction:</strong> {p.prediction} | <strong>Confidence:</strong> {p.confidence}%</p>
                  <p><strong>Volume:</strong> {p.volume} | <strong>Diameter:</strong> {p.diameter}</p>
                  <small>{new Date(p.analysis_timestamp).toLocaleString()}</small>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
