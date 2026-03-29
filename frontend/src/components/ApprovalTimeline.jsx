import React from 'react';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

const formatTimestamp = (ts) => {
  if (!ts) return 'Pending';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'APPROVED':
      return <CheckCircle size={20} className="text-emerald-500" />;
    case 'REJECTED':
      return <XCircle size={20} className="text-red-500" />;
    default:
      return <Clock size={20} className="text-amber-500" />;
  }
};

const statusRingColor = (status) => {
  switch (status) {
    case 'APPROVED':
      return 'ring-emerald-200 bg-emerald-50';
    case 'REJECTED':
      return 'ring-red-200 bg-red-50';
    default:
      return 'ring-amber-200 bg-amber-50';
  }
};

const lineColor = (status) => {
  switch (status) {
    case 'APPROVED':
      return 'bg-emerald-200';
    case 'REJECTED':
      return 'bg-red-200';
    default:
      return 'bg-slate-200';
  }
};

const ApprovalTimeline = ({ approvalRequests = [] }) => {
  if (!approvalRequests.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400 py-4">
        <Clock size={16} />
        No approval steps recorded yet.
      </div>
    );
  }

  return (
    <div className="relative">
      {approvalRequests.map((req, idx) => {
        const isLast = idx === approvalRequests.length - 1;

        return (
          <div key={req.id || idx} className="relative flex gap-4">
            {/* Connecting line */}
            {!isLast && (
              <div
                className={`absolute left-[19px] top-[40px] w-0.5 ${lineColor(req.status)}`}
                style={{ height: 'calc(100% - 24px)' }}
              />
            )}

            {/* Icon node */}
            <div
              className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full ring-2 flex items-center justify-center ${statusRingColor(req.status)}`}
            >
              <StatusIcon status={req.status} />
            </div>

            {/* Content */}
            <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-6'}`}>
              {/* Header row */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm text-slate-800">
                  {req.approver_name || req.approver_email || 'Unknown Approver'}
                </span>

                {req.step_order != null && (
                  <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    Step {req.step_order}
                  </span>
                )}

                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    req.status === 'APPROVED'
                      ? 'bg-emerald-100 text-emerald-700'
                      : req.status === 'REJECTED'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {req.status}
                </span>
              </div>

              {/* Comment */}
              {req.comment && (
                <blockquote className="mt-1.5 pl-3 border-l-2 border-slate-200 text-sm text-slate-600 italic">
                  {req.comment}
                </blockquote>
              )}

              {/* Timestamp */}
              <p className="text-xs text-slate-400 mt-1">
                {formatTimestamp(req.acted_at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ApprovalTimeline;
