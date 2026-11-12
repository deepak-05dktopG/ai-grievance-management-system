import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { departments, roles } from '../data/seed';
import { useOperations } from '../context/OperationsContext';
import { AIDisclosure, DataTable, Field, Icon, Metric, Modal, PageHeader, Panel, Status, useDemoAI } from '../components/Primitives';

const today = '2026-11-11';
const priorities = ['Critical', 'High', 'Normal'];
const taskStatuses = ['Assigned', 'Acknowledgment Pending', 'Acknowledged', 'In Progress', 'Clarification Required', 'Under Review', 'Completed', 'Overdue'];

function dateLabel(date) {
  if (!date) return '—';
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function DownloadButton({ label = 'Export report', rows = [] }) {
  const download = () => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'districtops-demo-export.csv';
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };
  return <button className="button button-secondary" onClick={download}><Icon name="download" size={16} />{label}</button>;
}

function AIBox({ title, children, action, loading, complete, output, onOutputChange }) {
  return (
    <Panel className="ai-panel" title={<span className="ai-panel-title"><Icon name="spark" size={17} />{title}</span>}>
      <AIDisclosure />
      {children}
      {loading && <div className="ai-loading"><span className="spinner-border spinner-border-sm" /> Reviewing the illustrative records…</div>}
      {complete && <div className="ai-result"><div className="ai-result-label"><span>GENERATED DRAFT</span><span>Review before use</span></div><textarea className="text-area ai-output" value={output} onChange={(event) => onOutputChange?.(event.target.value)} aria-label={`${title} draft`} />{action}</div>}
    </Panel>
  );
}

function DashboardPage() {
  const { data, createTask } = useOperations();
  const navigate = useNavigate();
  const [briefing, setBriefing] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const { loading, complete, run } = useDemoAI();
  const active = data.tasks.filter((item) => item.status !== 'Completed');
  const overdue = active.filter((item) => item.status === 'Overdue' || item.due < today);
  const pending = active.filter((item) => item.status === 'Acknowledgment Pending');
  const inProgress = active.filter((item) => item.status === 'In Progress');
  const completed = data.tasks.filter((item) => item.status === 'Completed').length;
  const depts = departments.map((name) => {
    const list = data.tasks.filter((item) => item.department === name);
    const done = list.filter((item) => item.status === 'Completed').length;
    return { name, total: list.length, done, percent: list.length ? Math.round((done / list.length) * 100) : 0 };
  }).filter((item) => item.total).sort((a, b) => a.percent - b.percent);
  const attention = data.tasks.filter((item) => item.status === 'Overdue' || item.due < today || item.status === 'Acknowledgment Pending' || item.status === 'Clarification Required').slice(0, 5);
  const generate = () => run(() => setBriefing(
    `District operations briefing · 11 November 2026\n\n${overdue.length} task${overdue.length === 1 ? '' : 's'} are overdue or past their target date; ${pending.length} acknowledgment${pending.length === 1 ? '' : 's'} remain pending. ${inProgress.length} task${inProgress.length === 1 ? '' : 's'} are currently in progress. ${data.tasks.filter((item) => item.status === 'Clarification Required').map((item) => `${item.department} needs clarification on “${item.title}”`).join('. ') || 'No clarification requests are currently recorded.'}\n\nPriority follow-up: confirm the Ward 6 drainage blocker, request an updated school repair estimate, and verify the drinking-water repair before the next review. These observations are derived from the synthetic task register and should be checked by an officer.`,
  ));
  return (
    <>
      <PageHeader eyebrow="DISTRICT OPERATIONS · WEDNESDAY, 11 NOVEMBER 2026" title="Collector dashboard" description="A current view of instructions, departmental progress and matters needing district-level attention." actions={<button className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> New instruction</button>} />
      <div className="metrics-grid">
        <Metric label="Active tasks" value={active.length} note="Across all departments" />
        <Metric label="Acknowledgment pending" value={pending.length} note="Awaiting department response" tone="amber" />
        <Metric label="In progress" value={inProgress.length} note="Updates recorded in the register" tone="blue" />
        <Metric label="Completed" value={completed} note="Recorded as complete" tone="green" />
        <Metric label="Overdue / at risk" value={overdue.length} note="Past due or requiring follow-up" tone="red" />
      </div>
      <div className="dashboard-grid">
        <Panel title="Department progress" description="Completion is calculated from the shared synthetic task register." className="span-two">
          <div className="department-progress">{depts.map((department) => <div className="progress-row" key={department.name}><div className="progress-name"><strong>{department.name}</strong><span>{department.done}/{department.total} complete</span></div><div className="progress-track"><span style={{ width: `${department.percent}%` }} /></div><b>{department.percent}%</b></div>)}</div>
        </Panel>
        <Panel title="Requires attention" description="Items with a deadline, acknowledgment or clarification concern." action={<button className="text-button" onClick={() => navigate('/app/tasks')}>View all <Icon name="arrow" size={14} /></button>}>
          <div className="attention-list">{attention.map((task) => <div className="attention-item" key={task.id}><span className={`attention-mark ${task.status === 'Overdue' || task.due < today ? 'mark-red' : 'mark-amber'}`} /><div><strong>{task.title}</strong><span>{task.department} · {task.id}</span></div><Status>{task.status}</Status></div>)}{!attention.length && <div className="empty-inline">No task currently requires escalation.</div>}</div>
        </Panel>
        <Panel title="Upcoming deadlines" description="Next due dates across the district.">
          <div className="deadline-list">{[...active].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 4).map((task) => <div className="deadline-row" key={task.id}><div className="date-tile"><b>{new Date(`${task.due}T00:00:00`).getDate()}</b><span>{new Date(`${task.due}T00:00:00`).toLocaleDateString('en-IN', { month: 'short' })}</span></div><div><strong>{task.title}</strong><span>{task.department}</span></div><span className="deadline-date">{dateLabel(task.due)}</span></div>)}</div>
        </Panel>
        <Panel title="Recent instructions" description="Latest entries in the task register." className="span-two">
          <div className="recent-task-list">{data.tasks.slice(0, 4).map((task) => <div key={task.id}><div><span className="record-id">{task.id}</span><strong>{task.title}</strong><span>{task.department} · {task.owner}</span></div><Status>{task.status}</Status></div>)}</div>
        </Panel>
        <AIBox title="AI executive briefing" loading={loading} complete={complete} output={briefing} onOutputChange={setBriefing} action={<div className="ai-actions"><span>References: {attention.map((item) => item.id).join(', ') || 'Task register'}</span><button className="button button-secondary button-small" onClick={generate}>Regenerate</button></div>}>
          <p className="panel-copy">Create an editable draft from current deadlines, task status and departmental updates. Verify observations against source records.</p>
          {!complete && <button className="button button-primary button-small" onClick={generate} disabled={loading}>{loading ? 'Preparing draft…' : 'Generate briefing'} <Icon name="arrow" size={15} /></button>}
        </AIBox>
      </div>
      {createOpen && <TaskForm onClose={() => setCreateOpen(false)} onCreate={createTask} />}
    </>
  );
}

