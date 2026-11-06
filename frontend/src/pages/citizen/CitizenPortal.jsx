// Citizen submission, attachment, and tracking UI; run from frontend with `npm run dev`.

import { useState } from 'react';
import Brand from '../../components/Brand';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage, grievanceApi } from '../../services/api';
import { Link } from 'react-router-dom';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const TRACKING_PROGRESS = {
  SUBMITTED: 'Awaiting staff review',
  UNDER_REVIEW: 'Staff review in progress',
  IN_PROGRESS: 'Work in progress',
  RESOLVED: 'Resolved',
  REJECTED: 'Decision recorded',
  CLOSED: 'Case closed',
};

function getTrackingProgress(tracking) {
  return TRACKING_PROGRESS[tracking?.status] || 'Status unavailable';
}

function getTrackingStage(status) {
  if (status === 'SUBMITTED') return 0;
  if (status === 'UNDER_REVIEW') return 1;
  if (status === 'IN_PROGRESS') return 2;
  if (status === 'RESOLVED') return 3;
  return -1;
}

function formatTrackingDate(value, options) {
  if (!value) return 'Unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unavailable'
    : date.toLocaleString(undefined, options);
}

function filesFromInput(input) {
  // Match client-side attachment checks to the backend's accepted types and size.
  const files = Array.from(input || []);
  if (files.some((file) => !ACCEPTED_TYPES.includes(file.type))) {
    throw new Error('Only PDF, JPG, JPEG, and PNG documents are accepted.');
  }
  if (files.some((file) => file.size > MAX_FILE_SIZE)) {
    throw new Error('Each supporting document must be 5 MB or smaller.');
  }
  return files;
}

