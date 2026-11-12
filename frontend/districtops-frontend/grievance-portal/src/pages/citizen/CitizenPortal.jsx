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
const LAST_TRACKING_CODE_KEY = 'creditfix_last_tracking_code';
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
  const [trackingCode, setTrackingCode] = useState(
    () => sessionStorage.getItem(LAST_TRACKING_CODE_KEY) || '',
  );
  const [tracking, setTracking] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [copyMessage, setCopyMessage] = useState('');

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
    if (!submission?.citizen_tracking_code || !failedUploads.length) return;
    setRetryingUploads(true);
    setUploadMessage('');
    const remaining = [];
    for (const file of failedUploads) {
      try {
        await grievanceApi.uploadDocument(
          submission.reference_id,
          file,
          submission.citizen_tracking_code,
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
    // Create the grievance first, then attach optional files with its tracking code.
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
      setFailedUploads([]);
      setTrackingCode(data.citizen_tracking_code);
      sessionStorage.setItem(LAST_TRACKING_CODE_KEY, data.citizen_tracking_code);
      if (files.length) {
        const failures = [];
        for (const file of files) {
          try {
            await grievanceApi.uploadDocument(
              data.reference_id,
              file,
              data.citizen_tracking_code,
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
    // Fetch limited case progress using the single code issued on submission.
    event.preventDefault();
    setTrackingError('');
    setTracking(null);
    setTrackingLoading(true);
    const code = trackingCode.trim();
    if (!code) {
      setTrackingLoading(false);
      setTrackingError('Enter the tracking code shown on your submission receipt.');
      return;
    }
    try {
      const { data } = await grievanceApi.track(code);
      if (!data?.reference_id || !data?.status) {
        throw new Error('The tracking response was incomplete. Please try again later.');
      }
      setTracking(data);
      setTrackingCode(code);
      sessionStorage.setItem(LAST_TRACKING_CODE_KEY, code);
    } catch (error) {
      setTrackingError(
        error.response?.status === 401
          ? 'That tracking code is invalid or has expired. Check it and try again.'
          : getErrorMessage(error),
      );
    } finally {
      setTrackingLoading(false);
    }
  }

  async function copyTrackingCode() {
    // Copy the single tracking code so the citizen can save it for later.
    if (!submission?.citizen_tracking_code) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard access is unavailable.');
      }
      await navigator.clipboard.writeText(
        submission.citizen_tracking_code,
      );
      setCopyMessage('Tracking code copied. Store it somewhere private.');
    } catch {
      setCopyMessage('Could not copy automatically. Select and save the tracking code above.');
    }
  }

  return (
    <div className="citizen-page">
      <header className="citizen-topbar">
        <div className="container citizen-topbar-inner">
          <Link to="/" aria-label="Tamil Nadu grievance portal home" className="brand-link">
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
              the single tracking code provided on your receipt.
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
              <li><span>02</span><div><strong>Save your tracking code</strong><small>One private code is all you need to check progress.</small></div></li>
              <li><span>03</span><div><strong>Check case progress</strong><small>Enter the code to see the latest status.</small></div></li>
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
                <p>Your grievance has been recorded. Keep this code private; it is all you need to check case progress.</p>
                <div className="access-code-panel">
                  <div>
                    <span>SINGLE TRACKING CODE</span>
                    <strong>{submission.citizen_tracking_code}</strong>
                  </div>
                  <button type="button" className="btn btn-outline-primary btn-sm" onClick={copyTrackingCode}>
                    <Icon name="clipboard" size={15} /> Copy code
                  </button>
                </div>
                <p className="privacy-hint" role="status">
                  {copyMessage || 'Save this code. It is also remembered in this browser tab for the current session.'}
                </p>
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
                  <span className="privacy-hint">Your single tracking code is private. Store it securely after submission.</span>
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
                <p>Enter the single tracking code from your submission receipt.</p>
              </div>
            </div>
            <form className="portal-form tracking-form" onSubmit={handleTrack}>
              <Alert>{trackingError}</Alert>
              <label className="form-label-wrap">
                <span>Tracking code <b>*</b></span>
                <input
                  className="form-control"
                  value={trackingCode}
                  onChange={(event) => {
                    setTrackingCode(event.target.value);
                    setTracking(null);
                    setTrackingError('');
                  }}
                  required
                  pattern="(?:CFX-[A-Za-z0-9]{4}(?:-[A-Za-z0-9]{4}){3}|(?:[A-Za-z0-9]|-|_){20,64})"
                  title="Enter the tracking code shown on your submission receipt."
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  placeholder="CFX-ABCD-EFGH-JKLM-NPQR"
                />
              </label>
              <p className="privacy-hint">
                The latest tracking code is remembered in this browser tab for the current session.
              </p>
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
              <span><strong>Your case, kept private</strong><small>Your tracking code is needed to retrieve status and attach documents.</small></span>
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
