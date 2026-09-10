import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api/auth';
const DEVICES_API_URL = 'http://localhost:5000/api/devices';

export const getOrGenerateDeviceFingerprint = () => {
  let fp = localStorage.getItem('device_fingerprint');
  if (!fp) {
    fp = `web-fp-${Math.random().toString(36).substring(2, 11)}-${Date.now()}`;
    localStorage.setItem('device_fingerprint', fp);
  }
  return fp;
};

export const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

export const verifyDevice = async (userId, deviceFingerprint, ipAddress = '127.0.0.1') => {
  const response = await axios.post(`${DEVICES_API_URL}/verify`, {
    userId: parseInt(userId, 10),
    deviceFingerprint,
    ipAddress,
  });
  return response.data;
};

export const login = async (email, password) => {
  const response = await axios.post(`${API_BASE_URL}/login`, {
    email,
    password,
  });

  const data = response.data;
  if (data?.token) {
    localStorage.setItem('token', data.token);

    // Extract UserId and automatically hit /api/devices/verify
    const claims = parseJwt(data.token);
    const rawUserId = claims?.UserId || claims?.sub || claims?.nameid || 1;
    const userId = parseInt(rawUserId, 10) || 1;

    const deviceFingerprint = getOrGenerateDeviceFingerprint();

    try {
      const verification = await verifyDevice(userId, deviceFingerprint);
      data.deviceVerification = verification;
    } catch (err) {
      console.error('Device verification error:', err);
    }
  }

  return data;
};

export const register = async (email, password, name = '', role = 'Customer') => {
  const response = await axios.post(`${API_BASE_URL}/register`, {
    email,
    password,
    name,
    role,
  });

  return response.data;
};

export const getToken = () => {
  return localStorage.getItem('token');
};

export const logout = () => {
  localStorage.removeItem('token');
};
