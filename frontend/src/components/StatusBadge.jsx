const STATUS_LABELS = {
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  IN_PROGRESS: 'In progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
};

export default function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-${String(status || '').toLowerCase()}`}>
      <span className="status-dot" />
      {STATUS_LABELS[status] || status || 'Unknown'}
    </span>
  );
}
