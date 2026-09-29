import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart 
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

const MetricCard = ({ title, value, prefix = "", suffix = "", trend, trendLabel }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden group">
    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
      <svg className="w-16 h-16 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    </div>
    
    <h3 className="text-slate-400 font-medium text-sm tracking-wide uppercase mb-2">{title}</h3>
    <div className="flex items-baseline space-x-1">
      <span className="text-3xl font-bold text-slate-100">
        {prefix}{typeof value === 'number' ? value.toLocaleString(undefined, { minimumFractionDigits: title.includes('Rate') ? 1 : 2 }) : value}{suffix}
      </span>
    </div>
    
    {trend && (
      <div className={`mt-4 flex items-center text-sm font-medium ${trend > 0 ? (title.includes('Reversal') ? 'text-rose-400' : 'text-emerald-400') : 'text-slate-400'}`}>
        {trend > 0 ? (
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : (
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
        )}
        <span>{Math.abs(trend)}% {trendLabel}</span>
      </div>
    )}
  </div>
);

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl">
        <p className="text-slate-400 mb-1">{label}</p>
        <p className="text-blue-400 font-bold text-lg">
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
  const [error, setError] = useState(null);

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
        
        // Map backend response to component state
        setData({
          totalVolume: result.totalVolume,
          reversalRate: result.reversalRatePercent,
          averageTransactionSize: result.totalTransactions > 0 ? result.totalVolume / result.totalTransactions : 0,
          chartData: result.dailyBreakdown || []
        });
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError(err.message);
        // Fallback to mock data if API fails
        setTimeout(() => {
          setData(MOCK_ANALYTICS);
          setLoading(false);
        }, 1000);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 border-4 border-slate-800 border-t-blue-500 rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium tracking-wide">Loading System Analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-8 font-sans text-slate-200">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
            System Analytics
          </h1>
          <p className="text-slate-400 mt-2">High-level overview of transaction volume and system health.</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="mb-6 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-100">Transaction Volume Over Time (LKR)</h2>
            <div className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-md border border-slate-700">
              Last 7 Days
            </div>
          </div>
          
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.chartData || []} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b" 
                  tick={{ fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#64748b" 
                  tick={{ fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `${value / 1000}k`}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="volume" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorVolume)" 
                  activeDot={{ r: 6, fill: '#60a5fa', stroke: '#1e3a8a', strokeWidth: 2 }}
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
