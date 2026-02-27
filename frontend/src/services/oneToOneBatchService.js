const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';

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
  // Get all one-to-one batches
  getAllBatches: async () => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get specific one-to-one batch by ID
  getBatchById: async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${id}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Create new one-to-one batch
  createBatch: async (batchData) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(batchData)
    });
    return handleResponse(response);
  },

  // Update one-to-one batch
  updateBatch: async (id, batchData) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(batchData)
    });
    return handleResponse(response);
  },

  // Delete one-to-one batch
  deleteBatch: async (id) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Add video to batch
  addVideo: async (batchId, video) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/videos`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(video)
    });
    return handleResponse(response);
  },

  // Update video in batch
  updateVideo: async (batchId, videoId, video) => {
    console.log('oneToOneBatchService.updateVideo called with:', { batchId, videoId, video });
    const url = `${API_BASE_URL}/api/one-to-one-batches/${batchId}/videos/${videoId}`;
    console.log('Making PUT request to:', url);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(video)
    });
    
    console.log('Response status:', response.status);
    console.log('Response ok:', response.ok);
    
    const result = await handleResponse(response);
    console.log('Service response:', result);
    return result;
  },

  // Remove video from batch
  deleteVideo: async (batchId, videoId) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/videos/${videoId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Remove video from batch by index
  removeVideo: async (batchId, videoIndex) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/videos/${videoIndex}/index`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Update student in batch
  updateStudent: async (batchId, studentData) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(studentData)
    });
    return handleResponse(response);
  },

  // Remove student from batch
  removeStudent: async (batchId) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/students`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Get batches by course
  getBatchesByCourse: async (courseName) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/course/${encodeURIComponent(courseName)}`, {
      headers: getAuthHeaders()
    });
    return handleResponse(response);
  },

  // Update batch progress
  updateProgress: async (batchId, progress) => {
    const response = await fetch(`${API_BASE_URL}/api/one-to-one-batches/${batchId}/progress`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ progress })
    });
    return handleResponse(response);
  },

  // Get unassigned students for a course
  getUnassignedStudents: async (course, currentBatchId = null) => {
    let url = `${API_BASE_URL}/api/one-to-one-batches/unassigned-students/${encodeURIComponent(course)}`;
    if (currentBatchId) {
      url += `?currentBatchId=${currentBatchId}`;
    }
    
    const response = await fetch(url, {
      headers: getAuthHeaders()
    });
    
    return handleResponse(response);
  }
};
