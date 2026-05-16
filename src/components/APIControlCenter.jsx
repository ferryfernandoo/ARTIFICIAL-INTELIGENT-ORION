import React, { useState, useMemo } from 'react';
import './APIControlCenter.css';

const StatCard = ({ icon, label, value, subtext, color }) => (
  <div className={`stat-card stat-card-${color}`}>
    <div className="stat-icon">{icon}</div>
    <div className="stat-content">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
    </div>
  </div>
);

export default function APIControlCenter() {
  const [apiKeys, setApiKeys] = useState([
    {
      id: 1,
      name: 'nando',
      key: 'deepernova...atg86',
      created: '4/28/2026',
      status: 'Active',
      fullKey: 'deepernova_sk_prod_abc123def456atg86', // Only shown when viewing
      requests: 1240,
      lastUsed: '5/4/2026 2:30 PM'
    }
  ]);

  const stats = useMemo(() => {
    const active = apiKeys.filter(k => k.status === 'Active').length;
    const totalReqs = apiKeys.reduce((sum, k) => sum + k.requests, 0);
    return {
      totalKeys: apiKeys.length,
      activeKeys: active,
      totalRequests: totalReqs,
      tokenSpend: (totalReqs * 0.00008).toFixed(2)
    };
  }, [apiKeys]);

  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [viewingKey, setViewingKey] = useState(null);
  const [copiedKeyId, setCopiedKeyId] = useState(null);

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return;

    const randomStr = Math.random().toString(36).substring(2, 8);
    const newKey = {
      id: apiKeys.length + 1,
      name: newKeyName,
      key: `deepernova...${randomStr}`,
      created: new Date().toLocaleDateString(),
      status: 'Active',
      fullKey: `deepernova_sk_prod_${Date.now()}_${randomStr}`,
      requests: 0,
      lastUsed: 'Never'
    };

    setApiKeys([...apiKeys, newKey]);
    setNewKeyName('');
    setShowCreateKey(false);
  };

  const handleDisableKey = (id) => {
    setApiKeys(apiKeys.map(k => 
      k.id === id ? { ...k, status: 'Disabled' } : k
    ));
  };

  const handleDeleteKey = (id) => {
    if (window.confirm('Are you sure you want to delete this key? This action cannot be undone.')) {
      setApiKeys(apiKeys.filter(k => k.id !== id));
    }
  };

  const handleCopyKey = (fullKey, keyId) => {
    navigator.clipboard.writeText(fullKey);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  return (
    <div className="api-control-center">
      {/* Header */}
      <div className="api-header">
        <div className="api-title-section">
          <h1>🔑 API Control Center</h1>
          <p>Manage your Deepernova API keys, monitor usage, and keep every integration secure</p>
        </div>
        <div className="api-header-actions">
          <button className="api-btn api-btn-primary" onClick={() => setShowCreateKey(!showCreateKey)}>
            + Create Key
          </button>
          <button className="api-btn api-btn-secondary" onClick={() => setApiKeys([...apiKeys])}>
            🔄 Refresh Data
          </button>
        </div>
      </div>

      {/* Create Key Form */}
      {showCreateKey && (
        <div className="api-create-key-form">
          <div className="form-group">
            <label>Key Name</label>
            <input 
              type="text" 
              placeholder="e.g., Production API Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateKey()}
            />
            <small>Give your key a meaningful name for easy identification</small>
          </div>
          <div className="form-actions">
            <button className="api-btn api-btn-primary" onClick={handleCreateKey}>
              ✓ Create Key
            </button>
            <button className="api-btn api-btn-text" onClick={() => setShowCreateKey(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard 
          icon="🔑" 
          label="Total API Keys" 
          value={stats.totalKeys}
          subtext="Keys available for your projects"
          color="orange"
        />
        <StatCard 
          icon="✅" 
          label="Active Keys" 
          value={stats.activeKeys}
          subtext="Live credentials in use"
          color="green"
        />
        <StatCard 
          icon="📊" 
          label="Total Requests" 
          value={stats.totalRequests.toLocaleString()}
          subtext="Calls processed this period"
          color="blue"
        />
        <StatCard 
          icon="💰" 
          label="Token Spend" 
          value={`$${stats.tokenSpend}`}
          subtext="Estimated billing impact"
          color="purple"
        />
      </div>

      {/* API Keys Section */}
      <div className="api-keys-section">
        <div className="section-header">
          <h2>🔐 API Keys</h2>
          <p>Securely manage keys and permissions in one place</p>
        </div>

        {apiKeys.length === 0 ? (
          <div className="api-empty-state">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
            <h3>No API Keys Yet</h3>
            <p>Create your first API key to get started with Deepernova integration</p>
            <button className="api-btn api-btn-primary" onClick={() => setShowCreateKey(true)}>
              + Create Your First Key
            </button>
          </div>
        ) : (
          <div className="api-keys-table">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Requests</th>
                  <th>Last Used</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(apiKey => (
                  <tr key={apiKey.id} className={`key-row key-${apiKey.status.toLowerCase()}`}>
                    <td className="key-name">
                      <span className="key-icon">🔑</span>
                      {apiKey.name}
                    </td>
                    <td className="key-value">
                      <code>{apiKey.key}</code>
                      <button 
                        className="copy-btn"
                        onClick={() => handleCopyKey(apiKey.fullKey, apiKey.id)}
                        title="Copy full key"
                      >
                        {copiedKeyId === apiKey.id ? '✓ Copied!' : '📋'}
                      </button>
                    </td>
                    <td>{apiKey.created}</td>
                    <td>
                      <span className={`status-badge status-${apiKey.status.toLowerCase()}`}>
                        {apiKey.status}
                      </span>
                    </td>
                    <td className="requests-cell">{apiKey.requests.toLocaleString()}</td>
                    <td className="last-used">{apiKey.lastUsed}</td>
                    <td className="actions-cell">
                      <button 
                        className="action-btn action-view"
                        onClick={() => setViewingKey(viewingKey === apiKey.id ? null : apiKey.id)}
                        title="View details"
                      >
                        👁️
                      </button>
                      {apiKey.status === 'Active' && (
                        <button 
                          className="action-btn action-disable"
                          onClick={() => handleDisableKey(apiKey.id)}
                          title="Disable key"
                        >
                          ⏸️
                        </button>
                      )}
                      <button 
                        className="action-btn action-delete"
                        onClick={() => handleDeleteKey(apiKey.id)}
                        title="Delete key"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Trend Section */}
      <div className="usage-trend-section">
        <div className="section-header">
          <h2>📈 Usage Trend</h2>
          <p>Quick glance at recent API activity</p>
        </div>
        <div className="usage-trend-card">
          <div className="usage-status">
            <span className="live-indicator"></span>
            <span className="live-text">Live</span>
          </div>
          <div className="chart-preview">
            <svg viewBox="0 0 100 40" preserveAspectRatio="none">
              <polyline points="0,30 20,15 40,20 60,10 80,15 100,5" stroke="#f97316" strokeWidth="1.5" fill="none" />
              <polyline points="0,30 20,15 40,20 60,10 80,15 100,5" stroke="#fb923c" strokeWidth="1" fill="url(#gradient)" opacity="0.3" />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fb923c" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="chart-stats">
            <div className="chart-stat-item">
              <span className="stat-name">Peak:</span>
              <span className="stat-num">{Math.max(...apiKeys.map(k => k.requests), 0)} calls</span>
            </div>
            <div className="chart-stat-item">
              <span className="stat-name">Average:</span>
              <span className="stat-num">{apiKeys.length > 0 ? Math.round(stats.totalRequests / apiKeys.length) : 0} calls/key</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Insights */}
      <div className="quick-insights-section">
        <div className="section-header">
          <h2>💡 Quick Insights</h2>
          <p>Essential information for secure operation</p>
        </div>
        <div className="insights-grid">
          <div className="insight-card insight-success">
            <div className="insight-icon">✅</div>
            <div className="insight-content">
              <h4>Active Key Ratio</h4>
              <p className="insight-value">{stats.totalKeys > 0 ? Math.round((stats.activeKeys / stats.totalKeys) * 100) : 0}%</p>
              <p className="insight-text">All keys are active</p>
            </div>
          </div>

          <div className="insight-card insight-info">
            <div className="insight-icon">🔄</div>
            <div className="insight-content">
              <h4>Recent Refresh</h4>
              <p className="insight-value">Just now</p>
              <p className="insight-text">Data is up to date</p>
            </div>
          </div>

          <div className="insight-card insight-warning">
            <div className="insight-icon">⚠️</div>
            <div className="insight-content">
              <h4>Recommended Action</h4>
              <p className="insight-value">Rotate Keys</p>
              <p className="insight-text">Rotate inactive keys regularly for security</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
