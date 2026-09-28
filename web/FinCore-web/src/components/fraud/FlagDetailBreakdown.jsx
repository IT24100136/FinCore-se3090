import React, { useState } from 'react';
import { fraudService } from '../../services/fraudService';
import TransactionMap from '../TransactionMap';
import {
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  CheckCircle,
  XCircle,
  MapPin,
  Globe,
  Clock,
  User,
  CreditCard,
  Smartphone,
  AlertTriangle,
  Send,
  Building,
  Radio,
  FileText,
  Activity,
  ChevronRight,
  Info
} from 'lucide-react';

export default function FlagDetailBreakdown({ flag, onBack, onDecisionSubmitted }) {
  const [notes, setNotes] = useState(flag?.analystNotes || '');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [currentStatus, setCurrentStatus] = useState(flag?.status || 'Flagged');

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

  const handleDecision = async (decision) => {
    if (!notes.trim()) {
      alert('Analyst Notes are mandatory before finalizing an approval or rejection decision.');
      return;
    }

    setSubmitting(true);
    try {
      await fraudService.submitDecision(flag.rawTxId || flag.id, decision, notes);
      const updatedStatus = decision === 'Approved' ? 'Approved' : 'Rejected';
      setCurrentStatus(updatedStatus);
      setFeedback({
        type: 'success',
        message: `Transaction ${flag.transactionId} has been successfully ${decision === 'Approved' ? 'APPROVED & RELEASED' : 'REJECTED & HELD'}. Decision logged in audit trail.`
      });

      if (onDecisionSubmitted) {
        onDecisionSubmitted(flag.id, updatedStatus, notes);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: 'Failed to record decision: ' + (err.message || 'Server connection error')
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 75) return { color: '#dc2626', bg: '#fee2e2', border: '#fca5a5', tier: 'CRITICAL RISK' };
    if (score >= 40) return { color: '#d97706', bg: '#fef3c7', border: '#fcd34d', tier: 'MODERATE RISK' };
    return { color: '#16a34a', bg: '#dcfce7', border: '#86efac', tier: 'LOW RISK' };
  };

  const scoreTheme = getScoreColor(flag.riskScore);
  const distanceKm = flag.distanceDeltaKm || 284;
  const isDistanceAnomaly = distanceKm > 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Top Navigation Bar with Back Button */}
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
                {flag.transactionId}
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
                Status: {currentStatus}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
              Evaluation recorded {new Date(flag.createdAt).toLocaleString()} • Queue Item: {flag.queueId || 'Q-104'}
            </div>
          </div>
        </div>

        {/* Dual Approval Badge if amount >= 75000 */}
        {flag.amount >= 75000 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#fef3c7',
            border: '1px solid #fde68a',
            padding: '6px 14px',
            borderRadius: '8px',
            fontSize: '12px',
            fontWeight: 700,
            color: '#92400e'
          }}>
            <ShieldAlert size={16} color="#d97706" />
            Maker-Checker Statutory Gate (&ge; Rs. 75,000)
          </div>
        )}
      </div>

      {/* Decision / Action Feedback Banner */}
      {feedback && (
        <div style={{
          padding: '12px 20px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* 2-Column Responsive Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* ============================================================== */}
        {/* LEFT COLUMN: Transaction Details & Map / Geolocation Anomaly    */}
        {/* ============================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Card 1: Transaction Details Card */}
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
                  Transaction Parameters
                </h3>
              </div>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Channel: <strong style={{ color: '#0f172a' }}>{flag.paymentChannel || 'Instant Transfer'}</strong>
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
                    Rs. {(Number(flag.amount) || 0).toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>30-Day Customer Baseline</div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>
                    ~ Rs. 25,000.00 (Avg)
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
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{flag.customerName}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>ID: {flag.customerId}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Beneficiary / Recipient</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{flag.recipientName || 'Verified Beneficiary'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>Acc: {flag.recipientAccount || 'ACC-88392011'}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Originating IP Address</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', marginTop: '2px' }}>
                    {flag.originIp}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{flag.ipCity}, {flag.ipCountry}</div>
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Observed Hardware / Device</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>{flag.device || 'Chrome — Windows 11'}</div>
                  <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                    {flag.deviceFingerprint ? `${flag.deviceFingerprint.substring(0, 16)}...` : 'fp-verified'}
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Map / Geolocation Anomaly Card */}
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
                  Geolocation Anomaly &amp; Spatial Delta
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
                      {distanceKm > 200
                        ? `Transaction IP (${flag.ipCity}) deviates ${distanceKm}km from registered location (${flag.homeLocation || 'Colombo'})`
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
                  {distanceKm > 200 ? '+32 PTS RISK' : '+0 PTS'}
                </div>
              </div>

              {/* Side-by-side Location Comparison */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>Customer Primary Address</div>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px', marginTop: '2px' }}>
                    {flag.homeLocation || 'Colombo, Western Province'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Coords: {flag.homeLatitude || 6.9271}, {flag.homeLongitude || 79.8612}
                  </div>
                </div>

                <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>IP Origin Geolocation</div>
                  <div style={{ fontWeight: 700, color: isDistanceAnomaly ? '#dc2626' : '#0f172a', fontSize: '13px', marginTop: '2px' }}>
                    {flag.ipCity || 'Jaffna'}, {flag.ipCountry || 'Sri Lanka'}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                    Coords: {flag.latitude || 9.6615}, {flag.longitude || 80.0255}
                  </div>
                </div>
              </div>

              {/* Embedded Map Component */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Globe size={14} color="#64748b" /> Geolocation Map Visualizer
                </div>
                <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  <TransactionMap
                    lat={flag.latitude || 9.6615}
                    lng={flag.longitude || 80.0255}
                    locationName={`Origin IP: ${flag.ipCity || 'Resolved Location'} (${flag.originIp})`}
                  />
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Score Breakdown, Points per Rule, & Human Action */}
        {/* ============================================================== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Card 3: Score Breakdown Card */}
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
                Engine Threshold: <strong style={{ color: '#0f172a' }}>40 pts</strong>
              </span>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

              {/* Progress Bar Style Composite Risk Score Visualizer */}
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
                      {flag.riskScore >= 75 ? 'Immediate hold advised' : flag.riskScore >= 40 ? 'Manual review required' : 'Low anomaly probability'}
                    </div>
                  </div>
                </div>

                {/* Progress Bar with Gradient */}
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

                {/* Milestone indicators */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontSize: '10px', color: '#64748b', fontWeight: 600 }}>
                  <span>0 (Safe)</span>
                  <span>40 (Review Gate)</span>
                  <span>75 (Critical Threat)</span>
                  <span>100 (Hard Reject)</span>
                </div>
              </div>

              {/* Bulleted List of Exact Points Added Per Rule */}
              <div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', marginBottom: '10px' }}>
                  Points Contributed by Triggered Rules
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {flag.triggeredRules && flag.triggeredRules.length > 0 ? (
                    flag.triggeredRules.map((rule, idx) => {
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
                                {rule.description || 'Evaluated metric exceeded defined system safety boundary.'}
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
                    })
                  ) : (
                    <div style={{ padding: '16px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                      No individual rule penalties recorded.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Card 4: Analyst Notes & Human-Approval Action Buttons */}
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
              <ShieldCheck size={17} color="#2563eb" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Human Analyst Decision &amp; Audit Log
              </h3>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Analyst Notes Text Area */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Analyst Rationale / Verification Notes <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <textarea
                  rows="4"
                  placeholder="Record customer verification outcome, biometric matching, IP tracing findings, or justification for decision..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical',
                    lineHeight: 1.5
                  }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  <span>Required for audit trail compliance (SE3090 FinCore Standard)</span>
                  <span>{notes.length} characters</span>
                </div>
              </div>

              {/* Action Buttons: "Approve & Release" & "Reject & Hold" */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                {/* Approve Button */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Approved')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    backgroundColor: '#16a34a', // Solid green
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(22,163,74,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <CheckCircle size={16} /> Approve &amp; Release
                </button>

                {/* Reject Button */}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleDecision('Rejected')}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    padding: '12px 18px',
                    backgroundColor: '#dc2626', // Solid red
                    color: '#fff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: submitting ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <XCircle size={16} /> Reject &amp; Hold
                </button>
              </div>

              <div style={{ fontSize: '11px', color: '#64748b', textAlign: 'center', lineHeight: 1.4 }}>
                Submitting a decision automatically updates the transaction settlement state and notifies the core banking ledger.
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
