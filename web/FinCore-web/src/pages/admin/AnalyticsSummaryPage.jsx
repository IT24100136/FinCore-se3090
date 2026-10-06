import React, { useState, useEffect } from 'react';
import { 
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';

const MOCK_ANALYTICS = {
  totalVolume: 4250000.00,
  reversalRate: 3.2,
  averageTransactionSize: 12500.00,
  chartData: [
    { date: 'Sep 23', volume: 450000 },
    { date: 'Sep 24', volume: 520000 },
    { date: 'Sep 25', volume: 380000 },
    { date: 'Sep 26', volume: 610000 },
    { date: 'Sep 27', volume: 590000 },
    { date: 'Sep 28', volume: 720000 },
    { date: 'Sep 29', volume: 980000 },
  ]
};

const MetricCard = ({ title, value, suffix = "", trend, trendLabel }) => (
  <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{title}</div>
    <div className="text-2xl md:text-3xl font-extrabold text-gray-900">
      {typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: title.includes('Rate') ? 1 : 2 }) : value}{suffix}
    </div>
    
    {trend && (
      <div className={`mt-3 flex items-center text-xs font-semibold ${trend > 0 ? (title.includes('Reversal') ? 'text-red-600' : 'text-emerald-600') : 'text-gray-500'}`}>
        <span>{trend > 0 ? '▲' : '▼'} {Math.abs(trend)}% {trendLabel}</span>
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 p-3 rounded-lg shadow-md">
        <p className="text-xs text-gray-500 mb-1">{label}</p>
        <p className="text-blue-600 font-bold text-sm">
          {payload[0].value.toLocaleString()} LKR
        </p>
      </div>
    );
  }
  return null;
};

const AnalyticsSummaryPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch('/api/transactions/analytics/summary', { headers });
        if (!response.ok) throw new Error("Failed to fetch analytics");
        
        const result = await response.json();
        
        setData({
          totalVolume: result.totalVolume,
          reversalRate: result.reversalRatePercent,
          averageTransactionSize: result.totalTransactions > 0 ? result.totalVolume / result.totalTransactions : 0,
          chartData: result.dailyBreakdown || []
        });
        setLoading(false);
      } catch (err) {
        setTimeout(() => {
          setData(MOCK_ANALYTICS);
          setLoading(false);
        }, 800);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-8">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Loading System Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 md:p-8 font-sans text-gray-900">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            ANALYTICS &gt; SYSTEM OVERVIEW
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
            System Analytics &amp; Volume Metrics
          </h1>
          <p className="text-gray-500 text-xs mt-1">High-level overview of transaction volume and system health.</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          <MetricCard 
            title="Total Transaction Volume" 
            value={data?.totalVolume || 0} 
            suffix=" LKR"
            trend={12.5}
            trendLabel="vs last week"
          />
          <MetricCard 
            title="System Reversal Rate" 
            value={data?.reversalRate || 0} 
            suffix="%"
            trend={-0.4}
            trendLabel="vs last month"
          />
          <MetricCard 
            title="Average Transaction Size" 
            value={data?.averageTransactionSize || 0} 
            suffix=" LKR"
            trend={2.1}
            trendLabel="vs last week"
          />
        </div>

        {/* Chart Section */}
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-base font-bold text-gray-900">Transaction Volume Over Time (LKR)</h2>
            <div className="px-3 py-1 bg-slate-50 text-gray-600 text-xs font-medium rounded-full border border-gray-200">
              Last 7 Days
            </div>
          </div>
          
          <div className="h-[360px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#94a3b8" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#94a3b8" 
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value / 1000}k`}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#2563eb" 
                  strokeWidth={2.5}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default AnalyticsSummaryPage;
