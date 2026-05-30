// API utility functions - centralized endpoint calls
const API_BASE = 'http://127.0.0.1:8000';

const getHeaders = (token, includeCSRF = false, csrf = null) => ({
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...(includeCSRF && csrf && { 'X-CSRF-Token': csrf }),
});

export const apiPatient = {
  getDetails: async (patientId, token) => {
    const res = await fetch(`${API_BASE}/patient/${patientId}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get patient details');
    return res.json();
  },

  getHistory: async (patientId, token, limit = 50, offset = 0) => {
    const res = await fetch(
      `${API_BASE}/patient/${patientId}/history?limit=${limit}&offset=${offset}`,
      { headers: getHeaders(token) }
    );
    if (!res.ok) throw new Error('Failed to get patient history');
    return res.json();
  },

  getAnalysis: async (patientId, token, limit = 20) => {
    const res = await fetch(
      `${API_BASE}/patient/${patientId}/analysis?limit=${limit}`,
      { headers: getHeaders(token) }
    );
    if (!res.ok) throw new Error('Failed to get patient analysis');
    return res.json();
  },

  addRecord: async (patientId, record, token, csrf) => {
    const res = await fetch(`${API_BASE}/patient/${patientId}/record`, {
      method: 'POST',
      headers: getHeaders(token, true, csrf),
      body: JSON.stringify(record),
    });
    if (!res.ok) throw new Error('Failed to add record');
    return res.json();
  },
};

export const apiAdmin = {
  getLoginHistory: async (username, token, limit = 50) => {
    const res = await fetch(`${API_BASE}/user/${username}/login-history?limit=${limit}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get login history');
    return res.json();
  },

  getCriticalPatients: async (token, limit = 50) => {
    const res = await fetch(`${API_BASE}/patients/critical?limit=${limit}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get critical patients');
    return res.json();
  },
};

export const apiAuth = {
  signup: async (username, password, role = 'patient') => {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, role }),
    });
    if (!res.ok) throw new Error('Signup failed');
    return res.json();
  },

  login: async (username, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Login failed');
    return res.json();
  },

  getMe: async (token) => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get user info');
    return res.json();
  },
};

export const apiHospital = {
  getDashboard: async (token, page = 1, pageSize = 25) => {
    const res = await fetch(
      `${API_BASE}/hospital-dashboard?page=${page}&page_size=${pageSize}`,
      { headers: getHeaders(token) }
    );
    if (!res.ok) throw new Error('Failed to get hospital dashboard');
    return res.json();
  },

  updateAvailability: async (hospital, beds, icu, ventilators, token, csrf) => {
    const res = await fetch(`${API_BASE}/hospital-dashboard/update`, {
      method: 'POST',
      headers: getHeaders(token, true, csrf),
      body: JSON.stringify({
        hospital,
        available_beds: beds,
        icu_beds: icu,
        ventilators,
        availability_mode: 'open',
      }),
    });
    if (!res.ok) throw new Error('Failed to update hospital');
    return res.json();
  },

  getNearestBeds: async (residence, token, severity = null, symptoms = null) => {
    const params = new URLSearchParams({
      residence,
      limit: 3,
      scope: 'local',
      ...(severity && { severity }),
      ...(symptoms && { symptoms }),
    });
    const res = await fetch(`${API_BASE}/nearest-bed-options?${params}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get bed options');
    return res.json();
  },

  emergencyICU: async (residence, token, lat = null, lon = null) => {
    const params = new URLSearchParams({
      residence,
      ...(lat && { lat }),
      ...(lon && { lon }),
    });
    const res = await fetch(`${API_BASE}/emergency-nearest-icu?${params}`, {
      headers: getHeaders(token),
    });
    if (!res.ok) throw new Error('Failed to get emergency ICU');
    return res.json();
  },

  bookBed: async (booking, token, csrf) => {
    const res = await fetch(`${API_BASE}/book-bed`, {
      method: 'POST',
      headers: getHeaders(token, true, csrf),
      body: JSON.stringify(booking),
    });
    if (!res.ok) throw new Error('Failed to book bed');
    return res.json();
  },
};

export default { apiPatient, apiAdmin, apiAuth, apiHospital };
