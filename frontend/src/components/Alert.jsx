export default function Alert({ variant = 'danger', children, onDismiss }) {
  if (!children) return null;
  return (
    <div className={`alert alert-${variant} app-alert`} role="alert">
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