function TaskForm({ onClose, onCreate, initial = {} }) {
  const [form, setForm] = useState({ title: initial.title || '', department: initial.department || departments[0], owner: initial.owner || '', priority: initial.priority || 'Normal', due: initial.due || '', source: initial.source || '', summary: initial.summary || '', deliverables: initial.deliverables || '' });
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const [suggestion, setSuggestion] = useState('');
  const ai = useDemoAI();
  return <Modal title="Create administrative instruction" subtitle="Capture the assignment clearly. Department and deadline remain officer decisions." onClose={onClose} wide>
    <form className="form-grid" onSubmit={(event) => { event.preventDefault(); onCreate({ ...form, status: 'Assigned' }); onClose(); }}>
      <Field label="Instruction title"><input required value={form.title} onChange={set('title')} placeholder="e.g. Verify priority water points" /></Field>
      <Field label="Department"><select value={form.department} onChange={set('department')}>{departments.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Responsible officer"><input required value={form.owner} onChange={set('owner')} placeholder="Name or office" /></Field>
      <Field label="Priority"><select value={form.priority} onChange={set('priority')}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Due date"><input type="date" min={today} required value={form.due} onChange={set('due')} /></Field>
      <Field label="Source instruction / meeting"><input value={form.source} onChange={set('source')} placeholder="Reference or meeting name" /></Field>
      <Field label="Description" className="field-full"><textarea required rows="3" value={form.summary} onChange={set('summary')} placeholder="Describe the requested work and context" /></Field>
      <Field label="Required deliverables" className="field-full"><input value={form.deliverables} onChange={set('deliverables')} placeholder="What should the department submit?" /></Field>
      <div className="form-ai field-full"><AIDisclosure /><p>Optional task understanding preview from the entered instruction.</p><div className="inline-actions"><button type="button" className="button button-secondary button-small" disabled={ai.loading || !form.summary} onClick={() => ai.run(() => setSuggestion(`Suggested category: ${form.department} operations. Possible deliverable: ${form.deliverables || 'Not specified — confirm with the issuing officer.'} Priority remains ${form.priority}, as selected by the user.`))}>{ai.loading ? 'Reviewing…' : 'Review with AI'}</button>{suggestion && <div className="suggestion-box">{suggestion}<button type="button" className="text-button" onClick={() => setForm((current) => ({ ...current, deliverables: current.deliverables || 'To be confirmed by responsible department' }))}>Apply editable suggestion</button></div>}</div></div>
      <div className="form-actions field-full"><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary">Create assignment</button></div>
    </form>
  </Modal>;
}

function TasksPage() {
  const { data, createTask, updateTask } = useOperations();
  const [createOpen, setCreateOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('All departments');
  const [status, setStatus] = useState('All statuses');
  const [selected, setSelected] = useState(null);
  const rows = data.tasks.filter((item) => (department === 'All departments' || item.department === department) && (status === 'All statuses' || item.status === status) && `${item.title} ${item.id} ${item.owner}`.toLowerCase().includes(query.toLowerCase()));
  const task = data.tasks.find((item) => item.id === selected);
  return <>
    <PageHeader eyebrow="OPERATIONS · SHARED TASK REGISTER" title="Tasks & deadlines" description="Issue, assign and track district instructions with accountable owners and clear deliverables." actions={<button id="task-create-trigger" className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> New instruction</button>} />
    <div className="toolbar"><label className="search-field"><Icon name="search" size={17} /><input placeholder="Search title, reference or officer" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label="Filter by department" value={department} onChange={(event) => setDepartment(event.target.value)}><option>All departments</option>{departments.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}><option>All statuses</option>{taskStatuses.map((item) => <option key={item}>{item}</option>)}</select></div>
    <Panel title="District instruction register" description={`${rows.length} records · Shared with dashboard, reports and assistant.`}>
      <DataTable rows={rows} columns={[
        { key: 'id', label: 'Reference', render: (item) => <span className="record-id">{item.id}</span> },
        { key: 'title', label: 'Instruction', render: (item) => <button className="table-link" onClick={() => setSelected(item.id)}>{item.title}<small>{item.source}</small></button> },
        { key: 'department', label: 'Department', render: (item) => <><strong>{item.department}</strong><small>{item.owner}</small></> },
        { key: 'priority', label: 'Priority', render: (item) => <span className={`priority priority-${item.priority.toLowerCase()}`}>{item.priority}</span> },
        { key: 'due', label: 'Due date', render: (item) => <span className={item.due < today && item.status !== 'Completed' ? 'text-danger' : ''}>{dateLabel(item.due)}</span> },
        { key: 'status', label: 'Status', render: (item) => <Status>{item.status}</Status> },
        { key: 'action', label: 'Update', render: (item) => <select className="compact-select" value={item.status} aria-label={`Update status for ${item.id}`} onChange={(event) => updateTask(item.id, { status: event.target.value }, 'Task status changed')}><option>{item.status}</option>{taskStatuses.filter((option) => option !== item.status).map((option) => <option key={option}>{option}</option>)}</select> },
      ]} />
    </Panel>
    {task && <Modal title={task.title} subtitle={`${task.id} · ${task.department} · ${task.owner}`} onClose={() => setSelected(null)} wide>
      <div className="task-detail"><div className="task-detail-main"><div className="detail-pills"><Status>{task.status}</Status><span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority} priority</span></div><p>{task.summary}</p><div className="detail-grid"><div><span>Source</span><strong>{task.source || 'Not recorded'}</strong></div><div><span>Due date</span><strong>{dateLabel(task.due)}</strong></div><div><span>Required deliverables</span><strong>{task.deliverables || 'Not specified'}</strong></div><div><span>Last update</span><strong>{task.updated}</strong></div></div><label className="field"><span>Progress update</span><textarea rows="3" placeholder="Add a short, attributable progress note" id="progress-note" /></label><button className="button button-primary button-small" onClick={() => { const note = document.getElementById('progress-note').value; updateTask(task.id, { summary: note ? `${task.summary} Progress update: ${note}` : task.summary, status: 'In Progress' }, 'Progress update recorded'); setSelected(null); }}>Record update</button></div><aside className="task-detail-side"><strong>Available actions</strong><button className="button button-secondary button-small" onClick={() => { updateTask(task.id, { status: 'Acknowledged' }, 'Task acknowledged'); setSelected(null); }}>Acknowledge assignment</button><button className="button button-secondary button-small" onClick={() => { updateTask(task.id, { status: 'Clarification Required' }, 'Clarification requested'); setSelected(null); }}>Request clarification</button><button className="button button-secondary button-small" onClick={() => { updateTask(task.id, { status: 'Completed' }, 'Task marked complete'); setSelected(null); }}>Mark completed</button><p>Changes create a simulated activity-history entry and update dashboard metrics.</p></aside></div>
    </Modal>}
    {createOpen && <TaskForm onClose={() => setCreateOpen(false)} onCreate={createTask} />}
  </>;
}

function CoordinationPage() {
  const { data, user, createTask, updateTask } = useOperations();
  const [draft, setDraft] = useState('');
  const [requestOpen, setRequestOpen] = useState(false);
  const ai = useDemoAI();
  const needsReply = data.tasks.filter((item) => ['Acknowledgment Pending', 'Clarification Required'].includes(item.status));
  const updates = data.tasks.filter((item) => ['In Progress', 'Under Review', 'Completed'].includes(item.status));
  const outgoing = data.tasks.filter((item) => item.source.includes('coordination request'));
  return <>
    <PageHeader eyebrow="OPERATIONS · INTERDEPARTMENTAL WORKSPACE" title="Department coordination" description="Manage incoming requests, acknowledgment, dependencies and shared progress in one register." actions={<button className="button button-primary" onClick={() => setRequestOpen(true)}><Icon name="plus" size={16} /> New request</button>} />
    <div className="metrics-grid metrics-three"><Metric label="Departments in directory" value={departments.length} note="Synthetic district directory" /><Metric label="Pending responses" value={needsReply.length} note="Acknowledgment or clarification" tone="amber" /><Metric label="Shared progress updates" value={updates.length} note="Recorded against task references" tone="blue" /></div>
    <div className="content-grid">
      <Panel title="Incoming requests" description="Requests requiring a receiving department response."><div className="request-list">{needsReply.map((task) => <article className="request-card" key={task.id}><div className="request-top"><span className="record-id">{task.id}</span><Status>{task.status}</Status></div><h3>{task.title}</h3><div className="request-meta"><span>From District Administration</span><span>To {task.department}</span><span>Owner {task.owner}</span></div><p>{task.summary}</p><div className="request-actions"><button className="button button-secondary button-small" onClick={() => updateTask(task.id, { status: 'Acknowledged' }, 'Department acknowledged request')}>Acknowledge</button><button className="text-button" onClick={() => updateTask(task.id, { status: 'Clarification Required' }, 'Clarification requested')}>Request clarification</button></div></article>)}</div></Panel>
      <div className="stacked-panels">{outgoing.length > 0 && <Panel title="Outgoing requests" description="Requests created in this coordination workspace."><div className="request-list">{outgoing.map((task) => <article className="request-card" key={task.id}><div className="request-top"><span className="record-id">{task.id}</span><Status>{task.status}</Status></div><h3>{task.title}</h3><div className="request-meta"><span>From {task.source.split(' · ')[0]}</span><span>To {task.department}</span><span>Due {dateLabel(task.due)}</span></div><p>{task.summary}</p></article>)}</div></Panel>}<Panel title="Department directory" description="Synthetic participating departments."><div className="directory-list">{departments.map((item, index) => { const count = data.tasks.filter((task) => task.department === item && task.status !== 'Completed').length; return <div key={item}><span className="department-initial">{item.slice(0, 2).toUpperCase()}</span><strong>{item}</strong><span>{count} active record{count === 1 ? '' : 's'}</span><small>{index < 3 ? 'Connected in this demo' : 'Directory entry'}</small></div>; })}</div></Panel>
        <Panel title="Coordination digest" description="Summarize updates and dependencies from shared records.">
          <AIDisclosure /><textarea className="text-area compact-area" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Optional context to include in the summary" />
          <button className="button button-primary button-small" disabled={ai.loading} onClick={() => ai.run(() => setDraft(`Coordination summary: ${needsReply.length} task responses need attention. ${needsReply.map((task) => `${task.department}: ${task.title} (${task.status})`).join('; ') || 'No pending responses.'} Progress updates are recorded for ${updates.map((task) => task.id).join(', ') || 'no tasks'}. Verify status and dependencies with the source departments before issuing follow-up.`))}>{ai.loading ? 'Reviewing updates…' : 'Summarize coordination'}</button>
          {ai.complete && <div className="suggestion-box">{draft}<small>Sources: {needsReply.map((task) => task.id).join(', ') || 'task register'}</small></div>}
        </Panel>
      </div>
    </div>
    {requestOpen && <TaskForm initial={{ source: 'Department coordination request' }} onClose={() => setRequestOpen(false)} onCreate={(task) => createTask({ ...task, status: 'Acknowledgment Pending', source: `${user?.department || 'Department'} coordination request` })} />}
  </>;
}

function MeetingsPage() {
  const { data, addMeeting, createTask } = useOperations();
  const [open, setOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState('M-117');
  const [minutes, setMinutes] = useState('PWD to confirm pump valve delivery before Friday. Education to send the school repair estimate. Irrigation will complete the Nandpur approach inspection and share photographs.');
  const [actions, setActions] = useState([]);
  const ai = useDemoAI();
  const extract = () => ai.run(() => {
    const note = minutes.toLowerCase();
    const extracted = [];
    if (/pump|water|valve/.test(note)) extracted.push({ text: 'Confirm replacement valve delivery and repair schedule', department: 'Public Works', owner: 'A. Sharma', due: '', approved: false });
    if (/school|education|classroom/.test(note)) extracted.push({ text: 'Submit the consolidated school repair estimate', department: 'Education', owner: 'P. Singh', due: '', approved: false });
    if (/nandpur|embankment|irrigation/.test(note)) extracted.push({ text: 'Complete the Nandpur approach inspection and share photographs', department: 'Irrigation', owner: 'V. Yadav', due: '', approved: false });
    if (!extracted.length && note.trim()) extracted.push({ text: 'Review and confirm the next step recorded in the meeting notes', department: 'Manual assignment required', owner: 'To be assigned', due: '', approved: false });
    setActions(extracted);
  });
  const createAction = (action) => {
    createTask({ title: action.text, department: action.department, owner: action.owner, priority: 'Normal', due: action.due, source: `Meeting action · ${selectedMeeting}`, summary: action.text, deliverables: 'Meeting action evidence / progress update' });
    setActions((current) => current.filter((item) => item.text !== action.text));
  };
  return <>
    <PageHeader eyebrow="OPERATIONS · MEETING SECRETARIAT" title="Meetings & action tracking" description="Prepare meeting records, review proposed actions and carry approved items into the shared task register." actions={<button className="button button-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Schedule meeting</button>} />
    <div className="meeting-grid">{data.meetings.map((meeting) => <Panel key={meeting.id} className="meeting-card"><div className="meeting-topline"><span className="record-id">{meeting.id}</span><Status>{meeting.status}</Status></div><h2>{meeting.title}</h2><p>{dateLabel(meeting.date)} · {meeting.time} · {meeting.venue}</p><div className="meeting-meta"><span>Participants</span><strong>{meeting.participants}</strong><span>Purpose</span><strong>{meeting.purpose}</strong><span>Agenda</span><strong>{meeting.agenda}</strong></div><div className="meeting-footer"><span>{meeting.actions} action items</span><button className="text-button" onClick={() => { setSelectedMeeting(meeting.id); setMinutes(`${meeting.purpose} ${meeting.agenda}. Departments to confirm actions, accountable owners and due dates at the next review.`); document.querySelector('.meeting-ai-panel')?.scrollIntoView({ behavior: 'smooth' }); }}>Review minutes <Icon name="arrow" size={14} /></button></div></Panel>)}</div>
    <Panel title="Meeting minutes & action extraction" description="AI suggestions remain drafts. The secretary must verify and approve each item before creating a task." className="meeting-ai-panel" >
      <div className="minutes-layout"><div><AIDisclosure /><label className="field"><span>Notes or transcript</span><textarea className="text-area" rows="7" value={minutes} onChange={(event) => setMinutes(event.target.value)} /></label><button className="button button-primary button-small" disabled={ai.loading} onClick={extract}>{ai.loading ? 'Extracting draft…' : 'Draft minutes and actions'} <Icon name="spark" size={15} /></button></div><div><h3>Proposed action items</h3>{actions.length ? <div className="action-drafts">      {actions.map((action) => <article className={`action-draft ${!action.approved ? 'action-muted' : ''}`} key={action.text}><label className="approval-check"><input type="checkbox" checked={action.approved} onChange={(event) => setActions((current) => current.map((item) => item.text === action.text ? { ...item, approved: event.target.checked } : item))} /><span>Officer reviewed</span></label><textarea className="text-area" value={action.text} onChange={(event) => setActions((current) => current.map((item) => item.text === action.text ? { ...item, text: event.target.value } : item))} /><div className="action-meta"><span>{action.department} · {action.owner}</span><span>{action.due ? `Suggested date: ${dateLabel(action.due)}` : 'Deadline not stated — confirm before assigning'}</span></div>{!action.due && <Field label="Confirmed deadline"><input type="date" min={today} value={action.due} onChange={(event) => setActions((current) => current.map((item) => item.text === action.text ? { ...item, due: event.target.value } : item))} /></Field>}<button className="button button-secondary button-small" disabled={!action.approved || !action.due} onClick={() => createAction(action)}>Create task from approved action</button></article>)}</div> : <div className="empty-state"><span className="empty-mark">AI</span><strong>No draft actions yet</strong><p>Enter meeting notes and generate suggestions for review.</p></div>}</div></div>
    </Panel>
    {open && <Modal title="Schedule a meeting" subtitle="This record is stored in this browser's demo workspace." onClose={() => setOpen(false)}>
      <form className="form-grid form-single" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); addMeeting({ title: f.get('title'), date: f.get('date'), time: f.get('time'), venue: f.get('venue'), participants: f.get('participants'), purpose: f.get('purpose'), agenda: f.get('agenda') }); setOpen(false); }}>
        <Field label="Meeting title"><input name="title" required placeholder="District coordination review" /></Field><Field label="Date"><input name="date" type="date" required min={today} /></Field><Field label="Time"><input name="time" type="time" required /></Field><Field label="Venue"><input name="venue" required placeholder="Collectorate meeting room" /></Field><Field label="Participants"><input name="participants" required placeholder="Departments or officers" /></Field><Field label="Purpose"><textarea name="purpose" rows="2" required /></Field><Field label="Agenda"><textarea name="agenda" rows="2" /></Field><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary">Save meeting</button></div>
      </form>
    </Modal>}
  </>;
}

