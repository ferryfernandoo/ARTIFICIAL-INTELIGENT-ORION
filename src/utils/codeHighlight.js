/**
 * Syntax Highlighting untuk code blocks
 * Client-side highlighting dengan warna vibrant
 * 
 * FIXED: Perbaikan untuk mencegah code blocks berantakan:
 * 1. Regex pattern lebih spesifik, tidak terlalu agresif
 * 2. Tidak merusak HTML entities yang sudah di-escape
 * 3. Prioritas highlighting: string/comment dulu, baru keyword
 */

const syntaxPatterns = {
  javascript: [
    // Strings - highlight first to prevent inner matching
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    // Comments
    { pattern: /\/\*[\s\S]*?\*\/|\/\/.*/g, className: 'comment' },
    // Template literals
    { pattern: /`[^`]*`/g, className: 'string' },
    // Numbers
    { pattern: /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?(?:[fFlLuU])?\b/g, className: 'number' },
    // Keywords
    { pattern: /\b(const|let|var|function|async|await|yield|return|if|else|for|while|do|switch|case|default|break|continue|class|extends|super|import|export|from|as|new|this|typeof|instanceof|delete|try|catch|finally|throw|in|of|static|get|set|constructor)\b/g, className: 'keyword' },
    // Literals
    { pattern: /\b(true|false|null|undefined|NaN|Infinity)\b/g, className: 'literal' },
    // Built-in objects
    { pattern: /\b(console|Math|JSON|Promise|Array|Object|String|Number|Boolean|Map|Set|Symbol|Reflect|Proxy|Error|Date|RegExp|parseInt|parseFloat|isNaN|isFinite|fetch|setTimeout|setInterval|clearTimeout|clearInterval)\b/g, className: 'builtin' },
    // DOM
    { pattern: /\b(document|window|localStorage|sessionStorage|navigator|location|history|screen)\b/g, className: 'dom' },
    // Node.js
    { pattern: /\b(require|module|exports|__dirname|__filename|process|global|Buffer)\b/g, className: 'node' },
    // React
    { pattern: /\b(React|useState|useEffect|useRef|useCallback|useMemo|useContext|useReducer|useLayoutEffect|useImperativeHandle|useDebugValue|createContext|createRef|forwardRef|memo|Fragment|StrictMode|Suspense|lazy|Component|PureComponent|createElement|cloneElement|isValidElement|Children)\b/g, className: 'react' },
    // Libraries
    { pattern: /\b(axios|express|app|router|req|res|next)\b/g, className: 'library' },
  ],
  python: [
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    { pattern: /#.*/g, className: 'comment' },
    { pattern: /\b-?\d+(?:\.\d+)?[jJ]?\b/g, className: 'number' },
    { pattern: /\b(def|class|if|elif|else|for|while|return|import|from|as|try|except|finally|with|yield|pass|break|continue|raise|assert|lambda|and|or|not|in|is|del|global|nonlocal|async|await|print|len|range|map|filter|zip|enumerate|sorted|reversed|type|isinstance|hasattr|getattr|setattr|delattr|open|super|self|cls|True|False|None)\b/g, className: 'keyword' },
    { pattern: /\b(list|dict|set|tuple|str|int|float|bool|bytes|bytearray|memoryview|frozenset|property|staticmethod|classmethod|__init__|__str__|__repr__|__len__|__getitem__|__setitem__|__delitem__|__iter__|__next__|__enter__|__exit__|__call__|__add__|__sub__|__mul__|__truediv__|__floordiv__|__mod__|__pow__|__eq__|__ne__|__lt__|__le__|__gt__|__ge__)\b/g, className: 'builtin' },
    { pattern: /\b(np|pd|plt|sns|tf|torch|nn|os|sys|re|json|math|random|datetime|collections|itertools|functools|pathlib|typing)\b/g, className: 'library' },
  ],
  html: [
    { pattern: /<!--[\s\S]*?-->/g, className: 'comment' },
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    // Match HTML tags - use a simpler approach that works with escaped content
    // After escapeHtml, <div> becomes <div> - we match the escaped form
    { pattern: new RegExp(String.fromCharCode(60) + '\\/?[\\w-]+(?:\\s+[\\w-]+(?:\\s*=\\s*(?:"[^"]*"|\'[^\']*\'|[^\\s' + String.fromCharCode(62) + ']+))?)*\\s*\\/?' + String.fromCharCode(62), 'g'), className: 'tag' },
    { pattern: /\b(class|id|style|src|href|rel|type|name|value|placeholder|disabled|readonly|required|checked|selected|data-\w+|aria-\w+|role|alt|title|width|height|target|method|action|onclick|onchange|onsubmit|onload|onerror)\b(?=\s*=)/g, className: 'attribute' },
  ],




  css: [
    { pattern: /\/\*[\s\S]*?\*\//g, className: 'comment' },
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    { pattern: /(#[\da-fA-F]{3,8}|\.-?[\w-]+|#-?[\w-]+)/g, className: 'selector' },
    { pattern: /@(import|media|keyframes|font-face|supports|layer)/g, className: 'atrule' },
    { pattern: /:(hover|focus|active|visited|before|after|nth-child|first-child|last-child|not|is|where|has)/g, className: 'pseudo' },
    { pattern: /\b(background|color|display|flex|grid|margin|padding|font|border|width|height|position|top|left|right|bottom|transform|transition|animation|box-shadow|text-shadow|opacity|overflow|z-index|cursor|outline|visibility|align-items|justify-content|gap|flex-direction|flex-wrap|grid-template|grid-area|object-fit|filter|clip-path|backdrop-filter|user-select|pointer-events|will-change|scroll-behavior|scrollbar-width)\b/g, className: 'property' },
    { pattern: /\b(\d+\.?\d*)(px|em|rem|vh|vw|%|s|ms|deg|rad|fr)?/g, className: 'value' },
  ],
  json: [
    { pattern: /"([^"\\]|\\.)*"\s*:/g, className: 'key' },
    { pattern: /"([^"\\]|\\.)*"/g, className: 'string' },
    { pattern: /\b(true|false|null)\b/g, className: 'literal' },
    { pattern: /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, className: 'number' },
  ],
  sql: [
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    { pattern: /--.*/g, className: 'comment' },
    { pattern: /\b-?\d+(?:\.\d+)?\b/g, className: 'number' },
    { pattern: /\b(SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|ALTER|DROP|INDEX|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AND|OR|NOT|IN|LIKE|BETWEEN|IS|NULL|AS|ORDER|BY|GROUP|HAVING|LIMIT|OFFSET|UNION|ALL|DISTINCT|COUNT|SUM|AVG|MIN|MAX|EXISTS|CASE|WHEN|THEN|ELSE|END|BEGIN|COMMIT|ROLLBACK|GRANT|REVOKE|PRIMARY|KEY|FOREIGN|REFERENCES|CASCADE|CONSTRAINT|UNIQUE|CHECK|DEFAULT|AUTO_INCREMENT|SERIAL|INTEGER|VARCHAR|TEXT|BOOLEAN|DATE|TIMESTAMP|FLOAT|DOUBLE|DECIMAL|BIGINT|SMALLINT|TINYINT|BLOB|ENUM|SET)\b/gi, className: 'keyword' },
  ],
  bash: [
    { pattern: /(['"`])(?:(?=(\\?))\2.)*?\1/g, className: 'string' },
    { pattern: /#.*/g, className: 'comment' },
    { pattern: /\b-?\d+(?:\.\d+)?\b/g, className: 'number' },
    { pattern: /\$[\w_]+|\$\{[\w_]+\}/g, className: 'variable' },
    { pattern: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|break|continue|export|local|readonly|declare|typeset|set|unset|shift|source|\.|exec|eval|trap|wait|sleep|echo|printf|read|cd|pwd|ls|mkdir|rm|cp|mv|chmod|chown|grep|sed|awk|cat|head|tail|sort|uniq|wc|find|xargs|tar|gzip|gunzip|zip|unzip|curl|wget|ssh|scp|git|npm|yarn|node|python|pip|docker|kubectl|sudo|apt|yum|brew|nano|vim|less|more|clear|history|alias|unalias|type|which|whereis|man|help|true|false)\b/g, className: 'keyword' },
  ],
};

