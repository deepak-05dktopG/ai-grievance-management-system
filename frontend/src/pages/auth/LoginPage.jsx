// Staff login page; run from frontend with `npm run dev`.

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert';
import Brand from '../../components/Brand';
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
      <div className="login-left">
        <Link to="/" className="login-brand"><Brand /></Link>
        <div className="login-presentation">
          <span className="eyebrow">STAFF WORKSPACE</span>
          <h1>Better service<br />starts with <em>listening.</em></h1>
          <p>A shared workspace for reviewing public grievances, coordinating response, and keeping a clear record of every decision.</p>
          <div className="login-decoration">
            <div className="login-line line-one" />
            <div className="login-line line-two" />
            <div className="login-orbit"><span /><span /><span /></div>
            <div className="login-orbit-core">C</div>
          </div>
        </div>
        <span className="login-footnote">Creditfix · District administration prototype</span>
      </div>
      <div className="login-right">
        <Link to="/" className="mobile-login-brand"><Brand compact /></Link>
        <div className="login-form-wrap">
          <div className="login-icon">↗</div>
          <span className="eyebrow">SECURE STAFF ACCESS</span>
          <h2>Welcome back</h2>
          <p className="muted-copy">Sign in with your administrator or officer account.</p>
          <form onSubmit={handleSubmit} className="portal-form login-form">
            <Alert>{error}</Alert>
            <label className="form-label-wrap">
              <span>Email address</span>
              <input
                className="form-control"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                placeholder="name@department.gov"
              />
            </label>
            <label className="form-label-wrap">
              <span>Password</span>
              <input
                className="form-control"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                maxLength={128}
                placeholder="Enter your password"
              />
            </label>
            <button type="submit" className="btn btn-primary w-100 login-submit" disabled={loading}>
              {loading ? <><span className="spinner-border spinner-border-sm me-2" />Signing in…</> : 'Sign in'}
            </button>
          </form>
          <div className="login-security-note">
            <span>⌑</span> Your session is stored only for this browser session.
          </div>
          <Link className="back-to-public" to="/">← Return to citizen portal</Link>
        </div>
        <span className="login-right-foot">Prototype service · Do not use for real government cases</span>
      </div>
    </main>
  );
}