function FilesPage() {
  const { data, createFile, moveFile } = useOperations();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(data.files[0]?.id || '');
  const [extracted, setExtracted] = useState(null);
  const [uploadedName, setUploadedName] = useState('');
  const ai = useDemoAI();
  const file = data.files.find((item) => item.id === selected);
  const stages = ['Received', 'Registered', 'Assigned', 'Under Review', 'Decision', 'Closed / Dispatched'];
  return <>
    <PageHeader eyebrow="OPERATIONS · OFFICIAL FILE REGISTER" title="File tracking" description="Register incoming correspondence and maintain a visible, attributable file movement history." actions={<button className="button button-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Register incoming file</button>} />
    <div className="file-layout"><Panel title="Incoming file register" description="Select a record to inspect its lifecycle and movement."><div className="file-list">{data.files.map((item) => <button className={`file-list-item ${item.id === selected ? 'file-selected' : ''}`} key={item.id} onClick={() => { setSelected(item.id); setExtracted(null); }}><div className="file-list-top"><span className="record-id">{item.id}</span><Status>{item.status}</Status></div><strong>{item.subject}</strong><span>{item.department} · Current owner: {item.owner}</span><small>Received {dateLabel(item.received)} · Due {dateLabel(item.due)}</small></button>)}</div></Panel>
      <div className="stacked-panels">{file && <Panel title="File lifecycle" description={`${file.id} · ${file.section || 'Unassigned section'}`}><div className="lifecycle">{stages.map((stage, index) => <div className={`lifecycle-step ${index < file.step ? 'step-done' : index === file.step ? 'step-current' : ''}`} key={stage}><span className="lifecycle-point">{index < file.step ? '✓' : index + 1}</span><span>{stage}</span></div>)}</div><div className="file-detail-box"><div><span>Subject</span><strong>{file.subject}</strong></div><div><span>Sender</span><strong>{file.sender}</strong></div><div><span>Current owner</span><strong>{file.owner}</strong></div><div><span>Due date</span><strong>{dateLabel(file.due)}</strong></div></div><div className="inline-actions"><button className="button button-secondary button-small" onClick={() => moveFile(file.id, -1)} disabled={file.step === 0}>Move back</button><button className="button button-primary button-small" onClick={() => moveFile(file.id, 1)} disabled={file.step >= stages.length - 1}>Record next movement</button></div><div className="file-history"><strong>Movement history</strong>{data.audit.filter((event) => event.ref === file.id).map((event) => <div key={event.id}><span>{event.time}</span><p>{event.action} · {event.before} → {event.after}</p><small>{event.user} · {event.role}</small></div>)}{!data.audit.some((event) => event.ref === file.id) && <small>Initial registration · {dateLabel(file.received)}</small>}</div><p className="muted-caption">Each movement creates a simulated history entry; it is not an immutable government audit log.</p></Panel>}
        <Panel title="OCR & information extraction" description="Inspect a simulated result beside your selected file."><AIDisclosure>Simulated OCR · no document is sent to a service</AIDisclosure><label className="upload-field"><Icon name="file" /><span>{uploadedName || 'Choose a PDF or image for this local demonstration'}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setUploadedName(event.target.files?.[0]?.name || '')} /></label><button className="button button-secondary button-small" disabled={ai.loading} onClick={() => ai.run(() => setExtracted({ reference: file?.id || 'DF-2026-0000', date: file?.received || today, sender: file?.sender || 'Not identified', subject: file?.subject || 'Not identified', category: 'Department correspondence', department: file?.department || 'Manual review required' }))}>{ai.loading ? 'Simulating extraction…' : 'Run OCR demonstration'}</button>{extracted && <div className="extraction-grid"><div className="document-preview"><div className="preview-toolbar">DOCUMENT PREVIEW · SYNTHETIC</div><div className="paper-preview"><strong>{extracted.subject}</strong><span>From: {extracted.sender}</span><p>{file?.summary}</p><small>Demonstration preview — original document not provided.</small></div></div><div className="extracted-fields"><div className="extract-label">SIMULATED EXTRACTED FIELDS</div>{Object.entries(extracted).map(([key, value]) => <Field label={key} key={key}><input value={value} onChange={(event) => setExtracted((current) => ({ ...current, [key]: event.target.value }))} /></Field>)}<button className="button button-primary button-small" onClick={() => setExtracted(null)}>Confirm fields for this demo</button></div></div>}</Panel></div>
    </div>
    {open && <Modal title="Register incoming file" subtitle="Create a synthetic file reference in the local demo." onClose={() => setOpen(false)}>
      <form className="form-grid form-single" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); const id = createFile({ subject: f.get('subject'), department: f.get('department'), sender: f.get('sender'), owner: f.get('owner'), section: f.get('section'), received: today, due: f.get('due'), summary: f.get('summary') }); setSelected(id); setOpen(false); }}>
        <Field label="Subject"><input name="subject" required /></Field><Field label="Department"><select name="department">{departments.map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Sender"><input name="sender" required /></Field><Field label="Current file owner"><input name="owner" required /></Field><Field label="Section / location"><input name="section" required /></Field><Field label="Due date"><input name="due" type="date" required min={today} /></Field><Field label="Short note"><textarea name="summary" rows="2" /></Field><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setOpen(false)}>Cancel</button><button className="button button-primary">Register file</button></div>
      </form>
    </Modal>}
  </>;
}

