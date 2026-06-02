import React, { useState } from 'react';
import './AuthForms.css';

const RegisterForm = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Nama harus diisi');
      return false;
    }
    if (formData.name.trim().length < 3) {
      setError('Nama minimal 3 karakter');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email harus diisi');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Email tidak valid');
      return false;
    }
    // Enforce @deepmail.com domain for all accounts
    if (!formData.email.toLowerCase().endsWith('@deepmail.com')) {
      setError('Email harus menggunakan domain @deepmail.com (contoh: user@deepmail.com)');
      return false;
    }
    if (!formData.password) {
      setError('Password harus diisi');
      return false;
    }
    if (formData.password.length < 8) {
      setError('Password minimal 8 karakter');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Password tidak cocok');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
      const response = await fetch(`${apiUrl}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.toLowerCase().trim(),
          password: formData.password
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registrasi gagal');
      }

      setFormData({ name: '', email: '', password: '', confirmPassword: '' });
      onRegisterSuccess?.(data.user);
    } catch (err) {
      console.error('Register error:', err);
      setError(err.message || 'Registrasi gagal. Coba lagi nanti.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h1>🚀 Orion AI</h1>
        <p className="auth-subtitle">Buat akun baru</p>

        {error && <div className="error-message">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group name-field-group">
            <label className="name-field-label">👋 Siapa nama kamu?</label>
            <p className="name-field-description">Supaya Orion bisa manggil kamu dengan benar</p>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Contoh: Nando"
              autoComplete="name"
              disabled={loading}
              className="name-field-input"
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
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
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="Min 8 karakter"
                autoComplete="new-password"
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
            {formData.password && (
              <div className="password-strength">
                <div className={`strength-bar ${
                  formData.password.length < 8 ? 'weak' :
                  formData.password.length < 12 ? 'medium' :
                  'strong'
                }`}></div>
                <span className="strength-text">
                  {formData.password.length < 8 ? 'Lemah' :
                   formData.password.length < 12 ? 'Sedang' :
                   'Kuat'}
                </span>
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Konfirmasi Password</label>
            <div className="password-input-wrapper">
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="Ulangi password"
                autoComplete="new-password"
                disabled={loading}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowConfirm(!showConfirm)}
                disabled={loading}
              >
                {showConfirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
            {formData.confirmPassword && (
              <span className={`password-match ${
                formData.password === formData.confirmPassword ? 'match' : 'no-match'
              }`}>
                {formData.password === formData.confirmPassword 
                  ? '✓ Password cocok' 
                  : '✗ Password tidak cocok'}
              </span>
            )}
          </div>

          <button 
            className="auth-submit-btn" 
            type="submit" 
            disabled={loading}
          >
            {loading ? 'Membuat akun...' : 'Daftar'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Sudah punya akun?</p>
          <button 
            className="switch-auth-btn" 
            onClick={onSwitchToLogin}
            disabled={loading}
          >
            Login sekarang
          </button>
        </div>

        <div className="auth-terms">
          <p>Dengan mendaftar, Anda setuju dengan</p>
          <p>Syarat dan Ketentuan kami</p>
        </div>
      </div>
    </div>
  );
};

export default RegisterForm;
