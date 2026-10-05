// File: src/services/api.js
// Purpose: Handles all communication with your FastAPI backend

const API_BASE_URL = 'http://localhost:8000';

// Helper function to handle responses
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.detail || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Main API object with all endpoints
export const api = {
  // Health check - test if backend is running
  healthCheck: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/`);
      return await handleResponse(response);
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  },

  // Upload database file
  // @param {File} file - SQLite database file
  // @param {string} namespace - Optional namespace for the database
  uploadDatabase: async (file, namespace = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (namespace) formData.append('namespace', namespace);
    
    try {
      const response = await fetch(`${API_BASE_URL}/ingest`, {
        method: 'POST',
        body: formData,
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  // Send a natural language query
  // @param {string} sessionId - Session ID from upload
  // @param {string} userInput - Natural language question
  sendQuery: async (sessionId, userInput) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          user_input: userInput 
        }),
      });
      
      const data = await handleResponse(response);
      console.log('API Response - Full data:', data); // Debug log
      
      // The response structure might be { session_id, result } where result contains the data
      // or it might be directly the result object
      return data;
    } catch (error) {
      console.error('Query failed:', error);
      throw error;
    }
  },

  // Confirm DML operation (INSERT/UPDATE/DELETE)
  // @param {string} sessionId - Session ID from upload
  // @param {string} sql - SQL query to confirm
  confirmDML: async (sessionId, sql) => {
    try {
      const response = await fetch(`${API_BASE_URL}/confirm`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId, 
          sql: sql 
        }),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Confirmation failed:', error);
      throw error;
    }
  },

  // Alternative: Attach database via credentials (from ingest.py)
  attachDatabase: async (credentials) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/attach-db/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });
      return await handleResponse(response);
    } catch (error) {
      console.error('Attach database failed:', error);
      throw error;
    }
  }
};

// Export a default instance for easy importing
export default api;