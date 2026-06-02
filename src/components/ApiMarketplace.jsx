import React, { useState, useEffect } from 'react';
import './ApiMarketplace.css';

const ApiMarketplace = ({ onLogout }) => {
  const [currentPage, setCurrentPage] = useState('landing');
  const [apiKeys, setApiKeys] = useState([]);
  const [usageStats, setUsageStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [showCreateKeyModal, setShowCreateKeyModal] = useState(false);
  const [showFullKeyModal, setShowFullKeyModal] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [activeTab, setActiveTab] = useState('getting-started');
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [navOpen, setNavOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [selectedKeyFull, setSelectedKeyFull] = useState('');
  const [_selectedKeyId, _setSelectedKeyId] = useState(null); // Track selected key ID
  const [createdKey, setCreatedKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const totalKeys = apiKeys.length;
  const activeKeys = apiKeys.filter((key) => key.isActive).length;
  const totalRequests = usageStats?.stats?.totalRequests || 0;
  const totalCost = usageStats?.stats?.totalCost ? usageStats.stats.totalCost.toFixed(2) : '0.00';

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/apikeys`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setApiKeys(data.keys);
        if (data.keys.length > 0) {
          fetchUsageStats(data.keys[0].key);
        }
      }
    } catch (error) {
      console.error('Error fetching API keys:', error);
      setErrorMsg('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageStats = async (key) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/v1/usage`, {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      const data = await response.json();
      setUsageStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const createNewApiKey = async () => {
    if (!newKeyName.trim()) {
      setErrorMsg('Please enter a name for the API key');
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${apiBaseUrl}/api/apikeys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newKeyName })
      });
      const data = await response.json();
      if (data.success) {
        setCreatedKey(data.key);
        setShowApiKeyModal(true);
        setShowCreateKeyModal(false);
        setNewKeyName('');
        setErrorMsg('');
        await fetchApiKeys();
      } else {
        setErrorMsg(data.error || 'Failed to create API key');
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      setErrorMsg('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const viewFullKey = async (keyId) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/apikeys/${keyId}/full`, {
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        setSelectedKeyFull(data.fullKey);
        _setSelectedKeyId(keyId);
        setShowFullKeyModal(true);
      }
    } catch (error) {
      console.error('Error fetching full key:', error);
      setErrorMsg('Failed to load API key');
    }
  };

  const updateApiKey = async (keyId, updates) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/apikeys/${keyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        await fetchApiKeys();
      } else {
        setErrorMsg(data.error || 'Failed to update API key');
      }
    } catch (error) {
      console.error('Error updating API key:', error);
      setErrorMsg('Failed to update API key');
    }
  };

  const deleteApiKey = async (keyId) => {
    if (!window.confirm('Are you sure you want to delete this API key?')) return;
    try {
      const response = await fetch(`${apiBaseUrl}/api/apikeys/${keyId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await response.json();
      if (data.success) {
        await fetchApiKeys();
        setErrorMsg('');
      } else {
        setErrorMsg(data.error || 'Failed to delete API key');
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      setErrorMsg('Failed to delete API key');
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(''), 2000);
  };

  return (
    <div className="api-marketplace">
      <nav className="api-nav">
        <div className="nav-container">
            <div className="logo">
            <h1>🚀 Deepernova API</h1>
            <span className="tagline">Advanced AI API</span>
          </div>
          <button className="nav-toggle" onClick={() => setNavOpen((prev) => !prev)} aria-label="Toggle navigation menu" aria-expanded={navOpen}>{navOpen ? '×' : '☰'}</button>
          <div className={`api-nav-menu ${navOpen ? 'open' : 'collapsed'}`}>
            <button className={`api-nav-btn ${currentPage === 'landing' ? 'active' : ''}`} onClick={() => { setCurrentPage('landing'); setNavOpen(false); }}>Home</button>
            <button className={`api-nav-btn ${currentPage === 'docs' ? 'active' : ''}`} onClick={() => { setCurrentPage('docs'); setNavOpen(false); }}>DOC</button>
            <button className={`api-nav-btn ${currentPage === 'pricing' ? 'active' : ''}`} onClick={() => { setCurrentPage('pricing'); setNavOpen(false); }}>Pricing</button>
            {apiKeys.length > 0 && <button className={`api-nav-btn ${currentPage === 'dashboard' ? 'active' : ''}`} onClick={() => { setCurrentPage('dashboard'); setNavOpen(false); }}>Dashboard</button>}
          </div>
          <div className="api-nav-actions">
            {apiKeys.length > 0 ? (
              <button className="btn-logout" onClick={onLogout}>Logout</button>
            ) : (
              <button className="btn-get-started" onClick={() => setShowCreateKeyModal(true)}>Create API Key</button>
            )}
          </div>
        </div>
      </nav>

      <div className="content-container">
        {currentPage === 'landing' && (
          <div className="landing-page">
            <div className="hero">
              <h1>Welcome to Deepernova API</h1>
              <p>Enterprise-grade AI infrastructure for modern applications. Fast, secure, and easy to integrate.</p>
              <button className="btn-get-started" onClick={() => setShowCreateKeyModal(true)}>Get Started Free</button>
            </div>
            <div className="features">
              <div className="feature-card"><h3>🚀 High Performance</h3><p>Predictable latency and reliable throughput.</p></div>
              <div className="feature-card"><h3>🔒 Secure by Design</h3><p>Provider-level encryption and access control.</p></div>
              <div className="feature-card"><h3>📈 Actionable Analytics</h3><p>Usage insights and cost tracking built in.</p></div>
              <div className="feature-card"><h3>🌐 Global Coverage</h3><p>Optimized for global availability and scalability.</p></div>
            </div>
          </div>
        )}

        {currentPage === 'docs' && (
          <div className="docs-page">
            <h2>Documentation</h2>
            <div className="docs-sidebar docs-nav">
              <button className={`doc-tab ${activeTab === 'getting-started' ? 'active' : ''}`} onClick={() => setActiveTab('getting-started')}>Getting Started</button>
              <button className={`doc-tab ${activeTab === 'authentication' ? 'active' : ''}`} onClick={() => setActiveTab('authentication')}>Authentication</button>
              <button className={`doc-tab ${activeTab === 'chat-api' ? 'active' : ''}`} onClick={() => setActiveTab('chat-api')}>Chat API</button>
              <button className={`doc-tab ${activeTab === 'examples' ? 'active' : ''}`} onClick={() => setActiveTab('examples')}>Examples</button>
              <button className={`doc-tab ${activeTab === 'error-handling' ? 'active' : ''}`} onClick={() => setActiveTab('error-handling')}>Error Handling</button>
            </div>
            <div className="docs-content">
              {activeTab === 'getting-started' && (
                <section>
                  <h3>Getting Started</h3>
                  <p>Welcome to Deepernova. This guide helps you set up your account, generate an API key, and integrate with a single, unified endpoint.</p>
                  <div className="doc-highlight">
                    <p><strong>Base URL</strong></p>
                    <code>https://api.deepernova.id/v1</code>
                  </div>
                  <h4>Step-by-step setup</h4>
                  <ol>
                    <li>Login to the dashboard and create a new API key.</li>
                    <li>Copy the key and store it securely.</li>
                    <li>Send requests using standard HTTP tools or your preferred SDK.</li>
                  </ol>
                  <h4>Best practices</h4>
                  <ul>
                    <li>Never embed API keys in client-side code.</li>
                    <li>Rotate keys regularly and delete unused ones.</li>
                    <li>Monitor usage through the dashboard analytics.</li>
                  </ul>
                </section>
              )}
              {activeTab === 'authentication' && (
                <section>
                  <h3>Authentication</h3>
                  <p>All requests must include your API key in the <code>Authorization</code> header using Bearer token authentication.</p>
                  <div className="code-block">
                    <code>Authorization: Bearer YOUR_API_KEY</code>
                    <button onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_KEY', 'auth')}>Copy</button>
                  </div>
                  <h4>Header example</h4>
                  <pre>{`POST https://api.deepernova.id/v1/chat/completions
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY`}</pre>
                  <h4>Secure storage</h4>
                  <p>Use environment variables or secure secrets management in production. Example:</p>
                  <pre>{`export DEEPERNOVA_API_KEY="YOUR_API_KEY"
const apiKey = process.env.DEEPERNOVA_API_KEY;`}</pre>
                </section>
              )}
              {activeTab === 'chat-api' && (
                <section>
                  <h3>Chat API</h3>
                  <p>The Chat API is the primary interface for conversational AI. It accepts a sequence of messages and returns a structured response from the assistant.</p>
                  <h4>Endpoint</h4>
                  <code>POST /chat/completions</code>
                  <h4>Request body</h4>
                  <pre>{`{
  "model": "deepernova-chat",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Generate a short product description." }
  ],
  "temperature": 0.7,
  "max_tokens": 500
}`}</pre>
                  <h4>Response format</h4>
                  <pre>{`{
  "id": "response_123",
  "object": "chat.completion",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Deepernova is a modern AI API built for fast, flexible integrations..."
      }
    }
  ],
  "usage": {
    "prompt_tokens": 32,
    "completion_tokens": 42,
    "total_tokens": 74
  }
}`}</pre>
                  <h4>Important fields</h4>
                  <ul>
                    <li><strong>model</strong>: selects the AI model.</li>
                    <li><strong>messages</strong>: conversation history used by the model.</li>
                    <li><strong>temperature</strong>: controls randomness.</li>
                    <li><strong>max_tokens</strong>: caps the output length.</li>
                  </ul>
                </section>
              )}
              {activeTab === 'examples' && (
                <section>
                  <h3>Examples</h3>
                  <p>Choose your preferred language to see a complete integration example.</p>
                  
                  <div className="code-lang-tabs">
                    <button 
                      className={`code-lang-btn ${codeLanguage === 'javascript' ? 'active' : ''}`}
                      onClick={() => setCodeLanguage('javascript')}
                    >
                      JavaScript
                    </button>
                    <button 
                      className={`code-lang-btn ${codeLanguage === 'python' ? 'active' : ''}`}
                      onClick={() => setCodeLanguage('python')}
                    >
                      Python
                    </button>
                    <button 
                      className={`code-lang-btn ${codeLanguage === 'curl' ? 'active' : ''}`}
                      onClick={() => setCodeLanguage('curl')}
                    >
                      cURL
                    </button>
                  </div>

                  {codeLanguage === 'javascript' && (
                    <div className="code-block-wrapper">
                      <div className="code-block-header">
                        <span className="code-lang-label">JavaScript (Node.js)</span>
                        <button 
                          className="code-copy-btn"
                          onClick={() => copyToClipboard(`fetch('https://api.deepernova.id/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'deepernova-chat',
    messages: [
      { role: 'user', content: 'Tell me about Deepernova.' }
    ]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));`, 'js-code')}
                        >
                          {copiedText === 'js-code' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="code-block-content">{`fetch('https://api.deepernova.id/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  },
  body: JSON.stringify({
    model: 'deepernova-chat',
    messages: [
      { role: 'user', content: 'Tell me about Deepernova.' }
    ]
  })
})
  .then(res => res.json())
  .then(data => console.log(data));`}</pre>
                    </div>
                  )}

                  {codeLanguage === 'python' && (
                    <div className="code-block-wrapper">
                      <div className="code-block-header">
                        <span className="code-lang-label">Python (requests)</span>
                        <button 
                          className="code-copy-btn"
                          onClick={() => copyToClipboard(`import os
