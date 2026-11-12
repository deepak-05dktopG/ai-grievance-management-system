import { useEffect, useRef, useState } from 'react';

const paths = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 16 .8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 19h14" /></>,
  file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
};

export function Icon({ name, size = 18, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name] || paths.file}
    </svg>
  );
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Status({ children }) {
  const value = String(children || 'Pending').toLowerCase();
  let tone = 'neutral';
  if (/(complete|reviewed|approved|active|acknowledged|success)/.test(value)) tone = 'green';
  if (/(overdue|critical|clarification|rejected|inactive)/.test(value)) tone = 'red';
  if (/(pending|progress|scheduled|assigned|registered|review)/.test(value)) tone = 'amber';
  return <span className={`status status-${tone}`}><span className="status-dot" />{children}</span>;
}

export function AIDisclosure({ children = 'Illustrative AI demonstration · not a connected AI service' }) {
  return <div className="ai-disclosure"><Icon name="spark" size={15} />{children}</div>;
}

export function Panel({ title, description, action, className = '', children }) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && <div className="panel-heading"><div>{title && <h2>{title}</h2>}{description && <p>{description}</p>}</div>{action}</div>}
      {children}
    </section>
  );
}

export function Modal({ title, subtitle, onClose, children, wide = false }) {
  const dialogRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => [...(dialog?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [])].filter((element) => element.offsetParent !== null);
    focusable()[0]?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (!elements.length) return;
      if (event.shiftKey && document.activeElement === elements[0]) {
        event.preventDefault();
        elements.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === elements.at(-1)) {
        event.preventDefault();
        elements[0].focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus?.();
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section ref={dialogRef} className={`modal-card ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div className="modal-heading"><div><h2 id="modal-title">{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><Icon name="close" /></button></div>
        {children}
      </section>
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return <label className={`field ${className}`}><span>{label}</span>{children}</label>;
}

export function DataTable({ columns, rows, empty = 'No records match these filters.' }) {
  return rows.length ? (
    <div className="table-scroll"><table className="data-table"><thead><tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.key}>{column.render ? column.render(row) : row[column.key]}</td>)}</tr>)}</tbody></table></div>
  ) : <div className="empty-state"><span className="empty-mark">—</span><strong>{empty}</strong><p>Try changing your search or filters.</p></div>;
}

export function useDemoAI() {
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const run = (callback, delay = 700) => {
    setLoading(true);
    setComplete(false);
    window.setTimeout(() => {
      callback?.();
      setLoading(false);
      setComplete(true);
    }, delay);
  };
  return { loading, complete, run };
}

export function Metric({ label, value, note, tone = '' }) {
  return <div className="metric-card"><div className={`metric-icon ${tone}`}>{tone === 'red' ? '!' : tone === 'green' ? '✓' : '—'}</div><div className="metric-value">{value}</div><div className="metric-label">{label}</div>{note && <div className="metric-note">{note}</div>}</div>;
}
