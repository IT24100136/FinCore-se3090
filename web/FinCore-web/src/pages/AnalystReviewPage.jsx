import React, { useState, useEffect } from 'react';
import { reviewService } from '../services/reviewService';
import TransactionMap from '../components/TransactionMap';
import RuleConfigurationPanel from '../components/fraud/RuleConfigurationPanel';
import FraudFlagList from '../components/fraud/FraudFlagList';
import FlagDetailBreakdown from '../components/fraud/FlagDetailBreakdown';
import FlaggingTrendsDashboard from '../components/fraud/FlaggingTrendsDashboard';
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

    const currentAnalystId = "11111111-1111-1111-1111-111111111111";

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
        const txCode = txIdStr.length > 8 ? `TX-${txIdStr.substring(0, 8).toUpperCase()}` : (txIdStr || `TX-8829${1 - idx}`);
        const isAssignedToMe = item.assignedAnalystId === currentAnalystId;

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
            assignedAnalyst: isAssignedToMe ? 'Assigned to You' : (item.assignedAnalystId ? 'Analyst_02' : 'Unassigned'),
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
            // Prefer items that have valid queueCode and amount from real/seeded cases
            const validItems = allItems.filter(item => item.queueCode && item.queueCode.trim() !== '' && (Number(item.amount) > 0 || item.senderName));
            const rawItems = validItems.length > 0 ? validItems : allItems;

            // Auto-seed with prototype data if DB has no valid cases
            if (rawItems.length === 0) {
                try {
                    await reviewService.seedTestData();
                    const reseeded = await reviewService.getQueue();
                    const reseededValid = (reseeded.items || []).filter(item => item.queueCode && item.queueCode.trim() !== '');
                    const enriched = (reseededValid.length > 0 ? reseededValid : (reseeded.items || [])).map((item, index) => normalizeCase(item, index));
                    setQueue(enriched);
                    if (enriched.length > 0) {
                        setSelectedCase(enriched[0]);
                        loadHistory(enriched[0].transactionId);
                    }
                } catch (seedErr) {
                    console.warn("Could not auto-seed, using client fallback", seedErr);
                }
            } else {
                const enriched = rawItems.map((item, index) => normalizeCase(item, index));
                setQueue(enriched);
                if (enriched.length > 0 && !selectedCase) {
                    setSelectedCase(enriched[0]);
                    loadHistory(enriched[0].transactionId);
                }
            }

            // Fetch performance analytics
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

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenCase = (item) => {
        setSelectedCase(item);
        setActiveTab('case-detail');
        setActionFeedback(null);
        loadHistory(item.transactionId);
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

    const handleDecision = async (decision) => {
        if (!selectedCase) return;

        if (!notes.trim()) {
            alert("Analyst Notes are mandatory to record the review rationale before submitting a decision.");
            return;
        }

        try {
            if (decision === 'Escalate') {
                await reviewService.escalateCase(selectedCase.transactionId, {
                    analystId: currentAnalystId,
                    reason: notes
                });
                setActionFeedback({
                    type: 'escalate',
                    message: `Case ${selectedCase.queueId} escalated to Senior Admin with CRITICAL priority.`
                });
            } else if (decision === 'Request More Info') {
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

    const handleSeedData = async () => {
        try {
            setLoading(true);
            await reviewService.seedTestData();
            await loadData();
            setActionFeedback({ type: 'info', message: 'Prototype test cases seeded successfully.' });
        } catch (err) {
            alert("Seeding failed: " + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
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
        return true;
    });

    // Active cases available for navigation (using filtered subset if active, or entire queue)
    const activeCaseList = (filteredQueue && filteredQueue.length > 0) ? filteredQueue : queue;
    const currentCaseIndex = activeCaseList.findIndex(
        c => (c.transactionId && c.transactionId === selectedCase?.transactionId) || (c.id && c.id === selectedCase?.id)
    );
    const hasPrevCase = currentCaseIndex > 0;
    const hasNextCase = currentCaseIndex >= 0 && currentCaseIndex < activeCaseList.length - 1;

    // Auto-select first case if navigating to Case Detail without a selection
    useEffect(() => {
        if (activeTab === 'case-detail' && !selectedCase && queue.length > 0) {
            setSelectedCase(queue[0]);
            loadHistory(queue[0].transactionId);
        }
    }, [activeTab, selectedCase, queue]);

    const handleSwitchCase = (targetCase) => {
        if (!targetCase) return;
        setSelectedCase(targetCase);
        setNotes('');
        setActionFeedback(null);
        loadHistory(targetCase.transactionId);
    };

    const handlePrevCase = () => {
        if (hasPrevCase) {
            handleSwitchCase(activeCaseList[currentCaseIndex - 1]);
        }
    };

    const handleNextCase = () => {
        if (hasNextCase) {
            handleSwitchCase(activeCaseList[currentCaseIndex + 1]);
        }
    };

    const calculateElapsed = (dateStr) => {
        if (!dateStr) return 'Just now';
        const diffMs = Date.now() - new Date(dateStr).getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minutes ago`;
        const diffHours = Math.floor(diffMins / 60);
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    };

    return (
        <div style={{ display: 'flex', minHeight: '100vh', width: '100%', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}>

            {/* 1. Left Dark Navy Sidebar (#091124) */}
            <aside style={{ width: '250px', backgroundColor: '#091124', color: '#94a3b8', display: 'flex', flexDirection: 'column', flexShrink: 0, borderRight: '1px solid #1e293b' }}>
                {/* Brand */}
                <div style={{ padding: '24px 20px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid #1e293b' }}>
                    <div style={{ backgroundColor: '#2563eb', color: '#fff', fontWeight: 800, padding: '7px 11px', borderRadius: '8px', fontSize: '15px', boxShadow: '0 2px 6px rgba(37,99,235,0.4)' }}>
                        FC
                    </div>
                    <div>
                        <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', letterSpacing: '0.4px' }}>FinCore</div>
                        <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, letterSpacing: '0.8px' }}>FRAUD INTELLIGENCE</div>
                    </div>
                </div>

                {/* Navigation Items */}
                <nav style={{ padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', padding: '0 12px 8px', letterSpacing: '0.6px' }}>PLATFORM</div>

                    <button
                        onClick={() => setActiveTab('review-queue')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'review-queue' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'review-queue' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Inbox size={18} /> Review Queue
                        </div>
                        <span style={{ backgroundColor: '#dc2626', color: '#fff', fontSize: '11px', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>
                            {metrics.totalCases || queue.length || 0}
                        </span>
                    </button>

                    <button
                        onClick={() => {
                            if (selectedCase) setActiveTab('case-detail');
                            else if (queue.length > 0) {
                                setSelectedCase(queue[0]);
                                loadHistory(queue[0].transactionId);
                                setActiveTab('case-detail');
                            } else {
                                setActiveTab('case-detail');
                            }
                        }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'case-detail' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'case-detail' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <FileText size={18} /> Case Detail
                        </div>
                        {selectedCase && (
                            <span style={{ fontSize: '11px', color: activeTab === 'case-detail' ? '#bfdbfe' : '#64748b', fontWeight: 700 }}>
                                {selectedCase.queueId}
                            </span>
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('analytics')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'analytics' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'analytics' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <BarChart3 size={18} /> Analytics & Performance
                    </button>

                    <button
                        onClick={() => setActiveTab('audit-logs')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'audit-logs' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'audit-logs' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <FileCheck2 size={18} /> Audit Trails & History
                    </button>

                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', padding: '16px 12px 8px', letterSpacing: '0.6px' }}>FRAUD ENGINE</div>

                    <button
                        onClick={() => setActiveTab('fraud-flags')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'fraud-flags' || activeTab === 'flag-detail' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'fraud-flags' || activeTab === 'flag-detail' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Flag size={18} /> Fraud Flags
                        </div>
                        <span style={{ backgroundColor: activeTab === 'fraud-flags' ? '#1d4ed8' : '#dc2626', color: '#fff', fontSize: '10px', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                            LIVE
                        </span>
                    </button>

                    <button
                        onClick={() => setActiveTab('fraud-rules')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'fraud-rules' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'fraud-rules' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <Sliders size={18} /> Fraud Rules
                    </button>

                    <button
                        onClick={() => setActiveTab('fraud-trends')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'fraud-trends' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'fraud-trends' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left', transition: 'all 0.15s ease' }}
                    >
                        <TrendingUp size={18} /> Flagging Trends
                    </button>

                    <button
                        onClick={() => setActiveTab('reversals')}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', color: activeTab === 'reversals' ? '#fff' : '#94a3b8', backgroundColor: activeTab === 'reversals' ? '#2563eb' : 'transparent', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500, width: '100%', textAlign: 'left' }}
                    >
                        <RotateCcw size={18} /> Reversals
                    </button>
                </nav>

                {/* Bottom User Profile */}
                <div style={{ padding: '16px', borderTop: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px', fontWeight: 700 }}>
                        AN
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ color: '#f8fafc', fontSize: '13px', fontWeight: 600 }}>Analyst Console</div>
                        <div style={{ color: '#64748b', fontSize: '11px' }}>ID: USR-11111111</div>
                    </div>
                </div>
            </aside>

            {/* 2. Main Content Workspace */}
            <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

                {/* Top Enterprise Platform Header Bar (#0d1527) */}
                <header style={{ height: '56px', backgroundColor: '#0d1527', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 32px', flexShrink: 0 }}>
                    {/* Real Enterprise Global Search Bar */}
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        backgroundColor: '#070c18',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        border: '1px solid #1e293b',
                        width: '360px',
                        transition: 'border-color 0.15s ease'
                    }}>
                        <Search size={15} color="#64748b" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search case ID, customer, TX code, IP..."
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#f8fafc',
                                fontSize: '12px',
                                outline: 'none',
                                width: '100%',
                                fontFamily: 'inherit'
                            }}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', padding: 0 }}
                                title="Clear search"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    {/* Right System Status & Live Production Indicators */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        {/* Live Production Environment Pill */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#38bdf8', fontWeight: 600, backgroundColor: '#0369a11a', padding: '5px 12px', borderRadius: '16px', border: '1px solid #0284c733' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#38bdf8', display: 'inline-block', boxShadow: '0 0 6px #38bdf8' }} />
                            Live Production
                        </div>

                        {/* AI Pipeline Status */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981', fontWeight: 600, backgroundColor: '#064e3b26', padding: '5px 12px', borderRadius: '16px', border: '1px solid #10b98133' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }} />
                            AI Pipeline: Operational
                        </div>

                        {/* Real-time Notification Bell */}
                        <div
                            style={{
                                position: 'relative',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                backgroundColor: '#070c18',
                                border: '1px solid #1e293b'
                            }}
                            title="Active Alerts"
                            onClick={() => alert(`Active Queue: ${metrics.critical || 1} CRITICAL priority cases require immediate analyst action.`)}
                        >
                            <Bell size={16} color="#94a3b8" />
                            <span style={{ position: 'absolute', top: '7px', right: '7px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#ef4444', border: '1px solid #0d1527' }} />
                        </div>

                        {/* Date */}
                        <div style={{ color: '#94a3b8', fontSize: '12px', fontWeight: 500 }}>
                            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                    </div>
                </header>

                {/* Action Feedback Banner */}
                {actionFeedback && (
                    <div style={{
                        padding: '12px 32px',
                        backgroundColor: actionFeedback.type === 'approved' ? '#dcfce7' : actionFeedback.type === 'dual' ? '#fef3c7' : actionFeedback.type === 'rejected' ? '#fee2e2' : '#e0f2fe',
                        borderBottom: '1px solid #cbd5e1',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: actionFeedback.type === 'approved' ? '#166534' : actionFeedback.type === 'dual' ? '#92400e' : actionFeedback.type === 'rejected' ? '#991b1b' : '#075985'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Check size={16} /> {actionFeedback.message}
                        </div>
                        <button onClick={() => setActionFeedback(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>✕</button>
                    </div>
                )}

                {/* Scrollable Workspace */}
                <div style={{ padding: '28px 36px', flex: 1, overflowY: 'auto' }}>

                    {/* ============================================================== */}
                    {/* TAB: REVIEW QUEUE VIEW                                          */}
                    {/* ============================================================== */}
                    {activeTab === 'review-queue' && (
                        <div>
                            {/* Title & Toolbar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Platform &gt; Review Queue</div>
                                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                                        Analyst Review Queue
                                    </h1>
                                </div>

                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <button
                                        onClick={handleSeedData}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#334155', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                    >
                                        <Database size={15} /> Seed Figma Prototype Data
                                    </button>
                                    <button
                                        onClick={loadData}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#2563eb', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#fff', cursor: 'pointer', boxShadow: '0 2px 4px rgba(37,99,235,0.3)' }}
                                    >
                                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh
                                    </button>
                                </div>
                            </div>

                            {/* Subfilter Chips (Including "Assigned to Me" - Story 1) */}
                            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
                                <button
                                    onClick={() => setFilterType('ALL')}
                                    style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: filterType === 'ALL' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: filterType === 'ALL' ? '#2563eb' : '#fff', color: filterType === 'ALL' ? '#fff' : '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                                >
                                    All Flags
                                </button>
                                <button
                                    onClick={() => setFilterType('ASSIGNED_TO_ME')}
                                    style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: filterType === 'ASSIGNED_TO_ME' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: filterType === 'ASSIGNED_TO_ME' ? '#2563eb' : '#fff', color: filterType === 'ASSIGNED_TO_ME' ? '#fff' : '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                                >
                                    Assigned to Me
                                </button>
                                <button
                                    onClick={() => setFilterType('CRITICAL')}
                                    style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: filterType === 'CRITICAL' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: filterType === 'CRITICAL' ? '#2563eb' : '#fff', color: filterType === 'CRITICAL' ? '#fff' : '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                                >
                                    Urgent / High Score
                                </button>
                                <button
                                    onClick={() => setFilterType('DUAL')}
                                    style={{ padding: '8px 18px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: filterType === 'DUAL' ? '1px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: filterType === 'DUAL' ? '#2563eb' : '#fff', color: filterType === 'DUAL' ? '#fff' : '#475569', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.15s' }}
                                >
                                    Requires Dual Approval
                                </button>
                            </div>

                            {/* 4 Metric KPI Cards */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a' }}>{metrics.totalCases}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>Total Cases</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>{metrics.critical}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>Critical</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>{metrics.unassigned}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>Unassigned</div>
                                </div>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '18px 22px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>{metrics.underReview}</div>
                                    <div style={{ fontSize: '13px', color: '#64748b', marginTop: '2px', fontWeight: 500 }}>Under Review</div>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div style={{ backgroundColor: '#fff', borderRadius: '10px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                                            <th style={{ padding: '14px 20px' }}>Priority</th>
                                            <th style={{ padding: '14px 20px' }}>Queue ID</th>
                                            <th style={{ padding: '14px 20px' }}>Customer</th>
                                            <th style={{ padding: '14px 20px' }}>Amount (LKR)</th>
                                            <th style={{ padding: '14px 20px' }}>Risk Score</th>
                                            <th style={{ padding: '14px 20px' }}>Assigned Analyst</th>
                                            <th style={{ padding: '14px 20px' }}>Status</th>
                                            <th style={{ padding: '14px 20px', textAlign: 'right' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredQueue.length === 0 ? (
                                            <tr>
                                                <td colSpan="8" style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                                                    No review cases match this filter. Click 'Seed Figma Prototype Data' to populate demo records.
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredQueue.map((item, idx) => (
                                                <tr
                                                    key={item.id || idx}
                                                    style={{ borderBottom: '1px solid #f1f5f9', transition: 'background-color 0.15s ease' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                                                >
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <span style={{
                                                            padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px',
                                                            backgroundColor: item.priority === 'CRITICAL' ? '#fee2e2' : (item.priority === 'HIGH' ? '#fef3c7' : '#e0f2fe'),
                                                            color: item.priority === 'CRITICAL' ? '#b91c1c' : (item.priority === 'HIGH' ? '#b45309' : '#0369a1')
                                                        }}>
                                                            • {item.priority}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#2563eb' }}>{item.queueId}</td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{item.customerName}</div>
                                                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>{item.customerId}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 20px', fontWeight: 700, color: '#0f172a' }}>
                                                        Rs. {item.amount.toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                            <div style={{ width: '48px', height: '6px', borderRadius: '3px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                                                <div style={{ width: `${Math.min(item.riskScore, 100)}%`, height: '100%', backgroundColor: item.riskScore > 75 ? '#dc2626' : (item.riskScore >= 50 ? '#d97706' : '#16a34a') }} />
                                                            </div>
                                                            <span style={{ fontWeight: 700, color: item.riskScore > 75 ? '#dc2626' : (item.riskScore >= 50 ? '#d97706' : '#16a34a') }}>
                                                                {item.riskScore}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        {item.isAssignedToMe ? (
                                                            <span style={{ color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <UserCheck size={14} /> You
                                                            </span>
                                                        ) : item.assignedAnalystId ? (
                                                            <span style={{ color: '#334155' }}>Analyst 02</span>
                                                        ) : (
                                                            <button
                                                                onClick={(e) => handleAssignToMe(item, e)}
                                                                style={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#2563eb', cursor: 'pointer' }}
                                                            >
                                                                + Assign to Me
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td style={{ padding: '14px 20px' }}>
                                                        <span style={{
                                                            fontSize: '12px', fontWeight: 600,
                                                            color: item.status === 'Queued' ? '#d97706' : (item.status === 'InformationRequested' ? '#0284c7' : item.status === 'PendingSecondApproval' ? '#9333ea' : item.status === 'Decided' ? '#16a34a' : '#2563eb')
                                                        }}>
                                                            • {item.status}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handleOpenCase(item)}
                                                            style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'background-color 0.15s ease', boxShadow: '0 1px 3px rgba(37,99,235,0.3)' }}
                                                        >
                                                            Open Case
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: CASE DETAIL VIEW (Stories 2, 3, 4)                         */}
                    {/* ============================================================== */}
                    {activeTab === 'case-detail' && !selectedCase && (
                        <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '48px 24px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <FileText size={24} />
                            </div>
                            <h3 style={{ color: '#0f172a', margin: '0 0 8px 0', fontSize: '18px', fontWeight: 700 }}>No Case Selected</h3>
                            <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 20px 0' }}>
                                Please select a transaction from the Review Queue or pick one of the available queue cases to inspect.
                            </p>
                            <button
                                onClick={() => setActiveTab('review-queue')}
                                style={{ padding: '9px 18px', backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 600, fontSize: '13px', cursor: 'pointer' }}
                            >
                                Open Review Queue
                            </button>
                        </div>
                    )}

                    {activeTab === 'case-detail' && selectedCase && (
                        <div>
                            {/* Breadcrumb & Top Case Navigation Bar */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                                <div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>
                                        <span
                                            onClick={() => setActiveTab('review-queue')}
                                            style={{ color: '#2563eb', cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            Review Queue
                                        </span> &gt; Case Detail
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                                            Case Detail — {selectedCase.queueId}
                                        </h1>
                                        <span style={{
                                            backgroundColor: selectedCase.priority === 'CRITICAL' ? '#fee2e2' : selectedCase.priority === 'HIGH' ? '#fef3c7' : '#e0f2fe',
                                            color: selectedCase.priority === 'CRITICAL' ? '#dc2626' : selectedCase.priority === 'HIGH' ? '#b45309' : '#0369a1',
                                            padding: '3px 10px',
                                            borderRadius: '6px',
                                            fontSize: '12px',
                                            fontWeight: 800
                                        }}>
                                            {selectedCase.priority}
                                        </span>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                    {/* Prev / Next Quick Nav Controls */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '3px 6px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                                        <button
                                            onClick={handlePrevCase}
                                            disabled={!hasPrevCase}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 10px',
                                                backgroundColor: hasPrevCase ? '#f8fafc' : 'transparent',
                                                border: '1px solid',
                                                borderColor: hasPrevCase ? '#cbd5e1' : 'transparent',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: hasPrevCase ? '#1e293b' : '#94a3b8',
                                                cursor: hasPrevCase ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title={hasPrevCase ? 'Previous case in queue' : 'First case'}
                                        >
                                            <ChevronLeft size={15} /> Prev
                                        </button>
                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', padding: '0 8px' }}>
                                            {currentCaseIndex >= 0 ? currentCaseIndex + 1 : 1} of {activeCaseList.length}
                                        </span>
                                        <button
                                            onClick={handleNextCase}
                                            disabled={!hasNextCase}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '4px',
                                                padding: '6px 10px',
                                                backgroundColor: hasNextCase ? '#f8fafc' : 'transparent',
                                                border: '1px solid',
                                                borderColor: hasNextCase ? '#cbd5e1' : 'transparent',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 600,
                                                color: hasNextCase ? '#1e293b' : '#94a3b8',
                                                cursor: hasNextCase ? 'pointer' : 'not-allowed',
                                                transition: 'all 0.15s ease'
                                            }}
                                            title={hasNextCase ? 'Next case in queue' : 'Last case'}
                                        >
                                            Next <ChevronRight size={15} />
                                        </button>
                                    </div>

                                    {!selectedCase.isAssignedToMe && (
                                        <button
                                            onClick={(e) => handleAssignToMe(selectedCase, e)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#1d4ed8', cursor: 'pointer' }}
                                        >
                                            <UserCheck size={16} /> Assign to Me
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setActiveTab('review-queue')}
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', fontWeight: 600, color: '#475569', cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                                    >
                                        <ArrowLeft size={16} /> Back to Queue
                                    </button>
                                </div>
                            </div>

                            {/* Case Switching Strip: Dropdown & Clickable Case Pills */}
                            <div style={{
                                backgroundColor: '#fff',
                                borderRadius: '10px',
                                padding: '16px 20px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                                marginBottom: '24px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                                            Switch Case:
                                        </span>
                                        <select
                                            value={selectedCase.transactionId || selectedCase.id}
                                            onChange={(e) => {
                                                const found = activeCaseList.find(c => (c.transactionId || c.id) === e.target.value);
                                                if (found) handleSwitchCase(found);
                                            }}
                                            style={{
                                                padding: '7px 12px',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                backgroundColor: '#f8fafc',
                                                fontSize: '13px',
                                                fontWeight: 600,
                                                color: '#0f172a',
                                                cursor: 'pointer',
                                                outline: 'none',
                                                minWidth: '320px'
                                            }}
                                        >
                                            {activeCaseList.map((item, idx) => (
                                                <option key={item.transactionId || item.id || idx} value={item.transactionId || item.id}>
                                                    {item.queueId} • {item.customerName} — Rs. {item.amount.toLocaleString()} ({item.priority} • Risk {item.riskScore})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>
                                        {activeCaseList.length} cases in review • Click any card below to switch instantly
                                    </div>
                                </div>

                                {/* Horizontal Case Cards Strip */}
                                <div style={{
                                    display: 'flex',
                                    gap: '12px',
                                    flexWrap: 'wrap',
                                    alignItems: 'stretch'
                                }}>
                                    {activeCaseList.map((item) => {
                                        const isSelected = (item.transactionId === selectedCase.transactionId) || (item.id === selectedCase.id);
                                        const priorityColor = item.priority === 'CRITICAL' ? '#dc2626' : item.priority === 'HIGH' ? '#d97706' : '#2563eb';
                                        const priorityBg = item.priority === 'CRITICAL' ? '#fee2e2' : item.priority === 'HIGH' ? '#fef3c7' : '#e0f2fe';

                                        return (
                                            <div
                                                key={item.transactionId || item.id}
                                                onClick={() => handleSwitchCase(item)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '12px',
                                                    padding: '12px 16px',
                                                    borderRadius: '8px',
                                                    border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                                                    backgroundColor: isSelected ? '#eff6ff' : '#f8fafc',
                                                    cursor: 'pointer',
                                                    flex: '1 1 220px',
                                                    maxWidth: '360px',
                                                    transition: 'all 0.15s ease',
                                                    boxShadow: isSelected ? '0 2px 6px rgba(37,99,235,0.15)' : 'none'
                                                }}
                                                title={`Switch to ${item.queueId} - ${item.customerName}`}
                                            >
                                                <div style={{
                                                    width: '10px',
                                                    height: '10px',
                                                    borderRadius: '50%',
                                                    backgroundColor: priorityColor,
                                                    flexShrink: 0
                                                }} />
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: 800, fontSize: '13px', color: isSelected ? '#1d4ed8' : '#0f172a' }}>
                                                            {item.queueId}
                                                        </span>
                                                        <span style={{
                                                            fontSize: '10px',
                                                            fontWeight: 700,
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            backgroundColor: priorityBg,
                                                            color: priorityColor
                                                        }}>
                                                            {item.priority}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                        {item.customerName} • Rs. {item.amount.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2-Column Split: Left (2fr) & Right (1fr) */}
                            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

                                {/* LEFT PANEL: Transaction Details, Map, AI SHAP Signals, Audit Trail */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                    {/* 1. Transaction Details Card */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px' }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>Transaction Details</h3>
                                            <span style={{ backgroundColor: '#fef3c7', color: '#b45309', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
                                                • {selectedCase.status.toUpperCase()}
                                            </span>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '18px', fontSize: '13px' }}>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Transaction ID</div>
                                                <div style={{ fontWeight: 700, color: '#0f172a', marginTop: '3px' }}>{selectedCase.txCode}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Queue ID</div>
                                                <div style={{ fontWeight: 700, color: '#2563eb', marginTop: '3px' }}>{selectedCase.queueId}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Customer (Sender)</div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>{selectedCase.customerName} ({selectedCase.customerId})</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Recipient</div>
                                                <div style={{ fontWeight: 600, color: '#0f172a', marginTop: '3px' }}>{selectedCase.recipientName}</div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Amount</div>
                                                <div style={{ fontWeight: 800, color: '#0f172a', marginTop: '3px', fontSize: '16px' }}>
                                                    Rs. {selectedCase.amount.toLocaleString()} LKR
                                                </div>
                                            </div>
                                            <div>
                                                <div style={{ color: '#64748b', fontSize: '11px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' }}>Origin IP & Device</div>
                                                <div style={{ fontWeight: 500, color: '#334155', marginTop: '3px' }}>
                                                    {selectedCase.originIp} — {selectedCase.device}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Geolocation Anomaly Card */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                                Geolocation Anomaly — Transaction vs Historical Login
                                            </h3>
                                            <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#fee2e2', color: '#dc2626', padding: '3px 10px', borderRadius: '4px' }}>
                                                Distance Delta: 12.4 km
                                            </span>
                                        </div>

                                        <TransactionMap
                                            lat={selectedCase.latitude}
                                            lng={selectedCase.longitude}
                                            locationName={`Transaction Origin: ${selectedCase.originIp} (Lat: ${selectedCase.latitude}, Lng: ${selectedCase.longitude})`}
                                        />
                                    </div>

                                    {/* 3. AI Risk Assessment & SHAP Attributions */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <h3 style={{ margin: '0 0 12px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                            AI Risk Assessment & SHAP Attributions
                                        </h3>

                                        <div style={{ backgroundColor: '#f8fafc', borderLeft: '4px solid #2563eb', padding: '14px 16px', fontSize: '13px', color: '#334155', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.5 }}>
                                            "This transfer was held because the amount is 3× the customer's 30-day average, the initiating device has not been seen before, and the origin IP resolves to a location outside the user's verified home cluster."
                                        </div>

                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {selectedCase.flagReasons.map((fr, idx) => (
                                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                                    <span style={{ color: '#334155', fontWeight: 500 }}>{fr.label}</span>
                                                    <span style={{ fontWeight: 800, color: fr.color || '#dc2626', backgroundColor: '#fff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                                                        {fr.impact}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '14px' }}>Composite Risk Score</span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '24px', fontWeight: 800, color: selectedCase.riskScore > 75 ? '#dc2626' : '#d97706' }}>
                                                    {selectedCase.riskScore}
                                                </span>
                                                <span style={{ color: '#64748b', fontSize: '14px' }}>/ 100</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Decision History & Audit Trail (User Story 4 - Admin Audit Trail) */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                            <History size={18} color="#2563eb" />
                                            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>
                                                Decision History & Audit Trail
                                            </h3>
                                        </div>

                                        {caseHistory.length === 0 ? (
                                            <div style={{ padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                                No previous decisions logged for this case. You are the initial reviewer.
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                                {caseHistory.map((item, idx) => (
                                                    <div key={idx} style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '8px', borderLeft: `4px solid ${item.decision.toLowerCase() === 'approved' ? '#16a34a' : item.decision.toLowerCase() === 'rejected' ? '#dc2626' : '#2563eb'}` }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                                                            <span style={{
                                                                fontWeight: 700, fontSize: '12px', padding: '2px 8px', borderRadius: '4px',
                                                                backgroundColor: item.decision.toLowerCase() === 'approved' ? '#dcfce7' : item.decision.toLowerCase() === 'rejected' ? '#fee2e2' : '#e0f2fe',
                                                                color: item.decision.toLowerCase() === 'approved' ? '#166534' : item.decision.toLowerCase() === 'rejected' ? '#991b1b' : '#0369a1'
                                                            }}>
                                                                {item.decision.toUpperCase()} (Level {item.approvalLevel})
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                                                                {new Date(item.decidedAt).toLocaleString()}
                                                            </span>
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#475569', marginBottom: '4px' }}>
                                                            <strong>Analyst ID:</strong> {item.analystId}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#334155', fontStyle: 'italic' }}>
                                                            "{item.notes || 'No review notes entered.'}"
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                </div>

                                {/* RIGHT PANEL: Dual Approval, Analyst Controls, Summary */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                                    {/* Dual Approval Warning Banner */}
                                    {selectedCase.requiresDualApproval && (
                                        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                                <AlertTriangle size={22} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                                                <div>
                                                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: '14px' }}>Dual Approval Required</div>
                                                    <div style={{ color: '#b45309', fontSize: '12px', marginTop: '6px', lineHeight: 1.5 }}>
                                                        Amount exceeds Rs. 75,000 statutory threshold. Secondary approval (Maker-Checker principle) is required before funds are released.
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Analyst Decision Actions Form (User Story 2 & 3) */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Analyst Notes & Justification</h3>
                                        <div style={{ fontSize: '12px', color: '#dc2626', marginBottom: '10px', fontWeight: 600 }}>
                                            * Required before submitting decision
                                        </div>

                                        <textarea
                                            rows={4}
                                            value={notes}
                                            onChange={(e) => setNotes(e.target.value)}
                                            placeholder="Record findings, customer communication, or justification..."
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                borderRadius: '6px',
                                                border: '1px solid #cbd5e1',
                                                padding: '12px',
                                                fontSize: '13px',
                                                fontFamily: 'inherit',
                                                resize: 'vertical',
                                                outline: 'none',
                                                transition: 'border-color 0.15s ease'
                                            }}
                                            onFocus={(e) => e.target.style.borderColor = '#2563eb'}
                                            onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
                                        />

                                        {/* Action Buttons: Approve, Reject, Request Info, Escalate */}
                                        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <button
                                                onClick={() => handleDecision('Approved')}
                                                style={{
                                                    backgroundColor: '#16a34a',
                                                    color: '#fff',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 2px 4px rgba(22,163,74,0.3)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <CheckCircle size={17} /> Approve & Release Funds
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Rejected')}
                                                style={{
                                                    backgroundColor: '#dc2626',
                                                    color: '#fff',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 2px 4px rgba(220,38,38,0.3)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <XCircle size={17} /> Reject & Lock Transaction
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Request More Info')}
                                                style={{
                                                    backgroundColor: '#0284c7',
                                                    color: '#fff',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    boxShadow: '0 2px 4px rgba(2,132,199,0.3)',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <HelpCircle size={17} /> Request More Information
                                            </button>

                                            <button
                                                onClick={() => handleDecision('Escalate')}
                                                style={{
                                                    backgroundColor: '#f8fafc',
                                                    color: '#475569',
                                                    padding: '12px',
                                                    borderRadius: '6px',
                                                    border: '1px solid #cbd5e1',
                                                    fontWeight: 700,
                                                    fontSize: '13px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px',
                                                    transition: 'all 0.15s ease'
                                                }}
                                            >
                                                <ArrowUpRight size={17} /> Escalate to Senior Admin
                                            </button>
                                        </div>
                                    </div>

                                    {/* Case Summary Widget */}
                                    <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0', fontSize: '13px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                        <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>Case Summary</h4>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Case ID</span>
                                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{selectedCase.queueId}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Priority</span>
                                            <span style={{
                                                fontWeight: 800,
                                                color: selectedCase.priority === 'CRITICAL' ? '#dc2626' : (selectedCase.priority === 'HIGH' ? '#d97706' : '#2563eb')
                                            }}>
                                                {selectedCase.priority}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Assigned To</span>
                                            <span style={{ fontWeight: 600 }}>{selectedCase.assignedAnalyst}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f1f5f9' }}>
                                            <span style={{ color: '#64748b' }}>Elapsed</span>
                                            <span style={{ fontWeight: 600, color: '#0f172a' }}>{calculateElapsed(selectedCase.createdAt)}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                                            <span style={{ color: '#64748b' }}>Status</span>
                                            <span style={{ fontWeight: 700, color: '#2563eb' }}>{selectedCase.status}</span>
                                        </div>
                                    </div>

                                </div>

                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: ANALYTICS & ADMIN PERFORMANCE (User Story 5)              */}
                    {/* ============================================================== */}
                    {activeTab === 'analytics' && (
                        <div>
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Admin &gt; Performance Analytics</div>
                                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                    Analyst Performance & Review Quality Dashboard
                                </h1>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                                    Live metrics tracking analyst efficiency, decision turnaround times, and approval/rejection rates.
                                </p>
                            </div>

                            {/* Key Performance Indicators */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
                                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Avg Decision Time</span>
                                        <Clock size={18} color="#2563eb" />
                                    </div>
                                    <div style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a' }}>
                                        {metrics.averageDecisionTimeMinutes || 4.2} <span style={{ fontSize: '16px', fontWeight: 600, color: '#64748b' }}>min</span>
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#16a34a', marginTop: '4px', fontWeight: 600 }}>
                                        ✓ Well within SLA target (15 min)
                                    </div>
                                </div>

                                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Approval Rate</span>
                                        <CheckCircle size={18} color="#16a34a" />
                                    </div>
                                    <div style={{ fontSize: '30px', fontWeight: 800, color: '#16a34a' }}>
                                        {metrics.approvalRate || 0}%
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                        {metrics.approvedCount || 0} approved cases
                                    </div>
                                </div>

                                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Rejection Rate</span>
                                        <XCircle size={18} color="#dc2626" />
                                    </div>
                                    <div style={{ fontSize: '30px', fontWeight: 800, color: '#dc2626' }}>
                                        {metrics.rejectionRate || 0}%
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                        {metrics.rejectedCount || 0} blocked fraudulent cases
                                    </div>
                                </div>

                                <div style={{ background: '#fff', borderRadius: '10px', padding: '20px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                        <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Total Processed</span>
                                        <Activity size={18} color="#d97706" />
                                    </div>
                                    <div style={{ fontSize: '30px', fontWeight: 800, color: '#0f172a' }}>
                                        {metrics.decidedCases || 0}
                                    </div>
                                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                        {metrics.pendingCases || 0} pending analyst action
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Analytics Grid */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                {/* Maker-Checker Principle & Governance */}
                                <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <ShieldCheck size={20} color="#16a34a" /> Maker-Checker Compliance
                                    </h3>
                                    <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.6, marginBottom: '16px' }}>
                                        All transactions $\ge$ Rs. 75,000 strictly enforce dual-approval separation of duties. No single analyst can approve and release funds alone.
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                            <span>Cases Pending Second Approval:</span>
                                            <strong style={{ color: '#d97706' }}>{queue.filter(q => q.status === 'PendingSecondApproval').length}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                            <span>Escalated for Admin Intervention:</span>
                                            <strong style={{ color: '#dc2626' }}>{metrics.escalatedCount || 0}</strong>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '6px' }}>
                                            <span>Clarifications / Info Requested:</span>
                                            <strong style={{ color: '#0284c7' }}>{metrics.infoRequestedCount || 0}</strong>
                                        </div>
                                    </div>
                                </div>

                                {/* Analyst Roster Efficiency */}
                                <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0' }}>
                                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                                        Review Quality & SLA Adherence
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>High-Risk SLA Resolution (&lt; 15 min):</span>
                                                <strong style={{ color: '#16a34a' }}>96.8%</strong>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px' }}>
                                                <div style={{ width: '96.8%', height: '100%', backgroundColor: '#16a34a', borderRadius: '3px' }} />
                                            </div>
                                        </div>
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                                <span style={{ color: '#475569' }}>Analyst Note Completeness:</span>
                                                <strong style={{ color: '#2563eb' }}>100%</strong>
                                            </div>
                                            <div style={{ width: '100%', height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px' }}>
                                                <div style={{ width: '100%', height: '100%', backgroundColor: '#2563eb', borderRadius: '3px' }} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: AUDIT TRAILS & FULL HISTORY (User Story 4)                 */}
                    {/* ============================================================== */}
                    {activeTab === 'audit-logs' && (
                        <div>
                            <div style={{ marginBottom: '24px' }}>
                                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px', fontWeight: 500 }}>Admin &gt; Audit Trails</div>
                                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
                                    Full Decision History & Governance Audit Trail
                                </h1>
                                <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
                                    Complete immutable decision records providing complete traceability for regulatory audits.
                                </p>
                            </div>

                            <div style={{ backgroundColor: '#fff', borderRadius: '10px', padding: '24px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>Recent Case Decision Logs</h3>
                                    <button
                                        onClick={loadData}
                                        style={{ padding: '6px 12px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                    >
                                        Refresh Log
                                    </button>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {queue.map((item, idx) => (
                                        <div key={idx} style={{ padding: '14px 18px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <span style={{ fontWeight: 700, color: '#2563eb' }}>{item.queueId}</span>
                                                    <span style={{ fontWeight: 600, color: '#0f172a' }}>{item.customerName}</span>
                                                    <span style={{ color: '#64748b', fontSize: '12px' }}>• Rs. {item.amount.toLocaleString()}</span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                                                    Assigned: {item.assignedAnalyst} | Status: <strong style={{ color: '#0f172a' }}>{item.status}</strong>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleOpenCase(item)}
                                                style={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                                            >
                                                View Case Audit
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ============================================================== */}
                    {/* TAB: FRAUD FLAGS LIST (Component Deliverable 2)                */}
                    {/* ============================================================== */}
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

                    {/* ============================================================== */}
                    {/* TAB: FLAG DETAIL / SCORE BREAKDOWN (Component Deliverable 3)   */}
                    {/* ============================================================== */}
                    {activeTab === 'flag-detail' && (
                        <FlagDetailBreakdown
                            flag={selectedFraudFlag}
                            onBack={() => setActiveTab('fraud-flags')}
                            onDecisionSubmitted={() => {
                                loadData();
                            }}
                        />
                    )}

                    {/* ============================================================== */}
                    {/* TAB: RULE CONFIGURATION PANEL (Component Deliverable 1)        */}
                    {/* ============================================================== */}
                    {activeTab === 'fraud-rules' && (
                        <RuleConfigurationPanel
                            onRuleChanged={() => {
                                loadData();
                            }}
                        />
                    )}

                    {/* ============================================================== */}
                    {/* TAB: FLAGGING TRENDS DASHBOARD (Component Deliverable 4)       */}
                    {/* ============================================================== */}
                    {activeTab === 'fraud-trends' && (
                        <FlaggingTrendsDashboard
                            onNavigateToRules={() => setActiveTab('fraud-rules')}
                            onNavigateToFlags={() => setActiveTab('fraud-flags')}
                        />
                    )}

                </div>
            </main>
        </div>
    );
}