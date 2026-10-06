import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { reviewService } from '../services/reviewService';
import TransactionMap from '../components/TransactionMap';
import RuleConfigurationPanel from '../components/fraud/RuleConfigurationPanel';
import FraudFlagList from '../components/fraud/FraudFlagList';
import FlagDetailBreakdown from '../components/fraud/FlagDetailBreakdown';
import FlaggingTrendsDashboard from '../components/fraud/FlaggingTrendsDashboard';
import AnalystPerformanceDashboard from '../components/analyst/AnalystPerformanceDashboard';
import DecisionHistoryTable from '../components/analyst/DecisionHistoryTable';
import FinancialReversalsPage from './admin/FinancialReversalsPage';
import TransactionMonitoringDashboard from './admin/TransactionMonitoringDashboard';
import { useAuth } from '../context/AuthContext';
import {
    LayoutDashboard,
    Inbox,
    FileText,
    Flag,
    Sliders,
    RotateCcw,
    FileCheck2,
    BarChart3,
    AlertTriangle,
    CheckCircle,
    XCircle,
    ArrowUpRight,
    RefreshCw,
    ShieldAlert,
    Smartphone,
    ArrowLeft,
    Clock,
    Database,
    Check,
    HelpCircle,
    UserCheck,
    History,
    Activity,
    TrendingUp,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    Search,
    Bell
} from 'lucide-react';

