import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import {
  DollarSign, Clock, CheckCircle, XCircle, Users,
  Activity, RotateCcw, ArrowRight, Loader2, FileText,
} from 'lucide-react';
import api from '../api';
import ExpenseStatusBadge from '../components/ExpenseStatusBadge';

const StatCard = ({ title, value, subtitle, icon: Icon, colorClass }) => (
  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow">
    <div className="flex items-center space-x-4">
      <div className={`p-4 rounded-full ${colorClass}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      </div>
    </div>
    {subtitle && (
      <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
        <span className="text-sm text-slate-500">{subtitle}</span>
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const { user, isEmployee, isManager, isAdmin } = useAuth();

  const [stats, setStats] = useState(null);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, expensesRes] = await Promise.all([
        api.get('/expenses/stats/'),
        api.get('/expenses/'),
      ]);
      setStats(statsRes.data);
      // Get the 5 most recent expenses
      const allExpenses = expensesRes.data.results || expensesRes.data || [];
      setRecentExpenses(allExpenses.slice(0, 5));
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      setError("Failed to load dashboard statistics. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        <p className="text-slate-500 font-medium animate-pulse">Loading dashboard statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl border border-red-100 flex flex-col items-center max-w-lg text-center shadow-sm">
          <XCircle size={48} className="mb-4 text-red-400" />
          <h2 className="text-xl font-bold mb-2 text-red-700">Unable to load data</h2>
          <p className="mb-6 opacity-90">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="flex items-center px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors shadow-sm"
          >
            <RotateCcw size={16} className="mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Format currency
  const formatMoney = (amount) => {
    const num = parseFloat(amount || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.company?.currency || 'USD',
      minimumFractionDigits: 2
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Overview, {user?.name || user?.email || 'User'}
          </h1>
          <p className="mt-2 text-slate-600">
            Welcome to your ReimburseFlow dashboard. Here is a summary of your activity.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg font-medium border border-indigo-100">
          <Activity size={18} className="mr-2" />
          Live Stats
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 tracking-tight">

        {/* Core Submission Stats (All users) */}
        <StatCard
          title="Total Submitted"
          value={stats.total_submitted}
          subtitle={`Amount: ${formatMoney(stats.total_amount_submitted)}`}
          icon={DollarSign}
          colorClass="bg-blue-500 shadow-blue-500/20 shadow-lg"
        />

        <StatCard
          title="Pending Approval"
          value={stats.pending}
          icon={Clock}
          colorClass="bg-amber-500 shadow-amber-500/20 shadow-lg"
        />

        <StatCard
          title="Approved"
          value={stats.approved}
          subtitle={`Amount: ${formatMoney(stats.total_amount_approved)}`}
          icon={CheckCircle}
          colorClass="bg-emerald-500 shadow-emerald-500/20 shadow-lg"
        />

        <StatCard
          title="Rejected"
          value={stats.rejected}
          icon={XCircle}
          colorClass="bg-red-500 shadow-red-500/20 shadow-lg"
        />

        {/* Manager/Admin Stats */}
        {(isManager || isAdmin) && (
          <StatCard
            title="Awaiting Your Review"
            value={stats.pending_approvals_count || 0}
            subtitle="Needs your action"
            icon={Clock}
            colorClass="bg-indigo-500 shadow-indigo-500/20 shadow-lg"
          />
        )}

        {/* Admin Stats */}
        {isAdmin && (
          <StatCard
            title="Company Users"
            value={stats.total_users || 0}
            subtitle="Active accounts"
            icon={Users}
            colorClass="bg-violet-600 shadow-violet-600/20 shadow-lg"
          />
        )}
      </div>

      {/* ── Recent Expenses ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Recent Expenses</h2>
          <Link
            to="/expenses"
            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight size={14} />
          </Link>
        </div>

        {recentExpenses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
            <FileText size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No expenses submitted yet</p>
            <p className="text-sm text-slate-400 mt-1">
              Submit your first expense to see it here.
            </p>
            <Link
              to="/expenses/new"
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <DollarSign size={16} /> Submit Expense
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentExpenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-700">
                        {formatDate(expense.date || expense.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-slate-700">
                          {expense.category
                            ? expense.category.charAt(0) + expense.category.slice(1).toLowerCase()
                            : '—'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                        {formatMoney(expense.amount_in_company_currency || expense.amount)}
                      </td>
                      <td className="px-6 py-4">
                        <ExpenseStatusBadge status={expense.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
