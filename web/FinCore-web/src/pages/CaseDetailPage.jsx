import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  FileCheck2,
  ArrowUpRight,
  AlertTriangle
} from 'lucide-react';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';

export default function CaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [caseData, setCaseData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCase = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await reviewService.getCaseById(id);
      setCaseData(data.item || data);
      setHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err) {
      console.error('Case detail fetch error:', err);
      setError(err.response?.data?.message || err.message || 'Case not found');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCase();
  }, [id]);

  if (isLoading) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid #e2e8f0',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            margin: '0 auto 16px auto',
            animation: 'spin 0.8s linear infinite'
          }} />
          <div style={{ color: '#64748b', fontSize: '14px' }}>Loading case forensics...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
        <ShieldAlert size={48} color="#dc2626" style={{ margin: '0 auto 16px auto' }} />
        <h2 style={{ fontSize: '20px', color: '#0f172a' }}>Case Not Found</h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: '8px 0 24px 0' }}>
          {error || `Unable to load case '${id}'.`}
        </p>
        <button
          onClick={() => navigate('/analyst/history')}
          style={{
            padding: '8px 18px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600
          }}
        >
          Return to Audit History
        </button>
      </div>
    );
  }

  const score = Number(caseData.riskScore) || 50;
  const scoreColor = score >= 70 ? '#dc2626' : score >= 50 ? '#d97706' : '#16a34a';

  let flagReasons = [];
  if (caseData.flagReasonsJson) {
    try {
      flagReasons = typeof caseData.flagReasonsJson === 'string'
        ? JSON.parse(caseData.flagReasonsJson)
        : caseData.flagReasonsJson;
    } catch (e) {
      flagReasons = [];
    }
  }

  const currentUserId = user?.id;
  const currentUserName = user?.fullName || user?.name || user?.email;
  const isAssignedToMe = Boolean(
    (caseData?.assignedAnalystId && currentUserId && String(caseData.assignedAnalystId).toLowerCase() === String(currentUserId).toLowerCase()) ||
    (currentUserName && caseData?.assignedAnalystName && caseData.assignedAnalystName.toLowerCase() === currentUserName.toLowerCase())
  );

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)',
      backgroundColor: '#f8fafc',
      padding: '24px 32px',
      color: '#0f172a'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* Back Button */}
        <div>
          <button
            onClick={() => navigate(-1)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#475569',
              cursor: 'pointer'
            }}
          >
            <ArrowLeft size={14} /> Back to Audit Trail
          </button>
        </div>

        {/* Case Header Card */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '24px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>CASE AUDIT DOSSIER</div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '4px 0 0 0', color: '#0f172a' }}>
              {caseData.queueCode || caseData.transactionId}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px', flexWrap: 'wrap' }}>
              <span style={{
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                backgroundColor: '#f1f5f9',
                color: '#334155'
              }}>
                Status: {caseData.status}
              </span>
              <span style={{
                padding: '3px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 800,
                backgroundColor: `${scoreColor}18`,
                color: scoreColor,
                border: `1px solid ${scoreColor}40`
              }}>
                Risk Score: {score}/100 ({caseData.priorityLabel || (score >= 70 ? 'CRITICAL' : 'HIGH')})
              </span>
              {caseData.status === 'Escalated' ? (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #fde68a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <ArrowUpRight size={14} />
                  {isAssignedToMe
                    ? `Assigned to you by ${caseData.escalatedByName || 'Analyst'}`
                    : `Escalated to: ${caseData.assignedAnalystName || 'Analyst'}`}
                </span>
              ) : caseData.assignedAnalystName ? (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#f1f5f9',
                  color: '#475569'
                }}>
                  Assigned: {caseData.assignedAnalystName}
                </span>
              ) : null}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#64748b' }}>TRANSACTION AMOUNT</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a' }}>
              Rs. {Number(caseData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              Created: {new Date(caseData.createdAt).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Escalation Banner if Escalated */}
        {caseData.status === 'Escalated' && (
          <div style={{
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            borderRadius: '10px',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '14px'
          }}>
            <ArrowUpRight size={20} color="#d97706" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#92400e' }}>
                {isAssignedToMe
                  ? `This case was escalated and assigned to you by ${caseData.escalatedByName || 'Originating Analyst'}`
                  : `This case was escalated to ${caseData.assignedAnalystName || 'Analyst'}`}
              </div>
              {caseData.escalationReason && (
                <div style={{ marginTop: '6px', fontSize: '13px', color: '#78350f' }}>
                  <strong>Escalation Reason / Rationale:</strong> &ldquo;{caseData.escalationReason}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}

        {/* Counterparty & Telemetry Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px'
        }}>
          {/* Sender & Recipient Card */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>
              Counterparty Intelligence
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>ORIGINATOR / SENDER</span>
                <span style={{ fontWeight: 700 }}>{caseData.senderName || 'N/A'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                  ({caseData.senderId || 'ACC-SENDER'})
                </span>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>BENEFICIARY / RECIPIENT</span>
                <span style={{ fontWeight: 700 }}>{caseData.recipientName || 'N/A'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                  ({caseData.recipientId || 'ACC-RECIPIENT'})
                </span>
              </div>
            </div>
          </div>

          {/* Telemetry Card */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0' }}>
              Device &amp; Geolocation Telemetry
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
              <div><strong style={{ color: '#64748b' }}>Origin IP:</strong> <code style={{ color: '#2563eb' }}>{caseData.originIp || '203.143.88.71'}</code></div>
              <div><strong style={{ color: '#64748b' }}>Device Session:</strong> {caseData.device || 'Android 14 / Mobile App'}</div>
              <div><strong style={{ color: '#64748b' }}>Coordinates:</strong> {caseData.latitude || 6.9271}, {caseData.longitude || 79.8612}</div>
            </div>
          </div>
        </div>

        {/* AI Fraud Flags */}
        {flagReasons.length > 0 && (
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #e2e8f0'
          }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 12px 0' }}>
              AI Risk Signal Drivers
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {flagReasons.map((f, i) => (
                <div key={i} style={{
                  padding: '8px 12px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fee2e2',
                  borderRadius: '6px',
                  fontSize: '12px',
                  color: '#991b1b',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span>{f.label || JSON.stringify(f)}</span>
                  {f.impact && <span style={{ fontWeight: 800 }}>{f.impact}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chronological Audit Decision History */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileCheck2 size={16} color="#2563eb" />
            Decision Audit Trail for this Case
          </h3>

          {history.length === 0 ? (
            <div style={{ color: '#64748b', fontSize: '13px', fontStyle: 'italic', padding: '12px 0' }}>
              No audit decisions logged yet for this transaction case.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#0f172a' }}>
                      Decision: <span style={{ color: '#2563eb' }}>{h.decision}</span> (Level {h.approvalLevel})
                    </span>
                    <span style={{ color: '#64748b', fontSize: '11px' }}>
                      {new Date(h.decidedAt).toLocaleString()}
                    </span>
                  </div>
                  {h.notes && (
                    <div style={{ marginTop: '6px', color: '#475569', fontStyle: 'italic' }}>
                      &ldquo;{h.notes}&rdquo;
                    </div>
                  )}
                  <div style={{ marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                    <strong>Analyst:</strong> {h.analystName ? `${h.analystName} (${h.analystEmpId || (h.analystId && !h.analystId.includes('-') ? h.analystId : 'ANL-001')})` : (h.analystEmpId || (h.analystId && !h.analystId.includes('-') ? h.analystId : 'ANL-001'))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
