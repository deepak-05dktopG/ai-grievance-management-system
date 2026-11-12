// Map backend grievance statuses to their display labels; preview with `npm run dev`.

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
    <span
      className={`status-badge status-${String(status || '').toLowerCase()}`}
      aria-label={`Grievance status: ${STATUS_LABELS[status] || status || 'Unknown'}`}
    >
      <span className="status-dot" />
      {STATUS_LABELS[status] || status || 'Unknown'}
    </span>
  );
}
