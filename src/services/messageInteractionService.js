/**
 * Message Interaction Service
 * Handles like/dislike feedback, branching, editing, and message interactions
 */

const FEEDBACK_KEY = 'orion_message_feedback';
const BRANCHES_KEY = 'orion_chat_branches';

class MessageInteractionService {
  constructor() {
    this.feedback = this.loadFeedback();
    this.branches = this.loadBranches();
  }

  /**
   * Load feedback from localStorage
   */
  loadFeedback() {
    try {
      const stored = localStorage.getItem(FEEDBACK_KEY);
      if (!stored) return {};
      try {
        return JSON.parse(stored) || {};
      } catch (parseError) {
        console.error('Error parsing feedback storage:', parseError);
        localStorage.removeItem(FEEDBACK_KEY);
        return {};
      }
    } catch (e) {
      console.error('Error loading feedback:', e);
      return {};
    }
  }

  /**
   * Save feedback to localStorage
   */
  saveFeedback() {
    try {
      localStorage.setItem(FEEDBACK_KEY, JSON.stringify(this.feedback));
    } catch (e) {
      console.error('Error saving feedback:', e);
    }
  }

  /**
   * Load branches from localStorage
   */
  loadBranches() {
    try {
      const stored = localStorage.getItem(BRANCHES_KEY);
      if (!stored) return {};
      try {
        return JSON.parse(stored) || {};
      } catch (parseError) {
        console.error('Error parsing branches storage:', parseError);
        localStorage.removeItem(BRANCHES_KEY);
        return {};
      }
    } catch (e) {
      console.error('Error loading branches:', e);
      return {};
    }
  }

  /**
   * Save branches to localStorage
   */
  saveBranches() {
    try {
      localStorage.setItem(BRANCHES_KEY, JSON.stringify(this.branches));
    } catch (e) {
      console.error('Error saving branches:', e);
    }
  }

  /**
   * Add like/dislike feedback untuk bot response
   * @param {string} messageId - ID dari bot message
   * @param {string} feedback - 'like' atau 'dislike'
   * @param {string} conversationId - ID dari conversation
   */
  addFeedback(messageId, feedback, conversationId) {
    if (!['like', 'dislike'].includes(feedback)) return false;

    const key = `${conversationId}_${messageId}`;
    this.feedback[key] = {
      feedback,
      timestamp: Date.now(),
      conversationId,
      messageId,
    };

    // Share same feedback structure with memory service untuk training
    this.saveFeedback();
    return true;
  }

  /**
   * Get feedback untuk specific message
   */
  getFeedback(messageId, conversationId) {
    const key = `${conversationId}_${messageId}`;
    return this.feedback[key] || null;
  }

  /**
   * Create branch dari specific message
   * Jika user ingin "retry" atau membuat alt response
   */
  createBranch(conversationId, messageIndexAtBranch, newUserMessage) {
    const branchId = `branch_${conversationId}_${messageIndexAtBranch}_${Date.now()}`;

    this.branches[branchId] = {
      id: branchId,
      parentConversationId: conversationId,
      branchPointIndex: messageIndexAtBranch,
      newUserMessage,
      createdAt: Date.now(),
      messages: [], // akan diisi dengan hasil dari new retry
    };

    this.saveBranches();
    return branchId;
  }

  /**
   * Get semua branches dari suatu conversation
   */
  getBranchesForConversation(conversationId) {
    return Object.values(this.branches).filter(
      (branch) => branch.parentConversationId === conversationId
    );
  }

  /**
   * Get branch details
   */
  getBranch(branchId) {
    return this.branches[branchId] || null;
  }

  /**
   * Update branch dengan new response
   */
  updateBranchMessages(branchId, messages) {
    if (this.branches[branchId]) {
      this.branches[branchId].messages = messages;
      this.saveBranches();
      return true;
    }
    return false;
  }

  /**
   * Improve response - edit user message dan retry
   * Steps:
   * 1. Remove bot response setelah message ini
   * 2. Create branch (optional - untuk keep history)
   * 3. Update user message dengan edited version
   * 4. Re-fetch response dari AI
   */
  improveResponse(conversationId, messageIndexToEdit, editedUserMessage) {
    return {
      action: 'improve',
      conversationId,
      messageIndexToEdit,
      editedUserMessage,
      timestamp: Date.now(),
      // Ini akan di-handle di ChatBot.jsx
    };
  }

  /**
   * Get feedback summary untuk conversation
   * Useful untuk training AI lebih baik
   */
  getFeedbackSummary(conversationId) {
    const feedbackEntries = Object.values(this.feedback).filter(
      (f) => f.conversationId === conversationId
    );

    return {
      total: feedbackEntries.length,
      likes: feedbackEntries.filter((f) => f.feedback === 'like').length,
      dislikes: feedbackEntries.filter((f) => f.feedback === 'dislike').length,
      likeRate: feedbackEntries.length > 0
        ? (feedbackEntries.filter((f) => f.feedback === 'like').length / feedbackEntries.length * 100).toFixed(1)
        : 0,
    };
  }

  /**
   * Export feedback untuk AI training reference
   */
  exportFeedbackForTraining() {
    return {
      exportDate: new Date().toISOString(),
      totalFeedback: Object.keys(this.feedback).length,
      feedbackData: Object.values(this.feedback),
      feedbackByConversation: this.groupFeedbackByConversation(),
    };
  }

  /**
   * Group feedback by conversation
   */
  groupFeedbackByConversation() {
    const grouped = {};
    Object.values(this.feedback).forEach((f) => {
      if (!grouped[f.conversationId]) {
        grouped[f.conversationId] = { likes: 0, dislikes: 0 };
      }
      if (f.feedback === 'like') {
        grouped[f.conversationId].likes += 1;
      } else {
        grouped[f.conversationId].dislikes += 1;
      }
    });
    return grouped;
  }

  /**
   * Clear old feedback (older than 90 days)
   */
  cleanupOldFeedback(daysOld = 90) {
    const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
    let removed = 0;

    Object.keys(this.feedback).forEach((key) => {
      if (this.feedback[key].timestamp < cutoffTime) {
        delete this.feedback[key];
        removed += 1;
      }
    });

    if (removed > 0) {
      this.saveFeedback();
    }

    return removed;
  }

  /**
   * Get conversation quality metrics
   */
  getQualityMetrics(conversationId) {
    const summary = this.getFeedbackSummary(conversationId);
    const branches = this.getBranchesForConversation(conversationId);

    return {
      feedbackSummary: summary,
      totalBranches: branches.length,
      engagementScore: summary.total > 0 ? ((summary.likes / (summary.total || 1)) * 100).toFixed(1) : 0,
    };
  }
}

export const messageInteractionService = new MessageInteractionService();
export default MessageInteractionService;