import requests

api_key = os.getenv('DEEPERNOVA_API_KEY')
url = 'https://api.deepernova.id/v1/chat/completions'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {api_key}'
}
payload = {
    'model': 'deepernova-chat',
    'messages': [
        { 'role': 'user', 'content': 'Write a summary of Deepernova.' }
    ]
}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`, 'py-code')}
                        >
                          {copiedText === 'py-code' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="code-block-content">{`import os
import requests

api_key = os.getenv('DEEPERNOVA_API_KEY')
url = 'https://api.deepernova.id/v1/chat/completions'
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Bearer {api_key}'
}
payload = {
    'model': 'deepernova-chat',
    'messages': [
        { 'role': 'user', 'content': 'Write a summary of Deepernova.' }
    ]
}
response = requests.post(url, json=payload, headers=headers)
print(response.json())`}</pre>
                    </div>
                  )}

                  {codeLanguage === 'curl' && (
                    <div className="code-block-wrapper">
                      <div className="code-block-header">
                        <span className="code-lang-label">cURL</span>
                        <button 
                          className="code-copy-btn"
                          onClick={() => copyToClipboard(`curl https://api.deepernova.id/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"deepernova-chat","messages":[{"role":"user","content":"What can you do?"}]}'`, 'curl-code')}
                        >
                          {copiedText === 'curl-code' ? '✓ Copied' : 'Copy'}
                        </button>
                      </div>
                      <pre className="code-block-content">{`curl https://api.deepernova.id/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"model":"deepernova-chat","messages":[{"role":"user","content":"What can you do?"}]}'`}</pre>
                    </div>
                  )}
                </section>
              )}
              {activeTab === 'error-handling' && (
                <section>
                  <h3>Error Handling</h3>
                  <p>Handle API errors proactively by checking status codes and error messages. This improves reliability and helps maintain a smooth user experience.</p>
                  <ul>
                    <li><strong>401 Unauthorized</strong> — invalid or missing API key.</li>
                    <li><strong>429 Too Many Requests</strong> — rate limit exceeded; implement retry backoff.</li>
                    <li><strong>400 Bad Request</strong> — invalid payload or missing fields.</li>
                    <li><strong>500 Server Error</strong> — internal issue; retry after a short delay.</li>
                  </ul>
                  <h4>Retry recommendations</h4>
                  <p>Retry transient errors with exponential backoff and make sure you log the error details for debugging.</p>
                </section>
              )}
            </div>
          </div>
        )}

        {currentPage === 'pricing' && (
          <div className="pricing-page">
            <h2>Pricing</h2>
            <p>Simple, transparent API pricing for every stage of your product. Choose the plan that fits your usage and scale up when ready.</p>
            <div className="pricing-grid">
              <div className="pricing-card">
                <span className="badge">Starter</span>
                <h3>Free</h3>
                <p className="price">Rp 0 <span>/ bulan</span></p>
                <ul>
                  <li>5K requests / month</li>
                  <li>Rp 2 per 1M tokens</li>
                  <li>Basic API access</li>
                  <li>Community support</li>
                </ul>
                <button className="btn-pricing">Get Started</button>
              </div>
              <div className="pricing-card featured">
                <span className="badge">Most Popular</span>
                <h3>Pro</h3>
                <p className="price">Rp 100.000 <span>/ bulan</span></p>
                <ul>
                  <li>100K requests / month</li>
                  <li>Rp 2 per 1M tokens</li>
                  <li>Email support</li>
                  <li>Usage analytics</li>
                  <li>Higher concurrency</li>
                </ul>
                <button className="btn-pricing primary">Start Trial</button>
              </div>
              <div className="pricing-card">
                <span className="badge">Enterprise</span>
                <h3>Custom</h3>
                <p className="price">Contact sales</p>
                <ul>
                  <li>Unlimited requests</li>
                  <li>Rp 2 per 1M tokens (volume discount available)</li>
                  <li>Dedicated support</li>
                  <li>Custom SLAs</li>
                </ul>
                <button className="btn-pricing">Contact Sales</button>
              </div>
            </div>

            <div className="pricing-details">
              <h3>Token Pricing</h3>
              <p>API cost is transparent and designed for both experimentation and production.</p>
              <div className="pricing-table-wrap">
                <table className="pricing-table">
                  <thead>
                    <tr>
                      <th>Plan</th>
                      <th>Monthly quota</th>
                      <th>Additional token cost</th>
                      <th>Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Free</td>
                      <td>10K requests</td>
                      <td>Rp 2.000 / 1M tokens</td>
                      <td>Community</td>
                    </tr>
                    <tr>
                      <td>Pro</td>
                      <td>1M requests</td>
                      <td>Rp 2.000 / 1M tokens</td>
                      <td>Email</td>
                    </tr>
                    <tr>
                      <td>Enterprise</td>
                      <td>Custom limits</td>
                      <td>Negotiated</td>
                      <td>24/7 Premium</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {currentPage === 'dashboard' && (
          <div className="dashboard-page">
            <div className="dashboard-hero">
              <div className="dashboard-hero-copy">
                <span className="eyebrow">API Control Center</span>
                <h2>Modern API Dashboard</h2>
                <p>Manage your Deepernova API keys, monitor usage, and keep every integration secure with a polished control panel built for fast decisions.</p>
              </div>
              <div className="dashboard-hero-actions">
                <button className="btn-primary" onClick={() => setShowCreateKeyModal(true)} disabled={loading}>Create New Key</button>
                <button className="btn-secondary" onClick={() => fetchApiKeys()} disabled={loading}>Refresh Data</button>
              </div>
            </div>

            {errorMsg && <div className="error-message">⚠️ {errorMsg}</div>}

            <div className="dashboard-metrics-grid">
              <div className="metric-card">
                <h4>Total API Keys</h4>
                <p className="metric-value">{totalKeys}</p>
                <span className="metric-label">Keys available for your projects</span>
              </div>
              <div className="metric-card">
                <h4>Active Keys</h4>
                <p className="metric-value">{activeKeys}</p>
                <span className="metric-label">Live credentials in use</span>
              </div>
              <div className="metric-card">
                <h4>Total Requests</h4>
                <p className="metric-value">{totalRequests.toLocaleString()}</p>
                <span className="metric-label">Calls processed this period</span>
              </div>
              <div className="metric-card">
                <h4>Token Spend</h4>
                <p className="metric-value">${totalCost}</p>
                <span className="metric-label">Estimated billing impact</span>
              </div>
            </div>

            <div className="dashboard-main-grid">
              <section className="dashboard-section dashboard-panel">
                <div className="section-header">
                  <div>
                    <h3>API Keys</h3>
                    <p className="section-subtitle">Securely manage keys and permissions in one place.</p>
                  </div>
                  <button className="btn-primary" onClick={() => setShowCreateKeyModal(true)} disabled={loading}>+ Create Key</button>
                </div>

                {loading ? (
                  <p>Loading...</p>
                ) : apiKeys.length === 0 ? (
                  <div className="empty-state-card">
                    <h4>No API keys yet</h4>
                    <p>Generate your first key to start integrating Deepernova services immediately.</p>
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
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apiKeys.map((key) => (
                          <tr key={key.id}>
                            <td className="key-name">{key.name}</td>
                            <td className="key-value"><code>{key.key}</code></td>
                            <td>{new Date(key.createdAt).toLocaleDateString()}</td>
                            <td><span className={`status-badge ${key.isActive ? 'active' : 'inactive'}`}>{key.isActive ? 'Active' : 'Inactive'}</span></td>
                            <td className="key-actions">
                              <button className="btn-small btn-view" onClick={() => viewFullKey(key.id)}>View</button>
                              <button className="btn-small btn-toggle" onClick={() => updateApiKey(key.id, { isActive: !key.isActive })}>{key.isActive ? 'Disable' : 'Enable'}</button>
                              <button className="btn-small btn-delete" onClick={() => deleteApiKey(key.id)}>Delete</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              <section className="dashboard-section dashboard-panel dashboard-insights">
                <div className="insights-card">
                  <div className="insights-header">
                    <div>
                      <h4>Usage Trend</h4>
                      <p>Quick glance at recent API activity.</p>
                    </div>
                    <span className="badge">Live</span>
                  </div>
                  <div className="chart-placeholder">Chart preview coming soon</div>
                </div>

                <div className="insights-card recent-activity">
                  <div className="insights-header">
                    <div>
                      <h4>Quick Insights</h4>
                      <p>Essential information for secure operation.</p>
                    </div>
                  </div>
                  <ul className="stat-list">
                    <li className="stat-list-item"><span>Active key ratio</span><strong>{totalKeys ? `${Math.round((activeKeys / totalKeys) * 100)}%` : '0%'}</strong></li>
                    <li className="stat-list-item"><span>Recent refresh</span><strong>just now</strong></li>
                    <li className="stat-list-item"><span>Recommended action</span><strong>Rotate inactive keys regularly.</strong></li>
                  </ul>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>

      {showCreateKeyModal && (
        <div className="modal-overlay" onClick={() => setShowCreateKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Create New API Key</h3>
            <div className="form-group">
              <label htmlFor="key-name">API Key Name</label>
              <input id="key-name" type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Production Key" className="form-input" />
            </div>
            {errorMsg && <div className="error-message">⚠️ {errorMsg}</div>}
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => { setShowCreateKeyModal(false); setNewKeyName(''); setErrorMsg(''); }}>Cancel</button>
              <button className="btn-primary" onClick={createNewApiKey} disabled={loading || !newKeyName.trim()}>{loading ? 'Creating...' : 'Create Key'}</button>
            </div>
          </div>
        </div>
      )}

      {showApiKeyModal && createdKey && (
        <div className="modal-overlay" onClick={() => setShowApiKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>🎉 Your API Key is Ready!</h3>
            <p>Save it now - you won't see it again.</p>
            <div className="modal-key-display">
              <code>{createdKey.key}</code>
              <button onClick={() => copyToClipboard(createdKey.key, 'modal-key')}>{copiedText === 'modal-key' ? '✓ Copied' : 'Copy'}</button>
            </div>
            <p className="modal-warning">⚠️ Keep it secret!</p>
            <button className="btn-primary modal-btn" onClick={() => { setShowApiKeyModal(false); setCreatedKey(null); setCurrentPage('dashboard'); }}>Go to Dashboard</button>
          </div>
        </div>
      )}

      {showFullKeyModal && selectedKeyFull && (
        <div className="modal-overlay" onClick={() => setShowFullKeyModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Your API Key</h3>
            <div className="modal-key-display">
              <code>{selectedKeyFull}</code>
              <button onClick={() => copyToClipboard(selectedKeyFull, 'full-key')}>{copiedText === 'full-key' ? '✓ Copied' : 'Copy'}</button>
            </div>
            <button className="btn-primary modal-btn" onClick={() => setShowFullKeyModal(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiMarketplace;
