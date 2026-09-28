import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import DeviceAnalyticsView from './DeviceAnalyticsView';
import UserManagementView from './UserManagementView';
import DeviceHistoryView from './DeviceHistoryView';
import NotificationLogView from './NotificationLogView';
import { 
  MOCK_USERS, 
  MOCK_DEVICE_SESSIONS, 
  MOCK_NOTIFICATION_LOGS 
} from './mockData';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function FinCoreAdminDashboard() {
  // Navigation State between 4 Views: 'analytics' | 'users' | 'devices' | 'notifications'
  const [activeView, setActiveView] = useState('analytics');

  // Dynamic Data States
  const [users, setUsers] = useState(MOCK_USERS);
  const [sessions, setSessions] = useState(MOCK_DEVICE_SESSIONS);
  const [logs, setLogs] = useState(MOCK_NOTIFICATION_LOGS);
  
  // Header Search & Refresh States
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  // Show temporary toast message
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  // Toggle user active / suspended status
  const handleToggleUserStatus = (userId, newStatus) => {
    setUsers((prevUsers) =>
      prevUsers.map((u) =>
        u.id === userId ? { ...u, status: newStatus } : u
      )
    );

    const targetUser = users.find((u) => u.id === userId);
    showToast(
      `Account ${targetUser ? targetUser.name : userId} is now ${newStatus}`,
      newStatus === 'Suspended' ? 'warning' : 'success'
    );
  };

  // Update session status (Trusted, Verified, Unverified, Flagged)
  const handleUpdateSessionStatus = (sessionId, newStatus) => {
    setSessions((prevSessions) =>
      prevSessions.map((s) =>
        s.id === sessionId ? { ...s, status: newStatus } : s
      )
    );

    showToast(`Device session ${sessionId} status updated to ${newStatus}`, 'info');
  };

  // Resend failed notification
  const handleResendNotification = (logId) => {
    const nowStr = new Date().toLocaleString('sv').replace(' ', ' ');
    setLogs((prevLogs) =>
      prevLogs.map((log) =>
        log.id === logId
          ? {
              ...log,
              deliveryStatus: 'Sent',
              timestamp: nowStr,
              latencyMs: Math.floor(Math.random() * 200) + 150
            }
          : log
      )
    );

    showToast(`Notification ${logId} successfully re-dispatched!`, 'success');
  };

  // Simulate manual data refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      showToast('Admin data telemetry successfully refreshed', 'info');
    }, 700);
  };

  // Count flagged devices/users for sidebar badge
  const flaggedCount = sessions.filter((s) => s.status === 'Flagged').length;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        flaggedCount={flaggedCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <Header
          activeView={activeView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        {/* Dynamic View Container */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            {activeView === 'analytics' && (
              <DeviceAnalyticsView
                onViewAllFlagged={() => setActiveView('devices')}
                onViewSessions={() => setActiveView('devices')}
              />
            )}

            {activeView === 'users' && (
              <UserManagementView
                users={users}
                onToggleUserStatus={handleToggleUserStatus}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'devices' && (
              <DeviceHistoryView
                sessions={sessions}
                onUpdateSessionStatus={handleUpdateSessionStatus}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'notifications' && (
              <NotificationLogView
                logs={logs}
                onResendNotification={handleResendNotification}
                searchQuery={searchQuery}
              />
            )}
          </div>
        </main>
      </div>

      {/* Global Action Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-xl border flex items-center gap-3 text-xs font-semibold text-white ${
              toast.type === 'warning'
                ? 'bg-amber-600 border-amber-500'
                : toast.type === 'info'
                ? 'bg-slate-900 border-slate-700'
                : 'bg-emerald-600 border-emerald-500'
            }`}
          >
            {toast.type === 'warning' ? (
              <AlertCircle className="w-4 h-4 text-white" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-400" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-white" />
            )}
            <span>{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 text-white/80 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
