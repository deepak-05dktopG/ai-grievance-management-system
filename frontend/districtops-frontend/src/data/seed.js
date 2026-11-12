export const roles = [
  'District Collector / DM',
  'Additional District Magistrate',
  'Department Head',
  'Section Officer / Clerk',
  'Field Officer',
  'IT / Administrator',
];

export const departments = [
  'Revenue',
  'Public Works',
  'Health',
  'Education',
  'Civil Supplies',
  'Rural Development',
  'Agriculture',
  'Irrigation',
  'Municipal Administration',
];

export const initialState = {
  tasks: [
    { id: 'T-26041', title: 'Restore drinking water supply at Kalyanpur', department: 'Public Works', owner: 'A. Sharma', priority: 'High', status: 'In Progress', due: '2026-11-13', source: 'District review · 08 Nov', summary: 'Repair the damaged pump and submit a site verification report with photographs.', deliverables: 'Repair completion note; site photographs', updated: 'Today, 10:24' },
    { id: 'T-26040', title: 'Verify pending ration card applications', department: 'Civil Supplies', owner: 'R. Verma', priority: 'Normal', status: 'Acknowledgment Pending', due: '2026-11-14', source: 'Collector instruction · 07 Nov', summary: 'Reconcile the pending application list and report cases awaiting documents.', deliverables: 'Reconciled application list', updated: '08 Nov, 16:40' },
    { id: 'T-26039', title: 'Prepare school repair estimate', department: 'Education', owner: 'P. Singh', priority: 'High', status: 'Clarification Required', due: '2026-11-12', source: 'Monsoon preparedness meeting', summary: 'Provide a costed estimate for priority classroom repairs in three blocks.', deliverables: 'Block-wise estimate; priority list', updated: 'Yesterday, 15:10' },
    { id: 'T-26038', title: 'Submit primary health centre staffing position', department: 'Health', owner: 'Dr. N. Khan', priority: 'Normal', status: 'Under Review', due: '2026-11-11', source: 'Monthly health review', summary: 'Share facility-wise vacancies and interim coverage arrangements.', deliverables: 'Facility-wise staffing statement', updated: '10 Nov, 12:05' },
    { id: 'T-26037', title: 'Clear blocked drains in Ward 6', department: 'Municipal Administration', owner: 'M. Rao', priority: 'Critical', status: 'Overdue', due: '2026-11-08', source: 'Field inspection · 04 Nov', summary: 'Clear the identified drainage points and confirm disposal of silt.', deliverables: 'Completion note; before/after photographs', updated: '07 Nov, 17:20' },
    { id: 'T-26036', title: 'Complete crop loss verification', department: 'Agriculture', owner: 'S. Patel', priority: 'Normal', status: 'Completed', due: '2026-11-10', completedAt: '2026-11-10', source: 'Relief coordination meeting', summary: 'Consolidate verified crop-loss entries from the affected villages.', deliverables: 'Signed village summary', updated: '10 Nov, 16:55' },
    { id: 'T-26035', title: 'Inspect embankment at Nandpur stretch', department: 'Irrigation', owner: 'V. Yadav', priority: 'High', status: 'Acknowledged', due: '2026-11-15', source: 'Seasonal readiness review', summary: 'Inspect the embankment and list any immediate protection works.', deliverables: 'Inspection checklist; risk note', updated: '09 Nov, 11:15' },
    { id: 'T-26034', title: 'Compile rural road progress update', department: 'Rural Development', owner: 'K. Das', priority: 'Normal', status: 'In Progress', due: '2026-11-16', source: 'Weekly infrastructure review', summary: 'Report work completed, expenditure and constraints for active works.', deliverables: 'Scheme-wise progress statement', updated: 'Today, 09:05' },
  ],
  meetings: [
    { id: 'M-118', title: 'Weekly district operations review', date: '2026-11-13', time: '11:00', venue: 'Collectorate · Meeting Room 1', participants: 'Department heads', purpose: 'Review overdue actions and the district service position.', agenda: 'Department progress; drinking water; pending acknowledgments', actions: 4, status: 'Scheduled' },
    { id: 'M-117', title: 'Monsoon preparedness follow-up', date: '2026-11-08', time: '15:00', venue: 'Video conference', participants: 'PWD, Irrigation, Revenue', purpose: 'Review readiness and cross-department dependencies.', agenda: 'Embankment inspection; drainage; school repairs', actions: 6, status: 'Minutes approved' },
    { id: 'M-116', title: 'Monthly health review', date: '2026-11-05', time: '10:30', venue: 'Collectorate · Meeting Room 2', participants: 'Health department, ADM', purpose: 'Review facility staffing and service continuity.', agenda: 'Vacancy statement; interim coverage; medicine availability', actions: 3, status: 'Minutes pending review' },
  ],
  files: [
    { id: 'DF-2026-0841', subject: 'Drinking water supply restoration — Kalyanpur', department: 'Public Works', sender: 'Block Development Office', owner: 'A. Sharma', section: 'Works Review', received: '2026-11-09', due: '2026-11-15', status: 'Under Review', step: 3, summary: 'Request for coordinated repair and site verification.' },
    { id: 'DF-2026-0838', subject: 'School building repair proposals', department: 'Education', sender: 'District Education Office', owner: 'P. Singh', section: 'Education Cell', received: '2026-11-07', due: '2026-11-12', status: 'Clarification Required', step: 2, summary: 'Three block-level proposals require a consolidated estimate.' },
    { id: 'DF-2026-0832', subject: 'Seasonal embankment inspection note', department: 'Irrigation', sender: 'Sub-divisional Office', owner: 'V. Yadav', section: 'Disaster Coordination', received: '2026-11-04', due: '2026-11-14', status: 'Assigned', step: 2, summary: 'Inspection findings for the Nandpur stretch.' },
  ],
  documents: [
    { id: 'DOC-018', title: 'District Water Safety Review — working note', category: 'Review note', department: 'Public Works', date: '2026-11-09', ref: 'DF-2026-0841', text: 'Pump repair at Kalyanpur is in progress. The field team reported that a replacement valve is required before the supply can be restored. Site verification is planned after the repair.' },
    { id: 'DOC-016', title: 'Monsoon readiness coordination record', category: 'Meeting record', department: 'Irrigation', date: '2026-11-08', ref: 'M-117', text: 'Departments will share inspection updates before the next review. The Nandpur embankment inspection and Ward 6 drainage clearance remain priority actions.' },
    { id: 'DOC-012', title: 'School infrastructure proposals — block summary', category: 'Department report', department: 'Education', date: '2026-11-07', ref: 'DF-2026-0838', text: 'Three blocks submitted repair proposals. A consolidated cost estimate and an agreed priority order are still required for review.' },
  ],
  circulars: [
    { id: 'SYN-2026-014', title: 'Illustrative District Drinking Water Inspection Checklist', category: 'Public services', department: 'Public Works', date: '2026-10-28', version: '1.2', pages: 4, sections: ['Inspection preparation', 'Site checklist', 'Reporting and follow-up'], text: 'The inspection record should note the service location, date, observed condition, immediate risks and follow-up owner. Include supporting photographs where available and record any access or supply constraints.' },
    { id: 'SYN-2026-011', title: 'Illustrative Seasonal Infrastructure Review Note', category: 'Infrastructure', department: 'Irrigation', date: '2026-10-16', version: '1.0', pages: 3, sections: ['Pre-review checks', 'Interdepartmental coordination'], text: 'Departments may consolidate site observations before a coordination review. Record unresolved dependencies and identify the responsible section for follow-up. This synthetic note is for demonstration only.' },
    { id: 'SYN-2026-008', title: 'Illustrative File Movement and Review Checklist', category: 'Administration', department: 'Revenue', date: '2026-09-30', version: '2.0', pages: 5, sections: ['Receipt and registration', 'Review and decision record'], text: 'Register incoming correspondence with a reference, receiving section and due date. Record each transfer and review action in the movement history. This synthetic note does not state actual government procedure.' },
  ],
  inspections: [
    { id: 'FI-062', site: 'Kalyanpur water point', department: 'Public Works', officer: 'A. Sharma', date: '2026-11-12', status: 'Scheduled', checklist: 'Pump condition; supply continuity; repair evidence', report: '' },
    { id: 'FI-061', site: 'Ward 6 drainage points', department: 'Municipal Administration', officer: 'M. Rao', date: '2026-11-07', status: 'Report submitted', checklist: 'Drain clearance; silt disposal; access restored', report: 'Two of three points are clear. The third is obstructed by a damaged cover and needs a safety barrier before work can resume.' },
    { id: 'FI-060', site: 'Nandpur embankment stretch', department: 'Irrigation', officer: 'V. Yadav', date: '2026-11-06', status: 'Reviewed', checklist: 'Visible seepage; erosion; access; protection material', report: 'No visible seepage at the inspected locations. Access to the northern approach remains restricted after rain.' },
  ],
  notifications: [
    { id: 'N-301', title: 'Acknowledgment pending', detail: 'Ration card application verification · Civil Supplies', time: '12 min ago', type: 'warning', read: false },
    { id: 'N-300', title: 'Deadline approaching', detail: 'School repair estimate · due tomorrow', time: '46 min ago', type: 'info', read: false },
    { id: 'N-299', title: 'Progress update received', detail: 'Rural road progress update · Rural Development', time: 'Today, 09:05', type: 'success', read: true },
    { id: 'N-298', title: 'Clarification requested', detail: 'School repair estimate · Education', time: 'Yesterday', type: 'warning', read: true },
  ],
  audit: [
    { id: 'A-901', action: 'Progress update recorded', user: 'K. Das', role: 'Department Head', ref: 'T-26034', time: 'Today, 09:05', before: 'In Progress', after: 'In Progress' },
    { id: 'A-900', action: 'Clarification requested', user: 'P. Singh', role: 'Department Head', ref: 'T-26039', time: 'Yesterday, 15:10', before: 'Assigned', after: 'Clarification Required' },
    { id: 'A-899', action: 'Task completed', user: 'S. Patel', role: 'Department Head', ref: 'T-26036', time: '10 Nov, 16:55', before: 'In Progress', after: 'Completed' },
    { id: 'A-898', action: 'File assigned for review', user: 'R. Mehta', role: 'ADM', ref: 'DF-2026-0841', time: '09 Nov, 14:30', before: 'Registered', after: 'Under Review' },
  ],
  users: [
    { id: 'U-01', name: 'R. Mehta', role: 'District Collector / DM', department: 'District Administration', status: 'Active' },
    { id: 'U-02', name: 'S. Iyer', role: 'Additional District Magistrate', department: 'District Administration', status: 'Active' },
    { id: 'U-03', name: 'A. Sharma', role: 'Department Head', department: 'Public Works', status: 'Active' },
    { id: 'U-04', name: 'P. Singh', role: 'Department Head', department: 'Education', status: 'Active' },
    { id: 'U-05', name: 'M. Rao', role: 'Field Officer', department: 'Municipal Administration', status: 'Active' },
    { id: 'U-06', name: 'K. Das', role: 'Section Officer / Clerk', department: 'Rural Development', status: 'Active' },
  ],
};

