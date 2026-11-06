// Case details, review, status, and audit UI; run from frontend with `npm run dev`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, grievanceApi } from '../../services/api';

const DEPARTMENTS = [
  { code: 'PWD', name: 'Public Works' },
  { code: 'WSD', name: 'Water Supply' },
  { code: 'SWM', name: 'Sanitation and Waste Management' },
  { code: 'ED', name: 'Electricity' },
  { code: 'HD', name: 'Public Health' },
  { code: 'FCS', name: 'Food and Civil Supplies' },
  { code: 'RD', name: 'Revenue' },
];

const NEXT_STATUSES = {
  SUBMITTED: ['UNDER_REVIEW', 'REJECTED'],
  UNDER_REVIEW: ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
  RESOLVED: ['IN_PROGRESS', 'CLOSED'],
  REJECTED: ['UNDER_REVIEW', 'CLOSED'],
  CLOSED: [],
};

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function auditActionLabel(action) {
  const labels = {
    'grievance.submitted': 'Grievance submitted',
    'grievance.reviewed': 'Staff review recorded',
    'grievance.status_changed': 'Status updated',
    'grievance.document_uploaded': 'Supporting document attached',
  };
  return labels[action] || String(action || 'Case activity').replaceAll('.', ' ').replaceAll('_', ' ');
}

