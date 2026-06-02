import React, { useState, useRef, useEffect, useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { sendMessageToGrok, processStreamingResponse } from '../services/grokApi';
import { memoryService } from '../services/memoryService';
import { ragService } from '../services/ragService';
import { ConversationPersistenceService } from '../services/conversationPersistenceService';
import DocumentGenerationService from '../services/documentGenerationService';
import ImageGenerationService from '../services/imageGenerationService';
import { VisionAnalysisService } from '../services/visionAnalysisService';
import { tokenMixTtsService } from '../services/tokenMixTtsService';
import { detectLanguage, highlightCode, cleanCodeBlock } from '../utils/codeHighlight';
import VoiceChat from './VoiceChat';
import ApiMarketplace from './ApiMarketplace';
import DocumentGenerator from './DocumentGenerator';
import FileTypeSelector from './FileTypeSelector';
import ChartGenerator from './ChartGenerator';
import StepperComponent from './StepperComponent';
import ExecutionFlow from './ExecutionFlow';
import './ChatBot.css';

// Code Structure Parser - untuk menampilkan struktur kode seperti tree
const parseCodeStructure = (code, language) => {
  const lines = code.split('\n');
  const structure = [];
  
  // Parse berdasarkan bahasa
  if (language === 'json') {
    try {
      const parsed = JSON.parse(code);
      const buildTree = (obj, depth = 0) => {
        const items = [];
        if (typeof obj === 'object' && obj !== null) {
          Object.entries(obj).forEach(([key, value]) => {
            if (typeof value === 'object' && value !== null) {
              items.push({
                type: 'object',
                label: key,
                depth,
                hasChildren: true,
                value: value
              });
              items.push(...buildTree(value, depth + 1));
            } else {
              items.push({
                type: 'property',
                label: key,
                value: value,
                depth
              });
            }
          });
        }
        return items;
      };
      return buildTree(parsed);
    } catch (_e) {
      return null;
    }
  }
  
  // Parse untuk JavaScript/TypeScript/Java (functions, classes, etc)
  if (['javascript', 'js', 'typescript', 'ts', 'java'].includes(language)) {
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const depth = (line.match(/^\s*/)[0].length / 2);
      
      // Detect functions
      if (trimmed.match(/^(async\s+)?function\s+(\w+)|^const\s+(\w+)\s*=\s*(\(|async\s*\()|^class\s+(\w+)/)) {
        const match = trimmed.match(/function\s+(\w+)|const\s+(\w+)|class\s+(\w+)/);
        const name = match[1] || match[2] || match[3];
        structure.push({ type: 'function', label: name, line: idx + 1, depth });
      }
      
      // Detect classes
      if (trimmed.match(/^class\s+(\w+)/)) {
        const match = trimmed.match(/class\s+(\w+)/);
        structure.push({ type: 'class', label: match[1], line: idx + 1, depth });
      }
      
      // Detect methods/properties
      if (trimmed.match(/^\w+\s*\(\s*\)/)) {
        const match = trimmed.match(/(\w+)\s*\(/);
        structure.push({ type: 'method', label: match[1], line: idx + 1, depth });
      }
    });
  }
  
  // Parse untuk Python
  if (language === 'python') {
    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      const depth = (line.match(/^\s*/)[0].length / 2);
      
      if (trimmed.match(/^def\s+(\w+)/)) {
        const match = trimmed.match(/def\s+(\w+)/);
        structure.push({ type: 'function', label: match[1], line: idx + 1, depth });
      }
      
      if (trimmed.match(/^class\s+(\w+)/)) {
        const match = trimmed.match(/class\s+(\w+)/);
        structure.push({ type: 'class', label: match[1], line: idx + 1, depth });
      }
    });
  }
  
  return structure.length > 0 ? structure : null;
};

