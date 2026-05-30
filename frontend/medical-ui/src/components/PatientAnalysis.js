import React, { useState, useEffect } from 'react';
import '../styles/PatientAnalysis.css';

const PatientAnalysis = ({ patientId, token }) => {
  const [analyses, setAnalyses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/patient/${patientId}/analysis?limit=20`, {
          headers,
        });
        if (!res.ok) throw new Error('Failed to fetch analysis');
        const data = await res.json();
        setAnalyses(data.analysis_results || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [patientId, token]);

  if (loading) return <div className="pa-loading">Loading analyses...</div>;
  if (error) return <div className="pa-error">Error: {error}</div>;

  return (
    <div className="patient-analysis">
      <h3>Analysis Results ({analyses.length})</h3>
      {analyses.length ? (
        <div className="pa-grid">
          {analyses.map((a) => (
            <div key={a.id} className={`pa-card pa-${a.severity.toLowerCase()}`}>
              <div className="pa-header">
                <h4>{a.dataset_context}</h4>
                <span className="pa-badge">{a.severity}</span>
              </div>
              <div className="pa-content">
                <p><strong>Prediction:</strong> {a.prediction}</p>
                <p><strong>Confidence:</strong> {a.confidence}%</p>
                <p><strong>Volume:</strong> {a.volume}</p>
                <p><strong>Diameter:</strong> {a.diameter}</p>
                <p><strong>Dice Score:</strong> {a.dice_score}</p>
              </div>
              <div className="pa-report">
                {a.detailed_report?.map((line, i) => <p key={i}>{line}</p>)}
              </div>
              <small>{a.analysis_timestamp}</small>
            </div>
          ))}
        </div>
      ) : (
        <p>No analysis results found</p>
      )}
    </div>
  );
};

export default PatientAnalysis;
