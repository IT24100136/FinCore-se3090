import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getToken,
  getCurrentUser,
  parseJwt,
} from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage on load
  useEffect(() => {
    try {
      const storedToken = getToken();
      const storedUser = getCurrentUser();

      if (storedToken) {
        const claims = parseJwt(storedToken);
        const isExpired = claims?.exp && claims.exp * 1000 < Date.now();

        if (isExpired) {
          apiLogout();
          setUser(null);
          setToken(null);
        } else {
          setToken(storedToken);
          setUser(
            storedUser || {
              id: claims?.sub || claims?.UserId,
              fullName: claims?.name || claims?.email || 'Staff Member',
              email: claims?.email,
              role: claims?.role || claims?.Role || 'Analyst',
              employeeId: claims?.employeeId || '',
              department: claims?.department || '',
            }
          );
        }
      }
    } catch (e) {
      console.error('Error restoring auth session:', e);
      apiLogout();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = async (identifier, password) => {
    const res = await apiLogin(identifier, password);
    if (res?.token) {
      setToken(res.token);
      setUser(res.user);
    }
    return res;
  };

  const register = async (staffPayload) => {
    const res = await apiRegister(staffPayload);
    if (res?.token) {
      setToken(res.token);
      setUser(res.user);
    }
    return res;
  };

  const logout = () => {
    apiLogout();
    setToken(null);
    setUser(null);
  };

  const hasRole = (allowedRoles) => {
    if (!user || !user.role) return false;
    if (Array.isArray(allowedRoles)) {
      return allowedRoles.some((r) => r.toLowerCase() === user.role.toLowerCase());
    }
    return user.role.toLowerCase() === allowedRoles.toLowerCase();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        role: user?.role || null,
        login,
        register,
        logout,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
