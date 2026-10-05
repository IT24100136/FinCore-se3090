import React, { useState, useEffect, Component } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  FileCheck2,
  ArrowUpRight,
  Layers,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  HelpCircle,
  Activity,
  MapPin,
  FileText,
  UserCheck,
  Send,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';
import TransactionMap from '../components/TransactionMap';

// ============================================================================
// 1. Error Boundary to prevent blank page crashes
// ============================================================================
class CaseErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CaseErrorBoundary caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center font-sans">
          <div className="bg-white rounded-lg shadow-sm border border-red-200 p-8 max-w-md w-full text-center space-y-4">
            <ShieldAlert className="w-12 h-12 text-red-600 mx-auto" />
            <h2 className="text-lg font-bold text-gray-900">Case Inspection Display Error</h2>
            <p className="text-xs text-red-700">
              {this.state.error?.message || 'An unexpected rendering error occurred.'}
            </p>
            <div className="flex justify-center gap-2 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ============================================================================
// 2. Data Safety Helpers
// ============================================================================
function safeString(val, fallback = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'object') {
    return val.name || val.fullName || val.email || val.id || JSON.stringify(val);
  }
  return String(val);
}

function safeDate(val) {
  if (!val) return 'N/A';
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) return String(val);
    return d.toLocaleString();
  } catch (e) {
    return String(val);
  }
}

function parseFlagReasons(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {
      // Fallback
    }
  }
  return [];
}