export default function CitizenPortal() {
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    complaint: '',
  });
  const [files, setFiles] = useState([]);
  const [fieldError, setFieldError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState(null);
  const [uploadMessage, setUploadMessage] = useState('');
  const [uploadProgress, setUploadProgress] = useState(null);
  const [failedUploads, setFailedUploads] = useState([]);
  const [retryingUploads, setRetryingUploads] = useState(false);
  const [trackingReference, setTrackingReference] = useState('');
  const [trackingToken, setTrackingToken] = useState('');
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function updateFiles(event) {
    setFieldError('');
    try {
      setFiles(filesFromInput(event.target.files));
    } catch (error) {
      setFiles([]);
      setFieldError(error.message);
      event.target.value = '';
    }
  }

  async function retryFailedUploads() {
    // Retry only files that failed after the grievance itself was saved.
    if (!submission?.citizen_access_token || !failedUploads.length) return;
    setRetryingUploads(true);
    setUploadMessage('');
    const remaining = [];
    for (const file of failedUploads) {
      try {
        await grievanceApi.uploadDocument(
          submission.reference_id,
          file,
          submission.citizen_access_token,
          (event) => {
            if (event.total) {
              setUploadProgress({
                name: file.name,
                percent: Math.round((event.loaded / event.total) * 100),
              });
            }
          },
        );
      } catch (error) {
        remaining.push({ file, message: getErrorMessage(error) });
      }
    }
    setUploadProgress(null);
    setFailedUploads(remaining.map((entry) => entry.file));
    setUploadMessage(
      remaining.length
        ? `Some files are still pending: ${remaining.map((entry) => `${entry.file.name}: ${entry.message}`).join(' ')}`
        : 'All pending supporting documents have been attached.',
    );
    setRetryingUploads(false);
  }

  async function handleSubmit(event) {
    // Create the grievance first, then attach optional files with its access token.
    event.preventDefault();
    setSubmitError('');
    setFieldError('');
    setUploadMessage('');
    setSubmitting(true);
    try {
      const { data } = await grievanceApi.submit({
        citizen_details: {
          full_name: form.fullName,
          email: form.email,
          phone_number: form.phone,
        },
        complaint_description: form.complaint,
      });
      setSubmission(data);
      setTrackingReference(data.reference_id);
      setTrackingToken(data.citizen_access_token);
      setFailedUploads([]);
      sessionStorage.setItem(
        `creditfix_citizen_token:${data.reference_id}`,
        data.citizen_access_token,
      );
      if (files.length) {
        const failures = [];
        for (const file of files) {
          try {
            await grievanceApi.uploadDocument(
              data.reference_id,
              file,
              data.citizen_access_token,
              (event) => {
                if (event.total) {
                  setUploadProgress({
                    name: file.name,
                    percent: Math.round((event.loaded / event.total) * 100),
                  });
                }
              },
            );
          } catch (error) {
            failures.push({ file, message: getErrorMessage(error) });
          }
        }
        setFailedUploads(failures.map((entry) => entry.file));
        if (failures.length) {
          setUploadMessage(
            `Your grievance was submitted, but some files could not be uploaded: ${failures.map((entry) => `${entry.file.name}: ${entry.message}`).join(' ')}`,
          );
        } else {
          setUploadMessage(`${files.length} supporting document${files.length > 1 ? 's' : ''} attached.`);
        }
      }
      setTracking({
        reference_id: data.reference_id,
        status: data.status,
        ai_processing_status: data.ai_processing_status,
        officer_reviewed: false,
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  }

  async function handleTrack(event) {
    // Fetch limited case progress with the citizen's private grievance token.
    event.preventDefault();
    setTrackingError('');
    setTracking(null);
    setTrackingLoading(true);
    const token =
      trackingToken ||
      sessionStorage.getItem(`creditfix_citizen_token:${trackingReference.trim()}`);
    if (!token) {
      setTrackingLoading(false);
      setTrackingError('Enter the private access code provided when you submitted this grievance.');
      return;
    }
    try {
      const { data } = await grievanceApi.track(trackingReference.trim(), token);
      if (!data?.reference_id || !data?.status) {
        throw new Error('The tracking response was incomplete. Please try again later.');
      }
      setTracking(data);
      setTrackingToken(token);
    } catch (error) {
      setTrackingError(getErrorMessage(error));
    } finally {
      setTrackingLoading(false);
    }
  }

  function copyAccessCode() {
    // The access code is a bearer credential; only copy it when explicitly requested.
    if (submission?.citizen_access_token) {
      navigator.clipboard?.writeText(submission.citizen_access_token);
    }
  }

  return (
    <div className="citizen-page">
      <header className="citizen-topbar">
        <div className="container citizen-topbar-inner">
          <Link to="/" aria-label="Creditfix home" className="brand-link">
            <Brand />
          </Link>
          <div className="public-service-label">
            <span className="prototype-label"><Icon name="shield" size={15} /> Prototype service</span>
          </div>
          <nav className="citizen-header-actions" aria-label="Public navigation">
            <a className="header-text-link" href="#track">Track a grievance</a>
            <Link to="/login" className="btn btn-outline-primary btn-sm staff-login-link">
              Staff sign in <Icon name="arrowRight" size={16} />
            </Link>
          </nav>
        </div>
      </header>

      <section className="citizen-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> PUBLIC GRIEVANCE PORTAL</div>
            <h1>Tell us what needs<br />attention.</h1>
            <p>
              Submit a concern for review and keep track of its progress using
              the reference ID and private access code provided to you.
            </p>
            <div className="hero-actions">
              <a className="btn btn-primary" href="#submit">Submit a grievance <Icon name="arrowRight" size={18} /></a>
              <a className="hero-secondary-link" href="#track">Track an existing case</a>
            </div>
          </div>
          <div className="hero-service-note">
            <div className="service-note-heading"><Icon name="clipboard" size={22} /><span>How the service works</span></div>
            <ol>
              <li><span>01</span><div><strong>Submit your concern</strong><small>Provide contact details and a clear description.</small></div></li>
              <li><span>02</span><div><strong>Keep your reference safe</strong><small>Your private access code is required to track.</small></div></li>
              <li><span>03</span><div><strong>Check case progress</strong><small>Use both credentials to view the latest status.</small></div></li>
            </ol>
          </div>
        </div>
      </section>

      <main className="container citizen-content">
        <div className="citizen-section-heading">
          <div>
            <span className="eyebrow">CITIZEN SERVICES</span>
            <h2>Submit or follow a case</h2>
            <p>Use the form to register a concern, or enter your credentials to view an existing case.</p>
          </div>
          <span className="required-note"><b>*</b> Required field</span>
        </div>

        <div className="portal-grid">
          <section id="submit" className="portal-card submission-card" aria-labelledby="submit-title">
            <div className="card-heading">
              <div className="card-icon green-icon"><Icon name="file" /></div>
              <div>
                <span className="eyebrow">NEW SUBMISSION</span>
                <h3 id="submit-title">Register your concern</h3>
                <p>Share accurate contact details and describe the issue as clearly as possible.</p>
              </div>
            </div>
            {submission ? (
              <div className="submission-success">
                <div className="success-medallion"><Icon name="check" size={27} /></div>
                <span className="eyebrow">RECEIPT CONFIRMATION</span>
                <h3>Thank you for reaching out.</h3>
                <p>Your grievance has been recorded. Keep the details below private so you can securely track your case.</p>
                <div className="reference-panel">
                  <span>REFERENCE ID</span>
                  <strong>{submission.reference_id}</strong>
                </div>
                <div className="access-code-panel">
                  <div>
                    <span>PRIVATE ACCESS CODE</span>
                    <strong>{submission.citizen_access_token}</strong>
                  </div>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={copyAccessCode}>Copy</button>
                </div>
                <p className="privacy-hint">This code is shown only once and is needed with your reference ID for tracking and document uploads.</p>
                {uploadMessage && <Alert variant={failedUploads.length ? 'warning' : 'success'}>{uploadMessage}</Alert>}
                {uploadProgress && (
                  <div className="upload-progress" role="status" aria-live="polite">
                    <div className="upload-progress-heading">
                      <span>Uploading {uploadProgress.name}</span>
                      <strong>{uploadProgress.percent}%</strong>
                    </div>
                    <div className="progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={uploadProgress.percent} role="progressbar">
                      <div className="progress-bar" style={{ width: `${uploadProgress.percent}%` }} />
                    </div>
                  </div>
                )}
                {failedUploads.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm retry-uploads"
                    onClick={retryFailedUploads}
                    disabled={retryingUploads}
                  >
                    {retryingUploads ? 'Retrying uploads…' : `Retry ${failedUploads.length} pending upload${failedUploads.length === 1 ? '' : 's'}`}
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-outline-primary another-submission-button"
                  onClick={() => {
                    setSubmission(null);
                    setForm({ fullName: '', email: '', phone: '', complaint: '' });
                    setFiles([]);
                  }}
                >
                  Submit another grievance
                </button>
              </div>
            ) : (
              <form className="portal-form" onSubmit={handleSubmit}>
                <Alert>{submitError || fieldError}</Alert>
                <div className="form-grid two-col">
                  <label className="form-label-wrap">
                    <span>Full name <b>*</b></span>
                    <input
                      className="form-control"
                      name="fullName"
                      autoComplete="name"
                      value={form.fullName}
                      onChange={updateField}
                      maxLength={120}
                      required
                      placeholder="Enter your full name"
                    />
                  </label>
                  <label className="form-label-wrap">
                    <span>Phone number <b>*</b></span>
                    <input
                      className="form-control"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      value={form.phone}
                      onChange={updateField}
                      minLength={7}
                      maxLength={20}
                      pattern="[0-9+() -]+"
                      required
                      placeholder="+91 98765 43210"
                    />
                  </label>
                </div>
                <label className="form-label-wrap">
                  <span>Email address <small>(optional)</small></span>
                  <input
                    className="form-control"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                </label>
                <label className="form-label-wrap">
                  <span>Describe the issue <b>*</b></span>
                  <textarea
                    className="form-control complaint-input"
                    name="complaint"
                    value={form.complaint}
                    onChange={updateField}
                    minLength={10}
                    maxLength={10000}
                    required
                    placeholder="Describe what happened and include useful details such as when it occurred. Do not include information that is not needed to understand the concern."
                  />
                  <small className="field-note">{form.complaint.length}/10,000 characters</small>
                </label>
                <label className="form-label-wrap">
                  <span>Supporting documents <small>(optional)</small></span>
                  <input
                    className="form-control file-input"
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    multiple
                    onChange={updateFiles}
                  />
                  <small className="field-note">PDF, JPG, JPEG or PNG · Maximum 5 MB per file</small>
                  {files.length > 0 && (
                    <div className="selected-files">
                      {files.map((file) => <span key={`${file.name}-${file.size}`}><Icon name="file" size={15} />{file.name}<small>{(file.size / 1024 / 1024).toFixed(2)} MB</small></span>)}
                    </div>
                  )}
                </label>
                <div className="form-submit-row">
                  <span className="privacy-hint">Your tracking reference and access code are private. Store them securely after submission.</span>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Submitting…</> : <>Submit grievance <Icon name="arrowRight" size={18} /></>}
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside id="track" className="portal-card tracking-card" aria-labelledby="track-title">
            <div className="card-heading">
              <div className="card-icon blue-icon"><Icon name="search" /></div>
              <div>
                <span className="eyebrow">CASE TRACKING</span>
                <h3 id="track-title">Check case progress</h3>
                <p>Enter the reference ID and private access code from your receipt.</p>
              </div>
            </div>
            <form className="portal-form tracking-form" onSubmit={handleTrack}>
              <Alert>{trackingError}</Alert>
              <label className="form-label-wrap">
                <span>Grievance reference ID <b>*</b></span>
                <input
                  className="form-control reference-input"
                  value={trackingReference}
                  onChange={(event) => {
                    setTrackingReference(event.target.value.toUpperCase());
                    setTrackingToken('');
                    setTracking(null);
                    setTrackingError('');
                  }}
                  required
                  pattern="CFX-[0-9]{8}-[A-F0-9]{12}"
                  title="Enter the reference ID in the format CFX-YYYYMMDD-XXXXXXXXXXXX."
                  autoComplete="off"
                  placeholder="CFX-YYYYMMDD-XXXXXXXXXXXX"
                />
              </label>
              <label className="form-label-wrap">
                <span>Private access code <b>*</b></span>
                <input
                  className="form-control"
                  value={trackingToken}
                  onChange={(event) => setTrackingToken(event.target.value)}
                  autoComplete="off"
                  required
                  placeholder="Enter your submission access code"
                />
              </label>
              <button className="btn btn-outline-primary w-100" type="submit" disabled={trackingLoading}>
                {trackingLoading ? <><span className="spinner-border spinner-border-sm me-2" />Checking…</> : 'Check status'}
              </button>
            </form>
            {tracking && (
              <div className="tracking-result">
                <div className="tracking-result-top">
                  <div><span className="eyebrow">CURRENT CASE STATUS</span><strong className="tracking-ref">{tracking.reference_id}</strong></div>
                  <StatusBadge status={tracking.status} />
                </div>
                {['REJECTED', 'CLOSED'].includes(tracking.status) ? (
                  <div className="tracking-outcome-note">
                    <Icon name="activity" size={17} />
                    <span><strong>{getTrackingProgress(tracking)}</strong><small>The citizen tracking response does not include the full status history.</small></span>
                  </div>
                ) : (
                  <div className="tracking-timeline" aria-label={`Current status: ${getTrackingProgress(tracking)}`}>
                    {['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED'].map((step, index) => {
                      const activeStage = getTrackingStage(tracking.status);
                      const completed = index < activeStage;
                      const current = index === activeStage;
                      return (
                        <div className={`tracking-step ${completed ? 'complete' : ''} ${current ? 'current' : ''}`} key={step}>
                          <span className="tracking-step-marker">{completed ? <Icon name="check" size={13} /> : index + 1}</span>
                          <span>{['Submitted', 'Under review', 'In progress', 'Resolved'][index]}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="tracking-meta">
                  <span>Submitted</span>
                  <strong>{formatTrackingDate(tracking.created_at, { dateStyle: 'medium' })}</strong>
                </div>
                <div className="tracking-meta">
                  <span>Current progress</span>
                  <strong>{getTrackingProgress(tracking)}</strong>
                </div>
                <div className="tracking-meta">
                  <span>Officer review</span>
                  <strong>{tracking.officer_reviewed ? 'Review recorded' : 'No review recorded yet'}</strong>
                </div>
                <div className="tracking-meta">
                  <span>Last updated</span>
                  <strong>{formatTrackingDate(tracking.updated_at, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
                </div>
              </div>
            )}
            <div className="tracking-security">
              <span className="security-lock"><Icon name="lock" size={17} /></span>
              <span><strong>Your case, kept private</strong><small>Your access code is required to retrieve status and attach documents.</small></span>
            </div>
          </aside>
        </div>
        <div className="citizen-disclaimer">
          <Icon name="shield" size={19} />
          <p>This is an assessment prototype and is not connected to actual government systems. The tracking service currently returns status and timestamps only; category and department details are not part of the citizen tracking response.</p>
        </div>
      </main>
      <footer className="citizen-footer">
        <div className="container">
          <Brand compact />
          <span>Assessment prototype · Not an official government service</span>
        </div>
      </footer>
    </div>
  );
}
