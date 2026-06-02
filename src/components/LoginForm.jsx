import React, { useState } from 'react';
import './AuthForms.css';

const LoginForm = ({ onLoginSuccess, onSwitchToRegister, onGuestLogin }) => {
  const [email, setEmail] = useState('tulis@deepmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [errorType, setErrorType] = useState(null); // 'user-not-found', 'wrong-password', 'validation', 'network'
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setErrorType(null);

    if (!email.trim()) {
      setError('Email harus diisi');
      setErrorType('validation');
      return;
    }
    // Enforce @deepmail.com domain for all accounts
    if (!email.toLowerCase().endsWith('@deepmail.com')) {
      setError('Email harus menggunakan domain @deepmail.com (contoh: user@deepmail.com)');
      setErrorType('validation');
      return;
    }
    if (!password) {
      setError('Password harus diisi');
      setErrorType('validation');
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          email: email.toLowerCase().trim(), 
          password 
        })
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error types from backend
        if (data.message === 'Username tidak ditemukan') {
          setError(`❌ Username tidak ditemukan. Email "${email}" belum terdaftar.`);
          setErrorType('user-not-found');
        } else if (data.message === 'Password salah') {
          setError('🔐 Password salah. Silakan cek kembali password Anda.');
          setErrorType('wrong-password');
        } else {
          setError(`❌ ${data.error || data.message || 'Login gagal'}`);
          setErrorType('network');
        }
        throw new Error(data.error || data.message || 'Login gagal');
      }

      setEmail('');
      setPassword('');
      onLoginSuccess?.(data.user);
    } catch (err) {
      console.error('Login error:', err);
      // Error message already set above
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🚀 Orion AI</h1>
        <p className="auth-subtitle">Login ke akun Anda</p>

        {error && <div className={`error-message ${errorType || ''}`}>{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@deepmail.com"
              autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button 
            className="auth-submit-btn" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="auth-divider">atau</div>

        <button className="guest-btn" onClick={onGuestLogin} disabled={loading}>
          Masuk sebagai Guest
        </button>

        <div className="auth-footer">
          <p>Belum punya akun?</p>
          <button 
            className="switch-auth-btn" 
            onClick={onSwitchToRegister}
            disabled={loading}
          >
            Daftar sekarang
          </button>
        </div>

        <div className="auth-features">
          <p className="features-title">Keuntungan login:</p>
          <ul>
            <li>💾 Simpan riwayat chat</li>
            <li>⚡ Akses di berbagai perangkat</li>
            <li>📝 Kelola session</li>
            <li>🔒 Data aman</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
