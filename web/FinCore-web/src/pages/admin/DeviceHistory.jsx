import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Smartphone, Clock, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function DeviceHistory({ userId }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`/api/devices/${userId}/sessions`)
            .then(response => {
                setSessions(response.data || []);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching sessions:", error);
                setLoading(false);
            });
    }, [userId]);

    if (loading) {
        return (
            <div className="p-6 bg-white rounded-lg border border-gray-200 shadow-sm animate-pulse space-y-3">
                <div className="h-4 bg-slate-200 rounded w-1/4"></div>
                <div className="h-20 bg-slate-100 rounded w-full"></div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 bg-slate-50 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-blue-600" />
                    Device Session History
                </h3>
                <span className="text-xs text-slate-500 font-semibold">{sessions.length} recorded sessions</span>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            <th className="px-6 py-3.5">Device Fingerprint</th>
                            <th className="px-6 py-3.5">IP Address</th>
                            <th className="px-6 py-3.5">Status</th>
                            <th className="px-6 py-3.5">Last Login</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-sm text-gray-700">
                        {sessions.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-8 text-center text-slate-400">
                                    No device session history available.
                                </td>
                            </tr>
                        ) : (
                            sessions.map(session => (
                                <tr key={session.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                                        {session.deviceFingerprint}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-xs text-slate-600">
                                        {session.ipAddress}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                            session.status === 'Trusted' ? 'bg-emerald-50 text-emerald-600' :
                                            session.status === 'Verified' ? 'bg-blue-50 text-blue-600' :
                                            session.status === 'Flagged' ? 'bg-red-50 text-red-600' :
                                            'bg-slate-100 text-slate-600'
                                        }`}>
                                            {session.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-slate-500">
                                        {new Date(session.lastLoginAt).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}