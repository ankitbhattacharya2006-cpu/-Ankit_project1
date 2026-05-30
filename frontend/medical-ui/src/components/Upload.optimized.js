// Optimized Upload Component - src/components/Upload.js
import React, { useCallback, useRef, useState } from 'react';
import { debounce } from '../utils/performance';

const Upload = ({ onResultReceived }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef();
  const abortControllerRef = useRef(new AbortController());

  // Debounced file size check
  const checkFileSize = useCallback(debounce((fileSize) => {
    if (fileSize > 100 * 1024 * 1024) {
      alert('File too large (max 100MB)');
      return false;
    }
    return true;
  }, 100), []);

  const handleFileSelect = useCallback((e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (!checkFileSize(selectedFile.size)) {
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
    setProgress(0);
  }, [checkFileSize]);

  const handleUpload = useCallback(async (e) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('department', 'neuro_axial');
    formData.append('patient_name', 'Test Patient');
    formData.append('bed_number', '101');
    formData.append('residence', 'Kolkata');
    formData.append('consent', 'true');

    try {
      // Simulate upload progress
      const uploadInterval = setInterval(() => {
        setProgress((prev) => Math.min(prev + Math.random() * 20, 90));
      }, 200);

      const response = await fetch('http://127.0.0.1:8000/process-scan', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      clearInterval(uploadInterval);

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setProgress(100);
      onResultReceived?.(result);
      setFile(null);

      // Reset after animation
      setTimeout(() => setProgress(0), 1000);
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Upload error:', error);
        alert('Upload failed');
      }
    } finally {
      setLoading(false);
    }
  }, [file, onResultReceived]);

  const handleCancel = useCallback(() => {
    abortControllerRef.current.abort();
    abortControllerRef.current = new AbortController();
    setLoading(false);
    setProgress(0);
  }, []);

  return (
    <div className="upload-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".dcm,.nii,.nii.gz,.jpg,.png,.tiff"
        onChange={handleFileSelect}
        disabled={loading}
        style={{ display: 'none' }}
      />

      {!file ? (
        <button
          className="upload-btn-trigger"
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
        >
          📁 Select Scan
        </button>
      ) : (
        <div className="upload-info">
          <p>{file.name} ({(file.size / 1024 / 1024).toFixed(1)}MB)</p>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="upload-actions">
            <button
              className="upload-btn-confirm"
              onClick={handleUpload}
              disabled={loading}
            >
              {loading ? '⏳ Processing...' : '✓ Upload'}
            </button>
            <button
              className="upload-btn-cancel"
              onClick={() => {
                setFile(null);
                setProgress(0);
              }}
              disabled={loading}
            >
              ✕ Clear
            </button>
            {loading && (
              <button
                className="upload-btn-cancel"
                onClick={handleCancel}
              >
                ⏹ Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
