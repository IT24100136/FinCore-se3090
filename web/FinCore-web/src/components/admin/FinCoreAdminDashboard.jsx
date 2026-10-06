import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Sidebar from './Sidebar';
import Header from './Header';
import DeviceAnalyticsView from './DeviceAnalyticsView';
import UserManagementView from './UserManagementView';
import DeviceHistoryView from './DeviceHistoryView';
import NotificationLogView from './NotificationLogView';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function FinCoreAdminDashboard() {
  const [activeView, setActiveView] = useState('analytics');

  // Dynamic PostgreSQL state
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userError, setUserError] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    setUserError(null);
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const response = await axios.get('/api/users', { headers });
      setUsers(response.data || []);
    } catch (err) {
      console.error('Failed to fetch user accounts:', err);
      setUserError(err.message || 'Failed to fetch user accounts from database.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleUserStatus = async (userId, newStatus) => {
    try {
      const token = localStorage.getItem('jwt_token') || localStorage.getItem('token') || localStorage.getItem('fincore_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      
      await axios.put(`/api/users/${userId}/status`, { status: newStatus }, { headers });

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
    } catch (err) {
      console.error('Failed to update user status:', err);
      showToast('Failed to update account status in database', 'warning');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers().finally(() => {
      setIsRefreshing(false);
      showToast('Admin data telemetry successfully refreshed', 'info');
    });
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-800 antialiased overflow-hidden">
      {/* Sidebar Navigation */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        flaggedCount={0}
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
                isLoading={isLoadingUsers}
                error={userError}
                onRetry={fetchUsers}
                onToggleUserStatus={handleToggleUserStatus}
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'devices' && (
              <DeviceHistoryView
                searchQuery={searchQuery}
              />
            )}

            {activeView === 'notifications' && (
              <NotificationLogView
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
