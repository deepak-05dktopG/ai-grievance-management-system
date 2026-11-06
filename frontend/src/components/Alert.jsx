// Reusable inline feedback; run the UI from frontend with `npm run dev`.

export default function Alert({ variant = 'danger', children, onDismiss }) {
  // Render nothing when there is no message to announce.
  if (!children) return null;
  return (
    <div className={`alert alert-${variant} app-alert`} role={variant === 'danger' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onDismiss && (
        <button
          className="btn-close"
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
        />
      )}
    </div>
  );
}
