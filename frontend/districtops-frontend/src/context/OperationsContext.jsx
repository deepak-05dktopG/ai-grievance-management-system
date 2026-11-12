import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialState } from '../data/seed';

const OperationsContext = createContext(null);
const STORAGE_KEY = 'districtops-demo-state-v1';
const sessionKey = 'districtops-demo-user-v1';

function readStoredState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...initialState, ...JSON.parse(stored) } : initialState;
  } catch (error) {
    console.error('Unable to restore the DistrictOps demo state.', error);
    return initialState;
  }
}

function readUser() {
  try {
    return JSON.parse(localStorage.getItem(sessionKey) || 'null');
  } catch (error) {
    console.error('Unable to restore the DistrictOps demo session.', error);
    return null;
  }
}

export function OperationsProvider({ children }) {
  const [data, setData] = useState(readStoredState);
  const [user, setUser] = useState(readUser);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('Unable to save the DistrictOps demo state.', error);
    }
  }, [data]);

  useEffect(() => {
    try {
      if (user) localStorage.setItem(sessionKey, JSON.stringify(user));
      else localStorage.removeItem(sessionKey);
    } catch (error) {
      console.error('Unable to save the DistrictOps demo session.', error);
    }
  }, [user]);

  const addAudit = (action, ref, before = '—', after = '—') => {
    const actor = user || { name: 'R. Mehta', role: 'District Collector / DM' };
    const event = {
      id: `A-${Date.now()}`,
      action,
      user: actor.name,
      role: actor.role,
      ref,
      time: 'Just now',
      before,
      after,
    };
    setData((current) => ({ ...current, audit: [event, ...current.audit] }));
  };

  const updateTask = (id, patch, action = 'Task updated') => {
    const previous = data.tasks.find((task) => task.id === id);
    setData((current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? {
        ...task,
        ...patch,
        ...(patch.status === 'Completed' ? { completedAt: patch.completedAt || '2026-11-11' } : {}),
        updated: 'Just now',
      } : task),
    }));
    addAudit(action, id, previous?.status || '—', patch.status || previous?.status || 'Updated');
    if (patch.status) {
      setData((current) => ({
        ...current,
        notifications: [{
          id: `N-${Date.now()}`,
          title: `Task ${patch.status.toLowerCase()}`,
          detail: `${id} · update recorded`,
          time: 'Just now',
          type: patch.status === 'Completed' ? 'success' : 'info',
          read: false,
        }, ...current.notifications],
      }));
    }
  };

  const createTask = (task) => {
    const id = `T-${Date.now().toString().slice(-5)}`;
    const linkedMeetingId = task.source?.match(/Meeting action · (M-\d+)/)?.[1];
    setData((current) => ({
      ...current,
      tasks: [{ ...task, id, status: task.status || 'Assigned', updated: 'Just now' }, ...current.tasks],
      meetings: linkedMeetingId
        ? current.meetings.map((meeting) => meeting.id === linkedMeetingId ? { ...meeting, actions: meeting.actions + 1 } : meeting)
        : current.meetings,
      notifications: [{ id: `N-${Date.now()}`, title: 'New task assigned', detail: `${task.title} · ${task.department}`, time: 'Just now', type: 'info', read: false }, ...current.notifications],
    }));
    addAudit('Task created and assigned', id, '—', 'Assigned');
    return id;
  };

  const addMeeting = (meeting) => {
    const id = `M-${Date.now().toString().slice(-4)}`;
    setData((current) => ({ ...current, meetings: [{ ...meeting, id, actions: 0, status: 'Scheduled' }, ...current.meetings] }));
    addAudit('Meeting scheduled', id);
  };

  const createFile = (file) => {
    const id = `DF-2026-${String(842 + data.files.length).padStart(4, '0')}`;
    setData((current) => ({ ...current, files: [{ ...file, id, status: 'Registered', step: 1 }, ...current.files] }));
    addAudit('File registered', id, 'Received', 'Registered');
    return id;
  };

  const moveFile = (id, direction) => {
    const stages = ['Received', 'Registered', 'Assigned', 'Under Review', 'Decision', 'Closed / Dispatched'];
    const file = data.files.find((item) => item.id === id);
    if (!file) return;
    const step = Math.max(0, Math.min(stages.length - 1, file.step + direction));
    const status = stages[step];
    setData((current) => ({ ...current, files: current.files.map((item) => item.id === id ? { ...item, step, status } : item) }));
    addAudit('File movement recorded', id, file.status, status);
  };

  const addDocument = (document) => {
    const id = `DOC-${String(Date.now()).slice(-3)}`;
    setData((current) => ({ ...current, documents: [{ ...document, id, date: new Date().toISOString().slice(0, 10), ref: 'Local upload' }, ...current.documents] }));
    addAudit('Document added to demo library', id);
    return id;
  };

  const updateInspection = (id, patch) => {
    const previous = data.inspections.find((item) => item.id === id);
    setData((current) => ({ ...current, inspections: current.inspections.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    addAudit('Field inspection updated', id, previous?.status || '—', patch.status || previous?.status || 'Updated');
  };

  const updateUser = (id, patch) => {
    const previous = data.users.find((item) => item.id === id);
    setData((current) => ({ ...current, users: current.users.map((item) => item.id === id ? { ...item, ...patch } : item) }));
    addAudit('Demo user permissions updated', id, previous?.role || previous?.status || '—', patch.role || patch.status || 'Updated');
  };

  const addUser = (item) => {
    const id = `U-${Date.now().toString().slice(-3)}`;
    setData((current) => ({ ...current, users: [{ ...item, id, status: 'Active' }, ...current.users] }));
    addAudit('Demo user added', id);
  };

  const markRead = (id) => {
    setData((current) => ({ ...current, notifications: current.notifications.map((item) => item.id === id ? { ...item, read: true } : item) }));
  };

  const value = useMemo(() => ({
    data,
    user,
    setUser,
    updateTask,
    createTask,
    addMeeting,
    createFile,
    moveFile,
    addDocument,
    updateInspection,
    updateUser,
    addUser,
    markRead,
    addAudit,
  }), [data, user]);

  return <OperationsContext.Provider value={value}>{children}</OperationsContext.Provider>;
}

export function useOperations() {
  const context = useContext(OperationsContext);
  if (!context) throw new Error('useOperations must be used within OperationsProvider');
  return context;
}
