import React, { useState } from 'react';
import './SourceVisualization.css';

/**
 * SourceVisualization Component
 * Displays research sources with circular icons and expandable details
 */

export const SourceVisualization = ({ sources = [], averageCredibility = 0, compact = false }) => {
  const [expandedSourceId, setExpandedSourceId] = useState(null);
  const [viewMode, setViewMode] = useState('compact'); // 'compact' or 'detailed'

  const toggleSourceExpand = (sourceId) => {
    setExpandedSourceId(expandedSourceId === sourceId ? null : sourceId);
  };

  if (!sources || sources.length === 0) {
    return (
      <div className="source-visualization empty">
        <p>📭 No sources found</p>
      </div>
    );
  }

  const displaySources = compact ? sources.slice(0, 5) : sources;

  return (
    <div className="source-visualization">
      {/* Header */}
      <div className="source-header">
        <div className="source-stats">
          <span className="stat-item">
            📊 <strong>{sources.length}</strong> sources
          </span>
          <span className="stat-item">
            ⭐ <strong>{averageCredibility}%</strong> avg credibility
          </span>
        </div>
        <div className="view-toggle">
          <button
            className={`toggle-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => setViewMode('compact')}
            title="Compact view"
          >
            ◯◯◯ Compact
          </button>
          <button
            className={`toggle-btn ${viewMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setViewMode('detailed')}
            title="Detailed view"
          >
            ≡ Detailed
          </button>
        </div>
      </div>

      {/* Compact View - Circular Icons */}
      {viewMode === 'compact' && (
        <div className="sources-grid-compact">
          {displaySources.map((source) => (
            <div
              key={source.id}
              className={`source-circle ${
                expandedSourceId === source.id ? 'expanded' : ''
              }`}
              onClick={() => toggleSourceExpand(source.id)}
              title={source.title}
            >
              {/* Icon with credibility indicator */}
              <div className="circle-icon">
                <span className="icon-emoji">{source.icon}</span>
                <span className="credibility-ring" style={{
                  opacity: source.credibility / 100,
                  borderColor: source.credibility >= 75 ? '#4CAF50' : 
                              source.credibility >= 50 ? '#FFC107' : '#FF5252'
                }}></span>
              </div>

              {/* Expanded Details */}
              {expandedSourceId === source.id && (
                <div className="source-details-popup">
                  <div className="popup-header">
                    <h4>{source.title}</h4>
                    <button
                      className="close-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedSourceId(null);
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="popup-content">
                    <div className="detail-row">
                      <span className="label">Source:</span>
                      <span className="value">{source.source}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Type:</span>
                      <span className="badge">{source.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Credibility:</span>
                      <div className="credibility-bar">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${source.credibility}%`,
                            backgroundColor: source.credibility >= 75 ? '#4CAF50' :
                                            source.credibility >= 50 ? '#FFC107' : '#FF5252'
                          }}
                        ></div>
                        <span className="credibility-text">{source.credibility}%</span>
                      </div>
                    </div>
                    {source.snippet && (
                      <div className="detail-row">
                        <span className="label">Snippet:</span>
                        <p className="snippet">{source.snippet}</p>
                      </div>
                    )}
                    <div className="detail-row url-row">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="source-link"
                      >
                        🔗 Visit Source
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Hover Label */}
              <div className="circle-label">
                {source.source.substring(0, 10)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detailed View - List */}
      {viewMode === 'detailed' && (
        <div className="sources-list-detailed">
          {displaySources.map((source) => (
            <div
              key={source.id}
              className={`source-item ${
                expandedSourceId === source.id ? 'expanded' : ''
              }`}
              onClick={() => toggleSourceExpand(source.id)}
            >
              <div className="source-item-header">
                <div className="source-icon-badge">
                  <span className="badge-icon">{source.icon}</span>
                </div>
                <div className="source-info">
                  <h4 className="source-title">{source.title}</h4>
                  <div className="source-meta">
                    <span className="source-name">📍 {source.source}</span>
                    <span className="source-type">🏷️ {source.type}</span>
                    <span className="credibility-badge" style={{
                      backgroundColor: source.credibility >= 75 ? '#4CAF50' :
                                      source.credibility >= 50 ? '#FFC107' : '#FF5252'
                    }}>
                      ⭐ {source.credibility}%
                    </span>
                  </div>
                </div>
                <div className="expand-indicator">
                  {expandedSourceId === source.id ? '▼' : '▶'}
                </div>
              </div>

              {expandedSourceId === source.id && (
                <div className="source-item-details">
                  {source.snippet && (
                    <div className="detail-section">
                      <h5>Summary</h5>
                      <p>{source.snippet}</p>
                    </div>
                  )}
                  <div className="detail-section">
                    <h5>Details</h5>
                    <div className="detail-grid">
                      <span>Domain: {source.domain}</span>
                      <span>Type: {source.type}</span>
                      <span>Credibility: {source.credibility}%</span>
                    </div>
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="source-link-detailed"
                  >
                    🔗 Open Source Link →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Show more indicator */}
      {compact && sources.length > 5 && (
        <div className="sources-more">
          +{sources.length - 5} more sources available
        </div>
      )}

      {/* Source Quality Indicator */}
      <div className="source-quality-bar">
        <div className="quality-section">
          <span className="quality-label">Data Quality:</span>
          <div className="quality-indicators">
            <span className={`indicator ${sources.length >= 5 ? 'good' : 'warning'}`}>
              ✓ Coverage: {sources.length} sources
            </span>
            <span className={`indicator ${averageCredibility >= 70 ? 'good' : 'warning'}`}>
              ✓ Credibility: {averageCredibility}%
            </span>
            <span className={`indicator ${sources.some(s => s.type === 'reference') ? 'good' : 'neutral'}`}>
              ✓ References: {sources.filter(s => s.type === 'reference').length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SourceVisualization;