export default function AnalystReviewPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const isAdmin = user?.role === 'Admin';
    const [activeTab, setActiveTab] = useState('review-queue'); // 'review-queue' | 'case-detail' | 'analytics' | 'audit-logs'
    const [queue, setQueue] = useState([]);
    const [selectedCase, setSelectedCase] = useState(null);
    const [selectedFraudFlag, setSelectedFraudFlag] = useState(null);
    const [caseHistory, setCaseHistory] = useState([]);
    const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'ASSIGNED_TO_ME' | 'CRITICAL' | 'DUAL'
    const [searchQuery, setSearchQuery] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [actionFeedback, setActionFeedback] = useState(null);
    const [metrics, setMetrics] = useState({
        totalCases: 0,
        decidedCases: 0,
        pendingCases: 0,
        critical: 0,
        unassigned: 0,
        underReview: 0,
        approvedCount: 0,
        rejectedCount: 0,
        escalatedCount: 0,
        infoRequestedCount: 0,
        approvalRate: 0,
        rejectionRate: 0,
        averageDecisionTimeMinutes: 4.2
    });

    const currentAnalystId = user?.id || "22222222-2222-2222-2222-222222222222";
    const currentAnalystEmpId = user?.employeeId || "ANL-001";
    const currentAnalystName = user?.fullName || user?.name || user?.email || "Analyst";

    // Escalation Modal & Staff Selection states
    const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false);
    const [availableAnalysts, setAvailableAnalysts] = useState([]);
    const [selectedTargetAnalystId, setSelectedTargetAnalystId] = useState('');
    const [escalationNotes, setEscalationNotes] = useState('');
    const [isLoadingAnalysts, setIsLoadingAnalysts] = useState(false);
    const [isSubmittingEscalation, setIsSubmittingEscalation] = useState(false);

    // Live In-App Notifications state
    const [notifications, setNotifications] = useState([]);
    const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);

    // Format and normalize a case from either DB or fallback
    const normalizeCase = (item, idx) => {
        const isDual = (item.amount || 75000) >= 75000;

        let parsedFlagReasons = [];
        if (item.flagReasonsJson) {
            try {
                parsedFlagReasons = typeof item.flagReasonsJson === 'string'
                    ? JSON.parse(item.flagReasonsJson)
                    : item.flagReasonsJson;
            } catch (e) {
                parsedFlagReasons = [];
            }
        }

        if (!parsedFlagReasons || parsedFlagReasons.length === 0) {
            parsedFlagReasons = [
                { label: 'Amount 3× User Average', impact: '+30', color: '#f59e0b' },
                { label: 'Unrecognized Device Fingerprint', impact: '+25', color: '#ef4444' },
                { label: 'Geolocation Mismatch > 200km', impact: '+32', color: '#ef4444' }
            ];
        }

        const priorityLabel = item.priorityLabel || (item.priority === 3 ? 'CRITICAL' : item.priority === 2 ? 'HIGH' : 'MEDIUM');
        const queueCode = item.queueCode || `Q-${104 - idx}`;
        const txIdStr = item.transactionId ? String(item.transactionId) : '';
        const txCode = (item.queueCode && item.queueCode.startsWith('TRX'))
            ? item.queueCode
            : (txIdStr.length > 8 ? `TX-${txIdStr.substring(0, 8).toUpperCase()}` : (txIdStr || `TX-8829${1 - idx}`));

        const isAssignedToMe = Boolean(
            (item.assignedAnalystId && String(item.assignedAnalystId).toLowerCase() === String(currentAnalystId).toLowerCase()) ||
            (user?.fullName && item.assignedAnalystName && item.assignedAnalystName.toLowerCase() === user.fullName.toLowerCase())
        );

        let displayAssigned = 'Unassigned';
        if (item.status === 'Escalated') {
            if (isAssignedToMe) {
                displayAssigned = `Assigned to you by ${item.escalatedByName || 'Analyst'}`;
            } else {
                displayAssigned = `Escalated to: ${item.assignedAnalystName || 'Senior Analyst'}`;
            }
        } else if (isAssignedToMe) {
            displayAssigned = 'Assigned to You';
        } else if (item.assignedAnalystName) {
            displayAssigned = item.assignedAnalystName;
        } else if (item.assignedAnalystId) {
            displayAssigned = 'Assigned';
        }

        return {
            ...item,
            id: item.id || `case-${idx}`,
            transactionId: item.transactionId || `tx-${idx}`,
            queueId: queueCode,
            txCode: txCode,
            priority: priorityLabel,
            customerName: item.senderName || 'K. Perera',
            customerId: item.senderId || 'USR-4421',
            recipientName: item.recipientName ? `${item.recipientName} (${item.recipientId || 'USR-2187'})` : 'M. Fernando (USR-2187)',
            amount: Number(item.amount) || 75000,
            riskScore: Number(item.riskScore) || 87,
            assignedAnalyst: displayAssigned,
            assignedAnalystName: item.assignedAnalystName,
            escalatedByName: item.escalatedByName,
            escalationReason: item.escalationReason,
            isAssignedToMe: isAssignedToMe,
            assignedAnalystId: item.assignedAnalystId,
            originIp: item.originIp || '203.143.88.71',
            device: item.device || 'Pixel 7 — Android 14',
            latitude: item.latitude || 6.9319,
            longitude: item.longitude || 79.8478,
            requiresDualApproval: isDual,
            flagReasons: parsedFlagReasons,
            status: item.status || 'Queued',
            createdAt: item.createdAt || new Date().toISOString()
        };
    };

    const loadData = async () => {
        setLoading(true);
        try {
            const data = await reviewService.getQueue();
            const allItems = data.items || [];
            const validItems = allItems.filter(item => item.queueCode && item.queueCode.trim() !== '' && (Number(item.amount) > 0 || item.senderName));
            const enriched = validItems.map((item, index) => normalizeCase(item, index));
            setQueue(enriched);
            if (enriched.length > 0 && !selectedCase) {
                setSelectedCase(enriched[0]);
                loadHistory(enriched[0].transactionId);
            }

            try {
                const perf = await reviewService.getPerformanceMetrics();
                setMetrics(perf);
            } catch (perfErr) {
                console.warn("Could not load performance stats, using default", perfErr);
            }
        } catch (err) {
            console.error("Queue load error:", err);
        } finally {
            setLoading(false);
        }
    };

    const loadHistory = async (transactionId) => {
        if (!transactionId) return;
        try {
            const history = await reviewService.getHistory(transactionId);
            setCaseHistory(history || []);
        } catch (err) {
            setCaseHistory([]);
        }
    };

    const loadNotifications = async () => {
        try {
            const params = {};
            if (currentAnalystId) {
                params.userGuid = currentAnalystId;
            }
            if (user?.email) {
                params.recipient = user.email;
            }
            const res = await axios.get('/api/notifications', { params });
            const items = res.data?.items || [];
            setNotifications(items);
        } catch (e) {
            // Non-critical background fetch
        }
    };

    useEffect(() => {
        loadData();
        loadNotifications();
        const interval = setInterval(() => {
            reviewService.getQueue().then(data => {
                const allItems = data.items || [];
                const validItems = allItems.filter(item => item.queueCode && item.queueCode.trim() !== '' && (Number(item.amount) > 0 || item.senderName));
                const enriched = validItems.map((item, index) => normalizeCase(item, index));
                setQueue(enriched);
            }).catch(e => console.error("Silent queue refresh error:", e));
            loadNotifications();
        }, 3000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const caseIdParam = searchParams.get('caseId');
        const tabParam = searchParams.get('tab');
        if (caseIdParam) {
            setActiveTab('case-detail');
            const match = queue.find(q => 
                q.queueId === caseIdParam || 
                q.transactionId === caseIdParam || 
                q.queueCode === caseIdParam ||
                q.txCode === caseIdParam ||
                String(q.id) === String(caseIdParam)
            );
            if (match) {
                setSelectedCase(match);
                loadHistory(match.transactionId);
            } else {
                reviewService.getCaseById(caseIdParam).then(res => {
                    const raw = res.item || res;
                    if (raw && (raw.transactionId || raw.queueCode)) {
                        const normalized = normalizeCase(raw, queue.length);
                        setSelectedCase(normalized);
                        loadHistory(normalized.transactionId);
                    }
                }).catch(e => console.warn("Failed to load case by param:", e));
            }
        } else if (tabParam) {
            setActiveTab(tabParam);
        }
    }, [searchParams, queue.length]);

    const handleOpenCase = (item) => {
        setSelectedCase(item);
        setActionFeedback(null);
        loadHistory(item.transactionId);
        const targetId = item.queueId || item.transactionId || item.id || item.queueCode;
        if (targetId) {
            navigate(`/analyst/cases/${encodeURIComponent(targetId)}`);
        } else {
            navigate('/analyst/cases');
        }
    };

    const handleAssignToMe = async (item, e) => {
        if (e) e.stopPropagation();
        try {
            await reviewService.assignCase(item.transactionId, currentAnalystId);
            setActionFeedback({
                type: 'info',
                message: `Case ${item.queueId} successfully assigned to you.`
            });
            await loadData();
            if (selectedCase?.transactionId === item.transactionId) {
                loadHistory(item.transactionId);
            }
        } catch (err) {
            alert("Assignment failed: " + (err.response?.data?.message || err.message));
        }
    };

    const handleOpenEscalateModal = async () => {
        if (!selectedCase) return;
        setIsEscalateModalOpen(true);
        setEscalationNotes(notes.trim() || 'Escalation to senior analyst for in-depth fraud investigation.');
        setIsLoadingAnalysts(true);
        try {
            const staff = await reviewService.getAvailableAnalysts();
            const eligibleStaff = Array.isArray(staff)
                ? staff.filter(s => s.role === 'Admin' || s.role === 'Analyst' || s.role === 'Fraud Analyst' || s.role === 'System Admin')
                : [];
            setAvailableAnalysts(eligibleStaff);

            const otherStaff = eligibleStaff.filter(s => String(s.id).toLowerCase() !== String(currentAnalystId).toLowerCase());
            if (otherStaff.length > 0) {
                setSelectedTargetAnalystId(otherStaff[0].id);
            } else if (eligibleStaff.length > 0) {
                setSelectedTargetAnalystId(eligibleStaff[0].id);
            }
        } catch (err) {
            console.error("Failed to load analysts from database:", err);
        } finally {
            setIsLoadingAnalysts(false);
        }
    };

    const handleConfirmEscalation = async () => {
        if (!selectedCase) return;
        if (!selectedTargetAnalystId) {
            alert("Please select a recipient analyst from the list.");
            return;
        }
        if (!escalationNotes.trim()) {
            alert("Please provide an escalation rationale / reason.");
            return;
        }

        setIsSubmittingEscalation(true);
        try {
            const target = availableAnalysts.find(a => String(a.id).toLowerCase() === String(selectedTargetAnalystId).toLowerCase());
            const targetName = target ? target.name : 'Senior Analyst';

            await reviewService.escalateCase(selectedCase.transactionId, {
                analystId: currentAnalystId,
                targetAnalystId: selectedTargetAnalystId,
                targetAnalystName: targetName,
                reason: escalationNotes.trim()
            });

            const isAssignedToMe = String(selectedTargetAnalystId).toLowerCase() === String(currentAnalystId).toLowerCase();
            const updatedCase = {
                ...selectedCase,
                status: 'Escalated',
                priority: 'CRITICAL',
                assignedAnalystId: selectedTargetAnalystId,
                assignedAnalystName: targetName,
                escalatedByName: currentAnalystName,
                escalationReason: escalationNotes.trim(),
                assignedAnalyst: isAssignedToMe
                    ? `Assigned to you by ${currentAnalystName}`
                    : `Escalated to: ${targetName}`,
                isAssignedToMe: isAssignedToMe
            };

            setSelectedCase(updatedCase);
            setQueue(prev => prev.map(q => (q.id === selectedCase.id || q.transactionId === selectedCase.transactionId) ? updatedCase : q));

            setActionFeedback({
                type: 'escalate',
                message: `Case ${selectedCase.queueId} escalated to ${targetName} with CRITICAL priority.`
            });

            setIsEscalateModalOpen(false);
            setNotes('');
            loadHistory(selectedCase.transactionId);
            await loadData();
            await loadNotifications();
        } catch (err) {
            console.error("Escalation failed:", err);
            alert("Escalation failed: " + (err.response?.data?.message || err.message));
        } finally {
            setIsSubmittingEscalation(false);
        }
    };

    const handleDecision = async (decision) => {
        if (!selectedCase) return;

        if (decision === 'Escalate') {
            handleOpenEscalateModal();
            return;
        }

        if (!notes.trim()) {
            alert("Analyst Notes are mandatory to record the review rationale before submitting a decision.");
            return;
        }

        try {
            if (decision === 'Request More Info') {
                await reviewService.decideCase(selectedCase.transactionId, {
                    analystId: currentAnalystId,
                    decision: 'Request More Info',
                    notes: notes,
                    transactionAmount: selectedCase.amount
                });
                setActionFeedback({
                    type: 'info',
                    message: `Information requested from customer/branch for case ${selectedCase.queueId}.`
                });
            } else if (selectedCase.status === 'PendingSecondApproval') {
                await reviewService.secondApproval(selectedCase.transactionId, {
                    secondAnalystId: currentAnalystId,
                    analystId: currentAnalystId,
                    decision: decision,
                    notes: notes
                });
                setActionFeedback({
                    type: decision === 'Approved' ? 'approved' : 'rejected',
                    message: `Secondary approval (Level 2) [${decision}] successfully executed for ${selectedCase.queueId}. Transaction is now finalized.`
                });
            } else {
                const result = await reviewService.decideCase(selectedCase.transactionId, {
                    analystId: currentAnalystId,
                    decision: decision,
                    notes: notes,
                    transactionAmount: selectedCase.amount
                });

                if (result.requiresSecondApproval) {
                    setActionFeedback({
                        type: 'dual',
                        message: `Primary approval recorded for ${selectedCase.queueId}. Exceeds Rs. 75,000 threshold and is now pending secondary approval.`
                    });
                } else {
                    setActionFeedback({
                        type: decision === 'Approved' ? 'approved' : 'rejected',
                        message: `Decision [${decision}] recorded for case ${selectedCase.queueId}.`
                    });
                }
            }

            setNotes('');
            await loadData();
            await loadHistory(selectedCase.transactionId);

            setTimeout(() => {
                setActiveTab('review-queue');
            }, 1200);
        } catch (e) {
            alert("Error processing decision: " + (e.response?.data?.message || e.message));
        }
    };

    const filteredQueue = queue.filter(item => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchesSearch =
                (item.queueId && item.queueId.toLowerCase().includes(q)) ||
                (item.customerName && item.customerName.toLowerCase().includes(q)) ||
                (item.customerId && item.customerId.toLowerCase().includes(q)) ||
                (item.txCode && item.txCode.toLowerCase().includes(q)) ||
                (item.originIp && item.originIp.toLowerCase().includes(q)) ||
                (item.device && item.device.toLowerCase().includes(q));
            if (!matchesSearch) return false;
        }

        if (filterType === 'ASSIGNED_TO_ME') return item.isAssignedToMe || item.assignedAnalystId === currentAnalystId;
        if (filterType === 'CRITICAL') return item.priority === 'CRITICAL' || item.riskScore >= 75;
        if (filterType === 'DUAL') return item.requiresDualApproval;
        if (filterType === 'ESCALATED') return item.status === 'Escalated';
        return true;
    });

    const activeCaseList = (filteredQueue && filteredQueue.length > 0) ? filteredQueue : queue;
    const currentCaseIndex = activeCaseList.findIndex(
        c => (c.transactionId && c.transactionId === selectedCase?.transactionId) || (c.id && c.id === selectedCase?.id)
    );
    const hasPrevCase = currentCaseIndex > 0;
    const hasNextCase = currentCaseIndex >= 0 && currentCaseIndex < activeCaseList.length - 1;

    useEffect(() => {
        if (activeTab === 'case-detail' && !selectedCase && queue.length > 0) {
            setSelectedCase(queue[0]);
            loadHistory(queue[0].transactionId);
        }
    }, [activeTab, selectedCase, queue]);

    const getScoreBadgeColor = (score) => {
        if (score >= 70) return 'bg-red-50 text-red-600 border-red-200';
        if (score >= 40) return 'bg-amber-50 text-amber-700 border-amber-200';
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    };

    const getScoreBarFillColor = (score) => {
        if (score >= 70) return 'bg-red-600';
        if (score >= 40) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    return (
        <div className="flex min-h-screen w-full bg-slate-50 font-sans text-gray-900">

            {/* 1. Left Dark Navy Sidebar (bg-slate-900) */}
            <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800 min-h-screen select-none">
                {/* Brand */}
                <div className="p-5 border-b border-slate-800 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-600 text-white font-extrabold flex items-center justify-center text-sm shadow-md shadow-blue-600/30">
                        FC
                    </div>
                    <div>
                        <div className="font-bold text-base tracking-tight text-white">FinCore</div>
                        <div className="text-[10px] text-slate-400 font-bold tracking-wider uppercase">FRAUD INTELLIGENCE</div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav className="p-3 flex flex-col gap-1 flex-1 overflow-y-auto">

                    {/* MONITORING Category */}
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 mt-2">
                        MONITORING
                    </div>

                    <button
                        onClick={() => navigate('/admin/transactions')}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-sky-400 bg-slate-800/80 border border-sky-500/30 hover:bg-slate-800 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <Activity className="w-4 h-4" /> Transaction Monitoring
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>

                    {/* FRAUD DETECTION Category */}
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 mt-3">
                        FRAUD DETECTION
                    </div>

                    <button
                        onClick={() => setActiveTab('fraud-flags')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'fraud-flags' || activeTab === 'flag-detail'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Flag className="w-4 h-4" /> Fraud Flags
                        </div>
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            LIVE
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('fraud-rules')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'fraud-rules'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Sliders className="w-4 h-4" /> Fraud Rules
                        </div>
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            Thresholds
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('fraud-trends')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'fraud-trends'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <TrendingUp className="w-4 h-4" /> Flagging Trends
                    </button>

                    {/* ANALYST REVIEW Category */}
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 mt-3">
                        ANALYST REVIEW
                    </div>

                    <button
                        onClick={() => setActiveTab('review-queue')}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'review-queue'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <Inbox className="w-4 h-4" /> Review Queue
                        </div>
                        <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                            {metrics.totalCases || queue.length || 0}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            const targetId = selectedCase?.queueId || selectedCase?.transactionId || selectedCase?.id || (queue.length > 0 ? (queue[0].queueId || queue[0].transactionId || queue[0].id) : '');
                            if (targetId) {
                                navigate(`/analyst/cases/${encodeURIComponent(targetId)}`);
                            } else {
                                navigate('/analyst/cases');
                            }
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'case-detail'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <div className="flex items-center gap-2.5">
                            <FileText className="w-4 h-4" /> Case Detail
                        </div>
                        {(selectedCase || queue.length > 0) && (
                            <span className="text-[10px] font-bold text-slate-400 font-mono">
                                {selectedCase?.queueId || queue[0]?.queueId}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'analytics'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <BarChart3 className="w-4 h-4" /> Analytics &amp; Performance
                    </button>

                    <button
                        onClick={() => setActiveTab('audit-logs')}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                            activeTab === 'audit-logs'
                                ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                        }`}
                    >
                        <FileCheck2 className="w-4 h-4" /> Audit Trails &amp; History
                    </button>

                    {/* FINANCIAL CORE Category (Admin) */}
                    {isAdmin && (
                        <>
                            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3 py-2 mt-3">
                                FINANCIAL CORE &amp; LEDGER
                            </div>

                            <button
                                onClick={() => setActiveTab('transaction-monitor')}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                                    activeTab === 'transaction-monitor'
                                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <Activity className="w-4 h-4" /> Transaction Monitor
                            </button>

                            <button
                                onClick={() => setActiveTab('reversals')}
                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                                    activeTab === 'reversals'
                                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                                }`}
                            >
                                <RotateCcw className="w-4 h-4" /> Reversal Action
                            </button>
                        </>
                    )}
                </nav>

                {/* Bottom User Profile */}
                <div className="p-3 m-3 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">
                        {user?.fullName ? user.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'AN'}
                    </div>
                    <div className="overflow-hidden">
                        <div className="text-xs font-semibold text-slate-100 truncate">{user?.fullName || 'Analyst Console'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">BADGE: {user?.employeeId || (isAdmin ? 'ADM-001' : 'ANL-001')}</div>
                    </div>
                </div>
            </aside>

            {/* 2. Main Content Area */}
            <main className="flex-1 flex flex-col min-h-screen bg-slate-50 overflow-hidden">

                {/* Top Header Bar matching dark theme sidebar */}
                <header className="h-14 bg-slate-900 border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
                    {/* Global Search Bar */}
                    <div className="flex items-center gap-2.5 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-lg w-80">
                        <Search className="w-4 h-4 text-slate-400 shrink-0" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search case ID, customer, TX code, IP..."
                            className="bg-transparent border-none text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="text-slate-400 hover:text-white text-xs cursor-pointer"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Right Indicators & User Profile Badge */}
                    <div className="flex items-center gap-4">
                        {/* Live Production Pill */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-400 bg-sky-950/60 border border-sky-500/30 px-3 py-1 rounded-full shadow-[0_0_8px_rgba(56,189,248,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                            Live Production
                        </div>

                        {/* AI Pipeline Pill */}
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            AI Pipeline: Operational
                        </div>

                        {/* User Profile Badge with Role Tag */}
                        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1 rounded-full border border-slate-700/60">
                            <span className="text-xs font-semibold text-slate-200">
                                {user?.fullName || 'Analyst'}
                            </span>
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                {user?.role?.toUpperCase() || 'ANALYST'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Main Content Workspace (Light Background) */}
                <div className="flex-1 p-6 md:p-8 overflow-y-auto bg-slate-50">

                    {/* Feedback Alert */}
                    {actionFeedback && (
                        <div className={`mb-6 p-4 rounded-lg border text-sm font-medium flex items-center justify-between shadow-sm ${
                            actionFeedback.type === 'approved' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
                            actionFeedback.type === 'rejected' ? 'bg-red-50 border-red-200 text-red-800' :
                            actionFeedback.type === 'escalate' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                            'bg-blue-50 border-blue-200 text-blue-800'
                        }`}>
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 shrink-0" />
                                <span>{actionFeedback.message}</span>
                            </div>
                            <button onClick={() => setActionFeedback(null)} className="text-gray-400 hover:text-gray-600 font-bold">
                                ✕
                            </button>
                        </div>
                    )}

                    {/* VIEW: REVIEW QUEUE */}
                    {activeTab === 'review-queue' && (
                        <div className="space-y-6">

                            {/* Header & Breadcrumb */}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Platform &gt; Review Queue
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
                                        Analyst Review Queue
                                    </h1>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={loadData}
                                        disabled={loading}
                                        className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 font-medium px-4 py-2 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                                        Refresh Queue
                                    </button>
                                </div>
                            </div>

                            {/* Metric Cards (KPIs) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                                {/* Total Cases */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Total Active Cases
                                    </div>
                                    <div className="text-2xl md:text-3xl font-extrabold text-gray-900">
                                        {metrics.totalCases || queue.length || 0}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-1 font-medium">
                                        Pending Analyst Inspection
                                    </div>
                                </div>

                                {/* Critical Priority */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Critical Cases (&ge;75 Risk)
                                    </div>
                                    <div className="text-2xl md:text-3xl font-extrabold text-red-600">
                                        {queue.filter(q => q.priority === 'CRITICAL' || q.riskScore >= 75).length}
                                    </div>
                                    <div className="text-xs text-red-600 mt-1 font-medium">
                                        Immediate Action Required
                                    </div>
                                </div>

                                {/* Assigned to Me */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Assigned to You
                                    </div>
                                    <div className="text-2xl md:text-3xl font-extrabold text-blue-600">
                                        {queue.filter(q => q.isAssignedToMe).length}
                                    </div>
                                    <div className="text-xs text-blue-600 mt-1 font-medium">
                                        Your Active Workload
                                    </div>
                                </div>

                                {/* Average Decision Time */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                                        Avg Decision Speed
                                    </div>
                                    <div className="text-2xl md:text-3xl font-extrabold text-emerald-600">
                                        {metrics.averageDecisionTimeMinutes || 4.2}m
                                    </div>
                                    <div className="text-xs text-emerald-600 mt-1 font-medium">
                                        SLA Target: &lt; 10m
                                    </div>
                                </div>
                            </div>

                            {/* Filter Pills Toolbar */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
                                    <span className="text-xs font-semibold text-gray-500 uppercase mr-2">Filter:</span>
                                    
                                    <button
                                        onClick={() => setFilterType('ALL')}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                            filterType === 'ALL'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        All Cases ({queue.length})
                                    </button>

                                    <button
                                        onClick={() => setFilterType('ASSIGNED_TO_ME')}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                            filterType === 'ASSIGNED_TO_ME'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Assigned to Me ({queue.filter(q => q.isAssignedToMe).length})
                                    </button>

                                    <button
                                        onClick={() => setFilterType('CRITICAL')}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                            filterType === 'CRITICAL'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Critical Risk ({queue.filter(q => q.priority === 'CRITICAL' || q.riskScore >= 75).length})
                                    </button>

                                    <button
                                        onClick={() => setFilterType('DUAL')}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                            filterType === 'DUAL'
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Dual Approval (&gt;Rs. 75k)
                                    </button>

                                    <button
                                        onClick={() => setFilterType('ESCALATED')}
                                        className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                                            filterType === 'ESCALATED'
                                                ? 'bg-amber-600 text-white shadow-sm'
                                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        Escalated Cases ({queue.filter(q => q.status === 'Escalated').length})
                                    </button>
                                </div>

                                <div className="text-xs text-gray-500 font-medium">
                                    Showing <strong className="text-gray-900">{filteredQueue.length}</strong> of {queue.length} cases
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                                <th className="px-6 py-3.5">Queue ID</th>
                                                <th className="px-6 py-3.5">Customer / Sender</th>
                                                <th className="px-6 py-3.5 text-right">Amount (LKR)</th>
                                                <th className="px-6 py-3.5 text-center">Risk Score</th>
                                                <th className="px-6 py-3.5">Priority / Status</th>
                                                <th className="px-6 py-3.5">Assigned Staff</th>
                                                <th className="px-6 py-3.5 text-right">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-sm">
                                            {loading && queue.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                        <div className="flex items-center justify-center gap-2">
                                                            <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                                                            <span>Loading queue items...</span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : filteredQueue.length === 0 ? (
                                                <tr>
                                                    <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                                        No review cases match the selected filter.
                                                    </td>
                                                </tr>
                                            ) : (
                                                filteredQueue.map((item) => (
                                                    <tr
                                                        key={item.id}
                                                        onClick={() => handleOpenCase(item)}
                                                        className="hover:bg-slate-50 border-b border-gray-100 transition-colors cursor-pointer"
                                                    >
                                                        {/* Queue ID */}
                                                        <td className="px-6 py-4 font-mono font-bold text-blue-600 hover:underline">
                                                            {item.queueId}
                                                            <div className="text-[11px] font-normal text-gray-400">{item.txCode}</div>
                                                        </td>

                                                        {/* Customer */}
                                                        <td className="px-6 py-4">
                                                            <div className="font-semibold text-gray-900">{item.customerName}</div>
                                                            <div className="text-xs text-gray-500 font-mono">{item.customerId}</div>
                                                        </td>

                                                        {/* Amount */}
                                                        <td className="px-6 py-4 text-right font-bold text-gray-900">
                                                            Rs. {Number(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                        </td>

                                                        {/* Risk Score Visual */}
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-center gap-2">
                                                                <span className="font-bold text-xs text-gray-900 w-8 text-right">
                                                                    {item.riskScore}
                                                                </span>
                                                                <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                                                                    <div
                                                                        className={`h-full ${getScoreBarFillColor(item.riskScore)}`}
                                                                        style={{ width: `${Math.min(100, item.riskScore)}%` }}
                                                                    />
                                                                </div>
                                                            </div>
                                                        </td>

                                                        {/* Priority / Status */}
                                                        <td className="px-6 py-4">
                                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold inline-flex items-center gap-1 ${
                                                                item.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' :
                                                                item.priority === 'HIGH' ? 'bg-amber-50 text-amber-700' :
                                                                'bg-blue-50 text-blue-600'
                                                            }`}>
                                                                {item.priority}
                                                            </span>
                                                        </td>

                                                        {/* Assigned */}
                                                        <td className="px-6 py-4 text-xs font-medium text-gray-600">
                                                            {item.assignedAnalyst}
                                                        </td>

                                                        {/* Actions */}
                                                        <td className="px-6 py-4 text-right">
                                                            <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                                <button
                                                                    onClick={() => handleOpenCase(item)}
                                                                    className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-3 py-1.5 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                                                                >
                                                                    Open Case
                                                                </button>
                                                                {!item.isAssignedToMe && (
                                                                    <button
                                                                        onClick={(e) => handleAssignToMe(item, e)}
                                                                        className="border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium px-3 py-1.5 text-xs rounded-md transition-colors cursor-pointer"
                                                                    >
                                                                        + Assign to Me
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* VIEW: CASE DETAIL EMPTY STATE */}
                    {activeTab === 'case-detail' && !selectedCase && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center max-w-lg mx-auto my-8 space-y-4">
                            <ShieldAlert className="w-12 h-12 text-blue-600 mx-auto" />
                            <h2 className="text-lg font-bold text-gray-900">No Case Selected for Inspection</h2>
                            <p className="text-xs text-gray-500">
                                Select an active case from the Review Queue or Audit History to inspect forensics, analyze device telemetry, and make approval decisions.
                            </p>
                            <button
                                onClick={() => setActiveTab('review-queue')}
                                className="bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                            >
                                Back to Review Queue
                            </button>
                        </div>
                    )}

                    {/* VIEW: CASE DETAIL */}
                    {activeTab === 'case-detail' && selectedCase && (
                        <div className="space-y-6">

                            {/* Header & Case Title */}
                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div>
                                    <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                                        Platform &gt; Case Detail Inspection
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
                                        <span>Case {selectedCase.queueId}</span>
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            selectedCase.priority === 'CRITICAL' ? 'bg-red-50 text-red-600' :
                                            selectedCase.priority === 'HIGH' ? 'bg-amber-50 text-amber-700' :
                                            'bg-blue-50 text-blue-600'
                                        }`}>
                                            {selectedCase.priority}
                                        </span>
                                    </h1>
                                </div>

                                {/* Prev / Next Case Navigation */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handlePrevCase}
                                        disabled={!hasPrevCase}
                                        className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium px-3 py-1.5 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                                    >
                                        <ChevronLeft className="w-4 h-4" /> Prev
                                    </button>
                                    <button
                                        onClick={handleNextCase}
                                        disabled={!hasNextCase}
                                        className="flex items-center gap-1 bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium px-3 py-1.5 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                                    >
                                        Next <ChevronRight className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('review-queue')}
                                        className="bg-white border border-gray-200 text-gray-700 hover:bg-slate-50 font-medium px-3 py-1.5 text-xs rounded-md shadow-sm transition-colors cursor-pointer"
                                    >
                                        Back to Queue
                                    </button>
                                </div>
                            </div>

                            {/* Main Case Inspector Layout (2 Columns) */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Left Column: Case Forensics & Telemetry (2 cols) */}
                                <div className="lg:col-span-2 space-y-6">

                                    {/* Primary Financial Overview Card */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                                        <div className="flex justify-between items-start border-b border-gray-100 pb-4">
                                            <div>
                                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction Amount</div>
                                                <div className="text-3xl font-extrabold text-gray-900 mt-1">
                                                    Rs. {Number(selectedCase.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Risk Score</div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-2xl font-bold text-gray-900">{selectedCase.riskScore}/100</span>
                                                    <div className="w-16 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                                                        <div className={`h-full ${getScoreBarFillColor(selectedCase.riskScore)}`} style={{ width: `${selectedCase.riskScore}%` }} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span className="text-gray-500 font-medium block">Sender / Customer:</span>
                                                <strong className="text-gray-900 text-sm">{selectedCase.customerName}</strong> ({selectedCase.customerId})
                                            </div>
                                            <div>
                                                <span className="text-gray-500 font-medium block">Beneficiary:</span>
                                                <strong className="text-gray-900 text-sm">{selectedCase.recipientName}</strong>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Risk Signal Drivers */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                                            AI Risk Signal Drivers
                                        </h3>
                                        <div className="space-y-2.5">
                                            {selectedCase.flagReasons.map((flag, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-gray-100 text-xs">
                                                    <span className="font-semibold text-gray-800">{flag.label}</span>
                                                    <span className="font-extrabold text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                                                        {flag.impact} pts
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Device & Location Telemetry Map */}
                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Geolocation &amp; Device Telemetry
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4 text-xs">
                                            <div>
                                                <span className="text-gray-500 font-medium">Origin IP Address:</span>
                                                <div className="font-mono font-bold text-blue-600">{selectedCase.originIp}</div>
                                            </div>
                                            <div>
                                                <span className="text-gray-500 font-medium">Device Fingerprint:</span>
                                                <div className="font-medium text-gray-900">{selectedCase.device}</div>
                                            </div>
                                        </div>
                                        <div className="h-48 rounded-lg overflow-hidden border border-gray-200">
                                            <TransactionMap latitude={selectedCase.latitude} longitude={selectedCase.longitude} />
                                        </div>
                                    </div>

                                </div>

                                {/* Right Column: Analyst Decision Terminal */}
                                <div className="space-y-6">

                                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
                                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                            Analyst Decision Console
                                        </h3>

                                        {/* Mandatory Analyst Notes Input */}
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">
                                                Review Rationale &amp; Notes <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={notes}
                                                onChange={(e) => setNotes(e.target.value)}
                                                placeholder="Enter mandatory compliance notes and rationale before submitting decision..."
                                                className="w-full p-3 bg-slate-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder:text-gray-400"
                                            />
                                        </div>

                                        {/* Decision Action Buttons */}
                                        <div className="space-y-2">
                                            <button
                                                onClick={() => handleDecision('Approved')}
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                                            >
                                                Approve Transaction
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Rejected')}
                                                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                                            >
                                                Reject &amp; Block Transaction
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Escalate')}
                                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2.5 px-4 text-xs rounded-lg shadow-sm transition-colors cursor-pointer"
                                            >
                                                Escalate to Senior Analyst
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Request More Info')}
                                                className="w-full border border-gray-300 bg-white hover:bg-slate-50 text-gray-700 font-semibold py-2.5 px-4 text-xs rounded-lg transition-colors cursor-pointer"
                                            >
                                                Request Information
                                            </button>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>
                    )}

                    {/* OTHER TAB VIEWS */}
                    {activeTab === 'analytics' && <AnalystPerformanceDashboard />}
                    {activeTab === 'audit-logs' && <DecisionHistoryTable fetchLive={true} />}
                    {activeTab === 'fraud-flags' && (
                        <FraudFlagList
                            onSelectFlag={(flag) => {
                                setSelectedFraudFlag(flag);
                                setActiveTab('flag-detail');
                            }}
                            onOpenTrends={() => setActiveTab('fraud-trends')}
                            onOpenRules={() => setActiveTab('fraud-rules')}
                        />
                    )}
                    {activeTab === 'flag-detail' && (
                        <FlagDetailBreakdown
                            flag={selectedFraudFlag}
                            onBack={() => setActiveTab('fraud-flags')}
                            onNavigateToCase={(caseId) => {
                                const target = caseId || selectedFraudFlag?.queueId || selectedFraudFlag?.transactionId || selectedFraudFlag?.id;
                                if (target) {
                                    navigate(`/analyst/cases/${encodeURIComponent(target)}`);
                                } else {
                                    navigate('/analyst/cases');
                                }
                            }}
                        />
                    )}
                    {activeTab === 'fraud-rules' && <RuleConfigurationPanel />}
                    {activeTab === 'fraud-trends' && (
                        <FlaggingTrendsDashboard
                            onNavigateToRules={() => setActiveTab('fraud-rules')}
                            onNavigateToFlags={() => setActiveTab('fraud-flags')}
                        />
                    )}
                    {activeTab === 'transaction-monitor' && <TransactionMonitoringDashboard />}
                    {activeTab === 'reversals' && <FinancialReversalsPage />}

                </div>
            </main>

            {/* Escalation Modal */}
            {isEscalateModalOpen && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-lg w-full overflow-hidden">
                        <div className="p-6 bg-slate-900 text-white border-b border-slate-800">
                            <h3 className="text-lg font-bold">Escalate Case</h3>
                            <p className="text-xs text-slate-400 mt-1">Select analyst from database and state escalation reason.</p>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Select Analyst:</label>
                                {isLoadingAnalysts ? (
                                    <div className="p-2 text-gray-400 text-xs">Loading staff from database...</div>
                                ) : (
                                    <select
                                        value={selectedTargetAnalystId}
                                        onChange={(e) => setSelectedTargetAnalystId(e.target.value)}
                                        className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
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
                                <label className="block text-xs font-semibold text-gray-700 uppercase mb-2">Reason:</label>
                                <textarea
                                    rows={3}
                                    value={escalationNotes}
                                    onChange={(e) => setEscalationNotes(e.target.value)}
                                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter reason for escalation..."
                                />
                            </div>
                        </div>
                        <div className="p-4 bg-slate-50 border-t border-gray-200 flex justify-end gap-2">
                            <button
                                onClick={() => setIsEscalateModalOpen(false)}
                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmEscalation}
                                disabled={isSubmittingEscalation}
                                className="px-4 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700 cursor-pointer"
                            >
                                {isSubmittingEscalation ? 'Escalating...' : 'Escalate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}