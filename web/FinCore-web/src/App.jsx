import React from 'react';
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import AnalystReviewPage from './pages/AnalystReviewPage';
import TransactionMonitoringDashboard from './pages/admin/TransactionMonitoringDashboard';
import AnalyticsSummaryPage from './pages/admin/AnalyticsSummaryPage';

function App() {
  return (
    <BrowserRouter>
      <div style={{ width: '100%', minHeight: '100vh', margin: 0, padding: 0 }}>
        {/* Quick Dev Navigation Menu - You can replace this later with your real sidebar/header */}
        <nav style={{ padding: '1rem', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b', display: 'flex', gap: '2rem' }}>
          <Link to="/" style={{ color: '#94a3b8', textDecoration: 'none', fontWeight: '500' }}>🏠 Analyst Review</Link>
          <Link to="/admin/transactions" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 'bold' }}>📊 Transaction Monitoring</Link>
          <Link to="/admin/analytics" style={{ color: '#34d399', textDecoration: 'none', fontWeight: 'bold' }}>📈 System Analytics</Link>
        </nav>

        {/* Route Configuration */}
        <Routes>
          <Route path="/" element={<AnalystReviewPage />} />
          <Route path="/admin/transactions" element={<TransactionMonitoringDashboard />} />
          <Route path="/admin/analytics" element={<AnalyticsSummaryPage />} />
          
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;