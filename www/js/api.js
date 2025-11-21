// API Client for Voyage Logbook
// Update this URL when deploying to production
const API_URL = 'http://localhost:3000/api';

// Get stored auth token
function getToken() {
    return localStorage.getItem('authToken');
}

// Set auth token and user
function setToken(token, user) {
    localStorage.setItem('authToken', token);
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    }
}

// Remove auth token
function removeToken() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentUser');
}

// Make API request with authentication
async function apiRequest(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_URL}${endpoint}`, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token expired or invalid
            removeToken();
            window.location.reload();
            throw new Error('Authentication required');
        }

        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Request failed');
        }

        return data;
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Auth API
const authAPI = {
    async register(name, email, password) {
        const data = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        setToken(data.token, data.user);
        return data.user;
    },

    async login(email, password) {
        const data = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        setToken(data.token, data.user);
        return data.user;
    },

    logout() {
        removeToken();
    }
};

// Items API
const itemsAPI = {
    async getAll() {
        return await apiRequest('/items');
    },

    async create(item) {
        return await apiRequest('/items', {
            method: 'POST',
            body: JSON.stringify(item)
        });
    },

    async update(id, item) {
        return await apiRequest(`/items/${id}`, {
            method: 'PUT',
            body: JSON.stringify(item)
        });
    },

    async delete(id) {
        return await apiRequest(`/items/${id}`, {
            method: 'DELETE'
        });
    },

    async toggleStep(itemId, stepId) {
        return await apiRequest(`/items/${itemId}/steps/${stepId}`, {
            method: 'PUT'
        });
    }
};

