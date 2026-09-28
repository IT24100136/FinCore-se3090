import React, { useState, useEffect } from 'react';
import { fraudService, INITIAL_RULES } from '../../services/fraudService';
import {
  TrendingUp,
  BarChart3,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  ShieldAlert,
  Sliders,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  RefreshCw,
  Percent,
  Clock,
  Layers,
  Activity
} from 'lucide-react';

export default function FlaggingTrendsDashboard({ onNavigateToRules, onNavigateToFlags }) {
  const [timeRange, setTimeRange] = useState('14D'); // '7D' | '14D' | '30D'
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
      // Sort rules by triggerCount descending for ranked list
      const sorted = [...rules].sort((a, b) => (b.triggerCount || 0) - (a.triggerCount || 0));
      setRankedRules(sorted);
    } catch (err) {
      console.error('Error loading trend analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  // Mock time-series dataset based on selected timeRange
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
    // Default: 14D
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

  // Metrics Calculations
  const totalVolume = chartData.reduce((acc, curr) => acc + curr.totalFlags, 0);
  const totalCleared = chartData.reduce((acc, curr) => acc + curr.cleared, 0);
  const totalConfirmed = chartData.reduce((acc, curr) => acc + curr.confirmedFraud, 0);
  // False Positive Rate = Cleared Legitimate / (Cleared + Confirmed) * 100
  const falsePositiveRate = ((totalCleared / (totalCleared + totalConfirmed)) * 100).toFixed(1);
  const totalHighRisk = chartData.reduce((acc, curr) => acc + curr.highRisk, 0);

  // SVG Chart Dimensions & Coordinates
  const chartHeight = 220;
  const chartWidth = 720;
  const paddingX = 40;
  const paddingY = 25;
  const maxFlagVal = Math.max(...chartData.map(d => d.totalFlags), 50);

  const getX = (index) => {
    return paddingX + (index / (chartData.length - 1)) * (chartWidth - paddingX * 2);
  };

  const getY = (val) => {
    return chartHeight - paddingY - (val / maxFlagVal) * (chartHeight - paddingY * 2);
  };

  // Generate SVG path strings
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px', marginBottom: '4px' }}>
            FRAUD INTELLIGENCE &gt; ANALYTICS &amp; ENGINE HEALTH
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={24} color="#2563eb" /> Flagging Trends &amp; Engine Accuracy
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            Longitudinal telemetry tracking automated flag velocity, false-positive ratio, and rule efficacy.
          </p>
        </div>

        {/* Timeframe Filter Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', backgroundColor: '#e2e8f0', borderRadius: '8px', padding: '3px' }}>
            {['7D', '14D', '30D'].map(range => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  backgroundColor: timeRange === range ? '#2563eb' : 'transparent',
                  color: timeRange === range ? '#fff' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={loadDashboardData}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Top Stat Cards (4 Cards including False-Positive Rate) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '16px'
      }}>

        {/* STAT CARD 1: FALSE-POSITIVE RATE (Required Deliverable) */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>False-Positive Rate</span>
            <span style={{
              backgroundColor: '#dbeafe',
              color: '#1e40af',
              fontSize: '11px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '12px'
            }}>
              Engine Metric
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 900, color: '#2563eb' }}>
              {falsePositiveRate}%
            </span>
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
              <ArrowDownRight size={14} /> -1.8% vs last cycle
            </span>
          </div>

          {/* Cleared vs Confirmed Bar Breakdown */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>
              <span>Cleared (Legit): <strong>{totalCleared}</strong></span>
              <span>Confirmed Fraud: <strong>{totalConfirmed}</strong></span>
            </div>
            <div style={{ width: '100%', height: '8px', backgroundColor: '#dc2626', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
              <div
                style={{
                  width: `${falsePositiveRate}%`,
                  height: '100%',
                  backgroundColor: '#16a34a'
                }}
                title={`Cleared Legitimate: ${totalCleared}`}
              />
            </div>
          </div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
            Percentage of flags investigated and cleared as legitimate customer actions
          </div>
        </div>

        {/* STAT CARD 2: Total Flagged Cases */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Total Flags Evaluated</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a' }}>
              {totalVolume.toLocaleString()}
            </span>
            <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
              <ArrowUpRight size={14} /> +4.2%
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
            Total transactions scoring $\ge$ 40 pts in the last {timeRange}
          </div>
        </div>

        {/* STAT CARD 3: Critical High-Risk Flag Rate */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #fee2e2',
          borderLeft: '4px solid #dc2626',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#dc2626' }}>Critical Risk Flags (&gt; 75)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 900, color: '#dc2626' }}>
              {totalHighRisk}
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>
              ({((totalHighRisk / totalVolume) * 100).toFixed(0)}% of total)
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#991b1b', marginTop: '8px' }}>
            Transfers requiring mandatory maker-checker freeze
          </div>
        </div>

        {/* STAT CARD 4: Mean Resolution SLA */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          padding: '20px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b' }}>Mean Time to Decision (MTTD)</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', margin: '8px 0 4px 0' }}>
            <span style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a' }}>
              3.8 <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748b' }}>min</span>
            </span>
            <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center' }}>
              <ArrowDownRight size={14} /> 98.4% in SLA
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
            Average analyst verification latency before settlement release
          </div>
        </div>

      </div>

      {/* Main Grid: Line Chart on Left, Ranked Most-Triggered Rules on Right */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.4fr) minmax(360px, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* LEFT COLUMN: LINE CHART (Flags Over Time) */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          {/* Chart Header */}
          <div style={{
            padding: '18px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Flags Over Time Volume Trend
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Daily velocity comparison between overall flags and critical risk interventions
              </p>
            </div>

            {/* Legend */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', backgroundColor: '#2563eb', borderRadius: '2px' }} />
                <span style={{ color: '#334155' }}>Total Flagged</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', backgroundColor: '#dc2626', borderRadius: '2px' }} />
                <span style={{ color: '#dc2626' }}>Critical Risk (&gt;75)</span>
              </div>
            </div>
          </div>

          {/* SVG Line Chart Workspace */}
          <div style={{ padding: '24px 20px', position: 'relative' }}>
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              style={{ width: '100%', height: 'auto', overflow: 'visible' }}
            >
              <defs>
                {/* Blue Gradient Area Fill */}
                <linearGradient id="flagAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Horizontal Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const val = Math.round(maxFlagVal * (1 - pct));
                const y = paddingY + pct * (chartHeight - paddingY * 2);
                return (
                  <g key={i}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={chartWidth - paddingX}
                      y2={y}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                    />
                    <text
                      x={paddingX - 8}
                      y={y + 3}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="end"
                      fontFamily="monospace"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* Shaded Area for Total Flags */}
              <path d={totalFlagsArea} fill="url(#flagAreaGradient)" />

              {/* Line 1: Total Flags */}
              <path
                d={totalFlagsPath}
                fill="none"
                stroke="#2563eb"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Line 2: Critical High Risk Flags */}
              <path
                d={highRiskPath}
                fill="none"
                stroke="#dc2626"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Interactive Data Points */}
              {chartData.map((d, i) => {
                const x = getX(i);
                const yTotal = getY(d.totalFlags);
                const yHigh = getY(d.highRisk);
                const isHovered = hoveredPointIndex === i;

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredPointIndex(i)}
                    onMouseLeave={() => setHoveredPointIndex(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Hover vertical bar */}
                    {isHovered && (
                      <line
                        x1={x}
                        y1={paddingY}
                        x2={x}
                        y2={chartHeight - paddingY}
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                      />
                    )}

                    {/* Point for Total */}
                    <circle
                      cx={x}
                      cy={yTotal}
                      r={isHovered ? 5 : 3.5}
                      fill="#fff"
                      stroke="#2563eb"
                      strokeWidth={isHovered ? 2.5 : 2}
                    />

                    {/* Point for High Risk */}
                    <circle
                      cx={x}
                      cy={yHigh}
                      r={isHovered ? 4.5 : 3}
                      fill="#fff"
                      stroke="#dc2626"
                      strokeWidth={isHovered ? 2.5 : 2}
                    />

                    {/* Date label at bottom */}
                    <text
                      x={x}
                      y={chartHeight - 6}
                      fill="#64748b"
                      fontSize="10"
                      textAnchor="middle"
                      fontWeight={isHovered ? 700 : 500}
                    >
                      {d.date}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Interactive Tooltip Card */}
            {hoveredPointIndex !== null && (
              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                backgroundColor: '#091124',
                color: '#fff',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px'
              }}>
                <div>
                  <strong style={{ color: '#93c5fd' }}>{chartData[hoveredPointIndex].date}</strong>
                  <span style={{ color: '#94a3b8', marginLeft: '8px' }}>Telemetry Summary:</span>
                </div>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span>Total Flags: <strong style={{ color: '#60a5fa' }}>{chartData[hoveredPointIndex].totalFlags}</strong></span>
                  <span>Critical: <strong style={{ color: '#f87171' }}>{chartData[hoveredPointIndex].highRisk}</strong></span>
                  <span>Cleared: <strong style={{ color: '#4ade80' }}>{chartData[hoveredPointIndex].cleared}</strong></span>
                  <span>Fraud: <strong style={{ color: '#fca5a5' }}>{chartData[hoveredPointIndex].confirmedFraud}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Chart Card Footer */}
          <div style={{
            padding: '12px 24px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: '#64748b'
          }}>
            <span>Timezone: UTC+05:30 (Sri Lanka Standard Time)</span>
            {onNavigateToFlags && (
              <button
                onClick={onNavigateToFlags}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Inspect Flag Queue &rarr;
              </button>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: RANKED LIST OF "MOST-TRIGGERED RULES" (Required Deliverable) */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '18px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Most-Triggered Rules
              </h3>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Ranked frequency of rule violations across all evaluated transactions
              </p>
            </div>

            {onNavigateToRules && (
              <button
                onClick={onNavigateToRules}
                style={{
                  padding: '5px 10px',
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#2563eb',
                  cursor: 'pointer'
                }}
              >
                Manage Rules
              </button>
            )}
          </div>

          {/* Ranked List Items */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rankedRules.slice(0, 6).map((rule, idx) => {
              const maxTriggers = rankedRules[0]?.triggerCount || 350;
              const triggerPct = Math.round(((rule.triggerCount || 100) / maxTriggers) * 100);
              const isHighImpact = (rule.scoreWeight || 25) >= 40;

              return (
                <div
                  key={rule.id}
                  style={{
                    padding: '12px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: idx === 0 ? '#2563eb' : '#e2e8f0',
                        color: idx === 0 ? '#fff' : '#475569',
                        fontSize: '11px',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {idx + 1}
                      </span>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>
                          {rule.ruleName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Category: {rule.signalCategory || 'Transaction Amount'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                        {rule.triggerCount || 120} <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>hits</span>
                      </div>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: isHighImpact ? '#b91c1c' : '#0369a1',
                        backgroundColor: isHighImpact ? '#fee2e2' : '#e0f2fe',
                        padding: '1px 6px',
                        borderRadius: '4px'
                      }}>
                        +{rule.scoreWeight} pts
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar Indicator */}
                  <div style={{ width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${triggerPct}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? '#2563eb' : idx === 1 ? '#3b82f6' : '#60a5fa',
                        borderRadius: '3px'
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Ranked List Footer */}
          <div style={{
            padding: '12px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'center'
          }}>
            Showing top {Math.min(rankedRules.length, 6)} highest impact triggers
          </div>
        </div>

      </div>

    </div>
  );
}
