const getApiBaseUrl = () => {
  const env = process.env.REACT_APP_API_URL;
  if (env && String(env).trim()) return String(env).replace(/\/$/, '');
  return window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
};

const API_BASE_URL = getApiBaseUrl();
// Try admin path first; fallback to standalone path if 404 (handles different deployment setups)
const ONE_TO_ONE_API_ADMIN = `${API_BASE_URL}/api/admin/one-to-one-batches`;
const ONE_TO_ONE_API_STANDALONE = `${API_BASE_URL}/api/one-to-one-batches`;

// Resolve which base URL works (cached after first check)
// Admin path exists if we get 200 or 401; use standalone only on 404/network error
let _resolvedBase = null;
const resolveBaseUrl = async () => {
  if (_resolvedBase) return _resolvedBase;
  try {
    const r = await fetch(`${ONE_TO_ONE_API_ADMIN}/ping`, { headers: getAuthHeaders() });
    if (r.status !== 404) {
      _resolvedBase = ONE_TO_ONE_API_ADMIN;
      return _resolvedBase;
    }
  } catch (_) {}
  _resolvedBase = ONE_TO_ONE_API_STANDALONE;
  return _resolvedBase;
};

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
};

export const oneToOneBatchService = {
  getAllBatches: async () => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  getBatchById: async (id) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${id}`, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  createBatch: async (batchData) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(batchData)
    });
    return handleResponse(response);
  },

  updateBatch: async (id, batchData) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(batchData)
    });
    return handleResponse(response);
  },

  deleteBatch: async (id) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  addVideo: async (batchId, video) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/videos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(video)
    });
    return handleResponse(response);
  },

  updateVideo: async (batchId, videoId, video) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/videos/${videoId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(video)
    });
    return handleResponse(response);
  },

  deleteVideo: async (batchId, videoId) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  removeVideo: async (batchId, videoIndex) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/videos/${videoIndex}/index`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  updateStudent: async (batchId, studentData) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(studentData)
    });
    return handleResponse(response);
  },

  removeStudent: async (batchId) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/students`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  getBatchesByCourse: async (courseName) => {
    const base = await resolveBaseUrl();
    const url = `${base}/course/${encodeURIComponent(courseName)}`;
    const response = await fetch(url, { headers: getAuthHeaders() });
    return handleResponse(response);
  },

  updateProgress: async (batchId, progress) => {
    const base = await resolveBaseUrl();
    const response = await fetch(`${base}/${batchId}/progress`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ progress })
    });
    return handleResponse(response);
  },

  getUnassignedStudents: async (course, currentBatchId = null) => {
    const base = await resolveBaseUrl();
    let url = `${base}/unassigned-students/${encodeURIComponent(course)}`;
    if (currentBatchId) {
      url += `?currentBatchId=${currentBatchId}`;
    }
    
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    
    return handleResponse(response);
  }
};
