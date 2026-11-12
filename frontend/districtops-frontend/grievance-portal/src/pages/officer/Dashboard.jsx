// Officer/admin grievance dashboard; run from frontend with `npm run dev`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
import Icon from '../../components/Icon';
import StatusBadge from '../../components/StatusBadge';
import { useAuth } from '../../context/AuthContext';
import { getErrorMessage, grievanceApi } from '../../services/api';

const STATUSES = [
  ['SUBMITTED', 'Submitted'],
  ['UNDER_REVIEW', 'Under review'],
  ['IN_PROGRESS', 'In progress'],
  ['RESOLVED', 'Resolved'],
  ['CLOSED', 'Closed'],
];

const DEPARTMENTS = [
  ['PWD', 'Public Works'],
  ['WSD', 'Water Supply'],
  ['SWM', 'Sanitation & Waste'],
  ['ED', 'Electricity'],
  ['HD', 'Public Health'],
  ['FCS', 'Food & Civil Supplies'],
  ['RD', 'Revenue'],
];

const PRIORITIES = ['low', 'medium', 'high', 'critical'];

function greetingName(user) {
  return user?.name?.trim().split(/\s+/)[0] || 'there';
}

function displayDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Dashboard() {
  const { user } = useAuth();
  const [filters, setFilters] = useState({ status: '', priority: '', department: '' });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState({ items: [], total: 0, pages: 0, page_size: 20 });
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isOfficer = user?.role === 'OFFICER';
  const activeFilters = useMemo(
    () => Object.values(filters).filter(Boolean).length,
    [filters],
  );

  const loadData = useCallback(async () => {
    // Load the current page and status totals using the user's department scope.
    setLoading(true);
    setError('');
    const department = isOfficer ? user?.department?.code : filters.department;
    const params = {
      page,
      page_size: 20,
      ...(filters.status && { status: filters.status }),
      ...(filters.priority && { priority: filters.priority }),
      ...(department && { department }),
    };
    try {
      const [listResponse, ...statResponses] = await Promise.all([
        grievanceApi.list(params),
        ...STATUSES.map(([status]) =>
          grievanceApi.list({
            page: 1,
            page_size: 1,
            status,
            ...(department && { department }),
          }),
        ),
      ]);
      setResult(listResponse.data);
      setStats(
        Object.fromEntries(
          STATUSES.map(([status, label], index) => [
            status,
            { label, total: statResponses[index].data.total },
          ]),
        ),
      );
    } catch (loadError) {
      setError(getErrorMessage(loadError));
      setResult({ items: [], total: 0, pages: 0, page_size: 20 });
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [filters, isOfficer, page, user?.department?.code]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function changeFilter(event) {
    setPage(1);
    setFilters((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  function clearFilters() {
    setPage(1);
    setFilters({ status: '', priority: '', department: '' });
  }

  const statCards = [
    { key: 'SUBMITTED', eyebrow: 'NEW SUBMISSIONS', tone: 'sage', icon: 'file' },
    { key: 'UNDER_REVIEW', eyebrow: 'UNDER REVIEW', tone: 'blue', icon: 'search' },
    { key: 'IN_PROGRESS', eyebrow: 'IN PROGRESS', tone: 'amber', icon: 'activity' },
    { key: 'RESOLVED', eyebrow: 'RESOLVED', tone: 'green', icon: 'check' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">CASE WORKSPACE</span>
          <h1>Good day, {greetingName(user)}</h1>
          <p>Review and manage grievances{user?.department?.name ? ` for ${user.department.name}` : ' across the service'}.</p>
        </div>
        <div className="date-chip"><Icon name="clock" size={17} /> {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      </div>

      <section className="stats-grid" aria-label="Grievance status totals">
        {statCards.map((card) => (
          <article className="stat-card" key={card.key}>
            <div className={`stat-icon ${card.tone}`}><Icon name={card.icon} size={19} /></div>
            <div className="stat-card-copy">
              <span>{card.eyebrow}</span>
              <strong>{stats[card.key]?.total ?? '—'}</strong>
              <small>Cases in this status</small>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-panel register-panel" aria-labelledby="register-title">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">CASE REGISTER</span>
            <h2 id="register-title">Grievances</h2>
            <p className="panel-subtitle">Filter the cases available to your account. Results are ordered by submission date.</p>
          </div>
          <span className="record-count">{result.total} {result.total === 1 ? 'case' : 'cases'}</span>
        </div>
        <div className="filters-row">
          <label className="filter-control">
            <span>Filter by status</span>
            <select className="form-select" name="status" value={filters.status} onChange={changeFilter}>
              <option value="">All statuses</option>
              {STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="filter-control">
            <span>Filter by priority</span>
            <select className="form-select" name="priority" value={filters.priority} onChange={changeFilter}>
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
            </select>
          </label>
          {!isOfficer && (
            <label className="filter-control">
              <span>Filter by department</span>
              <select className="form-select" name="department" value={filters.department} onChange={changeFilter}>
                <option value="">All departments</option>
                {DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
          )}
          {isOfficer && <div className="department-lock"><Icon name="lock" size={16} /> {user?.department?.name || 'Assigned department'}</div>}
          {activeFilters > 0 && <button className="btn btn-link clear-filters" type="button" onClick={clearFilters}>Clear filters ({activeFilters})</button>}
          <button className="btn btn-outline-primary btn-sm refresh-button" type="button" onClick={loadData} disabled={loading}>
            <Icon name="refresh" className={loading ? 'spin' : ''} size={16} /> Refresh
          </button>
        </div>

        <Alert>{error}</Alert>
        {error && !loading && (
          <div className="dashboard-retry-row">
            <span>Unable to load current case data.</span>
            <button type="button" className="btn btn-outline-primary btn-sm" onClick={loadData}>Try again</button>
          </div>
        )}
        {loading ? (
          <div className="table-state" role="status"><span className="spinner-border spinner-border-sm" /> Loading grievance register…</div>
        ) : result.items.length === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-state-icon"><Icon name="clipboard" size={22} /></span>
            <strong>{activeFilters ? 'No cases match these filters' : 'No grievances to display'}</strong>
            <span>{activeFilters ? 'Change or clear a filter to see other cases.' : 'New submissions will appear here when available.'}</span>
          </div>
        ) : (
          <>
          <div className="table-responsive desktop-register">
            <table className="table grievance-table">
              <thead>
                <tr>
                  <th>Reference ID</th>
                  <th>Concern</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th><span className="visually-hidden">Case actions</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((grievance) => {
                  const department = grievance.officer_approved?.department || grievance.recommended_department;
                  const priority = grievance.officer_approved?.priority || grievance.ai_suggestion?.suggested_priority;
                  const category = grievance.officer_approved?.category || grievance.ai_suggestion?.category || 'Pending review';
                  const description = grievance.ai_suggestion?.summary || grievance.complaint_description;
                  return (
                    <tr key={grievance.reference_id}>
                      <td><Link className="reference-link" to={`/dashboard/grievances/${grievance.reference_id}`}>{grievance.reference_id}</Link></td>
                      <td><span className="concern-excerpt">{description}</span></td>
                      <td>{category}</td>
                      <td>{department?.name || <span className="text-muted">Unassigned</span>}</td>
                      <td>{priority ? <span className={`priority-label priority-${priority}`}>{priority}</span> : <span className="text-muted">—</span>}</td>
                      <td><StatusBadge status={grievance.status} /></td>
                      <td>{displayDate(grievance.created_at)}</td>
                      <td><Link className="table-open" to={`/dashboard/grievances/${grievance.reference_id}`} aria-label={`Open case ${grievance.reference_id}`}><Icon name="arrowUpRight" size={17} /></Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mobile-register" aria-label="Grievances">
            {result.items.map((grievance) => {
              const department = grievance.officer_approved?.department || grievance.recommended_department;
              const priority = grievance.officer_approved?.priority || grievance.ai_suggestion?.suggested_priority;
              const category = grievance.officer_approved?.category || grievance.ai_suggestion?.category || 'Pending review';
              const description = grievance.ai_suggestion?.summary || grievance.complaint_description;
              return (
                <article className="mobile-case-card" key={grievance.reference_id}>
                  <div className="mobile-case-topline"><Link className="reference-link" to={`/dashboard/grievances/${grievance.reference_id}`}>{grievance.reference_id}</Link><StatusBadge status={grievance.status} /></div>
                  <p>{description}</p>
                  <dl>
                    <div><dt>Category</dt><dd>{category}</dd></div>
                    <div><dt>Department</dt><dd>{department?.name || 'Unassigned'}</dd></div>
                    <div><dt>Priority</dt><dd>{priority ? <span className={`priority-label priority-${priority}`}>{priority}</span> : '—'}</dd></div>
                    <div><dt>Submitted</dt><dd>{displayDate(grievance.created_at)}</dd></div>
                  </dl>
                  <Link className="mobile-case-open" to={`/dashboard/grievances/${grievance.reference_id}`}>View case <Icon name="arrowRight" size={16} /></Link>
                </article>
              );
            })}
          </div>
          </>
        )}
        {result.pages > 1 && (
          <div className="pagination-row">
            <span>Page {page} of {result.pages}</span>
            <div>
              <button className="btn btn-outline-primary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}><Icon name="arrowLeft" size={15} /> Previous</button>
              <button className="btn btn-outline-primary btn-sm" type="button" disabled={page >= result.pages || loading} onClick={() => setPage((current) => current + 1)}>Next <Icon name="arrowRight" size={15} /></button>
            </div>
          </div>
        )}
      </section>
      <div className="dashboard-footnote"><Icon name="shield" size={15} /> AI-generated suggestions are advisory. Authorized staff retain responsibility for all case decisions.</div>
    </div>
  );
}
