import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function DeviceHistory({ userId }) {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        axios.get(`/api/devices/${userId}/sessions`)
            .then(response => {
                setSessions(response.data);
                setLoading(false);
            })
            .catch(error => {
                console.error("Error fetching sessions:", error);
                setLoading(false);
            });
    }, [userId]);

    if (loading) return <p>Loading device history...</p>;

    return (
        <div className="device-history-panel">
            <h2>Device Session History</h2>
            <table border="1" cellPadding="10" style={{ width: '100%', textAlign: 'left' }}>
                <thead>
                    <tr>
                        <th>Device Fingerprint</th>
                        <th>IP Address</th>
                        <th>Status</th>
                        <th>Last Login</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(session => (
                        <tr key={session.id}>
                            <td>{session.deviceFingerprint}</td>
                            <td>{session.ipAddress}</td>
                            <td>{session.status}</td>
                            <td>{new Date(session.lastLoginAt).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}