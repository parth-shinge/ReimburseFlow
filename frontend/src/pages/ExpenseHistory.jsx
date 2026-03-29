import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import ExpenseStatusBadge from '../components/ExpenseStatusBadge';
import ApprovalTimeline from '../components/ApprovalTimeline';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';
import {
  History,
  X,
  Loader2,
  Eye,
  FileText,
  Receipt,
  Plus,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

const FILTERS = ['ALL', 'PENDING', 'APPROVED', 'REJECTED'];

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '—';

const formatAmount = (amount, currency) => {
  if (amount == null) return '—';
  const num = parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${num} ${currency || ''}`;
};

const ExpenseHistory = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('ALL');

  // Slide-over state
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  // ── Fetch expenses ──
  useEffect(() => {
    const fetchExpenses = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/expenses/');
        setExpenses(res.data.results || res.data || []);
      } catch (err) {
        setError('Failed to load expenses. Please try again.');
        toast.error('Failed to load expenses');
      } finally {
        setLoading(false);
      }
    };
    fetchExpenses();
  }, []);

  // ── Open detail slide-over ──
  const openDetail = async (id) => {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await api.get(`/expenses/${id}/`);
      setDetail(res.data);
    } catch {
      setDetailError('Failed to load expense details.');
      toast.error('Failed to load details');
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setSelectedId(null);
    setDetail(null);
    setDetailError(null);
  };

  // ── Client-side filter ──
  const filtered = filter === 'ALL' ? expenses : expenses.filter((e) => e.status === filter);

  // ── Tab counts ──
  const counts = {
    ALL: expenses.length,
    PENDING: expenses.filter((e) => e.status === 'PENDING').length,
    APPROVED: expenses.filter((e) => e.status === 'APPROVED').length,
    REJECTED: expenses.filter((e) => e.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader 
        title="My Expenses" 
        subtitle="Track and manage your submitted expenses" 
        action={
          <Link to="/expenses/new" className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Submit New
          </Link>
        } 
      />

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
        {FILTERS.map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
              filter === tab
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === tab
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'bg-slate-200 text-slate-500'
              }`}
            >
              {counts[tab]}
            </span>
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <SkeletonLoader rows={5} cols={6} />
      )}

      {/* Error State */}
      {!loading && error && (
        <div className="card text-center py-12">
          <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && expenses.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
            <Receipt size={40} className="text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No expenses yet</h3>
          <p className="text-slate-500 mb-6">Submit your first expense to get started</p>
          <Link to="/expenses/new" className="btn-primary">Submit Expense</Link>
        </div>
      )}

      {/* Filtered empty */}
      {!loading && !error && expenses.length > 0 && filtered.length === 0 && (
        <div className="card text-center py-12">
          <FileText size={36} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 font-medium">No {filter.toLowerCase()} expenses</p>
        </div>
      )}

      {/* Expense Table */}
      {!loading && !error && filtered.length > 0 && (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Company Amount</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(exp.date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">
                      {exp.category ? exp.category.charAt(0) + exp.category.slice(1).toLowerCase() : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-slate-800 whitespace-nowrap">
                      {formatAmount(exp.amount, exp.currency)}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {exp.amount_in_company_currency
                        ? formatAmount(exp.amount_in_company_currency, exp.company_currency || '')
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <ExpenseStatusBadge status={exp.status} />
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => openDetail(exp.id)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                      >
                        <Eye size={15} />
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Slide-Over Detail Panel ── */}
      {selectedId && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm transition-opacity"
            onClick={closeDetail}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl overflow-y-auto animate-slide-in">
            {/* Panel header */}
            <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-900">Expense Detail</h2>
              <button onClick={closeDetail} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <X size={20} className="text-slate-500" />
              </button>
            </div>

            {/* Loading */}
            {detailLoading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={28} className="animate-spin text-indigo-500" />
              </div>
            )}

            {/* Error */}
            {detailError && (
              <div className="p-6 text-center">
                <AlertTriangle size={32} className="mx-auto text-red-400 mb-2" />
                <p className="text-red-600">{detailError}</p>
              </div>
            )}

            {/* Detail content */}
            {detail && (
              <div className="p-6 space-y-6">
                {/* Status + Category */}
                <div className="flex items-center gap-3">
                  <ExpenseStatusBadge status={detail.status} />
                  <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-medium">
                    {detail.category}
                  </span>
                </div>

                {/* Amount card */}
                <div className="bg-gradient-to-br from-indigo-50 to-violet-50 border border-indigo-200 rounded-xl p-5">
                  <p className="text-2xl font-bold text-slate-900">
                    {formatAmount(detail.amount, detail.currency)}
                  </p>
                  {detail.amount_in_company_currency && detail.currency !== (detail.company_currency || '') && (
                    <p className="text-sm text-slate-500 mt-1">
                      ≈ {formatAmount(detail.amount_in_company_currency, detail.company_currency || '')}
                    </p>
                  )}
                </div>

                {/* Detail rows */}
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Date</span>
                    <span className="font-medium text-slate-700">{formatDate(detail.date)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Submitted</span>
                    <span className="font-medium text-slate-700">{formatDate(detail.created_at)}</span>
                  </div>
                  {detail.submitted_by && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Submitted By</span>
                      <span className="font-medium text-slate-700">
                        {detail.submitted_by.name || detail.submitted_by.email}
                      </span>
                    </div>
                  )}
                </div>

                {/* Description */}
                {detail.description && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Description</p>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg">{detail.description}</p>
                  </div>
                )}

                {/* Receipt */}
                {detail.receipt && (
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Receipt</p>
                    <a href={detail.receipt} target="_blank" rel="noopener noreferrer" className="group block">
                      <img
                        src={detail.receipt}
                        alt="Receipt"
                        className="rounded-lg border border-slate-200 max-h-48 object-contain group-hover:opacity-90 transition-opacity"
                      />
                      <span className="text-xs text-indigo-600 flex items-center gap-1 mt-1.5 group-hover:underline">
                        <ExternalLink size={12} /> Open full size
                      </span>
                    </a>
                  </div>
                )}

                {/* Approval Timeline */}
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-3">Approval Trail</p>
                  <ApprovalTimeline approvalRequests={detail.approval_trail || detail.approval_requests || []} />
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Slide-in animation */}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ExpenseHistory;
