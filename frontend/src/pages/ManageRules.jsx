import React, { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
  Settings,
  Plus,
  Trash2,
  Loader2,
  Save,
  Layers,
  Percent,
  UserCheck,
  Zap,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const RULE_TYPES = [
  { value: 'SEQUENTIAL', label: 'Sequential', icon: Layers },
  { value: 'PERCENTAGE', label: 'Percentage', icon: Percent },
  { value: 'SPECIFIC', label: 'Specific Approver', icon: UserCheck },
  { value: 'HYBRID', label: 'Hybrid', icon: Zap },
];

const RULE_TYPE_BADGE = {
  SEQUENTIAL: 'bg-blue-100 text-blue-700',
  PERCENTAGE: 'bg-amber-100 text-amber-700',
  SPECIFIC: 'bg-purple-100 text-purple-700',
  HYBRID: 'bg-teal-100 text-teal-700',
};

const ManageRules = () => {
  const [rules, setRules] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [expandedRuleId, setExpandedRuleId] = useState(null);

  // Create form state
  const [form, setForm] = useState({
    name: '',
    rule_type: 'SEQUENTIAL',
    percentage_threshold: '',
    specific_approver: '',
    steps: [{ approver: '', step_order: 1 }],
  });

  // ── Derived type requirements ──
  const needsSteps = ['SEQUENTIAL', 'HYBRID'].includes(form.rule_type);
  const needsPercentage = ['PERCENTAGE', 'HYBRID'].includes(form.rule_type);
  const needsSpecific = ['SPECIFIC', 'HYBRID'].includes(form.rule_type);

  // ── Fetch data ──
  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, usersRes] = await Promise.all([
        api.get('/rules/'),
        api.get('/users/'),
      ]);
      setRules(rulesRes.data.results || rulesRes.data || []);
      setUsers(usersRes.data.results || usersRes.data || []);
    } catch {
      setError('Failed to load data.');
      toast.error('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ── Approver options (MANAGER/ADMIN) ──
  const approverOptions = users.filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN');

  // ── Step management ──
  const addStep = () => {
    setForm((f) => ({
      ...f,
      steps: [...f.steps, { approver: '', step_order: f.steps.length + 1 }],
    }));
  };

  const removeStep = (index) => {
    setForm((f) => ({
      ...f,
      steps: f.steps
        .filter((_, i) => i !== index)
        .map((s, i) => ({ ...s, step_order: i + 1 })),
    }));
  };

  const updateStep = (index, value) => {
    setForm((f) => ({
      ...f,
      steps: f.steps.map((s, i) => (i === index ? { ...s, approver: value } : s)),
    }));
  };

  // ── Submit rule ──
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Rule name is required');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        rule_type: form.rule_type,
        percentage_threshold: needsPercentage ? parseInt(form.percentage_threshold, 10) : null,
        specific_approver: needsSpecific ? form.specific_approver || null : null,
        steps: needsSteps
          ? form.steps
              .filter((s) => s.approver)
              .map((s) => ({ approver: s.approver, step_order: s.step_order }))
          : [],
      };

      await api.post('/rules/', payload);
      toast.success('Rule created successfully!');

      // Reset form
      setForm({
        name: '',
        rule_type: 'SEQUENTIAL',
        percentage_threshold: '',
        specific_approver: '',
        steps: [{ approver: '', step_order: 1 }],
      });

      fetchData();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const msgs = [];
        Object.entries(data).forEach(([key, val]) => {
          const msg = Array.isArray(val) ? val.join(', ') : val;
          msgs.push(`${key}: ${msg}`);
        });
        toast.error(msgs.join('. ') || 'Failed to create rule');
      } else {
        toast.error('Failed to create rule');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Toggle active/inactive ──
  const handleToggle = async (rule) => {
    setTogglingId(rule.id);
    try {
      await api.patch(`/rules/${rule.id}/`, { is_active: !rule.is_active });
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      );
      toast.success(`Rule ${!rule.is_active ? 'activated' : 'deactivated'}`);
    } catch {
      toast.error('Failed to update rule');
    } finally {
      setTogglingId(null);
    }
  };

  // ── Get approver name by ID ──
  const getApproverName = (id) => {
    const u = users.find((u) => u.id === id);
    return u ? u.name : id;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Settings size={24} className="text-indigo-600" />
          Approval Rules
        </h1>
        <p className="text-sm text-slate-500 mt-1">Configure how expenses are approved</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card text-center py-12">
          <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* ── Existing Rules ── */}
          {rules.length === 0 ? (
            <div className="card text-center py-12">
              <ShieldAlert size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No approval rules configured yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first rule below</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                Existing Rules ({rules.length})
              </h2>

              {rules.map((rule) => {
                const isExpanded = expandedRuleId === rule.id;
                const isToggling = togglingId === rule.id;
                const badgeClass = RULE_TYPE_BADGE[rule.rule_type] || 'bg-slate-100 text-slate-700';

                return (
                  <div
                    key={rule.id}
                    className={`card transition-all ${
                      rule.is_active ? 'border-slate-200' : 'border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Left: Name + type badge */}
                      <button
                        onClick={() => setExpandedRuleId(isExpanded ? null : rule.id)}
                        className="flex items-center gap-3 text-left flex-1 min-w-0"
                      >
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800">{rule.name}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
                              {rule.rule_type}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                rule.is_active
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {rule.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {/* Summary info */}
                          <p className="text-sm text-slate-500 mt-0.5">
                            {rule.steps && rule.steps.length > 0 && `${rule.steps.length} step(s)`}
                            {rule.percentage_threshold && ` · ${rule.percentage_threshold}% threshold`}
                            {rule.specific_approver_name && ` · Specific: ${rule.specific_approver_name}`}
                          </p>
                        </div>
                      </button>

                      {/* Right: Toggle + expand icon */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {/* Active/Inactive toggle */}
                        <button
                          onClick={() => handleToggle(rule)}
                          disabled={isToggling}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            rule.is_active ? 'bg-emerald-500' : 'bg-slate-300'
                          }`}
                          title={rule.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {isToggling ? (
                            <Loader2 size={12} className="animate-spin text-white mx-auto" />
                          ) : (
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                                rule.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          )}
                        </button>

                        {isExpanded ? (
                          <ChevronUp size={18} className="text-slate-400" />
                        ) : (
                          <ChevronDown size={18} className="text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded: steps list */}
                    {isExpanded && rule.steps && rule.steps.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Approval Steps</p>
                        <ol className="space-y-2">
                          {rule.steps
                            .sort((a, b) => a.step_order - b.step_order)
                            .map((step) => (
                              <li key={step.id || step.step_order} className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-lg">
                                <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex-shrink-0">
                                  {step.step_order}
                                </span>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">
                                    {step.approver_name || getApproverName(step.approver)}
                                  </p>
                                  {step.approver_email && (
                                    <p className="text-xs text-slate-400">{step.approver_email}</p>
                                  )}
                                </div>
                              </li>
                            ))}
                        </ol>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Create New Rule Form ── */}
          <form onSubmit={handleSubmit} className="card border-indigo-200 space-y-5">
            <h2 className="font-bold text-lg text-slate-800">Create New Rule</h2>

            {/* Rule Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Rule Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input-field"
                placeholder="e.g. Finance Sequential Approval"
                required
              />
            </div>

            {/* Rule Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Rule Type *</label>
              <select
                value={form.rule_type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    rule_type: e.target.value,
                    steps: [{ approver: '', step_order: 1 }],
                    percentage_threshold: '',
                    specific_approver: '',
                  })
                }
                className="input-field"
              >
                {RULE_TYPES.map((rt) => (
                  <option key={rt.value} value={rt.value}>{rt.label}</option>
                ))}
              </select>
            </div>

            {/* Percentage Threshold */}
            {needsPercentage && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Approval Threshold (%) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={form.percentage_threshold}
                  onChange={(e) => setForm({ ...form, percentage_threshold: e.target.value })}
                  className="input-field w-32"
                  placeholder="e.g. 60"
                  required
                />
                <p className="text-xs text-slate-400 mt-1">
                  Percentage of approvers that must approve
                </p>
              </div>
            )}

            {/* Specific Approver */}
            {needsSpecific && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Specific Approver *
                </label>
                <select
                  value={form.specific_approver}
                  onChange={(e) => setForm({ ...form, specific_approver: e.target.value })}
                  className="input-field"
                  required
                >
                  <option value="">Select approver...</option>
                  {approverOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} — {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  This person's approval auto-approves the expense
                </p>
              </div>
            )}

            {/* Approver Steps */}
            {needsSteps && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Approver Steps</label>
                <div className="space-y-2">
                  {form.steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-3">
                      {/* Step number */}
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 text-sm font-bold flex-shrink-0">
                        {step.step_order}
                      </span>

                      {/* Approver dropdown */}
                      <select
                        value={step.approver}
                        onChange={(e) => updateStep(index, e.target.value)}
                        className="input-field flex-1"
                      >
                        <option value="">Select approver...</option>
                        {approverOptions.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} — {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                          </option>
                        ))}
                      </select>

                      {/* Remove button */}
                      {form.steps.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeStep(index)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addStep}
                  className="mt-3 flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  <Plus size={16} />
                  Add Step
                </button>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <><Loader2 size={18} className="animate-spin" /> Creating...</>
                ) : (
                  <><Save size={18} /> Create Rule</>
                )}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default ManageRules;