function ReportsPage() {
  const { data } = useOperations();
  const [report, setReport] = useState('');
  const ai = useDemoAI();
  const total = data.tasks.length;
  const completed = data.tasks.filter((item) => item.status === 'Completed').length;
  const overdue = data.tasks.filter((item) => item.status !== 'Completed' && item.due < today).length;
  const pending = data.tasks.filter((item) => item.status === 'Acknowledgment Pending').length;
  const rate = total ? Math.round(completed / total * 100) : 0;
  const onTimeCompletions = data.tasks.filter((item) => item.status === 'Completed' && (item.completedAt || item.due) <= item.due).length;
  const breakdown = departments.map((department) => {
    const list = data.tasks.filter((item) => item.department === department);
    return { id: department, department, total: list.length, complete: list.filter((item) => item.status === 'Completed').length, overdue: list.filter((item) => item.status !== 'Completed' && item.due < today).length, rate: list.length ? `${Math.round(list.filter((item) => item.status === 'Completed').length / list.length * 100)}%` : '—' };
  }).filter((item) => item.total);
  const rowsForCsv = [['Department', 'Tasks', 'Completed', 'Overdue', 'Completion rate'], ...breakdown.map((item) => [item.department, item.total, item.complete, item.overdue, item.rate])];
  return <>
    <PageHeader eyebrow="OVERVIEW · OPERATIONAL REPORTING" title="Reports & analytics" description="Performance indicators are calculated from the shared synthetic task and meeting records." actions={<DownloadButton rows={rowsForCsv} />} />
    <div className="metrics-grid metrics-four"><Metric label="Task completion" value={`${rate}%`} note={`${completed} of ${total} tasks`} tone="green" /><Metric label="Pending acknowledgment" value={pending} note="Open assignments" tone="amber" /><Metric label="Overdue backlog" value={overdue} note="Open tasks past due date" tone="red" /><Metric label="Meeting records" value={data.meetings.length} note={`${data.meetings.reduce((sum, item) => sum + item.actions, 0)} linked action items`} /></div>
    <Panel title="Department-wise performance" description="Only departments with current task records are shown."><DataTable rows={breakdown} columns={[{ key: 'department', label: 'Department' }, { key: 'total', label: 'Tasks' }, { key: 'complete', label: 'Completed' }, { key: 'overdue', label: 'Overdue' }, { key: 'rate', label: 'Completion rate' }, { key: 'bar', label: 'Progress', render: (item) => <div className="table-progress"><span style={{ width: item.rate }} /></div> }]} /></Panel>
    <div className="reports-bottom"><Panel title="Operational indicators" description="Calculated values for this synthetic reporting period."><div className="indicator-list"><div><span>On-time completion</span><strong>{completed ? `${Math.round(onTimeCompletions / completed * 100)}%` : '—'}</strong></div><div><span>Tasks with an owner</span><strong>{data.tasks.filter((item) => item.owner).length} / {total}</strong></div><div><span>Clarification requests open</span><strong>{data.tasks.filter((item) => item.status === 'Clarification Required').length}</strong></div><div><span>Inspection reports submitted</span><strong>{data.inspections.filter((item) => item.report).length} / {data.inspections.length}</strong></div></div><div className="data-note">Average acknowledgment / assignment times are not shown: the prototype has no verified event-time dataset for those measures.</div></Panel>
      <Panel title="AI reporting assistant" description="Draft narrative from verified mock-data metrics."><AIDisclosure /><button className="button button-primary button-small" disabled={ai.loading} onClick={() => ai.run(() => setReport(`Weekly operational note · synthetic data\n\n${total} instruction records are present, with ${completed} complete (${rate}%). There are ${pending} pending acknowledgments and ${overdue} open tasks past their due date. ${breakdown.filter((item) => item.overdue).map((item) => `${item.department} has ${item.overdue} overdue task`).join('; ') || 'No department currently has an overdue task'}. ${data.meetings.length} meeting records and ${data.inspections.filter((item) => item.report).length} submitted field reports are represented in this demo.\n\nThis draft is generated from local synthetic records. Confirm figures and context before circulation.`))}>{ai.loading ? 'Preparing narrative…' : 'Draft weekly summary'}</button>{ai.complete && <textarea className="text-area report-draft" value={report} onChange={(event) => setReport(event.target.value)} aria-label="Editable report draft" />}{ai.complete && <div className="ai-actions"><span>Human-reviewed draft · not an official report</span><button className="button button-secondary button-small" onClick={() => navigator.clipboard?.writeText(report)}>Copy draft</button></div>}</Panel></div>
  </>;
}

