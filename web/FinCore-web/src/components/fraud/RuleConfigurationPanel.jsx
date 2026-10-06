import React, { useState, useEffect } from 'react';
import { fraudService } from '../../services/fraudService';
import { useAuth } from '../../context/AuthContext';
import {
  Sliders,
  RotateCcw,
  Check,
  AlertCircle,
  Search,
  CheckCircle2,
  Edit2,
  Trash2,
  RefreshCw,
  Lock,
  History,
  Eye
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';

  const [panelTab, setPanelTab] = useState('rules'); // 'rules' | 'audit'
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [selectedInspectRule, setSelectedInspectRule] = useState(null);

  // Rule Audit Log state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');

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

  const loadAuditLogs = async () => {
    setLoadingAudit(true);
    try {
      const data = await fraudService.getRuleAuditLogs();
      setAuditLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load rule audit logs:', err);
    } finally {
      setLoadingAudit(false);
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!form.ruleName.trim()) {
      errors.ruleName = 'Rule Name is required.';
    } else if (form.ruleName.trim().length < 3) {
      errors.ruleName = 'Rule Name must be at least 3 characters.';
    }

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
      loadAuditLogs();
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
      await fraudService.updateRule(rule.id, { isActive: newStatus, ruleName: rule.ruleName, thresholdValue: rule.thresholdValue });
      setRules(prev => prev.map(r => r.id === rule.id ? { ...r, isActive: newStatus } : r));
      setFeedback({
        type: 'success',
        message: `Rule "${rule.ruleName}" is now ${newStatus ? 'ACTIVE' : 'DISABLED'}.`
      });
      loadAuditLogs();
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
      loadAuditLogs();
      if (onRuleChanged) onRuleChanged();
    } catch (err) {
      setFeedback({ type: 'error', message: 'Failed to delete rule: ' + err.message });
    }
  };

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

  return (
    <div className="space-y-6 font-sans text-gray-900">

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            FRAUD ENGINE &gt; RULES CONFIGURATION
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Sliders className="w-6 h-6 text-blue-600" /> Rule Configuration Panel
          </h1>
          <p className="text-gray-500 text-xs mt-1">
            Configure active real-time transaction heuristics, risk point weights, and automated threshold limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadRules}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-700 hover:bg-slate-50 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Rules
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-lg border text-xs font-semibold flex items-center justify-between shadow-sm ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-red-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-gray-400 hover:text-gray-600 font-bold">
            ✕
          </button>
        </div>
      )}

      {/* Tabs: Rules vs Audit */}
      <div className="flex items-center gap-2 border-b border-gray-200">
        <button
          onClick={() => setPanelTab('rules')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            panelTab === 'rules'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Sliders className="w-4 h-4" /> Active Fraud Rules ({rules.length})
        </button>
        <button
          onClick={() => {
            setPanelTab('audit');
            loadAuditLogs();
          }}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors cursor-pointer ${
            panelTab === 'audit'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <History className="w-4 h-4" /> Rule Audit Log
        </button>
      </div>

      {!isAdmin && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-800 flex items-center gap-2">
          <Lock className="w-4 h-4 text-blue-600" />
          <span>Analyst Read-Only Mode: Modifying thresholds or creating rules requires Administrator privileges.</span>
        </div>
      )}

      {/* AUDIT TAB */}
      {panelTab === 'audit' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <History className="w-4 h-4 text-blue-600" /> Rule Mutation Audit Trail
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Immutable historical logs recording rule threshold changes.</p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Filter audit logs..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Rule Identifier</th>
                  <th className="px-6 py-3.5">Action</th>
                  <th className="px-6 py-3.5">Previous Value</th>
                  <th className="px-6 py-3.5">New Value</th>
                  <th className="px-6 py-3.5">Modified By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {auditLogs
                  .filter(log => !auditSearch || log.ruleName?.toLowerCase().includes(auditSearch.toLowerCase()))
                  .map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 border-b border-gray-100">
                      <td className="px-6 py-4 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {log.timestamp ? new Date(log.timestamp).toISOString().substring(0, 19).replace('T', ' ') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-bold text-xs text-gray-900">{log.ruleName || log.ruleId}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{log.previousValue || '—'}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-900 font-bold">{log.newValue || '—'}</td>
                      <td className="px-6 py-4 text-xs text-gray-700 font-medium">{log.modifiedBy || 'Admin'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ACTIVE RULES TAB */}
      {panelTab === 'rules' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Table (2 cols) */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900">Active Rule Sets</span>
                <span className="bg-blue-50 text-blue-600 font-bold text-xs px-2 py-0.5 rounded-full border border-blue-200">
                  {filteredRules.length} Rules
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search rules..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                  />
                </div>

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 cursor-pointer"
                >
                  <option value="ALL">All Categories</option>
                  {SIGNAL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3.5">Rule ID</th>
                    <th className="px-6 py-3.5">Rule &amp; Description</th>
                    <th className="px-6 py-3.5">Threshold</th>
                    <th className="px-6 py-3.5">Score Weight</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {filteredRules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-50 border-b border-gray-100 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-xs text-blue-600">
                        {rule.ruleId || `RUL-${rule.id}`}
                      </td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="font-bold text-gray-900 text-xs">{rule.ruleName}</div>
                        <div className="text-[11px] text-gray-500 line-clamp-1">{rule.description || 'Standard rule evaluation'}</div>
                      </td>
                      <td className="px-6 py-4 font-bold text-xs text-gray-900 whitespace-nowrap">
                        {rule.signalCategory === 'Device Fingerprint' ? 'Boolean Check' : `${rule.thresholdValue} ${rule.thresholdUnit || ''}`}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="bg-amber-50 text-amber-700 border border-amber-200 font-extrabold text-xs px-2 py-0.5 rounded-full">
                          +{rule.scoreWeight} pts
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={isAdmin ? () => handleToggleStatus(rule) : undefined}
                          disabled={!isAdmin}
                          className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border cursor-pointer ${
                            rule.isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {rule.isActive ? 'Active' : 'Disabled'}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {isAdmin ? (
                            <>
                              <button
                                onClick={() => handleEditRule(rule)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-slate-100 rounded-md cursor-pointer"
                                title="Edit Rule"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-slate-100 rounded-md cursor-pointer"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setSelectedInspectRule(rule)}
                              className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-slate-100 rounded-md cursor-pointer"
                              title="Inspect Rule"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Form Card (1 col) */}
          {isAdmin && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {editingRuleId ? 'Edit Rule Configuration' : 'Add New Rule'}
              </h3>

              <form onSubmit={handleSaveRule} className="space-y-4 text-xs">
                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Rule Name *</label>
                  <input
                    type="text"
                    value={form.ruleName}
                    onChange={(e) => handleInputChange('ruleName', e.target.value)}
                    placeholder="e.g., High Velocity Transfer Flag"
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {formErrors.ruleName && <div className="text-red-600 text-[11px] mt-1">{formErrors.ruleName}</div>}
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Signal Category</label>
                  <select
                    value={form.signalCategory}
                    onChange={(e) => handleInputChange('signalCategory', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                  >
                    {SIGNAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">Threshold</label>
                    <input
                      type="text"
                      value={form.thresholdValue}
                      onChange={(e) => handleInputChange('thresholdValue', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-700 uppercase mb-1">Unit</label>
                    <input
                      type="text"
                      value={form.thresholdUnit}
                      onChange={(e) => handleInputChange('thresholdUnit', e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Score Weight Impact (1-100)</label>
                  <input
                    type="number"
                    value={form.scoreWeight}
                    onChange={(e) => handleInputChange('scoreWeight', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 uppercase mb-1">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Brief rule description..."
                    className="w-full p-2.5 bg-slate-50 border border-gray-300 rounded-lg text-xs text-gray-900 focus:outline-none"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-slate-50 cursor-pointer"
                  >
                    Reset
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-2 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm cursor-pointer"
                  >
                    {editingRuleId ? 'Update Rule' : 'Save Rule'}
                  </button>
                </div>
              </form>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
