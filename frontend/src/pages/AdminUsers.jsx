import React, { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import {
  Users,
  Plus,
  X,
  Mail,
  User,
  Shield,
  ShieldCheck,
  UserCog,
  Loader2,
  ChevronDown,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  Minus,
} from 'lucide-react';

const ROLE_STYLES = {
  ADMIN: { bg: 'bg-violet-100', text: 'text-violet-700' },
  MANAGER: { bg: 'bg-blue-100', text: 'text-blue-700' },
  EMPLOYEE: { bg: 'bg-slate-100', text: 'text-slate-700' },
};

const ALL_ROLES = ['EMPLOYEE', 'MANAGER', 'ADMIN'];

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    manager: '',
    is_manager_approver: false,
  });
  const [formErrors, setFormErrors] = useState({});

  // Inline role editing
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [savingRoleId, setSavingRoleId] = useState(null);

  // ── Fetch users ──
  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/users/');
      setUsers(res.data.results || res.data || []);
    } catch {
      setError('Failed to load users.');
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // ── Manager options (for dropdown) ──
  const managerOptions = users.filter((u) => u.role === 'MANAGER' || u.role === 'ADMIN');

  // ── Get manager name by ID ──
  const getManagerName = (managerId) => {
    if (!managerId) return '—';
    const mgr = users.find((u) => u.id === managerId);
    return mgr ? mgr.name : '—';
  };

  // ── Create user ──
  const handleCreate = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setCreating(true);

    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        is_manager_approver: form.is_manager_approver,
      };
      if (form.manager) payload.manager = form.manager;

      await api.post('/users/', payload);
      toast.success('User created successfully');
      setShowModal(false);
      setForm({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        manager: '',
        is_manager_approver: false,
      });
      fetchUsers();
    } catch (err) {
      const data = err?.response?.data;
      if (data && typeof data === 'object') {
        const errors = {};
        Object.entries(data).forEach(([key, val]) => {
          // Handle nested errors like { user: { email: [...] } }
          if (typeof val === 'object' && !Array.isArray(val)) {
            Object.entries(val).forEach(([subKey, subVal]) => {
              errors[subKey] = Array.isArray(subVal) ? subVal[0] : subVal;
            });
          } else {
            errors[key] = Array.isArray(val) ? val[0] : val;
          }
        });
        setFormErrors(errors);
        toast.error('Please fix the errors below');
      } else {
        toast.error('Failed to create user');
      }
    } finally {
      setCreating(false);
    }
  };

  // ── Inline role change ──
  const handleRoleChange = async (userId, newRole) => {
    setSavingRoleId(userId);
    try {
      await api.patch(`/users/${userId}/`, { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingRoleId(null);
      toast.success('Role updated');
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.response?.data?.detail || 'Failed to update role');
    } finally {
      setSavingRoleId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users size={24} className="text-indigo-600" />
            User Management
          </h1>
          {!loading && (
            <p className="text-sm text-slate-500 mt-1">
              {users.length} user{users.length !== 1 ? 's' : ''} in your company
            </p>
          )}
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Add User
        </button>
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

      {/* Users Table */}
      {!loading && !error && users.length > 0 && (
        <div className="card overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Manager</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
                    Mgr Approver
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const roleStyle = ROLE_STYLES[u.role] || ROLE_STYLES.EMPLOYEE;
                  const isEditingRole = editingRoleId === u.id;
                  const isSaving = savingRoleId === u.id;

                  return (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                      {/* Name */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <User size={14} className="text-indigo-600" />
                          </div>
                          <span className="font-medium text-sm text-slate-800">{u.name}</span>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>

                      {/* Role (clickable) */}
                      <td className="px-6 py-4">
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin text-indigo-500" />
                        ) : isEditingRole ? (
                          <select
                            defaultValue={u.role}
                            onChange={(e) => handleRoleChange(u.id, e.target.value)}
                            onBlur={() => setEditingRoleId(null)}
                            className="text-sm border border-indigo-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            autoFocus
                          >
                            {ALL_ROLES.map((r) => (
                              <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                            ))}
                          </select>
                        ) : (
                          <button
                            onClick={() => setEditingRoleId(u.id)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer hover:ring-2 hover:ring-indigo-200 transition-all ${roleStyle.bg} ${roleStyle.text}`}
                            title="Click to change role"
                          >
                            <Shield size={11} />
                            {u.role.charAt(0) + u.role.slice(1).toLowerCase()}
                            <ChevronDown size={10} />
                          </button>
                        )}
                      </td>

                      {/* Manager Name */}
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {getManagerName(u.manager)}
                      </td>

                      {/* Is Manager Approver */}
                      <td className="px-6 py-4 text-center">
                        {u.is_manager_approver ? (
                          <Check size={18} className="mx-auto text-emerald-500" />
                        ) : (
                          <Minus size={18} className="mx-auto text-slate-300" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add User Modal ── */}
      {showModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setShowModal(false)} />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md animate-scale-in">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserCog size={20} className="text-indigo-600" />
                  Add New User
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
                  <X size={18} className="text-slate-500" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreate} className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={`input-field ${formErrors.name ? 'border-red-400' : ''}`}
                    placeholder="Jane Doe"
                    required
                  />
                  {formErrors.name && <p className="text-xs text-red-500 mt-1">{formErrors.name}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={`input-field ${formErrors.email ? 'border-red-400' : ''}`}
                    placeholder="jane@company.com"
                    required
                  />
                  {formErrors.email && <p className="text-xs text-red-500 mt-1">{formErrors.email}</p>}
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className={`input-field pr-10 ${formErrors.password ? 'border-red-400' : ''}`}
                      placeholder="Min 8 characters"
                      minLength={8}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {formErrors.password && <p className="text-xs text-red-500 mt-1">{formErrors.password}</p>}
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    className="input-field"
                  >
                    {ALL_ROLES.map((r) => (
                      <option key={r} value={r}>{r.charAt(0) + r.slice(1).toLowerCase()}</option>
                    ))}
                  </select>
                </div>

                {/* Manager */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Manager</label>
                  <select
                    value={form.manager}
                    onChange={(e) => setForm({ ...form, manager: e.target.value })}
                    className="input-field"
                  >
                    <option value="">— None —</option>
                    {managerOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.role.charAt(0) + m.role.slice(1).toLowerCase()})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Is Manager Approver toggle */}
                <div className="flex items-center justify-between bg-slate-50 p-3 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">Is Manager Approver</p>
                    <p className="text-xs text-slate-500">Direct manager must approve expenses first</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, is_manager_approver: !form.is_manager_approver })}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      form.is_manager_approver ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        form.is_manager_approver ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* General errors */}
                {formErrors.detail && (
                  <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg">{formErrors.detail}</p>
                )}

                {/* Submit */}
                <button
                  type="submit"
                  disabled={creating}
                  className="w-full btn-primary flex items-center justify-center gap-2 py-2.5 mt-2 disabled:opacity-50"
                >
                  {creating ? (
                    <><Loader2 size={18} className="animate-spin" /> Creating...</>
                  ) : (
                    <><Plus size={18} /> Create User</>
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-in {
          animation: scaleIn 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default AdminUsers;
