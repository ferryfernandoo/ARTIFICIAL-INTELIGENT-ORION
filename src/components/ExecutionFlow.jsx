import React, { useState } from 'react';
import './ExecutionFlow.css';

/**
 * ExecutionFlow Component
 * Menampilkan proses execution server secara transparan
 * - Expandable/collapsible thinking bubble
 * - Step-by-step process (Reading skill, Generating, Executing)
 * - Real-time updates dengan smooth animations
 * - Modern UI design
 */
const ExecutionFlow = ({ 
  steps = [],
  isExpanded = false, 
  onToggle = () => {},
  title = "🤖 Orion berfikir...",
  isComplete = false,
  totalTime = 0
}) => {
  const [localExpanded, setLocalExpanded] = useState(isExpanded);

  const toggleExpand = () => {
    setLocalExpanded(!localExpanded);
    onToggle?.(!localExpanded);
  };

  // Get step icon dengan status
  const getStepIcon = (step) => {
    if (step.status === 'complete') return '✓';
    if (step.status === 'active') return '⟳';
    if (step.status === 'error') return '✕';
    return '◇';
  };

  // Get step icon color
  const getStepColor = (step) => {
    if (step.status === 'complete') return 'var(--color-success, #10b981)';
    if (step.status === 'active') return 'var(--color-primary, #3b82f6)';
    if (step.status === 'error') return 'var(--color-error, #ef4444)';
    return 'var(--color-muted, #9ca3af)';
  };

  // Calculate completion percentage
  const totalSteps = steps.length;
  const completedSteps = steps.filter(s => s.status === 'complete').length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="execution-flow-container">
      {/* Thinking Bubble Header - Always visible, clickable to expand */}
      <div 
        className={`thinking-bubble ${localExpanded ? 'expanded' : 'collapsed'} ${isComplete ? 'complete' : ''}`}
        onClick={toggleExpand}
      >
        <div className="bubble-header">
          {/* Left section: Icon + Title */}
          <div className="bubble-left">
            <div className={`bubble-icon ${isComplete ? 'complete' : 'thinking'}`}>
              {isComplete ? '✓' : '💭'}
            </div>
            <div className="bubble-text">
              <div className="bubble-title">{title}</div>
              {isComplete && totalTime > 0 && (
                <div className="bubble-subtitle">Selesai dalam {totalTime}ms</div>
              )}
              {!isComplete && steps.length > 0 && (
                <div className="bubble-subtitle">
                  {completedSteps}/{totalSteps} langkah
                </div>
              )}
            </div>
          </div>

          {/* Right section: Progress + Toggle */}
          <div className="bubble-right">
            {!isComplete && steps.length > 0 && (
              <div className="progress-ring">
                <svg width="32" height="32" viewBox="0 0 32 32">
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="rgba(59, 130, 246, 0.1)"
                    strokeWidth="2"
                  />
                  <circle
                    cx="16"
                    cy="16"
                    r="14"
                    fill="none"
                    stroke="rgb(59, 130, 246)"
                    strokeWidth="2"
                    strokeDasharray={`${2 * Math.PI * 14}`}
                    strokeDashoffset={`${2 * Math.PI * 14 * (1 - progressPercent / 100)}`}
                    style={{ transition: 'stroke-dashoffset 0.3s ease' }}
                  />
                </svg>
              </div>
            )}
            <div className={`toggle-icon ${localExpanded ? 'rotated' : ''}`}>
              ▼
            </div>
          </div>
        </div>

        {/* Progress bar - visible in collapsed view */}
        {!isComplete && steps.length > 0 && !localExpanded && (
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>

      {/* Expanded Details - Smooth animation */}
      {localExpanded && (
        <div className="thinking-details">
          <div className="details-content">
            {steps.length > 0 ? (
              <div className="steps-list">
                {steps.map((step, idx) => (
                  <div 
                    key={idx}
                    className={`execution-step step-${step.status}`}
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    {/* Step icon */}
                    <div 
                      className="step-icon"
                      style={{ color: getStepColor(step) }}
                    >
                      <span className={`icon-symbol ${step.status === 'active' ? 'spinning' : ''}`}>
                        {getStepIcon(step)}
                      </span>
                    </div>

                    {/* Step content */}
                    <div className="step-details">
                      <div className="step-name">
                        <span className="step-emoji">{step.emoji || '⚙️'}</span>
                        {step.name}
                      </div>
                      {step.message && (
                        <div className="step-message">{step.message}</div>
                      )}
                      {step.detail && (
                        <div className="step-detail">{step.detail}</div>
                      )}
                      {step.duration && (
                        <div className="step-time">{step.duration}ms</div>
                      )}
                    </div>

                    {/* Step connector line */}
                    {idx < steps.length - 1 && (
                      <div className="step-connector" />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="steps-empty">
                <div className="empty-spinner">⟳</div>
                <div className="empty-text">Sedang memproses...</div>
              </div>
            )}
          </div>

          {/* Details footer - Summary */}
          {isComplete && steps.length > 0 && (
            <div className="details-footer">
              <div className="footer-summary">
                ✓ {completedSteps} dari {totalSteps} langkah selesai
                {totalTime > 0 && ` • Total: ${totalTime}ms`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExecutionFlow;
