import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import FraudDashboardPage from '../pages/fraud/FraudDashboardPage';
import RuleConfigurationPanel from '../components/fraud/RuleConfigurationPanel';
import FraudFlagList from '../components/fraud/FraudFlagList';
import FlagDetailBreakdown from '../components/fraud/FlagDetailBreakdown';
import FlaggingTrendsDashboard from '../components/fraud/FlaggingTrendsDashboard';

/**
 * Route declarations for the Fraud Scoring & Rules Engine.
 * Append or mount these into your main React Router `<Routes>` configuration.
 */
export default function FraudRoutes() {
  return (
    <Routes>
      {/* Unified Fraud Operations Dashboard */}
      <Route path="/" element={<FraudDashboardPage initialTab="flags" />} />
      <Route path="/flags" element={<FraudDashboardPage initialTab="flags" />} />
      <Route path="/rules" element={<FraudDashboardPage initialTab="rules" />} />
      <Route path="/trends" element={<FraudDashboardPage initialTab="trends" />} />
      <Route path="/flags/:id" element={<FraudDashboardPage initialTab="flag-detail" />} />
      
      {/* Catch-all redirect to flags */}
      <Route path="*" element={<Navigate to="/flags" replace />} />
    </Routes>
  );
}
