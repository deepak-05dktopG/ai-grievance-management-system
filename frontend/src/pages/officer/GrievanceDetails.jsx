// Case details, review, status, and audit UI; run from frontend with `npm run dev`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Alert from '../../components/Alert';
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
  return value ? new Date(value).toLocaleString() : '—';
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
          <span className="eyebrow">GRIEVANCE RECORD</span>
          <h1>{grievance.reference_id}</h1>
          <p>Submitted {displayDate(grievance.created_at)}</p>
        </div>
        <StatusBadge status={grievance.status} />
      </div>
      <Alert>{error}</Alert>
      {success && <Alert variant="success" onDismiss={() => setSuccess('')}>{success}</Alert>}

      <div className="detail-grid">
        <div className="detail-main-column">
          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row">
              <div><span className="eyebrow">CITIZEN SUBMISSION</span><h2>Complaint details</h2></div>
              <span className="submission-date">{displayDate(grievance.created_at)}</span>
            </div>
            <div className="citizen-contact-grid">
              <div><span>Citizen</span><strong>{grievance.citizen_details.full_name}</strong></div>
              <div><span>Phone</span><strong>{grievance.citizen_details.phone_number}</strong></div>
              <div><span>Email</span><strong>{grievance.citizen_details.email || 'Not provided'}</strong></div>
            </div>
            <div className="complaint-text">
              <span className="detail-label">Complaint description</span>
              <p>{grievance.complaint_description}</p>
            </div>
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row">
              <div><span className="eyebrow">AI-ASSISTED CLASSIFICATION</span><h2>Recommendation</h2></div>
              <span className={`ai-state ${grievance.ai_processing_status === 'completed' ? 'ai-complete' : 'ai-manual'}`}>
                {grievance.ai_processing_status === 'completed' ? 'Analysis complete' : 'Manual review'}
              </span>
            </div>
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
                    <span>Department recommendation</span>
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
                <div><span className="eyebrow">HUMAN REVIEW</span><h2>Approved classification</h2></div>
                <span className="human-review-mark">Staff decision</span>
              </div>
              <p className="panel-intro">AI suggestions are advisory. Save the final values you approve; original suggestions remain preserved above.</p>
              <form className="review-form" onSubmit={saveReview}>
                <label className="form-label-wrap">
                  <span>Approved category</span>
                  <input className="form-control" value={review.category} onChange={(event) => setReview((current) => ({ ...current, category: event.target.value }))} maxLength={80} required />
                </label>
                <label className="form-label-wrap">
                  <span>Approved subcategory</span>
                  <input className="form-control" value={review.subcategory} onChange={(event) => setReview((current) => ({ ...current, subcategory: event.target.value }))} maxLength={80} />
                </label>
                <label className="form-label-wrap">
                  <span>Approved priority</span>
                  <select className="form-select" value={review.priority} onChange={(event) => setReview((current) => ({ ...current, priority: event.target.value }))} required>
                    <option value="">Choose priority</option>
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
                  </select>
                </label>
                <label className="form-label-wrap">
                  <span>Department</span>
                  <select className="form-select" value={review.department} onChange={(event) => setReview((current) => ({ ...current, department: event.target.value }))} required>
                    <option value="">Choose department</option>
                    {DEPARTMENTS.map((department) => <option key={department.code} value={department.code}>{department.name}</option>)}
                  </select>
                  {user?.role === 'OFFICER' && <small className="field-note">Your department assignment controls which cases you can access.</small>}
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
              <div><span className="eyebrow">CASE CONTROL</span><h2>Status</h2></div>
            </div>
            <div className="current-status"><StatusBadge status={grievance.status} /></div>
            {canEdit && NEXT_STATUSES[grievance.status]?.length > 0 && (
              <div className="status-actions">
                <span className="detail-label">Move case to</span>
                {NEXT_STATUSES[grievance.status].map((next) => (
                  <button key={next} type="button" className={`btn ${next === 'REJECTED' ? 'btn-outline-danger' : 'btn-outline-primary'} w-100`} disabled={savingStatus} onClick={() => updateStatus(next)}>
                    {savingStatus ? 'Updating…' : next.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            )}
            <div className="status-updated">Last updated<br /><strong>{displayDate(grievance.updated_at)}</strong></div>
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row compact-panel-title">
              <div><span className="eyebrow">ATTACHMENTS</span><h2>Supporting documents</h2></div>
            </div>
            {grievance.supporting_documents?.length ? (
              <div className="document-list">
                {grievance.supporting_documents.map((document) => (
                  <a key={document.cloudinary_public_id} href={document.secure_url} target="_blank" rel="noreferrer" className="document-item">
                    <span className="document-icon">▤</span>
                    <span><strong>{document.original_filename}</strong><small>{(document.size_bytes / 1024 / 1024).toFixed(2)} MB · {document.format.toUpperCase()}</small></span>
                    <span className="document-open">↗</span>
                  </a>
                ))}
              </div>
            ) : <div className="inline-empty">No documents attached.</div>}
          </section>

          <section className="dashboard-panel detail-panel">
            <div className="panel-title-row compact-panel-title">
              <div><span className="eyebrow">CASE HISTORY</span><h2>Audit trail</h2></div>
            </div>
            {auditUnavailable ? (
              <div className="inline-empty">Audit history is unavailable for this account or service.</div>
            ) : audit.length ? (
              <div className="audit-timeline">
                {audit.map((entry) => (
                  <article className="audit-event" key={`${entry.action}-${entry.created_at}`}>
                    <span className="audit-point" />
                    <div className="audit-event-heading">
                      <strong>{entry.action.replaceAll('.', ' ').replaceAll('_', ' ')}</strong>
                      <time>{displayDate(entry.created_at)}</time>
                    </div>
                    <span className="audit-actor">{entry.actor.actor_type}{entry.actor.actor_id ? ` · ${entry.actor.actor_id.slice(-6)}` : ''}</span>
                    {entry.new_values && <pre>{JSON.stringify(entry.new_values, null, 2)}</pre>}
                  </article>
                ))}
              </div>
            ) : <div className="inline-empty">No recorded events.</div>}
          </section>
        </aside>
      </div>
      <div className="dashboard-footnote">Prototype service · Case information is visible only to authorized staff and the citizen access code holder.</div>
    </div>
  );
}
