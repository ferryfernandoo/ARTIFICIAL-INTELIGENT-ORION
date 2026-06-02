import React from 'react';
import './StepperComponent.css';

const StepperComponent = ({ steps = [] }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return '●'; // Solid circle
      case 'active':
        return '⟳'; // Loading spinner
      case 'pending':
      default:
        return '○'; // Empty circle
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'complete':
        return 'step-complete';
      case 'active':
        return 'step-active';
      case 'error':
        return 'step-error';
      case 'pending':
      default:
        return 'step-pending';
    }
  };

  return (
    <div className="stepper-container">
      {steps.map((step, idx) => (
        <div key={idx} className={`stepper-step ${getStatusClass(step.status)}`}>
          <div className="step-icon-wrapper">
            <span className={`step-icon ${getStatusClass(step.status)}`}>
              {getStatusIcon(step.status)}
            </span>
          </div>
          <div className="step-content">
            <div className="step-name">{step.stepName}</div>
            {step.detail && <div className="step-detail">{step.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StepperComponent;
