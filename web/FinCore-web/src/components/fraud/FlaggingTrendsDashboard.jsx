import React, { useState, useEffect } from 'react';
import { fraudService } from '../../services/fraudService';
import {
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  SlidersHorizontal,
  Activity
} from 'lucide-react';

export default function FlaggingTrendsDashboard({ onNavigateToRules, onNavigateToFlags }) {
  const [timeRange, setTimeRange] = useState('14D');
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null);
  const [loading, setLoading] = useState(false);
  const [rankedRules, setRankedRules] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const rules = await fraudService.getRules();
      const sorted = [...rules].sort((a, b) => (b.triggerCount || 0) - (a.triggerCount || 0));
      setRankedRules(sorted);
    } catch (err) {
      console.error('Error loading trend analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const getTimeSeriesData = () => {
    if (timeRange === '7D') {
      return [
        { date: 'Sep 21', totalFlags: 24, highRisk: 8, cleared: 14, confirmedFraud: 2 },
        { date: 'Sep 22', totalFlags: 31, highRisk: 11, cleared: 18, confirmedFraud: 2 },
        { date: 'Sep 23', totalFlags: 28, highRisk: 9, cleared: 16, confirmedFraud: 3 },
        { date: 'Sep 24', totalFlags: 42, highRisk: 16, cleared: 22, confirmedFraud: 4 },
        { date: 'Sep 25', totalFlags: 38, highRisk: 14, cleared: 21, confirmedFraud: 3 },
        { date: 'Sep 26', totalFlags: 45, highRisk: 19, cleared: 23, confirmedFraud: 3 },
        { date: 'Sep 27', totalFlags: 39, highRisk: 15, cleared: 21, confirmedFraud: 3 }
      ];
    }
    if (timeRange === '30D') {
      return [
        { date: 'Week 1', totalFlags: 184, highRisk: 62, cleared: 112, confirmedFraud: 10 },
        { date: 'Week 2', totalFlags: 210, highRisk: 74, cleared: 125, confirmedFraud: 11 },
        { date: 'Week 3', totalFlags: 195, highRisk: 68, cleared: 116, confirmedFraud: 11 },
        { date: 'Week 4', totalFlags: 245, highRisk: 91, cleared: 142, confirmedFraud: 12 }
      ];
    }
    return [
      { date: 'Sep 14', totalFlags: 22, highRisk: 7, cleared: 13, confirmedFraud: 2 },
      { date: 'Sep 15', totalFlags: 29, highRisk: 10, cleared: 17, confirmedFraud: 2 },
      { date: 'Sep 16', totalFlags: 26, highRisk: 8, cleared: 15, confirmedFraud: 3 },
      { date: 'Sep 17', totalFlags: 34, highRisk: 12, cleared: 19, confirmedFraud: 3 },
      { date: 'Sep 18', totalFlags: 31, highRisk: 11, cleared: 18, confirmedFraud: 2 },
      { date: 'Sep 19', totalFlags: 40, highRisk: 15, cleared: 22, confirmedFraud: 3 },
      { date: 'Sep 20', totalFlags: 35, highRisk: 13, cleared: 19, confirmedFraud: 3 },
      { date: 'Sep 21', totalFlags: 24, highRisk: 8, cleared: 14, confirmedFraud: 2 },
      { date: 'Sep 22', totalFlags: 31, highRisk: 11, cleared: 18, confirmedFraud: 2 },
      { date: 'Sep 23', totalFlags: 28, highRisk: 9, cleared: 16, confirmedFraud: 3 },
      { date: 'Sep 24', totalFlags: 42, highRisk: 16, cleared: 22, confirmedFraud: 4 },
      { date: 'Sep 25', totalFlags: 38, highRisk: 14, cleared: 21, confirmedFraud: 3 },
      { date: 'Sep 26', totalFlags: 45, highRisk: 19, cleared: 23, confirmedFraud: 3 },
      { date: 'Sep 27', totalFlags: 39, highRisk: 15, cleared: 21, confirmedFraud: 3 }
    ];
  };

  const chartData = getTimeSeriesData();

  const totalVolume = chartData.reduce((acc, curr) => acc + curr.totalFlags, 0);
  const totalCleared = chartData.reduce((acc, curr) => acc + curr.cleared, 0);
  const totalConfirmed = chartData.reduce((acc, curr) => acc + curr.confirmedFraud, 0);
  const falsePositiveRate = ((totalCleared / (totalCleared + totalConfirmed)) * 100).toFixed(1);
  const totalHighRisk = chartData.reduce((acc, curr) => acc + curr.highRisk, 0);

  const chartHeight = 220;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;
  const maxFlagVal = Math.max(...chartData.map(d => d.totalFlags), 50);

  const getX = (index) => paddingX + (index / (chartData.length - 1)) * (chartWidth - paddingX * 2);
  const getY = (val) => chartHeight - paddingY - (val / maxFlagVal) * (chartHeight - paddingY * 2);

  const totalFlagsPath = chartData.reduce((path, d, i) => {
    const x = getX(i);
    const y = getY(d.totalFlags);
    return i === 0 ? `M ${x},${y}` : `${path} L ${x},${y}`;
  }, '');

  const totalFlagsArea = `${totalFlagsPath} L ${getX(chartData.length - 1)},${chartHeight - paddingY} L ${getX(0)},${chartHeight - paddingY} Z`;

  const highRiskPath = chartData.reduce((path, d, i) => {
    const x = getX(i);
    const y = getY(d.highRisk);
    return i === 0 ? `M ${x},${y}` : `${path} L ${x},${y}`;
  }, '');

  return (
    <div className="space-y-6 font-sans text-gray-900">

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            FRAUD INTELLIGENCE &gt; ANALYTICS
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-6 h-6 text-blue-600" /> Flagging Trends &amp; Engine Accuracy
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Longitudinal telemetry tracking automated flag velocity, false-positive ratio, and rule efficacy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
            {['7D', '14D', '30D'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors cursor-pointer ${
                  timeRange === range
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-slate-50'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboardData}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-slate-50 shadow-sm cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-500 uppercase">
            <span>False-Positive Rate</span>
            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200 text-[10px] font-bold">
              Engine Metric
            </span>
          </div>
          <div className="text-3xl font-extrabold text-blue-600">{falsePositiveRate}%</div>
          <div className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5" /> -1.8% vs last cycle
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase">Total Flags Evaluated</div>
          <div className="text-3xl font-extrabold text-gray-900">{totalVolume.toLocaleString()}</div>
          <div className="text-xs text-red-600 font-semibold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +4.2% volume
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <div className="text-xs font-semibold text-red-600 uppercase">Critical Risk (&gt;75)</div>
          <div className="text-3xl font-extrabold text-red-600">{totalHighRisk}</div>
          <div className="text-xs text-gray-500 font-medium">({((totalHighRisk / totalVolume) * 100).toFixed(0)}% of total)</div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <div className="text-xs font-semibold text-gray-500 uppercase">Mean Time to Decision</div>
          <div className="text-3xl font-extrabold text-gray-900">3.8 <span className="text-sm font-semibold text-gray-500">min</span></div>
          <div className="text-xs text-emerald-600 font-semibold">98.4% within SLA</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* SVG Line Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Flags Over Time Volume Trend</h3>
              <p className="text-xs text-gray-500">Daily velocity comparison between overall flags and critical risk</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-blue-600 rounded"></span> Total</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-1 bg-red-600 rounded"></span> Critical</div>
            </div>
          </div>

          <div className="p-6">
            <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-auto overflow-visible">
              <defs>
                <linearGradient id="flagAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const val = Math.round(maxFlagVal * (1 - pct));
                const y = paddingY + pct * (chartHeight - paddingY * 2);
                return (
                  <g key={i}>
                    <line x1={paddingX} y1={y} x2={chartWidth - paddingX} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={paddingX - 8} y={y + 3} fill="#94a3b8" fontSize="10" textAnchor="end" className="font-mono">{val}</text>
                  </g>
                );
              })}

              <path d={totalFlagsArea} fill="url(#flagAreaGradient)" />
              <path d={totalFlagsPath} fill="none" stroke="#2563eb" strokeWidth="2.5" />
              <path d={highRiskPath} fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="4 3" />

              {chartData.map((d, i) => {
                const x = getX(i);
                const yTotal = getY(d.totalFlags);
                return (
                  <g key={i} onMouseEnter={() => setHoveredPointIndex(i)} onMouseLeave={() => setHoveredPointIndex(null)} className="cursor-pointer">
                    <circle cx={x} cy={yTotal} r={3.5} fill="#fff" stroke="#2563eb" strokeWidth="2" />
                    <text x={x} y={chartHeight - 6} fill="#64748b" fontSize="10" textAnchor="middle">{d.date}</text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Most-Triggered Rules (1 col) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4">
          <div className="p-4 bg-slate-50 border-b border-gray-200 flex justify-between items-center">
            <h3 className="text-sm font-bold text-gray-900">Most-Triggered Rules</h3>
            {onNavigateToRules && (
              <button onClick={onNavigateToRules} className="text-xs text-blue-600 font-bold hover:underline cursor-pointer">
                Manage Rules
              </button>
            )}
          </div>

          <div className="p-4 space-y-3">
            {rankedRules.slice(0, 5).map((rule, idx) => (
              <div key={rule.id} className="p-3 rounded-lg bg-slate-50 border border-gray-100 text-xs space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-900">{rule.ruleName}</span>
                  <span className="font-extrabold text-blue-600">{rule.triggerCount || 120} hits</span>
                </div>
                <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full" style={{ width: `${Math.min(100, (rule.triggerCount || 100) / 3.5)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}
