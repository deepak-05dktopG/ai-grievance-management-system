import { useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Icon } from './components/Primitives';
import { navigation, roles } from './data/seed';
import { useOperations } from './context/OperationsContext';
import { ModulePage } from './pages/Modules';

const titles = Object.fromEntries(navigation.flatMap((section) => section.items.map((item) => [item.id, item.label])));

function LoginPage() {
  const { setUser, data } = useOperations();
  const navigate = useNavigate();
  const [role, setRole] = useState(roles[0]);
  const [department, setDepartment] = useState('District Administration');

  const login = (event) => {
    event.preventDefault();
    const user = data.users.find((item) => item.role === role) || { name: role === roles[0] ? 'R. Mehta' : role === roles[1] ? 'S. Iyer' : 'A. Sharma', role, department };
    setUser({ ...user, department });
    navigate('/app/dashboard');
  };

  return (
    <main className="login-screen">
      <div className="login-left">
        <div className="brand-lockup"><div className="brand-symbol">D</div><div><strong>DistrictOps <span>AI</span></strong><small>District administration operations</small></div></div>
        <div className="login-copy"><div className="eyebrow">DISTRICT OPERATIONS WORKSPACE</div><h1>One view of the work that moves a district forward.</h1><p>Coordinate instructions, departments, field updates and decisions in a single, practical workspace.</p><div className="login-footnote"><span className="demo-indicator" />Synthetic demonstration environment · No government integration</div></div>
      </div>
      <div className="login-right">
        <form className="login-card" onSubmit={login}>
          <div className="eyebrow">DEMO ACCESS</div><h2>Enter the workspace</h2><p>Select a role to explore the role-aware prototype.</p>
          <label className="field"><span>Demo role</span><select value={role} onChange={(event) => setRole(event.target.value)}>{roles.map((item) => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Department context</span><select value={department} onChange={(event) => setDepartment(event.target.value)}><option>District Administration</option>{['Revenue', 'Public Works', 'Health', 'Education', 'Civil Supplies', 'Rural Development', 'Agriculture', 'Irrigation', 'Municipal Administration'].map((item) => <option key={item}>{item}</option>)}</select></label>
          <button className="button button-primary button-full" type="submit">Continue to demo <Icon name="arrow" size={17} /></button>
          <div className="login-security"><Icon name="file" size={15} /><span>This role selector simulates access only. It does not provide backend authentication or security enforcement.</span></div>
        </form>
      </div>
    </main>
  );
}

const roleModules = {
  'District Collector / DM': null,
  'Additional District Magistrate': null,
  'Department Head': new Set(['dashboard', 'tasks', 'coordination', 'meetings', 'files', 'field', 'documents', 'knowledge', 'assistant', 'voice', 'notifications', 'audit', 'reports']),
  'Section Officer / Clerk': new Set(['dashboard', 'tasks', 'meetings', 'files', 'documents', 'knowledge', 'assistant', 'notifications', 'audit']),
  'Field Officer': new Set(['dashboard', 'tasks', 'coordination', 'field', 'assistant', 'notifications']),
  'IT / Administrator': null,
};

function AppLayout() {
  const { user, setUser, data } = useOperations();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState('');
  const active = location.pathname.split('/')[2] || 'dashboard';
  const modules = roleModules[user?.role];
  const filteredSections = navigation.map((section) => ({
    ...section,
    items: section.items.filter((item) => (!modules || modules.has(item.id)) && item.label.toLowerCase().includes(search.toLowerCase())),
  })).filter((section) => section.items.length);
  const unread = data.notifications.filter((item) => !item.read).length;

  const openItem = (id) => {
    navigate(`/app/${id}`);
    setSidebarOpen(false);
    setSearch('');
  };

  if (!user) return <Navigate to="/login" replace />;
  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <button className="sidebar-brand" onClick={() => openItem('dashboard')} aria-label="DistrictOps dashboard"><span className="brand-symbol">D</span><span className="brand-text"><strong>DistrictOps <em>AI</em></strong><small>OPERATIONS PLATFORM</small></span></button>
        <div className="sidebar-environment"><span className="demo-indicator" /> DEMO ENVIRONMENT</div>
        <label className="sidebar-search"><Icon name="search" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a workspace" aria-label="Find a workspace" /></label>
        <nav className="side-nav" aria-label="Main navigation">
          {filteredSections.map((section) => <div className="nav-section" key={section.section}><div className="nav-section-title">{section.section}</div>{section.items.map((item) => <button key={item.id} className={`nav-item ${active === item.id ? 'nav-active' : ''}`} onClick={() => openItem(item.id)}><span className="nav-mark">{item.mark}</span><span>{item.label}</span>{item.id === 'notifications' && unread > 0 && <span className="nav-count">{unread}</span>}</button>)}</div>)}
          {!filteredSections.length && <div className="nav-empty">No workspace found</div>}
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note">AI suggestions are drafts. Official decisions remain with authorized officers.</div><div className="sidebar-version">DISTRICTOPS PROTOTYPE <span>v0.1</span></div></div>
      </aside>
      {sidebarOpen && <button className="sidebar-shade" onClick={() => setSidebarOpen(false)} aria-label="Close navigation" />}
      <div className="main-column">
        <header className="topbar">
          <button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open navigation"><Icon name="menu" /></button>
          <div className="breadcrumb"><span>District administration</span><b>/</b><strong>{titles[active] || 'Workspace'}</strong></div>
          <div className="topbar-right">
            <label className="department-select"><span>Department</span><select aria-label="Department context" value={user.department || 'District Administration'} onChange={(event) => setUser({ ...user, department: event.target.value })}><option>District Administration</option>{['Revenue', 'Public Works', 'Health', 'Education', 'Civil Supplies', 'Rural Development', 'Agriculture', 'Irrigation', 'Municipal Administration'].map((item) => <option key={item}>{item}</option>)}</select></label>
            <button className="icon-button notification-button" aria-label={`${unread} unread notifications`} onClick={() => navigate('/app/notifications')}><Icon name="bell" />{unread > 0 && <span className="notification-dot" />}</button>
            <div className="profile-menu"><div className="avatar">{(user.name || 'DM').split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div className="profile-copy"><strong>{user.name}</strong><span>{user.role}</span></div><button className="profile-logout" onClick={() => { setUser(null); navigate('/login'); }}>Exit</button></div>
          </div>
        </header>
        <main className="workspace"><Routes><Route index element={<Navigate to="dashboard" replace />} /><Route path=":module" element={<WorkspaceRoute />} /><Route path="*" element={<Navigate to="dashboard" replace />} /></Routes></main>
        <footer className="app-footer"><span>DistrictOps AI · illustrative prototype</span><span>All operational records shown are synthetic</span></footer>
      </div>
    </div>
  );
}

function WorkspaceRoute() {
  const { module = 'dashboard' } = useParams();
  const { user } = useOperations();
  const available = roleModules[user?.role];
  const allowed = navigation.flatMap((section) => section.items).some((item) => item.id === module && (!available || available.has(module)));
  if (!allowed) return <Navigate to="/app/dashboard" replace />;
  return <ModulePage module={module} />;
}

export default function App() {
  return <Routes><Route path="/login" element={<LoginPage />} /><Route path="/app/*" element={<AppLayout />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
}
