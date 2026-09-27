import React, { useState, useEffect } from 'react';
import { fraudService } from '../../services/fraudService';
import {
  Sliders,
  PlusCircle,
  RotateCcw,
  Check,
  AlertCircle,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ToggleLeft,
  ToggleRight,
  Edit2,
  Trash2,
  ShieldCheck,
  HelpCircle,
  ArrowUpDown,
  RefreshCw,
  Sparkles
} from 'lucide-react';

const SIGNAL_CATEGORIES = [
  'Transaction Amount',
  'Geolocation Anomaly',
  'Velocity / Frequency',
  'Device Fingerprint',
  'AI Behavioral',
  'Cross-Border',
  'Account Risk'
];

export default function RuleConfigurationPanel({ onRuleChanged }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [editingRuleId, setEditingRuleId] = useState(null);

  // Form State
  const initialFormState = {
    ruleName: '',
    signalCategory: 'Transaction Amount',
    thresholdValue: '10000',
    thresholdUnit: 'Rs.',
    scoreWeight: 30,
    isActive: true,
    description: ''
  };

  const [form, setForm] = useState(initialFormState);
  const [formErrors, setFormErrors] = useState({});

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const data = await fraudService.getRules();
      setRules(data);
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to load rules: ' + (err.message || 'Unknown error') });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.ruleName.trim()) {
      errors.ruleName = 'Rule Name is required.';
    } else if (form.ruleName.trim().length < 3) {
      errors.ruleName = 'Rule Name must be at least 3 characters.';
    }

    // Task 2: "Device Fingerprint" acts as a boolean toggle - bypass numeric threshold validation
    if (form.signalCategory !== 'Device Fingerprint') {
      if (form.thresholdValue === '' || isNaN(Number(form.thresholdValue))) {
        errors.thresholdValue = 'A valid numeric threshold is required.';
      } else if (Number(form.thresholdValue) < 0) {
        errors.thresholdValue = 'Threshold cannot be negative.';
      }
    }

    const weightNum = Number(form.scoreWeight);
    if (isNaN(weightNum) || weightNum < 1 || weightNum > 100) {
      errors.scoreWeight = 'Score weight must be between 1 and 100.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Task 2: Dynamic threshold values and units based on Signal Category
      if (field === 'signalCategory') {
        if (value === 'Transaction Amount') {
          updated.thresholdUnit = 'Rs.';
          if (!updated.thresholdValue || updated.thresholdValue === '0' || updated.thresholdValue === 'N/A') {
            updated.thresholdValue = '10000';
          }
        } else if (value === 'Geolocation Anomaly') {
          updated.thresholdUnit = 'km';
          if (!updated.thresholdValue || updated.thresholdValue === '0' || updated.thresholdValue === 'N/A') {
            updated.thresholdValue = '200';
          }
        } else if (value === 'Device Fingerprint') {
          updated.thresholdUnit = 'N/A';
          updated.thresholdValue = '0';
        } else if (value === 'Velocity / Frequency') {
          updated.thresholdUnit = 'tx / 10m';
          if (!updated.thresholdValue || updated.thresholdValue === '0' || updated.thresholdValue === 'N/A') {
            updated.thresholdValue = '4';
          }
        } else if (value === 'AI Behavioral') {
          updated.thresholdUnit = 'confidence %';
          if (!updated.thresholdValue || updated.thresholdValue === '0' || updated.thresholdValue === 'N/A') {
            updated.thresholdValue = '70';
          }
        } else {
          updated.thresholdUnit = 'value';
        }
      }
      return updated;
    });

    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleReset = () => {
    setForm(initialFormState);
    setFormErrors({});
    setEditingRuleId(null);
  };

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      if (editingRuleId) {
        // Update existing rule
        await fraudService.updateRule(editingRuleId, {
          ruleName: form.ruleName,
          signalCategory: form.signalCategory,
          thresholdValue: parseFloat(form.thresholdValue),
          thresholdUnit: form.thresholdUnit,
          scoreWeight: parseInt(form.scoreWeight, 10),
          isActive: form.isActive,
          description: form.description || `Rule threshold evaluating ${form.ruleName}`
        });
        setFeedback({ type: 'success', message: `Rule "${form.ruleName}" updated successfully.` });
      } else {
        // Create new rule
        const created = await fraudService.createRule({
          ruleName: form.ruleName,
          signalCategory: form.signalCategory,
          thresholdValue: parseFloat(form.thresholdValue),
          thresholdUnit: form.thresholdUnit,
          scoreWeight: parseInt(form.scoreWeight, 10),
          isActive: form.isActive,
          description: form.description
        });
        setFeedback({ type: 'success', message: `New rule "${created.ruleName}" (${created.ruleId}) added to engine.` });
      }

      handleReset();
      await loadRules();
      if (onRuleChanged) onRuleChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to save rule: ' + (err.message || 'Server error') });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (rule) => {
    try {
      const newStatus = !rule.isActive;
      await fraudService.updateRule(rule.id, { isActive: newStatus });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: newStatus } : r));
      setFeedback({
        type: 'success',
        message: `Rule "${rule.ruleName}" is now ${newStatus ? 'ACTIVE' : 'DISABLED'}.`
      });
      if (onRuleChanged) onRuleChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to toggle status: ' + err.message });
    }
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setForm({
      ruleName: rule.ruleName,
      signalCategory: rule.signalCategory || 'Transaction Amount',
      thresholdValue: rule.thresholdValue,
      thresholdUnit: rule.thresholdUnit || 'Rs.',
      scoreWeight: rule.scoreWeight || 25,
      isActive: rule.isActive,
      description: rule.description || ''
    });
    setFormErrors({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Are you sure you want to deactivate and remove rule "${rule.ruleName}" (${rule.ruleId})?`)) {
      return;
    }
    try {
      await fraudService.deleteRule(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      setFeedback({ type: 'success', message: `Rule "${rule.ruleName}" was successfully removed.` });
      if (editingRuleId === rule.id) handleReset();
      if (onRuleChanged) onRuleChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete rule: ' + err.message });
    }
  };

  // Filtered Rules
  const filteredRules = rules.filter(r => {
    if (categoryFilter !== 'ALL' && r.signalCategory !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.ruleName.toLowerCase().includes(q) ||
        (r.ruleId && r.ruleId.toLowerCase().includes(q)) ||
        (r.description && r.description.toLowerCase().includes(q)) ||
        (r.signalCategory && r.signalCategory.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getScoreWeightBadge = (weight) => {
    if (weight >= 45) return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', label: 'High Impact' };
    if (weight >= 25) return { bg: '#fef3c7', text: '#b45309', border: '#fcd34d', label: 'Medium Impact' };
    return { bg: '#e0f2fe', text: '#0369a1', border: '#bae6fd', label: 'Low Impact' };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#64748b', fontWeight: 600, letterSpacing: '0.4px', marginBottom: '4px' }}>
            FRAUD ENGINE &gt; RULES CONFIGURATION
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={24} color="#2563eb" /> Rule Configuration Panel
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', margin: '4px 0 0 0' }}>
            Configure active real-time transaction heuristics, risk point weights, and automated threshold limits.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={loadRules}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              backgroundColor: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh Rules
          </button>
        </div>
      </div>

      {/* Feedback Alert Banner */}
      {feedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: '8px',
          backgroundColor: feedback.type === 'success' ? '#dcfce7' : '#fee2e2',
          border: `1px solid ${feedback.type === 'success' ? '#86efac' : '#fca5a5'}`,
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          fontWeight: 600
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {feedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Grid: Split View (Table Left, Form Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(360px, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* LEFT COLUMN: Active Rule Sets Table */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}>

          {/* Table Toolbar */}
          <div style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Active Rule Sets</span>
                <span style={{
                  backgroundColor: '#dbeafe',
                  color: '#1e40af',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}>
                  {filteredRules.length} {filteredRules.length === 1 ? 'Rule' : 'Rules'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Engine Evaluator: <strong style={{ color: '#16a34a' }}>Active</strong>
              </div>
            </div>

            {/* Search & Category Filter Controls */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{
                position: 'relative',
                flex: 1,
                minWidth: '200px'
              }}>
                <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                <input
                  type="text"
                  placeholder="Filter rules by name or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 32px',
                    fontSize: '12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="text-gray-900"
                style={{
                  padding: '8px 12px',
                  fontSize: '12px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
              >
                <option value="ALL" className="text-gray-900" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>All Categories</option>
                {SIGNAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat} className="text-gray-900" style={{ color: '#0f172a', backgroundColor: '#ffffff' }}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Content */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', color: '#475569', borderBottom: '1px solid #e2e8f0', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rule ID</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700 }}>Rule & Description</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Signal Category</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Threshold</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Score Impact</th>
                  <th style={{ padding: '12px 14px', fontWeight: 700 }}>Status</th>
                  <th style={{ padding: '12px 16px', fontWeight: 700, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && rules.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                      <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px auto', display: 'block', color: '#2563eb' }} />
                      Loading configured rules from engine...
                    </td>
                  </tr>
                ) : filteredRules.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '36px', textAlign: 'center', color: '#94a3b8' }}>
                      No rules found matching query "{searchQuery}".
                    </td>
                  </tr>
                ) : (
                  filteredRules.map((rule) => {
                    const weightStyle = getScoreWeightBadge(rule.scoreWeight);
                    const isSelectedForEdit = editingRuleId === rule.id;

                    return (
                      <tr
                        key={rule.id}
                        style={{
                          borderBottom: '1px solid #f1f5f9',
                          backgroundColor: isSelectedForEdit ? '#eff6ff' : rule.isActive ? '#fff' : '#fcfcfc',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        {/* Rule ID */}
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontWeight: 700, color: '#2563eb', fontSize: '12px' }}>
                          {rule.ruleId || `RUL-00${rule.id}`}
                        </td>

                        {/* Name & Description */}
                        <td style={{ padding: '14px 16px', maxWidth: '240px' }}>
                          <div style={{ fontWeight: 700, color: rule.isActive ? '#0f172a' : '#64748b', fontSize: '13px', marginBottom: '2px' }}>
                            {rule.ruleName}
                          </div>
                          <div style={{ fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                            {rule.description || 'Standard fraud evaluation threshold'}
                          </div>
                        </td>

                        {/* Signal Category */}
                        <td style={{ padding: '14px 14px' }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            whiteSpace: 'nowrap'
                          }}>
                            {rule.signalCategory || 'General'}
                          </span>
                        </td>

                        {/* Threshold */}
                        <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                            {rule.signalCategory === 'Device Fingerprint' ? (
                              <span style={{ color: '#475569', fontSize: '11px', backgroundColor: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                                Boolean Check
                              </span>
                            ) : rule.thresholdUnit === 'Rs.' ? (
                              `Rs. ${Number(rule.thresholdValue || 0).toLocaleString()}`
                            ) : (
                              `${rule.thresholdValue} ${rule.thresholdUnit || ''}`
                            )}
                          </span>
                        </td>

                        {/* Score Impact */}
                        <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                              fontWeight: 800,
                              color: weightStyle.text,
                              backgroundColor: weightStyle.bg,
                              border: `1px solid ${weightStyle.border}`,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px'
                            }}>
                              +{rule.scoreWeight} pts
                            </span>
                          </div>
                        </td>

                        {/* Status Toggle Switch */}
                        <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => handleToggleStatus(rule)}
                            title={rule.isActive ? 'Click to disable' : 'Click to activate'}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '3px 8px',
                              borderRadius: '12px',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: rule.isActive ? '#dcfce7' : '#f1f5f9',
                              color: rule.isActive ? '#15803d' : '#64748b'
                            }}
                          >
                            <span style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: rule.isActive ? '#16a34a' : '#94a3b8'
                            }} />
                            {rule.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: '14px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                            <button
                              onClick={() => handleEditRule(rule)}
                              title="Edit Rule Configuration"
                              style={{
                                padding: '6px 8px',
                                backgroundColor: isSelectedForEdit ? '#2563eb' : '#fff',
                                color: isSelectedForEdit ? '#fff' : '#475569',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteRule(rule)}
                              title="Delete Rule"
                              style={{
                                padding: '6px 8px',
                                backgroundColor: '#fff',
                                color: '#dc2626',
                                border: '1px solid #fee2e2',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div style={{
            padding: '12px 20px',
            backgroundColor: '#f8fafc',
            borderTop: '1px solid #e2e8f0',
            fontSize: '12px',
            color: '#64748b',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>Showing {filteredRules.length} of {rules.length} configured rules</span>
            <span style={{ fontSize: '11px' }}>Changes to rules take effect immediately on next transaction evaluation</span>
          </div>
        </div>

        {/* RIGHT COLUMN: "Add New Rule" / "Edit Rule" Form Card */}
        <div style={{
          backgroundColor: '#fff',
          borderRadius: '12px',
          border: editingRuleId ? '2px solid #2563eb' : '1px solid #e2e8f0',
          boxShadow: editingRuleId ? '0 4px 12px rgba(37,99,235,0.1)' : '0 1px 3px rgba(0,0,0,0.05)',
          overflow: 'hidden'
        }}>
          {/* Card Header */}
          <div style={{
            padding: '18px 24px',
            backgroundColor: editingRuleId ? '#eff6ff' : '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
                  {editingRuleId ? 'Edit Rule Configuration' : 'Add New Rule'}
                </h3>
                {editingRuleId && (
                  <span style={{
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: '4px'
                  }}>
                    EDIT MODE
                  </span>
                )}
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                {editingRuleId ? 'Modify threshold parameters and impact weights' : 'Define a new risk signal evaluation threshold'}
              </p>
            </div>
            {editingRuleId && (
              <button
                onClick={handleReset}
                style={{
                  background: 'none',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  color: '#475569',
                  cursor: 'pointer'
                }}
              >
                Cancel Edit
              </button>
            )}
          </div>

          {/* Form Content */}
          <form onSubmit={handleSaveRule} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Field: Rule Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Rule Name <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., HighVelocityTransfer, ForeignIpAnomaly"
                value={form.ruleName}
                onChange={(e) => handleInputChange('ruleName', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: formErrors.ruleName ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s'
                }}
              />
              {formErrors.ruleName && (
                <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                  {formErrors.ruleName}
                </div>
              )}
            </div>

            {/* Field: Signal Category (Task 1: Visible text in select and options) */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Signal Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                value={form.signalCategory}
                onChange={(e) => handleInputChange('signalCategory', e.target.value)}
                className="text-gray-900"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  outline: 'none',
                  backgroundColor: '#ffffff',
                  color: '#0f172a',
                  boxSizing: 'border-box',
                  cursor: 'pointer'
                }}
              >
                {SIGNAL_CATEGORIES.map(cat => (
                  <option
                    key={cat}
                    value={cat}
                    className="text-gray-900"
                    style={{ color: '#0f172a', backgroundColor: '#ffffff' }}
                  >
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Field: Dynamic Threshold Value (Task 2: Conditional rendering based on Signal Category) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Threshold Value {form.signalCategory !== 'Device Fingerprint' && <span style={{ color: '#dc2626' }}>*</span>}
                </label>
                {form.signalCategory === 'Geolocation Anomaly' && (
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#2563eb', backgroundColor: '#eff6ff', padding: '2px 8px', borderRadius: '6px' }}>
                    {form.thresholdValue || 0} km
                  </span>
                )}
                {form.signalCategory === 'Transaction Amount' && (
                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                    Flag limit in Rs.
                  </span>
                )}
              </div>

              {/* Conditional 1: If "Transaction Amount" -> numeric input with fixed "Rs." prefix */}
              {form.signalCategory === 'Transaction Amount' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '8px',
                  border: formErrors.thresholdValue ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff'
                }}>
                  <span style={{
                    padding: '10px 14px',
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontSize: '13px',
                    fontWeight: 700,
                    borderRight: '1px solid #cbd5e1',
                    userSelect: 'none'
                  }}>
                    Rs.
                  </span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g. 50000"
                    value={form.thresholdValue}
                    onChange={(e) => handleInputChange('thresholdValue', e.target.value)}
                    className="text-gray-900"
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      border: 'none',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#0f172a',
                      fontFamily: 'inherit'
                    }}
                  />
                </div>
              )}

              {/* Conditional 2: If "Geolocation Anomaly" -> range slider (0 - 1000) with visual "km" indicator */}
              {form.signalCategory === 'Geolocation Anomaly' && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: formErrors.thresholdValue ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <input
                      type="range"
                      min="0"
                      max="1000"
                      step="10"
                      value={Number(form.thresholdValue) || 0}
                      onChange={(e) => handleInputChange('thresholdValue', e.target.value)}
                      style={{
                        flex: 1,
                        accentColor: '#2563eb',
                        cursor: 'pointer'
                      }}
                    />
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      padding: '4px 8px'
                    }}>
                      <input
                        type="number"
                        min="0"
                        max="1000"
                        value={form.thresholdValue}
                        onChange={(e) => handleInputChange('thresholdValue', e.target.value)}
                        className="text-gray-900"
                        style={{
                          width: '54px',
                          border: 'none',
                          fontSize: '13px',
                          fontWeight: 700,
                          textAlign: 'right',
                          outline: 'none',
                          color: '#0f172a'
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>km</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b' }}>
                    <span>0 km</span>
                    <span>500 km</span>
                    <span>1,000 km</span>
                  </div>
                </div>
              )}

              {/* Conditional 3: If "Device Fingerprint" -> disabled "N/A" label (boolean toggle) */}
              {form.signalCategory === 'Device Fingerprint' && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px dashed #cbd5e1',
                  backgroundColor: '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      backgroundColor: '#e2e8f0',
                      color: '#475569',
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '4px'
                    }}>
                      N/A
                    </span>
                    <span style={{ fontSize: '12px', color: '#475569' }}>
                      Binary boolean check (Evaluates Recognized vs. Unrecognized Fingerprint)
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#16a34a' }}>
                    Boolean Toggle
                  </span>
                </div>
              )}

              {/* Conditional 4: For all other categories -> Fallback standard numeric input */}
              {form.signalCategory !== 'Transaction Amount' &&
               form.signalCategory !== 'Geolocation Anomaly' &&
               form.signalCategory !== 'Device Fingerprint' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    placeholder="e.g., 4 or 70"
                    value={form.thresholdValue}
                    onChange={(e) => handleInputChange('thresholdValue', e.target.value)}
                    className="text-gray-900"
                    style={{
                      flex: 2,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: formErrors.thresholdValue ? '1px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      color: '#0f172a'
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={form.thresholdUnit}
                    onChange={(e) => handleInputChange('thresholdUnit', e.target.value)}
                    className="text-gray-900"
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none',
                      boxSizing: 'border-box',
                      backgroundColor: '#f8fafc',
                      color: '#0f172a'
                    }}
                  />
                </div>
              )}

              {formErrors.thresholdValue && form.signalCategory !== 'Device Fingerprint' && (
                <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                  {formErrors.thresholdValue}
                </div>
              )}
            </div>

            {/* Field: Score Weight (1-100) */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Score Weight (1 - 100) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: form.scoreWeight >= 50 ? '#dc2626' : form.scoreWeight >= 25 ? '#d97706' : '#2563eb',
                  backgroundColor: form.scoreWeight >= 50 ? '#fee2e2' : form.scoreWeight >= 25 ? '#fef3c7' : '#eff6ff',
                  padding: '2px 8px',
                  borderRadius: '10px'
                }}>
                  +{form.scoreWeight} points added to score
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={form.scoreWeight}
                  onChange={(e) => handleInputChange('scoreWeight', e.target.value)}
                  style={{
                    flex: 1,
                    accentColor: '#2563eb',
                    cursor: 'pointer'
                  }}
                />
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.scoreWeight}
                  onChange={(e) => handleInputChange('scoreWeight', e.target.value)}
                  style={{
                    width: '64px',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: formErrors.scoreWeight ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    fontWeight: 700,
                    textAlign: 'center',
                    outline: 'none'
                  }}
                />
              </div>
              {formErrors.scoreWeight && (
                <div style={{ color: '#dc2626', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>
                  {formErrors.scoreWeight}
                </div>
              )}
            </div>

            {/* Field: Description / Rationale */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                Description & Analyst Guidance
              </label>
              <textarea
                rows="3"
                placeholder="Explain the logic or why this rule fires when threshold is met..."
                value={form.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            {/* Field: Active Status Toggle Switch */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>Active Status</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {form.isActive ? 'Rule is actively evaluated in real-time pipeline' : 'Rule is currently disabled'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleInputChange('isActive', !form.isActive)}
                style={{
                  width: '48px',
                  height: '26px',
                  borderRadius: '13px',
                  backgroundColor: form.isActive ? '#16a34a' : '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'background-color 0.2s ease',
                  padding: 0
                }}
              >
                <span style={{
                  position: 'absolute',
                  top: '3px',
                  left: form.isActive ? '25px' : '3px',
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  backgroundColor: '#fff',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                }} />
              </button>
            </div>

            {/* Action Buttons: Reset & Solid Blue Save Rule */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleReset}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '11px 16px',
                  backgroundColor: '#fff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <RotateCcw size={15} /> Reset
              </button>

              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 2,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '11px 16px',
                  backgroundColor: '#2563eb', // Solid vibrant blue
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 4px rgba(37,99,235,0.3)',
                  transition: 'all 0.15s ease'
                }}
              >
                {loading ? (
                  <RefreshCw size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                {editingRuleId ? 'Update Rule' : 'Save Rule'}
              </button>
            </div>

          </form>
        </div>

      </div>

    </div>
  );
}
