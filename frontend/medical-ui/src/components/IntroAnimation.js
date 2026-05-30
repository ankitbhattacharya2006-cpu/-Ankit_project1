import React, { useState, useEffect, useMemo } from 'react';
import '../styles/IntroAnimation.css';

const IntroAnimation = ({ onComplete }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);
  const [showContent, setShowContent] = useState(false);

  // Hospital-themed background images (simulated with gradients and data URLs)
  const backgroundImages = useMemo(() => [
    {
      type: 'gradient',
      description: 'Hospital Beds',
      gradient: 'linear-gradient(135deg, #0d47a1 0%, #1565c0 25%, #ffffff 50%, #ef5350 75%, #c62828 100%)',
    },
    {
      type: 'gradient',
      description: 'Medical Equipment',
      gradient: 'linear-gradient(45deg, #1a237e 0%, #0d47a1 30%, #ffffff 50%, #ff7043 70%, #d84315 100%)',
    },
    {
      type: 'gradient',
      description: 'Hospital Care',
      gradient: 'radial-gradient(circle at 30% 50%, #0d47a1 0%, transparent 40%), radial-gradient(circle at 70% 60%, #ef5350 0%, transparent 35%), linear-gradient(to right, #1a1a2e, #ffffff, #d32f2f)',
    },
    {
      type: 'gradient',
      description: 'Patient Care Map',
      gradient: 'linear-gradient(to right, #e8eaf6 0%, #c5cae9 25%, #ffffff 50%, #ffebee 75%, #ef5350 100%)',
    },
  ], []);

  const hospitalsData = useMemo(() => [
    'Apollo Hospitals',
    'Fortis Healthcare',
    'Max Healthcare',
    'Manipal Hospitals',
    'AIIMS Delhi',
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 3500); // Change every 3.5 seconds

    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  useEffect(() => {
    // Show content after a brief delay
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Auto-complete after 12 seconds
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => {
        onComplete();
      }, 1200);
    }, 12000);

    return () => clearTimeout(exitTimer);
  }, [onComplete]);

  const currentBg = backgroundImages[currentImageIndex];

  return (
    <div className={`intro-animation-wrapper ${isExiting ? 'exit' : ''}`}>
      {/* Background carousel */}
      <div className="intro-background-container">
        <div
          className="intro-background-image"
          style={{
            background: currentBg.gradient,
            opacity: showContent ? 1 : 0,
          }}
        />
        <div className="intro-background-overlay" />
      </div>

      {/* Animated particles for medical theme */}
      <div className="intro-particles">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              '--index': i,
              '--delay': `${i * 0.15}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div className={`intro-content ${showContent ? 'visible' : ''}`}>
        {/* DISHA Logo and Branding */}
        <div className="intro-branding">
          <div className="intro-logo-container">
            <h1 className="intro-disha-logo">
              <span className="disha-d">D</span>
              <span className="disha-i">I</span>
              <span className="disha-s">S</span>
              <span className="disha-h">H</span>
              <span className="disha-a">A</span>
            </h1>
          </div>

          <div className="intro-tagline">
            <p className="intro-subtitle">Advanced Hospital Diagnostic Intelligence System</p>
            <p className="intro-description">Real-time patient care, precision diagnosis, unified healthcare network</p>
          </div>
        </div>

        {/* Hospitals Network Section */}
        <div className="intro-hospitals-section">
          <div className="hospitals-badge">Connected Hospitals Network</div>
          <div className="hospitals-grid">
            {hospitalsData.map((hospital, i) => (
              <div
                key={i}
                className="hospital-card"
                style={{ '--card-delay': `${i * 0.1}s` }}
              >
                <div className="hospital-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3-8h-2v2h2v-2zm0-4h-2v2h2V8zm-4 8h-2v2h2v-2zm0-4h-2v2h2V8z" />
                  </svg>
                </div>
                <span className="hospital-name">{hospital}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Key Features */}
        <div className="intro-features">
          <div className="feature-item">
            <div className="feature-icon scan-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3v6h2V5h4V3H3zm18 0h-4v2h4v4h2V3h-2zm-4 18h4v-4h2v6h-6v-2zm-8 2H3v-6H1v8h8v-2z" />
              </svg>
            </div>
            <span className="feature-text">3D Scan Analysis</span>
          </div>

          <div className="feature-item">
            <div className="feature-icon map-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5z" />
              </svg>
            </div>
            <span className="feature-text">Hospital Network</span>
          </div>

          <div className="feature-item">
            <div className="feature-icon patient-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
            <span className="feature-text">Patient Care</span>
          </div>

          <div className="feature-item">
            <div className="feature-icon ai-icon">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
              </svg>
            </div>
            <span className="feature-text">AI Powered</span>
          </div>
        </div>

        {/* Skip Button */}
        <div className="intro-skip-section">
          <button className="intro-skip-button" onClick={() => {
            setIsExiting(true);
            setTimeout(() => onComplete(), 600);
          }}>
            SKIP INTRO →
          </button>
        </div>

        {/* Progress dots */}
        <div className="intro-progress-dots">
          {backgroundImages.map((_, idx) => (
            <div
              key={idx}
              className={`dot ${idx === currentImageIndex ? 'active' : ''}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default IntroAnimation;
