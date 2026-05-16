/**
 * Simple token counter for estimating API token usage
 * Uses approximate ratio: ~1 token per 4 characters for English
 * Rough estimate: 1 token ≈ 4 characters
 */

export const countTokens = (text) => {
  if (!text) return 0;
  // Rough estimation: every 4 characters = 1 token
  // This is simplified; actual token counts varies by model
  return Math.ceil(text.length / 4);
};

/**
 * Count tokens for a message object
 */
export const countMessageTokens = (message) => {
  if (!message || !message.text) return 0;
  return countTokens(message.text);
};

/**
 * Count total tokens for a conversation
 */
export const countConversationTokens = (messages) => {
  if (!Array.isArray(messages)) return 0;
  return messages.reduce((total, msg) => total + countMessageTokens(msg), 0);
};

/**
 * Calculate remaining tokens given max and used
 */
export const getRemainingTokens = (maxTokens = 100000, usedTokens = 0) => {
  return Math.max(0, maxTokens - usedTokens);
};

/**
 * Check if within token limit
 */
export const isWithinTokenLimit = (currentTokens, newMessageTokens, maxTokens = 100000) => {
  return (currentTokens + newMessageTokens) <= maxTokens;
};