export const navigation = [
  { section: 'OVERVIEW', items: [{ id: 'dashboard', label: 'Collector dashboard', mark: 'OV' }, { id: 'reports', label: 'Reports & analytics', mark: 'RP' }] },
  { section: 'OPERATIONS', items: [{ id: 'tasks', label: 'Tasks & deadlines', mark: 'TK' }, { id: 'coordination', label: 'Department coordination', mark: 'CO' }, { id: 'meetings', label: 'Meetings & actions', mark: 'MT' }, { id: 'files', label: 'File tracking', mark: 'FL' }, { id: 'field', label: 'Field operations', mark: 'FO' }, { id: 'grievances', label: 'AI grievance system', mark: 'GR' }] },
  { section: 'KNOWLEDGE', items: [{ id: 'documents', label: 'Document intelligence', mark: 'DI' }, { id: 'knowledge', label: 'Circular search', mark: 'KS' }] },
  { section: 'ASSISTED WORK', items: [{ id: 'assistant', label: 'Administrative assistant', mark: 'AI' }, { id: 'agents', label: 'Controlled AI workflow', mark: 'WF' }, { id: 'voice', label: 'Chat & voice demo', mark: 'VC' }] },
  { section: 'ADMINISTRATION', items: [{ id: 'notifications', label: 'Notifications', mark: 'NT' }, { id: 'audit', label: 'Activity history', mark: 'AH' }, { id: 'users', label: 'Users & roles', mark: 'UR' }, { id: 'governance', label: 'AI governance', mark: 'GV' }] },
];
