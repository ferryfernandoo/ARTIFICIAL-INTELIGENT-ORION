/**
 * DocumentGenerator Component
 * Handles Word/Excel file generation with timeline visualization
 */

import React, { useState, useEffect } from 'react';
import Timeline from './Timeline';
import './DocumentGenerator.css';

const DocumentGenerator = ({ isOpen, onClose, fileType = 'word', content, title }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  useEffect(() => {
    if (isOpen && content && !hasGenerated) {
      setHasGenerated(true);
      generateDocument();
    } else if (!isOpen) {
      setHasGenerated(false);
    }
  }, [isOpen]);

  const generateDocument = async () => {
    setIsGenerating(true);
    setCurrentStep(1);
    setError(null);
    setResult(null);
    setProgress([]);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
      const endpoint = fileType === 'word' 
        ? `${API_BASE_URL}/api/documents/generate/word`
        : `${API_BASE_URL}/api/documents/generate/excel`;

      // Simulate step progression
      const stepsData = [
        { step: 1, status: 'Memanggil engine...' },
        { step: 2, status: 'Parse data dan analisis...' },
        { step: 3, status: 'Membuat struktur dokumen...' },
        { step: 4, status: 'Menulis ke file...' },
        { step: 5, status: 'Selesai!' }
      ];

      // Show steps progressively
      for (let i = 0; i < stepsData.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 600));
        setCurrentStep(i + 1);
        setProgress(prev => [...prev, stepsData[i]]);
      }

      // Call API
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: content,
          title: title || `Generated ${fileType === 'word' ? 'Document' : 'Spreadsheet'}`
        })
      });

      if (!response.ok) {
        try {
          const errData = await response.json();
          throw new Error(errData.error || `Generation failed (${response.status})`);
        } catch {
          throw new Error(`Generation failed (${response.status}): ${response.statusText}`);
        }
      }

      const data = await response.json();
      setResult(data);
      setCurrentStep(5);
      
    } catch (err) {
      console.error('Generation error:', err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (result?.downloadUrl) {
      window.open(result.downloadUrl, '_blank');
    }
  };

  const handleOpen = () => {
    if (result?.viewerUrl) {
      window.open(result.viewerUrl, '_blank');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="document-generator-modal">
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal-content">
        <div className="modal-header">
          <h2>
            {fileType === 'word' ? '📄 Word Document' : '📊 Excel Spreadsheet'} Generator
          </h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {isGenerating && !result && (
            <Timeline 
              steps={progress}
              currentStep={currentStep}
              isComplete={false}
              error={error}
            />
          )}

          {result && !error && (
            <div className="result-section">
              <div className="result-success">
                <span className="result-icon">✨</span>
                <span className="result-text">File berhasil dibuat!</span>
              </div>

              <div className="result-details">
                <div className="detail-row">
                  <span className="detail-label">File:</span>
                  <span className="detail-value">{result.file.fileName}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Ukuran:</span>
                  <span className="detail-value">{(result.file.size / 1024).toFixed(2)} KB</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Tipe:</span>
                  <span className="detail-value">{result.file.fileType.toUpperCase()}</span>
                </div>
              </div>

              <div className="result-actions">
                <button className="btn-primary" onClick={handleOpen}>
                  <span className="btn-icon">👁️</span>
                  <span className="btn-text">Buka di Editor</span>
                </button>
                <button className="btn-secondary" onClick={handleDownload}>
                  <span className="btn-icon">⬇️</span>
                  <span className="btn-text">Download</span>
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="error-section">
              <div className="error-icon">❌</div>
              <div className="error-message">
                <h3>Terjadi Error</h3>
                <p>{error}</p>
              </div>
              <button className="btn-retry" onClick={generateDocument}>
                Coba Lagi
              </button>
            </div>
          )}
        </div>

        {!isGenerating && (
          <div className="modal-footer">
            <button className="btn-close" onClick={onClose}>Tutup</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentGenerator;
