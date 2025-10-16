// API Service for Manager Dashboard
const API_BASE_URL = '/api/manager';

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
}

// Inventory Service
export const inventoryService = {
  async getInventory(lowStockOnly = false) {
    const endpoint = lowStockOnly ? '/inventory?lowStockOnly=true' : '/inventory';
    return this.request(endpoint);
  },

  async getItem(itemId) {
    return this.request(`/inventory/${itemId}`);
  },

  async updateQuantity(itemId, quantity) {
    return this.request(`/inventory/${itemId}/quantity`, {
      method: 'PATCH',
      body: JSON.stringify({ quantity }),
    });
  },
};

// Stock Request Service
export const stockRequestService = {
  async getStockRequests() {
    return this.request('/stock-requests');
  },

  async getStockRequest(id) {
    return this.request(`/stock-requests/${id}`);
  },

  async createStockRequest(data) {
    return this.request('/stock-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateStockRequest(id, data) {
    return this.request(`/stock-requests/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteStockRequest(id) {
    return this.request(`/stock-requests/${id}`, {
      method: 'DELETE',
    });
  },
};

// Reports Service
export const reportsService = {
  async getOverview() {
    return this.request('/reports/overview');
  },

  async getDentistWorkload() {
    return this.request('/reports/dentist-workload');
  },

  async getInventoryUsage() {
    return this.request('/reports/inventory-usage');
  },

  async exportInventoryCsv() {
    return this.request('/reports/inventory.csv');
  },

  async exportInventoryPdf() {
    return this.request('/reports/inventory.pdf');
  },
};

// Bind the request method to each service
Object.assign(inventoryService, new ApiService());
Object.assign(stockRequestService, new ApiService());
Object.assign(reportsService, new ApiService());
