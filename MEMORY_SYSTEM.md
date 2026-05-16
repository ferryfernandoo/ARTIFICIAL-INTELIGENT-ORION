# 🧠 Orion AI - Sophisticated Context Memory System

## Overview
Orion AI now features a sophisticated, token-efficient memory system that learns from conversations and provides intelligent context awareness across multiple chat rooms (conversations).

## Features

### 🎯 Smart Memory Extraction
The system automatically extracts and stores important information from conversations:
- **User Preferences**: "I like...", "I prefer...", "I want..."
- **Personal Facts**: "I'm...", "I have...", "I work in...", "I'm from..."
- **Behavior Patterns**: Daily habits, recurring themes, communication style
- **Context Information**: Long, specific messages with valuable context

### 🔍 Semantic Search
Instead of simple keyword matching, the memory system uses:
- **Vector Similarity**: Embeddings-based search for topically relevant memories
- **Keyword Matching**: Backup search using important terms
- **Hybrid Approach**: Combines both methods for best results
- **Cross-Room References**: Retrieves memories from other conversations automatically

### 💾 Token-Efficient Design
- **Budget**: 500-800 tokens (~15-20% of total context)
- **Deduplication**: Automatically removes duplicate or very similar memories
- **Priority Ranking**: Most important memories are prioritized
- **Auto-Cleanup**: Old memories (>30 days) are automatically removed
- **Smart Summarization**: Long memories are summarized for prompt inclusion

### 🚀 Key Capabilities

#### 1. **Persistent Memory Storage**
```
- Memories stored in browser localStorage
- Survives across sessions
- Up to 100 memories maintained (by importance)
- 30-day retention policy with auto-cleanup
```

#### 2. **Cross-Conversation Context**
When starting a new chat:
1. Your new message is analyzed for topics
2. System searches ALL previous conversations for related memories
3. Top 5 most relevant memories are included in AI's context
4. AI responds with awareness of your entire history

Example:
```
Chat 1: "I work in cybersecurity"
Chat 2: "I use Ubuntu Linux"
Chat 3: (new chat) "How should I secure my system?"
→ AI remembers your cybersecurity background and Linux preference
```

#### 3. **Smart Memory Weighting**
Memories have importance scores (0-1):
- **Preferences**: 0.9 (high importance)
- **Facts**: 0.85 (high importance)
- **Patterns**: 0.75 (medium importance)
- **Context**: 0.6 (medium importance)

More important memories are:
- Retrieved more frequently
- Kept longer
- Prioritized when space is limited

#### 4. **Memory Bank Dashboard**
The sidebar shows:
- Total memories stored
- Breakdown by type (preferences, facts, patterns, context)
- Quick clear button
- Status indicator

## How It Works

### Memory Extraction Process
```
1. User sends message → AI responds
2. System analyzes user message for extractable information
3. Matching rules applied:
   - Contains preference keywords? → Store as preference
   - Contains personal fact keywords? → Store as fact
   - Contains pattern keywords? → Store as pattern
   - Long & detailed message? → Store as context
4. Memory stored with metadata (timestamp, weight, keywords, embedding)
5. Duplicate check performed (remove very similar memories)
```

### Memory Retrieval Process
```
1. User sends new message in new conversation
2. Message analyzed for keywords and meaning
3. Semantic search across all memories:
   a. Vector similarity: Is this memory topically similar?
   b. Keyword overlap: Does it share important terms?
   c. Recency boost: More recent is slightly preferred
4. Top 5 memories ranked and formatted
5. Included in system prompt to AI (if relevant score > 0.2)
```

### Token Budget Allocation
Example for 4000-token context limit:
```
- System prompt: 400 tokens
- Memory context: 600 tokens (15%)
- Conversation history: 1500 tokens (37.5%)
- User message: 200 tokens (5%)
- Response buffer: 1300 tokens (32.5%)
```

## Usage Examples

### Example 1: Continuous Learning
```
Chat 1: "I'm learning Python, I prefer OOP style"
  → Memory: Preference for OOP
  → Memory: Learning Python

Chat 2: (Next day) "How do I structure my project?"
  → AI finds: "User prefers OOP, learning Python"
  → AI suggests OOP-based project structure
```

