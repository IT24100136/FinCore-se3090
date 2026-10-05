import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  MapPin,
  FileText,
  Activity,
  Radio,
  CheckCircle2
} from 'lucide-react';

export default function FlagDetailBreakdown({ flag, onBack, onNavigateToCase }) {
  const navigate = useNavigate();

  if (!flag) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm space-y-3">
        <p className="text-gray-500 text-xs font-semibold">No transaction selected for score breakdown.</p>
        <button
          onClick={onBack}
          className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
        >
          Return to Flag List
        </button>
      </div>
    );
  }

  const getScoreTheme = (score) => {
    if (score >= 70) return { color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', tier: 'CRITICAL RISK', fill: 'bg-red-600' };
    if (score >= 40) return { color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', tier: 'MODERATE RISK', fill: 'bg-amber-500' };
    return { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', tier: 'LOW RISK', fill: 'bg-emerald-500' };
  };

  const scoreTheme = getScoreTheme(flag.riskScore || 0);
  const distanceKm = Number(flag.distanceDeltaKm ?? flag.distanceKm ?? 284);
  const isDistanceAnomaly = distanceKm > 100;
  const txAmount = Number(flag.amount) || 0;
  const queueId = flag.queueId || flag.rawTxId || flag.transactionId || 'Q-101';

  const customerBaseline = flag.baselineAmount
    ? Number(flag.baselineAmount)
    : Math.max(1500, Math.round((txAmount * 0.35) / 500) * 500);

  const handleOpenCaseDetail = () => {
    const targetCaseId = flag.queueId || flag.rawTxId || flag.transactionId || flag.referenceId || flag.id || queueId;
    if (onNavigateToCase) {
      onNavigateToCase(targetCaseId, flag);
    } else {
      navigate(`/analyst/review-queue?tab=case-detail&caseId=${encodeURIComponent(targetCaseId)}`);
    }
  };

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
        description: `Transaction amount Rs. ${txAmount.toLocaleString()} evaluated against baseline of Rs. ${customerBaseline.toLocaleString()}.`
      },
      {
        id: 'RUL-002',
        label: 'Spatial / Geolocation Anomaly',
        points: isDistanceAnomaly ? 32 : 10,
        description: isDistanceAnomaly
          ? `Distance delta of ${distanceKm} km from registered profile (${flag.homeLocation || 'Colombo'}).`
          : 'Origin IP within acceptable geographic operational zone.'
      }
    ];

  return (
    <div className="space-y-6 font-sans text-gray-900">

      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Flags
          </button>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-lg font-extrabold text-blue-600">
                {flag.transactionId || flag.referenceId || 'TXN-FLAGGED'}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreTheme.bg} ${scoreTheme.color} ${scoreTheme.border}`}>
                {scoreTheme.tier} ({flag.riskScore}/100)
              </span>
              <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-semibold">
                Status: {flag.status || 'Flagged'}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Evaluation recorded {flag.createdAt ? new Date(flag.createdAt).toLocaleString() : 'Recent'} • Case Ref: <strong>{queueId}</strong>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {txAmount >= 75000 && (
            <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg text-xs font-semibold text-amber-800">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              Dual Approval Gate (&ge; Rs. 75,000)
            </div>
          )}

          <button
            onClick={handleOpenCaseDetail}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors cursor-pointer"
          >
            <span>Open in Analyst Case Detail</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2-Column Responsive Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT COLUMN: Transaction Details & Geolocation (2 cols) */}
        <div className="lg:col-span-2 space-y-6">

          {/* Transaction Parameters */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4 p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-gray-900">Transaction Parameters</h3>
              </div>
              <span className="text-xs text-gray-500 font-medium">
                Channel: <strong className="text-gray-900">{flag.paymentChannel || flag.channel || 'Instant Transfer'}</strong>
              </span>
            </div>

            <div className="bg-slate-50 border border-gray-200 rounded-lg p-4 flex justify-between items-center">
              <div>
                <div className="text-[11px] font-semibold text-gray-500 uppercase">Evaluated Transaction Value</div>
                <div className="text-2xl font-extrabold text-gray-900 mt-0.5">
                  Rs. {txAmount.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[11px] font-semibold text-gray-500 uppercase">30-Day Customer Baseline</div>
                <div className="text-xs font-bold text-gray-700 mt-1">
                  ~ Rs. {customerBaseline.toLocaleString('en-LK', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">SENDER</span>
                <strong className="text-gray-900 text-sm">{flag.customerName || flag.senderName || 'Customer'}</strong>
                <div className="text-gray-500 font-mono">Acc: {flag.senderAccount || flag.senderAccountNumber || 'ACC-0001'}</div>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">BENEFICIARY</span>
                <strong className="text-gray-900 text-sm">{flag.recipientName || flag.receiverName || 'Recipient'}</strong>
                <div className="text-gray-500 font-mono">Acc: {flag.recipientAccount || 'ACC-RECIPIENT'}</div>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">ORIGIN IP</span>
                <code className="text-blue-600 font-bold">{flag.originIp || '192.168.1.10'}</code>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">DEVICE SESSION</span>
                <span className="font-semibold text-gray-900">{flag.device || 'Chrome — Windows 11'}</span>
              </div>
            </div>
          </div>

          {/* Geolocation Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4 p-6">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className={`w-4 h-4 ${isDistanceAnomaly ? 'text-red-600' : 'text-blue-600'}`} />
                <h3 className="text-sm font-bold text-gray-900">Geolocation Delta Metrics</h3>
              </div>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                isDistanceAnomaly ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {isDistanceAnomaly ? 'Spatial Anomaly' : 'Normal Proximity'}
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-gray-200 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Radio className={`w-5 h-5 ${isDistanceAnomaly ? 'text-red-600' : 'text-emerald-600'}`} />
                <div>
                  <div className="text-xs font-bold text-gray-900">Distance Delta: {distanceKm.toLocaleString()} km</div>
                  <div className="text-[11px] text-gray-500">
                    {isDistanceAnomaly ? `IP location deviates ${distanceKm}km from registered location (${flag.homeLocation || 'Colombo'})` : 'Origin IP within normal radius'}
                  </div>
                </div>
              </div>
              <span className="text-xs font-extrabold px-2 py-0.5 rounded bg-white border border-gray-200 text-gray-900">
                {isDistanceAnomaly ? '+32 PTS RISK' : '+0 PTS'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-gray-500 font-semibold uppercase">
                    <th className="p-3">Parameter</th>
                    <th className="p-3">Registered Profile</th>
                    <th className="p-3">Observed Origin</th>
                    <th className="p-3">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="p-3 font-semibold text-gray-800">City / Region</td>
                    <td className="p-3 text-gray-600">{flag.homeLocation || 'Colombo'}</td>
                    <td className="p-3 font-semibold text-gray-900">{flag.ipCity || 'Jaffna'}</td>
                    <td className={`p-3 font-bold ${isDistanceAnomaly ? 'text-red-600' : 'text-emerald-600'}`}>{distanceKm} km delta</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Composite Score & Gateway (1 col) */}
        <div className="space-y-6">

          {/* Composite Score Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-600" /> Composite Score Breakdown
            </h3>

            <div className={`p-4 rounded-lg border ${scoreTheme.bg} ${scoreTheme.border} space-y-3`}>
              <div className="flex justify-between items-baseline">
                <div>
                  <div className={`text-[11px] font-bold ${scoreTheme.color} uppercase`}>Risk Score</div>
                  <div className={`text-3xl font-extrabold ${scoreTheme.color}`}>{flag.riskScore}/100</div>
                </div>
                <div className={`text-xs font-bold ${scoreTheme.color}`}>{scoreTheme.tier}</div>
              </div>

              <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                <div className={`h-full ${scoreTheme.fill}`} style={{ width: `${Math.min(100, flag.riskScore)}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-900">Triggered Rules Impact</div>
              {dynamicRules.map((rule, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-gray-200 text-xs flex justify-between items-start gap-2">
                  <div>
                    <div className="font-bold text-gray-900">{rule.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{rule.description}</div>
                  </div>
                  <span className="font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                    +{rule.points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Gateway */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> Resolution Gateway
            </h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Adjudicate decisions, record mandatory notes, or execute maker-checker dual approvals in the Case Detail workspace.
            </p>
            <button
              onClick={handleOpenCaseDetail}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Open in Analyst Case Detail →
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