function DocumentsPage() {
  const { data, addDocument } = useOperations();
  const [selected, setSelected] = useState(data.documents[0]?.id);
  const [filter, setFilter] = useState('All categories');
  const [fileName, setFileName] = useState('');
  const [query, setQuery] = useState('');
  const [output, setOutput] = useState('');
  const ai = useDemoAI();
  const document = data.documents.find((item) => item.id === selected);
  const docs = data.documents.filter((item) => filter === 'All categories' || item.category === filter);
  const categories = [...new Set(data.documents.map((item) => item.category))];
  return <>
    <PageHeader eyebrow="KNOWLEDGE · DOCUMENT WORKSPACE" title="Document intelligence" description="Browse local demonstration documents and inspect editable simulated extraction results." />
    <div className="toolbar"><label className="search-field"><Icon name="search" size={17} /><input placeholder="Search document title or text" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><label className="button button-secondary upload-button"><Icon name="plus" size={15} /> Add local document<input type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setFileName(file.name); const id = addDocument({ title: file.name, category: 'Uploaded demonstration', department: 'Manual review', text: 'The file is kept local to this prototype. Text extraction shown here is illustrative and does not read the file contents.' }); setSelected(id); setQuery(''); }} /></label></div>
    <div className="document-layout"><Panel title="Document library" description={`${docs.filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(query.toLowerCase())).length} records`}><div className="library-list">{docs.filter((item) => `${item.title} ${item.text}`.toLowerCase().includes(query.toLowerCase())).map((item) => <button key={item.id} className={`library-item ${selected === item.id ? 'library-active' : ''}`} onClick={() => { setSelected(item.id); setQuery(''); }}><div><Icon name="file" size={18} /><span className="record-id">{item.id}</span></div><strong>{item.title}</strong><span>{item.category} · {item.department}</span><small>{dateLabel(item.date)} · Source: {item.ref}</small></button>)}</div>{fileName && <div className="upload-confirmation">Added {fileName} to the local demonstration library.</div>}</Panel>
      <Panel title={document?.title || 'Document preview'} description={document ? `${document.id} · ${document.category} · ${document.department}` : 'Select a document to inspect the available demo details.'}>
        {document && <><div className="document-viewer"><div className="preview-toolbar"><span>SIMULATED DOCUMENT VIEW</span><span>{document.ref}</span></div><article className="paper-preview"><div className="paper-kicker">DISTRICTOPS · SYNTHETIC SAMPLE</div><h3>{document.title}</h3><p>{document.text}</p><p>This sample is fictional and provided only to demonstrate the prototype workflow. It is not an official order or record.</p><div className="paper-signature">Demonstration document<br />Generated for prototype review</div></article></div><div className="document-actions"><div><strong>Document summary & extraction</strong><span>Illustrative AI output; review before reuse.</span></div><button className="button button-secondary button-small" disabled={ai.loading} onClick={() => ai.run(() => setOutput(`${document.title}: ${document.text} Source record ${document.ref}, dated ${dateLabel(document.date)}. Confirm extracted details against the original source.`))}>{ai.loading ? 'Analyzing…' : 'Summarize document'}</button></div>{ai.complete && <><AIDisclosure /><textarea className="text-area report-draft" value={output} onChange={(event) => setOutput(event.target.value)} /><div className="field-row"><Field label="Extracted category"><input defaultValue={document.category} /></Field><Field label="Department"><input defaultValue={document.department} /></Field><Field label="Source reference"><input defaultValue={document.ref} /></Field></div></>}</>}
      </Panel>
    </div>
  </>;
}

function KnowledgePage() {
  const { data } = useOperations();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All categories');
  const [selected, setSelected] = useState(null);
  const [answer, setAnswer] = useState('');
  const ai = useDemoAI();
  const categories = [...new Set(data.circulars.map((item) => item.category))];
  const results = [...data.circulars].filter((item) => (category === 'All categories' || item.category === category) && (!query || `${item.title} ${item.text} ${item.department}`.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().split(/\s+/).some((term) => term.length > 3 && `${item.title} ${item.text}`.toLowerCase().includes(term)))).sort((a, b) => b.date.localeCompare(a.date));
  const runSearch = () => ai.run(() => {
    if (!results.length) setAnswer('No matching synthetic source was found. Try a broader search or check the selected category. No answer has been generated because the demo library has no supporting passage.');
    else {
      const source = results[0];
      setSelected(source.id);
      setAnswer(`Illustrative response based on ${source.title}: ${source.text} The retrieved synthetic note is dated ${dateLabel(source.date)} (${source.id}, version ${source.version}), and covers ${source.sections.join(', ')}. Verify the source document and applicability before relying on this answer. This is not legal or official guidance.`);
    }
  });
  return <>
    <PageHeader eyebrow="KNOWLEDGE · SYNTHETIC APPROVED-SOURCE LIBRARY" title="Circular & order search" description="Search clearly fictional administrative samples and review passages and citations before using an answer." />
    <Panel className="knowledge-search-panel" title="Ask a question of the demo library" description="The retrieval demonstration only searches the synthetic documents listed below.">
      <AIDisclosure /><div className="knowledge-query"><input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runSearch(); }} placeholder="e.g. What should a drinking water inspection record include?" /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><button className="button button-primary" disabled={ai.loading} onClick={runSearch}>{ai.loading ? 'Retrieving…' : 'Search sources'}<Icon name="arrow" size={16} /></button></div>
      {ai.loading && <div className="retrieval-flow"><span className="spinner-border spinner-border-sm" /> Understanding query <b>→</b> Searching synthetic library <b>→</b> Checking source context <b>→</b> Drafting cited response</div>}
      {ai.complete && <div className="knowledge-answer"><div className="answer-top"><strong>Illustrative answer</strong><span className="coverage-label">Source coverage: {results.length ? 'supporting passage found' : 'no source found'}</span></div><p>{answer}</p>{selected && <button className="citation-card" onClick={() => document.querySelector('.knowledge-layout')?.scrollIntoView({ behavior: 'smooth' })}><span className="citation-index">01</span><span><strong>{results.find((item) => item.id === selected)?.title}</strong><small>{selected} · {dateLabel(results.find((item) => item.id === selected)?.date)} · synthetic document</small></span><Icon name="arrow" size={16} /></button>}</div>}
    </Panel>
    <div className="knowledge-layout"><Panel title="Synthetic source library" description={`${results.length} sources match the current query.`}><div className="source-list">{results.map((item) => <button className={`source-item ${selected === item.id ? 'source-active' : ''}`} key={item.id} onClick={() => setSelected(item.id)}><div className="source-top"><span className="record-id">{item.id}</span><span>{dateLabel(item.date)} · v{item.version}</span></div><strong>{item.title}</strong><span>{item.category} · {item.department}</span><small>{item.pages} pages · {item.sections.join(' · ')}</small></button>)}</div></Panel>
      <Panel title="Retrieved passage preview" description={selected && data.circulars.find((item) => item.id === selected) ? `${selected} · Synthetic source` : 'Select a source to inspect its available text.'}>
        {selected && data.circulars.find((item) => item.id === selected) ? (() => { const source = data.circulars.find((item) => item.id === selected); return <div className="source-preview"><div className="warning-note"><strong>Fictional reference only</strong><span>Not an actual government circular, order or legal source.</span></div>{source.date < '2026-10-12' && <div className="outdated-note">Older sample version · Confirm whether a newer source exists before use.</div>}<h3>{source.title}</h3><p>{source.text}</p><div className="source-citation">Citation preview · {source.title} · {dateLabel(source.date)} · {source.sections[0]} · p. 1 of {source.pages}</div><Status>Human verification required</Status></div>; })() : <div className="empty-state"><span className="empty-mark">—</span><strong>No source selected</strong><p>Choose a synthetic reference from the library.</p></div>}
      </Panel>
    </div>
  </>;
}

