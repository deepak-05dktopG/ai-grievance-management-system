import { useState } from 'react';
import Alert from '../../components/Alert';
import { authApi, getErrorMessage } from '../../services/api';

const DEPARTMENTS = [
  ['PWD', 'Public Works'],
  ['WSD', 'Water Supply'],
  ['SWM', 'Sanitation and Waste Management'],
  ['ED', 'Electricity'],
  ['HD', 'Public Health'],
  ['FCS', 'Food and Civil Supplies'],
  ['RD', 'Land and Revenue'],
];

function getUserCreationErrorMessage(error) {
  const detail = error.response?.data?.detail;
  if (Array.isArray(detail)) {
    const messages = detail
      .map((issue) => issue?.msg)
      .filter((message) => typeof message === 'string');
    return messages.length
      ? messages.join(' ')
      : 'The user details are invalid. Please check the form and try again.';
  }
  return getErrorMessage(error);
}

export default function AdminUsers() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'OFFICER',
    departmentCode: 'PWD',
  });
  const [createdUsers, setCreatedUsers] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const payload = {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        ...(form.role === 'OFFICER' && { department_code: form.departmentCode }),
      };
      const { data } = await authApi.createUser(payload);
      setCreatedUsers((current) => [data, ...current]);
      setNotice(`${data.role} account created for ${data.email}.`);
      setForm({ name: '', email: '', password: '', role: 'OFFICER', departmentCode: 'PWD' });
    } catch (createError) {
      setError(getUserCreationErrorMessage(createError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dashboard-page admin-users-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>User management</h1>
          <p>Create officer accounts and grant access to the appropriate department.</p>
        </div>
        <span className="admin-role-chip">ADMIN ONLY</span>
      </div>
      <div className="admin-users-grid">
        <section className="dashboard-panel detail-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">NEW ACCOUNT</span><h2>Create a user</h2></div>
          </div>
          <p className="panel-intro">Passwords are stored as Argon2 hashes and are never shown again after account creation.</p>
          <Alert>{error}</Alert>
          {notice && <Alert variant="success" onDismiss={() => setNotice('')}>{notice}</Alert>}
          <form className="portal-form user-create-form" onSubmit={handleSubmit}>
            <label className="form-label-wrap">
              <span>Full name</span>
              <input className="form-control" name="name" value={form.name} onChange={updateField} required maxLength={120} />
            </label>
            <label className="form-label-wrap">
              <span>Email address</span>
              <input className="form-control" type="email" name="email" value={form.email} onChange={updateField} required maxLength={254} />
            </label>
            <label className="form-label-wrap">
              <span>Temporary password</span>
              <input className="form-control" type="password" name="password" value={form.password} onChange={updateField} minLength={12} maxLength={128} required autoComplete="new-password" />
              <small className="field-note">At least 12 characters. Share it securely with the account holder.</small>
            </label>
            <label className="form-label-wrap">
              <span>Role</span>
              <select className="form-select" name="role" value={form.role} onChange={updateField}>
                <option value="OFFICER">Officer</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
            {form.role === 'OFFICER' && (
              <label className="form-label-wrap">
                <span>Department</span>
                <select className="form-select" name="departmentCode" value={form.departmentCode} onChange={updateField} required>
                  {DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
            )}
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </section>
        <section className="dashboard-panel detail-panel">
          <div className="panel-title-row">
            <div><span className="eyebrow">ACCESS MODEL</span><h2>Roles & permissions</h2></div>
          </div>
          <div className="role-info-card">
            <span className="role-info-icon admin-icon">A</span>
            <div><strong>Administrator</strong><p>Full grievance access, status and review controls, and user creation.</p></div>
          </div>
          <div className="role-info-card">
            <span className="role-info-icon officer-icon">O</span>
            <div><strong>Officer</strong><p>Grievance access and case actions are limited to the assigned department.</p></div>
          </div>
          <div className="admin-list-heading">
            <span className="eyebrow">CREATED THIS SESSION</span>
            <span>{createdUsers.length}</span>
          </div>
          {createdUsers.length ? (
            <div className="created-users-list">
              {createdUsers.map((created) => (
                <div className="created-user-row" key={created.id}>
                  <div className="avatar">{created.name.slice(0, 1).toUpperCase()}</div>
                  <div><strong>{created.name}</strong><small>{created.email}</small></div>
                  <span className="role-pill">{created.role}</span>
                  {created.department && <small className="created-user-department">{created.department.name}</small>}
                </div>
              ))}
            </div>
          ) : <div className="inline-empty">New accounts created here appear in this session list. The API does not provide a user-list endpoint.</div>}
        </section>
      </div>
    </div>
  );
}
