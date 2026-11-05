import axios from 'axios';

const TOKEN_KEY = 'creditfix_access_token';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const api = axios.create({
  baseURL: API_BASE_URL.replace(/\/$/, ''),
  timeout: 20000,
});

export function getAccessToken() {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAccessToken(null);
      if (window.location.pathname.startsWith('/dashboard')) {
        window.location.assign('/login?expired=1');
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error) {
  const status = error.response?.status;
  if (status === 401) return 'Your session expired or your credentials are invalid. Please sign in again.';
  if (status === 403) return 'You do not have permission to perform this action.';
  if (status === 404) return 'The requested grievance could not be found.';
  if (status === 413) return 'The selected file exceeds the 5 MB limit.';
  if (status === 415) return 'Choose a valid PDF, JPG, JPEG, or PNG file.';
  if (status === 503) return error.response?.data?.detail || 'The service is temporarily unavailable.';
  return error.response?.data?.detail || error.message || 'Something went wrong. Please try again.';
}

export const grievanceApi = {
  submit: (payload) => api.post('/api/v1/grievances', payload),
  list: (params) => api.get('/api/v1/grievances', { params }),
  get: (referenceId) => api.get(`/api/v1/grievances/${encodeURIComponent(referenceId)}`),
  track: (referenceId, token) =>
    api.get(`/api/v1/grievances/${encodeURIComponent(referenceId)}/track`, {
      headers: { 'X-Citizen-Access-Token': token },
    }),
  uploadDocument: (referenceId, file, citizenToken) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(
      `/api/v1/grievances/${encodeURIComponent(referenceId)}/documents`,
      formData,
      {
        headers: citizenToken
          ? { 'X-Citizen-Access-Token': citizenToken }
          : undefined,
      },
    );
  },
  review: (referenceId, payload) =>
    api.patch(`/api/v1/grievances/${encodeURIComponent(referenceId)}/review`, payload),
  updateStatus: (referenceId, status) =>
    api.patch(`/api/v1/grievances/${encodeURIComponent(referenceId)}/status`, { status }),
  audit: (referenceId) =>
    api.get(`/api/v1/grievances/${encodeURIComponent(referenceId)}/audit-logs`),
};

export const authApi = {
  login: (email, password) =>
    api.post('/api/v1/auth/login', { email, password }),
  me: () => api.get('/api/v1/auth/me'),
  createUser: (payload) => api.post('/api/v1/auth/users', payload),
};