function FieldPage() {
  const { data, updateInspection } = useOperations();
  const [reports, setReports] = useState({});
  const [summaries, setSummaries] = useState({});
  const ai = useDemoAI();
  return <>
    <PageHeader eyebrow="OPERATIONS · FIELD UPDATES" title="Field operations" description="Coordinate inspection assignments, evidence and supervisor review. No GPS or location service is connected." actions={<span className="read-only-tag">Location is descriptive text only</span>} />
    <div className="inspection-list">{data.inspections.map((inspection) => <Panel className="inspection-card" key={inspection.id}><div className="inspection-heading"><div><span className="record-id">{inspection.id}</span><h2>{inspection.site}</h2></div><Status>{inspection.status}</Status></div><div className="inspection-meta"><div><span>Department</span><strong>{inspection.department}</strong></div><div><span>Field officer</span><strong>{inspection.officer}</strong></div><div><span>Inspection date</span><strong>{dateLabel(inspection.date)}</strong></div><div><span>Checklist</span><strong>{inspection.checklist}</strong></div></div><Field label="Inspection report"><textarea className="text-area" rows="3" value={reports[inspection.id] ?? inspection.report} onChange={(event) => setReports((current) => ({ ...current, [inspection.id]: event.target.value }))} placeholder="Record observed condition, evidence and any constraints." /></Field><div className="inspection-actions"><button className="button button-secondary button-small" onClick={() => updateInspection(inspection.id, { report: reports[inspection.id] ?? inspection.report, status: 'Report submitted' })}>Save report</button><button className="button button-primary button-small" disabled={ai.loading} onClick={() => ai.run(() => setSummaries((current) => ({ ...current, [inspection.id]: (reports[inspection.id] ?? inspection.report) ? `Draft summary: ${(reports[inspection.id] ?? inspection.report)} Supervisor review: verify the reported finding, confirm supporting photographs and assign a follow-up owner for any unresolved issue.` : `Draft review: no report text is available for ${inspection.id}. The report and evidence fields are missing; request submission before supervisor assessment.` })), 650)}>{ai.loading ? 'Reviewing…' : 'Draft supervisor summary'} <Icon name="spark" size={14} /></button><label className="button button-secondary button-small evidence-upload">Attach evidence<input type="file" accept="image/*,.pdf" onChange={(event) => updateInspection(inspection.id, { evidenceName: event.target.files?.[0]?.name || '' })} /></label></div>{inspection.evidenceName && <div className="evidence-note">Local evidence preview: {inspection.evidenceName}</div>}{summaries[inspection.id] && <div className="ai-inspection-summary"><AIDisclosure /><textarea className="text-area" rows="3" value={summaries[inspection.id]} onChange={(event) => setSummaries((current) => ({ ...current, [inspection.id]: event.target.value }))} /><div className="ai-actions"><span>Draft only · supervisor review required</span><button className="text-button" onClick={() => setSummaries((current) => ({ ...current, [inspection.id]: '' }))}>Dismiss</button></div></div>}</Panel>)}</div>
  </>;
}

function responseFor(query, data, department) {
  const text = query.toLowerCase();
  if (text.includes('overdue') || text.includes('deadline')) {
    const tasks = data.tasks.filter((task) => task.status !== 'Completed' && (task.due < today || task.status === 'Overdue') && (!department || department === 'District Administration' || task.department === department));
    return { text: tasks.length ? `${tasks.length} open task${tasks.length === 1 ? '' : 's'} are past their due date in the visible mock records: ${tasks.map((task) => `${task.title} (${task.department}, due ${dateLabel(task.due)})`).join('; ')}.` : 'No overdue open task was found in the records available for this demo context.', sources: tasks.map((item) => item.id) };
  }
  if (text.includes('acknowledg')) {
    const tasks = data.tasks.filter((task) => task.status === 'Acknowledgment Pending' && (!department || department === 'District Administration' || task.department === department));
    return { text: tasks.length ? `${tasks.length} acknowledgment${tasks.length === 1 ? '' : 's'} pending: ${tasks.map((task) => `${task.title} — ${task.department}, owner ${task.owner}`).join('; ')}.` : 'No pending acknowledgments match this demo context.', sources: tasks.map((item) => item.id) };
  }
  if (text.includes('circular') || text.includes('water inspection')) {
    const source = data.circulars.find((item) => `${item.title} ${item.text}`.toLowerCase().includes('water')) || data.circulars[0];
    return { text: `${source.title} notes: ${source.text} This is a fictional document and not official guidance.`, sources: [source.id] };
  }
  if (text.includes('missing') || text.includes('update')) {
    const tasks = data.tasks.filter((task) => !['Completed', 'Under Review'].includes(task.status));
    return { text: `${tasks.length} active task records may need a fresh progress check. The oldest visible update is ${tasks.slice().sort((a, b) => a.updated.localeCompare(b.updated)).at(-1)?.id || 'not available'}. Confirm freshness with each department; update dates are synthetic display values.`, sources: tasks.slice(0, 5).map((item) => item.id) };
  }
  if (text.includes('week') || text.includes('summary') || text.includes('briefing')) {
    const done = data.tasks.filter((task) => task.status === 'Completed').length;
    const pending = data.tasks.filter((task) => task.status === 'Acknowledgment Pending').length;
    const late = data.tasks.filter((task) => task.status !== 'Completed' && task.due < today).length;
    return { text: `District update: ${done} of ${data.tasks.length} tasks are recorded complete; ${pending} acknowledgments are pending and ${late} open tasks are past due. ${data.meetings.length} meeting records are available. Review department-level sources before using this as a briefing.`, sources: data.tasks.slice(0, 4).map((item) => item.id) };
  }
  return { text: `I found ${data.tasks.length} task records, ${data.meetings.length} meeting records and ${data.circulars.length} synthetic circular samples in the current demo. Ask about overdue work, pending acknowledgments, departmental updates or a sample circular to get a source-linked response.`, sources: ['Task register', 'Meeting register', ...data.circulars.slice(0, 1).map((item) => item.id)] };
}

