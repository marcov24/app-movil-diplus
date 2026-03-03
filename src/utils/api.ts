import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
export const SOCKET_URL = API_BASE_URL.replace('/api', '');

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['x-auth-token'] = token;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle 401 responses (unauthorized)
// Client routes are PUBLIC and should NEVER redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      const hash = window.location.hash || '';

      // Extract path from hash (with hash routing, path is in hash)
      const pathFromHash = hash.replace(/^#/, '');

      // Check if we're on a client route: /CLIENTCODE/...
      // CLIENTCODE pattern: lowercase alphanumeric and hyphens
      const isClientRoute = pathFromHash && /^\/[a-z0-9-]+(\/|$)/.test(pathFromHash);

      // Check if it's a public client endpoint
      const isPublicClientEndpoint = url.includes('/clients/code/');

      // Check if it's a client-scoped API endpoint (public)
      const isClientScopedEndpoint = /\/[a-z0-9-]+\/(areas|locations|parameters|data|alerts)/.test(url);

      // NEVER redirect for client routes - they are public
      // Only redirect for admin/protected routes
      if (!isClientRoute && !isPublicClientEndpoint && !isClientScopedEndpoint) {
        localStorage.removeItem('token');
        window.location.href = '#/admin/login';
      }
      // If on client route or public endpoint, do NOT redirect - let the error propagate
    }
    return Promise.reject(error);
  }
);

// MQTT Config
export const getMqttConfig = () => api.get('/config');
export const updateMqttConfig = (data: any) => api.put('/config', data);

// Areas
export const getAreas = (clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/areas` : '/areas';
  return api.get(url);
};
export const getArea = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/areas/${id}` : `/areas/${id}`;
  return api.get(url);
};
export const createArea = (data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/areas` : '/areas';
  return api.post(url, data);
};
export const updateArea = (id: string, data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/areas/${id}` : `/areas/${id}`;
  return api.put(url, data);
};
export const deleteArea = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/areas/${id}` : `/areas/${id}`;
  return api.delete(url);
};

// Locations
export const getLocations = (areaId?: string, clientCode?: string) => {
  const params = areaId ? { areaId } : {};
  const url = clientCode ? `/${clientCode}/locations` : '/locations';
  return api.get(url, { params });
};
export const getLocation = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/locations/${id}` : `/locations/${id}`;
  return api.get(url);
};
export const createLocation = (data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/locations` : '/locations';
  return api.post(url, data);
};
export const updateLocation = (id: string, data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/locations/${id}` : `/locations/${id}`;
  return api.put(url, data);
};
export const deleteLocation = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/locations/${id}` : `/locations/${id}`;
  return api.delete(url);
};

// Parameters
export const getParameters = (locationId?: string, clientCode?: string) => {
  const params = locationId ? { locationId } : {};
  const url = clientCode ? `/${clientCode}/parameters` : '/parameters';
  return api.get(url, { params });
};
export const getParameter = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/${id}` : `/parameters/${id}`;
  return api.get(url);
};
export const createParameter = (data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters` : '/parameters';
  return api.post(url, data);
};
export const updateParameter = (id: string, data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/${id}` : `/parameters/${id}`;
  return api.put(url, data);
};
export const deleteParameter = (id: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/${id}` : `/parameters/${id}`;
  return api.delete(url);
};

// Setpoints
export const getSetpoints = (parameterId: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/${parameterId}/setpoints` : `/parameters/${parameterId}/setpoints`;
  return api.get(url);
};
export const createSetpoint = (parameterId: string, data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/${parameterId}/setpoints` : `/parameters/${parameterId}/setpoints`;
  return api.post(url, data);
};
export const updateSetpoint = (setpointId: string, data: any, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/setpoints/${setpointId}` : `/parameters/setpoints/${setpointId}`;
  return api.put(url, data);
};
export const deleteSetpoint = (setpointId: string, clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/parameters/setpoints/${setpointId}` : `/parameters/setpoints/${setpointId}`;
  return api.delete(url);
};

// Data
export const getStructure = (clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/data/structure` : '/data/structure';
  return api.get(url);
};
export const getLatestData = (clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/data/latest` : '/data/latest';
  return api.get(url);
};
export const getActiveTopics = (clientCode?: string) => {
  const url = clientCode ? `/${clientCode}/data/topics` : '/data/topics';
  return api.get(url);
};
export const getHistoricalData = (parameterId: string, startTime?: number, endTime?: number, limit?: number) => {
  const params: any = {};
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;
  if (limit) params.limit = limit;
  return api.get(`/data/historical/${parameterId}`, { params });
};
export const getAggregatedData = (parameterId: string, startTime?: number, endTime?: number, interval?: string) => {
  const params: any = {};
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;
  if (interval) params.interval = interval;
  return api.get(`/data/aggregated/${parameterId}`, { params });
};

// Alerts
export const getLatestAlerts = () => api.get('/alerts/latest');
export const getAlerts = (page?: number, limit?: number, isResolved?: boolean, parameterId?: string, startDate?: string, endDate?: string) => {
  const params: any = {};
  if (page) params.page = page;
  if (limit) params.limit = limit;
  if (isResolved !== undefined) params.isResolved = isResolved;
  if (parameterId) params.parameterId = parameterId;
  if (startDate) params.startDate = startDate;
  if (endDate) params.endDate = endDate;
  return api.get('/alerts', { params });
};
export const resolveAlert = (id: string) => api.put(`/alerts/${id}/resolve`);
export const getAlertStats = () => api.get('/alerts/stats');

// Auth
export const login = (email: string, password: string) => api.post('/auth/login', { email, password });
export const verifyToken = () => {
  const token = localStorage.getItem('token');
  return api.get('/auth/verify', {
    headers: {
      'x-auth-token': token || ''
    }
  });
};

// Clients
export const getClients = () => api.get('/clients');
export const getClient = (id: string) => api.get(`/clients/${id}`);
export const getClientByCode = (code: string) => api.get(`/clients/code/${code}`);
export const updateClientMapMarkersByCode = (code: string, mapMarkers: any[]) =>
  api.put(`/clients/code/${code}/map-markers`, { mapMarkers });
export const getClientMqttStatus = (id: string) => api.get(`/clients/${id}/mqtt-status`);
export const connectClientMqtt = (id: string) => api.post(`/clients/${id}/mqtt-connect`);
export const createClient = (data: any) => api.post('/clients', data);
export const updateClient = (id: string, data: any) => api.put(`/clients/${id}`, data);
export const deleteClient = (id: string) => api.delete(`/clients/${id}`);
export const uploadClientMapImage = (id: string, file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  return api.post(`/clients/${id}/map-image`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
export const deleteClientMapImage = (id: string) => api.delete(`/clients/${id}/map-image`);
export const sendTestNotification = (id: string) => api.post(`/clients/${id}/test-notification`);
export default api;

