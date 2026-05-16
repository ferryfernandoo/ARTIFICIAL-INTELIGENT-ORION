// Artifact Service - Client-side API for document artifact persistence
// Saves/loads AI-generated document content to/from the backend database

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

/**
 * Save a new artifact (AI generation result) to the backend
 * @param {Object} params
 * @param {string} params.sessionId - The chat session ID
 * @param {string} params.prompt - The user's prompt
 * @param {string} params.response - The AI's response text
 * @param {string} [params.type='docx'] - Document type (docx, pptx, excel)
 * @param {string} [params.title='Untitled Document'] - Document title
 * @param {Array} [params.content] - Parsed document content array
 * @param {Array} [params.excelSheets] - Excel sheets data
 * @param {number} [params.activeSheet=0] - Active sheet index
 * @returns {Promise<Object>} The saved artifact
 */
export async function saveArtifact({ sessionId, prompt, response, type = 'docx', title, content, excelSheets, activeSheet }) {
  try {
    const res = await fetch(`${API_BASE}/api/artifacts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ sessionId, prompt, response, type, title, content, excelSheets, activeSheet }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to save artifact');
    return data.artifact;
  } catch (err) {
    console.error('[ArtifactService] Save error:', err);
    throw err;
  }
}

/**
 * Load all artifacts for a given session
 * @param {string} sessionId
 * @returns {Promise<Array>} Array of artifacts
 */
export async function loadArtifactsBySession(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/api/artifacts/session/${encodeURIComponent(sessionId)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load artifacts');
    return data.artifacts || [];
  } catch (err) {
    console.error('[ArtifactService] Load error:', err);
    return [];
  }
}

/**
 * Load all artifacts for a user
 * @param {string} userId
 * @returns {Promise<Array>} Array of artifacts
 */
export async function loadArtifactsByUser(userId) {
  try {
    const res = await fetch(`${API_BASE}/api/artifacts/user/${encodeURIComponent(userId)}`, {
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to load user artifacts');
    return data.artifacts || [];
  } catch (err) {
    console.error('[ArtifactService] Load user error:', err);
    return [];
  }
}

/**
 * Delete a single artifact
 * @param {string} artifactId
 */
export async function deleteArtifact(artifactId) {
  try {
    const res = await fetch(`${API_BASE}/api/artifacts/${encodeURIComponent(artifactId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to delete artifact');
  } catch (err) {
    console.error('[ArtifactService] Delete error:', err);
    throw err;
  }
}

/**
 * Clear all artifacts for a session
 * @param {string} sessionId
 */
export async function clearSessionArtifacts(sessionId) {
  try {
    const res = await fetch(`${API_BASE}/api/artifacts/session/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Failed to clear artifacts');
  } catch (err) {
    console.error('[ArtifactService] Clear error:', err);
    throw err;
  }
}
