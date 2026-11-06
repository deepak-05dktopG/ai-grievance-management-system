// Authenticated dashboard shell and navigation; run from frontend with `npm run dev`.

import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';
import Icon from '../components/Icon';

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    // Clear the browser session token before returning to staff login.
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="sidebar-brand">
          <Brand />
        </NavLink>
        <p className="sidebar-section-label">Case workspace</p>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon name="grid" className="nav-glyph" />
            <span>Overview</span>
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/dashboard/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <Icon name="users" className="nav-glyph" />
              <span>User management</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-icon"><Icon name="shield" size={17} /></div>
          <div>
            <strong>Demonstration environment</strong>
            <span>Prototype · synthetic data</span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="topbar">
          <div className="topbar-context">
            <NavLink to="/dashboard" className="mobile-brand" aria-label="Creditfix workspace home">
              <Brand compact />
            </NavLink>
            <span className="topbar-kicker">Grievance management</span>
            <span className="topbar-divider" aria-hidden="true">/</span>
            <span className="topbar-role">{user?.role === 'ADMIN' ? 'Administrator' : 'Officer'} workspace</span>
          </div>
          <div className="topbar-user">
            <div className="avatar">{user?.name?.slice(0, 1)?.toUpperCase() || 'U'}</div>
            <div className="user-copy">
              <strong>{user?.name}</strong>
              <span>{user?.department?.name || 'Administration'}</span>
            </div>
            <button type="button" className="btn btn-quiet btn-sm sign-out-button" onClick={handleLogout}>
              <Icon name="logout" size={17} />
              <span>Sign out</span>
            </button>
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile main navigation">
          <NavLink to="/dashboard" end className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
            <Icon name="grid" size={19} />
            <span>Overview</span>
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/dashboard/users" className={({ isActive }) => `mobile-nav-link ${isActive ? 'active' : ''}`}>
              <Icon name="users" size={19} />
              <span>Accounts</span>
            </NavLink>
          )}
        </nav>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
