const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

async function parseResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Request failed');
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
    return response.blob();
  }

  return response.json();
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  return parseResponse(response);
}

async function downloadRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
  });
  return parseResponse(response);
}

export const api = {
  requestOtp: (payload) =>
    request('/api/auth/request-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  verifyOtp: (payload) =>
    request('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: (token) => request('/api/auth/me', { token }),
  logout: (token) =>
    request('/api/auth/logout', {
      method: 'POST',
      token,
    }),
  createComplaint: (payload, token) =>
    request('/api/complaints', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }),
  updateComplaint: (id, payload, token) =>
    request(`/api/complaints/${id}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(payload),
    }),
  updateComplaintStatus: (id, payload, token) =>
    request(`/api/complaints/${id}/status`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    }),
  listComplaints: (token) => request('/api/complaints', { token }),
  getComplaint: (id, token) => request(`/api/complaints/${id}`, { token }),
  uploadEvidence: (complaintId, formData, token) =>
    request(`/api/evidence/${complaintId}/upload`, {
      method: 'POST',
      token,
      body: formData,
    }),
  extractEvidenceMetadata: (complaintId, formData, token) =>
    request(`/api/evidence/${complaintId}/extract-metadata`, {
      method: 'POST',
      token,
      body: formData,
    }),
  updateEvidenceMetadata: (evidenceId, payload, token) =>
    request(`/api/evidence/${evidenceId}/metadata`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(payload),
    }),
  downloadEvidence: (evidenceId, token) => downloadRequest(`/api/evidence/${evidenceId}/download`, { token }),
  downloadPackage: (complaintId, token) => downloadRequest(`/api/complaints/${complaintId}/package`, { token }),
  getJurisdiction: (state, fraudType) =>
    request(`/api/jurisdiction?state=${encodeURIComponent(state)}&fraudType=${encodeURIComponent(fraudType)}`),
};

export function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
