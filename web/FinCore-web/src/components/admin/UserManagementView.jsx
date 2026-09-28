import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  UserX, 
  UserCheck, 
  MoreVertical, 
  ShieldAlert, 
  Copy, 
  Check, 
  Mail, 
  Calendar,
  Smartphone,
  ChevronDown,
  AlertCircle
} from 'lucide-react';

export default function UserManagementView({ users, onToggleUserStatus, searchQuery }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedUser, setSelectedUser] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, user: null });

  // Filter users based on search & status filter
  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || user.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleActionClick = (user, newStatus) => {
    setConfirmModal({
      isOpen: true,
      user,
      newStatus
    });
    setOpenDropdownId(null);
  };

  const confirmStatusChange = () => {
    if (confirmModal.user) {
      onToggleUserStatus(confirmModal.user.id, confirmModal.newStatus);
      setConfirmModal({ isOpen: false, user: null });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            User Management Panel
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage customer accounts, enforcement actions, and security status.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-500 font-medium">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="All">All Statuses ({users.length})</option>
              <option value="Active">Active Users</option>
              <option value="Suspended">Suspended Users</option>
            </select>
          </div>
        </div>
      </div>

      {/* Clean White Card Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">User / Name</th>
                <th className="py-3.5 px-6">Email Address</th>
                <th className="py-3.5 px-6">Role & Devices</th>
                <th className="py-3.5 px-6">Account Status</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No users found matching your query.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isSuspended = user.status === 'Suspended';
                  return (
                    <tr
                      key={user.id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Name Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <img
                            src={user.avatar}
                            alt={user.name}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200"
                          />
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {user.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {user.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email Address Column */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">{user.email}</span>
                          <button
                            onClick={() => copyToClipboard(user.email, user.id)}
                            title="Copy email"
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-slate-100 transition-colors"
                          >
                            {copiedId === user.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role & Devices */}
                      <td className="py-4 px-6">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-800">{user.role}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{user.registeredDevices} devices</span>
                            {user.flaggedDevices > 0 && (
                              <span className="text-amber-600 font-bold bg-amber-50 px-1.5 rounded">
                                {user.flaggedDevices} flagged
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Account Status Column (Pill Badges) */}
                      <td className="py-4 px-6">
                        {isSuspended ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                            Suspended
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
                            Active
                          </span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="py-4 px-6 text-right relative">
                        <div className="inline-flex items-center gap-2">
                          {/* Basic Dropdown / Direct Action Button */}
                          {isSuspended ? (
                            <button
                              onClick={() => handleActionClick(user, 'Active')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Reactivate
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActionClick(user, 'Suspended')}
                              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shadow-sm flex items-center gap-1.5"
                            >
                              <UserX className="w-3.5 h-3.5" />
                              Suspend Account
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredUsers.length} of {users.length} registered accounts</span>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active: {users.filter(u => u.status === 'Active').length}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Suspended: {users.filter(u => u.status === 'Suspended').length}
            </span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.user && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4 mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 text-center">
              Confirm {confirmModal.newStatus === 'Suspended' ? 'Account Suspension' : 'Account Reactivation'}
            </h3>

            <p className="text-xs text-slate-600 text-center mt-2 leading-relaxed">
              Are you sure you want to change the status of <strong className="text-slate-900">{confirmModal.user.name}</strong> ({confirmModal.user.email}) to <span className="font-bold underline">{confirmModal.newStatus}</span>?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmModal({ isOpen: false, user: null })}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmStatusChange}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white shadow-md transition-colors ${
                  confirmModal.newStatus === 'Suspended'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                Confirm {confirmModal.newStatus}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
