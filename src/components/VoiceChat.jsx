import React, { useState, useRef, useEffect } from 'react';
import './VoiceChat.css';

const VoiceChat = ({ onClose, userLanguage = 'id', isAuthenticated = false, isGuest = true }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState([]);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [selectedPersonality, setSelectedPersonality] = useState('natural');
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceIndex, setSelectedVoiceIndex] = useState(0);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [ttsRate, setTtsRate] = useState(0.9);
  const [ttsPitch, setTtsPitch] = useState(1.2);
  const [selectedLanguage, setSelectedLanguage] = useState(userLanguage);
  const [autoToneEnabled, setAutoToneEnabled] = useState(true);

  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);
  const abortControllerRef = useRef(null);

  // Personality voice configurations - AI auto-selects pitch/rate
  const personalityConfigs = {
    formal: { rateRange: [0.8, 0.95], pitchRange: [0.9, 1.1], name: 'Formal' },
    professional: { rateRange: [0.85, 0.95], pitchRange: [1.0, 1.15], name: 'Professional' },
    natural: { rateRange: [0.9, 1.1], pitchRange: [1.1, 1.3], name: 'Natural' },
    friendly: { rateRange: [1.0, 1.2], pitchRange: [1.2, 1.4], name: 'Friendly' },
    casual: { rateRange: [1.05, 1.25], pitchRange: [1.15, 1.35], name: 'Casual' },
    energetic: { rateRange: [1.15, 1.35], pitchRange: [1.3, 1.5], name: 'Energetic' },
    calm: { rateRange: [0.7, 0.85], pitchRange: [0.9, 1.0], name: 'Calm' },
    storyteller: { rateRange: [0.9, 1.05], pitchRange: [1.1, 1.25], name: 'Storyteller' },
  };

  // Language codes supported
  const supportedLanguages = [
    { code: 'id', name: '🇮🇩 Indonesian', label: 'Bahasa Indonesia' },
    { code: 'en', name: '🇺🇸 English', label: 'English' },
    { code: 'es', name: '🇪🇸 Spanish', label: 'Español' },
    { code: 'fr', name: '🇫🇷 French', label: 'Français' },
    { code: 'de', name: '🇩🇪 German', label: 'Deutsch' },
    { code: 'it', name: '🇮🇹 Italian', label: 'Italiano' },
    { code: 'pt', name: '🇵🇹 Portuguese', label: 'Português' },
    { code: 'ru', name: '🇷🇺 Russian', label: 'Русский' },
    { code: 'ja', name: '🇯🇵 Japanese', label: '日本語' },
    { code: 'ko', name: '🇰🇷 Korean', label: '한국어' },
    { code: 'zh', name: '🇨🇳 Chinese', label: '中文' },
    { code: 'ar', name: '🇸🇦 Arabic', label: 'العربية' },
    { code: 'hi', name: '🇮🇳 Hindi', label: 'हिन्दी' },
    { code: 'th', name: '🇹🇭 Thai', label: 'ไทย' },
    { code: 'vi', name: '🇻🇳 Vietnamese', label: 'Tiếng Việt' },
    { code: 'pl', name: '🇵🇱 Polish', label: 'Polski' },
    { code: 'tr', name: '🇹🇷 Turkish', label: 'Türkçe' },
  ];

  const getLanguageLang = (langCode) => {
    const langMap = {
      'id': 'id-ID',
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ru': 'ru-RU',
      'ja': 'ja-JP',
      'ko': 'ko-KR',
      'zh': 'zh-CN',
      'ar': 'ar-SA',
      'hi': 'hi-IN',
      'th': 'th-TH',
      'vi': 'vi-VN',
      'pl': 'pl-PL',
      'tr': 'tr-TR',
    };
    return langMap[langCode] || 'en-US';
  };

  // Auto-detect language dari text input
  const detectLanguageFromText = (text) => {
    if (!text || text.length < 3) return null;

    // Script detection patterns
    const scripts = {
      // Cyrillic (Russian, Polish, etc)
      'ru': /[а-яА-ЯёЁ]/,
      'pl': /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,
      
      // CJK
      'zh': /[\u4E00-\u9FFF]/,
      'ja': /[\u3040-\u309F\u30A0-\u30FF]/,
      'ko': /[\uAC00-\uD7AF]/,
      
      // Thai
      'th': /[\u0E00-\u0E7F]/,
      
      // Arabic
      'ar': /[\u0600-\u06FF]/,
      
      // Devanagari (Hindi)
      'hi': /[\u0900-\u097F]/,
      
      // Vietnamese
      'vi': /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i,
    };

    // Check untuk script-based languages first
    for (const [lang, pattern] of Object.entries(scripts)) {
      if (pattern.test(text)) {
        return lang;
      }
    }

    // Common words untuk Indonesian
    const indonesianWords = /\b(yang|adalah|dan|di|ke|dari|untuk|dengan|ini|itu|saya|anda|bukan|ada|tidak|juga|hanya|apa|siapa|mana|kapan|berapa|bagaimana|mengapa|atau|tapi|karena|sudah|akan|dapat|harus|bisa|ingin|perlu|mulai|selesai|coba|ingat|tahu|sadar|rasa|dengar|lihat|baca|tulis|ambil|beri|catat|dorong|tarik|buka|tutup|pasang|copot|kerjakan|lakukan|pukul|tarik|dorong|cubit|gigit|minum|makan|tidur|bangun|berdiri|duduk|berlari|berjalan|terbang|berenang)\b/i;

    // Common words untuk English
    const englishWords = /\b(the|be|to|of|and|a|in|that|have|i|it|for|not|on|with|he|as|you|do|at|this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|are|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us|is|was|are|been|being|did|does|doing|had|has|having|do|ought|should|could|would|may|might|must|can|will|shall)\b/i;

    // Common words untuk Spanish
    const spanishWords = /\b(el|la|de|que|y|a|en|un|una|es|se|no|por|con|los|su|para|o|este|sí|más|como|lo|me|ya|fue|está|han|son|también|les|ha|está|voy|puedo|tengo|hacer|sabe|quiero|está|vamos|podemos|dice|creo|bueno|hola|gracias|por favor|sí|no)\b/i;

    // Common words untuk French
    const frenchWords = /\b(le|de|un|et|à|être|en|que|il|pour|pas|sur|se|pas|avec|tout|nous|ce|dans|y|a|avoir|ne|ses|ou|qui|mon|vous|lui|d'un|donc|où|mais|alors|quoi|votre|elles|leur|sa|aussi|au|qu'|jamais|plus|je|tu|il|elle|nous|vous|ils|elles)\b/i;

    // Common words untuk German
    const germanWords = /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|Die|eine|als|auch|es|an|werden|aus|er|hat|daß|sie|nach|wird|bei|einer|Um|am|sind|noch|wie|einem|über|einen|so|Sie|zum|war|haben|nur|oder|aber|vor|zur|bis|mehr|durch|man|sein|wurde|sei|In|Prozent|hatte|kann|gegen|vom|können|schon|wenn|habe|seine|Mark|ihre|dann|unter|wir|soll|ich|eines|es|Jahr|zwei|Jahren|diese|dieser|wieder|keine|Uhr|seiner|worden|Und|will|zwischen|Im|immer|Millionen|Ein|was|sagte|gibt|Einreisende|Millionen|zwar|Beamten|Leute|Kopf|Teile|Körper|Arzt|Patienten|Ende|Arme|Bein|Lage|Bild|Fläche|Punkt|Politik|schließlich|Einträge|Länder|Bürger|Prozent|Wahlen|Kampf|Kreis|Idee|Verlag|Verlauf|Bereich|Erklärung|Punkt|Frage|gerade|Bruder|Weise|Geschichte|Kirche|Preis|Preis|Mittel|Einfluß|trat|Anteil|Mitglieder|Verfahren|Sprache|Blick|Arbeit|Gesicht|Angabe|Form|Ergebnis|Unternehmen)\b/i;

    // Check untuk word-based languages
    if (indonesianWords.test(text)) return 'id';
    if (englishWords.test(text)) return 'en';
    if (spanishWords.test(text)) return 'es';
    if (frenchWords.test(text)) return 'fr';
    if (germanWords.test(text)) return 'de';

    return null;
  };

  // Auto-apply speed berdasarkan language
  const getAutoSpeedForLanguage = (langCode) => {
    const speedMap = {
      'id': 0.95,  // Natural Indonesian pace
      'en': 0.95,  // Natural English pace
      'es': 1.0,   // Spanish slightly faster
      'fr': 0.95,  // French normal pace
      'de': 0.9,   // German slightly slower
      'it': 1.0,   // Italian slightly faster
      'pt': 0.95,  // Portuguese normal
      'ru': 0.9,   // Russian slower
      'ja': 0.85,  // Japanese slower
      'ko': 0.9,   // Korean slower
      'zh': 0.85,  // Chinese slower
      'ar': 0.95,  // Arabic normal
      'hi': 0.95,  // Hindi normal
      'th': 0.9,   // Thai slower
      'vi': 0.95,  // Vietnamese normal
      'pl': 0.9,   // Polish slower
      'tr': 0.95,  // Turkish normal
    };
    return speedMap[langCode] || 0.95;
  };

  // Detect language switching commands - e.g., "jawab bahasa china", "respond in english", "parla italiano"
  const detectLanguageSwitchCommand = (text) => {
    if (!text) return null;

    const lowerText = text.toLowerCase().trim();

    // Indonesian language switch commands
    const indonesianSwitches = {
      'china': 'zh', 'mandarin': 'zh', 'chinese': 'zh',
      'inggris': 'en', 'english': 'en', 'ingris': 'en',
      'spanyol': 'es', 'spanish': 'es',
      'prancis': 'fr', 'francis': 'fr', 'french': 'fr',
      'jerman': 'de', 'german': 'de',
      'italia': 'it', 'itali': 'it', 'italian': 'it',
      'portugal': 'pt', 'portuguese': 'pt',
      'rusia': 'ru', 'russian': 'ru',
      'jepang': 'ja', 'japan': 'ja', 'japanese': 'ja',
      'korea': 'ko', 'korean': 'ko',
      'arab': 'ar', 'arabic': 'ar',
      'hindi': 'hi',
      'thai': 'th', 'thailand': 'th',
      'vietnam': 'vi', 'vietnamese': 'vi',
      'polandia': 'pl', 'polish': 'pl',
      'turki': 'tr', 'turkish': 'tr',
    };

    // English language switch commands
    const englishSwitches = {
      'chinese': 'zh', 'mandarin': 'zh', 'china': 'zh',
      'english': 'en', 'english only': 'en',
      'spanish': 'es', 'spain': 'es',
      'french': 'fr', 'france': 'fr',
      'german': 'de', 'germany': 'de',
      'italian': 'it', 'italy': 'it',
      'portuguese': 'pt', 'portugal': 'pt',
      'russian': 'ru', 'russia': 'ru',
      'japanese': 'ja', 'japan': 'ja',
      'korean': 'ko', 'korea': 'ko',
      'arabic': 'ar', 'arab': 'ar',
      'hindi': 'hi',
      'thai': 'th', 'thailand': 'th',
      'vietnamese': 'vi', 'vietnam': 'vi',
      'polish': 'pl', 'poland': 'pl',
      'turkish': 'tr', 'turkey': 'tr',
    };

    // Command patterns - look for "jawab bahasa X", "respond in X", "parla X", etc.
    const patterns = [
      /(?:jawab|respond|answer|speak|parla|habla|parler|sprich)\s+(?:bahasa\s+)?(\w+)/i,
      /(?:switch|ganti|ubah|change|cambiar|changer|wechsel)\s+(?:to|ke|a)?\s*(?:bahasa\s+)?(\w+)/i,
      /(?:gunakan|use|usa|utiliza)\s+(?:bahasa\s+)?(\w+)/i,
    ];

    for (const pattern of patterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const langName = match[1].toLowerCase().trim();
        
        // Check Indonesian switches first
        if (indonesianSwitches[langName]) {
          return { language: indonesianSwitches[langName], detected: true };
        }
        
        // Check English switches
        if (englishSwitches[langName]) {
          return { language: englishSwitches[langName], detected: true };
        }

        // Direct language code
        if (['id', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi', 'th', 'vi', 'pl', 'tr'].includes(langName)) {
          return { language: langName, detected: true };
        }
      }
    }

    return null;
  };

  // Auto-tone setter berdasarkan personality
  const applyAutoTone = (personality = selectedPersonality) => {
    if (autoToneEnabled && personalityConfigs[personality]) {
      const config = personalityConfigs[personality];
      // Random dalam range untuk setiap response - terasa lebih natural
      const randomRate = config.rateRange[0] + Math.random() * (config.rateRange[1] - config.rateRange[0]);
      const randomPitch = config.pitchRange[0] + Math.random() * (config.pitchRange[1] - config.pitchRange[0]);
      
      setTtsRate(parseFloat(randomRate.toFixed(2)));
      setTtsPitch(parseFloat(randomPitch.toFixed(2)));
      
      return { rate: randomRate, pitch: randomPitch };
    }
    return { rate: ttsRate, pitch: ttsPitch };
  };

  // Change personality
  const handlePersonalityChange = (newPersonality) => {
    setSelectedPersonality(newPersonality);
    if (autoToneEnabled) {
      applyAutoTone(newPersonality);
    }
  };

  // Clean text untuk TTS - remove emojis, symbols, special chars
  const cleanTextForSpeech = (text) => {
    if (!text) return '';
    
    // Remove emojis dan symbols
    let cleaned = text
      // Remove emojis (comprehensive range)
      .replace(/[\p{Emoji}]/gu, '')
      // Remove decorative symbols: *, #, @, $, %, &, ^, ~, |, \, `, =, +, etc
      .replace(/[*#@$%&^~|\\`=+[\]{}()<>]/g, '')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    return cleaned;
  };

  // Load available voices dan filter berdasarkan language
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      const targetLang = getLanguageLang(selectedLanguage);
      const langPrefix = targetLang.split('-')[0]; // e.g., 'en', 'id', 'es'
      
      console.log(`[VOICE_LOAD] Loading voices for language: ${selectedLanguage} (${targetLang})`);
      
      // Filter voices untuk language yang dipilih
      const langVoices = voices.filter(voice => voice.lang.startsWith(langPrefix));
      
      console.log(`[VOICE_LOAD] Found ${langVoices.length} voices for ${langPrefix}`);
      
      if (langVoices.length > 0) {
        // Try to find female voice first
        const femaleVoices = langVoices.filter(voice => {
          const voiceName = voice.name.toLowerCase();
          return voiceName.includes('female') || 
                 voiceName.includes('woman') || 
                 voiceName.includes('girl') ||
                 voiceName.includes('fiona') ||
                 voiceName.includes('victoria') ||
                 voiceName.includes('moira') ||
                 voiceName.includes('samantha') ||
                 voiceName.includes('karen') ||
                 voiceName.includes('zira') ||
                 voiceName.includes('claire') ||
                 voiceName.includes('susan') ||
                 voiceName.includes('amy') ||
                 voiceName.includes('anna');
        });
        
        setAvailableVoices(femaleVoices.length > 0 ? femaleVoices : langVoices);
        console.log(`[VOICE_LOAD] Selected voice: ${(femaleVoices.length > 0 ? femaleVoices[0] : langVoices[0]).name}`);
      } else {
        // Fallback ke semua voices
        console.log(`[VOICE_LOAD] No voices found for ${langPrefix}, falling back to all voices`);
        setAvailableVoices(voices);
      }
      
      setSelectedVoiceIndex(0);
    };

    // Load immediately
    loadVoices();
    
    // Also load when voices change (some systems load them async)
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedLanguage]);

  // Initialize Web Speech API
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = getLanguageLang(selectedLanguage);

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setTranscript((prev) => prev + transcript);
          } else {
            interim += transcript;
          }
        }
        if (interim) setTranscript((prev) => prev.split('\n')[0] + interim);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [selectedLanguage]);

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isAIResponding) {
      recognitionRef.current.start();
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.abort();
      setIsListening(false);
    }
  };

  const speak = (text, overrideLangCode = null, overrideRate = null, overridePitch = null) => {
    return new Promise((resolve) => {
      // Cancel any ongoing speech
      synthRef.current.cancel();

      // Clean text dari emojis dan symbols sebelum dibaca
      const cleanedText = cleanTextForSpeech(text);
      
      // Skip jika text kosong setelah cleaning
      if (!cleanedText.trim()) {
        resolve();
        return;
      }

      // Use override values or current state
      const langCode = overrideLangCode || selectedLanguage;
      
      // Auto-apply tone berdasarkan personality atau gunakan override
      let finalRate, finalPitch;
      if (overrideRate !== null && overridePitch !== null) {
        finalRate = overrideRate;
        finalPitch = overridePitch;
      } else {
        const currentTone = autoToneEnabled ? applyAutoTone() : { rate: ttsRate, pitch: ttsPitch };
        finalRate = currentTone.rate;
        finalPitch = currentTone.pitch;
      }

      const utterance = new SpeechSynthesisUtterance(cleanedText);
      utterance.lang = getLanguageLang(langCode);
      
      // Get voices untuk language yang specified
      const voices = window.speechSynthesis.getVoices();
      const targetLang = getLanguageLang(langCode);
      const langPrefix = targetLang.split('-')[0];
      const langVoices = voices.filter(voice => voice.lang.startsWith(langPrefix));
      
      // Cari female voice untuk language yang specified
      let selectedVoice = null;
      if (langVoices.length > 0) {
        const femaleVoices = langVoices.filter(voice => {
          const voiceName = voice.name.toLowerCase();
          return voiceName.includes('female') || 
                 voiceName.includes('woman') || 
                 voiceName.includes('girl') ||
                 voiceName.includes('fiona') ||
                 voiceName.includes('victoria') ||
                 voiceName.includes('moira') ||
                 voiceName.includes('samantha') ||
                 voiceName.includes('karen') ||
                 voiceName.includes('zira') ||
                 voiceName.includes('claire') ||
                 voiceName.includes('susan') ||
                 voiceName.includes('amy') ||
                 voiceName.includes('anna');
        });
        selectedVoice = femaleVoices.length > 0 ? femaleVoices[0] : langVoices[0];
      }
      
      if (selectedVoice) {
        console.log(`[VOICE] Using: ${selectedVoice.name} | Lang: ${selectedVoice.lang} | Rate: ${finalRate} | Pitch: ${finalPitch} | Personality: ${selectedPersonality}`);
        utterance.voice = selectedVoice;
      }
      
      utterance.rate = finalRate;
      utterance.pitch = finalPitch;
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  };

  const sendMessage = async () => {
    if (!transcript.trim() || isAIResponding || isListening) return;

    const userMessage = transcript;
    
    // Check untuk language switching command dulu
    const langSwitch = detectLanguageSwitchCommand(userMessage);
    if (langSwitch && langSwitch.language !== selectedLanguage) {
      console.log(`[VoiceChat] Language switch detected: switching to ${langSwitch.language}`);
      
      // Get speed untuk language yang akan di-switch
      const autoSpeed = getAutoSpeedForLanguage(langSwitch.language);
      
      // Add user message to chat
      setTranscript('');
      setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
      
      // Update state untuk future responses
      setSelectedLanguage(langSwitch.language);
      setTtsRate(autoSpeed);
      
      // Wait untuk voices to load
      setIsAIResponding(true);
      const confirmationMessages = {
        'id': 'Baik, saya siap menjawab dalam Bahasa Indonesia.',
        'en': 'Sure, I will respond in English.',
        'es': 'De acuerdo, responderé en español.',
        'fr': 'D\'accord, je répondrai en français.',
        'de': 'In Ordnung, ich antworte auf Deutsch.',
        'it': 'Va bene, risponderò in italiano.',
        'pt': 'Certo, responderei em português.',
        'ru': 'Хорошо, я буду отвечать на русском.',
        'ja': 'わかりました、日本語で答えます。',
        'ko': '좋습니다. 한국어로 답하겠습니다.',
        'zh': '好的，我会用中文回答。',
        'ar': 'حسناً، سأرد باللغة العربية.',
        'hi': 'ठीक है, मैं हिंदी में जवाब दूंगा।',
        'th': 'ได้ครับ ฉันจะตอบเป็นภาษาไทย',
        'vi': 'Tốt, tôi sẽ trả lời bằng tiếng Việt.',
        'pl': 'Dobrze, będę odpowiadać po polsku.',
        'tr': 'Tamam, Türkçe ile cevap vereceğim.',
      };
      
      const confirmMsg = confirmationMessages[langSwitch.language] || 'Language switched.';
      
      // Wait a bit for voices to load
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Speak confirmation in new language - passing language and speed as parameters
      await speak(confirmMsg, langSwitch.language, autoSpeed, 1.2);
      
      setMessages((prev) => [...prev, { role: 'assistant', text: confirmMsg }]);
      setIsAIResponding(false);
      return;
    }
    
    // Auto-detect language dari user input jika bukan language switch command
    const detectedLang = detectLanguageFromText(userMessage);
    if (detectedLang && detectedLang !== selectedLanguage) {
      console.log(`[VoiceChat] Language auto-detected: ${detectedLang}`);
      const autoSpeed = getAutoSpeedForLanguage(detectedLang);
      
      // Update state untuk future responses
      setSelectedLanguage(detectedLang);
      setTtsRate(autoSpeed);
      setTtsRate(autoSpeed);
    }
    
    setTranscript('');
    setMessages((prev) => [...prev, { role: 'user', text: userMessage }]);
    setIsAIResponding(true);

    try {
      abortControllerRef.current = new AbortController();
      
      let response;
      
      // Route based on authentication status
      if (isAuthenticated && !isGuest) {
        // Authenticated users: use backend with session tracking
        const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api';
        response = await fetch(`${apiBaseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include', // Include auth cookies
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [...messages, { role: 'user', content: userMessage }].map((m) => ({
              role: m.role,
              content: m.text || m.content,
            })),
            temperature: 0.7,
            max_tokens: 2048,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });
      } else {
        // Guest users: use direct Deepseek API
        const deepseekApiKey = import.meta.env.VITE_DEEPSEEK_API_KEY || 'sk-bf333936dd084c5f9016521b1b896610';
        const deepseekUrl = 'https://api.deepseek.com/chat/completions';
        
        response = await fetch(deepseekUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${deepseekApiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [...messages, { role: 'user', content: userMessage }].map((m) => ({
              role: m.role,
              content: m.text || m.content,
            })),
            temperature: 0.7,
            max_tokens: 2048,
            stream: true,
          }),
          signal: abortControllerRef.current.signal,
        });
      }

      if (!response.ok) {
        const error = await response.text();
        console.error('API error:', error);
        throw new Error(`API Error: ${response.status}`);
      }

      let assistantMessage = '';
      let textBuffer = '';
      let speakingPromise = Promise.resolve();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();


      // Helper function untuk extract dan speak sentences
      const processSentenceBuffer = async (buffer, forceSpeak = false) => {
        if (!buffer.trim()) return '';

        // Regex untuk detect sentence endings
        const sentenceMatch = buffer.match(/([^.!?]*[.!?]+\s*)/);
        
        if (sentenceMatch || forceSpeak) {
          // Ada sentence ending atau force speak
          let textToSpeak = '';
          let remainingText = buffer;

          if (sentenceMatch && !forceSpeak) {
            textToSpeak = sentenceMatch[1].trim();
            remainingText = buffer.substring(sentenceMatch[0].length);
          } else if (forceSpeak) {
            // Force speak: speak everything even without ending
            textToSpeak = buffer.trim();
            remainingText = '';
          }

          if (textToSpeak) {
            // Wait untuk previous speech selesai, then speak next
            await speakingPromise;
            speakingPromise = speak(textToSpeak);
          }

          return remainingText;
        }

        return buffer;
      };

      // Process streaming chunks
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.choices?.[0]?.delta?.content) {
                const deltaText = json.choices[0].delta.content;
                assistantMessage += deltaText;
                textBuffer += deltaText;

                // Process buffer untuk check sentence completeness
                textBuffer = await processSentenceBuffer(textBuffer, false);
              }
            } catch (_e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Speak remaining text dalam buffer (untuk text tanpa sentence ending)
      if (textBuffer.trim()) {
        await speakingPromise;
        await speak(textBuffer.trim());
      }

      // Add complete message ke chat
      if (assistantMessage) {
        setMessages((prev) => [...prev, { role: 'assistant', text: assistantMessage }]);
      }
    } catch (error) {
      console.error('Voice chat error:', error);
      if (error.name !== 'AbortError') {
        const errorMsg = userLanguage === 'id' ? 'Terjadi kesalahan saat merespon' : 'Error generating response';
        setMessages((prev) => [...prev, { role: 'assistant', text: errorMsg }]);
      }
    } finally {
      setIsAIResponding(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !isListening) {
      sendMessage();
    }
  };

  return (
    <div className="voice-chat-overlay">
      <div className="voice-chat-container">
        <div className="voice-chat-header">
          <h2>🎙️ {userLanguage === 'id' ? 'Obrolan Suara' : 'Voice Chat'}</h2>
          <div className="voice-header-actions">
            <button 
              className="voice-settings-btn" 
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              title={userLanguage === 'id' ? 'Pengaturan suara' : 'Voice settings'}
            >
              ⚙️
            </button>
            <button className="voice-close-btn" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        {/* Voice Settings Panel */}
        {showVoiceSettings && (
          <div className="voice-settings-panel">
            {/* Language Selection */}
            <div className="settings-group">
              <label className="settings-label">
                {userLanguage === 'id' ? '🌍 Pilih Bahasa:' : '🌍 Select Language:'}
              </label>
              <select 
                className="voice-select"
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value)}
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name} - {lang.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Selection */}
            <div className="settings-group">
              <label className="settings-label">
                {userLanguage === 'id' ? '👤 Pilih Suara:' : '👤 Select Voice:'}
              </label>
              <select 
                className="voice-select"
                value={selectedVoiceIndex}
                onChange={(e) => setSelectedVoiceIndex(parseInt(e.target.value))}
                disabled={availableVoices.length === 0}
              >
                {availableVoices.map((voice, idx) => (
                  <option key={idx} value={idx}>
                    {voice.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Personality Selection */}
            <div className="settings-group">
              <label className="settings-label">
                {userLanguage === 'id' ? '😊 Pilih Kepribadian:' : '😊 Select Personality:'}
              </label>
              <div className="personality-buttons">
                {Object.entries(personalityConfigs).map(([key, config]) => (
                  <button
                    key={key}
                    className={`personality-btn ${selectedPersonality === key ? 'active' : ''}`}
                    onClick={() => handlePersonalityChange(key)}
                    title={config.name}
                  >
                    {key === 'formal' && '🎩'}
                    {key === 'professional' && '💼'}
                    {key === 'natural' && '😊'}
                    {key === 'friendly' && '😄'}
                    {key === 'casual' && '👋'}
                    {key === 'energetic' && '⚡'}
                    {key === 'calm' && '🧘'}
                    {key === 'storyteller' && '📖'}
                  </button>
                ))}
              </div>
            </div>

            {/* Auto Tone Toggle */}
            <div className="settings-group">
              <label className="settings-checkbox">
                <input 
                  type="checkbox" 
                  checked={autoToneEnabled}
                  onChange={(e) => setAutoToneEnabled(e.target.checked)}
                />
                <span>{userLanguage === 'id' ? '🤖 AI Otomatis Pilih Kecepatan & Nada' : '🤖 AI Auto Select Speed & Pitch'}</span>
              </label>
              <span className="settings-hint">{userLanguage === 'id' ? 'AI akan sesuaikan suara sesuai personality' : 'AI adjusts voice based on personality'}</span>
            </div>

            {/* Manual Speed Control (if auto is off) */}
            {!autoToneEnabled && (
              <>
                <div className="settings-group">
                  <label className="settings-label">
                    {userLanguage === 'id' ? '⏱️ Kecepatan: ' : '⏱️ Speed: '} {ttsRate.toFixed(1)}x
                  </label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={ttsRate}
                    onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                    className="settings-slider"
                  />
                </div>

                <div className="settings-group">
                  <label className="settings-label">
                    {userLanguage === 'id' ? '🎵 Nada: ' : '🎵 Pitch: '} {ttsPitch.toFixed(1)}
                  </label>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2" 
                    step="0.1" 
                    value={ttsPitch}
                    onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                    className="settings-slider"
                  />
                </div>
              </>
            )}

            {/* Test Button */}
            <button 
              className="voice-test-btn"
              onClick={() => speak(selectedLanguage === 'id' ? 'Halo, ini adalah suara coba dengan AI otomatis' : 'Hello, this is a test voice with AI auto selection')}
              disabled={isSpeaking}
            >
              {isSpeaking ? (userLanguage === 'id' ? '🔊 Sedang Mendengar...' : '🔊 Playing...') : (userLanguage === 'id' ? '🔊 Coba Suara' : '🔊 Test Voice')}
            </button>
          </div>
        )}

        <div className="voice-chat-messages">
          {messages.length === 0 && (
            <div className="voice-chat-welcome">
              <div className="welcome-icon">🎤</div>
              <p>{userLanguage === 'id' ? 'Mulai berbicara...' : 'Start speaking...'}</p>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`voice-message ${msg.role}`}>
              <div className="voice-message-avatar">{msg.role === 'user' ? '👤' : '🤖'}</div>
              <div className="voice-message-text">{msg.text}</div>
            </div>
          ))}
          {isAIResponding && (
            <div className="voice-message-loading">
              <div className="voice-loading-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>{userLanguage === 'id' ? 'AI sedang merespon...' : 'AI is responding...'}</span>
            </div>
          )}
        </div>

        <div className="voice-chat-input">
          <input
            type="text"
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={userLanguage === 'id' ? 'Atau ketik pesan...' : 'Or type message...'}
            disabled={isAIResponding}
          />
          <button
            className={`voice-button ${isListening ? 'listening' : ''}`}
            onClick={isListening ? stopListening : startListening}
            disabled={isAIResponding}
            title={isListening ? (userLanguage === 'id' ? 'Hentikan' : 'Stop') : (userLanguage === 'id' ? 'Dengarkan' : 'Listen')}
          >
            {isListening ? '⏹️' : '🎤'}
          </button>
          <button
            className="voice-send-btn"
            onClick={sendMessage}
            disabled={!transcript.trim() || isAIResponding || isListening}
            title={userLanguage === 'id' ? 'Kirim' : 'Send'}
          >
            ➤
          </button>
        </div>

        {isSpeaking && (
          <div className="voice-speaking-indicator">
            🔊 {userLanguage === 'id' ? 'AI sedang berbicara...' : 'AI is speaking...'}
          </div>
        )}
      </div>
    </div>
  );
};

export default VoiceChat;
