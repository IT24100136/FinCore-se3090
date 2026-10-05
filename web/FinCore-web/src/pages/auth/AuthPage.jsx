import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Shield,
  Lock,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Briefcase,
  IdCard,
  Building,
  Phone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Cpu,
  UserCheck,
  ShieldCheck,
} from 'lucide-react';

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated, user } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Login form state
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    role: 'Fraud Analyst', // 'Fraud Analyst' | 'System Admin'
    employeeId: 'ANL-',
    department: 'Fraud Operations & Investigation',
    password: '',
    confirmPassword: '',
  });

  // Redirect if already authenticated
  React.useEffect(() => {
    if (isAuthenticated && user) {
      const redirectPath = user.role?.toLowerCase() === 'admin' ? '/admin/dashboard' : '/analyst/review-queue';
      navigate(location.state?.from?.pathname || redirectPath, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  // Handle Role Change in Registration to set badge prefix
  const handleRoleChange = (selectedRole) => {
    const defaultPrefix = selectedRole === 'System Admin' ? 'ADM-' : 'ANL-';
    const currentId = formData.employeeId;
    let newId = currentId;

    if (!currentId || currentId === 'ANL-' || currentId === 'ADM-') {
      newId = defaultPrefix;
    } else if (currentId.startsWith('ANL-') && selectedRole === 'System Admin') {
      newId = 'ADM-' + currentId.substring(4);
    } else if (currentId.startsWith('ADM-') && selectedRole === 'Fraud Analyst') {
      newId = 'ANL-' + currentId.substring(4);
    }

    const defaultDept = selectedRole === 'System Admin'
      ? 'System & Infrastructure Administration'
      : 'Fraud Operations & Investigation';

    setFormData((prev) => ({
      ...prev,
      role: selectedRole,
      employeeId: newId,
      department: defaultDept,
    }));
  };

  // Password Policy Checks
  const pass = formData.password;
  const passwordChecks = {
    length: pass.length >= 8,
    hasUpper: /[A-Z]/.test(pass),
    hasNumber: /[0-9]/.test(pass),
    hasSpecial: /[^A-Za-z0-9]/.test(pass),
    match: pass && pass === formData.confirmPassword,
  };

  // Fast demo credentials auto-fill
  const fillDemoCredentials = (role) => {
    setMode('login');
    setErrorMessage('');
    if (role === 'Analyst') {
      setLoginIdentifier('ANL-001');
      setLoginPassword('Password123!');
    } else if (role === 'Admin') {
      setLoginIdentifier('ADM-001');
      setLoginPassword('AdminPassword123!');
    }
  };

  // Submit Login
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!loginIdentifier.trim() || !loginPassword) {
      setErrorMessage('Please enter your Corporate Email or Staff Badge ID and password.');
      return;
    }

    setLoading(true);
    try {
      const res = await login(loginIdentifier.trim(), loginPassword);
      setSuccessMessage('Authentication verified! Redirecting to secure workspace...');

      const targetRole = res?.user?.role || 'Analyst';
      const targetPath = targetRole.toLowerCase() === 'admin' ? '/admin/dashboard' : '/analyst/review-queue';

      setTimeout(() => {
        navigate(location.state?.from?.pathname || targetPath, { replace: true });
      }, 600);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Authentication failed. Please verify credentials.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  // Submit Register
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    // Client-side validations
    if (!formData.fullName.trim()) {
      setErrorMessage('Full Legal / Staff Name is required.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Corporate Email is required.');
      return;
    }
    if (!formData.employeeId.trim() || formData.employeeId === 'ANL-' || formData.employeeId === 'ADM-') {
      setErrorMessage('A valid Employee Badge ID (e.g. ANL-001 or ADM-001) is required.');
      return;
    }
    if (!passwordChecks.length || !passwordChecks.hasUpper || !passwordChecks.hasNumber || !passwordChecks.hasSpecial) {
      setErrorMessage('Password must satisfy all institutional complexity requirements.');
      return;
    }
    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await register(formData);
      setSuccessMessage(`Account registered for ${res.user?.fullName}! Redirecting to workspace...`);

      const targetRole = res?.user?.role || formData.role;
      const targetPath = targetRole.toLowerCase().includes('admin') ? '/admin/dashboard' : '/analyst/review-queue';

      setTimeout(() => {
        navigate(targetPath, { replace: true });
      }, 800);
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed. Please check your inputs.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#070b13',
      color: '#f8fafc',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      backgroundImage: 'radial-gradient(ellipse at 15% 20%, rgba(99, 102, 241, 0.12) 0%, transparent 50%), radial-gradient(ellipse at 85% 80%, rgba(6, 182, 212, 0.10) 0%, transparent 50%)',
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif"
    }}>
      <div style={{
        maxWidth: '1100px',
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '2.5rem',
        alignItems: 'center'
      }}>
        {/* Left Column: Institutional Brand & Telemetry */}
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0.9rem', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', borderRadius: '9999px', marginBottom: '1.5rem' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 8px #10b981' }} />
            <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#c7d2fe', letterSpacing: '0.05em' }}>
              FinCore Institutional Gateway v3.4
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
            <div style={{
              width: '54px',
              height: '54px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)'
            }}>
              <Shield size={32} color="#ffffff" />
            </div>
            <div>
              <h1 style={{ fontSize: '2.2rem', fontWeight: '800', margin: 0, letterSpacing: '-0.02em', background: 'linear-gradient(to right, #ffffff, #cbd5e1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                FinCore
              </h1>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#818cf8', fontWeight: '600' }}>
                Fraud Prevention & Compliance Intelligence
              </p>
            </div>
          </div>

          <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
            Unified authentication portal for Financial Crime Compliance officers, Fraud Operations analysts, and System Administrators.
          </p>

          {/* Compliance & AI Architecture Chips */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.85rem', marginBottom: '2.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', backgroundColor: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <Cpu size={20} color="#38bdf8" />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#f1f5f9' }}>Multi-Agent Risk Pipeline</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Cooperative LangGraph nodes with dynamic SHAP explainability</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', padding: '0.85rem 1rem', backgroundColor: 'rgba(15, 23, 42, 0.7)', border: '1px solid #1e293b', borderRadius: '12px' }}>
              <ShieldCheck size={20} color="#34d399" />
              <div>
                <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#f1f5f9' }}>Dual Maker-Checker Governance</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Mandatory dual authorization for transactions ≥ 75,000 LKR</div>
              </div>
            </div>
          </div>

          {/* Fast Demo Accounts Helper */}
          <div style={{ padding: '1.25rem', backgroundColor: 'rgba(30, 41, 59, 0.5)', border: '1px dashed #334155', borderRadius: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <Sparkles size={16} color="#fbbf24" />
              <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc' }}>
                Quick Evaluation Credentials
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={() => fillDemoCredentials('Analyst')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#34d399',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ⚡ Fill Fraud Analyst (ANL-001)
              </button>
              <button
                type="button"
                onClick={() => fillDemoCredentials('Admin')}
                style={{
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.78rem',
                  fontWeight: '600',
                  color: '#818cf8',
                  backgroundColor: 'rgba(99, 102, 241, 0.12)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ⚡ Fill System Admin (ADM-001)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Unified Form Card */}
        <div style={{
          backgroundColor: '#0d131f',
          border: '1px solid rgba(51, 65, 85, 0.7)',
          borderRadius: '20px',
          padding: '2.5rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(20px)',
          position: 'relative'
        }}>
          {/* Segmented Mode Selector */}
          <div style={{
            display: 'flex',
            backgroundColor: '#090d16',
            borderRadius: '12px',
            padding: '4px',
            marginBottom: '2rem',
            border: '1px solid #1e293b'
          }}>
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'login' ? '#1e293b' : 'transparent',
                color: mode === 'login' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <Lock size={15} />
              Staff Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('register'); setErrorMessage(''); }}
              style={{
                flex: 1,
                padding: '0.65rem 1rem',
                fontSize: '0.9rem',
                fontWeight: '600',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: mode === 'register' ? '#1e293b' : 'transparent',
                color: mode === 'register' ? '#ffffff' : '#64748b',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              <IdCard size={15} />
              Staff Onboarding
            </button>
          </div>

          {/* Feedback Alerts */}
          {errorMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: '10px',
              color: '#fca5a5',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              animation: 'fadeIn 0.3s'
            }}>
              <AlertTriangle size={18} color="#ef4444" style={{ flexShrink: 0 }} />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.85rem 1rem',
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              borderRadius: '10px',
              color: '#6ee7b7',
              fontSize: '0.88rem',
              marginBottom: '1.5rem',
              animation: 'fadeIn 0.3s'
            }}>
              <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
              <div>{successMessage}</div>
            </div>
          )}

          {/* ── MODE 1: LOGIN FORM ────────────────────────────────────────── */}
          {mode === 'login' ? (
            <form onSubmit={handleLoginSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                  Corporate Email or Staff Badge ID
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <Mail size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    placeholder="e.g. diluni.silva@fincore.internal or ANL-001"
                    value={loginIdentifier}
                    onChange={(e) => setLoginIdentifier(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem 0.8rem 2.5rem',
                      backgroundColor: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#1e293b')}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.45rem' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <KeyRound size={18} />
                  </span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.8rem 2.8rem 0.8rem 2.5rem',
                      backgroundColor: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '10px',
                      color: '#f8fafc',
                      fontSize: '0.92rem',
                      outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => (e.target.style.borderColor = '#6366f1')}
                    onBlur={(e) => (e.target.style.borderColor = '#1e293b')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  boxShadow: '0 10px 20px -5px rgba(79, 70, 229, 0.4)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {loading ? 'Authenticating...' : (
                  <>
                    Sign In to Console
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                Need credentials or new department clearance?{' '}
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  style={{ background: 'none', border: 'none', color: '#38bdf8', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                >
                  Onboard here
                </button>
              </div>
            </form>
          ) : (
            /* ── MODE 2: COMPREHENSIVE STAFF REGISTRATION ───────────────────── */
            <form onSubmit={handleRegisterSubmit}>
              {/* Role Selection Cards */}
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.5rem' }}>
                  Institutional Role & Clearance Level
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => handleRoleChange('Fraud Analyst')}
                    style={{
                      padding: '0.85rem',
                      textAlign: 'left',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: formData.role === 'Fraud Analyst' ? '1px solid #10b981' : '1px solid #1e293b',
                      backgroundColor: formData.role === 'Fraud Analyst' ? 'rgba(16, 185, 129, 0.08)' : '#090d16',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <UserCheck size={16} color={formData.role === 'Fraud Analyst' ? '#10b981' : '#64748b'} />
                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: formData.role === 'Fraud Analyst' ? '#34d399' : '#cbd5e1' }}>
                        Fraud Analyst
                      </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                      Review queue & case investigation
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRoleChange('System Admin')}
                    style={{
                      padding: '0.85rem',
                      textAlign: 'left',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      border: formData.role === 'System Admin' ? '1px solid #6366f1' : '1px solid #1e293b',
                      backgroundColor: formData.role === 'System Admin' ? 'rgba(99, 102, 241, 0.08)' : '#090d16',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <Shield size={16} color={formData.role === 'System Admin' ? '#818cf8' : '#64748b'} />
                      <span style={{ fontSize: '0.9rem', fontWeight: '700', color: formData.role === 'System Admin' ? '#818cf8' : '#cbd5e1' }}>
                        System Admin
                      </span>
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748b' }}>
                      System-wide metrics, rules & reversals
                    </div>
                  </button>
                </div>
              </div>

              {/* Full Name & Phone Number */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Full Legal Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                      <User size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Diluni Silva"
                      value={formData.fullName}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.8rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Contact Phone Number
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                      <Phone size={16} />
                    </span>
                    <input
                      type="tel"
                      placeholder="+94 77 123 4567"
                      value={formData.phoneNumber}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.8rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Corporate Email */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1' }}>
                    Corporate Email
                  </label>
                  <span style={{ fontSize: '0.72rem', color: '#38bdf8' }}>Domain: @fincore.internal</span>
                </div>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                    <Mail size={16} />
                  </span>
                  <input
                    type="email"
                    required
                    placeholder="username@fincore.internal"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '0.75rem 0.8rem 0.75rem 2.2rem',
                      backgroundColor: '#090d16',
                      border: '1px solid #1e293b',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.88rem',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              {/* Employee ID & Department */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Staff Badge ID
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                      <IdCard size={16} />
                    </span>
                    <input
                      type="text"
                      required
                      placeholder={formData.role === 'System Admin' ? 'ADM-001' : 'ANL-001'}
                      value={formData.employeeId}
                      onChange={(e) => setFormData({ ...formData, employeeId: e.target.value.toUpperCase() })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.8rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontFamily: 'monospace',
                        fontWeight: 'bold',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Department / Unit
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b', pointerEvents: 'none' }}>
                      <Building size={16} />
                    </span>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 0.8rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.85rem',
                        outline: 'none',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="Fraud Operations & Investigation">Fraud Operations</option>
                      <option value="Financial Crime Compliance">Financial Crime Compliance</option>
                      <option value="System & Infrastructure Administration">System Administration</option>
                      <option value="Risk Analytics & Modeling">Risk Analytics</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                      <Lock size={16} />
                    </span>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 2.4rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', color: '#cbd5e1', marginBottom: '0.4rem' }}>
                    Confirm Password
                  </label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }}>
                      <Lock size={16} />
                    </span>
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.75rem 2.4rem 0.75rem 2.2rem',
                        backgroundColor: '#090d16',
                        border: '1px solid #1e293b',
                        borderRadius: '8px',
                        color: '#f8fafc',
                        fontSize: '0.88rem',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Password Complexity Checklist */}
              <div style={{
                padding: '0.75rem 0.9rem',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '0.45rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: passwordChecks.length ? '#10b981' : '#64748b' }}>
                  {passwordChecks.length ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#64748b" />}
                  <span>8+ Characters</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: passwordChecks.hasUpper ? '#10b981' : '#64748b' }}>
                  {passwordChecks.hasUpper ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#64748b" />}
                  <span>1 Uppercase (A-Z)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: passwordChecks.hasNumber ? '#10b981' : '#64748b' }}>
                  {passwordChecks.hasNumber ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#64748b" />}
                  <span>1 Digit (0-9)</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: passwordChecks.hasSpecial ? '#10b981' : '#64748b' }}>
                  {passwordChecks.hasSpecial ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#64748b" />}
                  <span>1 Special Symbol</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: passwordChecks.match ? '#10b981' : '#64748b' }}>
                  {passwordChecks.match ? <CheckCircle2 size={13} color="#10b981" /> : <XCircle size={13} color="#64748b" />}
                  <span>Passwords Match</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.85rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#ffffff',
                  fontSize: '0.95rem',
                  fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  boxShadow: '0 10px 20px -5px rgba(16, 185, 129, 0.4)',
                  transition: 'transform 0.15s ease'
                }}
              >
                {loading ? 'Creating Credentials...' : (
                  <>
                    Complete Staff Onboarding
                    <ArrowRight size={18} />
                  </>
                )}
              </button>

              <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.85rem', color: '#64748b' }}>
                Already registered with FinCore?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  style={{ background: 'none', border: 'none', color: '#34d399', fontWeight: '600', cursor: 'pointer', padding: 0 }}
                >
                  Sign in here
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
