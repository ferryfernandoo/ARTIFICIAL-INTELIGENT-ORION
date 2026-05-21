/**
 * Conversation Persistence Service
 * Handles saving/loading conversation history based on auth status
 * - Guests: Save to localStorage
 * - Authenticated users: Save to backend server
 */

const STORAGE_KEY = 'chatbot_conversations';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

class ConversationPersistenceService {
  /**
   * Determine if should use backend storage
   */
  static shouldUseBackendStorage(isAuthenticated, isGuest) {
    // Use backend if authenticated (not guest)
    const shouldUse = isAuthenticated === true && isGuest === false;
    console.log(`[ConversationPersistence] Auth check: isAuthenticated=${isAuthenticated}, isGuest=${isGuest}, useBackend=${shouldUse}`);
    return shouldUse;
  }

  /**
   * Load conversations from appropriate storage
   */
  static async loadConversations(isAuthenticated, isGuest) {
    if (this.shouldUseBackendStorage(isAuthenticated, isGuest)) {
      return await this.loadFromBackend();
    } else {
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Save conversations to appropriate storage
   */
  static async saveConversations(conversations, isAuthenticated, isGuest) {
    if (this.shouldUseBackendStorage(isAuthenticated, isGuest)) {
      return await this.saveToBackend(conversations);
    } else {
      return this.saveToLocalStorage(conversations);
    }
  }

  /**
   * Load from localStorage (Guest mode)
   */
  static loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && saved.trim()) {
        try {
          const convs = JSON.parse(saved);
          const sizeInMB = (saved.length / 1024 / 1024).toFixed(2);
          console.log(`[ConversationPersistence] 📦 Loaded ${sizeInMB}MB from localStorage`);
          
          if (Array.isArray(convs) && convs.length > 0) {
            const validConvs = convs.filter(c => c && c.id && c.messages !== undefined);
            if (validConvs.length > 0) {
              const result = validConvs.map((conv) => {
                const processedConv = {
                  ...conv,
                  messages: Array.isArray(conv.messages)
                    ? conv.messages.map((msg) => {
                        const processedMsg = {
                          ...msg,
                          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                        };
                        // Ensure images array is preserved from message object
                        if (msg.images && Array.isArray(msg.images)) {
                          processedMsg.images = msg.images;
                          console.log(`[ConversationPersistence] ✓ Restored message with ${msg.images.length} images`);
                        }
                        return processedMsg;
                      })
                    : [],
                };
                const totalImages = processedConv.messages.reduce((sum, m) => sum + (m.images?.length || 0), 0);
                console.log(`[ConversationPersistence] Loaded conv "${processedConv.title}": ${processedConv.messages.length} messages, ${totalImages} total images`);
                return processedConv;
              });
              console.log(`[ConversationPersistence] ✅ Successfully loaded ${result.length} conversations with images intact`);
              return result;
            }
          }
        } catch (parseErr) {
          console.error('JSON parse error:', parseErr);
          return null;
        }
      }
      return null;
    } catch (err) {
      console.error('Error loading from localStorage:', err);
      return null;
    }
  }

  /**
   * Save to localStorage (Guest mode)
   */
  static saveToLocalStorage(conversations) {
    try {
      if (conversations.length > 0) {
        const publicConversations = conversations.filter(c => !c.isPrivate);
        if (publicConversations.length > 0) {
          const validConversations = publicConversations
            .map(conv => {
              if (!conv.id || !conv.title || !Array.isArray(conv.messages)) {
                console.warn('Invalid conversation structure:', conv);
                return null;
              }
              // Preserve full message structure including images
              const processedMessages = conv.messages.map(msg => {
                const processedMsg = {
                  ...msg,
                };
                // Ensure images are preserved in message
                if (msg.images && Array.isArray(msg.images)) {
                  processedMsg.images = msg.images;
                  const imageCount = msg.images.length;
                  const totalSize = msg.images.reduce((sum, img) => sum + (img.dataUrl?.length || 0), 0);
                  console.log(`[ConversationPersistence] Saving message with ${imageCount} images (${(totalSize / 1024 / 1024).toFixed(2)}MB)`);
                }
                return processedMsg;
              });
              
              const totalImageCount = processedMessages.reduce((sum, msg) => sum + (msg.images?.length || 0), 0);
              console.log(`[ConversationPersistence] Saving conversation "${conv.title}" (${processedMessages.length} messages, ${totalImageCount} images)`);
              
              return {
                id: conv.id,
                title: conv.title,
                messages: processedMessages,
                createdAt: conv.createdAt || new Date().toISOString(),
                updatedAt: conv.updatedAt || new Date().toISOString(),
                isPrivate: conv.isPrivate || false,
              };
            })
            .filter(c => c !== null);

          if (validConversations.length > 0) {
            const jsonString = JSON.stringify(validConversations);
            const sizeInMB = (jsonString.length / 1024 / 1024).toFixed(2);
            console.log(`[ConversationPersistence] Total save size: ${sizeInMB}MB`);
            
            // Check size (localStorage usually has 5-10MB limit)
            if (jsonString.length > 5000000) {
              console.warn(`Conversations too large (${sizeInMB}MB), keeping only last 20`);
              const trimmed = validConversations.slice(-20);
              localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
            } else {
              localStorage.setItem(STORAGE_KEY, jsonString);
            }
            console.log(`[ConversationPersistence] ✅ Saved ${validConversations.length} conversations to localStorage`);
          }
        }
      }
      return true;
    } catch (err) {
      console.error('Error saving to localStorage:', err);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.error('Could not clear localStorage:', e);
      }
      return false;
    }
  }

  /**
   * Load from backend (Authenticated users)
   */
  static async loadFromBackend() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          console.log('Not authenticated, fallback to localStorage');
          return null;
        }
        console.error(`Backend error: ${response.status}`);
        return null;
      }

      const data = await response.json();
      if (data.conversations && Array.isArray(data.conversations)) {
        console.log(`[ConversationPersistence] Loaded ${data.conversations.length} conversations from backend`);
        
        return data.conversations.map((conv) => {
          // Process messages and restore image URLs from images array if available
          const messages = Array.isArray(conv.messages)
            ? conv.messages.map((msg) => {
                const processedMsg = {
                  ...msg,
                  sender: msg.sender === 'assistant' ? 'bot' : msg.sender,
                  timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
                };
                
                // If message has imageUrl from server, keep it
                if (msg.imageUrl) {
                  processedMsg.imageUrl = msg.imageUrl;
                  processedMsg.imageId = msg.imageId;
                  processedMsg.isImage = true;
                  console.log(`[ConversationPersistence] Message has image URL: ${msg.imageUrl.substring(0, 80)}... (ID: ${msg.imageId})`);
                }
                
                return processedMsg;
              })
            : [];
          
          const imageCount = messages.filter(m => m.imageUrl).length;
          console.log(`[ConversationPersistence] Conversation ${conv.id}: ${messages.length} messages, ${imageCount} with images`);
          
          // Include images array for reference
          const result = {
            ...conv,
            messages: messages,
          };
          
          // Preserve images array if it exists
          if (conv.images && Array.isArray(conv.images)) {
            result.images = conv.images;
          }
          
          console.log(`[ConversationPersistence] Loaded conversation ${conv.id}: ${messages.length} messages, ${conv.images ? conv.images.length : 0} images`);
          
          return result;
        });
      }
      return null;
    } catch (err) {
      console.error('Error loading from backend:', err);
      return null;
    }
  }

  /**
   * Save to backend (Authenticated users)
   */
  static async saveToBackend(conversations) {
    try {
      if (conversations.length === 0) return true;

      const publicConversations = conversations.filter(c => !c.isPrivate);
      if (publicConversations.length === 0) return true;

      console.log(`[ConversationPersistence] Saving ${publicConversations.length} conversations to backend...`);
      const response = await fetch(`${API_BASE_URL}/api/conversations`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ conversations: publicConversations }),
      });

      if (!response.ok) {
        console.error(`Failed to save conversations: ${response.status}`);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error saving to backend:', err);
      return false;
    }
  }

  /**
   * Clear all conversations
   */
  static async clearAll(isAuthenticated, isGuest) {
    try {
      if (this.shouldUseBackendStorage(isAuthenticated, isGuest)) {
        // For backend, just make a delete request
        const response = await fetch(`${API_BASE_URL}/api/conversations`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return response.ok;
      } else {
        // For localStorage
        localStorage.removeItem(STORAGE_KEY);
        return true;
      }
    } catch (err) {
      console.error('Error clearing conversations:', err);
      return false;
    }
  }

  /**
   * Delete specific conversation
   */
  static async deleteConversation(conversationId, isAuthenticated, isGuest) {
    try {
      if (this.shouldUseBackendStorage(isAuthenticated, isGuest)) {
        const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        return response.ok;
      } else {
        // For localStorage, it will be handled by setConversations in component
        return true;
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
      return false;
    }
  }
}

export { ConversationPersistenceService };
