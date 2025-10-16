import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const auth = JSON.parse(localStorage.getItem('auth') || '{}');
    if (auth?.token) {
      config.headers.Authorization = `Bearer ${auth.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Reports API
export const reportsService = {
  getOverview: async () => {
    const response = await api.get('/reports/overview');
    return response.data;
  },
  
  getDentistWorkload: async () => {
    const response = await api.get('/reports/dentist-workload');
    return response.data;
  },
  
  getInventoryUsage: async () => {
    const response = await api.get('/reports/inventory-usage');
    return response.data;
  },
  
  exportInventoryCsv: async () => {
    const response = await api.get('/reports/export/inventory.csv', {
      responseType: 'blob',
    });
    return response.data;
  },
  
  exportInventoryPdf: async () => {
    const response = await api.get('/reports/export/inventory.pdf', {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default api;
