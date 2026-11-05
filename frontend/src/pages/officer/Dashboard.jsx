import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert';
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
      setResult((current) => ({ ...current, items: [] }));
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
    { key: 'SUBMITTED', eyebrow: 'NEW CASES', tone: 'sage', glyph: '◷' },
    { key: 'UNDER_REVIEW', eyebrow: 'NEEDS REVIEW', tone: 'blue', glyph: '⌕' },
    { key: 'IN_PROGRESS', eyebrow: 'IN PROGRESS', tone: 'amber', glyph: '↗' },
    { key: 'RESOLVED', eyebrow: 'RESOLVED', tone: 'green', glyph: '✓' },
  ];

  return (
    <div className="dashboard-page">
      <div className="page-heading-row">
        <div>
          <span className="eyebrow">OVERVIEW</span>
          <h1>Good morning, {greetingName(user)}</h1>
          <p>Here’s the latest view of public grievances in your workspace.</p>
        </div>
        <div className="date-chip"><span>◷</span> {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
      </div>

      <div className="stats-grid">
        {statCards.map((card) => (
          <article className="stat-card" key={card.key}>
            <div className={`stat-icon ${card.tone}`}>{card.glyph}</div>
            <div className="stat-card-copy">
              <span>{card.eyebrow}</span>
              <strong>{stats[card.key]?.total ?? '—'}</strong>
              <small>{stats[card.key]?.label || ''}</small>
            </div>
          </article>
        ))}
      </div>

      <section className="dashboard-panel">
        <div className="panel-title-row">
          <div>
            <span className="eyebrow">CASE MANAGEMENT</span>
            <h2>Grievance register</h2>
          </div>
          <span className="record-count">{result.total} {result.total === 1 ? 'record' : 'records'}</span>
        </div>
        <div className="filters-row">
          <label className="filter-control">
            <span>Status</span>
            <select className="form-select" name="status" value={filters.status} onChange={changeFilter}>
              <option value="">All statuses</option>
              {STATUSES.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
              <option value="REJECTED">Rejected</option>
            </select>
          </label>
          <label className="filter-control">
            <span>Priority</span>
            <select className="form-select" name="priority" value={filters.priority} onChange={changeFilter}>
              <option value="">All priorities</option>
              {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
            </select>
          </label>
          {!isOfficer && (
            <label className="filter-control">
              <span>Department</span>
              <select className="form-select" name="department" value={filters.department} onChange={changeFilter}>
                <option value="">All departments</option>
                {DEPARTMENTS.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
              </select>
            </label>
          )}
          {isOfficer && <div className="department-lock"><span>◈</span> {user?.department?.name || 'Assigned department'}</div>}
          {activeFilters > 0 && <button className="btn btn-link clear-filters" type="button" onClick={clearFilters}>Clear filters</button>}
          <button className="btn btn-outline-primary btn-sm refresh-button" type="button" onClick={loadData} disabled={loading}>
            <span className={loading ? 'refresh-glyph spin' : 'refresh-glyph'}>↻</span> Refresh
          </button>
        </div>

        <Alert>{error}</Alert>
        {loading ? (
          <div className="table-state"><span className="spinner-border spinner-border-sm" /> Loading grievances…</div>
        ) : result.items.length === 0 ? (
          <div className="table-state empty-state">
            <span className="empty-state-icon">⌕</span>
            <strong>{activeFilters ? 'No matching grievances' : 'No grievances yet'}</strong>
            <span>{activeFilters ? 'Try adjusting or clearing the filters.' : 'Submitted cases will appear here.'}</span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table grievance-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Citizen</th>
                  <th>Category</th>
                  <th>Department</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th><span className="visually-hidden">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((grievance) => {
                  const department = grievance.officer_approved?.department || grievance.recommended_department;
                  const priority = grievance.officer_approved?.priority || grievance.ai_suggestion?.suggested_priority;
                  const category = grievance.officer_approved?.category || grievance.ai_suggestion?.category || 'Pending review';
                  return (
                    <tr key={grievance.reference_id}>
                      <td><Link className="reference-link" to={`/dashboard/grievances/${grievance.reference_id}`}>{grievance.reference_id}</Link></td>
                      <td><span className="citizen-name">{grievance.citizen_details.full_name}</span></td>
                      <td>{category}</td>
                      <td>{department?.name || <span className="text-muted">Unassigned</span>}</td>
                      <td>{priority ? <span className={`priority-label priority-${priority}`}>{priority}</span> : <span className="text-muted">—</span>}</td>
                      <td><StatusBadge status={grievance.status} /></td>
                      <td>{new Date(grievance.created_at).toLocaleDateString()}</td>
                      <td><Link className="table-open" to={`/dashboard/grievances/${grievance.reference_id}`} aria-label={`Open ${grievance.reference_id}`}>→</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {result.pages > 1 && (
          <div className="pagination-row">
            <span>Page {page} of {result.pages}</span>
            <div>
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Previous</button>
              <button className="btn btn-outline-secondary btn-sm" type="button" disabled={page >= result.pages || loading} onClick={() => setPage((current) => current + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>
      <div className="dashboard-footnote">AI-generated suggestions are advisory only. Authorized staff retain responsibility for all case decisions.</div>
    </div>
  );
}
