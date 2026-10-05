import axios from 'axios';

const API_BASE_URL = '/api/reviews';

export const reviewService = {
    getQueue: async (params = {}) => {
        const response = await axios.get(`${API_BASE_URL}/queue`, { params });
        return response.data;
    },

    assignCase: async (transactionId, analystId) => {
        const response = await axios.post(`${API_BASE_URL}/${transactionId}/assign`, { analystId });
        return response.data;
    },

    decideCase: async (transactionId, payload) => {
        // payload: { analystId, decision, notes, transactionAmount }
        const response = await axios.post(`${API_BASE_URL}/${transactionId}/decide`, payload);
        return response.data;
    },

    secondApproval: async (transactionId, payload) => {
        // payload: { secondAnalystId, decision, notes }
        const response = await axios.post(`${API_BASE_URL}/${transactionId}/second-approval`, payload);
        return response.data;
    },

    escalateCase: async (transactionId, payload) => {
        // payload: { analystId, targetAnalystId, targetAnalystName, reason }
        const response = await axios.post(`${API_BASE_URL}/${transactionId}/escalate`, payload);
        return response.data;
    },

    getAvailableAnalysts: async () => {
        const response = await axios.get('/api/users/staff');
        return response.data;
    },

    getHistory: async (transactionId) => {
        const response = await axios.get(`${API_BASE_URL}/${transactionId}/history`);
        return response.data;
    },

    getDecisionHistory: async () => {
        const response = await axios.get(`${API_BASE_URL}/history`);
        return response.data;
    },

    getCaseById: async (id) => {
        const response = await axios.get(`${API_BASE_URL}/cases/${id}`);
        return response.data;
    },

    getPerformanceMetrics: async () => {
        const response = await axios.get(`${API_BASE_URL}/analytics/performance`);
        return response.data;
    },

    seedTestData: async () => {
        const response = await axios.post(`${API_BASE_URL}/seed-test-data`);
        return response.data;
    }
};