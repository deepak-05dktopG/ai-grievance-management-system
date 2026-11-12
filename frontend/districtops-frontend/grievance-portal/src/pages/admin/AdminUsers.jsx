// Administrator account creation form; run from frontend with `npm run dev`.

import { useState } from 'react';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
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
    // Send only the fields required for the selected role and surface API errors.
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
          <h1>Account access</h1>
          <p>Create a staff account and assign officers to their authorized department.</p>
        </div>
        <span className="admin-role-chip"><Icon name="lock" size={15} /> Administrator only</span>
      </div>
      <div className="admin-users-grid">
        <section className="dashboard-panel detail-panel" aria-labelledby="create-user-title">
          <div className="panel-title-row">
            <div className="panel-title-icon"><span className="section-icon"><Icon name="user" /></span><div><span className="eyebrow">NEW ACCOUNT</span><h2 id="create-user-title">Create staff account</h2></div></div>
          </div>
          <p className="panel-intro">Set the account role and department carefully. Passwords are securely hashed and are not returned by the API.</p>
          <Alert>{error}</Alert>
          {notice && <Alert variant="success" onDismiss={() => setNotice('')}><span role="status">{notice}</span></Alert>}
          <form className="portal-form user-create-form" onSubmit={handleSubmit} aria-busy={saving}>
            <label className="form-label-wrap">
              <span>Full name <b aria-hidden="true">*</b></span>
              <input className="form-control" name="name" value={form.name} onChange={updateField} required maxLength={120} />
            </label>
            <label className="form-label-wrap">
              <span>Email address <b aria-hidden="true">*</b></span>
              <input className="form-control" type="email" name="email" value={form.email} onChange={updateField} required maxLength={254} />
            </label>
            <label className="form-label-wrap">
              <span>Initial password <b aria-hidden="true">*</b></span>
              <input className="form-control" type="password" name="password" value={form.password} onChange={updateField} minLength={12} maxLength={128} required autoComplete="new-password" />
              <small className="field-note">Use 12–128 characters. Share it with the account holder through a secure channel.</small>
            </label>
            <label className="form-label-wrap">
              <span>Account role <b aria-hidden="true">*</b></span>
              <select className="form-select" name="role" value={form.role} onChange={updateField}>
                <option value="OFFICER">Officer</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>
            {form.role === 'OFFICER' && (
              <label className="form-label-wrap">
              <span>Assigned department <b aria-hidden="true">*</b></span>
                <select className="form-select" name="departmentCode" value={form.departmentCode} onChange={updateField} required>
                  {DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
                </select>
              </label>
            )}
            <button type="submit" className="btn btn-primary create-account-button" disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm" />Creating account…</> : <><Icon name="plus" size={18} /> Create account</>}
            </button>
          </form>
        </section>
        <section className="dashboard-panel detail-panel" aria-labelledby="roles-title">
          <div className="panel-title-row">
            <div className="panel-title-icon"><span className="section-icon"><Icon name="shield" /></span><div><span className="eyebrow">ACCESS MODEL</span><h2 id="roles-title">Roles and scope</h2></div></div>
          </div>
          <div className="role-info-card">
            <span className="role-info-icon admin-icon"><Icon name="shield" size={18} /></span>
            <div><strong>Administrator</strong><p>Access across the grievance register, case review, status controls, and account creation.</p></div>
          </div>
          <div className="role-info-card">
            <span className="role-info-icon officer-icon"><Icon name="user" size={18} /></span>
            <div><strong>Officer</strong><p>Grievance access and case actions are limited by the assigned department.</p></div>
          </div>
          <div className="admin-list-heading">
            <div><span className="eyebrow">RECENTLY CREATED</span><p>Accounts created during this browser session</p></div>
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
