const BASE = '/api';

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }
  return { success: response.ok, message: response.statusText };
}

async function request(path, options = {}) {
  const config = {
    method: options.method || 'GET',
    credentials: 'include',
    headers: { ...(options.headers || {}) }
  };

  if (options.body !== undefined && !(options.body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(options.body);
  }

  if (options.body instanceof FormData) {
    config.body = options.body;
  }

  let response;
  try {
    response = await fetch(`${BASE}${path}`, config);
  } catch (error) {
    throw new Error('Cannot connect to the ArtiFile server. Please check your connection and try again.');
  }

  const payload = await parseResponse(response);

  if (!response.ok) {
    const error = new Error(payload.message || 'The request could not be completed.');
    error.status = response.status;
    error.details = payload.details || null;
    throw error;
  }

  return payload;
}

function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.append(key, value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

export const api = {
  get: (path, params) => request(`${path}${buildQuery(params)}`),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  del: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', body: formData }),
  uploadPut: (path, formData) => request(path, { method: 'PUT', body: formData }),
  fileUrl: (documentId, download = false) =>
    `${BASE}/documents/${encodeURIComponent(documentId)}/download${download ? '?download=1' : ''}`
};

export default api;
