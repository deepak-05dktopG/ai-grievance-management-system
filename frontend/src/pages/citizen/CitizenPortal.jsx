import { useState } from 'react';
import Brand from '../../components/Brand';
import Alert from '../../components/Alert';
import StatusBadge from '../../components/StatusBadge';
import { getErrorMessage, grievanceApi } from '../../services/api';
import { Link } from 'react-router-dom';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

function filesFromInput(input) {
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
        );
      } catch (error) {
        remaining.push({ file, message: getErrorMessage(error) });
      }
    }
    setFailedUploads(remaining.map((entry) => entry.file));
    setUploadMessage(
      remaining.length
        ? `Some files are still pending: ${remaining.map((entry) => `${entry.file.name}: ${entry.message}`).join(' ')}`
        : 'All pending supporting documents have been attached.',
    );
    setRetryingUploads(false);
  }

  async function handleSubmit(event) {
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
        created_at: data.created_at,
        updated_at: data.updated_at,
      });
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTrack(event) {
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
      setTracking(data);
      setTrackingToken(token);
    } catch (error) {
      setTrackingError(getErrorMessage(error));
    } finally {
      setTrackingLoading(false);
    }
  }

  function copyAccessCode() {
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
            <span className="service-status-dot" />
            Public service portal
          </div>
          <Link to="/login" className="btn btn-outline-primary btn-sm staff-login-link">
            Staff sign in <span aria-hidden="true">→</span>
          </Link>
        </div>
      </header>

      <section className="citizen-hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow"><span /> CITIZEN SERVICES</div>
            <h1>Your concern matters.<br /><em>We’re here to help.</em></h1>
            <p>
              Submit a grievance to the district administration and follow its
              progress securely, using your reference and private access code.
            </p>
            <div className="hero-points">
              <span><b>01</b> Submit your concern</span>
              <span><b>02</b> Receive a reference</span>
              <span><b>03</b> Track securely</span>
            </div>
          </div>
          <div className="hero-illustration" aria-hidden="true">
            <div className="illustration-sun" />
            <div className="illustration-building">
              <div className="building-roof" />
              <div className="building-top"><span /><span /><span /></div>
              <div className="building-columns"><i /><i /><i /><i /></div>
              <div className="building-base" />
            </div>
            <div className="illustration-ground" />
            <div className="hero-callout">
              <span className="callout-check">✓</span>
              <span><strong>One clear process</strong><small>Every concern is recorded</small></span>
            </div>
          </div>
        </div>
      </section>

      <main className="container citizen-content">
        <div className="citizen-section-heading">
          <div>
            <span className="eyebrow">GET STARTED</span>
            <h2>How can we assist you?</h2>
          </div>
          <span className="required-note"><b>*</b> Required information</span>
        </div>

        <div className="portal-grid">
          <section className="portal-card submission-card" aria-labelledby="submit-title">
            <div className="card-heading">
              <div className="card-icon green-icon">✎</div>
              <div>
                <h3 id="submit-title">Submit a grievance</h3>
                <p>Tell us what happened. We’ll make sure it reaches the right team.</p>
              </div>
            </div>
            {submission ? (
              <div className="submission-success">
                <div className="success-medallion">✓</div>
                <span className="eyebrow">SUBMISSION RECEIVED</span>
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
                  className="btn btn-link px-0"
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
                  <span>Email address <b>*</b></span>
                  <input
                    className="form-control"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={updateField}
                    maxLength={254}
                    required
                    placeholder="you@example.com"
                  />
                </label>
                <label className="form-label-wrap">
                  <span>Describe your concern <b>*</b></span>
                  <textarea
                    className="form-control complaint-input"
                    name="complaint"
                    value={form.complaint}
                    onChange={updateField}
                    minLength={10}
                    maxLength={10000}
                    required
                    placeholder="Include where and when this happened, and any details that may help us understand the issue."
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
                      {files.map((file) => <span key={`${file.name}-${file.size}`}>▧ {file.name}</span>)}
                    </div>
                  )}
                </label>
                <div className="form-submit-row">
                  <span className="privacy-hint">Your contact information is used only to manage this grievance.</span>
                  <button className="btn btn-primary" type="submit" disabled={submitting}>
                    {submitting ? <><span className="spinner-border spinner-border-sm me-2" />Submitting…</> : <>Submit grievance <span>→</span></>}
                  </button>
                </div>
              </form>
            )}
          </section>

          <aside className="portal-card tracking-card" aria-labelledby="track-title">
            <div className="card-heading">
              <div className="card-icon blue-icon">⌕</div>
              <div>
                <h3 id="track-title">Track a grievance</h3>
                <p>Already submitted? Check your case status at any time.</p>
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
                  placeholder="CFX-YYYYMMDD-XXXXXXXXXXXX"
                />
              </label>
              <label className="form-label-wrap">
                <span>Private access code <b>*</b></span>
                <input
                  className="form-control"
                  value={trackingToken}
                  onChange={(event) => setTrackingToken(event.target.value)}
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
                  <span className="eyebrow">CASE STATUS</span>
                  <StatusBadge status={tracking.status} />
                </div>
                <strong className="tracking-ref">{tracking.reference_id}</strong>
                <div className="tracking-meta">
                  <span>Submitted</span>
                  <strong>{new Date(tracking.created_at).toLocaleDateString()}</strong>
                </div>
                <div className="tracking-meta">
                  <span>Review progress</span>
                  <strong>{tracking.ai_processing_status === 'manual_review' ? 'Pending staff review' : 'Recorded'}</strong>
                </div>
              </div>
            )}
            <div className="tracking-security">
              <span className="security-lock">⌑</span>
              <span><strong>Your case, kept private</strong><small>Your access code is required to retrieve status and attach documents.</small></span>
            </div>
          </aside>
        </div>
        <div className="citizen-disclaimer">
          <span>ⓘ</span>
          <p>This prototype is for assessment purposes and does not connect to actual government systems. Submitting a grievance does not guarantee a particular outcome.</p>
        </div>
      </main>
      <footer className="citizen-footer">
        <div className="container">
          <Brand compact />
          <span>© {new Date().getFullYear()} Creditfix · Prototype service</span>
        </div>
      </footer>
    </div>
  );
}