/**
 * Clean and validate code block content
 */
export const cleanCodeBlock = (content, language = 'plaintext') => {
  if (!content) return '';
  
  let cleaned = content;
  
  // Remove markdown escape sequences
  cleaned = cleaned
    .replace(/`/g, '`')
    .replace(/\*/g, '*')
    .replace(/\\\[/g, '[')
    .replace(/\\\]/g, ']')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\|/g, '|');
  
  // Remove markdown formatting from code
  cleaned = cleaned
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
  
  // Remove incomplete markdown at end
  cleaned = cleaned
    .replace(/\*\*\s*$/gm, '')
    .replace(/\*\s*$/gm, '')
    .replace(/__\s*$/gm, '')
    .replace(/_\s*$/gm, '')
    .replace(/```\s*$/gm, '');
  
  // Remove trailing noise patterns
  cleaned = cleaned
    .replace(/[-*]\s*\n\s*$/gm, '\n')
    .replace(/\.\s*\n\s*$/gm, '\n')
    .replace(/['"]\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n');
  
  if (language === 'markdown' || language === 'md') {
    cleaned = cleaned.replace(/^#+\s*/gm, '');
  }
  
  cleaned = cleaned
    .split('\n')
    .map(line => line.trimEnd())
    .join('\n')
    .replace(/^\n+/, '')
    .replace(/\n+$/, '');
  
  return cleaned;
};

export const detectLanguage = (code = '', fence = 'javascript') => {
  const fenceStr = fence ? String(fence) : 'javascript';
  const detectable = fenceStr.toLowerCase();
  if (Object.keys(syntaxPatterns).includes(detectable)) {
    return detectable;
  }
  
  if (code.includes('<?php') || code.includes('$_')) return 'php';
  if (code.includes('SELECT ') || code.includes('INSERT ')) return 'sql';
  if (code.includes('def ') || code.includes(':')) return 'python';
  if (code.includes('<!DOCTYPE') || code.includes('<html')) return 'html';
  if (code.includes('package ') || code.includes('class ')) return 'java';
  
  return 'javascript';
};

/**
 * Escape special regex characters in a string
 */
const escapeRegExp = (string) => {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Escape HTML entities
 */
const escapeHtml = (text) => {

  // Use String.fromCharCode to avoid HTML entity encoding issues in source files
  const amp = String.fromCharCode(38) + 'amp;';
  const lt = String.fromCharCode(38) + 'lt;';
  const gt = String.fromCharCode(38) + 'gt;';
  const quot = String.fromCharCode(38) + 'quot;';
  const apos = String.fromCharCode(38) + '#039;';
  return text
    .replace(/&/g, amp)
    .replace(/</g, lt)
    .replace(/>/g, gt)
    .replace(/"/g, quot)
    .replace(/'/g, apos);
};




/**
 * Apply syntax highlighting with vibrant colors
 * FIXED: Perbaikan untuk mencegah HTML di-compile sebagai tag HTML asli
 * Strategi: highlight dulu pada konten asli, lalu escape HTML
 */
export const highlightCode = (code, language = 'javascript') => {
  // First clean markdown artifacts
  let cleanCode = code
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/~~(.+?)~~/g, '$1');
  
  // Apply syntax highlighting patterns on original content (before escaping)
  const patterns = syntaxPatterns[language] || syntaxPatterns['javascript'];
  let highlighted = cleanCode;
  
  if (patterns) {
    for (const { pattern, className } of patterns) {
      highlighted = highlighted.replace(pattern, (match) => {
        // Don't highlight inside already highlighted spans
        if (match.includes('<span class="')) return match;
        return `<span class="hl-${className}">${match}</span>`;
      });
    }
  }
  
  // Now escape HTML in the highlighted result
  // But preserve the <span> tags we just added
  // Strategy: temporarily replace <span> with a placeholder, escape, then restore
  const SPAN_OPEN_PLACEHOLDER = '%%SPAN_OPEN%%';
  const SPAN_CLOSE_PLACEHOLDER = '%%SPAN_CLOSE%%';
  
  let processed = highlighted
    .replace(/<span class="hl-/g, SPAN_OPEN_PLACEHOLDER)
    .replace(/<\/span>/g, SPAN_CLOSE_PLACEHOLDER);
  
  let escaped = escapeHtml(processed);
  
  // Restore the <span> tags
  escaped = escaped
    .replace(new RegExp(escapeRegExp(SPAN_OPEN_PLACEHOLDER), 'g'), '<span class="hl-')
    .replace(new RegExp(escapeRegExp(SPAN_CLOSE_PLACEHOLDER), 'g'), '</span>');
  
  return escaped;

};


/**
 * Parse markdown code blocks from text
 */
const isHtmlLikeLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('```')) return false;
  if (/^<\/?[a-zA-Z][^>]*>/.test(trimmed) && trimmed.includes('>')) {
    return true;
  }
  return false;
};

const isTableLikeLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return /^\|.*\|$|^[^|]*\|[^|]*$/.test(trimmed) && trimmed.includes('|');
};

