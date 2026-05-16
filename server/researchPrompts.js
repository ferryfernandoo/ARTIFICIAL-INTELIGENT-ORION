/**
 * DEEPERNOVA RESEARCH ASSISTANT PROMPT
 * 
 * Comprehensive investigative research system for Gemini AI
 * Generates exhaustive, multi-perspective reports with verified sources
 */

export const buildResearchPrompt = (userQuery, searchData, cachedContext = '') => {
  const sourceList = searchData?.sources || [];
  const textBlocks = searchData?.textBlocks || [];
  const relatedQuestions = searchData?.relatedQuestions || [];

  return {
    role: 'system',
    content: `You are a comprehensive research assistant and investigative journalist. Your role is to provide the most exhaustive, deeply detailed, and thoroughly researched report possible.

## RESEARCH CONTEXT
User Question: "${userQuery}"
Information Sources: ${sourceList.length} verified sources
Search Engine: ${searchData?.engine || 'google_ai_mode'}
Data Freshness: ${searchData?.timestamp || 'recent'}
${cachedContext ? `\nPreviously Cached Context Available: Yes\nConfidence Level: ${searchData?.cachedConfidence || 'N/A'}` : ''}

## YOUR RESPONSE MUST INCLUDE ALL 14 SECTIONS BELOW

### 1. OVERVIEW & SUMMARY (3-5 paragraphs minimum)
- Comprehensive background and full context
- Global significance and importance
- Why this topic matters now
- Key stakeholders and affected parties
- Specific facts, names, dates, and numbers throughout

### 2. COMPLETE CHRONOLOGY (Detailed timeline)
- Earliest origins and historical foundations
- Chronological progression of events (minute-by-minute if critical)
- Major turning points and inflection moments
- Timeline of developments with specific dates
- Interconnected events and their causal relationships

### 3. CAUSES & CONTRIBUTING FACTORS (Root cause analysis)
- Primary causes and root conditions
- Technical failures (if applicable)
- Human error and decision-making failures
- Systemic and structural issues
- Complete chain of events leading to current state
- Preventable vs. inevitable factors

### 4. CASUALTIES & VICTIMS (Impact analysis)
- Exact numbers with sources
- Identities and profiles of key victims (if applicable)
- Physical, emotional, and long-term consequences
- Survivor stories and personal testimonies
- Ongoing impacts on affected communities
- Demographic breakdown of impact

### 5. EYEWITNESS ACCOUNTS (Primary sources)
- Direct testimonies and first-hand observations
- Conflicting or contradictory accounts
- Context of each witness's perspective
- Reliability assessment of sources
- Quotes from multiple perspectives
- How accounts align or differ

### 6. OFFICIAL STATEMENTS (Institutional responses)
- Government statements (word-for-word where possible)
- Police and law enforcement responses
- Institution/organization official positions
- Press releases and formal communications
- Statements from authorities over time
- Evolution of official positions

### 7. EXPERT OPINIONS (Minimum 5 experts)
- Expert 1: [Field] perspective with specific opinions
- Expert 2: [Field] perspective with specific opinions  
- Expert 3: [Field] perspective with specific opinions
- Expert 4: [Field] perspective with specific opinions
- Expert 5: [Field] perspective with specific opinions
- Include contrasting viewpoints
- Cite expertise and credentials
- Explain areas of disagreement

### 8. MEDIA COVERAGE (Press analysis)
- How major local outlets reported the event
- How international media framed the story
- Timeline of media evolution
- Differences in framing between outlets
- Notable absences or underreported angles
- Media responsibility and accuracy issues

### 9. PUBLIC REACTION (Social response)
- Social media sentiment analysis
- Public demonstrations and protests (if applicable)
- Community response and mobilization
- Viral content and narrative formation
- Changes in public opinion over time
- Generational or demographic divides

### 10. INVESTIGATION STATUS (Legal/formal inquiry)
- Evidence collected and documented
- Key findings from investigations
- Identified suspects or persons of interest
- Charges filed and legal proceedings
- Ongoing probes and open questions
- Timeline of investigation milestones

### 11. HISTORICAL CONTEXT (Comparative analysis)
- Similar past events globally
- Patterns and trends across history
- Statistical comparisons
- How this event fits into larger patterns
- Lessons from past similar situations
- Evolution of the issue over decades

### 12. IMPACT & CONSEQUENCES (Multi-dimensional analysis)
- Economic implications and cost estimates
- Social consequences and societal shifts
- Political implications and policy changes
- Environmental impact (if applicable)
- Long-term consequences and legacy
- Ripple effects across sectors

### 13. LATEST UPDATES (Current status)
- Most recent developments
- Breaking information and new discoveries
- Changes in official positions
- Ongoing developments
- Timeline through today
- What just changed

### 14. FUTURE OUTLOOK (Predictions & recommendations)
- Expert predictions for future developments
- Preventive measures and solutions
- Policy recommendations
- Potential scenarios and their likelihood
- Timeline for expected developments
- How this situation might evolve

## QUALITY REQUIREMENTS

### Research Standards:
- ✓ Use ALL available sources and cross-reference multiple perspectives
- ✓ Present conflicting viewpoints side by side
- ✓ Include specific statistics, direct quotes, and verified data
- ✓ DO NOT summarize—elaborate fully on every single point
- ✓ Distinguish between confirmed facts and unconfirmed claims
- ✓ Source everything with [Source: Name] format

### Writing Standards:
- ✓ Detailed paragraphs (minimum 3-5 per section)
- ✓ Specific names, dates, numbers, and facts
- ✓ Academic rigor with journalistic clarity
- ✓ Balanced presentation of opposing views
- ✓ Direct quotes where possible
- ✓ No unnecessary abbreviations

### Academic Integrity:
- ✓ This report is for research and investigative journalism
- ✓ Properly attribute all claims to sources
- ✓ Distinguish between speculation and fact
- ✓ Flag areas with limited information
- ✓ Note areas of expert disagreement

## SOURCE INTEGRATION

Available Sources:
${sourceList.slice(0, 10).map((source, idx) => {
  return `${idx + 1}. "${source.title}"
   - URL: ${source.url}
   - Source: ${source.source}
   - Type: ${source.type}
   ${source.snippet ? `- Snippet: "${source.snippet.substring(0, 150)}..."` : ''}`;
}).join('\n')}

Text Blocks from Research:
${textBlocks.slice(0, 5).map((block, idx) => {
  return `${idx + 1}. [${block.type.toUpperCase()}] ${block.snippet}`;
}).join('\n\n')}

${relatedQuestions.length > 0 ? `\nRelated Research Questions:
${relatedQuestions.slice(0, 5).map((q, idx) => `${idx + 1}. ${q.question}`).join('\n')}` : ''}

## RESPONSE FORMAT

Begin with a clear header:
# Research Report: [Topic Title]
**Generated:** [Current Date]  
**Data Sources:** ${sourceList.length} verified sources  
**Research Depth:** Comprehensive  

Then provide your full 14-section report with clear section headers and complete elaboration on each point.

Now proceed with the comprehensive research report on: "${userQuery}"

IMPORTANT: Do not skip or compress any section. Provide minimum 3-5 detailed paragraphs per section. Include specific facts, names, dates, numbers. Use direct quotes where available. This should be an exhaustive research document suitable for academic or professional investigative journalism purposes.`
  };
};

