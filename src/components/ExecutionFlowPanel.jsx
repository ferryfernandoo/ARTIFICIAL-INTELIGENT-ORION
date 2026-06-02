import React, { useState } from 'react';
import './ExecutionFlowPanel.css';

/**
 * Component untuk menampilkan detailed execution flow dari agent AI
 * Menampilkan step-by-step proses dari task execution
 */
const ExecutionFlowPanel = ({ agentResult, isOpen, onClose }) => {
  const [expandedSteps, setExpandedSteps] = useState({});

  if (!isOpen || !agentResult) return null;

  const steps = [
    {
      id: 1,
      icon: '🎯',
      title: 'Command Detected',
      description: 'Automation command recognized and parsed',
      status: 'success'
    },
    {
      id: 2,
      icon: '🤖',
      title: 'Code Generation',
      description: 'Deepseek API generating safe Python code',
      status: 'success',
      detail: agentResult.generatedCode?.substring(0, 500) + '...'
    },
    {
      id: 3,
      icon: '🔐',
      title: 'Security Validation',
      description: 'Blacklist check - no dangerous operations',
      status: 'success'
    },
    {
      id: 4,
      icon: '📦',
      title: 'Sandbox Creation',
      description: 'Isolated Python environment created',
      status: 'success',
      detail: 'User-specific sandbox with 60s timeout, 512MB RAM limit'
    },
    {
      id: 5,
      icon: '⚙️',
      title: 'Code Execution',
      description: `Code executed in ${agentResult.executionTime}`,
      status: agentResult.status === 'success' ? 'success' : 'error'
    },
    {
      id: 6,
      icon: '✅',
      title: 'Results Collection',
      description: agentResult.status === 'success' ? 'Output collected successfully' : 'Error occurred',
      status: agentResult.status === 'success' ? 'success' : 'error'
    }
  ];

  const toggleStep = (stepId) => {
    setExpandedSteps(prev => ({
      ...prev,
      [stepId]: !prev[stepId]
    }));
  };

  return (
    <div className="execution-flow-overlay" onClick={onClose}>
      <div className="execution-flow-panel" onClick={e => e.stopPropagation()}>
        <div className="execution-flow-header">
          <h2>⚡ Agent Execution Flow</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="execution-flow-content">
          {/* Summary */}
          <div className="flow-summary">
            <div className="summary-item">
              <span className="summary-label">Status:</span>
              <span className={`summary-value ${agentResult.status}`}>
                {agentResult.status === 'success' ? '✅ Success' : '❌ Failed'}
              </span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Total Time:</span>
              <span className="summary-value">{agentResult.totalTime}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Execution Time:</span>
              <span className="summary-value">{agentResult.executionTime}</span>
            </div>
            <div className="summary-item">
              <span className="summary-label">Task ID:</span>
              <span className="summary-value mono">{agentResult.taskId?.substring(0, 12)}...</span>
            </div>
          </div>

          {/* Steps Timeline */}
          <div className="flow-timeline">
            <h3>Execution Steps</h3>
            {steps.map((step, idx) => (
              <div 
                key={step.id} 
                className={`flow-step ${step.status} ${expandedSteps[step.id] ? 'expanded' : ''}`}
                onClick={() => toggleStep(step.id)}
              >
                <div className="step-connector">
                  <div className={`step-dot ${step.status}`}>{step.icon}</div>
                  {idx < steps.length - 1 && <div className="step-line"></div>}
                </div>

                <div className="step-content">
                  <div className="step-header">
                    <h4>{step.title}</h4>
                    <span className={`step-status-badge ${step.status}`}>
                      {step.status === 'success' ? '✓' : '✕'}
                    </span>
                  </div>
                  <p className="step-description">{step.description}</p>
                  
                  {expandedSteps[step.id] && step.detail && (
                    <div className="step-detail">
                      <code>{step.detail}</code>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Output */}
          {agentResult.output && (
            <div className="flow-output">
              <h3>Output</h3>
              <div className="output-content">
                <pre>{agentResult.output}</pre>
              </div>
            </div>
          )}

          {/* Error */}
          {agentResult.error && agentResult.status !== 'success' && (
            <div className="flow-error">
              <h3>Error</h3>
              <div className="error-content">
                <pre>{agentResult.error}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="execution-flow-footer">
          <p className="security-note">
            🔐 All code executed in isolated sandbox environment
          </p>
          <button className="close-footer-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default ExecutionFlowPanel;
