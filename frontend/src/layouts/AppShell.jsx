import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Brand from '../components/Brand';

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <NavLink to="/dashboard" className="sidebar-brand">
          <Brand />
        </NavLink>
        <div className="sidebar-section-label">Workspace</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          <NavLink to="/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-glyph">▦</span>
            <span>Overview</span>
          </NavLink>
          {user?.role === 'ADMIN' && (
            <NavLink to="/dashboard/users" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-glyph">♙</span>
              <span>User management</span>
            </NavLink>
          )}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-footer-icon">i</div>
          <div>
            <strong>Prototype workspace</strong>
            <span>For assessment use</span>
          </div>
        </div>
      </aside>

      <div className="dashboard-main">
        <header className="topbar">
          <div className="topbar-context">
            <span className="topbar-kicker">District administration</span>
            <span className="topbar-divider">/</span>
            <span className="topbar-role">{user?.role === 'ADMIN' ? 'Administrator' : 'Officer'} portal</span>
          </div>
          <div className="topbar-user">
            <div className="avatar">{user?.name?.slice(0, 1)?.toUpperCase() || 'U'}</div>
            <div className="user-copy">
              <strong>{user?.name}</strong>
              <span>{user?.department?.name || 'Administration'}</span>
            </div>
            <button type="button" className="btn btn-quiet btn-sm" onClick={handleLogout}>
              Sign out
            </button>
          </div>
        </header>
        <main className="dashboard-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