### Example 2: Cross-Room Context
```
Chat 1: "I work in healthcare"
Chat 2: "I use Python for data analysis"
Chat 3: (new chat) "Analyze patient data trends"
  → AI remembers: Healthcare + Python + Data analysis
  → AI provides healthcare-aware analysis suggestions
```

### Example 3: Language-Aware Memory
```
Chat 1 (Indonesian): "Saya suka coding dengan React"
  → Memory stored with language: 'id'

Chat 2 (English): "Help me with web development"
  → AI recalls: User likes React (even across languages)
  → Bilingual context maintained
```

## Memory Types

### 📍 Preferences (Weight: 0.9)
Things user explicitly states they like/prefer/want
```
"I prefer clean code"
"I love using VS Code"
"I want to learn machine learning"
```

### 📊 Facts (Weight: 0.85)
Personal information and background
```
"I work in cybersecurity"
"I'm from Indonesia"
"I have 5 years of experience"
```

### 🔄 Patterns (Weight: 0.75)
Habits, recurring behaviors, routines
```
"I usually work in the morning"
"I check my email every 2 hours"
"I code every weekend"
```

### 🎨 Context (Weight: 0.6)
Long, detailed information and background
```
Project descriptions, explanations, detailed scenarios
```

## Configuration

### Memory Limits
- `MAX_MEMORIES`: 100 (max total memories stored)
- `MEMORY_TTL`: 30 days (auto-cleanup threshold)
- `TOKEN_BUDGET`: 500-800 tokens in prompts
- `SEARCH_LIMIT`: 5 (max memories retrieved per query)

### Similarity Thresholds
- `DEDUP_THRESHOLD`: 0.8 (similarity to mark as duplicate)
- `RELEVANCE_THRESHOLD`: 0.2 (minimum score to include in prompt)

## Privacy & Control

### Clear Memory
Users can clear all memories:
1. Click "Memory Bank" section in sidebar
2. Click ↻ button
3. Confirm deletion
4. All memories permanently cleared

### No Server Storage
- All memories stored in browser only
- Not sent to Deepseek or any cloud service
- Only memory context (summaries) sent in prompts
- Original memory metadata stays private

## Technical Details

### Embedding Method
- Simple frequency-based vectors using top keywords
- Efficient computation for fast search
- Low memory footprint
- Suitable for localStorage constraints

### Similarity Calculation
- Cosine similarity between embeddings
- Keyword overlap scoring
- Combined score: (semantic × 0.6) + (keywords × 0.4)
- Boosted by recency and importance weight

### Storage Format
```javascript
{
  id: "mem_1234_abc123",
  type: "preference",
  content: "User prefers OOP",
  conversationId: "conv_xyz",
  timestamp: 1234567890,
  weight: 0.9,
  tags: ["oop", "programming", "preference"],
  accessCount: 5,
  embedding: [0.2, 0.5, 0.1, ...],
  language: "en"
}
```

## Future Enhancements
- ✅ Local semantic search
- ⏳ Cloud memory backup
- ⏳ Memory export/import
- ⏳ Custom memory tags
- ⏳ Memory analytics dashboard
- ⏳ Collaborative memory (shared memories between users)

## Troubleshooting

### Memory not being retrieved
- Check if similarity threshold is too high (increase RELEVANCE_THRESHOLD)
- Verify keywords are extracted correctly
- Check memory type matches search context

### Too many memories stored
- System auto-limits to 100 by importance
- Clear old memories with clear button
- Adjust MAX_MEMORIES configuration

### Memory taking too many tokens
- Reduce MEMORY_RETRIEVE_LIMIT
- Increase TOKEN_BUDGET if possible
- Enable more aggressive deduplication

## Support
For issues or questions about the memory system:
1. Check memory stats in sidebar
2. Review console logs for debug info
3. Clear memories and restart if issues persist
4. Contact Orion AI support

---

**Memory System Version**: 1.0.0  
**Last Updated**: April 2026  
**Status**: Production Ready ✅
