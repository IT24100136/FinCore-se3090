import React, { useState } from 'react';
import { 
  Smartphone, 
  MapPin, 
  Globe, 
  Clock, 
  ShieldAlert, 
  ShieldCheck, 
  Copy, 
  Check, 
  Filter, 
  Search, 
  AlertTriangle,
  Eye,
  X,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function DeviceHistoryView({ sessions, onUpdateSessionStatus, searchQuery }) {
  const [statusFilter, setStatusFilter] = useState('All');
  const [copiedFingerprint, setCopiedFingerprint] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);

  // Filter sessions based on search & status filter
  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.userId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.ipAddress.includes(searchQuery) ||
      session.deviceFingerprint.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.location.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'All' || session.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const truncateFingerprint = (fp) => {
    if (!fp) return '';
    return `${fp.substring(0, 8)}...${fp.substring(fp.length - 6)}`;
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(id);
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  // Render Status Pill Badge according to exact requirements:
  // Gray for "Unverified", Blue for "Verified", Green for "Trusted", Red for "Flagged"
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'Unverified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
            Unverified
          </span>
        );
      case 'Verified':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
            Verified
          </span>
        );
      case 'Trusted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            Trusted
          </span>
        );
      case 'Flagged':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse"></span>
            Flagged
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* View Title & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Device / Session History Viewer
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Investigate suspicious multi-device patterns, IP locations, and security statuses.
          </p>
        </div>

        {/* Status Filter Pills */}
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm overflow-x-auto">
          {['All', 'Flagged', 'Unverified', 'Verified', 'Trusted'].map((tab) => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                statusFilter === tab
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab === 'All' ? `All (${sessions.length})` : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Clean White Card Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3.5 px-6">User ID / Name</th>
                <th className="py-3.5 px-6">Device Fingerprint</th>
                <th className="py-3.5 px-6">IP Address</th>
                <th className="py-3.5 px-6">Location</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Last Login Time</th>
                <th className="py-3.5 px-6 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredSessions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-50 text-slate-400" />
                    <p className="text-sm font-medium">No session logs match your criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredSessions.map((session) => (
                  <tr
                    key={session.id}
                    className={`hover:bg-slate-50/70 transition-colors ${
                      session.status === 'Flagged' ? 'bg-rose-50/30' : ''
                    }`}
                  >
                    {/* User ID / Name */}
                    <td className="py-4 px-6">
                      <div>
                        <div className="font-bold text-slate-900">{session.userName}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{session.userId}</div>
                      </div>
                    </td>

                    {/* Device Fingerprint (Truncated) */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] bg-slate-100 px-2 py-1 rounded-md text-slate-700 w-fit">
                        <span>{truncateFingerprint(session.deviceFingerprint)}</span>
                        <button
                          onClick={() => copyToClipboard(session.deviceFingerprint, session.id)}
                          title="Copy Full Fingerprint"
                          className="text-slate-400 hover:text-blue-600 transition-colors"
                        >
                          {copiedFingerprint === session.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* IP Address */}
                    <td className="py-4 px-6 font-mono font-medium text-slate-800">
                      {session.ipAddress}
                    </td>

                    {/* Location */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span>{session.location}</span>
                      </div>
                    </td>

                    {/* Status Pill Badge */}
                    <td className="py-4 px-6">
                      {renderStatusBadge(session.status)}
                    </td>

                    {/* Last Login Time */}
                    <td className="py-4 px-6 text-slate-600 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{session.lastLoginTime}</span>
                      </div>
                    </td>

                    {/* Inspect Button */}
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="p-1.5 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-slate-100 transition-colors border border-slate-200/60"
                        title="View Full Session Telemetry"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filteredSessions.length} device sessions</span>
          <div className="flex items-center gap-4">
            <span className="text-rose-600 font-bold">
              Flagged: {sessions.filter(s => s.status === 'Flagged').length}
            </span>
            <span className="text-blue-600 font-bold">
              Verified: {sessions.filter(s => s.status === 'Verified').length}
            </span>
            <span className="text-emerald-600 font-bold">
              Trusted: {sessions.filter(s => s.status === 'Trusted').length}
            </span>
          </div>
        </div>
      </div>

      {/* Session Details Inspect Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Session Telemetry Inspector
                  </h3>
                  <p className="text-xs text-slate-400">{selectedSession.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedSession(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">User Account:</span>
                  <span className="font-bold text-slate-900">{selectedSession.userName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Current Status:</span>
                  {renderStatusBadge(selectedSession.status)}
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-semibold block mb-1">Full Hardware Device Fingerprint</span>
                <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] rounded-xl break-all relative">
                  {selectedSession.deviceFingerprint}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 block">IP Address</span>
                  <span className="font-mono font-bold text-slate-800">{selectedSession.ipAddress}</span>
                </div>
                <div className="p-3 border border-slate-200 rounded-xl">
                  <span className="text-slate-400 block">Geolocation</span>
                  <span className="font-bold text-slate-800">{selectedSession.location}</span>
                </div>
              </div>

              {selectedSession.reason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                  <span className="font-bold block mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" /> Security Signal Reason:
                  </span>
                  {selectedSession.reason}
                </div>
              )}

              {/* Status Change Buttons */}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400 font-medium">Update Status:</span>
                <div className="flex items-center gap-2">
                  {['Trusted', 'Verified', 'Unverified', 'Flagged'].map((st) => (
                    <button
                      key={st}
                      onClick={() => {
                        onUpdateSessionStatus(selectedSession.id, st);
                        setSelectedSession({ ...selectedSession, status: st });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        selectedSession.status === st
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
