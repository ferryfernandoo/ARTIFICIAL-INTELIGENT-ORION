/**
 * Timeline Component
 * Shows document generation progress with visual timeline
 */

import React from 'react';
import './Timeline.css';

const Timeline = ({ steps, currentStep, isComplete, error }) => {
  const steps_list = [
    { num: 1, label: 'Memanggil Engine', desc: 'Initializing' },
    { num: 2, label: 'Parse Data', desc: 'Analyzing content' },
    { num: 3, label: 'Struktur Dokumen', desc: 'Building structure' },
    { num: 4, label: 'Menulis ke File', desc: 'Writing content' },
    { num: 5, label: 'Selesai', desc: 'Complete' }
  ];

  return (
    <div className="timeline-container">
      <div className="timeline-progress">
        {steps_list.map((step, idx) => {
          const isActive = step.num <= currentStep;
          const isCurrentStep = step.num === currentStep;
          
          return (
            <div key={step.num} className="timeline-step">
              <div className={`step-circle ${isActive ? 'active' : ''} ${isCurrentStep ? 'current' : ''} ${isComplete ? 'complete' : ''}`}>
                {isActive && !isCurrentStep ? (
                  <span className="step-check">✓</span>
                ) : (
                  <span className="step-num">{step.num}</span>
                )}
              </div>
              
              <div className="step-content">
                <div className="step-label">{step.label}</div>
                <div className="step-desc">{step.desc}</div>
              </div>

              {idx < steps_list.length - 1 && (
                <div className={`step-connector ${isActive ? 'active' : ''}`} />
              )}
            </div>
          );
        })}
      </div>

      {currentStep > 0 && currentStep < 6 && (
        <div className="step-status">
          <div className="spinner" />
          <div className="status-text">{steps[currentStep - 1]?.status || 'Processing...'}</div>
        </div>
      )}

      {error && (
        <div className="timeline-error">
          <span className="error-icon">⚠️</span>
          <span className="error-text">{error}</span>
        </div>
      )}

      {isComplete && (
        <div className="timeline-complete">
          <span className="complete-icon">✨</span>
          <span className="complete-text">Document ready!</span>
        </div>
      )}
    </div>
  );
};

export default Timeline;
