import React from 'react';
import { 
  TrendingUp, 
  Smartphone, 
  BellCheck, 
  AlertTriangle, 
  ShieldAlert, 
  CheckCircle2, 
  SmartphoneNfc,
  Laptop,
  ArrowUpRight,
  ShieldCheck,
  Activity,
  ChevronRight,
  Shield,
  Layers
} from 'lucide-react';
import { MOCK_SUMMARY_STATS, MOCK_DEVICE_DISTRIBUTION, MOCK_SECURITY_ALERTS } from './mockData';

export default function DeviceAnalyticsView({ onViewAllFlagged, onViewSessions }) {
  const { weeklyDeviceLogins, notificationSuccessRate, flaggedUsers } = MOCK_SUMMARY_STATS;

  return (
    <div className="space-y-6">
      {/* View Title & Quick Stat Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
            Device Analytics Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time device registration trends, delivery health, and fraud telemetry.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
            Auto-syncing (30s)
          </span>
        </div>
      </div>

      {/* Grid of 3 Premium Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: New Device Logins This Week */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              New Device Logins This Week
            </span>
            <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Smartphone className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-4 relative z-10">
            <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
              {weeklyDeviceLogins.count.toLocaleString()}
            </div>
            
            {/* Subtle Upward Trend Icon */}
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>+{weeklyDeviceLogins.trendPercent}%</span>
            </div>
          </div>

          {/* Sub breakdown */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 relative z-10">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              iOS: <strong className="text-slate-800">{weeklyDeviceLogins.breakdown.ios}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Android: <strong className="text-slate-800">{weeklyDeviceLogins.breakdown.android}</strong>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
              Web: <strong className="text-slate-800">{weeklyDeviceLogins.breakdown.web}</strong>
            </span>
          </div>
        </div>

        {/* Card 2: Notification Delivery Success Rate */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50/50 rounded-bl-full -mr-6 -mt-6 transition-transform group-hover:scale-110"></div>
          
          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Notification Delivery Success Rate
            </span>
            <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <BellCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-4 relative z-10">
            <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
              {notificationSuccessRate.rate}%
            </div>
            
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>+{notificationSuccessRate.trendPercent}%</span>
            </div>
          </div>

          {/* Sub breakdown */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 relative z-10">
            <span>Delivered: <strong className="text-slate-800">{notificationSuccessRate.sentCount.toLocaleString()}</strong></span>
            <span className="text-rose-600 font-medium">Failed: {notificationSuccessRate.failedCount}</span>
          </div>
        </div>

        {/* Card 3: Users with Multiple Flagged Devices (Highlighted in Amber/Red Warning) */}
        <div className="bg-gradient-to-br from-amber-50/90 to-red-50/90 rounded-xl border-2 border-amber-300 p-6 shadow-md hover:shadow-lg transition-all relative overflow-hidden group">
          <div className="absolute -bottom-6 -right-6 w-28 h-28 bg-amber-200/30 rounded-full blur-lg pointer-events-none"></div>

          <div className="flex items-center justify-between mb-3 relative z-10">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 animate-bounce" />
              Users with Multiple Flagged Devices
            </span>
            <div className="w-9 h-9 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>

          <div className="flex items-baseline justify-between mb-4 relative z-10">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-black text-amber-950 font-sans tracking-tight">
                {flaggedUsers.count}
              </div>
              <span className="text-xs font-bold text-amber-800">Users</span>
            </div>

            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-600 text-white shadow-sm">
              High Risk
            </span>
          </div>

          {/* Sub details and action */}
          <div className="pt-3 border-t border-amber-200/80 flex items-center justify-between text-xs relative z-10">
            <span className="text-amber-900 font-medium">
              {flaggedUsers.criticalCount} require immediate freeze
            </span>

            <button
              onClick={onViewSessions}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors"
            >
              Investigate <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Analytics Detailed Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Mobile OS Distribution */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">Device Platform Distribution</h3>
              <p className="text-xs text-slate-500">Active FinCore mobile app & web client telemetry</p>
            </div>
            <span className="text-xs text-slate-400 font-medium">Total: 1,428 active</span>
          </div>

          {/* Progress visualizers */}
          <div className="space-y-4">
            {MOCK_DEVICE_DISTRIBUTION.map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-slate-700 flex items-center gap-2">
                    {item.name.includes('iOS') && <Smartphone className="w-4 h-4 text-blue-600" />}
                    {item.name.includes('Android') && <SmartphoneNfc className="w-4 h-4 text-emerald-600" />}
                    {item.name.includes('Web') && <Laptop className="w-4 h-4 text-indigo-600" />}
                    {item.name}
                  </span>
                  <span className="text-slate-900 font-bold">{item.count} logins ({item.percentage}%)</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden p-0.5 border border-slate-200/60">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${item.percentage}%`, backgroundColor: item.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          {/* iOS / FinTech Security Note */}
          <div className="mt-6 p-4 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-blue-900">iOS Biometric Passkey & Enclave Policy active</h4>
              <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                98.2% of iOS device logins utilized Secure Enclave FaceID / TouchID biometric attestations.
              </p>
            </div>
          </div>
        </div>

        {/* Security Alert Feed */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-500" />
                Security Signals
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full">
                Live Audit
              </span>
            </div>

            <div className="space-y-3">
              {MOCK_SECURITY_ALERTS.map((alert) => (
                <div key={alert.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-slate-800">{alert.title}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{alert.time} • {alert.count} instances</div>
                  </div>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                    alert.severity === 'High' ? 'bg-rose-100 text-rose-700 border border-rose-200' :
                    alert.severity === 'Medium' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                    'bg-slate-200 text-slate-700'
                  }`}>
                    {alert.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={onViewSessions}
            className="w-full mt-6 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <span>Open Session Inspector</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