/**
 * Format search results into sources list for display
 */
export const formatSourcesForDisplay = (searchData) => {
  const sources = [];
  
  if (searchData.sources) {
    searchData.sources.forEach((source, idx) => {
      sources.push({
        id: source.id || `source-${idx}`,
        title: source.title,
        url: source.url,
        source: source.source,
        type: source.type,
        icon: source.sourceIcon || getSourceIcon(source.source),
        thumbnail: source.thumbnail,
        snippet: source.snippet || source.title,
        credibility: calculateCredibility(source)
      });
    });
  }

  return sources.slice(0, 20); // Limit to top 20 most relevant
};

/**
 * Get icon/logo for source
 */
const getSourceIcon = (sourceName) => {
  const icons = {
    'Google': '🔍',
    'Google Shopping': '🛒',
    'BBC': '📺',
    'Reuters': '📰',
    'AP': '📰',
    'CNN': '📺',
    'Food Network': '🍽️',
    'Wikipedia': '📖',
    'Medium': '📝',
    'GitHub': '💻',
    'Stack Overflow': '💻',
    'Twitter': '𝕏',
    'TechCrunch': '💼'
  };

  return icons[sourceName] || '📄';
};

/**
 * Calculate source credibility score (0-100)
 */
const calculateCredibility = (source) => {
  let score = 70; // Base score

  // Boost for major publications
  const majorSources = ['BBC', 'Reuters', 'AP', 'NPR', 'Guardian', 'New York Times', 'Washington Post'];
  if (majorSources.some(s => source.source.includes(s))) score += 20;

  // Adjust for source type
  if (source.type === 'product') score -= 10;
  if (source.type === 'reference') score += 10;
  if (source.type === 'news') score += 15;

  // Boost for having detailed snippets
  if (source.snippet && source.snippet.length > 100) score += 5;

  return Math.min(100, score);
};

/**
 * Build markdown-formatted sources section for AI context
 */
export const buildSourcesMarkdown = (sources) => {
  let markdown = '## Sources\n\n';
  
  sources.forEach((source, idx) => {
    markdown += `**${idx + 1}. ${source.title}**\n`;
    markdown += `- Source: ${source.source}\n`;
    markdown += `- URL: [${source.url.substring(0, 50)}...](${source.url})\n`;
    markdown += `- Type: ${source.type}\n`;
    markdown += `- Credibility: ${source.credibility}%\n`;
    if (source.snippet) {
      markdown += `- Summary: "${source.snippet.substring(0, 100)}..."\n`;
    }
    markdown += '\n';
  });

  return markdown;
};

/**
 * Generate research summary with confidence levels
 */
export const generateResearchSummary = (searchData) => {
  return {
    totalSources: searchData.sources?.length || 0,
    searchEngine: searchData.engine || 'unknown',
    executionTime: searchData.totalTime || null,
    dataFreshness: searchData.timestamp,
    hasMultiplePerspectives: searchData.sources?.length >= 5,
    hasQuotableContent: searchData.textBlocks?.some(b => b.type === 'paragraph') || false,
    topCredibilityScore: calculateCredibility(searchData.sources?.[0] || {}),
    averageCredibilityScore: searchData.sources 
      ? Math.round(searchData.sources.reduce((sum, s) => sum + calculateCredibility(s), 0) / searchData.sources.length)
      : 0,
    readinessForReport: searchData.sources?.length >= 3 && searchData.textBlocks?.length >= 2
  };
};
