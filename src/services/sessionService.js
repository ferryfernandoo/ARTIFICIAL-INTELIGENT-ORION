/**
 * Session & Chat Persistence Service
 * Handles saving/loading chat sessions and messages
 */

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const sessionService = {
  // Create new session
  async createSession(title = null) {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title })
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Create session error:', error);
      throw error;
    }
  },

  // Get all sessions for current user
  async getSessions() {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Get sessions error:', error);
      throw error;
    }
  },

  // Get single session with messages
  async getSession(sessionId) {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Get session error:', error);
      throw error;
    }
  },

  // Update session (title, etc)
  async updateSession(sessionId, data) {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Update session error:', error);
      throw error;
    }
  },

  // Delete session
  async deleteSession(sessionId) {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Delete session error:', error);
      throw error;
    }
  }
};

export const messageService = {
  // Save message to session
  async saveMessage(sessionId, role, content, personality = 'formal') {
    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          role,
          content,
          personality
        })
      });
      if (!response.ok) throw new Error(`${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      console.error('Save message error:', error);
      // Don't throw - allow chat to continue even if save fails
      return null;
    }
  }
};

export default { sessionService, messageService };
