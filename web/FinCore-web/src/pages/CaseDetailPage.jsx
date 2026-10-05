import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldAlert,
  FileCheck2,
  ArrowUpRight,
  Layers
} from 'lucide-react';
import { reviewService } from '../services/reviewService';
import { useAuth } from '../context/AuthContext';

export default function CaseDetailPage() {
  const { id: paramId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const id = paramId || searchParams.get('caseId') || searchParams.get('id') || searchParams.get('queueId') || searchParams.get('txId');
  const [caseData, setCaseData] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCase = async (lookupId) => {
    const targetId = lookupId || id;
    if (!targetId) {
      // If no ID is provided, try loading the latest case from the queue or show prompt
      try {
        setIsLoading(true);
        const data = await reviewService.getCaseById('latest');
        if (data && (data.item || data.id || data.queueCode)) {
          const item = data.item || data;
          setCaseData({
            ...item,
            assignedAnalystName: data.assignedAnalystName || item.assignedAnalystName,
            assignedAnalystEmpId: data.assignedAnalystEmpId || item.assignedAnalystEmpId,
            escalatedByName: data.escalatedByName || item.escalatedByName,
            escalatedByEmpId: data.escalatedByEmpId || item.escalatedByEmpId,
            escalationReason: data.escalationReason || item.escalationReason
          });
          setHistory(Array.isArray(data.history) ? data.history : []);
          setIsLoading(false);
          return;
        }
      } catch (e) {
        // Fall through to empty state
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
        assignedAnalystName: data.assignedAnalystName || item.assignedAnalystName,
        assignedAnalystEmpId: data.assignedAnalystEmpId || item.assignedAnalystEmpId,
        escalatedByName: data.escalatedByName || item.escalatedByName,
        escalatedByEmpId: data.escalatedByEmpId || item.escalatedByEmpId,
        escalationReason: data.escalationReason || item.escalationReason
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
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
            {error || `Unable to load case record.`}
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
  const currentUserId = user?.id;
  const currentUserName = user?.fullName || user?.name || user?.email;
  const isAssignedToMe = Boolean(
    (caseData?.assignedAnalystId && currentUserId && String(caseData.assignedAnalystId).toLowerCase() === String(currentUserId).toLowerCase()) ||
    (currentUserName && caseData?.assignedAnalystName && caseData.assignedAnalystName.toLowerCase() === currentUserName.toLowerCase())
  );

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

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Back Button */}
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Audit Trail
          </button>
        </div>

        {/* Case Header Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              CASE AUDIT DOSSIER
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
              {caseData.queueCode || caseData.transactionId}
            </h1>
            <div className="flex items-center gap-2 mt-3 flex-wrap text-xs font-semibold">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Status: {caseData.status}
              </span>
              <span className={`px-2.5 py-1 rounded-full ${
                score >= 70 ? 'bg-red-50 text-red-600' : score >= 40 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                Risk Score: {score}/100 ({caseData.priorityLabel || (score >= 70 ? 'CRITICAL' : 'HIGH')})
              </span>
              {caseData.status === 'Escalated' && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {isAssignedToMe
                    ? `Assigned to you by ${caseData.escalatedByName || 'Analyst'}`
                    : `Escalated to: ${caseData.assignedAnalystName || 'Analyst'}`}
                </span>
              )}
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              TRANSACTION AMOUNT
            </div>
            <div className="text-2xl md:text-3xl font-extrabold text-gray-900">
              Rs. {Number(caseData.amount || caseData.transactionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1 font-medium">
              Created: {caseData.createdAt ? new Date(caseData.createdAt).toLocaleString() : 'N/A'}
            </div>
          </div>
        </div>

        {/* Counterparty & Telemetry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Counterparty Intelligence
            </h3>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-gray-500 block text-[11px]">SENDER</span>
                <strong className="text-gray-900 text-sm">{caseData.senderName || 'N/A'}</strong>
                <span className="font-mono text-gray-500 ml-2">({caseData.senderId || 'ACC-SENDER'})</span>
              </div>
              <div>
                <span className="text-gray-500 block text-[11px]">RECIPIENT</span>
                <strong className="text-gray-900 text-sm">{caseData.recipientName || 'N/A'}</strong>
                <span className="font-mono text-gray-500 ml-2">({caseData.recipientId || 'ACC-RECIPIENT'})</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Device Telemetry
            </h3>
            <div className="space-y-1.5 text-xs text-gray-700">
              <div><span className="text-gray-500">Origin IP:</span> <code className="text-blue-600 font-bold">{caseData.originIp || '203.143.88.71'}</code></div>
              <div><span className="text-gray-500">Device Session:</span> {caseData.device || 'Android 14 / Mobile App'}</div>
              <div><span className="text-gray-500">Coordinates:</span> {caseData.latitude || 6.9271}, {caseData.longitude || 79.8612}</div>
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
              No audit decisions logged yet for this transaction case.
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((h, i) => (
                <div key={i} className="p-3.5 rounded-lg bg-slate-50 border border-gray-200 text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-900">
                      Decision: <span className="text-blue-600">{h.decision}</span> (Level {h.approvalLevel})
                    </span>
                    <span className="text-gray-400 font-medium">
                      {new Date(h.decidedAt).toLocaleString()}
                    </span>
                  </div>
                  {h.notes && (
                    <div className="text-gray-600 italic">
                      &ldquo;{h.notes}&rdquo;
                    </div>
                  )}
                  <div className="text-[11px] text-gray-500">
                    <strong>Analyst:</strong> {h.analystName ? `${h.analystName} (${h.analystEmpId || 'ANL-001'})` : (h.analystEmpId || 'ANL-001')}
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
