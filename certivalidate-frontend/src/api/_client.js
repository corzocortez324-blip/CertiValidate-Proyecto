let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
if (!envUrl.endsWith('/api')) envUrl += '/api';
const API_BASE = envUrl;

class ApiError extends Error {
  constructor(message, statusCode, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.data = data;
  }
}

const getToken = () => localStorage.getItem('token');
const getRefreshToken = () => localStorage.getItem('refreshToken');
const setTokens = (token, refreshToken) => {
  localStorage.setItem('token', token);
  localStorage.setItem('refreshToken', refreshToken);
};
const clearTokens = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
};

let isRefreshing = false;
let refreshSubscribers = [];

const onRefreshed = (newToken) => {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
};

const addRefreshSubscriber = (cb) => {
  refreshSubscribers.push(cb);
};

const request = async (endpoint, options = {}) => {
  const { body, method = 'GET', auth = true, raw = false, headers: extraHeaders = {} } = options;

  const headers = { ...extraHeaders };
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const config = { method, headers };

  if (body) {
    config.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  let res = await fetch(`${API_BASE}${endpoint}`, config);

  if (res.status === 401 && auth && getRefreshToken()) {
    if (!isRefreshing) {
      isRefreshing = true;
      // Snapshot the refresh token so a concurrent new login doesn't get overwritten
      const capturedRefreshToken = getRefreshToken();
      try {
        const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: capturedRefreshToken }),
        });
        const refreshData = await refreshRes.json();
        if (refreshRes.ok && refreshData.success) {
          // Only persist new tokens if no new login replaced them while we were refreshing
          if (getRefreshToken() === capturedRefreshToken) {
            setTokens(refreshData.data.token, refreshData.data.refreshToken);
          }
          const activeToken = getToken();
          onRefreshed(activeToken);
          isRefreshing = false;
          headers['Authorization'] = `Bearer ${activeToken}`;
          res = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
        } else {
          refreshSubscribers = [];
          clearTokens();
          window.location.href = '/login';
          throw new ApiError('Sesión expirada', 401);
        }
      } catch (err) {
        isRefreshing = false;
        refreshSubscribers = [];
        clearTokens();
        window.location.href = '/login';
        throw err;
      }
    } else {
      // Queue this request until the ongoing refresh completes
      return new Promise((resolve, reject) => {
        addRefreshSubscriber(async (newToken) => {
          try {
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryRes = await fetch(`${API_BASE}${endpoint}`, { ...config, headers });
            if (raw) { resolve(retryRes); return; }
            const retryData = await retryRes.json();
            if (!retryRes.ok || retryData.success === false) {
              reject(new ApiError(retryData.message || 'Error desconocido', retryRes.status, retryData));
            } else {
              resolve(retryData);
            }
          } catch (err) {
            reject(err);
          }
        });
      });
    }
  }

  if (raw) return res;

  const data = await res.json();

  if (!res.ok || data.success === false) {
    throw new ApiError(data.message || 'Error desconocido', res.status, data);
  }

  return data;
};

export { request, getToken, getRefreshToken, setTokens, clearTokens, ApiError, API_BASE };
