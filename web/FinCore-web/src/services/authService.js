import axios from 'axios';

const API_BASE_URL = '/api/auth';
const DEVICES_API_URL = '/api/devices';

// Axios Request Interceptor for JWT Bearer Token
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getOrGenerateDeviceFingerprint = () => {
  let fp = localStorage.getItem('device_fingerprint');
  if (!fp) {
    const ua = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
    const screenRes = typeof window !== 'undefined' && window.screen ? `${window.screen.width}x${window.screen.height}` : '1920x1080';
    const platform = typeof navigator !== 'undefined' ? (navigator.platform || 'Web') : 'Web';
    const lang = typeof navigator !== 'undefined' ? (navigator.language || 'en') : 'en';

    let hash = 0;
    const rawSeed = `${platform}-${screenRes}-${lang}-${ua}`;
    for (let i = 0; i < rawSeed.length; i++) {
      hash = ((hash << 5) - hash) + rawSeed.charCodeAt(i);
      hash |= 0;
    }
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    fp = `web-fp-${hexHash}`;
    localStorage.setItem('device_fingerprint', fp);
  }
  return fp;
};

export const parseJwt = (token) => {
  if (!token) return null;
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to parse JWT:', e);
    return null;
  }
};

export const verifyDevice = async (userId, deviceFingerprint, ipAddress = '127.0.0.1') => {
  try {
    const token = getToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const response = await axios.post(`${DEVICES_API_URL}/verify`, {
      userId: parseInt(userId, 10),
      deviceFingerprint,
      ipAddress,
    }, { headers });
    return response.data;
  } catch (err) {
    console.warn('Device verification warning:', err);
    return null;
  }
};

export const login = async (identifier, password) => {
  const response = await axios.post(`${API_BASE_URL}/login`, {
    email: identifier.trim(),
    password,
  });

  const data = response.data;
  if (data?.token) {
    localStorage.setItem('jwt_token', data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('fincore_token', data.token);

    const claims = parseJwt(data.token);
    const resolvedRole = data.user?.role || claims?.role || claims?.Role || 'Analyst';
    const userObj = {
      id: data.user?.id || claims?.sub || claims?.UserId,
      fullName: data.user?.fullName || claims?.name || claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] || identifier,
      email: data.user?.email || claims?.email || claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'],
      role: resolvedRole,
      employeeId: data.user?.employeeId || claims?.employeeId || '',
      department: data.user?.department || claims?.department || '',
    };

    localStorage.setItem('fincore_user', JSON.stringify(userObj));

    const rawUserId = userObj.id || 1;
    const numericUserId = parseInt(rawUserId, 10) || Math.abs(String(rawUserId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0));
    const deviceFingerprint = getOrGenerateDeviceFingerprint();

    try {
      const verification = await verifyDevice(numericUserId, deviceFingerprint);
      data.deviceVerification = verification;
    } catch (err) {
      console.error('Device verification error:', err);
    }

    data.user = userObj;
  }

  return data;
};

export const register = async (staffData) => {
  const response = await axios.post(`${API_BASE_URL}/register`, {
    fullName: staffData.fullName,
    name: staffData.fullName,
    email: staffData.email.trim(),
    password: staffData.password,
    confirmPassword: staffData.confirmPassword,
    role: staffData.role || 'Analyst',
    employeeId: staffData.employeeId?.trim(),
    department: staffData.department,
    phoneNumber: staffData.phoneNumber,
  });

  const data = response.data;
  if (data?.token) {
    localStorage.setItem('jwt_token', data.token);
    localStorage.setItem('token', data.token);
    localStorage.setItem('fincore_token', data.token);
    if (data.user) {
      localStorage.setItem('fincore_user', JSON.stringify(data.user));
    }
  }

  return data;
};

export const getToken = () => {
  return localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
};

export const getCurrentUser = () => {
  try {
    const raw = localStorage.getItem('fincore_user');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const logout = () => {
  localStorage.removeItem('jwt_token');
  localStorage.removeItem('token');
  localStorage.removeItem('fincore_token');
  localStorage.removeItem('fincore_user');
};

export const getUserRole = () => {
  const user = getCurrentUser();
  if (user?.role) return user.role;
  const token = getToken();
  if (!token) return null;
  const claims = parseJwt(token);
  return claims?.role || claims?.Role || null;
};