// ============================================================================
// 3. Main Case Detail Page Inner Component
// ============================================================================
function CaseDetailPageInner() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const id = paramId || searchParams.get('caseId') || searchParams.get('id') || searchParams.get('queueId') || searchParams.get('txId');

  const [caseData, setCaseData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Decision & Escalation states
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  // Escalation modal states
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
  const [availableAnalysts, setAvailableAnalysts] = useState([]);
  const [selectedTargetAnalystId, setSelectedTargetAnalystId] = useState('');
  const [escalationNotes, setEscalationNotes] = useState('');
  const [isLoadingAnalysts, setIsLoadingAnalysts] = useState(false);
  const [isSubmittingEscalation, setIsSubmittingEscalation] = useState(false);

  const fetchCase = async (lookupId) => {
    const targetId = lookupId || id;
    if (!targetId) {
      try {
        setIsLoading(true);
        const data = await reviewService.getCaseById('latest');
        if (data && (data.item || data.id || data.queueCode)) {
          const item = data.item || data;
          setCaseData({
            ...item,
            assignedAnalystName: safeString(data.assignedAnalystName || item.assignedAnalystName),
            assignedAnalystEmpId: safeString(data.assignedAnalystEmpId || item.assignedAnalystEmpId),
            escalatedByName: safeString(data.escalatedByName || item.escalatedByName),
            escalatedByEmpId: safeString(data.escalatedByEmpId || item.escalatedByEmpId),
            escalationReason: safeString(data.escalationReason || item.escalationReason)
          });
          setHistory(Array.isArray(data.history) ? data.history : []);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Fall through
      }
      setIsLoading(false);
      setError('No case identifier specified. Please select a case from the Review Queue or Audit Trail.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await reviewService.getCaseById(targetId);
      const item = data.item || data;
      setCaseData({
        ...item,
        assignedAnalystName: safeString(data.assignedAnalystName || item.assignedAnalystName),
        assignedAnalystEmpId: safeString(data.assignedAnalystEmpId || item.assignedAnalystEmpId),
        escalatedByName: safeString(data.escalatedByName || item.escalatedByName),
        escalatedByEmpId: safeString(data.escalatedByEmpId || item.escalatedByEmpId),
        escalationReason: safeString(data.escalationReason || item.escalationReason)
      });
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
  }, [paramId, searchParams]);

  const handleDecision = async (decisionType) => {
    if (decisionType === 'Escalate') {
      handleOpenEscalateModal();
      return;
    }

    if (!notes.trim()) {
      setActionFeedback({
        type: 'error',
        message: 'Mandatory compliance notes are required prior to recording a decision.'
      });
      return;
    }

    const currentAnalystId = user?.id || '22222222-2222-2222-2222-222222222222';
    setIsSubmitting(true);
    setActionFeedback(null);

    try {
      const targetId = caseData.transactionId || caseData.queueCode || caseData.id;
      const amount = Number(caseData.amount || caseData.transactionAmount || 0);

      let res;
      if (caseData.status === 'PendingSecondApproval') {
        res = await reviewService.secondApproval(targetId, {
          secondAnalystId: currentAnalystId,
          decision: decisionType,
          notes: notes.trim()
        });
      } else {
        res = await reviewService.decideCase(targetId, {
          analystId: currentAnalystId,
          decision: decisionType,
          notes: notes.trim(),
          transactionAmount: amount
        });
      }

      setActionFeedback({
        type: 'success',
        message: res.message || `Decision '${decisionType}' successfully logged in PostgreSQL.`
      });
      setNotes('');
      await fetchCase(targetId);
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: 'Decision error: ' + (err.response?.data?.message || err.message)
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEscalateModal = async () => {
    setIsEscalateModalOpen(true);
    setEscalationNotes(notes.trim() || 'Escalated for senior analyst compliance investigation.');
    setIsLoadingAnalysts(true);
    try {
      const staff = await reviewService.getAvailableAnalysts();
      const list = Array.isArray(staff) ? staff : [];
      const currentId = user?.id ? String(user.id).toLowerCase() : '';
      const otherStaff = list.filter(u => String(u.id).toLowerCase() !== currentId);
      const finalList = otherStaff.length > 0 ? otherStaff : list;
      setAvailableAnalysts(finalList);
      if (finalList.length > 0) {
        setSelectedTargetAnalystId(finalList[0].id);
      }
    } catch (err) {
      console.warn('Could not load staff list:', err);
    } finally {
      setIsLoadingAnalysts(false);
    }
  };

  const handleSubmitEscalation = async () => {
    if (!escalationNotes.trim()) {
      alert('Please provide an escalation rationale.');
      return;
    }

    const currentAnalystId = user?.id || '22222222-2222-2222-2222-222222222222';
    const targetId = caseData.transactionId || caseData.queueCode || caseData.id;
    const targetAnalystObj = availableAnalysts.find(a => a.id === selectedTargetAnalystId);

    setIsSubmittingEscalation(true);
    try {
      const res = await reviewService.escalateCase(targetId, {
        analystId: currentAnalystId,
        targetAnalystId: selectedTargetAnalystId || undefined,
        targetAnalystName: targetAnalystObj?.name || 'Senior Analyst',
        reason: escalationNotes.trim()
      });

      setIsEscalateModalOpen(false);
      setActionFeedback({
        type: 'info',
        message: res.message || 'Case successfully escalated to senior staff.'
      });
      setNotes('');
      await fetchCase(targetId);
    } catch (err) {
      alert('Escalation failed: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsSubmittingEscalation(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Loading case forensics...</p>
        </div>
      </div>
    );
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-slate-50 p-8 flex items-center justify-center font-sans">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md w-full text-center space-y-4">
          <ShieldAlert className="w-12 h-12 text-amber-600 mx-auto" />
          <h2 className="text-lg font-bold text-gray-900">Case Dossier Notice</h2>
          <p className="text-xs text-gray-500">
            {error || 'Unable to load case record.'}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
            <button
              onClick={() => navigate('/analyst/review-queue')}
              className="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Layers className="w-3.5 h-3.5" /> Open Review Queue
            </button>
            <button
              onClick={() => navigate('/analyst/history')}
              className="w-full sm:w-auto bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 font-medium px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
            >
              Audit History
            </button>
          </div>
        </div>
      </div>
    );
  }

  const score = Number(caseData.riskScore) || 50;
  const amount = Number(caseData.amount || caseData.transactionAmount || 0);
  const currentUserId = safeString(user?.id);
  const currentUserName = safeString(user?.fullName || user?.name || user?.email);
  const assignedAnalystNameStr = safeString(caseData.assignedAnalystName);

  const isAssignedToMe = Boolean(
    (caseData.assignedAnalystId && currentUserId && String(caseData.assignedAnalystId).toLowerCase() === currentUserId.toLowerCase()) ||
    (currentUserName && assignedAnalystNameStr && assignedAnalystNameStr.toLowerCase() === currentUserName.toLowerCase())
  );

  let flagReasons = parseFlagReasons(caseData.flagReasonsJson);
  if (flagReasons.length === 0) {
    flagReasons = [
      { label: 'Amount 3× User Average', impact: '+30', color: '#f59e0b' },
      { label: 'Unrecognized Device Fingerprint', impact: '+25', color: '#ef4444' },
      { label: 'Geolocation Mismatch > 200km', impact: '+32', color: '#ef4444' }
    ];
  }

  const isDualApprovalRequired = amount >= 75000;

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Back Navigation & Breadcrumb */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            CASE AUDIT DOSSIER &gt; {caseData.queueCode || caseData.transactionId}
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div className={`p-4 rounded-lg text-xs font-semibold flex items-center justify-between border ${
            actionFeedback.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
            actionFeedback.type === 'info' ? 'bg-sky-50 text-sky-800 border-sky-200' :
            'bg-rose-50 text-rose-800 border-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{actionFeedback.message}</span>
            </div>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-gray-400 hover:text-gray-600 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Case Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              FINANCIAL FRAUD AUDIT RECORD
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
              <span>{caseData.queueCode || caseData.transactionId}</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                score >= 70 ? 'bg-red-50 text-red-600' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                Risk Score: {score}/100 ({caseData.priorityLabel || (score >= 70 ? 'CRITICAL' : 'HIGH')})
              </span>
            </h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Status: {caseData.status || 'Queued'}
              </span>
              {isDualApprovalRequired && (
                <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                  Dual Approval Gate (&ge; Rs. 75,000)
                </span>
              )}
              {caseData.status === 'Escalated' && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {isAssignedToMe
                    ? `Assigned to you by ${caseData.escalatedByName || 'Analyst'}`
                    : `Escalated to: ${assignedAnalystNameStr || 'Analyst'}`}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              TRANSACTION AMOUNT
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900">
              Rs. {amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1 font-medium">
              Created: {safeDate(caseData.createdAt)}
            </div>
          </div>
        </div>

        {/* 2-Column Inspector Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Forensics & Telemetry (2 cols) */}
          <div className="lg:col-span-2 space-y-6">

            {/* Counterparty Intelligence */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900">Counterparty Intelligence</h3>
                </div>
                <span className="text-xs text-gray-500 font-medium">
                  Ref: <strong className="text-gray-900">{caseData.queueCode || caseData.transactionId}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-lg space-y-1">
                  <span className="text-gray-500 font-semibold uppercase text-[11px] block">Sender / Customer</span>
                  <strong className="text-gray-900 text-sm block">{safeString(caseData.senderName, 'K. Perera')}</strong>
                  <span className="font-mono text-gray-500 block">ID: {safeString(caseData.senderId, 'USR-4421')}</span>
                </div>

                <div className="p-3.5 bg-slate-50 border border-gray-200 rounded-lg space-y-1">
                  <span className="text-gray-500 font-semibold uppercase text-[11px] block">Recipient / Beneficiary</span>
                  <strong className="text-gray-900 text-sm block">{safeString(caseData.recipientName, 'M. Fernando')}</strong>
                  <span className="font-mono text-gray-500 block">ID: {safeString(caseData.recipientId, 'USR-2187')}</span>
                </div>
              </div>
            </div>

            {/* AI Risk Drivers */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-600" /> AI Risk Signal Drivers (SHAP Value Breakdown)
              </h3>
              <div className="space-y-2.5">
                {flagReasons.map((flag, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-gray-200 text-xs">
                    <span className="font-semibold text-gray-800">{flag.label || flag.description}</span>
                    <span className="font-extrabold text-red-600 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                      {flag.impact || '+25'} pts
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Geolocation & Device Telemetry Map */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900">Geolocation &amp; Device Telemetry</h3>
                </div>
                <span className="text-xs font-mono font-bold text-blue-600">
                  {safeString(caseData.originIp, '203.143.88.71')}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500 block text-[11px]">DEVICE SESSION</span>
                  <strong className="text-gray-900">{safeString(caseData.device, 'Pixel 7 — Android 14')}</strong>
                </div>
                <div>
                  <span className="text-gray-500 block text-[11px]">COORDINATES</span>
                  <strong className="text-gray-900">{caseData.latitude || 6.9319}, {caseData.longitude || 79.8478}</strong>
                </div>
              </div>

              <div className="h-48 rounded-lg overflow-hidden border border-gray-200">
                <TransactionMap latitude={caseData.latitude} longitude={caseData.longitude} />
              </div>
            </div>

          </div>

          {/* Right Column: Decision Terminal (1 col) */}
          <div className="space-y-6">

            {/* Adjudication Decision Console */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" /> Analyst Decision Console
              </h3>

              {isDualApprovalRequired && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 leading-relaxed">
                  <strong>Maker-Checker Notice:</strong> High-value transactions (&ge; Rs. 75,000) require secondary dual-approval release before funds are disbursed.
                </div>
              )}

              {/* Mandatory Notes Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                  Compliance Rationale &amp; Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter mandatory compliance notes and audit rationale before recording decision..."
                  className="w-full p-3 bg-slate-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                />
              </div>

              {/* Decision Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => handleDecision('Approved')}
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Approve Transaction
                </button>

                <button
                  onClick={() => handleDecision('Rejected')}
                  disabled={isSubmitting}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Reject &amp; Block Transaction
                </button>

                <button
                  onClick={() => handleDecision('Escalate')}
                  disabled={isSubmitting}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <AlertOctagon className="w-4 h-4" /> Escalate to Senior Analyst
                </button>

                <button
                  onClick={() => handleDecision('Request More Info')}
                  disabled={isSubmitting}
                  className="w-full border border-gray-300 bg-white hover:bg-slate-50 text-gray-700 font-semibold py-2.5 px-4 text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <HelpCircle className="w-4 h-4" /> Request Information
                </button>
              </div>
            </div>

          </div>

        </div>

        {/* Chronological Audit Decision History */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            Decision Audit Trail for this Case
          </h3>

          {history.length === 0 ? (
            <div className="text-xs text-gray-400 italic py-2">
              No previous audit decisions logged yet for this transaction case.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-slate-50 border border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">
                      Decision: <span className="text-blue-600">{safeString(h.decision)}</span> (Level {h.approvalLevel || 1})
                    </span>
                    <span className="text-gray-400 font-medium">
                      {safeDate(h.decidedAt)}
                    </span>
                  </div>
                  {h.notes && (
                    <div className="text-gray-600 italic">
                      &ldquo;{safeString(h.notes)}&rdquo;
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500">
                    <strong>Analyst:</strong> {safeString(h.analystName, 'Compliance Analyst')} ({safeString(h.analystEmpId || h.analystId, 'ANL-001')})
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Escalation Modal */}
      {isEscalateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full p-6 space-y-5">
            <div className="flex justify-between items-start border-b border-gray-100 pb-3">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <AlertOctagon className="w-5 h-5 text-amber-600" />
                Escalate Case
              </h3>
              <button
                onClick={() => setIsEscalateModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Select Analyst:
                </label>
                {isLoadingAnalysts ? (
                  <div className="p-2 text-gray-400 text-xs">Loading available staff from database...</div>
                ) : (
                  <select
                    value={selectedTargetAnalystId}
                    onChange={(e) => setSelectedTargetAnalystId(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs font-semibold text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    {availableAnalysts.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.role})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block font-semibold text-gray-700 uppercase mb-1">
                  Reason: <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={escalationNotes}
                  onChange={(e) => setEscalationNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="State the reason for escalating..."
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => setIsEscalateModalOpen(false)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-xs font-semibold text-gray-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitEscalation}
                disabled={isSubmittingEscalation}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingEscalation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Escalate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CaseDetailPage(props) {
  return (
    <CaseErrorBoundary>
      <CaseDetailPageInner {...props} />
    </CaseErrorBoundary>
  );
}
