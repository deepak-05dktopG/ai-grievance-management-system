// Staff login page; run from frontend with `npm run dev`.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import Brand from '../../components/Brand';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(
    new URLSearchParams(location.search).has('expired')
      ? 'Your session expired. Please sign in again.'
      : '',
  );
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event) {
    // Authenticate through the shared context, then open the protected dashboard.
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard', { replace: true });
    } catch (loginError) {
      setError(
        loginError.response?.status === 401
          ? 'The email or password was not recognized.'
          : loginError.response?.data?.detail || 'Unable to sign in right now.',
      );
    } finally {
      setLoading(false);
      setPassword('');
    }
  }

  return (
    <main className="login-page">
      <section className="login-left" aria-label="Portal information">
        <Link to="/" className="login-brand"><Brand /></Link>
        <div className="login-presentation">
          <span className="eyebrow">STAFF ACCESS</span>
          <h1>Public service.<br />Clear casework.</h1>
          <p>Review submitted grievances, record decisions, and keep case progress visible to the people who raised the concern.</p>
          <div className="login-feature-list">
            <div><Icon name="clipboard" /><span><strong>One case record</strong><small>Review the submission and its attachments.</small></span></div>
            <div><Icon name="activity" /><span><strong>Traceable decisions</strong><small>Updates are recorded in the case history.</small></span></div>
            <div><Icon name="users" /><span><strong>Role-based access</strong><small>Officers see cases assigned to their department.</small></span></div>
          </div>
        </div>
        <span className="login-footnote">Tamil Nadu · Grievance management prototype</span>
      </section>
      <section className="login-right" aria-labelledby="login-title">
        <Link to="/" className="mobile-login-brand"><Brand compact /></Link>
        <div className="login-form-wrap">
          <div className="login-icon"><Icon name="lock" size={22} /></div>
          <span className="eyebrow">SECURE STAFF WORKSPACE</span>
          <h1 id="login-title">Sign in</h1>
          <p className="muted-copy">Use the email address and password issued for your account.</p>
          <form onSubmit={handleSubmit} className="portal-form login-form">
            <Alert>{error}</Alert>
            <label className="form-label-wrap">
              <span>Email address <b aria-hidden="true">*</b></span>
              <input
                className="form-control"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                placeholder="name@example.com"
              />
            </label>
            <label className="form-label-wrap">
              <span>Password <b aria-hidden="true">*</b></span>
              <span className="password-field">
                <input
                  className="form-control"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  maxLength={128}
                  placeholder="Enter your password"
                  aria-label="Password"
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={19} />
                </button>
              </span>
            </label>
            <button type="submit" className="btn btn-primary w-100 login-submit" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2" />Signing in…</> : <>Sign in <Icon name="arrowRight" size={18} /></>}
            </button>
          </form>
          <div className="login-security-note">
            <Icon name="lock" size={16} />
            <span>Your session ends when this browser session closes.</span>
          </div>
          <Link className="back-to-public" to="/"><Icon name="arrowLeft" size={16} /> Return to the public portal</Link>
        </div>
        <span className="login-right-foot">Demonstration environment · synthetic data only</span>
      </section>
    </main>
  );
}
