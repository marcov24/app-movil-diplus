import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create API instance with client code support
export const createApiClient = (clientCode?: string | null) => {
  const baseURL = clientCode 
    ? `${API_BASE_URL}/${clientCode}`
    : API_BASE_URL;

  const api = axios.create({
    baseURL,
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
  // Don't redirect for public routes - let them handle their own errors
  api.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        const url = error.config?.url || '';
        // Only redirect for protected routes, not public client routes
        // Public routes include /clients/code/ and client-scoped data routes
        if (!url.includes('/clients/code/') && !url.includes('/data/') && !url.includes('/areas') && !url.includes('/locations') && !url.includes('/parameters')) {
          localStorage.removeItem('token');
          window.location.href = '#/admin/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return api;
};

// Default API instance (for admin routes)
export default createApiClient();