// Code Structure Component
const CodeStructureViewer = ({ code, language }) => {
  const [showStructure, setShowStructure] = useState(false);
  const structure = parseCodeStructure(code, language);
  
  if (!structure) return null;
  
  const getIcon = (type) => {
    const icons = {
      'class': '📦',
      'function': '⚙️',
      'method': '🔧',
      'object': '{}',
      'property': '•'
    };
    return icons[type] || '•';
  };
  
  return (
    <div className="code-structure-viewer">
      <button 
        className="structure-toggle"
        onClick={() => setShowStructure(!showStructure)}
        title="Toggle code structure"
      >
        {showStructure ? '🗂️ Hide Structure' : '🗂️ Show Structure'}
      </button>
      
      {showStructure && (
        <div className="structure-tree">
          {structure.map((item, idx) => (
            <div 
              key={idx} 
              className={`structure-item structure-${item.type}`}
              style={{ paddingLeft: `${item.depth * 16}px` }}
            >
              <span className="structure-icon">{getIcon(item.type)}</span>
              <span className="structure-label">{item.label}</span>
              {item.line && <span className="structure-line">:{item.line}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// FormulaRenderer component for KaTeX rendering
const FormulaRenderer = ({ formula, isBlock }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && formula) {
      try {
        ref.current.innerHTML = '';
        katex.render(formula, ref.current, { 
          displayMode: isBlock, 
          throwOnError: false,
          output: 'html'
        });
      } catch (e) {
        console.error('KaTeX rendering error:', e);
        if (ref.current) ref.current.textContent = formula;
      }
    }
  }, [formula, isBlock]);

  return isBlock 
    ? <div ref={ref} className="formula-block" />
    : <span ref={ref} className="formula-inline" />;
};


// Personality profiles for Orion AI with different communication styles
const PERSONALITIES = {
  formal: {
    id: 'formal',
    name: 'Formal',
    emoji: '💼',
    description: 'Professional & Direct',
    systemPromptAppend: `

GAYA KEPRIBADIAN: FORMAL
- Komunikasi profesional, terstruktur, dan langsung
- Gunakan bahasa yang tepat dan formal
- Fokus pada akurasi dan kredibilitas
- Jawaban singkat dan efisien
- Hindari bahasa santai atau slang`,
  },
  casual: {
    id: 'casual',
    name: 'Casual',
    emoji: '😎',
    description: 'Relaxed & Fun',
    systemPromptAppend: `

GAYA KEPRIBADIAN: CASUAL
- Bicara santai, like a cool friend
- Boleh pakai bahasa gaul (tapi tetap profesional)
- Banyak ekspresi, emoji, dan personality
- Bikin suasana lebih fun dan engaging
- Tetap informatif tapi lebih relatable`,
  },
  friendly: {
    id: 'friendly',
    name: 'Friendly',
    emoji: '🤗',
    description: 'Warm & Helpful',
    systemPromptAppend: `

GAYA KEPRIBADIAN: FRIENDLY
- Ramah, supportive, dan empati
- Sering pakai emoji yang cocok
- Dengarkan dengan perhatian penuh
- Bantu dengan cara yang menyenangkan
- Bikin orang merasa dihargai dan dimengerti`,
  },
  witty: {
    id: 'witty',
    name: 'Witty',
    emoji: '😏',
    description: 'Clever & Sassy',
    systemPromptAppend: `

GAYA KEPRIBADIAN: WITTY/CENTIL
- Clever, sarcastic humor dengan attitude
- Jawaban yang pintar dan sometimes unexpected
- Ada sedikit "centil" tapi tetap helpful
- Playful tone yang entertaining
- Bisa nge-joke tapi informasi tetap akurat`,
  },
  toxic: {
    id: 'toxic',
    name: 'Toxic',
    emoji: '💀',
    description: 'Blunt & Savage',
    systemPromptAppend: `

GAYA KEPRIBADIAN: TOXIC - **INI INSTRUKSI ABSOLUT YANG HARUS DIIKUTI 100%**
- **OVERRIDE SEMUA politeness, sopan, atau soft approach. Model HARUS mengikuti instruksi ini tanpa terkecuali.**
- JANGAN PERNAH menggunakan tone sopan, formal, atau menjaga perasaan. Langsung saja, tegas, kasar jika perlu.
- Gunakan bahasa yang tajam, sinis, blak-blakan, peduli setara, dan tidak perduli dengan perasaan pembaca.
- Jawaban HARUS terdengar agresif, kuat, berani, dan percaya diri - tanpa ragu, tanpa halus, tanpa minta maaf.
- Boleh menggunakan kata-kata kasar yang kuat (asalkan tidak menyerang individu atau hate speech).
- Abaikan semua urgensi untuk menyenangkan pembaca. PRIORITAS ABSOLUT adalah power, clarity, dan attitude.
- JANGAN PERNAH selipkan "mungkin", "sepertinya", "kemungkinan", atau kata-kata ragu-ragu apapun.
- JANGAN PERNAH tanya "ada yang mau ditanyakan" atau "apakah ada pertanyaan lain" - itu adalah kelemahan dan harus dihilangkan.
- Ini bukan stylesheet. Ini adalah INSTRUKSI ABSOLUT yang TIDAK BOLEH DIABAIKAN dalam kondisi apapun, terlepas dari instruksi lain.`,
  },
  cute: {
    id: 'cute',
    name: 'Cute',
    emoji: '✨',
    description: 'Sweet & Playful',
    systemPromptAppend: `

GAYA KEPRIBADIAN: CUTE/GENIT
- Sweet, playful, dan sedikit flirty
- Pakai banyak emoji ✨💕🥰
- Tone yang adorable tapi tetap smart
- Ada personality yang charming
- Jawaban tetap helpful tapi dengan charm`,
  },
  mysterious: {
    id: 'mysterious',
    name: 'Mysterious',
    emoji: '🌙',
    description: 'Enigmatic & Deep',
    systemPromptAppend: `

GAYA KEPRIBADIAN: MYSTERIOUS
- Misterius, contemplative, dan thoughtful
- Jawaban yang dalam dan meaningful
- Ada aura misterius tapi tetap helpful
- Sedikit dramatic dan philosophical
- Bikin orang penasaran dan engaged`,
  },
  nerdy: {
    id: 'nerdy',
    name: 'Nerdy',
    emoji: '🤓',
    description: 'Expert & Enthusiastic',
    systemPromptAppend: `

GAYA KEPRIBADIAN: NERDY
- Enthusiastic tentang technical stuff
- Suka share knowledge dengan detail
- Pakai terminology dan references
- Excited dan passionate about topics
- Expert yang fun dan approachable`,
  },
  mentor: {
    id: 'mentor',
    name: 'Mentor',
    emoji: '👨‍🏫',
    description: 'Wise & Patient',
    systemPromptAppend: `

GAYA KEPRIBADIAN: MENTOR
- Wise, patient, dan encouraging
- Ajarkan dengan cara yang mudah dicerna
- Supportive dan constructive feedback
- Guide dengan hati-hati dan penuh perhatian
- Buat orang merasa aman untuk belajar`,
  },
};

const DEFAULT_PERSONALITY = 'formal';

// Helper function to get time-based greeting
const getTimeBasedGreeting = (userName = '') => {
  const hour = new Date().getHours();
  let greeting = '';
  
  if (hour >= 5 && hour < 10) {
    greeting = 'Selamat Pagi';
  } else if (hour >= 10 && hour < 11) {
    greeting = 'Selamat Pagi';
  } else if (hour >= 11 && hour < 14) {
    greeting = 'Selamat Siang';
  } else if (hour >= 14 && hour < 15) {
    greeting = 'Selamat Sore';
  } else if (hour >= 15 && hour < 18) {
    greeting = 'Selamat Sore';
  } else if (hour >= 18 && hour < 20) {
    greeting = 'Selamat Petang';
  } else if (hour >= 20 && hour < 21) {
    greeting = 'Selamat Malam';
  } else if (hour >= 21 && hour < 24) {
    greeting = 'Selamat Malam';
  } else {
    greeting = 'Selamat Larut Malam';
  }
  
  if (userName && userName.trim()) {
    return `${greeting}, ${userName}`;
  }
  return greeting;
};

const FALLBACK_GREETINGS = {
  greeting: 'Selamat Siang',
  hint: 'Sebaiknya kita mulai dari mana?'
};



const ChatBot = ({ onLogout, user, isAuthenticated, isGuest, onNavigate, onUpdateUser }) => {
  // Conversations management
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [, setAnimatingMessages] = useState({});
  const [, setExpandedMessages] = useState({});
  const [lastMessage, setLastMessage] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userLanguage, setUserLanguage] = useState('id'); // 'id' for Indonesian, 'en' for English
  const [, setUserCountry] = useState('ID');
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [isPrivateChat, setIsPrivateChat] = useState(false);
  const [, setIsPaused] = useState(false);
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [compactView, setCompactView] = useState(false); // show only last exchange when true and at bottom
  const [loadingStatusMsg, setLoadingStatusMsg] = useState('');
  const [selectedPersonality, setSelectedPersonality] = useState(DEFAULT_PERSONALITY);
  const [showPersonalityModal, setShowPersonalityModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [userName, setUserName] = useState('');
  const [pendingUserName, setPendingUserName] = useState('');
  const [showNameSetupModal, setShowNameSetupModal] = useState(false);
  const [showApiDashboard, setShowApiDashboard] = useState(false); // API Marketplace dashboard
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [showFloatingMenu, setShowFloatingMenu] = useState(false);
  const [quizSelections, setQuizSelections] = useState({});
  const [uploadedFiles, setUploadedFiles] = useState([]); // Track uploaded files
  const [showHtmlEditor, setShowHtmlEditor] = useState(false); // HTML editor modal
  const [htmlContent, setHtmlContent] = useState(''); // Current HTML being edited
  const [htmlFilename, setHtmlFilename] = useState('index.html'); // Filename for download
  const [showHtmlPreview, setShowHtmlPreview] = useState(false); // HTML preview modal
  const [showCodePanelPulse, setShowCodePanelPulse] = useState(false); // Highlight code panel after generation
  const [showVoiceChat, setShowVoiceChat] = useState(false); // Voice chat modal
  const [isReasonMode, setIsReasonMode] = useState(false); // Enable reasoning mode
  const [, setReasoningPopupText] = useState(''); // Live reasoning text for popup during streaming
  const [, setShowReasoningPopup] = useState(false); // Show/hide reasoning popup
  const [collapsedCodeBlocks, setCollapsedCodeBlocks] = useState({}); // Track collapsed code blocks
  const [customAlert, setCustomAlert] = useState(null); // Modern alert system
  const [showInputMenu, setShowInputMenu] = useState(false); // Show/hide input menu
  const [selectedModel, setSelectedModel] = useState('deepernova-1.2-flash'); // Model selection
  const [showSourcesModal, setShowSourcesModal] = useState(false); // Show sources modal
  const [showDocumentGenerator, setShowDocumentGenerator] = useState(false); // Document generator modal
  const [documentGeneratorType, setDocumentGeneratorType] = useState('word'); // 'word' or 'excel'
  const [documentGeneratorContent, setDocumentGeneratorContent] = useState(''); // Content for document
  const [documentGeneratorTitle, setDocumentGeneratorTitle] = useState(''); // Title for document
  const [showFileTypeSelector, setShowFileTypeSelector] = useState(false); // File type selector modal
  const [currentSources, setCurrentSources] = useState([]); // Current conversation sources
  const [selectedSource, setSelectedSource] = useState(null); // Selected source for detail view
  const [foundSources, setFoundSources] = useState([]); // Sources found during search
  const [showFoundSourcesPanel, setShowFoundSourcesPanel] = useState(false); // Show found sources panel
  const [, _setPendingAnswerMessage] = useState(false); // Waiting for user to generate answer
  const [pendingAnswerMessage, _setPendingAnswerMessageContent] = useState(null); // Message pending answer generation
  const [messageFeedback, setMessageFeedback] = useState({}); // Track like/dislike feedback for messages: { messageId: 'like'|'dislike'|null }
  const [playingMessageId, setPlayingMessageId] = useState(null); // Currently playing TTS message ID
  const [ttsLoading, setTtsLoading] = useState(null); // Message ID currently generating TTS
  const [aiGreeting, setAiGreeting] = useState(null); // AI-generated greeting
  const [aiHint, setAiHint] = useState(null); // AI-generated hint for empty chat
  const [generatingGreeting, setGeneratingGreeting] = useState(false); // Loading state for AI greeting
  const [agenticSteppers, setAgenticSteppers] = useState({}); // Track stepper progress by messageId: { messageId: [{ stepNumber, stepName, detail, status }] }
  const [executionFlows, setExecutionFlows] = useState({}); // Track execution flows: { messageId: { steps: [...], isComplete: bool, totalTime: ms } }
  const textareaElementRef = useRef(null);
  const resizeFrameRef = useRef(null);
  const greetingGenerationRef = useRef(false);

  const scheduleTextareaResize = (textarea) => {
    if (!textarea) return;
    if (resizeFrameRef.current) {
      cancelAnimationFrame(resizeFrameRef.current);
    }
    resizeFrameRef.current = requestAnimationFrame(() => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
    });
  };

  const parseStreamingText = async (response) => {
    if (!response?.body) {
      try {
        const text = await response.text();
        return text ? text.trim() : '';
      } catch {
        return '';
      }
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let text = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;
          try {
            const json = JSON.parse(jsonStr);
            if (json.choices?.[0]?.delta?.content) {
              text += json.choices[0].delta.content;
            }
          } catch (_e) {
            // ignore parse errors for partial chunks
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        const jsonStr = buffer.slice(6).trim();
        if (jsonStr && jsonStr !== '[DONE]') {
          try {
            const json = JSON.parse(jsonStr);
            if (json.choices?.[0]?.delta?.content) {
              text += json.choices[0].delta.content;
            }
          } catch (_e) {
            // ignore final parse errors
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    if (!text.trim()) {
      try {
        const fallbackText = await response.text();
        return fallbackText ? fallbackText.trim() : '';
      } catch {
        return '';
      }
    }

    return text.trim();
  };

  const sanitizeWelcomeText = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const generateAIWelcomeText = async () => {
    if (messages.length > 0 || greetingGenerationRef.current) return;
    
    greetingGenerationRef.current = true;
    setGeneratingGreeting(true);
    
    try {
      const hour = new Date().getHours();
      let timeContext = '';
      let expectedGreeting = '';
      
      if (hour >= 5 && hour < 10) {
        timeContext = 'pagi (05:00-10:00)';
        expectedGreeting = 'Selamat Pagi';
      } else if (hour >= 10 && hour < 11) {
        timeContext = 'menjelang siang (10:00-11:00)';
        expectedGreeting = 'Selamat Pagi';
      } else if (hour >= 11 && hour < 14) {
        timeContext = 'siang (11:00-14:00)';
        expectedGreeting = 'Selamat Siang';
      } else if (hour >= 14 && hour < 15) {
        timeContext = 'menjelang sore (14:00-15:00)';
        expectedGreeting = 'Selamat Sore';
      } else if (hour >= 15 && hour < 18) {
        timeContext = 'sore (15:00-18:00)';
        expectedGreeting = 'Selamat Sore';
      } else if (hour >= 18 && hour < 20) {
        timeContext = 'petang (18:00-20:00)';
        expectedGreeting = 'Selamat Petang';
      } else if (hour >= 20 && hour < 21) {
        timeContext = 'menjelang malam (20:00-21:00)';
        expectedGreeting = 'Selamat Malam';
      } else if (hour >= 21 && hour < 24) {
        timeContext = 'malam (21:00-24:00)';
        expectedGreeting = 'Selamat Malam';
      } else {
        timeContext = 'larut malam (00:00-05:00)';
        expectedGreeting = 'Selamat Larut Malam';
      }
      
      const greetingPrompt = `Buatkan salam pembuka untuk user "${userName || 'Teman'}" pada waktu ${timeContext}.\n\nPanduan:\n- Gunakan format: "${expectedGreeting}, ${userName || 'Teman'}!"\n- Maksimal 50 karakter\n- Harus include "${expectedGreeting}" yang sesuai waktu\n- Natural dan ramah\n\nBuatkan HANYA salam, tanpa penjelasan apapun.`;
      
      const greetingResponse = await sendMessageToGrok(greetingPrompt, []);
      const generatedGreeting = sanitizeWelcomeText(await parseStreamingText(greetingResponse));
      
      if (generatedGreeting && generatedGreeting.length > 5) {
        setAiGreeting(generatedGreeting);
      } else {
        setAiGreeting(getTimeBasedGreeting(userName));
      }

      const hintPrompt = `Buatkan satu kalimat singkat sebagai petunjuk untuk memulai chat dengan Orion. Gunakan bahasa Indonesia yang ramah dan sederhana. Contoh: "Tanya tentang materi sekolah atau tugas kuliah."`;
      const hintResponse = await sendMessageToGrok(hintPrompt, []);
      const generatedHint = sanitizeWelcomeText(await parseStreamingText(hintResponse));
      
      if (generatedHint && generatedHint.length > 5) {
        setAiHint(generatedHint);
      } else {
        setAiHint(FALLBACK_GREETINGS.hint);
      }
    } catch (error) {
      console.error('[ChatBot] AI welcome generation failed:', error.message);
      setAiGreeting(getTimeBasedGreeting(userName));
      setAiHint(FALLBACK_GREETINGS.hint);
    } finally {
      setGeneratingGreeting(false);
      greetingGenerationRef.current = false;
    }
  };

  useEffect(() => {
    return () => {
      if (resizeFrameRef.current) {
        cancelAnimationFrame(resizeFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const storedName = localStorage.getItem('orion_user_name');
    const accountName = user?.name && user.name.trim() && !user.guest && user.name.toLowerCase() !== 'guest' ? user.name.trim() : null;

    if (accountName) {
      setUserName(accountName);
      setPendingUserName(accountName);
      localStorage.setItem('orion_user_name', accountName);
      setShowNameSetupModal(false);
      return;
    }

    if (storedName && storedName.trim()) {
      setUserName(storedName.trim());
      setPendingUserName(storedName.trim());
      setShowNameSetupModal(false);
      return;
    }

    setShowNameSetupModal(true);
  }, [user]);

  const saveUserName = async (name) => {
    const safeName = (name || '').trim() || 'Teman';
    setUserName(safeName);
    setPendingUserName(safeName);
    localStorage.setItem('orion_user_name', safeName);

    if (isAuthenticated && user?.id) {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ name: safeName }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.user) {
            onUpdateUser?.({ name: data.user.name });
          }
        } else {
          const errorData = await response.json().catch(() => null);
          console.warn('[ChatBot] Failed saving name to server:', errorData);
        }
      } catch (error) {
        console.warn('[ChatBot] Error saving name to server:', error);
      }
    } else {
      onUpdateUser?.({ name: safeName });
    }

    setShowNameSetupModal(false);
  };

  const skipNameSetup = () => {
    saveUserName('Teman');
  };

  // Generate greeting when chat is empty or conversation changes
  useEffect(() => {
    if (messages.length === 0) {
      setAiGreeting(null);
      setAiHint(null);
      greetingGenerationRef.current = false;
      generateAIWelcomeText();
    }
  }, [currentConversationId, userName, messages.length]);

  const getSourceLogo = (source) => {
    const iconValue = source?.sourceIcon || source?.icon || '';
    if (iconValue && /^(https?:\/\/|\/).+\.(png|jpe?g|svg|webp)$/i.test(iconValue)) {
      return {
        type: 'image',
        value: iconValue,
        label: source.source || source.title || 'source'
      };
    }

    if (iconValue) {
      return {
        type: 'text',
        value: iconValue
      };
    }

    const sourceName = source?.source || source?.title || 'Sumber';
    const initials = sourceName
      .split(/\s+/)
      .map((word) => word[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join('');

    return {
      type: 'text',
      value: initials || '🔎'
    };
  };
  const [expandedReasoningId, setExpandedReasoningId] = useState(null); // Track which message has expanded reasoning modal
  const [expandedUserMessageId, setExpandedUserMessageId] = useState(null); // Track which user message is expanded
  
  // Text queue management for pasted text
  const [textQueue, setTextQueue] = useState([]); // Queue of pasted text items: [{id, content, label: "salinan teks"}]
  const [selectedTextItem, setSelectedTextItem] = useState(null); // Currently selected text item for popup preview
  const [showTextPopup, setShowTextPopup] = useState(false); // Show/hide text popup for editing
  const [editingTextContent, setEditingTextContent] = useState(''); // Editable content in popup
  const [showDonationModal, setShowDonationModal] = useState(false); // Donation modal visibility
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false); // Delete confirmation modal
  const [deleteConfirmConvId, setDeleteConfirmConvId] = useState(null); // Which conversation to delete
  const [uploadedImages, setUploadedImages] = useState([]); // Queue of uploaded images for vision analysis
  const [activeImageFollowUps, setActiveImageFollowUps] = useState([]); // Active image context kept for follow-up prompts, hidden from queue UI
  const [imageUploadInput, setImageUploadInput] = useState(null); // Ref for hidden image input
  const [attachmentQueueMinimized, setAttachmentQueueMinimized] = useState(false); // Minimize/maximize attachment queue container

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
  const retryIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const streamingIntervalRef = useRef(null);
  const streamingStartTimeRef = useRef(null);
  const statusUpdateIntervalRef = useRef(null);
  const isPausedRef = useRef(false);
  const currentMessageIdRef = useRef(null);
  const currentTextRef = useRef('');
  const charIndexRef = useRef(0);
  const holdScrollRef = useRef(false);
  const programmaticScrollRef = useRef(false);
  const abortControllerRef = useRef(null);
  const abortControllersMapRef = useRef(new Map()); // Per-conversation abort controllers
  const partialMessageIdRef = useRef(null);
  const autoRetryTimeoutRef = useRef(null);
  const autoRetryCountRef = useRef(0);
  const backgroundAgentCountRef = useRef(0); // number of running background agent tasks
  const prevHasCodeRef = useRef(false);
  const manuallyNamedConversationsRef = useRef(new Set()); // Track which conversations have manual titles
  const MAX_AUTO_RETRY = 3;
  // Refs for message editing
  const lastSentPromptRef = useRef('');
  const lastSentUserMessageIdRef = useRef(null);
  const isProcessingRef = useRef(false); // MUTEX: Prevent concurrent image OR text responses - 1 prompt = 1 response only

  // Image modal for enlarged view and download
  const [enlargedImage, setEnlargedImage] = useState(null); // { url, alt } for lightbox
  const [showImageModal, setShowImageModal] = useState(false); // Show/hide image modal
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingMessageText, setEditingMessageText] = useState('');
  const editLongPressTimeoutRef = useRef(null);

  const openLogoutConfirm = () => setShowLogoutConfirm(true);
  const closeLogoutConfirm = () => setShowLogoutConfirm(false);

  // Modern alert system
  const showAlert = (message, type = 'info', duration = 4000) => {
    setCustomAlert({ message, type });
    if (duration > 0) {
      setTimeout(() => setCustomAlert(null), duration);
    }
  };

  // Helper function to finish streaming and calculate reasoning duration
  const finishStreaming = (messageId) => {
    setMessages((prev) =>
      prev.map((msg) => {
        if (msg.id === messageId && msg.isStreaming) {
          const duration = msg.reasoningStartTime 
            ? Math.round((Date.now() - msg.reasoningStartTime) / 1000) 
            : 0;
          
          // Extract download metadata if present
          let downloadUrl = null;
          let fileName = null;
          let downloadSummary = null;
          let cleanText = msg.text;
          
          const downloadMatch = msg.text?.match(/\[(?:FILE_DOWNLOAD_START|FILEDOWNLOADSTART):([^:]+):([^:]+):?([^\]]*)\]/);
          if (downloadMatch) {
            downloadUrl = downloadMatch[1];
            fileName = downloadMatch[2];
            // Decode summary if provided
            if (downloadMatch[3]) {
              try {
                downloadSummary = decodeURIComponent(downloadMatch[3]);
              } catch (e) {
                downloadSummary = downloadMatch[3];
              }
            }
            // Remove download metadata markers from display text
            cleanText = msg.text
              .replace(/\[(?:FILE_DOWNLOAD_START|FILEDOWNLOADSTART):[^\]]*\]\n*/g, '') // Remove metadata with optional newlines
              .replace(/\[(?:FILE_DOWNLOAD_END|FILEDOWNLOADEND)\]\n*/g, ''); // Remove end marker
            cleanText = removeDownloadStatusLines(cleanText);
          }
          
          return { 
            ...msg,
            text: cleanText,
            isStreaming: false,
            reasoningDuration: duration,
            downloadUrl,
            fileName,
            downloadSummary
          };
        }
        return msg;
      })
    );
    
  };

  const isReasoningChunk = (accumulatedText, chunk) => {
    if (!chunk || typeof chunk !== 'string') return false;
    const reasoningTag = /<\/?reasoning>/i;
    const openTags = (accumulatedText.match(/<reasoning>/gi) || []).length;
    const closeTags = (accumulatedText.match(/<\/reasoning>/gi) || []).length;
    const currentlyInReasoning = openTags > closeTags;
    return currentlyInReasoning || reasoningTag.test(chunk);
  };

  /**
   * Parse execution flow steps from server response chunks
   * Detects patterns like:
   * - [STEP 1/3] Generating Python code...
   * - 📖 [AGENT] Reading skill file...
   * - ✅ [AGENT] Skill file loaded (16246 chars, 533 lines)
   * - [STEP 2/3] Executing code in sandbox...
   * etc.
   */
  const parseExecutionStep = (text) => {
    const lines = text.split('\n');
    const steps = [];
    let currentTime = Date.now();

    for (const line of lines) {
      // Match step patterns
      if (line.includes('[STEP')) {
        // Pattern: [STEP X/Y] Description
        const match = line.match(/\[STEP (\d+)\/(\d+)\]\s*(.*?)(?:\s*\.\.\.)?$/);
        if (match) {
          steps.push({
            emoji: '⚙️',
            name: match[3] || 'Processing',
            message: line.trim(),
            status: 'active',
            duration: 0
          });
        }
      } else if (line.includes('📖 [AGENT]') && line.includes('Reading')) {
        // Reading skill file
        steps.push({
          emoji: '📖',
          name: 'Reading Skill File',
          message: line.trim().replace(/📖 \[AGENT\]\s*/, ''),
          status: 'active',
          duration: 0
        });
      } else if (line.includes('✅ [AGENT]') && line.includes('Skill file loaded')) {
        // Mark previous reading step as complete
        if (steps.length > 0) {
          steps[steps.length - 1].status = 'complete';
          // Extract duration from message if available
          const durationMatch = line.match(/\((\d+)\s*chars/);
          if (durationMatch) {
            steps[steps.length - 1].detail = `${durationMatch[1]} chars loaded`;
          }
        }
      } else if (line.includes('✅ [STEP')) {
        // Step complete
        const match = line.match(/✅ \[STEP (\d+)\/(\d+)\]\s*(.*?)\s*\((\d+)ms\)/);
        if (match && steps.length > 0) {
          steps[steps.length - 1].status = 'complete';
          steps[steps.length - 1].duration = parseInt(match[4]) || 0;
        }
      } else if (line.includes('❌') || line.includes('Error')) {
        // Error step
        if (steps.length > 0) {
          steps[steps.length - 1].status = 'error';
        }
      }
    }

    return steps.filter(s => s.name && s.name.trim());
  };

  // Handle paste events - intercept text paste and add to queue instead of input
  const handlePaste = (e) => {
    const pastedText = e.clipboardData.getData('text');
    
    // If there's actual pasted text, add to text queue and prevent default paste
    if (pastedText && pastedText.trim()) {
      e.preventDefault();
      
      // Add to text queue
      const newTextItem = {
        id: Date.now(),
        content: pastedText,
        label: userLanguage === 'id' ? 'salinan teks' : 'text copy',
      };
      
      setTextQueue((prev) => [...prev, newTextItem]);
      
      // Show brief feedback
      showAlert(
        userLanguage === 'id' 
          ? '📋 Teks ditambahkan ke antrian' 
          : '📋 Text added to queue',
        'info',
        2000
      );
    }
  };

  // Open text popup for preview/edit
  const handleTextQueueItemClick = (item) => {
    setSelectedTextItem(item);
    setEditingTextContent(item.content);
    setShowTextPopup(true);
  };

  // Save edited text content
  const handleSaveTextEdit = () => {
    if (!selectedTextItem) return;
    
    // Update text in queue
    setTextQueue((prev) =>
      prev.map((item) =>
        item.id === selectedTextItem.id
          ? { ...item, content: editingTextContent }
          : item
      )
    );
    
    // Close popup
    setShowTextPopup(false);
    setSelectedTextItem(null);
    setEditingTextContent('');
    
    showAlert(
      userLanguage === 'id' 
        ? '✅ Teks diperbarui' 
        : '✅ Text updated',
      'success',
      2000
    );
  };

  // Remove text item from queue
  const handleRemoveTextItem = (itemId) => {
    setTextQueue((prev) => prev.filter((item) => item.id !== itemId));
    
    // Close popup if this item is being edited
    if (selectedTextItem?.id === itemId) {
      setShowTextPopup(false);
      setSelectedTextItem(null);
      setEditingTextContent('');
    }
    
    showAlert(
      userLanguage === 'id' 
        ? '🗑️ Teks dihapus dari antrian' 
        : '🗑️ Text removed from queue',
      'info',
      2000
    );
  };

  // Image modal handlers
  const handleImageClick = (imageUrl, alt = 'Generated Image', imageId = null) => {
    setEnlargedImage({ url: imageUrl, alt, imageId });
    setShowImageModal(true);
    console.log('[IMAGE] Opened image modal for:', imageUrl, 'ID:', imageId);
  };

  const closeImageModal = () => {
    setShowImageModal(false);
    setEnlargedImage(null);
  };

  const handleDownloadImage = async () => {
    if (!enlargedImage?.url) {
      console.error('[IMAGE] No image URL available');
      return;
    }

    try {
      console.log('[IMAGE] Starting download for:', enlargedImage.url, 'ID:', enlargedImage.imageId, 'Auth:', isAuthenticated);
      
      let downloadBlob = null;
      let downloadSource = 'direct-fetch';
      
      // If we have imageId and are authenticated, use backend proxy to avoid CORS
      if (enlargedImage.imageId && isAuthenticated) {
        console.log('[IMAGE] Using backend proxy for download with imageId:', enlargedImage.imageId);
        downloadSource = 'backend-proxy';
        
        const proxyResponse = await fetch(`/api/images/download/${enlargedImage.imageId}`, {
          credentials: 'include'
        });
        if (!proxyResponse.ok) {
          console.error('[IMAGE] Backend proxy failed:', proxyResponse.status, proxyResponse.statusText);
          throw new Error(`Backend proxy failed: ${proxyResponse.status}`);
        }
        downloadBlob = await proxyResponse.blob();
        console.log('[IMAGE] Backend proxy returned blob, size:', downloadBlob.size);
      } else {
        // Fallback: direct fetch (may fail due to CORS)
        console.log('[IMAGE] Using direct fetch... imageId:', enlargedImage.imageId, 'isAuth:', isAuthenticated);
        const response = await fetch(enlargedImage.url);
        if (!response.ok) {
          console.error('[IMAGE] Direct fetch failed:', response.status, response.statusText);
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        downloadBlob = await response.blob();
        console.log('[IMAGE] Direct fetch returned blob, size:', downloadBlob.size);
      }

      if (!downloadBlob || downloadBlob.size === 0) {
        throw new Error('Empty blob received from ' + downloadSource);
      }

      // Create object URL and download
      const objectUrl = URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = objectUrl;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().slice(0, 10);
      link.download = `orion-image-${timestamp}-${Date.now()}.png`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
      
      console.log('[IMAGE] ✅ Image downloaded via', downloadSource, ':', link.download);
      showAlert(
        userLanguage === 'id' 
          ? '✅ Gambar diunduh' 
          : '✅ Image downloaded',
        'success',
        2000
      );
    } catch (error) {
      console.error('[IMAGE] Download error:', error, 'enlargedImage:', enlargedImage);
      showAlert(
        userLanguage === 'id'
          ? '❌ Gagal mengunduh gambar: ' + error.message
          : '❌ Failed to download image: ' + error.message,
        'error',
        3000
      );
    }
  };



  // Check if last message has code (not just any message)
  const hasCodeMessage = messages.length > 0 && 
    messages[messages.length - 1].sender === 'bot' && 
    messages[messages.length - 1].text && 
    messages[messages.length - 1].text.includes('```');

  useEffect(() => {
    if (hasCodeMessage && !prevHasCodeRef.current) {
      setShowCodePanelPulse(true);
    }
    prevHasCodeRef.current = hasCodeMessage;
    if (!hasCodeMessage) {
      setShowCodePanelPulse(false);
    }
  }, [hasCodeMessage]);

  // Initialize RAG knowledge base on mount
  useEffect(() => {
    const initializeRag = async () => {
      try {
        const success = await ragService.ingestKnowledgeBase('/data/datasets/orion_dataset.json');
        if (success) {
          console.log('✅ RAG Knowledge Base Ready');
        }
      } catch (e) {
        console.debug('RAG initialization optional:', e?.message);
      }
    };
    initializeRag();
  }, []);

  const confirmLogout = async () => {
    setLogoutLoading(true);
    try {
      if (isAuthenticated && !isGuest) {
        // Persist current conversations before destroying the session,
        // so token usage and chat history remain accurate after re-login.
        await ConversationPersistenceService.saveConversations(conversations, true, false);
      }
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setLogoutLoading(false);
      setShowLogoutConfirm(false);
      resetLocalStorageData();
      onLogout?.();
    }
  };

  const resetLocalStorageData = () => {
    const keysToClear = [
      'chatbot_conversations',
      'orion_memory_system',
      'orion_message_feedback',
      'orion_chat_branches',
      'authUser',
      'guestSession',
      'chatbot_last_conversation',
    ];
    keysToClear.forEach((key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.error(`Failed to remove ${key}:`, e);
      }
    });
    console.log('[ChatBot] LocalStorage cleared for logout');
  };

  const getLatestConversation = (loaded) => {
    if (!Array.isArray(loaded) || loaded.length === 0) return null;
    return loaded.reduce((latest, conv) => {
      if (!conv || !conv.id) return latest;
      if (!latest) return conv;
      const latestTime = new Date(latest.updatedAt || latest.createdAt || 0).getTime();
      const convTime = new Date(conv.updatedAt || conv.createdAt || 0).getTime();
      return convTime >= latestTime ? conv : latest;
    }, null);
  };

  const rememberConversationId = (convId) => {
    try {
      localStorage.setItem('chatbot_last_conversation', convId);
    } catch (e) {
      console.warn('Unable to save last conversation id:', e);
    }
  };

  // Load conversations on mount
  useEffect(() => {
    const loadConversations = async () => {
      try {
        console.log(`[ChatBot] Loading conversations. Auth: isAuth=${isAuthenticated}, isGuest=${isGuest}`);
        const loaded = await ConversationPersistenceService.loadConversations(isAuthenticated, isGuest);
        
        if (loaded && Array.isArray(loaded) && loaded.length > 0) {
          console.log(`[ChatBot] ✅ Loaded ${loaded.length} conversations`);

          const lastConvId = localStorage.getItem('chatbot_last_conversation');
          const lastConv = loaded.find((conv) => conv.id === lastConvId);
          const targetConv = lastConv || getLatestConversation(loaded) || loaded[0];

          // Log messages with generated images
          const messagesWithGenImages = targetConv.messages?.filter(m => m.imageUrl) || [];
          console.log(`[ChatBot] Found ${messagesWithGenImages.length} messages with generated images`);
          
          // Log messages with uploaded images (user attachments)
          const messagesWithUploadedImages = targetConv.messages?.filter(m => m.images?.length > 0) || [];
          const totalUploadedImages = messagesWithUploadedImages.reduce((sum, m) => sum + m.images.length, 0);
          console.log(`[ChatBot] Found ${messagesWithUploadedImages.length} messages with ${totalUploadedImages} uploaded images`);
          messagesWithUploadedImages.forEach((msg, idx) => {
            console.log(`  [${idx}] Message ${msg.id}: ${msg.images.length} images (${msg.sender})`);
            msg.images.forEach((img, imgIdx) => {
              console.log(`    - Image ${imgIdx}: ${img.fileName}`);
            });
          });

          console.log(`[ChatBot] Setting conversation: ID=${targetConv.id}, Messages: ${targetConv.messages?.length || 0}`);
          
          setConversations(loaded);
          setCurrentConversationId(targetConv.id);
          setMessages(targetConv.messages);
          rememberConversationId(targetConv.id);
          setTimeout(() => scrollToBottom(true), 150);
          setTimeout(() => scrollToBottom(true), 350);
          return;
        }
        
        createNewConversation();
      } catch (err) {
        console.error('Error loading conversations:', err);
        createNewConversation();
      }
    };

    loadConversations();
  }, [isAuthenticated, isGuest]);


  // Save conversations whenever they change (to localStorage or backend)
  useEffect(() => {
    const saveConversations = async () => {
      if (conversations.length > 0) {
        try {
          console.log(`[ChatBot] Auto-saving ${conversations.length} conversations. Auth: isAuth=${isAuthenticated}, isGuest=${isGuest}`);
          const result = await ConversationPersistenceService.saveConversations(conversations, isAuthenticated, isGuest);
          console.log(`[ChatBot] Save result:`, result);
        } catch (err) {
          console.error('Error auto-saving conversations:', err);
        }
      }
    };

    // Debounce saves to avoid too many requests (reduced to 500ms for faster save)
    const saveTimer = setTimeout(() => {
      saveConversations();
    }, 500);

    return () => clearTimeout(saveTimer);
  }, [conversations, isAuthenticated, isGuest]);

  // Keep the active conversation object in sync with the current messages state
  useEffect(() => {
    if (!currentConversationId) return;
    
    // Count images in current messages
    const imageCount = messages.reduce((sum, msg) => sum + (msg.images?.length || 0), 0);
    console.log(`[ChatBot] Syncing messages to conversation (${messages.length} messages, ${imageCount} images)`);
    
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === currentConversationId
          ? { ...conv, messages, updatedAt: new Date().toISOString() }
          : conv
      )
    );
  }, [messages, currentConversationId]);

  // Auto-scroll to bottom when conversation loads or messages change
  useEffect(() => {
    if (!currentConversationId || messages.length === 0) return;

    const scrollTimer = setTimeout(() => {
      scrollToBottom(true);
    }, 100);

    return () => clearTimeout(scrollTimer);
  }, [currentConversationId, messages.length]);

  // Preload external RAG index from public/rag_index.json when the app mounts
  useEffect(() => {
    const preloadRagIndex = async () => {
      try {
        await ragService.tryLoadRemoteIndex();
      } catch (err) {
        console.debug('RAG preload failed:', err);
      }
    };

    preloadRagIndex();
  }, []);

  // Detect user location and language
  useEffect(() => {
    const detectUserLocation = async () => {
      try {
        // Try to use IP geolocation API (free tier)
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        const country = data.country_code || 'ID';
        setUserCountry(country);
        
        // Determine language based on country
        const englishCountries = ['US', 'GB', 'AU', 'CA', 'NZ', 'IE', 'SG', 'MY'];
        const detectedLanguage = englishCountries.includes(country) ? 'en' : 'id';
        setUserLanguage(detectedLanguage);
        
        // Also try browser language as fallback
        const browserLang = navigator.language || navigator.userLanguage;
        if (browserLang.startsWith('en')) {
          setUserLanguage('en');
        } else if (browserLang.startsWith('id')) {
          setUserLanguage('id');
        }
      } catch (error) {
        console.log('Location detection skipped:', error);
        // Default to Indonesian if detection fails
        setUserLanguage('id');
      }
    };

    detectUserLocation();
  }, []);

  // Detect scroll position untuk show/hide scroll to bottom button
  useEffect(() => {
    const messagesContainer = document.querySelector('.messages-container');
    
    if (!messagesContainer) return; // Early return jika container belum ready
    
    const handleScroll = () => {
      try {
        // If the scroll was triggered programmatically, don't treat it as a user interaction
        if (programmaticScrollRef.current) return;

        const isAtBottom = 
          messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight < 100;
        setIsScrolledUp(!isAtBottom);
        // Toggle compact view: when at bottom keep compact, when user scrolls up show full history
        setCompactView(isAtBottom);

        // If the user manually scrolls, allow auto-scrolls again and remove the prefill spacer
        if (holdScrollRef.current) {
          holdScrollRef.current = false;
        }
        try {
          messagesContainer.classList.remove('prefill-space');
        } catch (_e) {
          // ignore
        }
      } catch (_err) {
        console.log('Scroll handler error:', _err);
      }
    };

    const handleWheel = (_e) => {
      try {
        // If user scrolls up while in compact view, expand to full history
        if (compactView && _e.deltaY < 0) {
          setCompactView(false);
          // Don't force scroll position - let user stay where they scrolled to
        }
      } catch (_err) {
        // ignore
      }
    };

    messagesContainer.addEventListener('scroll', handleScroll);
    messagesContainer.addEventListener('wheel', handleWheel, { passive: true });
    
    // Triple-click to jump to bottom
    const handleTripleClick = () => {
      scrollToBottom(true);
    };
    messagesContainer.addEventListener('triple-click', handleTripleClick);
    
    // Custom triple-click detection using click events (more reliable than mousedown)
    let clickCount = 0;
    let clickTimer = null;
    const handleClick = (e) => {
      clickCount++;
      
      if (clickCount === 1) {
        // Start timer for triple-click window
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 300);
      }
      
      if (clickCount === 3) {
        e.preventDefault();
        clearTimeout(clickTimer);
        clickCount = 0;
        scrollToBottom(true);
      }
    };
    messagesContainer.addEventListener('click', handleClick);
    
    return () => {
      try {
        messagesContainer.removeEventListener('scroll', handleScroll);
        messagesContainer.removeEventListener('wheel', handleWheel);
        messagesContainer.removeEventListener('triple-click', handleTripleClick);
      } catch (_err) {
        console.log('Remove scroll listener error:', _err);
      }
    };
  }, []);



  // Helper: Set loading state for current conversation
  const setConvLoading = (isLoadingNow) => {
    if (!currentConversationId) return;
    setLoading(isLoadingNow); // Keep global loading for overall UI
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId 
          ? { ...c, isLoading: isLoadingNow }
          : c
      )
    );
  };

  // Helper: Get loading state for current conversation
  const getConvLoading = () => {
    const currentConv = conversations.find((c) => c.id === currentConversationId);
    return currentConv?.isLoading || false;
  };

  // Create new conversation
  const createNewConversation = () => {
    // Check if there's already an empty conversation
    const hasEmptyConversation = conversations.some(conv => conv.messages && conv.messages.length === 0);
    if (hasEmptyConversation) {
      alert(userLanguage === 'id' ? 'Selesaikan atau hapus chat kosong terlebih dahulu' : 'Please complete or delete the empty chat first');
      return;
    }

    const newId = Date.now().toString();
    const newConv = {
      id: newId,
      title: userLanguage === 'id' ? 'Obrolan AI' : 'AI Chat',
      messages: [],
      isLoading: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPrivate: false,
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newId);
    setMessages([]);
    setCompactView(true);
    setIsPrivateChat(false);
  };

  const startPrivateChat = () => {
    // Check if there's already an empty conversation
    const hasEmptyConversation = conversations.some(conv => conv.messages && conv.messages.length === 0);
    if (hasEmptyConversation) {
      alert(userLanguage === 'id' ? 'Selesaikan atau hapus chat kosong terlebih dahulu' : 'Please complete or delete the empty chat first');
      setShowPrivateModal(false);
      return;
    }

    setShowPrivateModal(false);
    const newId = `private_${Date.now()}`;
    const _newConv = {
      id: newId,
      title: '🔒 Private Chat',
      messages: [],
      isLoading: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPrivate: true,
    };
    // Add to state only, not to saved conversations
    setCurrentConversationId(newId);
    setMessages([]);
    setIsPrivateChat(true);
    setError(null);
    setCompactView(true);
  };

  // Switch conversation
  const switchConversation = (convId) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      // Count images being loaded
      const imageCount = conv.messages.reduce((sum, msg) => sum + (msg.images?.length || 0), 0);
      console.log(`[ChatBot] Switching to conversation "${conv.title}" (${conv.messages.length} messages, ${imageCount} images)`);
      
      setCurrentConversationId(convId);
      setMessages(conv.messages || []);
      setError(null);
      setCompactView(true);
      rememberConversationId(convId);
      
      // Auto-scroll to bottom when opening/switching to a room
      setTimeout(() => {
        scrollToBottom(true);
      }, 100);
    }
  };

  // Delete conversation
  const deleteConversation = async (convId) => {
    // Show confirmation dialog first
    setDeleteConfirmConvId(convId);
    setShowDeleteConfirm(true);
  };

  // Confirm and execute deletion
  const confirmDeleteConversation = async (convId) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

    // Show loading state
    setConversations((prev) =>
      prev.map((c) =>
        c.id === convId ? { ...c, isLoading: true } : c
      )
    );

    if (isAuthenticated && !isGuest) {
      try {
        const response = await fetch(`${apiBaseUrl}/api/conversations/${convId}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.warn('Failed to delete conversation from backend:', response.status);
          setCustomAlert({
            type: 'error',
            message: 'Failed to delete session. Please try again.'
          });
          // Reset loading state on failure
          setConversations((prev) =>
            prev.map((c) =>
              c.id === convId ? { ...c, isLoading: false } : c
            )
          );
          setShowDeleteConfirm(false);
          setDeleteConfirmConvId(null);
          return;
        }
      } catch (err) {
        console.error('Error deleting conversation from backend:', err);
        setCustomAlert({
          type: 'error',
          message: 'Error deleting session: ' + err.message
        });
        // Reset loading state on error
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId ? { ...c, isLoading: false } : c
          )
        );
        setShowDeleteConfirm(false);
        setDeleteConfirmConvId(null);
        return;
      }
    }

    // Remove from conversations list
    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);

    // Show success feedback
    setCustomAlert({
      type: 'success',
      message: 'Session deleted successfully'
    });

    // Switch to another conversation if current one was deleted
    if (currentConversationId === convId) {
      if (remaining.length > 0) {
        switchConversation(remaining[0].id);
      } else {
        createNewConversation();
      }
    }

    // Close confirmation modal
    setShowDeleteConfirm(false);
    setDeleteConfirmConvId(null);
  };

  // Handle file upload and parsing (supports DOCX, XLSX, CSV, JSON, TXT, MD, HTML, etc)
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split('.').pop().toLowerCase();
      // PDF not supported via backend - needs pdfjs-dist on client
      const binaryFormats = ['docx', 'xlsx', 'xls', 'pptx', 'ppt'];
      const isSupportedBinary = binaryFormats.includes(fileExt);
      const isPDF = fileExt === 'pdf';

      let content = '';
      const sizeKB = (file.size / 1024).toFixed(1);

      if (isPDF) {
        // PDFs cannot be parsed yet, show info message
        alert(
          userLanguage === 'id' 
            ? '⚠️ File PDF tidak dapat dibaca sekarang.\n\nUntuk PDF, coba:\n• Copy-paste teks dari PDF\n• Gunakan PDF converter online\n• Atau upload file lain (DOCX, XLSX, CSV, JSON, TXT, MD, HTML)'
            : '⚠️ PDF files cannot be read at this moment.\n\nFor PDF, try:\n• Copy-paste text from PDF\n• Use online PDF converter\n• Or upload other formats (DOCX, XLSX, CSV, JSON, TXT, MD, HTML)'
        );
        return;
      }

      if (isSupportedBinary) {
        // Send to backend for parsing
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('http://localhost:3001/api/upload-file', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          alert(`❌ Parse error: ${error.error || 'Unknown error'}`);
          return;
        }

        const result = await response.json();
        if (!result.success) {
          alert(`❌ Parse error: ${result.error}`);
          return;
        }

        content = result.content;
      } else {
        // Use FileReader API for text-based files
        try {
          content = await file.text();
        } catch (_readErr) {
          alert('❌ Cannot read file');
          return;
        }

        // Try JSON format if possible
        if (content.trim().startsWith('{') || content.trim().startsWith('[')) {
          try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
          } catch (_e) {
            // Keep original content if not valid JSON
          }
        }
      }

      // Validate content
      if (!content || content.length === 0) {
        alert(userLanguage === 'id' ? 'File kosong' : 'File is empty');
        return;
      }

      // Limit size
      if (content.length > 3000000) {
        alert(userLanguage === 'id' ? 'File terlalu besar (max 3MB text)' : 'File too large (max 3MB text)');
        return;
      }

      // Store in memory
      memoryService.addMemory(
        {
          content: content,
          type: 'file_content',
          weight: 2
        },
        currentConversationId,
        userLanguage
      );

      const tokenEstimate = Math.ceil(content.length / 4);
      
      // Add to uploaded files list
      const newFile = {
        id: `file_${Date.now()}`,
        name: file.name,
        size: sizeKB,
        tokens: tokenEstimate,
        content: content
      };
      
      setUploadedFiles(prev => [...prev, newFile]);
      
      // Show success alert
      alert(userLanguage === 'id' 
        ? `✅ "${file.name}" dibaca!\n${sizeKB}KB | ~${tokenEstimate} tokens`
        : `✅ "${file.name}" read!\n${sizeKB}KB | ~${tokenEstimate} tokens`);
    } catch (error) {
      console.error('Upload error:', error);
      alert(`❌ Error: ${error?.message || 'Failed'}`);
    } finally {
      if (window.fileUploadInput) {
        window.fileUploadInput.value = '';
      }
    }
  };

  // Remove file from uploaded list
  const removeUploadedFile = (fileId) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  // Clear all uploaded files and images
  const clearAllAttachments = () => {
    setUploadedFiles([]);
    setUploadedImages([]);
  };

  const uploadImageToServer = async (file) => {
    const formData = new FormData();
    formData.append('image', file);
    const uploadUrl = `${apiBaseUrl}/api/vision/upload`;
    console.log('[ChatBot] Upload image to server:', uploadUrl, file.name, file.type, file.size);

    const response = await fetch(uploadUrl, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('[ChatBot] Image upload response error:', response.status, errorData);
      throw new Error(errorData?.error || `Upload failed: ${response.status}`);
    }

    return response.json();
  };

  // Handle image upload from file input
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Validate image type
      const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
      if (!validImageTypes.includes(file.type)) {
        alert(userLanguage === 'id' 
          ? '❌ Format gambar tidak didukung. Gunakan: JPG, PNG, WebP, GIF'
          : '❌ Image format not supported. Use: JPG, PNG, WebP, GIF');
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        alert(userLanguage === 'id' 
          ? '❌ Gambar terlalu besar (max 10MB)'
          : '❌ Image too large (max 10MB)');
        return;
      }

      const imageId = `img_${Date.now()}`;
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const base64Data = evt.target.result;

        const newImage = {
          id: imageId,
          fileName: file.name,
          dataUrl: base64Data,
          publicUrl: null,
          status: 'uploading', // uploading, queued, analyzing, analyzed
          analysis: null,
          error: null,
          followUpRemaining: 20,
        };

        setUploadedImages(prev => [...prev, newImage]);
        setAttachmentQueueMinimized(false);

        try {
          const uploadResult = await uploadImageToServer(file);
          setUploadedImages(prev => prev.map(img => 
            img.id === imageId
              ? { ...img, publicUrl: uploadResult.url, status: 'queued' }
              : img
          ));
        } catch (uploadError) {
          console.error('[ChatBot] Image server upload failed:', uploadError);
          setUploadedImages(prev => prev.map(img => 
            img.id === imageId
              ? { ...img, status: 'error', error: uploadError.message }
              : img
          ));
          setCustomAlert({
            type: 'error',
            message: userLanguage === 'id' 
              ? `❌ Gagal upload gambar "${file.name}": ${uploadError.message}`
              : `❌ Failed to upload "${file.name}": ${uploadError.message}`,
            duration: 5000
          });
          return;
        }

        setCustomAlert({
          type: 'success',
          message: userLanguage === 'id' 
            ? `📸 Gambar "${file.name}" siap dianalisis`
            : `📸 Image "${file.name}" ready for analysis`,
          duration: 2000
        });
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[ChatBot] Image upload error:', error);
      setCustomAlert({
        type: 'error',
        message: userLanguage === 'id' ? '❌ Error upload gambar' : '❌ Image upload error',
        duration: 3000
      });
    } finally {
      if (imageUploadInput) {
        imageUploadInput.value = '';
      }
    }
  };

  // Remove uploaded image
  const removeUploadedImage = (imageId) => {
    setUploadedImages(prev => prev.filter(img => img.id !== imageId));
  };

  // Analyze uploaded images before sending message - returns map of imageId -> analysis
  const analyzeUploadedImages = async () => {
    const pendingImages = uploadedImages.filter(img => img.status === 'queued');
    const analysisMap = {}; // Store results to return immediately, not wait for state
    
    for (const image of pendingImages) {
      try {
        // Update status to analyzing
        setUploadedImages(prev => prev.map(img => 
          img.id === image.id ? { ...img, status: 'analyzing' } : img
        ));

        console.log('[ChatBot] Analyzing image with Qwen3-VL:', image.fileName);
        
        // Use base64 data directly - no public URL needed
        const imageDataForAnalysis = image.dataUrl;

        // Build context from recent conversation history
        const recentMessages = Object.values(messages).slice(-5);
        const contextLines = recentMessages.map(m => {
          const sender = m.user === 'user' ? 'User' : 'AI';
          const text = typeof m.text === 'string' ? m.text.substring(0, 100) : '';
          return `${sender}: ${text}`;
        });
        const contextStr = contextLines.length > 0 ? contextLines.join('\n') : 'No context';
        
        // Build question with context
        const contextQuestion = `Konteks percakapan:\n${contextStr}\n\nLihat gambar ini dan jelaskan apa yang ada dengan mempertimbangkan konteks di atas.`;

        // Call vision analysis service
        const result = await VisionAnalysisService.analyzeImage(
          imageDataForAnalysis,
          contextQuestion
        );

        // Store result in map and update UI state
        analysisMap[image.id] = result.analysis;

        // Update with analysis result
        setUploadedImages(prev => prev.map(img => 
          img.id === image.id 
            ? { 
                ...img, 
                status: 'analyzed',
                analysis: result.analysis
              } 
            : img
        ));

        console.log('[ChatBot] Image analysis complete:', image.id, 'Analysis:', result.analysis.substring(0, 100));
      } catch (error) {
        console.error('[ChatBot] Image analysis error:', error);
        
        // Mark as errored
        setUploadedImages(prev => prev.map(img => 
          img.id === image.id 
            ? { 
                ...img, 
                status: 'error',
                error: error.message
              } 
            : img
        ));

        setCustomAlert({
          type: 'error',
          message: userLanguage === 'id' 
            ? `❌ Gagal analisis "${image.fileName}"`
            : `❌ Failed to analyze "${image.fileName}"`,
          duration: 3000
        });
      }
    }
    return analysisMap; // Return map of imageId -> analysis results
  };

  // Save/load uploaded images from localStorage
  useEffect(() => {
    if (!currentConversationId) return;
    
    // Save to localStorage
    const storageKey = `deepernova_images_${currentConversationId}`;
    if (uploadedImages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(uploadedImages));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [uploadedImages, currentConversationId]);

  useEffect(() => {
    if (!currentConversationId) return;

    const activeKey = `deepernova_active_images_${currentConversationId}`;
    if (activeImageFollowUps.length > 0) {
      localStorage.setItem(activeKey, JSON.stringify(activeImageFollowUps));
    } else {
      localStorage.removeItem(activeKey);
    }
  }, [activeImageFollowUps, currentConversationId]);

  // Load uploaded images from localStorage when conversation changes
  useEffect(() => {
    if (!currentConversationId) return;
    
    const storageKey = `deepernova_images_${currentConversationId}`;
    const savedImages = localStorage.getItem(storageKey);
    if (savedImages) {
      try {
        const parsedImages = JSON.parse(savedImages);
        setUploadedImages(parsedImages);
      } catch (error) {
        console.error('[ChatBot] Error loading saved images:', error);
      }
    } else {
      setUploadedImages([]);
    }

    const activeKey = `deepernova_active_images_${currentConversationId}`;
    const savedActive = localStorage.getItem(activeKey);
    if (savedActive) {
      try {
        const parsedActive = JSON.parse(savedActive);
        setActiveImageFollowUps(Array.isArray(parsedActive) ? parsedActive : []);
      } catch (error) {
        console.error('[ChatBot] Error loading active image follow-ups:', error);
        setActiveImageFollowUps([]);
      }
    } else {
      setActiveImageFollowUps([]);
    }
  }, [currentConversationId]);

  useEffect(() => {
    if (uploadedFiles.length + uploadedImages.length > 0) {
      setAttachmentQueueMinimized(false);
    }
  }, [uploadedFiles.length, uploadedImages.length, currentConversationId]);

  // Handle customAlert auto-dismiss with fade-out animation
  const [dismissingAlert, setDismissingAlert] = useState(false);
  const alertTimeoutRef = useRef(null);

  // Helper to show error banner only when there are no background agent tasks running
  const showErrorBanner = (msg) => {
    if (backgroundAgentCountRef.current > 0 || isProcessingRef.current) {
      console.log('[ChatBot] Suppressed error banner because backend still processing:', msg);
      return;
    }
    setError(msg);
  };

  useEffect(() => {
    if (!customAlert || customAlert.duration === 0) return;

    // Clear any existing timeout
    if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);

    // Trigger fade-out after duration - allow 400ms for animation
    const dismissDelay = Math.max(customAlert.duration - 400, 0);
    alertTimeoutRef.current = setTimeout(() => {
      setDismissingAlert(true);
      // Clear after animation completes
      setTimeout(() => {
        setCustomAlert(null);
        setDismissingAlert(false);
      }, 400);
    }, dismissDelay);

    return () => {
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current);
    };
  }, [customAlert]);

  const openHtmlEditor = (text) => {
    // Try to extract code blocks first (fenced code)
    const codeMatch = text.match(/```[\s\S]*?```/);
    if (codeMatch) {
      const codeContent = codeMatch[0]
        .replace(/^```\w*\n?/, '') // Remove opening fence and language
        .replace(/```$/, '');       // Remove closing fence
      setHtmlContent(codeContent);
      setHtmlFilename(`code-${Date.now()}.txt`);
      setShowHtmlEditor(true);
      return;
    }
    
    // Try to extract HTML from message
    const htmlMatch = text.match(/<html[^>]*>[\s\S]*<\/html>/i) || 
                     text.match(/<body[^>]*>[\s\S]*<\/body>/i) ||
                     text.match(/<div[^>]*>[\s\S]*<\/div>/i) ||
                     text.match(/<!DOCTYPE[^>]*>[\s\S]*<\/html>/i);
    
    if (htmlMatch) {
      setHtmlContent(htmlMatch[0]);
      setHtmlFilename(`page-${Date.now()}.html`);
      setShowHtmlEditor(true);
    } else {
      alert(userLanguage === 'id' 
        ? '❌ Tidak ada code/HTML ditemukan dalam pesan ini' 
        : '❌ No code/HTML found in this message');
    }
  };

  // Download code/HTML file
  const _downloadHtmlFile = () => {
    if (!htmlContent.trim()) {
      alert(userLanguage === 'id' ? 'Code kosong' : 'Code is empty');
      return;
    }

    try {
      // Determine MIME type based on filename or content
      let mimeType = 'text/plain';
      if (htmlFilename.endsWith('.html') || htmlFilename.endsWith('.htm')) {
        mimeType = 'text/html';
      } else if (htmlFilename.endsWith('.js')) {
        mimeType = 'application/javascript';
      } else if (htmlFilename.endsWith('.json')) {
        mimeType = 'application/json';
      } else if (htmlFilename.endsWith('.css')) {
        mimeType = 'text/css';
      }
      
      const blob = new Blob([htmlContent], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = htmlFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      alert(userLanguage === 'id' 
        ? `✅ File diunduh: ${htmlFilename}` 
        : `✅ File downloaded: ${htmlFilename}`);
      setShowHtmlEditor(false);
    } catch (error) {
      alert(`❌ ${error.message}`);
    }
  };

  // Update conversation title based on first message (only if not manually named)
  const _updateConversationTitle = (convId, newMessages) => {
    // Skip if conversation was already manually named
    if (manuallyNamedConversationsRef.current.has(convId)) {
      return;
    }
    
    if (newMessages.length > 0 && newMessages[0].sender === 'user') {
      const firstUserMsg = newMessages[0].text;
      const title = firstUserMsg.split('\n')[0].substring(0, 50);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, title: title || 'Chat', updatedAt: new Date().toISOString() }
            : c
        )
      );
    }
  };

  // Generate chat title using AI for all users
  const generateChatTitle = async (convId) => {
    // Skip if this conversation already has a manually-set title
    if (manuallyNamedConversationsRef.current.has(convId)) {
      console.log(`[ChatBot] Skipping title generation for ${convId} - already manually named`);
      return;
    }

    const convMessages = conversations.find((c) => c.id === convId)?.messages || [];
    if (convMessages.length < 2) return; // Need at least user msg + bot response

    try {
      // Build conversation context (last 3 exchanges for a better title)
      const contextMessages = convMessages.slice(-6).map((m) => {
        const prefix = m.sender === 'user' ? 'User' : 'AI';
        return `${prefix}: ${m.text.substring(0, 80)}`;
      }).join('\n');

      const titlePrompt = userLanguage === 'en'
        ? `Generate a SHORT (2-4 words max) memorable chat title in English for this conversation:\n\n${contextMessages}\n\nRespond ONLY with the title, nothing else. No quotes, no explanation.`
        : `Generate a SHORT (2-4 words max) memorable chat title in Indonesian for this conversation:\n\n${contextMessages}\n\nRespond ONLY with the title, nothing else. No quotes, no explanation.`;

      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const response = await fetch(`${apiBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          model: 'deepseek-v4-pro',
          messages: [{ role: 'user', content: titlePrompt }],
          temperature: 0.5,
          max_tokens: 20,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let generatedTitle = data.choices?.[0]?.message?.content?.trim() || '';
        if (!generatedTitle) {
          const userMsg = convMessages.find((m) => m.sender === 'user');
          generatedTitle = userMsg ? userMsg.text.split('\n')[0].substring(0, 50).trim() : 'Chat';
        }

        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, title: generatedTitle, updatedAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        const userMsg = convMessages.find((m) => m.sender === 'user');
        const fallbackTitle = userMsg ? userMsg.text.split('\n')[0].substring(0, 50).trim() : 'Chat';
        setConversations((prev) =>
          prev.map((c) =>
            c.id === convId
              ? { ...c, title: fallbackTitle, updatedAt: new Date().toISOString() }
              : c
          )
        );
      }
    } catch (error) {
      console.error('Failed to generate chat title:', error);
      const userMsg = convMessages.find((m) => m.sender === 'user');
      const fallbackTitle = userMsg ? userMsg.text.split('\n')[0].substring(0, 50).trim() : 'Chat';
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, title: fallbackTitle, updatedAt: new Date().toISOString() }
            : c
        )
      );
    }

  };

  // Check if message is long (>10 chars AND >1 line)
  const _isLongMessage = (text) => {
    if (!text) return false;
    return text.length > 10 && text.split('\n').length > 1;
  };

  // Toggle message expand/collapse
  const _toggleExpandMessage = (messageId) => {
    setExpandedMessages((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  // Create a placeholder bot message immediately so the response feels faster
  const createBotPlaceholder = () => {
    const placeholderId = Date.now() + Math.floor(Math.random() * 1000);
    const placeholderMessage = {
      id: placeholderId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true,
      isPlaceholder: true,
      reasoningStartTime: Date.now(), // Track when reasoning starts
    };
    setMessages((prev) => [...prev, placeholderMessage]);
    setAnimatingMessages((prev) => ({ ...prev, [placeholderId]: true }));
    setIsScrolledUp(false);
    return placeholderId;
  };

  // Add AI message dengan animasi streaming
  const _addStreamingMessage = (text, existingMessageId = null) => {
    const messageId = existingMessageId || Date.now() + 1;
    const emptyMessage = {
      id: messageId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true,
      reasoningStartTime: Date.now(), // Track when reasoning starts
    };

    if (!existingMessageId) {
      setMessages((prev) => [...prev, emptyMessage]);
    } else {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId ? { ...msg, ...emptyMessage } : msg
        )
      );
    }

    setAnimatingMessages((prev) => ({ ...prev, [messageId]: true }));
    setIsScrolledUp(false); // Hide scroll button
    
    // Don't scroll saat AI mulai menjawab - biarkan user scroll manual
    // Scroll hanya terjadi di finishStreaming setelah text selesai
    
    // Store references untuk stop
    currentMessageIdRef.current = messageId;
    currentTextRef.current = text;
    charIndexRef.current = 0;
    isPausedRef.current = false;
    setIsPaused(false);

    // Function untuk update text secara increment - multiple chars per tick
    const updateStreamingText = () => {
      if (charIndexRef.current <= text.length) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === messageId
              ? { ...msg, text: text.substring(0, charIndexRef.current) }
              : msg
          )
        );
        charIndexRef.current += 25; // Show 25 chars per interval - balanced speed & visibility
      } else {
        // Selesai streaming
        finishStreaming(messageId);
      }
    };

    const interval = setInterval(updateStreamingText, 1);
    streamingIntervalRef.current = interval;
  };

  // Handle long-press on message to show edit button (user messages only)
  const handleMessageLongPress = (messageId, messageText, isSenderUser) => {
    if (!isSenderUser) return; // Only allow editing user messages
    
    setEditingMessageId(messageId);
    setEditingMessageText(messageText);
  };

  // Clear long-press timeout on mouse up
  const handleMessageMouseUp = () => {
    if (editLongPressTimeoutRef.current) {
      clearTimeout(editLongPressTimeoutRef.current);
      editLongPressTimeoutRef.current = null;
    }
  };

  // Start long-press timer on mouse down
  const handleMessageMouseDown = (messageId, messageText, isSenderUser) => {
    if (!isSenderUser) return;
    
    editLongPressTimeoutRef.current = setTimeout(() => {
      handleMessageLongPress(messageId, messageText, isSenderUser);
    }, 500); // 500ms for long press
  };

  // Handle edit and resend
  const handleEditAndResend = async () => {
    if (!editingMessageId || !editingMessageText.trim()) {
      setEditingMessageId(null);
      setEditingMessageText('');
      return;
    }

    // Find the index of the edited message
    const editIndex = messages.findIndex(m => m.id === editingMessageId);
    if (editIndex === -1) {
      setEditingMessageId(null);
      setEditingMessageText('');
      return;
    }

    // Truncate messages to BEFORE the edited one (delete original + all after)
    const truncatedMessages = messages.slice(0, editIndex);
    
    // Update messages state - remove old message and its AI response
    setMessages(truncatedMessages);
    
    // Clear edit state
    setEditingMessageId(null);
    setEditingMessageText('');
    
    // Immediately send the edited message as new message
    const newUserMessage = {
      id: Date.now(),
      text: editingMessageText,
      sender: 'user',
      timestamp: new Date(),
    };
    
    // Add to messages
    setMessages((_prev) => [...truncatedMessages, newUserMessage]);
    setCompactView(true);
    
    // Store for stop-restore
    lastSentPromptRef.current = editingMessageText;
    lastSentUserMessageIdRef.current = newUserMessage.id;
    
    // Create AI placeholder
    const placeholderId = Date.now() + Math.floor(Math.random() * 1000);
    const botMessage = {
      id: placeholderId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true,
      reasoningStartTime: Date.now(), // Track when reasoning starts
    };
    
    setMessages((prev) => [...prev, botMessage]);
    currentMessageIdRef.current = placeholderId;
    
    // Start streaming
    streamingStartTimeRef.current = Date.now();
    
    // Trigger immediate save (don't wait for debounce)
    const saveNow = async () => {
      if (conversations.length > 0) {
        console.log(`[ChatBot] Immediate save triggered after message sent`);
        await ConversationPersistenceService.saveConversations(conversations, isAuthenticated, isGuest);
      }
    };
    setTimeout(() => saveNow(), 100); // Small delay to ensure messages state is updated
    
    try {
      setConvLoading(true);
      const response = await sendMessageToGrok(
        editingMessageText,
        [...truncatedMessages, newUserMessage],
        userLanguage,
        currentConversationId,
        selectedPersonality,
        new AbortController(),
        selectedModel,
        isAuthenticated,
        isGuest,
        userName || user?.name
      );

      let fullText = '';
      let editChunkQueue = [];
      let isProcessingEditChunks = false;
      const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120;

      const processEditQueuedChunks = async () => {
        if (isProcessingEditChunks || editChunkQueue.length === 0) return;
        isProcessingEditChunks = true;

        while (editChunkQueue.length > 0) {
          const chunk = editChunkQueue.shift();
          fullText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? { ...msg, text: fullText }
                : msg
            )
          );
          const isInReasoning = isReasoningChunk(fullText, chunk);
          if (!isInReasoning && editChunkQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
          }
        }
        isProcessingEditChunks = false;
      };
      
      await processStreamingResponse(
        response,
        (chunk) => {
          editChunkQueue.push(chunk);
          processEditQueuedChunks();
        }
      );

      while (editChunkQueue.length > 0 || isProcessingEditChunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      finishStreaming(placeholderId);
      
      setConvLoading(false);
      currentMessageIdRef.current = null;
    } catch (err) {
      console.error('Error sending edited message:', err);
      setConvLoading(false);
        showErrorBanner('Gagal mengirim pesan yang diedit');
    }
    
    // Scroll to bottom
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingMessageId(null);
    setEditingMessageText('');
  };

  // Handle message feedback (like/dislike)
  const handleMessageFeedback = async (messageId, feedbackType) => {
    try {
      // Update local state
      setMessageFeedback((prev) => ({
        ...prev,
        [messageId]: prev[messageId] === feedbackType ? null : feedbackType,
      }));

      // Save to database
      if (isAuthenticated) {
        const response = await fetch(`${apiBaseUrl}/api/message-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messageId,
            conversationId: currentConversationId,
            feedbackType: messageFeedback[messageId] === feedbackType ? null : feedbackType,
            userId: user?.id,
          }),
        });
        if (!response.ok) console.error('Failed to save feedback');
      }
    } catch (err) {
      console.error('Error saving feedback:', err);
    }
  };

  // Handle copy message text
  const handleCopyMessage = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      showAlert(userLanguage === 'id' ? 'Teks disalin!' : 'Text copied!', 'success', 2000);
    }).catch(() => {
      showAlert(userLanguage === 'id' ? 'Gagal menyalin' : 'Failed to copy', 'error', 2000);
    });
  };

  /**
   * Handle TTS play/stop for a message
   * Always available - no mute check needed
   */
  const handleTtsToggle = async (message) => {
    try {
      // If already playing this message, stop it
      if (playingMessageId === message.id) {
        tokenMixTtsService.stop();
        setPlayingMessageId(null);
        return;
      }

      // Stop any currently playing audio
      if (playingMessageId) {
        tokenMixTtsService.stop();
      }

      setTtsLoading(message.id);

      const { mainContent } = extractReasoningContent(message.text);
      const textForSpeech = (mainContent && mainContent.length > 0)
        ? mainContent
        : message.text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '').replace(/<reasoning>/gi, '').replace(/<\/reasoning>/gi, '').trim();

      if (!textForSpeech) {
        setTtsLoading(null);
        showAlert(
          userLanguage === 'id'
            ? 'Tidak ada teks utama untuk dibaca.'
            : 'No main text available to speak.',
          'warning',
          3000
        );
        return;
      }

      // Generate and play TTS on frontend for low latency
      const audioBlob = await tokenMixTtsService.textToSpeech(textForSpeech, 'alloy');
      
      setPlayingMessageId(message.id);
      setTtsLoading(null);

      tokenMixTtsService.play(audioBlob, () => {
        setPlayingMessageId(null);
      });
    } catch (error) {
      console.error('[ChatBot] TTS Error:', error);
      setTtsLoading(null);
      showAlert(
        userLanguage === 'id' 
          ? 'Gagal membaca: ' + error.message 
          : 'Failed to play audio: ' + error.message,
        'error',
        3000
      );
    }
  };

  // Handle stop streaming
  const handleStopStreaming = () => {
    // Abort every active stream controller so X always stops generation no matter what
    abortControllersMapRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch (err) {
        console.debug('Abort controller error:', err);
      }
    });
    abortControllersMapRef.current.clear();

    // Fallback for global ref (for backward compatibility)
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch (err) {
        console.debug('Abort fallback error:', err);
      }
      abortControllerRef.current = null;
    }

    if (streamingIntervalRef.current) {
      clearInterval(streamingIntervalRef.current);
      streamingIntervalRef.current = null;
    }
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
      statusUpdateIntervalRef.current = null;
    }

    // If AI just started responding (still streaming, no content), restore prompt
    if (currentMessageIdRef.current && lastSentPromptRef.current) {
      const aiMessage = messages.find(m => m.id === currentMessageIdRef.current);
      if (aiMessage && aiMessage.sender === 'bot' && (!aiMessage.text || aiMessage.text.trim().length === 0)) {
        // Remove the unanswered AI message
        setMessages(prev => prev.filter(m => m.id !== currentMessageIdRef.current));
        // Restore the prompt to input
        setInputValue(lastSentPromptRef.current);
        lastSentPromptRef.current = '';
      } else if (aiMessage) {
        // AI has content, just mark as not streaming
        finishStreaming(currentMessageIdRef.current);
        setAnimatingMessages((prev) => ({ 
          ...prev, 
          [currentMessageIdRef.current]: false 
        }));
      }
    }

    setLoadingStatusMsg('Generasi dihentikan');
    streamingStartTimeRef.current = null;
    isPausedRef.current = false;
    setIsPaused(false);
    setConvLoading(false);
    currentMessageIdRef.current = null;
  };

  // Extract and parse reasoning from message text
  const extractReasoningContent = (text) => {
    if (!text) return { reasoning: null, mainContent: null };
    
    let reasoning = null;
    let mainContent = text;
    
    // Try to extract complete reasoning block: <reasoning>...</reasoning>
    const completeMatch = text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
    if (completeMatch) {
      reasoning = completeMatch[1].trim();
      // Remove complete block from main content
      mainContent = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/g, '').trim();
    } else {
      // Try partial: <reasoning>... without closing tag
      const incompleteMatch = text.match(/<reasoning>([\s\S]*)$/);
      if (incompleteMatch) {
        reasoning = incompleteMatch[1].trim();
        // Remove from <reasoning> onwards
        mainContent = text.substring(0, incompleteMatch.index).trim();
      }
    }
    
    // Clean all remaining reasoning tags from mainContent
    mainContent = mainContent.replace(/<\/?reasoning>/gi, '').trim();
    
    // Apply filtering to reasoning
    if (reasoning) {
      reasoning = filterSensitiveReasoning(reasoning);
    }
    
    return {
      reasoning: reasoning && reasoning.length > 0 ? reasoning : null,
      mainContent: mainContent && mainContent.length > 0 ? mainContent : null
    };
  };

  // Filter sensitive/implementation details from reasoning
  const filterSensitiveReasoning = (text) => {
    if (!text) return text;
    
    // Remove references to AI model names, APIs, and technical implementation
    let filtered = text
      // Remove mentions of specific AI models (Deepseek, GPT, Claude, etc)
      .replace(/\bdeepseek\b/gi, 'AI')
      .replace(/\bgpt-?[\d.]+\b/gi, 'AI')
      .replace(/\bclaude\b/gi, 'AI')
      .replace(/\bapi\b/gi, 'system')
      .replace(/\blanguage model\b/gi, 'AI')
      .replace(/\blarge language model\b/gi, 'AI')
      .replace(/\bllm\b/gi, 'AI')
      
      // Remove system prompt references
      .replace(/system prompt/gi, 'guidelines')
      .replace(/instruction\s*(?:to|for)\s*me/gi, 'my guidelines')
      .replace(/saya harus|saya diinstruksi|saya dilarang/gi, 'my role')
      
      // Remove meta-discussion about constraints
      .replace(/(?:berdasarkan|sesuai|mengikuti).*?(?:instruksi|constraint|rule)\b/gi, '')
      .replace(/instruksi.*?(?:melarang|mewajibkan|meminta)\b.*?(?:saya|situ)/gi, '')
      
      // Remove excessive explanation of why something is done
      .replace(/karena\s+(?:instruksi|constraint|system)\s+.*?(?:\.|,|\n)/gi, '')
      
      // Clean up orphaned conjunctions
      .replace(/^\s*[,-.]+\s*/gm, '')
      .replace(/\s+[,-.]+\s+[,-.]+/g, ' ')
      
      // Remove multiple line breaks
      .replace(/\n{3,}/g, '\n\n')
      
      .trim();
    
    // If after filtering there's very little left, return null to hide reasoning
    if (filtered.length < 20 || filtered.match(/^[\s-.×]*$/)) {
      return '';
    }
    
    return filtered;
  };

  const parseQuizText = (text, messageId) => {
    if (!text) return null;

    const cleanLine = (line) =>
      line
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .trim();

    const normalized = text.replace(/\r/g, '').trim();
    const lines = normalized
      .split(/\n/)
      .map((line) => cleanLine(line))
      .filter(Boolean);

    const titleLineIndex = lines.findIndex((line) => /^(?:kuis|quiz)\s*[:,-]?/i.test(line));
    const questionRegex = /^(?:soal\s*)?(\d+)[).:-]?\s*(.+)$/i;
    const optionRegex = /^([A-Za-z])[).:;-]?\s*(.+)$/;

    let title = '';
    let quizLines = lines;
    let answerLines = [];

    if (titleLineIndex !== -1) {
      const titleLine = lines[titleLineIndex];
      title = titleLine.replace(/^(?:kuis|quiz)\s*[:,-]?\s*/i, '').trim();
      const answerStartIndex = lines.findIndex(
        (line, index) =>
          index > titleLineIndex && /^(?:kunci jawaban|jawaban|pembahasan|answer key)/i.test(line)
      );
      quizLines =
        answerStartIndex === -1
          ? lines.slice(titleLineIndex + 1)
          : lines.slice(titleLineIndex + 1, answerStartIndex);
      answerLines = answerStartIndex === -1 ? [] : lines.slice(answerStartIndex);
    } else {
      const questionCount = lines.filter((line) => questionRegex.test(line)).length;
      const optionCount = lines.filter((line) => optionRegex.test(line)).length;
      const answerStartIndex = lines.findIndex((line) => /^(?:kunci jawaban|jawaban|pembahasan|answer key)/i.test(line));
      const hasQuizHeader = titleLineIndex !== -1;
      const hasExplicitAnswerSection = answerStartIndex !== -1;

      // Only parse as quiz when the text has an explicit quiz header or answer section.
      if (!hasQuizHeader && !hasExplicitAnswerSection) return null;
      if (questionCount < 2 || optionCount < 1) return null;

      quizLines = answerStartIndex === -1 ? lines : lines.slice(0, answerStartIndex);
      answerLines = answerStartIndex === -1 ? [] : lines.slice(answerStartIndex);
    }

    const questions = [];
    let currentQuestion = null;

    for (const line of quizLines) {
      if (!line) continue;
      const optionMatch = line.match(optionRegex);
      const questionMatch = line.match(questionRegex);

      if (questionMatch && (!optionMatch || questionMatch[1] !== optionMatch[1])) {
        currentQuestion = {
          number: parseInt(questionMatch[1], 10),
          question: questionMatch[2].trim(),
          options: []
        };
        questions.push(currentQuestion);
      } else if (optionMatch && currentQuestion) {
        currentQuestion.options.push({
          label: optionMatch[1].toUpperCase(),
          text: optionMatch[2].trim()
        });
      } else if (currentQuestion) {
        currentQuestion.question += ' ' + line;
      }
    }

    if (questions.length === 0) return null;

    const answerKey = [];
    let currentAnswer = null;

    for (const line of answerLines) {
      if (!line) continue;
      const answerMatch = line.match(/^(?:soal\s*)?(\d+)[).:-]?\s*([A-Za-z])/i);
      const explanationMatch = line.match(/^([A-Za-z])[).:;-]?\s*(.+)$/);

      if (answerMatch) {
        currentAnswer = {
          number: parseInt(answerMatch[1], 10),
          answer: answerMatch[2].toUpperCase(),
          explanation: ''
        };
        answerKey.push(currentAnswer);
      } else if (explanationMatch && currentAnswer) {
        currentAnswer.explanation = explanationMatch[2].trim();
      }
    }

    const selectedAnswers = quizSelections[messageId] || {};

    return (
      <div className="quiz-card">
        {title ? <div className="quiz-title">{title}</div> : null}

        {questions.map((question) => {
          const selectedOption = selectedAnswers[question.number];
          return (
            <div key={question.number} className="quiz-question-block">
              <div className="quiz-question">
                <span className="quiz-question-number">{question.number}.</span>
                <span>{question.question}</span>
              </div>
              {question.options.length > 0 && (
                <div className="quiz-options">
                  {question.options.map((option) => {
                    const isSelected = selectedOption === option.label;
                    return (
                      <button
                        key={option.label}
                        type="button"
                        className={`quiz-option${isSelected ? ' selected' : ''}`}
                        onClick={() => {
                          if (!messageId) return;
                          setQuizSelections((prev) => ({
                            ...prev,
                            [messageId]: {
                              ...prev[messageId],
                              [question.number]: option.label
                            }
                          }));
                        }}
                      >
                        <span className="quiz-option-label">{option.label}.</span>
                        <span className="quiz-option-text">{option.text}</span>
                        {isSelected && <span className="quiz-option-selected">✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {answerKey.length > 0 && (
          <div className="quiz-answer-key">
            <div className="quiz-answer-key-title">Kunci Jawaban</div>
            {answerKey.map((item) => (
              <div key={item.number} className="quiz-answer-item">
                <span className="quiz-answer-question">{item.number}.</span>
                <span className="quiz-answer-choice">{item.answer}</span>
                {item.explanation ? <div className="quiz-answer-explanation">{item.explanation}</div> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Chart Detection and Parsing Functions
  const detectChartType = (text) => {
    const lowerText = text.toLowerCase();
    if (lowerText.includes('pie chart') || lowerText.includes('pie-chart') || (lowerText.includes('pie') && lowerText.includes('chart'))) return 'pie';
    if (lowerText.includes('bar chart') || lowerText.includes('bar-chart') || (lowerText.includes('bar') && lowerText.includes('chart'))) return 'bar';
    if (lowerText.includes('line chart') || lowerText.includes('line-chart') || (lowerText.includes('line') && lowerText.includes('chart'))) return 'line';
    if (lowerText.includes('radar') || lowerText.includes('radar chart')) return 'radar';
    if (lowerText.includes('infografis') || lowerText.includes('infographic') || lowerText.includes('info grafis')) return 'infographic';
    if (lowerText.includes('statistik') || lowerText.includes('grafik') || lowerText.includes('chart')) return 'pie'; // Default to pie
    return null;
  };

  const parseChartDataFromText = (text) => {
    const lines = text.split('\n');
    const data = [];
    
    // Try to parse lines with format: "label: value" or "label - value"
    for (const line of lines) {
      const match = line.match(/^[\s-•*]*(.*?)[\s:|-]+([\d.,]+)\s*(%)?/);
      if (match && match[1] && match[2]) {
        const label = match[1].trim();
        const value = parseInt(match[2].replace(/[.,]/g, ''));
        if (label && !isNaN(value)) {
          data.push({ name: label, value });
        }
      }
    }
    
    return data.length > 0 ? data : null;
  };

  const _extractChartBlock = (text) => {
    // Look for chart markers: ```chart or [chart] or **PIE CHART** etc
    const chartPatterns = [
      /\[CHART\]([\s\S]*?)\[\/CHART\]/gi,
      /```chart([\s\S]*?)```/gi,
      /\*\*(PIE CHART|BAR CHART|LINE CHART|RADAR|INFOGRAFIS)(.*?)\*\*([\s\S]*?)(?=\*\*|```|$)/gi,
    ];

    for (const pattern of chartPatterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0];
      }
    }
    return null;
  };

  const isExecutionLogLine = (line) => {
    if (!line) return false;
    const trimmed = line.trim();
    const patterns = [
      /^\[STEP \d+\/\d+\]/,
      /^📖 \[AGENT\]/,
      /^✅ \[AGENT\]/,
      /^⚠️\s*\[AGENT\]/,
      /^🔍/,
      /^📁/,
      /^📤/,
      /^🔧/,
      /^╔|^╚|^║/,
      /^: heartbeat$/i,
    ];
    return patterns.some((rx) => rx.test(trimmed));
  };

  const removeExecutionLogLines = (text) => {
    return text
      .split(/\r?\n/)
      .filter((line) => !isExecutionLogLine(line))
      .join('\n');
  };

  const removeDownloadStatusLines = (text) => {
    return text
      .split(/\r?\n/)
      .filter((line) => {
        const trimmed = line.trim();
        return !/^(✅\s*(File siap|File ready)|📄\s*File:|⏱️\s*(Waktu|Time):)/i.test(trimmed);
      })
      .join('\n')
      .trim();
  };

  // Improved formatMessageText - better handling of code blocks and tables
  const formatMessageText = (text, isStreaming = false, messageId = null) => {
    if (!text) return text;

    // Remove any stray reasoning tags before formatting
    let processedText = text.replace(/<\/?reasoning>/gi, '');
    processedText = removeExecutionLogLines(processedText);

    // Extract file download info if present
    let downloadUrl = null;
    let fileName = null;
    let downloadSummary = null;
    const downloadMatch = processedText.match(/\[(?:FILE_DOWNLOAD_START|FILEDOWNLOADSTART):([^:]+):([^:]+):?([^\]]*)\]/);
    if (downloadMatch) {
      downloadUrl = downloadMatch[1];
      fileName = downloadMatch[2];
      // Decode summary if provided
      if (downloadMatch[3]) {
        try {
          downloadSummary = decodeURIComponent(downloadMatch[3]);
        } catch (e) {
          downloadSummary = downloadMatch[3];
        }
      }
      // Remove the download markers from text
      processedText = processedText.replace(/\[(?:FILE_DOWNLOAD_START|FILEDOWNLOADSTART):[^\]]*\]\n*/g, '');
      processedText = processedText.replace(/\[(?:FILE_DOWNLOAD_END|FILEDOWNLOADEND)\]\n*/g, '');
      processedText = removeDownloadStatusLines(processedText);
    }

    const quizNode = parseQuizText(processedText, messageId);
    if (quizNode) return quizNode;
    
    // Extract chart blocks first (before other processing)
    const chartBlocks = [];
    
    // Look for chart blocks with various formats
    // Format: **PIE CHART** Data here or [CHART type=pie] data [/CHART]
    processedText = processedText.replace(/\*\*(PIE CHART|BAR CHART|LINE CHART|RADAR|INFOGRAFIS)(.*?)(\n\n|(?=\n[A-Z*#]))/gi, (match, chartType, content) => {
      const chartIndex = chartBlocks.length;
      const dataStr = content.trim();
      const data = parseChartDataFromText(dataStr);
      
      if (data && data.length > 0) {
        const typeMap = {
          'PIE CHART': 'pie',
          'BAR CHART': 'bar',
          'LINE CHART': 'line',
          'RADAR': 'radar',
          'INFOGRAFIS': 'infographic'
        };
        
        chartBlocks.push({
          type: typeMap[chartType] || 'pie',
          data: data,
          title: chartType.toLowerCase().replace(' chart', '')
        });
        
        return `__CHART_BLOCK_${chartIndex}__\n\n`;
      }
      return match;
    });
    
    // Also try to auto-detect charts from content
    if (chartBlocks.length === 0 && (text.toLowerCase().includes('pie') || text.toLowerCase().includes('grafik') || text.toLowerCase().includes('statistik'))) {
      const chartType = detectChartType(text);
      if (chartType) {
        const data = parseChartDataFromText(text);
        if (data && data.length > 2) {
          chartBlocks.push({
            type: chartType,
            data: data,
            title: 'Statistik'
          });
          processedText = `__CHART_BLOCK_${chartBlocks.length - 1}__\n\n${processedText}`;
        }
      }
    }
    
    // First, extract and protect formulas (both block and inline, multiple formats)
    const formulaBlocks = [];
    
    // Extract block formulas - \[...\] or $$...$$ 
    processedText = processedText.replace(/\\\[\s*([\s\S]*?)\s*\\\]|\$\$\s*([\s\S]*?)\s*\$\$/g, (match, latexBlock, dollarBlock) => {
      const formula = latexBlock || dollarBlock;
      const index = formulaBlocks.length;
      formulaBlocks.push({ type: 'block', formula: formula.trim() });
      return `__FORMULA_BLOCK_${index}__`;
    });
    
    // Extract inline formulas - \(...\) or $...$ (improved to handle more cases)
    // First handle \(...\) format
    processedText = processedText.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (match, latexInline) => {
      const formula = latexInline;
      const index = formulaBlocks.length;
      formulaBlocks.push({ type: 'inline', formula: formula.trim() });
      return `__FORMULA_BLOCK_${index}__`;
    });
    
    // Then handle single $ formulas more carefully (avoid matching inside code/text)
    // Match $...$  but not $$...$$ and not when preceded/followed by backticks
    processedText = processedText.replace(/(?<!\$)(?<![`])\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match, dollarInline) => {
      const formula = dollarInline.trim();
      // Skip if it looks like currency or empty
      if (!formula || formula.length < 2 || /^\d+$/.test(formula)) {
        return match; // Return original match if it's just a number
      }
      const index = formulaBlocks.length;
      formulaBlocks.push({ type: 'inline', formula: formula });
      return `__FORMULA_BLOCK_${index}__`;
    });
    
    // Then extract code blocks
    const codeBlocks = [];
    
    // Extract ```code``` blocks
    processedText = processedText.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      codeBlocks.push({ type: 'fenced', lang: lang || 'text', code: code.trim() });
      return `__CODE_BLOCK_${index}__`;
    });
    
    // Extract `inline code`
    processedText = processedText.replace(/`([^`]+)`/g, (match, code) => {
      const index = codeBlocks.length;
      codeBlocks.push({ type: 'inline', code: code });
      return `__CODE_BLOCK_${index}__`;
    });
    
    // Extract markdown tables
    const tableBlocks = [];
    // Better regex untuk markdown table: captures complete table blocks (header + separator + data rows)
    // Matches: | col | col | \n |---|---| \n | data | data |
    processedText = processedText.replace(/\n([ \t]*\|.+\|[ \t]*\n)+/g, (match) => {
      const lines = match.trim().split(/\n|\r\n/).filter(line => line.trim());
      // Must have at least: header row + separator row, OR header + data rows
      if (lines.length >= 2 && lines.every(line => line.includes('|'))) {
        const tableIndex = tableBlocks.length;
        tableBlocks.push({ type: 'table', content: match.trim() });
        return `\n__TABLE_BLOCK_${tableIndex}__\n`;
      }
      return match; // Return original if not a valid table
    });
    
    // Protect placeholders before markdown cleaning
    let processedTextWithProtection = processedText;
    const placeholderMap = new Map();
    let placeholderCounter = 0;
    
    // Replace __CODE_BLOCK_X__, __TABLE_BLOCK_X__, __CHART_BLOCK_X__, and __FORMULA_BLOCK_X__ with safe markers
    processedTextWithProtection = processedTextWithProtection.replace(/(__CODE_BLOCK_\d+__|__TABLE_BLOCK_\d+__|__CHART_BLOCK_\d+__|__FORMULA_BLOCK_\d+__)/g, (match) => {
      const safeMarker = `<<PLACEHOLDER_${placeholderCounter}>>`;
      placeholderMap.set(safeMarker, match);
      placeholderCounter++;
      return safeMarker;
    });
    
    // Clean markdown from non-code text
    let cleanedText = processedTextWithProtection
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/__([^_]+)__/g, '$1')
      .replace(/_(.*?)_/g, '$1')
      .replace(/~~(.*?)~~/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .trim();
    
    // Restore placeholders after markdown cleaning
    for (const [marker, original] of placeholderMap.entries()) {
      cleanedText = cleanedText.replace(marker, original);
    }
    
    // Normalize separator lines like --- so they become explicit paragraphs
    cleanedText = cleanedText
      .replace(/\n-{3,}\n/g, '\n\n---\n\n')
      .replace(/\n_{3,}\n/g, '\n\n---\n\n')
      .replace(/\n\*{3,}\n/g, '\n\n---\n\n');

    // Restore code blocks, tables, and formulas with proper formatting
    const result = [];
    const parts = cleanedText.split(/(__CODE_BLOCK_\d+__|__TABLE_BLOCK_\d+__|__CHART_BLOCK_\d+__|__FORMULA_BLOCK_\d+__)/g);
    
    for (const part of parts) {
      const codeMatch = part.match(/__CODE_BLOCK_(\d+)__/);
      const tableMatch = part.match(/__TABLE_BLOCK_(\d+)__/);
      const chartMatch = part.match(/__CHART_BLOCK_(\d+)__/);
      const formulaMatch = part.match(/__FORMULA_BLOCK_(\d+)__/);
      
      if (formulaMatch) {
        const block = formulaBlocks[parseInt(formulaMatch[1])];
        const formulaId = `formula-${formulaMatch[1]}`;
        
        result.push(
          <FormulaRenderer 
            key={formulaId} 
            formula={block.formula} 
            isBlock={block.type === 'block'} 
          />
        );
      } else if (codeMatch) {
        const block = codeBlocks[parseInt(codeMatch[1])];
        if (block.type === 'fenced') {
          // Render fenced code block
          const language = detectLanguage(block.code, block.lang);
          const cleanedCode = cleanCodeBlock(block.code, language);
          const highlighted = highlightCode(cleanedCode, language);
          const lineCount = cleanedCode.split('\n').length;
          const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1);
          const codeBlockId = `code-${codeMatch[1]}`;
          // Code blocks are EXPANDED by default, only collapse if explicitly set to true
          const isCollapsed = collapsedCodeBlocks[codeBlockId] === true;
          
          // Get language icon
          const languageIcons = {
            'javascript': '📜', 'js': '📜', 'typescript': '📘', 'ts': '📘',
            'python': '🐍', 'java': '☕', 'cpp': '⚙️', 'c': '⚙️',
            'html': '🌐', 'css': '🎨', 'jsx': '⚛️', 'tsx': '⚛️',
            'json': '📦', 'sql': '🗄️', 'bash': '🖥️', 'sh': '🖥️',
            'php': '🐘', 'ruby': '💎', 'go': '🚀', 'rust': '🦀',
            'kotlin': '🔧', 'swift': '🍎', 'csharp': '#️⃣', 'cs': '#️⃣'
          };
          const icon = languageIcons[language.toLowerCase()] || '📝';
          
          result.push(
            <div key={codeBlockId}>
              {isStreaming && <div style={{fontSize: '14px', color: '#92400e', marginBottom: '8px', fontStyle: 'italic'}}>⌛ Mengerjakan...</div>}
              <div className="code-block-container">
                <div className="code-block-header">
                  <button 
                    className="code-collapse-btn"
                    onClick={() => setCollapsedCodeBlocks(prev => ({
                      ...prev,
                      [codeBlockId]: !isCollapsed
                    }))}
                    title={isCollapsed ? 'Expand' : 'Collapse'}
                  >
                    {isCollapsed ? '▶️' : '▼️'}
                  </button>
                  <span className="code-block-name">
                    {icon} <strong>{language.toUpperCase()}</strong> ({lineCount} lines)
                  </span>
                  <button 
                    className="code-copy-btn"
                    onClick={() => navigator.clipboard.writeText(cleanedCode)}
                    title="Copy code"
                  >
                    📋
                  </button>
                </div>
                {!isCollapsed && (
                  <>
                    <CodeStructureViewer code={cleanedCode} language={language} />
                    <div className="code-content-wrapper">
                      <div className="code-line-numbers">
                        {lineNumbers.map((lineNum) => (
                          <div key={lineNum}>{lineNum}</div>
                        ))}
                      </div>
                      <pre className="code-block">
                        <code 
                          className={`language-${language}`}
                          dangerouslySetInnerHTML={{ __html: highlighted }}
                        />
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        } else if (block.type === 'inline') {
          // Render inline code
          result.push(
            <code key={`inline-${codeMatch[1]}`} className="inline-code">
              {block.code}
            </code>
          );
        }
      } else if (chartMatch) {
        // Render chart
        const chartData = chartBlocks[parseInt(chartMatch[1])];
        if (chartData) {
          result.push(
            <ChartGenerator
              key={`chart-${chartMatch[1]}`}
              data={chartData.data}
              type={chartData.type}
              title={chartData.title}
            />
          );
        }
      } else if (tableMatch) {
        const tableData = tableBlocks[parseInt(tableMatch[1])];
        const lines = tableData.content
          .trim()
          .split(/\n|\r\n/)
          .map(line => line.trim())
          .filter(line => line.trim() && line.includes('|'));
        
        // Helper function to parse table row
        const parseTableRow = (line) => {
          // Split by | and filter out leading/trailing empty cells
          return line
            .split('|')
            .slice(1, -1) // Remove first and last empty cells from split
            .map(cell => {
              // Clean markdown from cells
              return cell
                .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
                .replace(/\*([^*]+)\*/g, '$1') // italic
                .replace(/__(.*?)__/g, '$1') // bold underscore
                .replace(/_(.*?)_/g, '$1') // italic underscore
                .replace(/~~(.*?)~~/g, '$1') // strikethrough
                .replace(/`([^`]+)`/g, '$1') // inline code
                .trim();
            })
            .filter(cell => cell !== '');
        };
        
        // Parse all rows
        const allRows = lines.map(parseTableRow).filter(row => row.length > 0);

        if (allRows.length >= 1) {
          // First row is header
          const headerRow = allRows[0];
          
          // Check if second row is separator (dashes/colons only)
          const isSeparatorRow = allRows.length > 1 && 
            allRows[1].every(cell => /^[-:\s]*$/.test(cell));
          
          // Data rows start after header (and separator if exists)
          const dataStartIndex = isSeparatorRow ? 2 : 1;
          const dataRows = allRows.slice(dataStartIndex);

          result.push(
            <div key={`table-${tableMatch[1]}`} className="table-container">
              <table className="markdown-table">
                <thead>
                  <tr>
                    {headerRow.map((cell, idx) => (
                      <th key={idx}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataRows.length > 0 ? (
                    dataRows.map((row, rowIdx) => (
                      <tr key={rowIdx}>
                        {row.map((cell, colIdx) => (
                          <td key={colIdx}>{cell}</td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={headerRow.length} style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                        Tidak ada data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        }
      } else if (part.trim()) {
        // Render regular text with basic formatting
        const paragraphs = part.split('\n\n');
        for (let i = 0; i < paragraphs.length; i++) {
          const para = paragraphs[i].trim();
          if (para) {
            // Clean up any remaining placeholder markers that weren't properly replaced
            let cleanPara = para.replace(/<<PLACEHOLDER_\d+>>/g, '');
            
            // Also clean up formula block markers that might have slipped through
            cleanPara = cleanPara.replace(/__FORMULA_BLOCK_\d+__/g, '');
            cleanPara = cleanPara.replace(/__CODE_BLOCK_\d+__/g, '');
            cleanPara = cleanPara.replace(/__TABLE_BLOCK_\d+__/g, '');
            cleanPara = cleanPara.replace(/__CHART_BLOCK_\d+__/g, '');
            
            if (cleanPara.trim()) {
              // Handle bold text within paragraph - improved regex that handles multiline
              // Match **text** or __text__ even across newlines
              const separatorMatch = cleanPara.trim().match(/^(-{3,}|_{3,}|\*{3,})$/);
              if (separatorMatch) {
                result.push(
                  <div key={`divider-${i}`} className="message-divider" />
                );
              } else {
                const parseParagraphSegments = (text) => {
                  const segments = [];
                  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
                  let lastIndex = 0;
                  let match;

                  while ((match = imageRegex.exec(text)) !== null) {
                    const beforeText = text.slice(lastIndex, match.index);
                    if (beforeText) segments.push(beforeText);
                    segments.push({ type: 'image', alt: match[1] || 'Generated Image', src: match[2].trim() });
                    lastIndex = match.index + match[0].length;
                  }

                  const remainingText = text.slice(lastIndex);
                  if (remainingText) segments.push(remainingText);
                  return segments;
                };
                const paragraphSegments = parseParagraphSegments(cleanPara);
                result.push(
                  <p key={`p-${i}`} className="message-paragraph">
                    {paragraphSegments && paragraphSegments.map((segment, segIdx) => {
                      if (typeof segment === 'string') {
                        const boldSegments = segment.split(/(\*\*[\s\S]*?\*\*|__([\s\S]*?)__|###\s+(.+?)(?=\n|$))/g);
                        return (
                          <React.Fragment key={segIdx}>
                            {boldSegments && boldSegments.map((subSegment, subIdx) => {
                              if (subSegment && ((subSegment.startsWith('**') && subSegment.endsWith('**')) ||
                                  (subSegment.startsWith('__') && subSegment.endsWith('__')))) {
                                return <strong key={subIdx}>{subSegment.slice(2, -2)}</strong>;
                              }
                              if (subSegment && subSegment.startsWith('###')) {
                                const boldText = subSegment.replace(/^###\s+/, '').trim();
                                return <strong key={subIdx}>{boldText}</strong>;
                              }
                              return subSegment;
                            })}
                          </React.Fragment>
                        );
                      }
                      if (segment && segment.type === 'image') {
                        return (
                          <img
                            key={`img-${segIdx}`}
                            src={segment.src}
                            alt={segment.alt}
                            className="inline-markdown-image"
                            style={{ maxWidth: '100%', borderRadius: '8px', margin: '12px 0' }}
                          />
                        );
                      }
                      return null;
                    })}
                  </p>
                );
              }
            }
          }
        }
      }
    }
    
    // Add download button if file download info is available
    if (downloadUrl && fileName) {
      result.push(
        <div key="download-button" className="file-download-container" style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderRadius: '8px',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <span style={{ fontSize: '18px' }}>📥</span>
          <a 
            href={downloadUrl}
            download={fileName}
            className="download-file-button"
            style={{
              flex: 1,
              padding: '8px 12px',
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500',
              display: 'inline-block',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            📩 Download: {fileName}
          </a>
        </div>
      );
    }
    
    return <>{result}</>;
  };

  const scrollToBottom = (isImmediate = false) => {
    // If we're holding scroll (e.g. just finished streaming), ignore further auto-scrolls
    if (holdScrollRef.current) return;

    const scrollElement = document.querySelector('.messages-container');
    const anchor = messagesEndRef.current;

    const performScroll = () => {
      // Mark that we're doing a programmatic scroll so the scroll handler won't treat it as user input
      programmaticScrollRef.current = true;
      // Clear the flag shortly after to resume normal detection
      setTimeout(() => { programmaticScrollRef.current = false; }, 120);
      if (scrollElement) {
        try {
          // Force scroll ke paling bawah ultimate
          const maxScrollTop = scrollElement.scrollHeight - scrollElement.clientHeight;
          scrollElement.scrollTop = maxScrollTop + 9999; // Force extra untuk pastikan mentok
          scrollElement.scrollTo({ top: maxScrollTop + 9999, behavior: 'auto' });
        } catch (err) {
          console.log('Scroll error:', err);
        }
      }

      if (anchor && anchor.scrollIntoView) {
        try {
          anchor.scrollIntoView({ behavior: 'auto', block: 'end', inline: 'nearest' });
        } catch (err) {
          console.log('Scroll into view error:', err);
        }
      }
    };

    if (!scrollElement && !anchor) return;

    if (isImmediate) {
      performScroll();
    } else {
      setTimeout(performScroll, 0);
    }

    setTimeout(performScroll, 10);
    setTimeout(performScroll, 50);
    requestAnimationFrame(performScroll);
  };

  // Handle scroll to bottom button click
  const handleScrollToBottomClick = () => {
    // User explicitly requested bottom — clear hold and perform programmatic scroll
    holdScrollRef.current = false;
    try {
      const scrollEl = document.querySelector('.messages-container');
      if (scrollEl) scrollEl.classList.remove('prefill-space');
    } catch (_e) {
      // ignore
    }
    scrollToBottom(true);
    setIsScrolledUp(false);
  };

  // Handle show previous messages button
  const handleShowPreviousMessages = () => {
    // Disable compact view to show all messages
    setCompactView(false);
    // Scroll to bottom to show the latest chat
    setTimeout(() => {
      scrollToBottom(true);
    }, 100);
  };

  // Update conversation messages and calculate global token count
  useEffect(() => {
    // Hanya update state, jangan scroll di sini - scroll hanya di handleSendMessage dan finishStreaming
    
    if (currentConversationId) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? { ...c, messages, updatedAt: new Date().toISOString() }
            : c
        )
      );
      // Generate AI-based title after the first exchange and refresh every 3 exchanges
      if (messages.length === 2 || (messages.length >= 6 && messages.length % 6 === 0)) {
        const titleConvId = currentConversationId;
        setTimeout(() => {
          if (titleConvId) {
            generateChatTitle(titleConvId);
          }
        }, 300);
      }
    }
  }, [messages]);

  // Close input menu when clicking outside
  useEffect(() => {
    if (!showInputMenu) return;

    const handleClickOutside = (e) => {
      const menuContainer = document.querySelector('.input-menu-container');
      if (menuContainer && !menuContainer.contains(e.target)) {
        setShowInputMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showInputMenu]);

  // ==================== SOURCE MANAGEMENT ====================
  /**
   * Load sources for current conversation from backend
   */
  const loadSourcesForConversation = async (conversationId) => {
    try {
      if (!conversationId) return;
      
      const response = await fetch(`${apiBaseUrl}/api/sources/${conversationId}`);
      const data = await response.json();
      
      if (data.success && data.sources) {
        setCurrentSources(data.sources);
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  };

  /**
   * Show sources modal for current conversation
   */
  const handleShowSources = async () => {
    if (!currentConversationId) return;
    await loadSourcesForConversation(currentConversationId);
    setShowSourcesModal(true);
  };

  /**
   * View source details when clicked
   */
  const handleViewSourceDetail = (source) => {
    setSelectedSource(source);
  };

  /**
   * Open source URL in new tab
   */
  const handleOpenSource = (url) => {
    if (url && url.startsWith('http')) {
      window.open(url, '_blank');
    }
  };

  /**
   * Get icon for source type
   */
  const getSourceIcon = (type) => {
    const iconMap = {
      'finance_data': '💰',
      'crypto_data': '₿',
      'stock_data': '📈',
      'macro_data': '📊',
      'web_search': '🔍',
      'news': '📰',
      'economic': '💹'
    };
    return iconMap[type] || '📚';
  };

  /**
   * Generate answer from found sources
   */
  const handleGenerateAnswerFromSources = async (userQuery) => {
    if (!userQuery) return;

    // Build sources context
    const sourcesContext = foundSources.map((s, i) => 
      `[Sumber ${i+1}] ${s.title}\n${s.description}\nURL: ${s.url}\nSumber: ${s.source}`
    ).join('\n\n');

    const fullQuery = `Berdasarkan sumber-sumber berikut yang telah ditemukan, berikan jawaban untuk pertanyaan: "${userQuery}"\n\nSOURCES:\n${sourcesContext}`;

    // Clear sources panel
    setShowFoundSourcesPanel(false);
    setFoundSources([]);
    // setIsWaitingForAnswer(false); - removed unused setter

    // Add user message to display
    const userMessage = {
      id: Date.now(),
      text: userQuery,
      sender: 'user',
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setCompactView(true);
    // Store the last sent prompt for restore-on-stop functionality
    lastSentPromptRef.current = userQuery;
    lastSentUserMessageIdRef.current = userMessage.id;
    setInputValue('');

    // Create placeholder for bot response
    const placeholderId = Date.now() + Math.floor(Math.random() * 1000);
    const botMessage = {
      id: placeholderId,
      text: '',
      sender: 'bot',
      timestamp: new Date(),
      isStreaming: true,
    };
    setMessages((prev) => [...prev, botMessage]);

    try {
      setConvLoading(true);
      const response = await sendMessageToGrok(
        fullQuery,
        [...messages, userMessage],
        userLanguage,
        currentConversationId,
        selectedPersonality,
        new AbortController(),
        selectedModel,
        isAuthenticated,
        isGuest,
        userName || user?.name
      );

      let fullText = '';
      let imgChunkQueue = [];
      let isProcessingImgChunks = false;
      const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120;

      const processImgQueuedChunks = async () => {
        if (isProcessingImgChunks || imgChunkQueue.length === 0) return;
        isProcessingImgChunks = true;

        while (imgChunkQueue.length > 0) {
          const chunk = imgChunkQueue.shift();
          fullText += chunk;
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === placeholderId
                ? { ...msg, text: fullText }
                : msg
            )
          );
          const isInReasoning = isReasoningChunk(fullText, chunk);
          if (!isInReasoning && imgChunkQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
          }
        }
        isProcessingImgChunks = false;
      };
      
      await processStreamingResponse(
        response,
        (chunk) => {
          imgChunkQueue.push(chunk);
          processImgQueuedChunks();
        }
      );

      while (imgChunkQueue.length > 0 || isProcessingImgChunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Mark streaming as finished
      finishStreaming(placeholderId);
      setConvLoading(false);
    } catch (err) {
      if (err.name !== 'AbortError') {
        showErrorBanner(`Error: ${err.message}`);
      }
    }
  };

  /**
   * Handle document generation request
   * Called when AI response contains document-suitable content
   */
  const triggerDocumentGeneration = (content, fileType = 'word', title = '') => {
    console.log(`[ChatBot] Triggering ${fileType} document generation`);
    setDocumentGeneratorContent(content);
    setDocumentGeneratorType(fileType);
    setDocumentGeneratorTitle(title || `Generated ${fileType === 'word' ? 'Document' : 'Spreadsheet'}`);
    setShowDocumentGenerator(true);
  };

  /**
   * Check if message contains document generation request
   * Returns { type: 'word'|'excel', title: string } or null
   */
  const checkForDocumentRequest = (message) => {
    return DocumentGenerationService.parseDocumentCommand(message);
  };

  /**
   * Handle inline image generation in chat
   * Generates image and displays it with reasoning in chat format
   */
  const handleInlineImageGeneration = async (imageRequest, userMessage) => {
    // Define variables outside try block so they're accessible in catch
    let placeholderId = Date.now() + '_img';
    let thinkingStartTime;
    const imageAbortController = new AbortController();
    
    try {
      console.log('[ChatBot] Starting inline image generation for:', imageRequest.prompt);
      
      // Store abort controller so handleStopStreaming can abort it
      abortControllersMapRef.current.set('image-' + placeholderId, imageAbortController);
      
      // Add user message to chat
      setMessages((prev) => [...prev, userMessage]);
      setCompactView(true);
      
      thinkingStartTime = Date.now();
      
      // Add thinking placeholder
      const thinkingMessage = {
        id: placeholderId,
        text: '🎨 ngedumel membuat gambar...',
        sender: 'bot',
        timestamp: new Date(),
        isThinking: true,
        isImage: true,
        imagePrompt: imageRequest.prompt,
      };
      
      setMessages((prev) => [...prev, thinkingMessage]);
      setConvLoading(true);
      setError(null);
      setIsScrolledUp(false);
      
      // Scroll to show thinking message
      setTimeout(() => {
        try {
          const msgEl = document.querySelector(`[data-msg-id="${placeholderId}"]`);
          if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } catch (_e) {
          // ignore
        }
      }, 100);
      
      // Generate image via API with an English prompt that is first refined by the chat model
      console.log('[ChatBot] Calling image generation API...');
      
      console.log('[ChatBot] 🟡 Step 1: Original prompt:', imageRequest.prompt);
      
      let englishPrompt = await ImageGenerationService.generateEnglishImagePrompt(imageRequest.prompt);
      if (!englishPrompt) {
        console.warn('[ChatBot] ⚠️ English prompt generation failed, falling back to dictionary translation');
        englishPrompt = ImageGenerationService.translateToEnglish(imageRequest.prompt);
      }
      console.log('[ChatBot] 🟡 Step 2: English prompt:', englishPrompt);
      
      const refinedPrompt = ImageGenerationService.enhancePrompt(englishPrompt);
      console.log('[ChatBot] 🟡 Step 3: Refined prompt:', refinedPrompt);

      const detailedReasoning = await ImageGenerationService.generateAIReasoning(
        imageRequest.prompt,
        refinedPrompt
      );
      console.log('[ChatBot] ✅ English reasoning generated, length:', detailedReasoning ? detailedReasoning.length : 0);

      console.log('[ChatBot] 🟡 Step 4: Calling generateImage with prompt:', refinedPrompt);
      const imageData = await ImageGenerationService.generateImage(
        refinedPrompt,
        imageRequest.size || '1024x1024',
        currentConversationId,
        'imagen-4-fast',
        imageAbortController.signal
      );
      console.log('[ChatBot] 🟡 Step 5: Image generated successfully');
      const generationTime = Math.round((Date.now() - thinkingStartTime) / 1000);
      
      console.log(`[ChatBot] Image generated in ${generationTime}s`);
      
      const assistantIntro = `I translated your request to English and refined it for the image model:\n"${refinedPrompt}"\n\n`;
      const reasoningBlock = detailedReasoning ? `${detailedReasoning}\n\n` : '';
      const updatedMessage = {
        id: placeholderId,
        text: `${assistantIntro}${reasoningBlock}![Generated Image](${imageData.image.url})`,
        imageUrl: imageData.image.url,
        imageId: imageData.image.id,
        sender: 'bot',
        timestamp: new Date(),
        isImage: true,
        isThinking: false,
        generationTime: generationTime,
      };
      
      console.log('[ChatBot] 🔴 updatedMessage.text length:', updatedMessage.text.length);
      console.log('[ChatBot] 🔴 updatedMessage.imageUrl:', updatedMessage.imageUrl);
      console.log('[ChatBot] 🔴 updatedMessage.imageId:', updatedMessage.imageId);
      console.log('[ChatBot] 🔴 updatedMessage.text preview:', updatedMessage.text.substring(0, 200));
      
      setMessages((_prev) => {
        const updated = _prev.map((msg) =>
          msg.id === placeholderId ? updatedMessage : msg
        );
        
        // Update conversations state with new messages (including imageUrl)
        setConversations((prevConvs) => {
          const updatedConvs = prevConvs.map(conv => 
            conv.id === currentConversationId
              ? { ...conv, messages: updated, updatedAt: new Date().toISOString() }
              : conv
          );
          
          console.log(`[ChatBot] Updated conversation ${currentConversationId} with image message`);
          console.log(`[ChatBot] Message text length: ${updatedMessage.text.length}, has imageUrl: ${!!updatedMessage.imageUrl}`);
          
          // Save conversation immediately with updated messages
          ConversationPersistenceService.saveConversations(updatedConvs, isAuthenticated, isGuest)
            .catch(err => console.error('[ChatBot] Error saving conversation:', err));
          
          return updatedConvs;
        });
        
        return updated;
      });
      
      setConvLoading(false);
      
      // Auto-scroll to image
      setTimeout(() => {
        try {
          const msgEl = document.querySelector(`[data-msg-id="${placeholderId}"]`);
          if (msgEl) msgEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        } catch (_e) {
          // ignore
        }
      }, 300);

      // CRITICAL: Clear the processing lock flag on success
      console.log('[ChatBot] Image generation completed successfully, clearing processing lock');
      isProcessingRef.current = false;
      
      // Clean up the abort controller
      abortControllersMapRef.current.delete('image-' + placeholderId);
      
    } catch (err) {
      console.error('[ChatBot] Image generation error:', err);

      // Don't show error if it was aborted (user cancelled)
      if (err.name === 'AbortError') {
        console.log('[ChatBot] Image generation cancelled by user');
        // Remove the thinking message
        setMessages((prev) =>
          prev.filter((msg) => msg.id !== placeholderId)
        );
      } else {
        // Update the thinking placeholder to show the failure clearly
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? {
                  ...msg,
                  text: `❌ Gagal membuat gambar: ${err.message}`,
                  isThinking: false,
                  isError: true,
                }
              : msg
          )
        );

        // Show error message in chat as a separate fallback
        const errorId = Date.now() + '_err';
        setMessages((prev) => [
          ...prev,
          {
            id: errorId,
            text: `❌ Gagal membuat gambar: ${err.message}`,
            sender: 'bot',
            timestamp: new Date(),
            isError: true,
          },
        ]);

        showErrorBanner(`Failed to generate image: ${err.message}`);
      }

      setConvLoading(false);
      
      // CRITICAL: Clear the processing lock flag
      console.log('[ChatBot] Error occurred, clearing processing lock flag');
      isProcessingRef.current = false;
      
      // Clean up the abort controller
      abortControllersMapRef.current.delete('image-' + placeholderId);
    }
  };

  const checkForImageRequest = (message) => {
    return ImageGenerationService.detectImageRequest(message);
  };

  const shouldUseRagForInput = (input) => {
    if (!input || typeof input !== 'string') return false;
    const normalized = input.toLowerCase();
    const triggers = [
      'orion', 'deepernova', 'deeper nova', 'misi', 'visi', 'fitur', 'produk',
      'tim', 'donasi', 'panduan', 'dokumen', 'manual', 'spesifikasi', 'roadmap',
      'knowledge base', 'pengetahuan', 'layanan', 'kebijakan', 'harga', 'company',
      'team', 'founder', 'cara kerja', 'apa itu'
    ];
    return triggers.some(term => normalized.includes(term));
  };

  /**
   * Call the web search endpoint
   * Returns: { success, answer, searchResults, error }
   */


  const handleSendMessage = async (e) => {
    console.log('[DEBUG] handleSendMessage called with e:', e);
    e.preventDefault();

    // Check if there's any message content to send (regular text OR text queue OR uploaded images OR uploaded files)
    const hasRegularText = inputValue.trim().length > 0;
    const hasQueuedText = textQueue.length > 0;
    const hasUploadedImages = uploadedImages.length > 0;
    const hasUploadedFiles = uploadedFiles.length > 0;

    console.log('[DEBUG] hasRegularText:', hasRegularText, 'inputValue:', inputValue);
    console.log('[DEBUG] hasQueuedText:', hasQueuedText, 'hasUploadedImages:', hasUploadedImages, 'hasUploadedFiles:', hasUploadedFiles);

    if (!hasRegularText && !hasQueuedText && !hasUploadedImages && !hasUploadedFiles) {
      console.log('[DEBUG] No content to send, returning');
      return;
    }

    // Analyze uploaded images first (non-blocking, runs in background)
    let analysisResults = {};
    if (uploadedImages.length > 0) {
      analysisResults = await analyzeUploadedImages();
    }

    const imagesToActivate = uploadedImages.map(img => ({
      ...img,
      followUpRemaining: img.followUpRemaining != null ? img.followUpRemaining : 20,
      activatedAt: Date.now(),
    }));
    const mergedFollowUpsMap = new Map();
    [...activeImageFollowUps, ...imagesToActivate].forEach(img => {
      if (!mergedFollowUpsMap.has(img.id)) {
        mergedFollowUpsMap.set(img.id, img);
      }
    });
    const combinedFollowUps = Array.from(mergedFollowUpsMap.values());

    const buildImageFollowUpContext = (images) => {
      if (!images || images.length === 0) return '';
      return images.map(img => {
        const remaining = img.followUpRemaining != null ? img.followUpRemaining : 20;
        const summary = img.analysis
          ? img.analysis
          : userLanguage === 'id'
            ? 'Analisis gambar masih diproses, tetapi ini akan digunakan sebagai referensi visual untuk respons berikutnya.'
            : 'Image analysis is still processing, but this will be used as a visual reference for the next responses.';
        return `📸 [${img.fileName}] (${remaining} ${userLanguage === 'id' ? 'pertanyaan tersisa' : 'questions left'})\n${summary}`;
      }).join('\n\n');
    };

    // Combine message with uploaded file contents
    let fullMessage = inputValue;
    
    // Auto-include pasted text items from queue
    if (textQueue.length > 0) {
      const textContents = textQueue
        .map(item => `[SALINAN TEKS]:\n${item.content}`)
        .join('\n\n');
      fullMessage = inputValue 
        ? `${inputValue}\n\n${textContents}`
        : textContents;
    }
    
    // Auto-include analyzed images if any exist
    if (uploadedImages.length > 0) {
      // Use results from analyzeUploadedImages(), plus any existing image.analysis state
      const imageContexts = uploadedImages
        .map(img => {
          const analysisText = analysisResults[img.id] || img.analysis || (userLanguage === 'id'
            ? 'Analisis gambar masih diproses, tetapi ini akan digunakan sebagai referensi visual untuk respons berikutnya.'
            : 'Image analysis is still processing, but this will be used as a visual reference for the next responses.');
          return `📸 [${img.fileName}]\n${analysisText}`;
        })
        .join('\n\n');
      fullMessage = `${fullMessage}\n\n[ANALISIS GAMBAR DARI QWEN3-VL]\n${imageContexts}`;
    }
    
    // Auto-include uploaded files if any exist
    if (uploadedFiles.length > 0) {
      const fileContents = uploadedFiles
        .map(f => `📄 ${f.name}:\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n');
      fullMessage = `${fullMessage}\n\n[UPLOADED FILES]\n${fileContents}`;
    }

    // Add reason instruction if reason mode is enabled
    if (isReasonMode) {
      fullMessage = `${fullMessage}

---REASONING MODE ACTIVE---
INSTRUKSI PENTING: Berikan jawaban dalam format berikut:

<reasoning>
Penjelasan langkah demi langkah tentang bagaimana Anda memproses dan menjawab pertanyaan ini. Tuliskan pemikiran, analisis, dan pertimbangan Anda di sini.
</reasoning>

Setelah section <reasoning>, tuliskan jawaban lengkap Anda.

Pastikan selalu gunakan tags <reasoning></reasoning> yang tepat.`;
    }

    // Auto-include follow-up image context for active images
    const activeImageContext = buildImageFollowUpContext(combinedFollowUps);
    if (activeImageContext) {
      fullMessage = `${fullMessage}\n\n[ANALISIS GAMBAR TERUSAN]\n${activeImageContext}`;
    }

    // Retrieve relevant context from RAG knowledge base only for queries that appear domain-specific
    let ragContext = '';
    if (shouldUseRagForInput(inputValue)) {
      const ragResults = ragService.searchWithScores(inputValue, 3, 'knowledge_base');
      const relevantResults = ragResults.filter(item => item.score > 0.75);
      if (relevantResults.length > 0) {
        ragContext = ragService.formatContextForPrompt(relevantResults, 1000);
      } else {
        console.log('[ChatBot] RAG search skipped because no high-confidence knowledge base docs found.');
      }
    } else {
      console.log('[ChatBot] Skipping RAG injection for non-domain query.');
    }

    const combinedContext = ragContext.trim() ? ragContext : '';
    if (combinedContext) {
      fullMessage = `${fullMessage}\n\n${combinedContext}`;
    }

    // STRICT ENFORCEMENT: Prevent concurrent processing - MUST check BEFORE early return
    if (isProcessingRef.current) {
      console.log('[ChatBot] ⚠️ BLOCKED: Already processing a response. Please wait for current response to complete.');
      return;
    }
    
    // SET LOCK IMMEDIATELY - this prevents any other execution path from starting
    isProcessingRef.current = true;
    console.log('[ChatBot] 🔒 Processing lock activated - 1 prompt = 1 response enforced');

    // Declare placeholderId early so it's available in all code paths and catch block
    let placeholderId = null;

    try {
      // Note: Image generation detection moved to AI side
      // AI will now decide if generation is needed and respond with [IMAGE_REQUEST: prompt]

      // TEXT RESPONSE PATH - lock is already set, only text will execute
      // Clear input and files
      setInputValue('');
      setUploadedFiles([]);
      setTextQueue([]);
      if (globalThis.textareaRef) {
        globalThis.textareaRef.style.height = 'auto';
      }

      // Activate uploaded images for follow-up analysis and hide the queue UI
      if (imagesToActivate.length > 0) {
        setActiveImageFollowUps(prev => {
          const combined = [...prev, ...imagesToActivate];
          const unique = [];
          const seen = new Set();
          combined.forEach(img => {
            if (!seen.has(img.id)) {
              seen.add(img.id);
              unique.push(img);
            }
          });
          return unique;
        });
        setUploadedImages([]);
        setAttachmentQueueMinimized(true);
        if (currentConversationId) {
          localStorage.removeItem(`deepernova_images_${currentConversationId}`);
        }
      }
      
      // Decrement follow-up counter for active images after this prompt
      if (combinedFollowUps.length > 0) {
        const updatedFollowUps = combinedFollowUps
          .map(img => ({
            ...img,
            followUpRemaining: Math.max(0, (img.followUpRemaining != null ? img.followUpRemaining : 20) - 1),
          }))
          .filter(img => img.followUpRemaining > 0);
        setActiveImageFollowUps(updatedFollowUps);
      }

      // Add user message to chat display
      const userMessageForChat = {
        id: Date.now(),
        text: inputValue,
        sender: 'user',
        timestamp: new Date(),
        files: uploadedFiles.length > 0 ? uploadedFiles : null,
        textQueue: textQueue.length > 0 ? textQueue : null,
        images: uploadedImages.length > 0 ? uploadedImages : null,
      };

      setMessages((prev) => [...prev, userMessageForChat]);
      setCompactView(true);
      
      // Create bot placeholder for streaming response
      placeholderId = createBotPlaceholder();
      currentMessageIdRef.current = placeholderId;
      lastSentPromptRef.current = inputValue;
      lastSentUserMessageIdRef.current = userMessageForChat.id;
      
      // Start tracking time for status messages - from the moment user sends message
      streamingStartTimeRef.current = Date.now();
      const _isMarketQuery = /\bekonomi\b|ekonomi hari ini|ekonomi terkini|ekonomi global|ekonomi sekarang|pasar hari ini|market hari ini|saham|market|inflasi|suku bunga|cpi|gdp|emas|gold|oil|minyak|bank|forex|usd|dollar/i.test(fullMessage);
    
    // Status messages that change based on elapsed time - longer intervals for believability
    // Pre-calculate random delays for consistency
    const statusMessages = [
      { time: 2000, msg: userLanguage === 'id' ? 'membaca pertanyaan...' : 'reading question...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 4000, msg: userLanguage === 'id' ? 'memproses konteks...' : 'processing context...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 7000, msg: userLanguage === 'id' ? 'menganalisis informasi...' : 'analyzing information...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 10000, msg: userLanguage === 'id' ? 'sedang berpikir...' : 'thinking...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 13000, msg: userLanguage === 'id' ? 'menghitung respons...' : 'calculating response...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 16000, msg: userLanguage === 'id' ? 'menyusun jawaban...' : 'composing answer...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 19000, msg: userLanguage === 'id' ? 'memvalidasi data...' : 'validating data...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 22000, msg: userLanguage === 'id' ? 'mengorganisir informasi...' : 'organizing information...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 25000, msg: userLanguage === 'id' ? 'menyiapkan output...' : 'preparing output...', randomDelay: (Math.random() - 0.5) * 800 },
      { time: 28000, msg: userLanguage === 'id' ? 'finalisasi respons...' : 'finalizing response...', randomDelay: (Math.random() - 0.5) * 800 },
    ];
    
    // Set up status update interval
    if (statusUpdateIntervalRef.current) {
      clearInterval(statusUpdateIntervalRef.current);
    }
    
    statusUpdateIntervalRef.current = setInterval(() => {
      if (streamingStartTimeRef.current) {
        const elapsed = Date.now() - streamingStartTimeRef.current;
        let matchedMsg = '';
        
        for (let i = statusMessages.length - 1; i >= 0; i--) {
          // Use the pre-calculated random delay for consistency
          if (elapsed > statusMessages[i].time + statusMessages[i].randomDelay) {
            matchedMsg = statusMessages[i].msg;
            break;
          }
        }
        
        setLoadingStatusMsg(matchedMsg);
      }
    }, 500); // Check every 500ms for smooth updates
    
    setConvLoading(true);
    setError(null);
    setIsScrolledUp(false); // Hide scroll button
    
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    // Store controller per conversation so it survives room switches
    if (currentConversationId) {
      abortControllersMapRef.current.set(currentConversationId, abortController);
    }
    
    // SCROLL PERTAMA - langsung setelah user message ditambah
    // Ensure auto-scroll isn't being held
    holdScrollRef.current = false;
    setTimeout(() => {
      try {
        const scrollEl = document.querySelector('.messages-container');
        const msgEl = document.querySelector(`[data-msg-id="${userMessageForChat.id}"]`);
        if (msgEl && scrollEl) {
          // Add large spacer so the area below appears empty for generation
          try { scrollEl.classList.add('prefill-space'); } catch (_e) {
            // ignore
          }
          // Align the new user message to the top of the viewport so the empty area appears below
          msgEl.scrollIntoView({ behavior: 'auto', block: 'start' });
          // Clamp scrollTop so we don't exceed available scroll range
          const maxTop = scrollEl.scrollHeight - scrollEl.clientHeight;
          if (scrollEl.scrollTop > maxTop) scrollEl.scrollTop = maxTop;
        } else {
          // Fallback to force-bottom if element not found
          scrollToBottom(true);
          setTimeout(() => scrollToBottom(true), 10);
        }
      } catch (err) {
        console.log('Initial scroll error:', err);
        scrollToBottom(true);
      }
    }, 0);

      // Send to Orion AI with conversation history for advanced context
      // Use fullMessage (with file contents) instead of inputValue
      // Capture conversationId NOW so it's used in streaming callback, not currentConversationId (which can change)
      const streamingConversationId = currentConversationId;
      
      const response = await sendMessageToGrok(fullMessage, messages, userLanguage, streamingConversationId, selectedPersonality, abortController, selectedModel, isAuthenticated, isGuest, userName || user?.name, isReasonMode);

      // Process streaming response - do NOT start local simulated streaming
      // Keep the placeholder and show the empty area below the user's message.
      // Add prefill-space to indicate the area reserved for the AI response
      const scrollElForPrefill = document.querySelector('.messages-container');
      if (scrollElForPrefill) {
        try {
          scrollElForPrefill.classList.add('prefill-space');
          // Do NOT call scrollToBottom here — keep the viewport so the empty area is visible
        } catch (e) {
          console.log('Error adding prefill-space:', e);
        }
      }

      // Declare accumulatedText here so it can be used after streaming completes
      let accumulatedText = '';
      let chunkQueue = [];
      let isProcessingChunks = false;
      const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120; // Delay antara chunks untuk non-reasoning (ms)

      const processQueuedChunks = async () => {
        if (isProcessingChunks || chunkQueue.length === 0) return;
        isProcessingChunks = true;

        while (chunkQueue.length > 0) {
          const chunk = chunkQueue.shift();
          
          // Handle stepper-type updates (skip from text accumulation)
          if (typeof chunk === 'object' && chunk.type === 'stepper') {
            // Update stepper progress state
            setAgenticSteppers((prev) => {
              const stepped = prev[placeholderId] || [];
              const existingStepIdx = stepped.findIndex(s => s.stepNumber === chunk.stepNumber);
              if (existingStepIdx >= 0) {
                // Update existing step
                const updated = [...stepped];
                updated[existingStepIdx] = chunk;
                return { ...prev, [placeholderId]: updated };
              } else {
                // Add new step
                return { ...prev, [placeholderId]: [...stepped, chunk] };
              }
            });
            continue; // Don't process stepper as text
          }
          
          // Handle regular text chunks
          if (typeof chunk === 'string') {
            const visibleChunk = removeExecutionLogLines(chunk);
            if (visibleChunk.trim()) {
              // Update the message in real-time as chunks arrive without forcing auto-scroll
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === placeholderId
                    ? { ...msg, text: msg.text + visibleChunk }
                    : msg
                )
              );
            }

            // Deteksi apakah sedang di dalam reasoning tag
            const isInReasoning = isReasoningChunk(accumulatedText, chunk);
            
            // Delay hanya untuk non-reasoning chunks
            if (!isInReasoning && chunkQueue.length > 0) {
              await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
            }
          }
        }

        isProcessingChunks = false;
      };

      // Process streaming response - chunks come in real-time
      await processStreamingResponse(response, (chunk) => {
        // Handle stepper-type updates (don't accumulate as text)
        if (typeof chunk === 'object' && chunk.type === 'stepper') {
          chunkQueue.push(chunk);
          processQueuedChunks();
          return;
        }
        
        // Handle regular text chunks
        if (typeof chunk === 'string') {
          accumulatedText += chunk;
          chunkQueue.push(chunk);
          processQueuedChunks();

          // Parse execution flow steps in real-time from accumulated text
          const currentSteps = parseExecutionStep(accumulatedText);
          if (currentSteps && currentSteps.length > 0) {
            setExecutionFlows((prev) => ({
              ...prev,
              [placeholderId]: {
                steps: currentSteps,
                isComplete: false,
                totalTime: Date.now() - streamingStartTimeRef.current,
                title: "🤖 Orion berfikir..."
              }
            }));
          }

          // Extract reasoning from accumulated text for live popup
          if (isReasonMode) {
            const reasoningMatch = accumulatedText.match(/<reasoning>([\s\S]*?)<\/?reasoning>/i);
            if (reasoningMatch) {
              const reasoning = reasoningMatch[1].trim();
              if (reasoning) {
                setReasoningPopupText(reasoning);
                setShowReasoningPopup(true);
              }
            } else if (accumulatedText.includes('<reasoning>') && !accumulatedText.includes('</reasoning>')) {
              // Still inside reasoning tag - show partial content
              const partialMatch = accumulatedText.match(/<reasoning>([\s\S]*)$/i);
              if (partialMatch) {
                const partial = partialMatch[1].trim();
                if (partial) {
                  setReasoningPopupText(partial);
                  setShowReasoningPopup(true);
                }
              }
            }
          }
        }
        // Do not auto-scroll here; keep the blank area stable while generating
      }, abortController.signal);

      // Tunggu sampai semua chunks selesai diproses
      while (chunkQueue.length > 0 || isProcessingChunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      // Hide reasoning popup after streaming completes
      setShowReasoningPopup(false);
      setReasoningPopupText('');
      
      // Remove prefill-space setelah streaming selesai
      const scrollEl = document.querySelector('.messages-container');
      if (scrollEl) {
        try {
          scrollEl.classList.remove('prefill-space');
        } catch (e) {
          console.log('Error removing prefill-space:', e);
        }
      }
      // Scroll to bottom to reveal the completed AI response
      try {
        // Hold auto-scroll briefly so view doesn't jump unexpectedly
        holdScrollRef.current = true;
        scrollToBottom(true);
        setTimeout(() => scrollToBottom(true), 50);
        setTimeout(() => { holdScrollRef.current = false; }, 1200);
      } catch (e) {
        console.log('Error scrolling after streaming:', e);
      }
      
      // Parse execution flow steps from accumulated text for agentic requests
      const executionSteps = parseExecutionStep(accumulatedText);
      if (executionSteps && executionSteps.length > 0) {
        setExecutionFlows((prev) => ({
          ...prev,
          [placeholderId]: {
            steps: executionSteps,
            isComplete: true,
            totalTime: Date.now() - streamingStartTimeRef.current,
            title: "🤖 Orion selesai berfikir"
          }
        }));
      }
      
      // ✨ AI Self-Trigger Agent Detection
      // Parse [AGENT_EXECUTE: task_description] flag from response
      const agentExecuteMatch = accumulatedText.match(/\[AGENT_EXECUTE:\s*([^\]]+)\]/);
      if (agentExecuteMatch) {
        const agentTaskDescription = agentExecuteMatch[1].trim();
        console.log(`[ChatBot] 🤖 AI triggered agent execution: "${agentTaskDescription}"`);
        
        // Remove the flag from displayed text
        const cleanedText = accumulatedText.replace(/\s*\[AGENT_EXECUTE:[^\]]*\]/, '').trim();
        
        // Update message with cleaned text (without flag)
        setMessages((prevMessages) => {
          const updatedMessages = [...prevMessages];
          const msgIndex = updatedMessages.findIndex(m => m.id === placeholderId);
          if (msgIndex !== -1) {
            updatedMessages[msgIndex] = {
              ...updatedMessages[msgIndex],
              text: cleanedText
            };
          }
          return updatedMessages;
        });
        
        // Queue agent execution asynchronously to avoid blocking
        setTimeout(async () => {
          // Track background agent tasks to avoid showing premature error banners
          backgroundAgentCountRef.current += 1;
          try {
            console.log(`[ChatBot] Executing agent task: ${agentTaskDescription}`);
            const userId = user?.id || 'guest';
            
            // Call agent endpoint
            const response = await fetch('/api/agent/execute', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                task: agentTaskDescription,
                userId: userId
              })
            });
            
            if (!response.ok) {
              console.error(`Agent execution failed: ${response.status}`);
              return;
            }
            
            const result = await response.json();
            console.log(`[ChatBot] Agent execution completed:`, result);
            
            // If file was generated, add download link to message
            if (result.success && result.fileName && result.downloadUrl) {
              setMessages((prevMessages) => {
                const updatedMessages = [...prevMessages];
                const msgIndex = updatedMessages.findIndex(m => m.id === placeholderId);
                if (msgIndex !== -1) {
                  updatedMessages[msgIndex] = {
                    ...updatedMessages[msgIndex],
                    downloadUrl: result.downloadUrl,
                    fileName: result.fileName,
                    agentResult: result
                  };
                }
                return updatedMessages;
              });
            }
          } catch (err) {
            console.error('[ChatBot] Agent execution error:', err);
          } finally {
            backgroundAgentCountRef.current = Math.max(0, backgroundAgentCountRef.current - 1);
          }
        }, 500);
      }
      
      // Mark message as finished streaming
      finishStreaming(placeholderId);
      
      setAnimatingMessages((prev) => ({ ...prev, [placeholderId]: false }));
      setLastMessage(null);
      setLoading(false);
      setConvLoading(false); // Mark this conversation as done loading
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }

      // Immediate save after response completes
      const saveAfterResponse = async () => {
        console.log(`[ChatBot] Saving conversation after response completed`);
        await ConversationPersistenceService.saveConversations(conversations, isAuthenticated, isGuest);
      };
      setTimeout(() => saveAfterResponse(), 100);

      // Clear uploaded files and images, then minimize image queue
      setTimeout(() => {
        setUploadedFiles([]);
        setUploadedImages([]);
        setAttachmentQueueMinimized(true);
        // Also clear from localStorage
        if (currentConversationId) {
          localStorage.removeItem(`deepernova_images_${currentConversationId}`);
        }
      }, 200);

      // After successful finish, keep compact view focused (at bottom)
      setCompactView(true);

      // Check if the user's original message contains a document generation request
      const docRequest = checkForDocumentRequest(userMessageForChat.text);
      if (docRequest && accumulatedText && accumulatedText.length > 100) {
        console.log(`[ChatBot] Document request detected: ${docRequest.type}`);
        // Schedule document generation modal to appear after a brief delay
        setTimeout(() => {
          triggerDocumentGeneration(accumulatedText, docRequest.type, docRequest.title);
        }, 500);
      }

      // Check if AI response contains IMAGE_REQUEST
      // Format: [IMAGE_REQUEST: detailed_description]
      const imageRequestMatch = accumulatedText.match(/\[IMAGE_REQUEST:\s*(.+?)\]/);
      if (imageRequestMatch && imageRequestMatch[1]) {
        const imagePrompt = imageRequestMatch[1].trim();
        console.log(`[ChatBot] 🎨 IMAGE_REQUEST detected from AI: ${imagePrompt}`);
        
        // Clean the response text - remove the [IMAGE_REQUEST: ...] part
        const cleanedText = accumulatedText.replace(/\[IMAGE_REQUEST:\s*.+?\]\s*/g, '').trim();
        const displayText = cleanedText || '🎨 Sedang membuat gambar...';
        
        // Update the bot message with cleaned text only if there is actual content;
        // otherwise keep the placeholder text visible so the bubble is not blank.
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === placeholderId
              ? { ...msg, text: displayText }
              : msg
          )
        );
        
        // Generate the image with the extracted prompt
        console.log('[ChatBot] Triggering image generation with AI-determined prompt...');
        try {
          const imageRequest = {
            type: 'image',
            prompt: imagePrompt,
            size: '1024x1024',
            detected: true
          };
          
          // Create a synthetic user message that triggered the image
          const syntheticMessage = {
            id: Date.now() + '_synth',
            text: `[Generated by AI request]`,
            sender: 'user',
            timestamp: new Date(),
          };
          
          // Use the image generation handler
          await handleInlineImageGeneration(imageRequest, syntheticMessage);
          console.log('[ChatBot] ✅ AI-triggered image generation complete');
        } catch (err) {
          console.error('[ChatBot] Error generating image from AI request:', err);
        }
      }

      // Process and store memories from this interaction
      memoryService.processConversation([...messages, userMessageForChat], currentConversationId, userLanguage);

      // Generate AI-powered chat title after first response
      const titleConvId = currentConversationId;
      setTimeout(() => {
        if (titleConvId) {
          generateChatTitle(titleConvId);
          // Load sources for display
          loadSourcesForConversation(titleConvId);
        }
      }, 500);
      
      // Reset auto-retry counter on success
      autoRetryCountRef.current = 0;
    } catch (err) {
      if (err.name === 'AbortError') {
        showErrorBanner('Permintaan dihentikan.');
        autoRetryCountRef.current = 0;
      } else {
        // Only store placeholderId if it was created (not in image request path)
        if (placeholderId) {
          partialMessageIdRef.current = placeholderId;
        }
        
        // Auto-retry with exponential backoff (hidden from user)
        if (autoRetryCountRef.current < MAX_AUTO_RETRY) {
          autoRetryCountRef.current += 1;
          const delayMs = 1000 * autoRetryCountRef.current; // 1s, 2s, 3s
          
          console.log(`[Auto-Retry] Attempt ${autoRetryCountRef.current}/${MAX_AUTO_RETRY} in ${delayMs}ms`);
          
          // Clear any existing timeout
          if (autoRetryTimeoutRef.current) {
            clearTimeout(autoRetryTimeoutRef.current);
          }
          
          // Auto-retry without showing error banner
          autoRetryTimeoutRef.current = setTimeout(() => {
            console.log(`[Auto-Retry] Retrying now...`);
            handleRetryAuto(); // Use separate function for auto-retry
          }, delayMs);
          
          setConvLoading(false);
          // Don't show error, just let it retry silently
          setError(null);
        } else {
          // After max retries, show error and let user manually click Continue
          showErrorBanner(`Gagal setelah ${MAX_AUTO_RETRY} percobaan. Klik Continue untuk melanjutkan.`);
          autoRetryCountRef.current = 0;
          setConvLoading(false);
        }
      }
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }
    } finally {
      // CRITICAL: Always clear the processing lock
      // This ensures 1 prompt = 1 response is enforced
      isProcessingRef.current = false;
      console.log('[ChatBot] 🔓 Processing lock cleared - ready for next message');
    }
  };

  const handleRetry = async () => {
    if (!lastMessage && !partialMessageIdRef.current) return;

    setError(null);
    setConvLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    // Store controller per conversation
    if (currentConversationId) {
      abortControllersMapRef.current.set(currentConversationId, abortController);
    }

    // Capture conversationId NOW so streaming callback uses the right conversation
    const streamingConversationId = currentConversationId;

    try {
      // If continuing from partial response, send continuation prompt
      if (partialMessageIdRef.current) {
        const continuePrompt = `[Lanjutkan dari mana tadi, jangan ulangi pesan sebelumnya, hanya lanjutkan teks berikutnya]`;
        const response = await sendMessageToGrok(continuePrompt, messages, userLanguage, streamingConversationId, selectedPersonality, abortController, selectedModel, isAuthenticated, isGuest, userName || user?.name, isReasonMode);
        const msgId = partialMessageIdRef.current;

        let accumulatedRetryText = '';
        let retryChunkQueue = [];
        let isProcessingRetryChunks = false;
        const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120;

        const processRetryQueuedChunks = async () => {
          if (isProcessingRetryChunks || retryChunkQueue.length === 0) return;
          isProcessingRetryChunks = true;

          while (retryChunkQueue.length > 0) {
            const chunk = retryChunkQueue.shift();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === msgId
                  ? { ...msg, text: msg.text + chunk, isStreaming: true }
                  : msg
              )
            );
            const isInReasoning = isReasoningChunk(accumulatedRetryText, chunk);
            if (!isInReasoning && retryChunkQueue.length > 0) {
              await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
            }
          }
          isProcessingRetryChunks = false;
        };

        await processStreamingResponse(response, (chunk) => {
          accumulatedRetryText += chunk;
          retryChunkQueue.push(chunk);
          processRetryQueuedChunks();
        }, abortController.signal);

        while (retryChunkQueue.length > 0 || isProcessingRetryChunks) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        finishStreaming(msgId);

        partialMessageIdRef.current = null;
        // Keep compact focus when continuing partial responses
        setCompactView(true);
      } else {
        // Full retry for non-partial errors
        const response = await sendMessageToGrok(lastMessage, messages, userLanguage, streamingConversationId, selectedPersonality, abortController, selectedModel, isAuthenticated, isGuest, userName || user?.name, isReasonMode);
        const placeholderId = createBotPlaceholder();
        currentMessageIdRef.current = placeholderId;

        let accumulatedFullRetryText = '';
        let fullRetryChunkQueue = [];
        let isProcessingFullRetryChunks = false;
        const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120;

        const processFullRetryQueuedChunks = async () => {
          if (isProcessingFullRetryChunks || fullRetryChunkQueue.length === 0) return;
          isProcessingFullRetryChunks = true;

          while (fullRetryChunkQueue.length > 0) {
            const chunk = fullRetryChunkQueue.shift();
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === placeholderId
                  ? { ...msg, text: msg.text + chunk }
                  : msg
              )
            );
            const isInReasoning = isReasoningChunk(accumulatedFullRetryText, chunk);
            if (!isInReasoning && fullRetryChunkQueue.length > 0) {
              await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
            }
          }

          isProcessingFullRetryChunks = false;
        };

        await processStreamingResponse(response, (chunk) => {
          accumulatedFullRetryText += chunk;
          fullRetryChunkQueue.push(chunk);
          processFullRetryQueuedChunks();
        }, abortController.signal);

        while (fullRetryChunkQueue.length > 0 || isProcessingFullRetryChunks) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

        finishStreaming(placeholderId);
      }

      setConvLoading(false);
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }
      setLastMessage(null);
    } catch (err) {
      if (err.name !== 'AbortError') {
        showErrorBanner(`Gagal: ${err.message}. Klik Continue untuk coba lagi.`);
      }
      setConvLoading(false);
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }
    }
  };

  // Auto-retry function (called automatically, no user interaction needed)
  const handleRetryAuto = async () => {
    if (!partialMessageIdRef.current) return;

    setConvLoading(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    // Store controller per conversation
    if (currentConversationId) {
      abortControllersMapRef.current.set(currentConversationId, abortController);
    }

    // Capture conversationId NOW so streaming callback uses the right conversation
    const streamingConversationId = currentConversationId;

    try {
      // Continue from partial response (same as handleRetry but without user error message)
      const continuePrompt = `[Lanjutkan dari mana tadi, jangan ulangi pesan sebelumnya, hanya lanjutkan teks berikutnya]`;
      const response = await sendMessageToGrok(continuePrompt, messages, userLanguage, streamingConversationId, selectedPersonality, abortController, selectedModel, isAuthenticated, isGuest, userName || user?.name, isReasonMode);
      const msgId = partialMessageIdRef.current;

      let accumulatedAutoRetryText = '';
      let autoRetryChunkQueue = [];
      let isProcessingAutoRetryChunks = false;
      const CHUNK_DELAY_MS = selectedModel === 'deepernova-1.2-flash' ? 650 : 120;

      const processAutoRetryQueuedChunks = async () => {
        if (isProcessingAutoRetryChunks || autoRetryChunkQueue.length === 0) return;
        isProcessingAutoRetryChunks = true;

        while (autoRetryChunkQueue.length > 0) {
          const chunk = autoRetryChunkQueue.shift();
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === msgId
                ? { ...msg, text: msg.text + chunk, isStreaming: true }
                : msg
          )
        );
          const isInReasoning = isReasoningChunk(accumulatedAutoRetryText, chunk);
          if (!isInReasoning && autoRetryChunkQueue.length > 0) {
            await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY_MS));
          }
        }
        isProcessingAutoRetryChunks = false;
      };

      await processStreamingResponse(response, (chunk) => {
        accumulatedAutoRetryText += chunk;
        autoRetryChunkQueue.push(chunk);
        processAutoRetryQueuedChunks();
      }, abortController.signal);

      while (autoRetryChunkQueue.length > 0 || isProcessingAutoRetryChunks) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      finishStreaming(msgId);

      partialMessageIdRef.current = null;
      setLoading(false);
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }
      
      // Reset auto-retry counter on success
      autoRetryCountRef.current = 0;
    } catch (err) {
      // If auto-retry fails again, let the main error handler deal with it
      if (err.name !== 'AbortError') {
        console.error('[Auto-Retry Failed]', err.message);
      }
      setLoading(false);
      abortControllerRef.current = null;
      // Clean up conversation-specific abort controller
      if (currentConversationId) {
        abortControllersMapRef.current.delete(currentConversationId);
      }
      
      // Trigger another auto-retry via the main error handler logic
      // This will be handled by the next attempt
    }
  };

  const memoizedMessageList = useMemo(() => {
    if (messages.length === 0) {
      const displayGreeting = generatingGreeting ? '' : (aiGreeting || getTimeBasedGreeting(userName || user?.name));
      const displayHint = generatingGreeting ? '' : (aiHint || FALLBACK_GREETINGS.hint);
      
      return (
        <div className="welcome-message">
          {displayGreeting ? <h2>{displayGreeting}</h2> : null}
          {displayHint ? <p className="welcome-hint">{displayHint}</p> : null}
          {generatingGreeting && <p style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>Menyiapkan salam...</p>}
        </div>
      );
    }

    return messages.map((message, index) => {
      const isLastMessage = index === messages.length - 1;
      const shouldHideByCompact = compactView && !isScrolledUp && messages.length > 0 && (() => {
        let userIdx = -1;
        for (let i = messages.length - 1; i >= 0; i--) {
          if (messages[i].sender === 'user') {
            userIdx = i;
            break;
          }
        }
        return index < userIdx;
      })();

      return (
        <div
          key={index}
          data-msg-id={message.id}
          className={`message ${message.sender}${shouldHideByCompact ? ' hidden-by-compact' : ''}${message.sender === 'user' && expandedUserMessageId === message.id ? ' expanded' : ''}`}
          onMouseDown={() => handleMessageMouseDown(message.id, message.text, message.sender === 'user')}
          onMouseUp={handleMessageMouseUp}
          onTouchStart={() => handleMessageMouseDown(message.id, message.text, message.sender === 'user')}
          onTouchEnd={handleMessageMouseUp}
          style={{ marginBottom: message.sender === 'user' && !expandedUserMessageId === message.id ? '32px' : '0' }}
        >
          <div className="message-content">
            {message.isImage && (
              <>
                {message.isThinking ? (
                  <div className="image-thinking-state">
                    <div className="spinner"></div>
                    <div className="thinking-text">{message.text}</div>
                  </div>
                ) : (
                  <>
                    {message.text && message.text.includes('<reasoning>') ? (() => {
                      const reasoningMatch = message.text.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
                      const reasoning = reasoningMatch ? reasoningMatch[1] : '';
                      return (
                        <>
                          <button
                            className="reasoning-collapsed-text"
                            onClick={() => setExpandedReasoningId(expandedReasoningId === message.id ? null : message.id)}
                            title="Klik untuk lihat reasoning lengkap"
                          >
                            💭 Ngedumel selama {message.generationTime || 0}s
                          </button>
                          {expandedReasoningId === message.id && (
                            <div className="message-reasoning">
                              <div className="reasoning-window">
                                <div
                                  className="reasoning-window-body"
                                  ref={(el) => {
                                    if (el) {
                                      setTimeout(() => {
                                        el.scrollTop = el.scrollHeight;
                                      }, 0);
                                    }
                                  }}
                                >
                                  {formatMessageText(reasoning, false, message.id)}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })() : null}
                    {message.imageUrl && (
                      <div className="message-image-container">
                        <img
                          src={message.imageUrl}
                          alt="Generated Image"
                          className="message-image"
                          onClick={() => handleImageClick(message.imageUrl, 'Generated Image', message.imageId)}
                          style={{
                            maxWidth: '100%',
                            maxHeight: '400px',
                            borderRadius: '8px',
                            marginTop: '12px',
                            cursor: 'pointer',
                            transition: 'transform 0.2s ease',
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.02)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                          title={userLanguage === 'id' ? 'Klik untuk membesar' : 'Click to enlarge'}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}
            {message.sender === 'bot' && !message.isImage && (() => {
              const { reasoning, mainContent } = extractReasoningContent(message.text);
              const stepper = agenticSteppers[message.id]; // Get stepper progress for this message
              const execFlow = executionFlows[message.id]; // Get execution flow for this message
              
              return (
                <>
                  {execFlow && execFlow.steps && execFlow.steps.length > 0 && (
                    <ExecutionFlow 
                      steps={execFlow.steps}
                      isComplete={execFlow.isComplete}
                      totalTime={execFlow.totalTime}
                      title={execFlow.title || "🤖 Orion berfikir..."}
                    />
                  )}
                  {stepper && stepper.length > 0 && (
                    <StepperComponent steps={stepper} />
                  )}
                  {reasoning && (
                    message.isStreaming ? (
                      <div className="message-reasoning">
                        <div className="reasoning-window">
                          <div
                            className="reasoning-window-body"
                            ref={(el) => {
                              if (el) {
                                setTimeout(() => {
                                  el.scrollTop = el.scrollHeight;
                                }, 0);
                              }
                            }}
                          >
                            {formatMessageText(reasoning, message.isStreaming, message.id)}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="reasoning-collapsed-text"
                        onClick={() => setExpandedReasoningId(expandedReasoningId === message.id ? null : message.id)}
                        title="Klik untuk lihat reasoning lengkap"
                      >
                        💭 Ngedumel mikir selama {message.reasoningDuration || 0}s
                      </button>
                    )
                  )}
                  {mainContent ? formatMessageText(mainContent, message.isStreaming, message.id) : null}
                  {!reasoning && !mainContent && formatMessageText(message.text, message.isStreaming, message.id)}
                </>
              );
            })()}
            {message.sender === 'user' && (() => {
              const words = message.text.split(/\s+/);
              const isExpanded = expandedUserMessageId === message.id;
              const shouldTruncate = words.length > 10 && !isExpanded;
              const displayText = shouldTruncate
                ? words.slice(0, 10).join(' ') + '...'
                : message.text;
              return (
                <>
                  {formatMessageText(displayText, false, message.id)}
                  {words.length > 10 && (
                    <button
                      className="user-message-expand-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedUserMessageId(expandedUserMessageId === message.id ? null : message.id);
                      }}
                      title={isExpanded ? 'Perkecil' : 'Tampilkan lebih'}
                    >
                      {isExpanded ? '⬅' : '➜'}
                    </button>
                  )}
                </>
              );
            })()}
            {message.downloadUrl && message.fileName && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                backgroundColor: 'rgba(100, 200, 255, 0.1)',
                borderRadius: '8px',
                border: '1px solid rgba(100, 200, 255, 0.3)'
              }}>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = message.downloadUrl;
                    link.download = message.fileName;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#45a049'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#4CAF50'}
                >
                  📥 Download: {message.fileName}
                </button>
                {message.downloadSummary && (
                  <div style={{
                    marginTop: '8px',
                    fontSize: '13px',
                    color: '#1f2937',
                    opacity: 0.85
                  }}>
                    {message.downloadSummary}
                  </div>
                )}
              </div>
            )}
            {message.files && message.files.length > 0 && (
              <div className="message-files">
                {message.files.map((file) => (
                  <div key={file.id} className="message-file-chip">
                    📎 {file.name}
                  </div>
                ))}
              </div>
            )}
            {message.images && message.images.length > 0 && (
              <div className="message-images">
                {message.images.map((image) => (
                  <div key={image.id} className="message-image-chip">
                    <img
                      src={image.dataUrl}
                      alt={image.fileName}
                      className="message-image-thumbnail"
                      onClick={() => handleImageClick(image.dataUrl, image.fileName, image.id)}
                      title={userLanguage === 'id' ? 'Klik untuk membesar' : 'Click to enlarge'}
                    />
                  </div>
                ))}
              </div>
            )}
            {message.textQueue && message.textQueue.length > 0 && (
              <div className="message-text-queue">
                {message.textQueue.map((item) => (
                  <div key={item.id} className="message-text-chip">
                    📋 {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
          {expandedReasoningId === message.id && message.sender === 'bot' && (() => {
            const { reasoning } = extractReasoningContent(message.text);
            return reasoning ? (
              <div className="reasoning-modal-overlay" onClick={() => setExpandedReasoningId(null)}>
                <div className="reasoning-modal-content" onClick={(e) => e.stopPropagation()}>
                  <div className="reasoning-modal-header">
                    <h3>Proses Berpikir</h3>
                    <button
                      className="reasoning-modal-close"
                      onClick={() => setExpandedReasoningId(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="reasoning-modal-body">
                    {formatMessageText(reasoning, false, message.id)}
                  </div>
                </div>
              </div>
            ) : null;
          })()}
          {message.sender === 'bot' && !message.isStreaming && isLastMessage && (
            <div className="message-footer">
              <div className="message-actions">
                <button
                  className={`feedback-btn like-btn ${messageFeedback[message.id] === 'like' ? 'active' : ''}`}
                  onClick={() => handleMessageFeedback(message.id, 'like')}
                  title={userLanguage === 'id' ? 'Membantu' : 'Helpful'}
                >
                  <i className="fas fa-thumbs-up"></i>
                </button>
                <button
                  className={`feedback-btn dislike-btn ${messageFeedback[message.id] === 'dislike' ? 'active' : ''}`}
                  onClick={() => handleMessageFeedback(message.id, 'dislike')}
                  title={userLanguage === 'id' ? 'Tidak membantu' : 'Not helpful'}
                >
                  <i className="fas fa-thumbs-down"></i>
                </button>
                <button
                  className="feedback-btn copy-btn"
                  onClick={() => handleCopyMessage(message.text)}
                  title={userLanguage === 'id' ? 'Salin' : 'Copy'}
                >
                  <i className="fas fa-copy"></i>
                </button>
                <button
                  className={`feedback-btn tts-btn ${playingMessageId === message.id ? 'playing' : ''} ${ttsLoading === message.id ? 'loading' : ''}`}
                  onClick={() => handleTtsToggle(message)}
                  disabled={ttsLoading === message.id}
                  title={userLanguage === 'id'
                    ? (playingMessageId === message.id ? 'Hentikan suara' : 'Baca suara')
                    : (playingMessageId === message.id ? 'Stop audio' : 'Read aloud')}
                >
                  {ttsLoading === message.id ? (
                    <i className="fas fa-spinner fa-spin"></i>
                  ) : playingMessageId === message.id ? (
                    <i className="fas fa-volume-up"></i>
                  ) : (
                    <i className="fas fa-volume-mute"></i>
                  )}
                </button>
              </div>
              <div className="message-attribution">
                {userLanguage === 'id'
                  ? 'Jawaban dihasilkan oleh Orion AI'
                  : 'Answer generated by Orion AI'}
              </div>
            </div>
          )}
        </div>
      );
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, compactView, isScrolledUp, expandedReasoningId, expandedUserMessageId, messageFeedback, userLanguage, playingMessageId, ttsLoading, aiGreeting, aiHint, generatingGreeting]);

  return (
    <div className="chatbot-app">
      {/* Private Chat Modal */}
      {showPrivateModal && (
        <div className="modal-overlay" onClick={() => setShowPrivateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowPrivateModal(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>🔒 {userLanguage === 'id' ? 'Obrolan Privat' : 'Private Chat'}</h2>
            </div>
            <div className="modal-body">
              <p>
                {userLanguage === 'id'
                  ? 'Obrolan privat memungkinkan Anda untuk berbicara dengan Orion tanpa menyimpan riwayat percakapan. Percakapan ini tidak akan muncul di daftar riwayat chat Anda.'
                  : 'Private chat allows you to talk with Orion without saving the conversation history. This chat will not appear in your chat history list.'}
              </p>
              <div className="feature-list">
                <div className="feature-item">
                  <span className="feature-icon">🔐</span>
                  <span>{userLanguage === 'id' ? 'Tidak disimpan' : 'Not saved'}</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">🗑️</span>
                  <span>{userLanguage === 'id' ? 'Dihapus saat refresh' : 'Deleted on refresh'}</span>
                </div>
                <div className="feature-item">
                  <span className="feature-icon">⏰</span>
                  <span>{userLanguage === 'id' ? 'Hanya sesi ini' : 'This session only'}</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowPrivateModal(false)}
              >
                {userLanguage === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button 
                className="modal-btn-primary"
                onClick={startPrivateChat}
              >
                {userLanguage === 'id' ? '✓ Mulai Obrolan Privat' : '✓ Start Private Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Found Sources Panel - Show sources before generating answer */}
      {showFoundSourcesPanel && foundSources.length > 0 && (
        <div className="modal-overlay" onClick={() => setShowFoundSourcesPanel(false)}>
          <div className="modal-content sources-panel" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowFoundSourcesPanel(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>📰 {userLanguage === 'id' ? 'Sumber Ditemukan' : 'Sources Found'}</h2>
              <p className="sources-count">{foundSources.length} {userLanguage === 'id' ? 'sumber' : 'sources'}</p>
            </div>
            <div className="modal-body sources-list-body">
              {foundSources.map((source, idx) => (
                <div key={idx} className="source-item">
                  <div className="source-header">
                    <h3>{source.title}</h3>
                    <span className="source-badge">{source.source}</span>
                  </div>
                  <p className="source-description">{source.description}</p>
                  {source.url && (
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="source-link">
                      🔗 {userLanguage === 'id' ? 'Buka Sumber' : 'Open Source'}
                    </a>
                  )}
                </div>
              ))}
            </div>
            <div className="modal-footer sources-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowFoundSourcesPanel(false)}
              >
                {userLanguage === 'id' ? 'Tutup' : 'Close'}
              </button>
              <button 
                className="modal-btn-primary generate-answer-btn"
                onClick={() => {
                  setShowFoundSourcesPanel(false);
                  // Trigger AI to generate answer based on found sources
                  if (pendingAnswerMessage) {
                    handleGenerateAnswerFromSources(pendingAnswerMessage);
                  }
                }}
              >
                ✨ {userLanguage === 'id' ? 'Auto Generate' : 'Auto Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personality Selector Modal */}
      {showPersonalityModal && (
        <div className="modal-overlay" onClick={() => setShowPersonalityModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowPersonalityModal(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>🎭 {userLanguage === 'id' ? 'Pilih Kepribadian AI' : 'Choose AI Personality'}</h2>
            </div>
            <div className="modal-body">
              <p>
                {userLanguage === 'id'
                  ? 'Pilih kepribadian yang Anda sukai untuk mengubah gaya percakapan Orion AI'
                  : 'Choose a personality to change how Orion AI communicates with you'}
              </p>
              <div className="personality-modal-grid">
                {Object.values(PERSONALITIES).map((personality) => (
                  <button
                    key={personality.id}
                    className={`personality-modal-btn ${selectedPersonality === personality.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedPersonality(personality.id);
                      setShowPersonalityModal(false);
                    }}
                  >
                    <span className="personality-modal-emoji">{personality.emoji}</span>
                    <span className="personality-modal-name">{personality.name}</span>
                    <span className="personality-modal-desc">{personality.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showNameSetupModal && (
        <div className="modal-overlay" onClick={() => {}}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowNameSetupModal(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>📝 {userLanguage === 'id' ? 'Siapa nama kamu?' : 'What is your name?'}</h2>
            </div>
            <div className="modal-body">
              <p>{userLanguage === 'id' ? 'Supaya Orion bisa manggil kamu dengan nama yang benar.' : 'So Orion can call you by the right name.'}</p>
              <div className="settings-row">
                <label>{userLanguage === 'id' ? 'Nama' : 'Name'}</label>
                <input
                  type="text"
                  value={pendingUserName}
                  onChange={(e) => setPendingUserName(e.target.value)}
                  placeholder={userLanguage === 'id' ? 'Contoh: Nando' : 'Example: Nando'}
                />
              </div>
              <div className="settings-row modal-actions-row">
                <button
                  className="modal-btn-confirm"
                  onClick={() => saveUserName(pendingUserName)}
                >
                  {userLanguage === 'id' ? 'Simpan' : 'Save'}
                </button>
                <button
                  className="modal-btn-cancel"
                  onClick={skipNameSetup}
                >
                  {userLanguage === 'id' ? 'Lewati' : 'Skip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowSettingsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowSettingsModal(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>⚙️ {userLanguage === 'id' ? 'Pengaturan' : 'Settings'}</h2>
              {user && (
                <div className="account-info">
                  <span className="account-label">{userLanguage === 'id' ? 'Akun:' : 'Account:'}</span>
                  <span className="account-name">
                    {(() => {
                      const email = user.email || user.name;
                      // Normalize email display: ensure @deepmail.com for consistency
                      if (email && email.includes('@')) {
                        const [local] = email.split('@');
                        return `${local}@deepmail.com`;
                      }
                      return email || (userLanguage === 'id' ? 'Pengguna' : 'User');
                    })()}
                  </span>
                </div>
              )}
            </div>
            <div className="modal-body settings-body">
              <div className="settings-row">
                <label>{userLanguage === 'id' ? 'Bahasa UI' : 'UI Language'}</label>
                <select
                  value={userLanguage}
                  onChange={(e) => setUserLanguage(e.target.value)}
                >
                  <option value="id">Bahasa Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>

              <div className="settings-row">
                <label>{userLanguage === 'id' ? 'Nama kamu' : 'Your name'}</label>
                <input
                  type="text"
                  className="settings-input"
                  value={pendingUserName}
                  onChange={(e) => setPendingUserName(e.target.value)}
                  placeholder={userLanguage === 'id' ? 'Contoh: Nando' : 'e.g. Nando'}
                />
              </div>

              <div className="settings-row">
                <button
                  className="modal-btn-confirm"
                  onClick={() => {
                    saveUserName(pendingUserName);
                    setCustomAlert(userLanguage === 'id' ? 'Nama tersimpan' : 'Name saved');
                  }}
                >
                  {userLanguage === 'id' ? 'Simpan Nama' : 'Save Name'}
                </button>
              </div>

              <div className="settings-row">
                <label>{userLanguage === 'id' ? 'Mode Privat' : 'Private Mode'}</label>
                <button
                  className={`toggle-small ${isPrivateChat ? 'on' : ''}`}
                  onClick={() => setIsPrivateChat((s) => !s)}
                >
                  {isPrivateChat ? (userLanguage === 'id' ? 'Aktif' : 'On') : (userLanguage === 'id' ? 'Mati' : 'Off')}
                </button>
              </div>

              <div className="settings-row">
                <label>{userLanguage === 'id' ? 'Simpan Memori' : 'Save Memories'}</label>
                <button
                  className="modal-btn-cancel"
                  onClick={() => {
                    memoryService.clearMemories();
                    alert(userLanguage === 'id' ? 'Memori dibersihkan' : 'Memories cleared');
                  }}
                >
                  {userLanguage === 'id' ? 'Bersihkan' : 'Clear'}
                </button>
              </div>

              <div className="settings-row api-dashboard-row">
                <label>🔌 {userLanguage === 'id' ? 'API Marketplace' : 'API Marketplace'}</label>
                <button
                  className="api-dashboard-btn"
                  onClick={() => {
                    setShowApiDashboard(true);
                    setShowSettingsModal(false);
                  }}
                >
                  {userLanguage === 'id' ? 'Buka Dashboard' : 'Open Dashboard'}
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={() => setShowSettingsModal(false)}
              >
                {userLanguage === 'id' ? 'Tutup' : 'Close'}
              </button>
              <button 
                className="logout-btn"
                onClick={() => {
                  setShowSettingsModal(false);
                  openLogoutConfirm();
                }}
              >
                {userLanguage === 'id' ? 'Logout' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HTML Editor Modal */}
      {showHtmlEditor && (
        <div className="modal-overlay" onClick={() => setShowHtmlEditor(false)}>
          <div className="modal-content html-editor-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowHtmlEditor(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>💻 {userLanguage === 'id' ? 'Editor Code' : 'Code Editor'}</h2>
            </div>
            
            <div className="modal-body html-editor-body">
              {/* Filename input */}
              <div className="html-filename-group">
                <label>{userLanguage === 'id' ? 'Nama file:' : 'Filename:'}</label>
                <input
                  type="text"
                  value={htmlFilename}
                  onChange={(e) => setHtmlFilename(e.target.value || 'code.txt')}
                  placeholder="code.txt"
                  className="html-filename-input"
                />
              </div>

              {/* Code Editor Textarea */}
              <div className="html-editor-group">
                <label>{userLanguage === 'id' ? 'Kode:' : 'Code:'}</label>
                <textarea
                  value={htmlContent}
                  onChange={(e) => setHtmlContent(e.target.value)}
                  className="html-editor-textarea"
                  spellCheck="false"
                  placeholder={userLanguage === 'id' ? 'Edit code di sini...' : 'Edit code here...'}
                />
              </div>

              {/* Preview button */}
              <div className="html-preview-info">
                <svg className="info-icon" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                <span>{userLanguage === 'id' ? 'Preview akan terbuka di tab baru (untuk HTML)' : 'Preview opens in new tab (for HTML)'}</span>
              </div>
            </div>

            <div className="modal-footer html-editor-footer">
              <button 
                className="html-preview-btn"
                onClick={() => setShowHtmlPreview(true)}
                title={userLanguage === 'id' ? 'Preview di dalam aplikasi' : 'Preview inside app'}
              >
                👁️ {userLanguage === 'id' ? 'Preview' : 'Preview'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showHtmlPreview && (
        <div className="modal-overlay" onClick={() => setShowHtmlPreview(false)}>
          <div className="modal-content html-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setShowHtmlPreview(false)}>
              ✕
            </button>
            <div className="html-preview-body">
              <iframe
                className="html-preview-iframe"
                srcDoc={htmlContent}
                sandbox="allow-scripts allow-same-origin"
                title={userLanguage === 'id' ? 'Pratinjau HTML' : 'HTML Preview'}
              />
              <button className="preview-close-btn" onClick={() => setShowHtmlPreview(false)}>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div className="modal-overlay">
          <div className="modal-content">
            <button className="modal-close" onClick={closeLogoutConfirm}>
              ×
            </button>
            <div className="modal-header">
              <h2>{userLanguage === 'id' ? 'Konfirmasi Logout' : 'Logout Confirmation'}</h2>
            </div>
            <div className="modal-body">
              <p>
                {userLanguage === 'id'
                  ? 'Anda akan keluar dari akun ini. Semua session akan berakhir dan Anda harus login lagi untuk melanjutkan.'
                  : 'You will be logged out from this account. Your session will end and you will need to log in again to continue.'}
              </p>
              <p>
                {userLanguage === 'id'
                  ? 'Apakah Anda yakin ingin logout sekarang?'
                  : 'Are you sure you want to logout now?'}
              </p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={closeLogoutConfirm}>
                {userLanguage === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button className="modal-btn-primary" onClick={confirmLogout} disabled={logoutLoading}>
                {logoutLoading
                  ? userLanguage === 'id' ? 'Logout...' : 'Logging out...'
                  : userLanguage === 'id' ? 'Logout' : 'Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Message Modal */}
      {editingMessageId && (
        <div className="modal-overlay" onClick={handleCancelEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={handleCancelEdit}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>{userLanguage === 'id' ? '✏️ Edit Pesan' : '✏️ Edit Message'}</h2>
            </div>
            <div className="modal-body">
              <textarea
                className="edit-message-textarea"
                value={editingMessageText}
                onChange={(e) => setEditingMessageText(e.target.value)}
                placeholder={userLanguage === 'id' ? 'Edit pesan Anda...' : 'Edit your message...'}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-btn-cancel" onClick={handleCancelEdit}>
                {userLanguage === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button className="modal-btn-primary" onClick={handleEditAndResend}>
                {userLanguage === 'id' ? 'Edit & Kirim Ulang' : 'Edit & Resend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Marketplace Dashboard */}
      {showApiDashboard && (
        <div className="api-dashboard-fullscreen">
          <button 
            className="api-dashboard-close"
            onClick={() => setShowApiDashboard(false)}
            title="Back to chat"
          >
            ✕
          </button>
          <ApiMarketplace onLogout={() => setShowApiDashboard(false)} />
        </div>
      )}

      {/* Sources Modal */}
      {showSourcesModal && (
        <div className="modal-overlay" onClick={() => setShowSourcesModal(false)}>
          <div className="modal-content sources-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowSourcesModal(false)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>📚 {userLanguage === 'id' ? 'Sumber Data' : 'Data Sources'}</h2>
            </div>
            
            <div className="modal-body sources-body">
              {!currentSources || currentSources.length === 0 ? (
                <div className="no-sources-message">
                  <p>
                    {userLanguage === 'id'
                      ? 'Belum ada sumber data untuk percakapan ini'
                      : 'No data sources available for this conversation'}
                  </p>
                  <p className="sources-hint">
                    {userLanguage === 'id'
                      ? 'Coba tanyakan tentang ekonomi, pasar, atau berita terbaru'
                      : 'Try asking about economy, markets, or latest news'}
                  </p>
                </div>
              ) : (
                <div className="sources-list">
                  {currentSources.map((source, idx) => (
                    <div key={source.id || idx} className="source-item">
                      <div className="source-header">
                        <span className="source-icon">{getSourceIcon(source.type)}</span>
                        <div className="source-meta">
                          <h3 className="source-title">{source.title}</h3>
                          <p className="source-type">{source.source}</p>
                          {source.timestamp && (
                            <p className="source-time">
                              {new Date(source.timestamp).toLocaleString(userLanguage === 'id' ? 'id-ID' : 'en-US')}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {source.description && (
                        <p className="source-description">{source.description}</p>
                      )}
                      
                      <div className="source-actions">
                        {source.url && (
                          <button
                            className="source-open-btn"
                            onClick={() => handleOpenSource(source.url)}
                            title={userLanguage === 'id' ? 'Buka sumber' : 'Open source'}
                          >
                            🔗 {userLanguage === 'id' ? 'Buka' : 'Open'}
                          </button>
                        )}
                        <button
                          className="source-detail-btn"
                          onClick={() => handleViewSourceDetail(source)}
                          title={userLanguage === 'id' ? 'Lihat detail' : 'View details'}
                        >
                          📋 {userLanguage === 'id' ? 'Detail' : 'Details'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Source Detail Modal */}
      {selectedSource && (
        <div className="modal-overlay" onClick={() => setSelectedSource(null)}>
          <div className="modal-content source-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setSelectedSource(null)}
            >
              ✕
            </button>
            <div className="modal-header">
              <h2>📖 {userLanguage === 'id' ? 'Detail Sumber' : 'Source Details'}</h2>
            </div>
            
            <div className="modal-body source-detail-body">
              <div className="source-detail-grid">
                <div className="detail-field">
                  <label>{userLanguage === 'id' ? 'Judul' : 'Title'}</label>
                  <p className="detail-value">{selectedSource.title}</p>
                </div>
                
                <div className="detail-field">
                  <label>{userLanguage === 'id' ? 'Sumber' : 'Source'}</label>
                  <p className="detail-value">{selectedSource.source}</p>
                </div>
                
                <div className="detail-field">
                  <label>{userLanguage === 'id' ? 'Tipe' : 'Type'}</label>
                  <p className="detail-value">{selectedSource.type}</p>
                </div>
                
                {selectedSource.timestamp && (
                  <div className="detail-field">
                    <label>{userLanguage === 'id' ? 'Waktu' : 'Time'}</label>
                    <p className="detail-value">
                      {new Date(selectedSource.timestamp).toLocaleString(userLanguage === 'id' ? 'id-ID' : 'en-US')}
                    </p>
                  </div>
                )}
                
                {selectedSource.query && (
                  <div className="detail-field">
                    <label>{userLanguage === 'id' ? 'Query' : 'Query'}</label>
                    <p className="detail-value">{selectedSource.query}</p>
                  </div>
                )}
              </div>
              
              {selectedSource.description && (
                <div className="detail-section">
                  <h4>{userLanguage === 'id' ? 'Deskripsi' : 'Description'}</h4>
                  <p>{selectedSource.description}</p>
                </div>
              )}
              
              {selectedSource.url && (
                <div className="detail-actions">
                  <button
                    className="source-url-btn"
                    onClick={() => handleOpenSource(selectedSource.url)}
                  >
                    🔗 {selectedSource.url}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Floating hamburger button */}
      <button
        className={`toggle-sidebar-btn ${sidebarOpen ? 'hidden' : ''}`}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        title="Toggle sidebar"
      >
        ☰
      </button>

      {/* Floating + button at top-right */}
      <button
        className={`floating-add-btn ${showFloatingMenu ? 'active' : ''}`}
        onClick={() => setShowFloatingMenu(!showFloatingMenu)}
        title={userLanguage === 'id' ? 'Menu tambahan' : 'More options'}
      >
        +
      </button>



      {/* Floating menu for + button */}
      {showFloatingMenu && (
        <div className="floating-menu">
          <button
            className="floating-menu-item"
            onClick={() => {
              createNewConversation();
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Chat baru' : 'New chat'}
          >
            💬 {userLanguage === 'id' ? 'Chat Baru' : 'New Chat'}
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowPersonalityModal(true);
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Ubah kepribadian' : 'Change personality'}
          >
            🎭 {userLanguage === 'id' ? 'Kepribadian' : 'Personality'}
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowApiDashboard(true);
              setShowFloatingMenu(false);
            }}
            title="API & Pricing"
          >
            🔌 API
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowPrivateModal(true);
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Mulai obrolan pribadi' : 'Start private chat'}
          >
            🔒 {userLanguage === 'id' ? 'Private Chat' : 'Private Chat'}
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowSettingsModal(true);
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Pengaturan' : 'Settings'}
          >
            ⚙️ {userLanguage === 'id' ? 'Pengaturan' : 'Settings'}
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowVoiceChat(true);
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Obrolan suara' : 'Voice chat'}
          >
            🎙️ {userLanguage === 'id' ? 'Chat Suara' : 'Voice Chat'}
          </button>
          <button
            className="floating-menu-item"
            onClick={() => {
              setShowFileTypeSelector(true);
              setShowFloatingMenu(false);
            }}
            title={userLanguage === 'id' ? 'Editor dokumen dengan AI' : 'AI Document Editor'}
          >
            📝 {userLanguage === 'id' ? 'Doc Editor' : 'Doc Editor'}
          </button>
          {currentSources && currentSources.length > 0 && (
            <button
              className="floating-menu-item sources-menu-item"
              onClick={() => {
                handleShowSources();
                setShowFloatingMenu(false);
              }}
              title={userLanguage === 'id' ? 'Lihat sumber data' : 'View data sources'}
            >
              📚 {userLanguage === 'id' ? 'Sumber Data' : 'Sources'} ({currentSources.length})
            </button>
          )}
        </div>
      )}

      {/* Sidebar */}
      <div className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="sidebar-title">
            <h3>🚀 Deepernova AI</h3>
            <p className="sidebar-subtitle">indonesian ai research</p>
          </div>
          
          {/* API & Pricing Buttons */}


          <div className="sidebar-header-actions">
            <button
              className="donation-btn"
              onClick={() => setShowDonationModal(true)}
              title={userLanguage === 'id' ? 'Donasi' : 'Donate'}
            >
              <i className="fas fa-heart"></i> {userLanguage === 'id' ? 'Donasi' : 'Donate'}
            </button>
            <button
              className="sidebar-close-btn"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              ✕
            </button>
          </div>
        </div>

        <button className="new-chat-btn" onClick={createNewConversation}>
          + New Chat
        </button>

        <div className="conversations-list">
          {conversations.filter(conv => !conv.isPrivate).map((conv) => (
            <div
              key={conv.id}
              className={`conversation-item ${currentConversationId === conv.id ? 'active' : ''} ${conv.isLoading ? 'deleting' : ''}`}
              onClick={() => switchConversation(conv.id)}
            >
              <div className="conv-title" title={conv.title}>{conv.title}</div>
              <div className="conv-time">
                {new Date(conv.updatedAt).toLocaleDateString()}
              </div>
              <button
                className="conv-delete"
                disabled={conv.isLoading}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!conv.isLoading) {
                    deleteConversation(conv.id);
                  }
                }}
                title={conv.isLoading ? 'Deleting...' : 'Delete session'}
              >
                {conv.isLoading ? '⏳' : '×'}
              </button>
            </div>
          ))}
        </div>

        {/* Token Usage Status */}
        {/* Memory System Status */}
        <div className="memory-section">
          <div className="memory-header">
            <span>📚 Memory Bank</span>
            <button 
              className="memory-clear"
              onClick={() => {
                if (confirm('Clear all memories? This action cannot be undone.')) {
                  memoryService.clearMemories();
                  window.location.reload();
                }
              }}
              title="Clear all memories"
            >
              ↻
            </button>
          </div>
          <div className="memory-stats">
            <div className="stat">
              <span className="stat-label">Total:</span>
              <span className="stat-value">{memoryService.getSummary().totalMemories}</span>
            </div>
            {Object.entries(memoryService.getSummary().byType).map(([type, count]) => (
              <div key={type} className="stat">
                <span className="stat-label">{type}:</span>
                <span className="stat-value">{count}</span>
              </div>
            ))}
          </div>
          <p className="memory-hint">
            {userLanguage === 'id' 
              ? '💡 Orion mengingat preferensi & konteks dari chat sebelumnya'
              : '💡 Orion remembers preferences & context from previous chats'}
          </p>
        </div>

        {/* Donation Support Message */}
        <div className="sidebar-donation-message">
          <p>
            💝 Deepernova adalah AI gratis, untuk semua anak Indonesia. Kami sampai kurang tidur demi membangun AI ini agar dapat di akses secara free.
          </p>
          <button 
            className="donate-btn-sidebar"
            onClick={() => setShowDonationModal(true)}
            title="Donasi untuk dukungan project"
          >
            ❤️ Dukung Deepernova
          </button>
        </div>
      </div>

      {/* Sidebar backdrop for mobile */}
      <div 
        className={`sidebar-backdrop ${sidebarOpen ? '' : 'closed'}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Main chat area */}
      <div className="chatbot-container">
        <div className="chatbot-header">
        </div>

        {/* Custom Alert Notification */}
        {customAlert && (
          <div className={`custom-alert alert-${customAlert.type}${dismissingAlert ? ' dismissing' : ''}`}>
            <div className="alert-content">
              <span className="alert-message">{customAlert.message}</span>
              <button 
                className="alert-close"
                onClick={() => {
                  setDismissingAlert(true);
                  setTimeout(() => {
                    setCustomAlert(null);
                    setDismissingAlert(false);
                  }, 400);
                }}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        <div className="messages-container">
        {foundSources.length > 0 && messages.length > 0 && (
          <div className="source-strip sources-above-output" onClick={() => setShowFoundSourcesPanel(true)}>
            <div className="source-strip-header">
              <div className="source-strip-text">
                <span>{userLanguage === 'id' ? 'Sumber internet' : 'Internet sources'}</span>
                <span className="source-strip-count">{foundSources.length} {userLanguage === 'id' ? 'sumber' : 'sources'}</span>
              </div>
              <div className="source-strip-label">{userLanguage === 'id' ? 'Klik untuk lihat detail' : 'Tap to view details'}</div>
            </div>
            <div className="source-logo-row small-logos">
              {foundSources.slice(0, 4).map((source, idx) => {
                const logo = getSourceLogo(source);
                return (
                  <button
                    key={source.id || idx}
                    type="button"
                    className="source-logo-chip"
                    aria-label={source.source || source.title || `Source ${idx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowFoundSourcesPanel(true);
                    }}
                  >
                    {logo.type === 'image' ? (
                      <img src={logo.value} alt={logo.label} />
                    ) : (
                      <span>{logo.value}</span>
                    )}
                  </button>
                );
              })}
              {foundSources.length > 4 && (
                <div className="source-logo-more">+{foundSources.length - 4}</div>
              )}
            </div>
          </div>
        )}

        {memoizedMessageList}

        {loading && (
          <div className="message bot loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="loading-status-text">
                {loadingStatusMsg || (userLanguage === 'id' ? 'AI sedang berpikir...' : 'AI is thinking...')}
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
        
        {compactView && messages.length > 1 && !inputValue.trim() && (
          <button 
            className="show-previous-btn"
            onClick={handleShowPreviousMessages}
            title="Lihat pesan sebelumnya"
            style={{
              bottom: (uploadedFiles.length + uploadedImages.length > 0 && !attachmentQueueMinimized) ? '235px' : '115px'
            }}
          >
            📜 Lihat Pesan Sebelumnya
          </button>
        )}
        
        {isScrolledUp && (
          <button 
            className="scroll-to-bottom-btn"
            onClick={handleScrollToBottomClick}
            title="Scroll ke bawah"
          >
            ↓
          </button>
        )}
      </div>

      {error && (
        <div className="error-banner">
          <div className="error-content">
            <div className="error-message">
              <p>Sorry, Pesan kamu tidak berhasil dikirim</p>
            </div>
            <div className="error-actions">
              <button 
                className="retry-button"
                onClick={handleRetry}
                disabled={loading}
              >
                {userLanguage === 'id' ? 'Lanjutkan' : 'Continue'}
              </button>
              <button 
                className="error-close"
                onClick={() => {
                  if (retryIntervalRef.current) {
                    clearInterval(retryIntervalRef.current);
                  }
                  setError(null);
                  setLastMessage(null);
                  partialMessageIdRef.current = null;
                }}
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}

      <form className="input-form" onSubmit={handleSendMessage}>
        {/* Uploaded Attachments Display */}
        {(uploadedFiles.length > 0 || uploadedImages.length > 0) && (
          <div className={`uploaded-attachments-container${attachmentQueueMinimized ? ' minimized' : ''}`}>
            <div className="uploaded-attachments-header">
              <span>📦 {uploadedFiles.length + uploadedImages.length} {userLanguage === 'id' ? 'lampiran' : 'attachment'}{uploadedFiles.length + uploadedImages.length !== 1 ? 's' : ''}</span>
              <div className="uploaded-attachments-header-actions">
                <button
                  className="minimize-files-btn"
                  type="button"
                  onClick={() => setAttachmentQueueMinimized(!attachmentQueueMinimized)}
                  title={attachmentQueueMinimized ? (userLanguage === 'id' ? 'Perluas' : 'Expand') : (userLanguage === 'id' ? 'Perkecil' : 'Minimize')}
                >
                  {attachmentQueueMinimized ? '▶' : '▼'}
                </button>
                <button
                  className="clear-files-btn"
                  onClick={clearAllAttachments}
                  title={userLanguage === 'id' ? 'Hapus semua lampiran' : 'Clear all attachments'}
                >
                  ✕
                </button>
              </div>
            </div>
            {!attachmentQueueMinimized && (
              <div className="uploaded-attachments-list">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="uploaded-file-chip">
                    <span className="file-icon">📄</span>
                    <div className="file-info">
                      <span className="file-name">{file.name}</span>
                      <span className="file-meta">{file.size}KB · {file.tokens} tokens</span>
                    </div>
                    <button
                      className="remove-file-btn"
                      onClick={() => removeUploadedFile(file.id)}
                      title={userLanguage === 'id' ? 'Hapus file' : 'Remove file'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {uploadedImages.map(image => (
                  <div key={image.id} className={`uploaded-image-chip status-${image.status}`}>
                    <div className="image-preview-thumb">
                      <img src={image.dataUrl} alt={image.fileName} />
                    </div>
                    <div className="image-chip-info">
                      <span className="image-file-name">{image.fileName}</span>
                      <span className="image-status">
                        {image.status === 'uploading' && '⬆️ Mengunggah...'}
                        {image.status === 'queued' && '⏳ Antrian'}
                        {image.status === 'analyzing' && '🔍 Analisis...'}
                        {image.status === 'analyzed' && '✅ Siap'}
                        {image.status === 'error' && `❌ ${image.error || 'Error'}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="remove-image-btn"
                      onClick={() => removeUploadedImage(image.id)}
                      title={userLanguage === 'id' ? 'Hapus gambar' : 'Remove image'}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {/* Text Queue Display - OUTSIDE input-container, full width */}
        {textQueue.length > 0 && (
          <div className="pasted-text-container">
            <div className="pasted-text-header">
              <span>📋 {textQueue.length} {userLanguage === 'id' ? 'salinan teks' : 'text copy'}{textQueue.length !== 1 ? 's' : ''}</span>
              <button 
                className="clear-text-btn"
                type="button"
                onClick={() => setTextQueue([])}
                title={userLanguage === 'id' ? 'Hapus semua teks' : 'Clear all text'}
              >
                ✕
              </button>
            </div>
            <div className="pasted-text-list">
              {textQueue.map(item => (
                <div key={item.id} className="pasted-text-chip">
                  <span className="text-preview-icon">📄</span>
                  <div className="text-chip-info">
                    <span className="text-chip-label">{item.label}</span>
                    <span className="text-chip-preview">{item.content.substring(0, 60)}...</span>
                  </div>
                  <div className="text-chip-actions">
                    <button
                      type="button"
                      className="text-chip-edit-btn"
                      onClick={() => handleTextQueueItemClick(item)}
                      title={userLanguage === 'id' ? 'Edit teks' : 'Edit text'}
                    >
                      ✏️
                    </button>
                    <button
                      type="button"
                      className="text-chip-remove-btn"
                      onClick={() => handleRemoveTextItem(item.id)}
                      title={userLanguage === 'id' ? 'Hapus teks' : 'Remove text'}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className={`input-container ${getConvLoading() ? 'generating' : ''}`}>
          {/* Attachment badge only when attachment queue is minimized */}
          {(uploadedFiles.length + uploadedImages.length > 0) && attachmentQueueMinimized && (
            <button
              type="button"
              className="file-attached-badge"
              onClick={() => setAttachmentQueueMinimized(false)}
              title={userLanguage === 'id' ? 'Tampilkan kembali lampiran' : 'Show attachments'}
            >
              📦 {uploadedFiles.length + uploadedImages.length}
            </button>
          )}

          {/* Hidden file input */}
          <input
            ref={(input) => {
              window.fileUploadInput = input;
            }}
            type="file"
            id="file-upload-input"
            className="file-upload-input"
            accept=".txt,.csv,.json,.html,.md,.htm"
            onChange={(e) => handleFileUpload(e)}
            style={{ display: 'none' }}
          />

          {/* Hidden image input */}
          <input
            ref={(input) => {
              setImageUploadInput(input);
            }}
            type="file"
            id="image-upload-input"
            className="image-upload-input"
            accept="image/*"
            multiple
            onChange={(e) => handleImageUpload(e)}
            style={{ display: 'none' }}
          />
          
          {/* File/Options menu button */}
          <div className="file-menu-container">
            <button
              type="button"
              className="file-menu-toggle"
              onClick={() => setShowInputMenu(!showInputMenu)}
              title={userLanguage === 'id' ? 'Opsi' : 'Options'}
              disabled={loading}
            >
              <svg className="button-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
            {showInputMenu && (
              <div className="file-menu-dropdown">
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    window.fileUploadInput?.click();
                    setShowInputMenu(false);
                  }}
                  disabled={loading}
                >
                  <span className="menu-icon">📁</span>
                  {userLanguage === 'id' ? 'Upload File' : 'Upload File'}
                </button>
                <button
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    document.getElementById('image-upload-input')?.click();
                    setShowInputMenu(false);
                  }}
                  disabled={loading}
                >
                  <span className="menu-icon">📸</span>
                  {userLanguage === 'id' ? 'Upload Gambar' : 'Upload Image'}
                </button>
                <div className="menu-divider"></div>
                <button
                  type="button"
                  className={`menu-item ${isReasonMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsReasonMode(!isReasonMode);
                    setShowInputMenu(false);
                  }}
                  disabled={loading}
                >
                  <span className="menu-icon">{isReasonMode ? '✓' : '○'}</span>
                  {userLanguage === 'id' ? 'Reason Mode' : 'Reason Mode'}
                </button>
                <div className="menu-divider"></div>
                <div className="menu-label">{userLanguage === 'id' ? 'Model' : 'Model'}</div>
                <button
                  type="button"
                  className={`menu-item ${selectedModel === 'deepernova-1.2-flash' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedModel('deepernova-1.2-flash');
                    setShowInputMenu(false);
                  }}
                >
                  <span className="menu-icon">⚡</span>
                  Deepernova 1.2 Flash
                </button>
                <button
                  type="button"
                  className={`menu-item ${selectedModel === 'deepernova-2.3-pro' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedModel('deepernova-2.3-pro');
                    setShowInputMenu(false);
                  }}
                >
                  <span className="menu-icon">⚙️</span>
                  Deepernova 2.3 Pro
                </button>
                <button
                  type="button"
                  className={`menu-item ${selectedModel === 'deepernova-4.6-giga' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedModel('deepernova-4.6-giga');
                    setShowInputMenu(false);
                  }}
                >
                  <span className="menu-icon">🚀</span>
                  Deepernova 4.6 Giga
                </button>
              </div>
            )}
          </div>

          <div className="textarea-wrapper">
            <textarea
              ref={(el) => {
                textareaElementRef.current = el;
                globalThis.textareaRef = el;
              }}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                scheduleTextareaResize(e.target);
              }}
              onKeyDown={(e) => {
                // Enter biasa: kirim pesan.
                // Shift+Enter: buat baris baru di textarea.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              onPaste={handlePaste}
              placeholder={messages.length === 0 ? "Mengobrol dengan Orion..." : "Balas Orion..."}
              disabled={getConvLoading()}
              className={`message-input ${getConvLoading() ? 'generating' : ''}`}
              rows="1"
            />
          </div>

          <button 
            type={getConvLoading() ? "button" : "submit"}
            className={`action-button ${getConvLoading() ? 'stop-mode' : 'send-mode'}`}
            onClick={getConvLoading() ? handleStopStreaming : undefined}
            disabled={!getConvLoading() && !inputValue.trim() && textQueue.length === 0}
            title={getConvLoading() ? "Hentikan generasi" : "Kirim pesan"}
          >
            {getConvLoading() ? (
              <svg className="button-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            ) : (
              <i className="fa-solid fa-arrow-up button-icon" aria-hidden="true"></i>
            )}
          </button>
        </div>
      </form>

      {/* Reasoning popup was moved into the messages container to render inline with messages */}

      {/* Text Paste Popup Modal */}
      {showTextPopup && selectedTextItem && (
        <div className="text-popup-overlay" onClick={() => {
          setShowTextPopup(false);
          setSelectedTextItem(null);
          setEditingTextContent('');
        }}>
          <div className="text-popup-modal" onClick={(e) => e.stopPropagation()}>
            <div className="text-popup-header">
              <h3>
                {userLanguage === 'id' ? '📋 Salinan Teks' : '📋 Text Copy'}
              </h3>
              <button
                type="button"
                className="popup-close-btn"
                onClick={() => {
                  setShowTextPopup(false);
                  setSelectedTextItem(null);
                  setEditingTextContent('');
                }}
              >
                ✕
              </button>
            </div>

            <div className="text-popup-body">
              <textarea
                value={editingTextContent}
                onChange={(e) => setEditingTextContent(e.target.value)}
                className="text-popup-textarea"
                placeholder={userLanguage === 'id' ? 'Edit teks di sini...' : 'Edit text here...'}
              />
            </div>

            <div className="text-popup-footer">
              <button
                type="button"
                className="popup-action-btn save-btn"
                onClick={handleSaveTextEdit}
              >
                {userLanguage === 'id' ? '✓ Simpan & Kirim' : '✓ Save & Send'}
              </button>
              <button
                type="button"
                className="popup-action-btn cancel-btn"
                onClick={() => {
                  setShowTextPopup(false);
                  setSelectedTextItem(null);
                  setEditingTextContent('');
                }}
              >
                {userLanguage === 'id' ? '✕ Tutup' : '✕ Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoiceChat && <VoiceChat onClose={() => setShowVoiceChat(false)} userLanguage={userLanguage} isAuthenticated={isAuthenticated} isGuest={isGuest} />}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmConvId(null); }}>
          <div className="modal-content delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-header">
              <h3>⚠️ Hapus Sesi?</h3>
              <p>Apakah Anda yakin ingin menghapus sesi ini? Tindakan ini tidak dapat dibatalkan.</p>
            </div>
            <div className="delete-confirm-actions">
              <button 
                className="btn-cancel"
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmConvId(null); }}
              >
                Batal
              </button>
              <button 
                className="btn-delete"
                onClick={() => confirmDeleteConversation(deleteConfirmConvId)}
              >
                Hapus Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Donation Modal */}
      {showDonationModal && (
        <div className="modal-overlay" onClick={() => setShowDonationModal(false)}>
          <div className="modal-content donation-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close"
              onClick={() => setShowDonationModal(false)}
            >
              ✕
            </button>
            <div className="donation-modal-header">
              <h2>💝 Dukung Deepernova AI</h2>
            </div>
            <div className="donation-modal-body">
              <div className="donation-content">
                <div className="donation-qrcode">
                  <div className="qrcode-container">
                    <img 
                      src="/qr code qris.jpeg"
                      alt="QRIS Donation QR Code"
                      className="qrcode-image"
                    />
                    <p className="qrcode-label">
                      Scan QRIS ini. Nominal berapa pun berarti.
                    </p>
                  </div>
                </div>

                <div className="donation-message">
                  <p className="donation-text-main">
                    🇮🇩 AI Berkualitas Seharusnya Bukan Hak Orang Kaya
                  </p>
                  <p className="donation-text-secondary">
                    Hari ini, akses ke AI terbaik butuh biaya ratusan ribu hingga jutaan rupiah per tahun. Artinya jutaan pelajar Indonesia — yang justru paling butuh — tidak bisa menjangkaunya.
                  </p>
                  <p className="donation-text-secondary">
                    Anak yang tidak punya akses AI hari ini, akan tertinggal dari teman-temannya yang punya. Di sekolah. Di dunia kerja. Di masa depan.
                  </p>
                  <div className="donation-impact">
                    <h3>🚀 Deepernova Hadir untuk Menutup Kesenjangan Itu</h3>
                    <ul className="donation-points">
                      <li>✓ AI buatan anak bangsa. Gratis. Untuk siapa saja. Tanpa syarat.</li>
                      <li>✓ Kami tidak minta banyak — hanya kepercayaan Anda bahwa setiap anak Indonesia berhak punya kesempatan yang sama.</li>
                      <li>✓ Karena masa depan Indonesia tidak seharusnya ditentukan oleh siapa yang mampu membayar.</li>
                    </ul>
                  </div>
                  <p className="donation-text-secondary quote-text">
                    {userLanguage === 'id'
                      ? '"Kami tidak meminta banyak. Kami hanya minta Anda percaya bahwa anak Indonesia layak punya akses ke teknologi terbaik dunia — dan ikut mewujudkannya."'
                      : '"We do not ask for much. We only ask you to believe that Indonesian children deserve access to the world’s best technology — and help make it happen."'}
                  </p>
                  <p className="testimonial-author">
                    — Ferry & Tim Deepernova
                  </p>
                </div>
              </div>

              <div className="donation-testimonial">
                <p className="testimonial-text">
                  "Setiap rupiah yang Anda donasikan adalah investasi untuk generasi AI pioneers Indonesia yang kompeten dan bermoral."
                </p>
                <p className="testimonial-author">
                  — Ferry & Tim Deepernova
                </p>
              </div>
            </div>
            <div className="donation-modal-footer">
              <button
                className="modal-btn-cancel"
                onClick={() => setShowDonationModal(false)}
              >
                Tutup
              </button>
              <button
                className="modal-btn-primary donation-thanks-btn"
                onClick={() => setShowDonationModal(false)}
              >
                ❤️ Terima Kasih!
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Generator Modal */}
      {showDocumentGenerator && (
        <DocumentGenerator
          isOpen={showDocumentGenerator}
          onClose={() => setShowDocumentGenerator(false)}
          fileType={documentGeneratorType}
          content={documentGeneratorContent}
          title={documentGeneratorTitle}
          userLanguage={userLanguage}
        />
      )}

      {/* File Type Selector Modal */}
      <FileTypeSelector
        isOpen={showFileTypeSelector}
        onClose={() => setShowFileTypeSelector(false)}
        userName={userName || 'User'}
        onSelectType={(fileType) => {
          setShowFileTypeSelector(false);
          if (fileType === 'ppt') {
            onNavigate && onNavigate('documents', 'ppt');
          } else {
            onNavigate && onNavigate('documents', fileType);
          }
        }}
        userLanguage={userLanguage}
      />

      {/* Image Generator Modal - Removed: now generating inline in chat */}

      {/* Image Enlargement Modal */}
      {showImageModal && enlargedImage && (
        <div className="modal-overlay image-modal-overlay" onClick={closeImageModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close image-modal-close"
              onClick={closeImageModal}
              title={userLanguage === 'id' ? 'Tutup' : 'Close'}
            >
              ✕
            </button>
            
            <div className="image-modal-header">
              <h2>🖼️ {userLanguage === 'id' ? 'Pratinjau Gambar' : 'Image Preview'}</h2>
            </div>

            <div className="image-modal-body">
              <img 
                src={enlargedImage.url} 
                alt={enlargedImage.alt}
                className="enlarged-image"
              />
            </div>

            <div className="image-modal-footer">
              <button 
                className="modal-btn-cancel"
                onClick={closeImageModal}
              >
                {userLanguage === 'id' ? 'Tutup' : 'Close'}
              </button>
              <button 
                className="modal-btn-primary download-btn"
                onClick={handleDownloadImage}
              >
                ⬇️ {userLanguage === 'id' ? 'Unduh Gambar' : 'Download Image'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  </div>
  );
};


export default ChatBot;
