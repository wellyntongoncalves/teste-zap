import axios from 'axios';

const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new Event('auth:logout'));
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    throw new Error('Sem refresh token disponível');
  }

  const { data } = await axios.post(`${baseURL}/auth/refresh`, { refreshToken });
  localStorage.setItem('token', data.token);
  localStorage.setItem('refreshToken', data.refreshToken);
  return data.token;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;

    if (response?.status === 401 && config && !config._retry && !config.url.includes('/auth/')) {
      config._retry = true;
      try {
        refreshPromise = refreshPromise || refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        config.headers.Authorization = `Bearer ${newToken}`;
        return api(config);
      } catch (refreshError) {
        refreshPromise = null;
        clearSession();
      }
    }

    return Promise.reject(error);
  }
);

async function downloadFile(url, filename) {
  const response = await api.get(url, { responseType: 'blob' });
  const objectUrl = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

export { clearSession, downloadFile };
export default api;
