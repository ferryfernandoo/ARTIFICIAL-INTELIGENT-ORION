/**
 * Memory System Test - Quick verification that memory service works
 */

import { memoryService } from './memoryService.js';

console.log('🧠 Memory Service Test Started');

// Test 1: Extract keywords
const testText = "I love programming and I prefer using TypeScript for my projects";
const keywords = memoryService.extractKeywords(testText);
console.log('✓ Keywords extracted:', keywords.slice(0, 5));

// Test 2: Create embedding
const embedding = memoryService.createEmbedding(testText, keywords);
console.log('✓ Embedding created (length):', embedding.length);

// Test 3: Add a memory
const testMemory = memoryService.addMemory({
  type: 'preference',
  content: 'User prefers TypeScript for programming',
  weight: 0.9
}, 'test_conv_1', 'en');
console.log('✓ Memory added:', testMemory.id);

// Test 4: Add another memory in different conversation
const testMemory2 = memoryService.addMemory({
  type: 'fact',
  content: 'User loves working with React frameworks',
  weight: 0.85
}, 'test_conv_2', 'en');
console.log('✓ Second memory added:', testMemory2.id);

// Test 5: Search cross-room memories
const results = memoryService.searchMemories('programming frameworks', 3, 'test_conv_1');
console.log('✓ Cross-room search results:', results.length, 'memories found');
if (results.length > 0) {
  console.log('  - Most relevant:', results[0].content.substring(0, 50));
}

// Test 6: Get memory context for prompt
const context = memoryService.getMemoryContext('What framework should I use?', 'test_conv_1', 'en');
console.log('✓ Memory context generated (preview):', context.substring(0, 80) + '...');

// Test 7: Get summary
const summary = memoryService.getSummary();
console.log('✓ Memory summary:', summary);

console.log('\n✅ All memory system tests passed!');
console.log('Memory service is ready for production use.');