const isCodeLikeLine = (line) => {
  if (!line) return false;
  const t = line.trim();
  if (!t) return false;
  if (/^`{1,3}\s*[\w-]*\s*$/.test(t)) return false;
  if (isTableLikeLine(t)) return false;

  const codePatterns = [
    /\b(?:const|let|var)\b\s+[\w$]+\s*=/,
    /\bfunction\b\s+[\w$]+\s*\(/,
    /\basync\b\s+function\b/,
    /\bawait\b\s+[\w$.({]/,
    /\breturn\b\s+[\w[({'"]/,
    /\bclass\b\s+[\w$]+/,
    /\bimport\b\s+.*\bfrom\b/,
    /\bexport\b\s+(?:default\s+)?[\w$]+/,
    /\bdef\b\s+[\w_]+\s*\(/,
    /\b(?:elif|except|lambda)\b/,
    /\{\s*\}/, /\{/, /\}/, /=>/, /\(.*\)\s*=>/, /\bconsole\.log\b/, /;\s*$/,
    /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bFROM\b/,
    /^#\s*!?\/?|^#!/,
    /^\s*\/\//, /^\s*\/\*/, /^\s*#/,
    /\btypedef\b/,
    /^\s*(?:if|for|while|def|class|else|elif|try|except|with|finally)\b.*:\s*$/,
  ];

  for (const p of codePatterns) {
    if (p.test(t)) return true;
  }

  const symbolCount = (t.match(/[<>/=+*{}()[\]]/g) || []).length;
  if (symbolCount >= 5) return true;
  if (/^\s{4,}/.test(line)) return true;

  return false;
};

const isStrongCodeLine = (line) => {
  if (!line) return false;
  const t = line.trim();
  return /=>/.test(t)
    || /;\s*$/.test(t)
    || /\{/.test(t)
    || /\}/.test(t)
    || /^\s*(?:def|class|for|while|if|switch|case|try|except|import|const|let|var|async)\b/.test(t)
    || /^\s*#/.test(line)
    || /^\s*\/\//.test(line)
    || /^\s*\/\*/.test(line)
    || /\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bFROM\b/.test(t);
};

const splitTextIntoHtmlAndTextBlocks = (text) => {
  const lines = text.split('\n');
  const blocks = [];
  let buffer = [];
  let mode = 'text';
  let tableBuffer = [];

  const flush = () => {
    if (!buffer.length && !tableBuffer.length) return;
    if (tableBuffer.length) {
      blocks.push({ type: 'table', content: tableBuffer.join('\n') });
      tableBuffer = [];
    }
    if (buffer.length) {
      blocks.push({ type: mode, content: buffer.join('\n') });
      buffer = [];
    }
  };

  let codeBuffer = [];

  const flushCodeBuffer = () => {
    if (!codeBuffer.length) return;
    const codeText = codeBuffer.join('\n');
    const shouldTreatAsCode = codeBuffer.length >= 2 || isStrongCodeLine(codeBuffer[0]);
    if (shouldTreatAsCode) {
      flush();
      blocks.push({ type: 'code', content: codeText });
    } else {
      buffer.push(...codeBuffer);
    }
    codeBuffer = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const htmlLine = isHtmlLikeLine(line);
    const tableLine = isTableLikeLine(line);
    const codeLike = isCodeLikeLine(line);

    if (htmlLine && mode === 'text') {
      flushCodeBuffer();
      flush();
      mode = 'html';
      buffer.push(line);
      continue;
    }

    if (tableLine) {
      flushCodeBuffer();
      if (mode !== 'text' || buffer.length) {
        flush();
        mode = 'text';
      }
      tableBuffer.push(line);
      continue;
    }

    if (codeBuffer.length > 0) {
      if (codeLike || line.trim() === '') {
        codeBuffer.push(line);
        continue;
      }
      flushCodeBuffer();
    }

    if (codeLike) {
      codeBuffer.push(line);
      continue;
    }

    if (tableBuffer.length) {
      blocks.push({ type: 'table', content: tableBuffer.join('\n') });
      tableBuffer = [];
    }
    buffer.push(line);
  }

  flushCodeBuffer();
  flush();
  return blocks;
};

export const parseCodeBlocks = (text) => {
  const blocks = [];
  const pattern = /```([\w-]*)\s*([\s\S]*?)(?:```|$)/gm;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const beforeText = text.substring(lastIndex, match.index);
      splitTextIntoHtmlAndTextBlocks(beforeText).forEach((block) => blocks.push(block));
    }

    let codeContent = match[2];
    if (codeContent.startsWith('\n')) {
      codeContent = codeContent.replace(/^\n+/, '');
    }
    codeContent = codeContent.replace(/\n+$/, '');
    
    const language = (match[1] && match[1].trim()) || 'plaintext';
    codeContent = cleanCodeBlock(codeContent, language);
    
    blocks.push({
      type: 'code',
      language: language,
      content: codeContent,
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    const remaining = text.substring(lastIndex);
    splitTextIntoHtmlAndTextBlocks(remaining).forEach((block) => blocks.push(block));
  }

  if (blocks.length === 0) {
    return [{ type: 'text', content: text }];
  }

  const normalized = blocks.map((b) => {
    if (b.type === 'html') {
      return { type: 'code', language: 'html', content: b.content };
    }
    if (b.type === 'table') {
      return { type: 'code', language: 'table', content: b.content };
    }
    if (b.type === 'code' && (!b.language || b.language === 'plaintext')) {
      const lang = detectLanguage(b.content, b.language || 'plaintext');
      return { ...b, language: lang };
    }
    return b;
  });

  const merged = [];
  for (let i = 0; i < normalized.length; i++) {
    const current = normalized[i];

    if (current.type !== 'code') {
      merged.push(current);
      continue;
    }

    let mergedBlock = { ...current };
    let j = i + 1;

    while (j < normalized.length) {
      const next = normalized[j];

      if (
        (next.type === 'text' && next.content.trim() === '') ||
        (next.type === 'code' && (mergedBlock.language === next.language || !next.language))
      ) {
        mergedBlock.content += '\n' + next.content;
        j += 1;
        continue;
      }

      break;
    }

    merged.push(mergedBlock);
    i = j - 1;
  }

  return merged;
};
