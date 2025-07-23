import React, { useState, useEffect } from 'react';
import './Login.css';

interface LoginProps {
  onLogin: (token: string, user: any) => void;
}

// Cookie helper functions
const setCookie = (name: string, value: string, days: number = 30) => {
  const expires = new Date();
  expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
  document.cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
};

const getCookie = (name: string): string => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return '';
};

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [tenantId, setTenantId] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load saved values from cookies on component mount
  useEffect(() => {
    const savedTenantId = getCookie('tenantId');
    const savedUsername = getCookie('username');
    
    if (savedTenantId) {
      setTenantId(savedTenantId);
    }
    if (savedUsername) {
      setUsername(savedUsername);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login with:', { username, tenantId });
      
      const apiUrl = process.env.REACT_APP_API_URL || '';
      const loginUrl = apiUrl ? `${apiUrl}/api/auth/login` : '/api/auth/login';
      
      const response = await fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: username,
          password,
          tenant_id: tenantId
        }),
      });

      console.log('Login response status:', response.status);
      const data = await response.json();
      console.log('Login response data:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token in localStorage
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Save tenant ID and username to cookies for future visits
      setCookie('tenantId', tenantId, 30); // Save for 30 days
      setCookie('username', username, 30); // Save for 30 days

      console.log('Calling onLogin with:', data.access_token, data.user);
      onLogin(data.access_token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h2>🛠️ VisualizeHR Admin Login</h2>
          <p>Secure access to agentic AI orchestration</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="tenantId">Tenant ID</label>
            <input
              id="tenantId"
              type="text"
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              placeholder="Enter your tenant ID"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={loading}
            />
          </div>

          {error && (
            <div className="error-message">
              ❌ {error}
            </div>
          )}

          <button
            type="submit"
            className="login-button"
            disabled={loading}
          >
            {loading ? (
              <span>
                <span className="spinner"></span>
                Authenticating...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>🔒 Multi-tenant secure authentication</p>
          <p>💡 Tenant ID and username are saved for convenience</p>
          <p>🏢 Test tenants: demo, enterprise, startup</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
