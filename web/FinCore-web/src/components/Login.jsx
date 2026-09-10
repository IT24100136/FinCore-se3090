import React, { useState } from 'react';
import { login, register, getToken, logout } from '../services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState(getToken() || '');
  const [message, setMessage] = useState('');
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  const [deviceVerification, setDeviceVerification] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (isRegisterMode) {
        const res = await register(email, password);
        setMessage(res.message || 'Registered successfully! You can now log in.');
        setIsRegisterMode(false);
      } else {
        const res = await login(email, password);
        setToken(res.token);
        if (res.deviceVerification) {
          setDeviceVerification(res.deviceVerification);
        }
        setMessage('Login successful!');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || err.message || 'Authentication error');
    }
  };

  const handleLogout = () => {
    logout();
    setToken('');
    setDeviceVerification(null);
    setMessage('Logged out.');
  };

  return (
    <div style={{ maxWidth: '450px', margin: '20px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
      <h2>{isRegisterMode ? 'Register' : 'Login'}</h2>
      {message && <div style={{ marginBottom: '12px', color: message.includes('successful') || message.includes('Registered') ? 'green' : 'red' }}>{message}</div>}

      {token ? (
        <div>
          <p style={{ color: 'green', fontWeight: 'bold' }}>Authenticated!</p>
          {deviceVerification && (
            <div style={{ padding: '10px', backgroundColor: '#e9ecef', borderRadius: '4px', marginBottom: '12px' }}>
              <strong>Device Verification:</strong>
              <div>Status: <span style={{ fontWeight: 'bold', color: deviceVerification.status === 'Trusted' ? 'green' : deviceVerification.status === 'Verified' ? 'blue' : 'orange' }}>{deviceVerification.status}</span></div>
              <div style={{ fontSize: '12px', color: '#555' }}>Fingerprint: {deviceVerification.deviceFingerprint}</div>
              <div style={{ fontSize: '12px', color: '#555' }}>New Device: {deviceVerification.isNewDevice ? 'Yes' : 'No'}</div>
            </div>
          )}
          <label style={{ fontWeight: 'bold' }}>Grabbed Token:</label>
          <textarea
            readOnly
            rows={4}
            value={token}
            style={{ width: '100%', wordBreak: 'break-all', fontFamily: 'monospace', margin: '8px 0' }}
          />
          <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', marginBottom: '4px' }}>Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {isRegisterMode ? 'Register' : 'Login & Grab Token'}
          </button>
          <div style={{ marginTop: '12px', textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => setIsRegisterMode(!isRegisterMode)}
              style={{ background: 'none', border: 'none', color: '#007bff', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {isRegisterMode ? 'Already have an account? Login' : "Don't have an account? Register"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
