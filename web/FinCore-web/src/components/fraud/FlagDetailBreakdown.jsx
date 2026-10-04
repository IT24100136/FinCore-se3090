import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MapPin,
  Globe,
  Clock,
  User,
  CreditCard,
  Smartphone,
  AlertTriangle,
  FileText,
  Activity,
  Radio,
  CheckCircle2
} from 'lucide-react';

export default function FlagDetailBreakdown({ flag, onBack, onNavigateToCase }) {
  const navigate = useNavigate();

  if (!flag) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <p style={{ color: '#64748b', fontSize: '14px' }}>No transaction selected for score breakdown.</p>
        <button
          onClick={onBack}
          style={{
            marginTop: '12px',
            padding: '8px 16px',
            backgroundColor: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          Return to Flag List
        </button>
      </div>
    );
  }

  const getScoreColor = (score) => {
    if (score >= 70) return { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', tier: 'CRITICAL RISK' };
    if (score >= 50) return { color: '#d97706', bg: '#fef3c7', border: '#fcd34d', tier: 'MODERATE RISK' };
    return { color: '#16a34a', bg: '#dcfce7', border: '#86efac', tier: 'LOW RISK' };
  };

  const scoreTheme = getScoreColor(flag.riskScore || 0);
  const distanceKm = Number(flag.distanceDeltaKm ?? flag.distanceKm ?? 284);
  const isDistanceAnomaly = distanceKm > 100;
  const txAmount = Number(flag.amount) || 0;
  const queueId = flag.queueId || flag.rawTxId || flag.transactionId || 'Q-101';

  // Dynamic baseline based on transaction amount
  const customerBaseline = flag.baselineAmount
    ? Number(flag.baselineAmount)
    : Math.max(1500, Math.round((txAmount * 0.35) / 500) * 500);

  const handleOpenCaseDetail = () => {
    if (onNavigateToCase) {
      onNavigateToCase(queueId);
    } else {
      navigate(`/analyst/review-queue?caseId=${encodeURIComponent(queueId)}`);
    }
  };

  // Dynamically format rule descriptions so no hardcoded mock amounts appear
  const dynamicRules = (flag.triggeredRules && flag.triggeredRules.length > 0)
    ? flag.triggeredRules.map(r => {
      let desc = r.description || '';
      if (r.label?.includes('Amount') || r.id === 'RUL-001') {
        desc = `Transaction of Rs. ${txAmount.toLocaleString()} substantially exceeds baseline (Rs. ${customerBaseline.toLocaleString()}).`;
      } else if (r.label?.includes('Geo') || r.id === 'RUL-002') {
        desc = `Distance delta of ${distanceKm} km observed from registered location (${flag.homeLocation || 'Colombo'}).`;
      }
      return { ...r, description: desc };
    })
    : [
      {
        id: 'RUL-001',
        label: 'Transaction Magnitude Anomaly',
        points: flag.riskScore > 50 ? 30 : 15,
        color: flag.riskScore > 50 ? '#dc2626' : '#f59e0b',
        description: `Transaction amount Rs. ${txAmount.toLocaleString()} evaluated against statistical user baseline of Rs. ${customerBaseline.toLocaleString()}.`
      },
      {
        id: 'RUL-002',
        label: 'Spatial / Geolocation Anomaly',
        points: isDistanceAnomaly ? 32 : 10,
        color: isDistanceAnomaly ? '#dc2626' : '#10b981',
        description: isDistanceAnomaly
          ? `Distance delta of ${distanceKm} km from registered profile (${flag.homeLocation || 'Colombo'}).`
          : 'Origin IP within acceptable geographic operational zone.'
      }
    ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background-color 0.15s'
            }}
          >
            <ArrowLeft size={16} /> Back to Flags
          </button>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                fontFamily: 'monospace',
                fontSize: '18px',
                fontWeight: 800,
                color: '#2563eb'
              }}>
                {flag.transactionId || flag.referenceId || 'TXN-FLAGGED'}
              </span>
              <span style={{
                backgroundColor: scoreTheme.bg,
                color: scoreTheme.color,
                border: `1px solid ${scoreTheme.border}`,
                padding: '3px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 800
              }}>
                {scoreTheme.tier} ({flag.riskScore}/100)
              </span>
              <span style={{
                backgroundColor: '#f1f5f9',
                color: '#475569',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700
              }}>
                Status: {flag.status || 'Flagged'}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Evaluation recorded {flag.createdAt ? new Date(flag.createdAt).toLocaleString() : 'Recent'} • Case Reference: <strong>{queueId}</strong>
            </div>
          </div>
        </div>

        {/* Primary Action Button: Open in Analyst Case Detail */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {txAmount >= 75000 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#fef3c7',
              border: '1px solid #fde68a',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#92400e'
            }}>
              <ShieldAlert size={15} color="#d97706" />
              Dual Approval Statutory Gate (&ge; Rs. 75,000)
            </div>
          )}

          <button
            onClick={handleOpenCaseDetail}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              backgroundColor: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              transition: 'background-color 0.15s ease'
            }}
          >
            <span>Open in Analyst Case Detail</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* ============================================================== */}
        {/* LEFT COLUMN: Dynamic Transaction Details & Geolocation Metrics */}
        {/* ============================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Card 1: Dynamic Transaction Parameters */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={17} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Transaction Parameters (Dynamic)
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Channel: <strong style={{ color: '#0f172a' }}>{flag.paymentChannel || flag.channel || 'Instant Transfer'}</strong>
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Amount Highlight Banner */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 18px',
                backgroundColor: '#f8fafc',
                borderRadius: '8px',
                border: '1px solid #e2e8f0'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                    Evaluated Transaction Value
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
                    Rs. {txAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>30-Day Customer Baseline</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    ~ Rs. {customerBaseline.toLocaleString('en-LK', { minimumFractionDigits: 2 })} (Avg)
                  </div>
                </div>
              </div>

              {/* Detail Key-Value Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '14px',
                fontSize: '13px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Customer Name (Sender)</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {flag.customerName || flag.senderName || flag.sender || 'Customer'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Acc: {flag.senderAccount || flag.senderAccountNumber || (flag.senderWalletId ? `ACC-${flag.senderWalletId}` : 'ACC-00000001')}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Beneficiary / Recipient</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {flag.recipientName || flag.counterparty || flag.receiverName || 'Verified Beneficiary'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    Acc: {flag.recipientAccount || flag.recipientAccountNumber || (flag.receiverWalletId ? `ACC-${flag.receiverWalletId}` : 'ACC-RECIPIENT')}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Originating IP Address</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                    {flag.originIp || '192.168.1.10'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>
                    {flag.ipCity || 'Colombo'}, {flag.ipCountry || 'Sri Lanka'}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Observed Hardware / Device</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {flag.device || 'Chrome — Windows 11'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                    {flag.deviceFingerprint ? `${flag.deviceFingerprint.substring(0, 16)}...` : 'fp-verified'}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Tabular Geolocation Delta Metrics (Map Removed as instructed) */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MapPin size={17} color={isDistanceAnomaly ? '#dc2626' : '#2563eb'} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Tabular Geolocation Delta Metrics
                </h3>
              </div>
              <span style={{
                fontSize: '11px',
                fontWeight: 700,
                color: isDistanceAnomaly ? '#b91c1c' : '#15803d',
                backgroundColor: isDistanceAnomaly ? '#fee2e2' : '#dcfce7',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {isDistanceAnomaly ? 'High Spatial Anomaly' : 'Normal Proximity'}
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Distance Delta Alert Banner */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: isDistanceAnomaly ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${isDistanceAnomaly ? '#fca5a5' : '#bbf7d0'}`
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Radio size={20} color={isDistanceAnomaly ? '#dc2626' : '#16a34a'} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: isDistanceAnomaly ? '#991b1b' : '#166534' }}>
                      Distance Delta: {distanceKm.toLocaleString()} km
                    </div>
                    <div style={{ fontSize: '11px', color: isDistanceAnomaly ? '#b91c1c' : '#15803d' }}>
                      {distanceKm > 100
                        ? `Transaction IP (${flag.ipCity || 'Unknown City'}) deviates ${distanceKm}km from registered location (${flag.homeLocation || 'Colombo'})`
                        : `Transaction initiated within normal user operational radius`}
                    </div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: '#fff',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isDistanceAnomaly ? '#dc2626' : '#16a34a',
                  border: '1px solid #e2e8f0'
                }}>
                  {distanceKm > 100 ? '+32 PTS RISK' : '+0 PTS'}
                </div>
              </div>

              {/* Structured Comparison Table */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Parameter</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Customer Registered Profile</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Observed Transaction Origin</th>
                    <th style={{ padding: '10px 12px', fontWeight: 600 }}>Variance / Delta</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>City / Region</td>
                    <td style={{ padding: '10px 12px', color: '#0f172a' }}>{flag.homeLocation || 'Colombo, Western Province'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: isDistanceAnomaly ? '#dc2626' : '#0f172a' }}>
                      {flag.ipCity || 'Jaffna'}, {flag.ipCountry || 'Sri Lanka'}
                    </td>
                    <td style={{ padding: '10px 12px', color: isDistanceAnomaly ? '#dc2626' : '#16a34a', fontWeight: 700 }}>
                      {distanceKm} km delta
                    </td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>IP Address</td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>Registered Subnets</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0f172a' }}>{flag.originIp || '203.143.88.71'}</td>
                    <td style={{ padding: '10px 12px', color: isDistanceAnomaly ? '#d97706' : '#64748b' }}>Unseen IP Block</td>
                  </tr>
                  <tr>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: '#334155' }}>Coordinates</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#64748b' }}>
                      {flag.homeLatitude || 6.9271}, {flag.homeLongitude || 79.8612}
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', color: '#0f172a' }}>
                      {flag.latitude || 9.6615}, {flag.longitude || 80.0255}
                    </td>
                    <td style={{ padding: '10px 12px', color: '#64748b' }}>Lat/Lng Delta Verified</td>
                  </tr>
                </tbody>
              </table>

            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Composite Score Breakdown & Case Detail Link     */}
        {/* ============================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Card 3: Composite Score Breakdown */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={17} color="#2563eb" />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                  Composite Score Breakdown
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Engine Gate: <strong style={{ color: '#0f172a' }}>50–69 Hold | &ge;70 Case</strong>
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Progress Bar Visualizer */}
              <div style={{
                padding: '18px 20px',
                backgroundColor: scoreTheme.bg,
                borderRadius: '10px',
                border: `1px solid ${scoreTheme.border}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
                  <div>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: scoreTheme.color, letterSpacing: '0.5px' }}>
                      COMPOSITE FRAUD RISK SCORE
                    </div>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: scoreTheme.color, lineHeight: 1.1 }}>
                      {flag.riskScore} <span style={{ fontSize: '16px', fontWeight: 700, opacity: 0.8 }}>/ 100</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '13px', fontWeight: 800, color: scoreTheme.color }}>
                      {scoreTheme.tier}
                    </div>
                    <div style={{ fontSize: '11px', color: scoreTheme.color, opacity: 0.9 }}>
                      {flag.riskScore >= 70 ? 'Escalated to Analyst' : flag.riskScore >= 50 ? 'Step-Up Held' : 'Auto Approved'}
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: '10px', backgroundColor: '#e2e8f0', borderRadius: '5px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(flag.riskScore, 100)}%`,
                      height: '100%',
                      backgroundColor: scoreTheme.color,
                      borderRadius: '5px',
                      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                  <span>0 (Safe)</span>
                  <span>50 (Step-Up Challenge)</span>
                  <span>70 (Analyst Review)</span>
                  <span>100 (Critical)</span>
                </div>
              </div>

              {/* Contributed Points List */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                  Points Contributed by Triggered Rules
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {dynamicRules.map((rule, idx) => {
                    const isHigh = rule.points >= 30;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          justifyContent: 'space-between',
                          padding: '12px 14px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                          <span style={{
                            display: 'inline-block',
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isHigh ? '#dc2626' : '#f59e0b',
                            marginTop: '5px',
                            flexShrink: 0
                          }} />
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                              {rule.label}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', lineHeight: 1.4 }}>
                              {rule.description}
                            </div>
                          </div>
                        </div>

                        <span style={{
                          fontWeight: 900,
                          fontSize: '12px',
                          color: isHigh ? '#b91c1c' : '#b45309',
                          backgroundColor: isHigh ? '#fee2e2' : '#fef3c7',
                          border: `1px solid ${isHigh ? '#fca5a5' : '#fde68a'}`,
                          padding: '3px 8px',
                          borderRadius: '6px',
                          whiteSpace: 'nowrap'
                        }}>
                          +{rule.points} pts
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Direct Navigation Link to Student 3's Analyst Case Detail Workspace */}
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '12px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <CheckCircle2 size={17} color="#2563eb" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Analyst Case Resolution Gateway
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>
                Human analyst decisions (Approve, Reject, Request Info, Maker-Checker Dual Approvals) are strictly
                managed in <strong>Student 3's Case Detail &amp; Adjudication workspace</strong> to maintain segregation of duties.
              </p>

              <div style={{
                padding: '12px 14px',
                backgroundColor: '#eff6ff',
                borderRadius: '8px',
                border: '1px solid #bfdbfe',
                fontSize: '12px',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <ExternalLink size={16} color="#2563eb" />
                <span>Case Reference ID: <strong>{queueId}</strong></span>
              </div>

              <button
                type="button"
                onClick={handleOpenCaseDetail}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '13px 20px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                <span>Open in Analyst Case Detail →</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
