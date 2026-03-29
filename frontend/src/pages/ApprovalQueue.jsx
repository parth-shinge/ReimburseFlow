import React, { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import ApprovalTimeline from '../components/ApprovalTimeline';
import PageHeader from '../components/PageHeader';
import SkeletonLoader from '../components/SkeletonLoader';
import {
  ClipboardCheck,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Send,
  AlertTriangle,
  PartyPopper,
  User,
  Tag,
  Calendar,
  DollarSign,
} from 'lucide-react';

const formatDate = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

const ApprovalQueue = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Accordion state
  const [expandedId, setExpandedId] = useState(null);

  // Rejection state
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectComment, setRejectComment] = useState('');

  // Processing state
  const [processingId, setProcessingId] = useState(null);
  const [fadingId, setFadingId] = useState(null);

  // ── Fetch pending approvals ──
  useEffect(() => {
    const fetchApprovals = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get('/approvals/pending/');
        setApprovals(res.data.results || res.data || []);
      } catch {
        setError('Failed to load pending approvals.');
        toast.error('Failed to load approvals');
      } finally {
        setLoading(false);
      }
    };
    fetchApprovals();
  }, []);

  // ── Toggle accordion ──
  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
    // Reset rejection state when collapsing
    if (expandedId === id) {
      setRejectingId(null);
      setRejectComment('');
    }
  };

  // ── Handle decision ──
  const handleDecision = async (approvalId, decision, comment = '') => {
    setProcessingId(approvalId);
    try {
      await api.post(`/approvals/${approvalId}/decide/`, { decision, comment });

      toast.success(`Expense ${decision.toLowerCase()} successfully`);

      // Fade out, then remove
      setFadingId(approvalId);
      setTimeout(() => {
        setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
        setFadingId(null);
        setRejectingId(null);
        setRejectComment('');
        setExpandedId(null);
      }, 400);
    } catch (err) {
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        err?.response?.data?.comment?.[0] ||
        'Failed to process decision';
      toast.error(msg);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Approval Queue"
        subtitle="Review and action pending expense requests"
      />

      {/* Loading */}
      {loading && (
        <SkeletonLoader rows={4} cols={1} />
      )}

      {/* Error */}
      {!loading && error && (
        <div className="card text-center py-12">
          <AlertTriangle size={36} className="mx-auto text-red-400 mb-3" />
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && approvals.length === 0 && (
        <div className="text-center py-16">
          <div className="mx-auto w-24 h-24 bg-emerald-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle size={40} className="text-emerald-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2">All caught up!</h3>
          <p className="text-slate-500">No pending approvals at the moment.</p>
        </div>
      )}

      {/* Approval Cards */}
      {!loading && !error && approvals.length > 0 && (
        <div className="space-y-4">
          {approvals.map((approval) => {
            const exp = approval.expense_summary || approval.expense || {};
            const isExpanded = expandedId === approval.id;
            const isRejecting = rejectingId === approval.id;
            const isProcessing = processingId === approval.id;
            const isFading = fadingId === approval.id;

            return (
              <div
                key={approval.id}
                className={`card transition-all duration-300 ${
                  isFading ? 'opacity-0 scale-95 translate-x-4' : 'opacity-100'
                } ${isExpanded ? 'border-indigo-300 shadow-md' : 'hover:border-slate-300'}`}
              >
                {/* Card Header */}
                <button onClick={() => toggleExpand(approval.id)} className="w-full text-left">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: Employee info */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <User size={18} className="text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-slate-800 truncate">
                            {exp.submitted_by || exp.submitted_by_name || 'Unknown'}
                          </p>
                          {exp.submitted_by_role && (
                            <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                              {exp.submitted_by_role}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 truncate" style={{ maxWidth: '500px' }}>
                          <span className="inline-flex items-center gap-1">
                            <Tag size={12} />
                            {exp.category}
                          </span>
                          {exp.description && (
                            <span className="ml-2 text-slate-400">
                              — {exp.description.length > 80
                                ? exp.description.slice(0, 80) + '…'
                                : exp.description}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Right: Amount + Date + Chevron */}
                    <div className="flex items-center gap-5 flex-shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-slate-800 whitespace-nowrap">
                          {parseFloat(exp.amount_in_company_currency || exp.amount || 0).toLocaleString('en-US', {
                            minimumFractionDigits: 2,
                          })}{' '}
                          {exp.company_currency || exp.currency || ''}
                        </p>
                        {exp.currency && exp.company_currency && exp.currency !== exp.company_currency && (
                          <p className="text-xs text-slate-400">
                            {exp.amount} {exp.currency}
                          </p>
                        )}
                      </div>
                      <span className="text-sm text-slate-400 whitespace-nowrap">
                        {formatDate(exp.date || approval.created_at)}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={18} className="text-slate-400" />
                      ) : (
                        <ChevronDown size={18} className="text-slate-400" />
                      )}
                    </div>
                  </div>
                </button>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-slate-100 space-y-4">
                    {/* Detail grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <div className="flex items-start gap-2">
                        <DollarSign size={15} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-400">Amount</p>
                          <p className="text-sm font-semibold text-slate-700">
                            {exp.amount} {exp.currency}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Calendar size={15} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-400">Date</p>
                          <p className="text-sm font-semibold text-slate-700">{formatDate(exp.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <Tag size={15} className="text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-slate-400">Category</p>
                          <p className="text-sm font-semibold text-slate-700">{exp.category}</p>
                        </div>
                      </div>
                      {exp.submitted_by_email && (
                        <div className="flex items-start gap-2">
                          <User size={15} className="text-slate-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-slate-400">Email</p>
                            <p className="text-sm text-slate-700 truncate">{exp.submitted_by_email}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {exp.description && (
                      <div className="bg-slate-50 p-3 rounded-lg text-sm text-slate-600">{exp.description}</div>
                    )}

                    {/* Approval Timeline (if available) */}
                    {approval.approval_requests && approval.approval_requests.length > 0 && (
                      <div>
                        <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Approval History</p>
                        <ApprovalTimeline approvalRequests={approval.approval_requests} />
                      </div>
                    )}

                    {/* ── Rejection comment input ── */}
                    {isRejecting && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-red-700">
                          Add a comment (required for rejection)
                        </label>
                        <textarea
                          value={rejectComment}
                          onChange={(e) => setRejectComment(e.target.value)}
                          placeholder="Reason for rejection..."
                          rows={2}
                          className="input-field text-sm resize-none border-red-300 focus:ring-red-500"
                          autoFocus
                        />
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-3 pt-2">
                      {!isRejecting ? (
                        <>
                          <button
                            onClick={() => handleDecision(approval.id, 'APPROVED')}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50"
                          >
                            {isProcessing ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <CheckCircle size={16} />
                            )}
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectingId(approval.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white border border-red-300 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
                          >
                            <XCircle size={16} />
                            Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => handleDecision(approval.id, 'REJECTED', rejectComment)}
                            disabled={isProcessing || !rejectComment.trim()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isProcessing ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Send size={16} />
                            )}
                            Confirm Reject
                          </button>
                          <button
                            onClick={() => {
                              setRejectingId(null);
                              setRejectComment('');
                            }}
                            className="px-4 py-2.5 text-sm text-slate-500 hover:text-slate-700"
                          >
                            Cancel
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
