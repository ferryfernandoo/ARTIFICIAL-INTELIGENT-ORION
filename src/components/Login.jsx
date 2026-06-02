import React, { useEffect, useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import './Login.css';

const Login = ({ onLoginSuccess, onGuestLogin, onSignupSuccess }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [_errorState, setError] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  useEffect(() => {
    const parseResponse = async (response) => {
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        return JSON.parse(text);
      }
      throw new Error(text || `Unexpected response type: ${contentType}`);
    };

    const checkAuth = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_BASE_URL || '/api';
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status !== 401) {
            const data = await parseResponse(response);
            throw new Error(data.error || 'Failed to check authentication');
          }
          setUser(null);
        } else {
          const data = await parseResponse(response);
          if (data.authenticated) {
            setUser(data.user);
            onLoginSuccess?.(data.user);
          } else if (data.guest) {
            setUser(data.user);
            onGuestLogin?.(data.user);
          } else {
            setUser(null);
          }
        }
      } catch (err) {
        console.error('Auth check error:', err);
        setError(err.message || 'Failed to check authentication');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [onLoginSuccess, onGuestLogin]);

  const handleGuestLogin = async () => {
    try {
      setError(null);
      const guestUser = { 
        name: 'Guest', 
        email: 'guest@deepernova.com', 
        guest: true 
      };
      localStorage.setItem('guestSession', JSON.stringify(guestUser));
      onGuestLogin?.(guestUser);
    } catch (err) {
      console.error('Guest login error:', err);
      setError(err.message || 'Guest login failed');
    }
  };

  const handleLogout = async () => {
    try {
      localStorage.removeItem('guestSession');
      localStorage.removeItem('authUser');
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      setUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  if (loading) {
    return (
      <div className="login-container">
        <div className="login-box">
          <h2>Orion AI</h2>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="login-container">
        <div className="login-box user-info">
          {user.picture && <img src={user.picture} alt={user.name} className="user-avatar" />}
          <h2>Selamat datang! 👋</h2>
          <p className="user-name">{user.name}</p>
          <p className="user-email">{user.email}</p>
          {user.guest && <p className="guest-note">Anda sedang menggunakan mode Guest.</p>}
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {authMode === 'login' ? (
        <LoginForm 
          onLoginSuccess={onLoginSuccess}
          onGuestLogin={handleGuestLogin}
          onSwitchToRegister={() => setAuthMode('register')}
        />
      ) : (
        <RegisterForm 
          onRegisterSuccess={onSignupSuccess}
          onSwitchToLogin={() => setAuthMode('login')}
        />
      )}
    </>
  );
};

export default Login;
