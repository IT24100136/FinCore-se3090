import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  RotateCcw,
  Search,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ArrowRight,
  User,
  CreditCard,
  Calendar,
  Lock,
  FileText,
  Clock,
  ExternalLink,
  RefreshCw
} from 'lucide-react';

export default function FinancialReversalsPage() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [searchError, setSearchError] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reversalReason, setReversalReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reversalSuccessResult, setReversalSuccessResult] = useState(null);
  const [actionError, setActionError] = useState(null);

  // Fetch recent completed/fraud-confirmed transactions for quick select
  const fetchRecent = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/transactions/all', { headers });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data.data) ? data.data : [];
        setRecentTransactions(list.slice(0, 10));
      }
    } catch (err) {
      console.error('Error fetching recent transactions:', err);
    }
  };

  useEffect(() => {
    fetchRecent();
  }, []);

  const handleSearch = async (identifier) => {
    const idToSearch = identifier || searchQuery.trim();
    if (!idToSearch) return;

    setLoading(true);
    setSearchError(null);
    setReversalSuccessResult(null);
    setActionError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/transactions/lookup/${encodeURIComponent(idToSearch)}`, { headers });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || `Transaction '${idToSearch}' was not found in core ledger.`);
      }

      const data = await res.json();
      setSelectedTx(data);
    } catch (err) {
      setSelectedTx(null);
      setSearchError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteReversal = async (e) => {
    e.preventDefault();
    if (!selectedTx) return;
    if (!reversalReason.trim()) {
      setActionError('A mandatory reversal reason / compliance justification must be provided.');
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const token = localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const targetId = selectedTx.id || selectedTx.referenceId;
      const res = await fetch(`/api/transactions/${targetId}/reverse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reason: reversalReason.trim(),
          adminId: user?.employeeId || user?.email || 'ADM-LEAD-01'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Ledger reversal failed.');
      }

      // Success! Update selected transaction state
      setReversalSuccessResult(data);
      setSelectedTx(prev => prev ? {
        ...prev,
        status: 'Reversed',
        canReverse: false,
        note: `[REVERSED by Admin] ${reversalReason.trim()}`
      } : null);
      setIsModalOpen(false);
      setReversalReason('');
      fetchRecent();
    } catch (err) {
      setActionError(err.message || 'Failed to execute reversal.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isReversible = selectedTx && (selectedTx.status === 'Completed' || selectedTx.status === 'FraudConfirmed');

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#090d16', color: '#f8fafc', padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Navigation Breadcrumb & Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>
            <span>FINANCIAL CORE & LEDGER</span>
            <span>&gt;</span>
            <span style={{ color: '#38bdf8', fontWeight: 600 }}>FINANCIAL REVERSAL ACTION</span>
            <span style={{
              marginLeft: '8px',
              padding: '2px 8px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '4px',
              fontSize: '11px',
              fontWeight: 700
            }}>
              ADMIN PRIVILEGE ONLY
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171'
                }}>
                  <RotateCcw size={20} />
                </div>
                Financial Ledger Reversal Console
              </h1>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', marginTop: '6px', maxWidth: '780px', lineHeight: 1.5 }}>
                Execute authoritative ledger claw-backs and balance refunds for fraudulent or disputed transactions.
                All reversals atomically debit recipient accounts, credit original sender accounts, generate corresponding
                reversal ledger entries, and record an immutable event in the institutional Audit Log.
              </p>
            </div>

            <button
              onClick={fetchRecent}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: '#1e293b',
                color: '#94a3b8',
                border: '1px solid #334155',
                borderRadius: '8px',
                fontSize: '0.85rem',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={14} /> Refresh Quick List
            </button>
          </div>
        </div>

        {/* Success Alert Banner */}
        {reversalSuccessResult && (
          <div style={{
            marginBottom: '1.5rem',
            padding: '16px 20px',
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <CheckCircle2 size={24} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '1rem', fontWeight: 700, color: '#34d399', marginBottom: '4px' }}>
                Ledger Reversal Successfully Executed & Audited
              </div>
              <div style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5 }}>
                Original Transaction <strong>{reversalSuccessResult.referenceId}</strong> has been set to <strong>Reversed</strong>.
                Claw-back amount of <strong>Rs. {reversalSuccessResult.refundedAmount?.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> has been refunded to sender.
                Core Reversal Transaction Reference: <strong style={{ color: '#38bdf8' }}>{reversalSuccessResult.reversalReferenceId}</strong>.
                Immutable Audit Trail logged under operator <strong>{reversalSuccessResult.reversedBy}</strong>.
              </div>
            </div>
            <button
              onClick={() => setReversalSuccessResult(null)}
              style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '16px' }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Search & Lookup Section */}
        <div style={{
          backgroundColor: '#0f172a',
          borderRadius: '14px',
          border: '1px solid #1e293b',
          padding: '24px',
          marginBottom: '2rem'
        }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#f1f5f9', margin: '0 0 12px 0' }}>
            Lookup Transaction by ID or Reference
          </h2>
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearch(); }}
            style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}
          >
            <div style={{
              flex: 1,
              minWidth: '280px',
              position: 'relative',
              display: 'flex',
              alignItems: 'center'
            }}>
              <Search size={18} color="#64748b" style={{ position: 'absolute', left: '14px' }} />
              <input
                type="text"
                placeholder="Enter Transaction ID (e.g. TXN-1002, TXN-a49b2c..., or numeric ID)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px 12px 42px',
                  backgroundColor: '#070c18',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  color: '#f8fafc',
                  fontSize: '0.9rem',
                  outline: 'none',
                  transition: 'border-color 0.15s ease'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 24px',
                backgroundColor: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '10px',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease'
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <span>Searching...</span>
                </>
              ) : (
                <>
                  <Search size={16} />
                  <span>Lookup Transaction</span>
                </>
              )}
            </button>
          </form>

          {searchError && (
            <div style={{
              marginTop: '16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertTriangle size={16} />
              <span>{searchError}</span>
            </div>
          )}

          {/* Quick Select Chips */}
          {recentTransactions.length > 0 && (
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e293b' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Quick Lookup Recent Core Transactions:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {recentTransactions.map((tx) => (
                  <button
                    key={tx.id || tx.referenceId}
                    type="button"
                    onClick={() => {
                      const idStr = tx.referenceId || tx.id;
                      setSearchQuery(idStr);
                      handleSearch(idStr);
                    }}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: '#1e293b',
                      color: tx.status === 'Reversed' ? '#f87171' : tx.status === 'Completed' ? '#34d399' : '#94a3b8',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      fontFamily: 'monospace',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <span>{tx.id || tx.referenceId}</span>
                    <span style={{ fontSize: '10px', opacity: 0.8 }}>({tx.status})</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Transaction Action Panel */}
        {selectedTx && (
          <div style={{
            backgroundColor: '#0f172a',
            borderRadius: '14px',
            border: '1px solid #1e293b',
            overflow: 'hidden',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.4)'
          }}>
            {/* Header Badge */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#131e36',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600 }}>Ledger Record:</span>
                <span style={{ fontFamily: 'monospace', fontSize: '1rem', fontWeight: 700, color: '#38bdf8' }}>
                  {selectedTx.referenceId || selectedTx.id}
                </span>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: selectedTx.status === 'Reversed'
                    ? 'rgba(239, 68, 68, 0.15)'
                    : selectedTx.status === 'Completed'
                    ? 'rgba(16, 185, 129, 0.15)'
                    : selectedTx.status === 'FraudConfirmed'
                    ? 'rgba(245, 158, 11, 0.15)'
                    : 'rgba(56, 189, 248, 0.15)',
                  color: selectedTx.status === 'Reversed'
                    ? '#f87171'
                    : selectedTx.status === 'Completed'
                    ? '#34d399'
                    : selectedTx.status === 'FraudConfirmed'
                    ? '#fbbf24'
                    : '#38bdf8',
                  border: '1px solid currentColor'
                }}>
                  {selectedTx.status?.toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: '#64748b' }}>
                <Clock size={14} />
                <span>{selectedTx.timestamp ? new Date(selectedTx.timestamp).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            {/* Body Information Grid */}
            <div style={{ padding: '24px' }}>
              {/* Financial Magnitude Banner */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid #334155',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    Authoritative Transfer Amount
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                    Rs. {Number(selectedTx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    <span style={{ fontSize: '1rem', color: '#64748b', fontWeight: 500, marginLeft: '6px' }}>LKR</span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', fontWeight: 600, marginBottom: '4px' }}>
                    AI Risk Evaluation Score
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                    <span style={{
                      fontSize: '1.25rem',
                      fontWeight: 800,
                      color: selectedTx.riskScore >= 70 ? '#f87171' : selectedTx.riskScore >= 50 ? '#fbbf24' : '#34d399'
                    }}>
                      {selectedTx.riskScore || 0}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Sender & Recipient Comparison Columns */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                {/* Sender Wallet/Account Box */}
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                    <CreditCard size={16} /> Original Originating Account (Sender)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Account No: </span>
                      <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{selectedTx.senderAccountNumber || `ACC-${selectedTx.senderWalletId}`}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Account Holder: </span>
                      <strong style={{ color: '#f8fafc' }}>{selectedTx.senderName || 'N/A'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Email: </span>
                      <span style={{ color: '#cbd5e1' }}>{selectedTx.senderEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>

                {/* Recipient Account Box */}
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: '#0a0f1d',
                  border: '1px solid #1e293b'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f59e0b', fontSize: '0.85rem', fontWeight: 700, marginBottom: '12px' }}>
                    <ArrowRight size={16} /> Credited Beneficiary Account (Recipient)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.85rem' }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Account No: </span>
                      <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>{selectedTx.receiverAccountNumber || (selectedTx.receiverWalletId ? `ACC-${selectedTx.receiverWalletId}` : 'External / N/A')}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Beneficiary Name: </span>
                      <strong style={{ color: '#f8fafc' }}>{selectedTx.receiverName || 'Recipient'}</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748b' }}>Email: </span>
                      <span style={{ color: '#cbd5e1' }}>{selectedTx.receiverEmail || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Memo Note */}
              {selectedTx.note && (
                <div style={{
                  padding: '12px 16px',
                  backgroundColor: '#0a0f1d',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  fontSize: '0.85rem',
                  color: '#94a3b8',
                  marginBottom: '24px'
                }}>
                  <span style={{ color: '#64748b', fontWeight: 600 }}>Ledger Note: </span>
                  {selectedTx.note}
                </div>
              )}

              {/* Reversal Eligibility Notice & Action Button */}
              {selectedTx.status === 'Reversed' ? (
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#f87171',
                  fontSize: '0.9rem'
                }}>
                  <ShieldAlert size={20} />
                  <span>This transaction has already been reversed. No duplicate reversals may be executed.</span>
                </div>
              ) : !isReversible ? (
                <div style={{
                  padding: '16px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  color: '#fbbf24',
                  fontSize: '0.9rem'
                }}>
                  <AlertTriangle size={20} />
                  <span>
                    Transaction is currently in status <strong>{selectedTx.status}</strong>.
                    Per FinCore institutional compliance policy, only transactions in <strong>Completed</strong> or <strong>FraudConfirmed</strong> state can be reversed.
                  </span>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '16px',
                  padding: '16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.08)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  borderRadius: '10px'
                }}>
                  <div style={{ maxWidth: '650px' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#f87171', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <AlertTriangle size={18} /> Reversal Action Permitted
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '4px' }}>
                      This transaction is eligible for financial reversal. Executing this will claw back funds from recipient and refund sender.
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setActionError(null);
                      setIsModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '12px 24px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <RotateCcw size={16} />
                    <span>Execute Financial Reversal</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Modal */}
        {isModalOpen && selectedTx && (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            zIndex: 1000
          }}>
            <div style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              border: '1px solid #334155',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
              overflow: 'hidden'
            }}>
              {/* Modal Header */}
              <div style={{
                padding: '20px 24px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(239, 68, 68, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f87171'
                }}>
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', margin: 0 }}>
                    Confirm Financial Reversal
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
                    Irreversible Core Ledger Operation
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <form onSubmit={handleExecuteReversal} style={{ padding: '24px' }}>
                <p style={{ fontSize: '0.9rem', color: '#cbd5e1', lineHeight: 1.6, margin: '0 0 16px 0' }}>
                  You are about to execute an authoritative ledger reversal for transaction:
                </p>

                <div style={{
                  padding: '14px',
                  backgroundColor: '#070c18',
                  borderRadius: '8px',
                  border: '1px solid #1e293b',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  marginBottom: '20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Transaction ID:</span>
                    <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>{selectedTx.referenceId || selectedTx.id}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Claw-back / Refund Amount:</span>
                    <strong style={{ color: '#f87171' }}>Rs. {Number(selectedTx.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} LKR</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Debiting Recipient:</span>
                    <span style={{ color: '#f8fafc' }}>{selectedTx.receiverAccountNumber || 'Recipient Account'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>Crediting Sender:</span>
                    <span style={{ color: '#f8fafc' }}>{selectedTx.senderAccountNumber || 'Sender Account'}</span>
                  </div>
                </div>

                {/* Mandatory Reversal Reason Input */}
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 700, color: '#f1f5f9', marginBottom: '8px' }}>
                    Reversal Reason / Compliance Justification <span style={{ color: '#f87171' }}>*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter compliance justification (e.g. Confirmed unauthorized account access; Chargeback requested by customer; FraudConfirmed resolution)."
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      backgroundColor: '#070c18',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#f8fafc',
                      fontSize: '0.85rem',
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                    This reason will be permanently archived in the institutional Audit Trail.
                  </div>
                </div>

                {actionError && (
                  <div style={{
                    marginBottom: '16px',
                    padding: '10px 14px',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '6px',
                    color: '#f87171',
                    fontSize: '0.85rem'
                  }}>
                    {actionError}
                  </div>
                )}

                {/* Modal Footer Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => {
                      setIsModalOpen(false);
                      setReversalReason('');
                    }}
                    style={{
                      padding: '10px 18px',
                      backgroundColor: '#1e293b',
                      color: '#cbd5e1',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={isSubmitting || !reversalReason.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '10px 20px',
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: (isSubmitting || !reversalReason.trim()) ? 'not-allowed' : 'pointer',
                      opacity: (isSubmitting || !reversalReason.trim()) ? 0.6 : 1
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        <span>Processing Reversal...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={15} />
                        <span>Confirm & Execute Reversal</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
