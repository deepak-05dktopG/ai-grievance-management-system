// Shared prototype service identity; preview with `npm run dev` from frontend.

export default function Brand({ compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" role="presentation">
          <path d="M16 3 27 8v7c0 7.3-4.7 12.1-11 14-6.3-1.9-11-6.7-11-14V8l11-5Z" />
          <path d="M10 11h12M10 16h8M10 21h5" />
        </svg>
      </span>
      <span className="brand-copy">
        <strong>Tamil Nadu</strong>
        {!compact && <small>District grievance portal · Prototype</small>}
      </span>
    </div>
  );
}