function AssistantPage() {
  const { data, user } = useOperations();
  const [messages, setMessages] = useState([{ role: 'assistant', text: `Good day, ${user?.name || 'officer'}. I can help review this prototype’s task register, meeting records and synthetic reference library. Responses are simulated and include source references where available.`, sources: [] }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const suggestions = ['What tasks are overdue for my department?', 'Which departments have pending acknowledgments?', 'Find a sample circular on drinking water inspections.', 'Summarize this week’s operational updates.'];
  const send = (value = input) => {
    const query = value.trim();
    if (!query || loading) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', text: query }]);
    setLoading(true);
    window.setTimeout(() => {
      const answer = responseFor(query, data, user?.department);
      setMessages((current) => [...current, { role: 'assistant', ...answer }]);
      setLoading(false);
    }, 650);
  };
  return <>
    <PageHeader eyebrow="ASSISTED WORK · LOCAL MOCK DATA" title="Administrative assistant" description="Ask questions of the current demo records. Responses are simulated and do not call an external AI service." />
    <div className="assistant-layout"><section className="chat-panel"><div className="chat-heading"><div><span className="assistant-status" />DEMO ASSISTANT</div><span>Context: {user?.department || 'District Administration'}</span></div><div className="chat-messages">{messages.map((message, index) => <article className={`chat-message ${message.role === 'user' ? 'message-user' : ''}`} key={`${message.role}-${index}`}><div className="message-label">{message.role === 'user' ? user?.name : 'DistrictOps assistant'}</div><p>{message.text}</p>{message.sources?.length > 0 && <div className="message-sources"><span>Sources</span>{message.sources.map((source) => <span className="citation-chip" key={source}>{source}</span>)}</div>}</article>)}{loading && <div className="chat-loading"><span className="spinner-border spinner-border-sm" /> Checking relevant mock records…</div>}</div><div className="suggested-queries"><span>TRY ASKING</span>{suggestions.map((item) => <button key={item} onClick={() => send(item)}>{item}</button>)}</div><form className="chat-input" onSubmit={(event) => { event.preventDefault(); send(); }}><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask a question about district operations…" aria-label="Ask the administrative assistant" /><button className="button button-primary" disabled={!input.trim() || loading}>Send <Icon name="arrow" size={15} /></button></form></section><aside className="assistant-side"><Panel title="How this demo responds"><div className="assistant-side-steps"><div><b>01</b><span>Understand the question and demo context</span></div><div><b>02</b><span>Read relevant local mock records</span></div><div><b>03</b><span>Draft a source-linked response for review</span></div></div></Panel><div className="warning-note"><strong>Human verification required</strong><span>Responses can be incomplete or incorrect. Check cited records before acting. No official decisions or write actions are performed.</span></div></aside></div>
  </>;
}

function AgentsPage() {
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  const [steps, setSteps] = useState([]);
  const { data } = useOperations();
  const overdue = data.tasks.filter((item) => item.status !== 'Completed' && item.due < today);
  const start = () => {
    setRunning(true);
    setComplete(false);
    setSteps([]);
    const outputs = [
      ['Orchestrator', 'Request interpreted: prepare a draft briefing and find related synthetic references.'],
      ['Reporting capability', `Retrieved ${overdue.length} open overdue task${overdue.length === 1 ? '' : 's'} from the shared task register.`],
      ['Document capability', `Searched the synthetic library and retrieved ${data.circulars[0]?.id || 'no source'} for source inspection.`],
      ['Coordination capability', `${data.tasks.filter((item) => item.status === 'Acknowledgment Pending').length} acknowledgments and ${data.tasks.filter((item) => item.status === 'Clarification Required').length} clarification requests need attention.`],
      ['Reporting capability', 'Prepared an editable briefing draft with task and document references. No records were changed.'],
    ];
    outputs.forEach((step, index) => window.setTimeout(() => {
      setSteps((current) => [...current, step]);
      if (index === outputs.length - 1) {
        setRunning(false);
        setComplete(true);
      }
    }, (index + 1) * 420));
  };
  return <>
    <PageHeader eyebrow="ASSISTED WORK · CONTROLLED WORKFLOW DEMONSTRATION" title="Controlled AI workflow" description="An illustrative orchestrator routes a read-only request to bounded specialist capabilities." />
    <div className="workflow-intro"><div><span className="eyebrow">EXAMPLE REQUEST</span><h2>“Prepare a briefing on overdue departmental actions and identify relevant circulars.”</h2><p>Specialists read synthetic records only. This demonstration has no autonomous write actions or official decision-making.</p></div><button className="button button-primary" disabled={running} onClick={start}>{running ? 'Running steps…' : 'Run illustrative workflow'} <Icon name="arrow" size={16} /></button></div>
    <div className="specialist-grid">{[['Document & RAG assistant', 'Retrieve synthetic references and cited passages.'], ['Meeting & minutes assistant', 'Extract draft decisions and actions from supplied notes.'], ['Department coordination assistant', 'Summarize open requests, dependencies and updates.'], ['Reporting & briefing assistant', 'Draft a summary from verified operational records.']].map(([title, detail], index) => <div className="specialist-card" key={title}><span className="specialist-index">0{index + 1}</span><strong>{title}</strong><p>{detail}</p><span className="capability-tag">BOUNDED · READ-ONLY DEMO</span></div>)}</div>
    <Panel title="Illustrative execution trace" description="Each step shows the mock information used by a capability."><div className="execution-list">{steps.map(([name, output], index) => <div className="execution-step" key={name}><span className="execution-index">{String(index + 1).padStart(2, '0')}</span><div><strong>{name}</strong><p>{output}</p></div><Status>Complete</Status></div>)}{running && <div className="ai-loading"><span className="spinner-border spinner-border-sm" /> Running bounded demo capabilities…</div>}{!running && !complete && !steps.length && <div className="empty-state"><span className="empty-mark">01</span><strong>Workflow not started</strong><p>Start the example to inspect its execution trace.</p></div>}</div>{complete && <div className="workflow-result"><AIDisclosure /><strong>Draft briefing · human review required</strong><p>{overdue.length} open task(s) are past due. Pending acknowledgments: {data.tasks.filter((item) => item.status === 'Acknowledgment Pending').map((item) => item.id).join(', ') || 'none'}. Review the synthetic source references before using this draft.</p><span>Sources: {overdue.map((item) => item.id).join(', ') || 'task register'} · {data.circulars[0]?.id}</span></div>}</Panel>
  </>;
}

function VoicePage() {
  const [mode, setMode] = useState('idle');
  const [transcript, setTranscript] = useState('');
  const demoText = 'Which tasks are overdue for my department?';
  const start = () => {
    setMode('listening');
    window.setTimeout(() => { setTranscript(demoText); setMode('transcribed'); }, 900);
  };
  return <>
    <PageHeader eyebrow="ASSISTED WORK · INTERACTION CONCEPT" title="Chat & voice interaction" description="A visual exploration of keyboard and voice-style access. Speech recognition and playback are not connected in this prototype." />
    <div className="voice-layout"><Panel title="Voice interaction preview" description="The microphone control simulates a listening state and sample transcription only."><div className={`voice-orb voice-${mode}`}><span className="voice-ring" /><span className="voice-core"><Icon name={mode === 'listening' ? 'menu' : 'spark'} size={26} /></span></div><div className="voice-state">{mode === 'listening' ? 'Listening demonstration…' : mode === 'playing' ? 'Response playback demonstration' : mode === 'transcribed' ? 'Sample transcription ready' : 'Ready when you are'}</div>{transcript && <div className="transcript-box"><span>TRANSCRIPTION PREVIEW · SIMULATED</span><p>{transcript}</p></div>}<div className="voice-controls"><button className="button button-primary" onClick={start} disabled={mode === 'listening'}>{mode === 'listening' ? 'Listening…' : 'Start voice demo'}</button>{mode === 'transcribed' && <button className="button button-secondary" onClick={() => setMode('playing')}>Preview response state</button>}{mode !== 'idle' && <button className="text-button" onClick={() => { setMode('idle'); setTranscript(''); }}>End interaction</button>}</div><div className="warning-note"><strong>No microphone access is requested</strong><span>This screen does not record audio or use a speech service. The transcript above is a fixed sample.</span></div></Panel><Panel title="Text chat preview" description="The administrative assistant is also available as a fully simulated text interaction."><p className="panel-copy">Ask about overdue work, acknowledgments, progress updates or synthetic reference material. Answers are generated from the same local mock records.</p><a className="button button-secondary" href="/app/assistant">Open administrative assistant <Icon name="arrow" size={15} /></a></Panel></div>
  </>;
}

function NotificationsPage() {
  const { data, markRead } = useOperations();
  const [filter, setFilter] = useState('All');
  const visible = data.notifications.filter((item) => filter === 'All' || (filter === 'Unread' ? !item.read : item.read));
  return <>
    <PageHeader eyebrow="ADMINISTRATION · DEMO EVENT FEED" title="Notifications" description="Local simulated reminders, assignment updates and review prompts." actions={<select className="filter-select" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Unread</option><option>Read</option></select>} />
    <Panel title="Recent notifications" description={`${data.notifications.filter((item) => !item.read).length} unread · Selecting an item marks it read.`}><div className="notification-list">{visible.map((item) => <button className={`notification-row ${item.read ? 'notification-read' : ''}`} key={item.id} onClick={() => markRead(item.id)}><span className={`notification-symbol notification-${item.type}`}>{item.type === 'success' ? '✓' : item.type === 'warning' ? '!' : 'i'}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.detail}</span></span><span className="notification-time">{item.time}</span>{!item.read && <span className="unread-dot" />}</button>)}</div>{!visible.length && <div className="empty-state"><span className="empty-mark">—</span><strong>No notifications in this view</strong><p>New assignment and workflow events appear here.</p></div>}</Panel>
  </>;
}

function AuditPage() {
  const { data } = useOperations();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('All roles');
  const rows = data.audit.filter((item) => (role === 'All roles' || item.role === role) && `${item.action} ${item.user} ${item.ref}`.toLowerCase().includes(query.toLowerCase()));
  return <>
    <PageHeader eyebrow="ADMINISTRATION · SIMULATED ACTIVITY" title="Activity history" description="A prototype activity feed for reviewing changes. This is not an immutable or authoritative audit log." />
    <div className="toolbar"><label className="search-field"><Icon name="search" size={17} /><input placeholder="Search action, user or reference" value={query} onChange={(event) => setQuery(event.target.value)} /></label><select value={role} onChange={(event) => setRole(event.target.value)}><option>All roles</option>{roles.map((item) => <option key={item}>{item}</option>)}</select></div>
    <Panel title="Recorded demo activity" description={`${rows.length} entries in local browser state.`}><DataTable rows={rows} columns={[{ key: 'time', label: 'Time' }, { key: 'action', label: 'Activity', render: (item) => <strong>{item.action}</strong> }, { key: 'user', label: 'User', render: (item) => <><strong>{item.user}</strong><small>{item.role}</small></> }, { key: 'ref', label: 'Related record', render: (item) => <span className="record-id">{item.ref}</span> }, { key: 'before', label: 'Previous value' }, { key: 'after', label: 'Updated value' }]} /></Panel>
  </>;
}

function UsersPage() {
  const { data, updateUser, addUser } = useOperations();
  const [createOpen, setCreateOpen] = useState(false);
  return <>
    <PageHeader eyebrow="ADMINISTRATION · ROLE SIMULATION" title="Users & roles" description="Manage synthetic demo users and preview role assignment. Changes are local and are not backend-enforced." actions={<button className="button button-primary" onClick={() => setCreateOpen(true)}><Icon name="plus" size={16} /> Add demo user</button>} />
    <div className="warning-note page-notice"><strong>Demonstration only</strong><span>Role controls illustrate the proposed experience. They do not authenticate users or enforce real permissions.</span></div>
    <Panel title="Demo user directory" description={`${data.users.length} synthetic users`}>
      <DataTable rows={data.users} columns={[{ key: 'name', label: 'User', render: (item) => <div className="user-cell"><span className="avatar">{item.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</span><strong>{item.name}</strong></div> }, { key: 'department', label: 'Department' }, { key: 'role', label: 'Assigned role', render: (item) => <select className="compact-select role-select" aria-label={`Change role for ${item.name}`} value={item.role} onChange={(event) => updateUser(item.id, { role: event.target.value })}>{roles.map((role) => <option key={role}>{role}</option>)}</select> }, { key: 'status', label: 'Status', render: (item) => <button className="status-toggle" onClick={() => updateUser(item.id, { status: item.status === 'Active' ? 'Inactive' : 'Active' })}><Status>{item.status}</Status></button> }]} />
    </Panel>
    {createOpen && <Modal title="Add a demo user" subtitle="Create a synthetic user profile for role-preview purposes." onClose={() => setCreateOpen(false)}><form className="form-grid form-single" onSubmit={(event) => { event.preventDefault(); const f = new FormData(event.currentTarget); addUser({ name: f.get('name'), department: f.get('department'), role: f.get('role') }); setCreateOpen(false); }}><Field label="Name"><input name="name" required /></Field><Field label="Department"><select name="department">{['District Administration', ...departments].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Role"><select name="role">{roles.map((item) => <option key={item}>{item}</option>)}</select></Field><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setCreateOpen(false)}>Cancel</button><button className="button button-primary">Add user</button></div></form></Modal>}
  </>;
}

function GovernancePage() {
  const [controls, setControls] = useState({ review: true, citations: true, manual: true, logging: true, notice: true });
  const toggles = [['review', 'Human review before consequential action', 'AI-generated content remains a draft until an authorized person reviews it.'], ['citations', 'Source references shown with answers', 'Users can inspect supporting mock records and synthetic documents.'], ['manual', 'Manual fallback available', 'Workflows can continue without an AI suggestion.'], ['logging', 'Activity history enabled for the demo', 'Prototype actions are recorded in browser state, not an immutable audit log.'], ['notice', 'AI processing disclosure shown', 'Users are told when an illustrative response is being demonstrated.']];
  const risks = [
    ['Incorrect or incomplete AI output', 'Human review, source citations, editable drafts and manual fallback', 'Open'],
    ['Sensitive information exposure', 'Department-scoped visibility concept; no real records or external AI service in demo', 'Monitor'],
    ['Integration or service failure', 'Manual workflow remains available; no integration is claimed', 'Mitigated in prototype'],
    ['Notification failure', 'Central event feed and direct task list provide alternate visibility', 'Monitor'],
    ['Low staff adoption', 'Role-based walkthrough, clear ownership and user feedback during pilot', 'Pilot control'],
  ];
  return <>
    <PageHeader eyebrow="GOVERNANCE · DEMONSTRATION CONTROLS" title="AI governance & safeguards" description="A prototype view of the proposed governance experience; it does not configure deployed infrastructure." />
    <div className="governance-grid"><Panel title="Responsible AI controls" description="Toggle the illustrative settings to preview the governance interface.">{toggles.map(([key, title, detail]) => <label className="governance-control" key={key}><div><strong>{title}</strong><span>{detail}</span></div><input type="checkbox" checked={controls[key]} onChange={(event) => setControls((current) => ({ ...current, [key]: event.target.checked }))} aria-label={title} /></label>)}</Panel><Panel title="Demo environment" description="No actual government system or external AI service is connected."><div className="governance-facts"><div><span>Data source</span><strong>Local synthetic records</strong></div><div><span>AI processing</span><strong>Illustrative client-side simulation</strong></div><div><span>Role permissions</span><strong>Frontend navigation preview</strong></div><div><span>Audit retention</span><strong>Browser-local demo state</strong></div><div><span>Approved sources</span><strong>Fictional samples only</strong></div><div><span>Human decision authority</span><strong>Always retained by officer</strong></div></div><div className="warning-note"><strong>Never treat this prototype as an official record</strong><span>All content is fictional and must not be used to guide real government decisions.</span></div></Panel></div>
    <Panel title="Prototype risk register" description="Illustrative risks and controls for assessment discussion."><DataTable rows={risks.map(([risk, control, status], index) => ({ id: index, risk, control, status }))} columns={[{ key: 'risk', label: 'Risk', render: (item) => <strong>{item.risk}</strong> }, { key: 'control', label: 'Mitigation / fallback' }, { key: 'status', label: 'Review state', render: (item) => <Status>{item.status}</Status> }]} /></Panel>
  </>;
}

function GrievancePortalPage() {
  const [portalPath, setPortalPath] = useState('/');
  const [frameKey, setFrameKey] = useState(0);
  const openPortal = (path) => {
    setPortalPath(path);
    setFrameKey((current) => current + 1);
  };
  return <>
    <PageHeader eyebrow="OPERATIONS · CONNECTED CASE WORKSPACE" title="AI grievance system" description="The existing citizen and officer grievance portal is included as a separate application with its own routes." actions={<div className="portal-actions"><button className={`button ${portalPath === '/' ? 'button-primary' : 'button-secondary'}`} onClick={() => openPortal('/')}>Citizen portal</button><button className={`button ${portalPath === '/login' ? 'button-primary' : 'button-secondary'}`} onClick={() => openPortal('/login')}>Officer sign in</button></div>} />
    <div className="portal-notice"><strong>Separate routed application</strong><span>Grievance portal paths are isolated in this embedded view. API requests use <code>http://localhost:8000</code> by default; run the existing backend separately for live API workflows.</span></div>
    <div className="grievance-frame-wrap"><iframe key={frameKey} className="grievance-frame" title="AI Grievance Management System" src={`/grievance-portal/index.html#${portalPath}`} /></div>
  </>;
}

const pages = {
  dashboard: DashboardPage,
  tasks: TasksPage,
  coordination: CoordinationPage,
  meetings: MeetingsPage,
  files: FilesPage,
  reports: ReportsPage,
  documents: DocumentsPage,
  knowledge: KnowledgePage,
  field: FieldPage,
  assistant: AssistantPage,
  agents: AgentsPage,
  voice: VoicePage,
  notifications: NotificationsPage,
  audit: AuditPage,
  users: UsersPage,
  governance: GovernancePage,
  grievances: GrievancePortalPage,
};

export function ModulePage({ module }) {
  const Page = pages[module] || DashboardPage;
  return <Page />;
}