export default function GrievanceDetails() {
  const { referenceId } = useParams();
  const { user } = useAuth();
  const [grievance, setGrievance] = useState(null);
  const [audit, setAudit] = useState([]);
  const [auditUnavailable, setAuditUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [review, setReview] = useState({
    category: '',
    subcategory: '',
    priority: '',
    department: '',
  });
  const canEdit = user?.role === 'ADMIN' || user?.role === 'OFFICER';
  const availableDepartments = user?.role === 'OFFICER' && user.department
    ? DEPARTMENTS.filter((department) => department.code === user.department.code)
    : DEPARTMENTS;

  const loadGrievance = useCallback(async () => {
    // Load case data and its audit history independently so audit failures are visible.
    setLoading(true);
    setError('');
    try {
      const { data } = await grievanceApi.get(referenceId);
      setGrievance(data);
      const approved = data.officer_approved || {};
      setReview({
        category: approved.category || data.ai_suggestion?.category || '',
        subcategory: approved.subcategory || data.ai_suggestion?.subcategory || '',
        priority: approved.priority || data.ai_suggestion?.suggested_priority || '',
        department:
          approved.department?.code ||
          data.recommended_department?.code ||
          '',
      });
      try {
        const auditResponse = await grievanceApi.audit(referenceId);
        setAudit(auditResponse.data);
        setAuditUnavailable(false);
      } catch {
        setAudit([]);
        setAuditUnavailable(true);
      }
    } catch (loadError) {
      setError(getErrorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }, [referenceId]);

  useEffect(() => {
    loadGrievance();
  }, [loadGrievance]);

  const effective = useMemo(() => ({
    category: grievance?.officer_approved?.category || grievance?.ai_suggestion?.category,
    priority: grievance?.officer_approved?.priority || grievance?.ai_suggestion?.suggested_priority,
    department: grievance?.officer_approved?.department || grievance?.recommended_department,
  }), [grievance]);

  async function saveReview(event) {
    // Save human-approved values separately and refresh the audit trail.
    event.preventDefault();
    setSavingReview(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await grievanceApi.review(referenceId, {
        category: review.category,
        ...(review.subcategory && { subcategory: review.subcategory }),
        priority: review.priority,
        ...(review.department && {
          department: DEPARTMENTS.find((department) => department.code === review.department),
        }),
      });
      setGrievance(data);
      setReview({
        category: data.officer_approved?.category || data.ai_suggestion?.category || '',
        subcategory: data.officer_approved?.subcategory || data.ai_suggestion?.subcategory || '',
        priority: data.officer_approved?.priority || data.ai_suggestion?.suggested_priority || '',
        department: data.officer_approved?.department?.code || data.recommended_department?.code || '',
      });
      setSuccess('Officer-approved values have been saved. Original AI suggestions are unchanged.');
      await refreshAuditOnly();
    } catch (saveError) {
      setError(getErrorMessage(saveError));
    } finally {
      setSavingReview(false);
    }
  }

  async function refreshAuditOnly() {
    // Preserve the case view if audit retrieval is unavailable.
    try {
      const { data } = await grievanceApi.audit(referenceId);
      setAudit(data);
      setAuditUnavailable(false);
    } catch {
      setAuditUnavailable(true);
    }
  }

  async function updateStatus(nextStatus) {
    // Ask the backend to validate the requested workflow transition.
    if (
      ['RESOLVED', 'REJECTED', 'CLOSED'].includes(nextStatus) &&
      !window.confirm(`Confirm changing this grievance to ${nextStatus.replaceAll('_', ' ').toLowerCase()}?`)
    ) {
      return;
    }
    setSavingStatus(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await grievanceApi.updateStatus(referenceId, nextStatus);
      setGrievance(data);
      setSuccess(`Status updated to ${nextStatus.replaceAll('_', ' ').toLowerCase()}.`);
      await refreshAuditOnly();
    } catch (statusError) {
      setError(getErrorMessage(statusError));
    } finally {
      setSavingStatus(false);
    }
  }

  if (loading) {
    return <div className="table-state"><span className="spinner-border spinner-border-sm" /> Loading grievance…</div>;
  }
  if (!grievance) {
    return (
      <div className="dashboard-page">
        <Link className="back-link" to="/dashboard">← Back to grievances</Link>
        <Alert>{error || 'Grievance could not be loaded.'}</Alert>
      </div>
    );
  }

  const ai = grievance.ai_suggestion;
  const approved = grievance.officer_approved;

  return (
    <div className="dashboard-page detail-page">
      <Link className="back-link" to="/dashboard">← Back to grievances</Link>
      <div className="page-heading-row detail-heading">
        <div>
          <span className="eyebrow">CASE MANAGEMENT / GRIEVANCE RECORD</span>
          <h1>{grievance.reference_id}</h1>
          <p>Submitted {displayDate(grievance.created_at)} <span className="heading-separator">·</span> Last updated {displayDate(grievance.updated_at)}</p>
        </div>
        <div className="detail-heading-status"><StatusBadge status={grievance.status} /><span className={approved ? 'review-indicator reviewed' : 'review-indicator'}>{approved ? 'Staff values approved' : 'Awaiting staff review'}</span></div>
      </div>
      <Alert>{error}</Alert>
      {success && <Alert variant="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

      <div className="detail-grid">
        <div className="detail-main-column">
          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row">
              <div className="panel-title-icon"><span className="section-icon"><Icon name="user" /></span><div><span className="eyebrow">CITIZEN SUBMISSION</span><h2>Citizen and grievance information</h2></div></div>
            </div>
            <div className="citizen-contact-grid">
              <div><span>Citizen</span><strong>{grievance.citizen_details.full_name}</strong></div>
              <div><span>Phone</span><strong>{grievance.citizen_details.phone_number}</strong></div>
              <div><span>Email</span><strong>{grievance.citizen_details.email || 'Not provided'}</strong></div>
            </div>
            <div className="complaint-text">
              <span className="detail-label">Grievance description</span>
              <p>{grievance.complaint_description}</p>
            </div>
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row">
              <div className="panel-title-icon"><span className="section-icon"><Icon name="activity" /></span><div><span className="eyebrow">AI-ASSISTED ANALYSIS</span><h2>Model suggestions</h2></div></div>
              <span className={`ai-state ${grievance.ai_processing_status === 'completed' ? 'ai-complete' : 'ai-manual'}`}>
                {grievance.ai_processing_status === 'completed' ? 'Suggestions available' : grievance.ai_processing_status === 'pending' ? 'Processing pending' : 'Manual review'}
              </span>
            </div>
            <p className="panel-intro">These model-generated values are advisory only. They are not an administrative decision and do not assign a department.</p>
            {ai ? (
              <>
                <div className="ai-recommendation-grid">
                  <div className="ai-data-card">
                    <span>Suggested category</span>
                    <strong>{ai.category}</strong>
                    {ai.subcategory && <small>{ai.subcategory}</small>}
                  </div>
                  <div className="ai-data-card">
                    <span>Suggested priority</span>
                    <strong className={`priority-label priority-${ai.suggested_priority}`}>{ai.suggested_priority}</strong>
                  </div>
                  <div className="ai-data-card">
                    <span>Deterministic department mapping</span>
                    <strong>{grievance.recommended_department?.name || 'Manual assignment required'}</strong>
                  </div>
                  <div className="ai-data-card">
                    <span>Model confidence estimate</span>
                    <strong>{Math.round(ai.confidence * 100)}%</strong>
                    <small>Advisory estimate, not a calibrated probability</small>
                  </div>
                </div>
                <div className="ai-summary-block">
                  <span className="detail-label">Concise summary</span>
                  <p>{ai.summary}</p>
                </div>
                <div className="ai-explanation"><span>Why this suggestion</span><p>{ai.explanation}</p></div>
              </>
            ) : (
              <div className="inline-empty">No AI suggestion is available. This case remains for manual review.</div>
            )}
          </section>

          {canEdit && (
            <section className="dashboard-panel detail-panel">
              <div className="panel-title-row">
                <div className="panel-title-icon"><span className="section-icon"><Icon name="clipboard" /></span><div><span className="eyebrow">AUTHORIZED STAFF ACTION</span><h2>Officer review and correction</h2></div></div>
                <span className="human-review-mark"><Icon name="check" size={14} /> Staff decision</span>
              </div>
              <p className="panel-intro">AI suggestions are advisory. Save the final values you approve; original suggestions remain preserved above.</p>
              <form className="review-form" onSubmit={saveReview}>
                <label className="form-label-wrap">
                  <span>Final category <b aria-hidden="true">*</b></span>
                  <input className="form-control" value={review.category} onChange={(event) => setReview((current) => ({ ...current, category: event.target.value }))} maxLength={80} required />
                </label>
                <label className="form-label-wrap">
                  <span>Final subcategory</span>
                  <input className="form-control" value={review.subcategory} onChange={(event) => setReview((current) => ({ ...current, subcategory: event.target.value }))} maxLength={80} />
                </label>
                <label className="form-label-wrap">
                  <span>Final priority <b aria-hidden="true">*</b></span>
                  <select className="form-select" value={review.priority} onChange={(event) => setReview((current) => ({ ...current, priority: event.target.value }))} required>
                    <option value="">Choose priority</option>
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
                  </select>
                </label>
                <label className="form-label-wrap">
                  <span>Assigned department <b aria-hidden="true">*</b></span>
                  <select className="form-select" value={review.department} onChange={(event) => setReview((current) => ({ ...current, department: event.target.value }))} required>
                    <option value="">Choose department</option>
                    {availableDepartments.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}
                  </select>
                  {user?.role === 'OFFICER' && <small className="field-note">Your account is limited to {user.department?.name || 'its assigned department'}.</small>}
                </label>
                <div className="review-footer">
                  <div className="approved-summary">
                    <span>Current effective values</span>
                    <strong>{effective.category || 'Unclassified'} · {effective.priority || 'No priority'} · {effective.department?.name || 'Unassigned'}</strong>
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={savingReview}>{savingReview ? 'Saving…' : 'Save approved values'}</button>
                </div>
              </form>
            </section>
          )}
        </div>

        <aside className="detail-side-column">
          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row compact-panel-title">
              <div className="panel-title-icon"><span className="section-icon"><Icon name="activity" /></span><div><span className="eyebrow">CASE CONTROL</span><h2>Status management</h2></div></div>
            </div>
            <div className="current-status"><StatusBadge status={grievance.status} /></div>
            {canEdit && NEXT_STATUSES[grievance.status]?.length > 0 && (
              <div className="status-actions">
                <span className="detail-label">Available next actions</span>
                {NEXT_STATUSES[grievance.status].map((next) => (
                  <button key={next} type="button" className={`btn ${['REJECTED', 'CLOSED'].includes(next) ? 'btn-outline-danger' : 'btn-outline-primary'} w-100`} disabled={savingStatus} onClick={() => updateStatus(next)}>
                    {savingStatus ? 'Updating…' : <>Set to {next.replaceAll('_', ' ').toLowerCase()} <Icon name="arrowRight" size={16} /></>}
                  </button>
                ))}
              </div>
            )}
            {canEdit && NEXT_STATUSES[grievance.status]?.length === 0 && <div className="inline-empty">This case is closed. There are no further status transitions.</div>}
            <div className="status-updated">Last updated<br /><strong>{displayDate(grievance.updated_at)}</strong></div>
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row compact-panel-title">
              <div className="panel-title-icon"><span className="section-icon"><Icon name="file" /></span><div><span className="eyebrow">ATTACHMENTS</span><h2>Supporting documents</h2></div></div>
            </div>
            {grievance.supporting_documents?.length ? (
              <div className="document-list">
                {grievance.supporting_documents.map((document) => (
                  <a key={document.cloudinary_public_id} href={document.secure_url} target="_blank" rel="noreferrer" className="document-item">
                    <span className="document-icon"><Icon name="file" size={17} /></span>
                    <span><strong>{document.original_filename}</strong><small>{(document.size_bytes / 1024 / 1024).toFixed(2)} MB · {document.format.toUpperCase()}</small></span>
                    <span className="document-open"><Icon name="arrowUpRight" size={16} /></span>
                  </a>
                ))}
              </div>
            ) : <div className="inline-empty">No documents attached.</div>}
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row compact-panel-title">
              <div className="panel-title-icon"><span className="section-icon"><Icon name="clock" /></span><div><span className="eyebrow">CASE HISTORY</span><h2>Audit history</h2></div></div>
            </div>
            {auditUnavailable ? (
              <div className="inline-empty">Audit history is unavailable for this account or service.</div>
            ) : audit.length ? (
              <div className="audit-timeline">
                {audit.map((entry) => (
                  <article className="audit-event" key={`${entry.action}-${entry.created_at}`}>
                    <span className="audit-point" />
                    <div className="audit-event-heading">
                      <strong>{auditActionLabel(entry.action)}</strong>
                      <time>{displayDate(entry.created_at)}</time>
                    </div>
                    <span className="audit-actor">{entry.actor.actor_type}{entry.actor.actor_id ? ` · ${entry.actor.actor_id.slice(-6)}` : ''}</span>
                    {(entry.previous_values || entry.new_values) && (
                      <div className="audit-changes">
                        {entry.previous_values && <div><span>Previous values</span><pre>{JSON.stringify(entry.previous_values, null, 2)}</pre></div>}
                        {entry.new_values && <div><span>Recorded values</span><pre>{JSON.stringify(entry.new_values, null, 2)}</pre></div>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            ) : <div className="inline-empty">No recorded events.</div>}
          </section>
        </aside>
      </div>
      <div className="dashboard-footnote"><Icon name="shield" size={15} /> Prototype service · Case access is enforced by the backend according to staff role and department.</div>
    </div>
  );
}
