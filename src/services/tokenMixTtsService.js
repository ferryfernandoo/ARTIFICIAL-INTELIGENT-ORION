/**
 * TokenMix Text-to-Speech Service
 * Converts text to speech using TokenMix API
 */

const TOKENMIX_API_URL = 'https://api.tokenmix.ai/v1/audio/speech';
const HARDCODED_TOKENMIX_API_KEY = 'sk-tm-FX6bbFVk7eG7wK9JF8wqYvSa1PBWPgyDTllws7KE4FAvUuaX';

class TokenMixTtsService {
  constructor() {
    this.cache = new Map();  // Cache audio URLs by text hash
    this.isPlaying = false;
    this.currentAudio = null;
    this.apiKey = import.meta.env.VITE_TOKENMIX_API_KEY || HARDCODED_TOKENMIX_API_KEY;
  }

  /**
   * Detect if text is primarily Indonesian
   */
  detectLanguage(text) {
    // Indonesian keyword patterns
    const indonesianKeywords = [
      'yang', 'untuk', 'dengan', 'ini', 'adalah', 'dari', 'ke', 'di',
      'apa', 'siapa', 'bagaimana', 'mengapa', 'berapa', 'kapan',
      'atau', 'dan', 'tidak', 'ada', 'bisa', 'akan', 'sudah',
      'terima', 'mohon', 'tolong', 'terima kasih', 'sama-sama'
    ];
    
    const lowerText = text.toLowerCase();
    let indonesianCount = 0;
    
    for (const keyword of indonesianKeywords) {
      if (lowerText.includes(keyword)) {
        indonesianCount++;
      }
    }
    
    // If 3+ Indonesian keywords found, consider it Indonesian
    return indonesianCount >= 3;
  }

  /**
   * Select optimal voice for language
   * Indonesian sounds best with 'nova' voice
   */
  selectVoiceForLanguage(text) {
    const isIndonesian = this.detectLanguage(text);
    if (isIndonesian) {
      return 'nova'; // Best for Indonesian language
    }
    return 'alloy'; // Default for English
  }

  /**
   * Generate hash for text to use as cache key
   */
  generateHash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Text to Speech - fetch audio from TokenMix API
   * @param {string} text - Text to convert to speech
   * @param {string} voice - Voice option: 'alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer' (auto-detected if not provided)
   * @returns {Promise<Blob>} Audio blob
   */
  async textToSpeech(text, voice = null) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error('Text is required for TTS');
      }

      // Auto-detect voice if not provided
      const selectedVoice = voice || this.selectVoiceForLanguage(text);
      console.log('[TTS] 🌍 Language detected, using voice:', selectedVoice);

      // Check cache first
      const cacheKey = `${this.generateHash(text)}_${selectedVoice}`;
      if (this.cache.has(cacheKey)) {
        console.log('[TTS] � Using cached audio for:', text.substring(0, 50));
        return this.cache.get(cacheKey);
      }

      console.log('[TTS] 🎤 Generating speech for:', text.substring(0, 80));

      // Limit text to prevent API timeout (max ~3000 chars for full response)
      // TokenMix API can handle longer text, we just need to avoid extremely long single requests
      const MAX_CHARS = 3000;
      const truncatedText = text.length > MAX_CHARS ? text.substring(0, MAX_CHARS) + '...' : text;
      
      if (text.length > MAX_CHARS) {
        console.log('[TTS] ⚠️ Text truncated from', text.length, 'to', MAX_CHARS, 'characters');
      }

      const response = await fetch(TOKENMIX_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: truncatedText,
          voice: selectedVoice
        })
      });

      if (!response.ok) {
        console.error(`[TTS] API error: ${response.status}`);
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `TTS API error: ${response.status}`);
      }

      // Get audio blob
      const audioBlob = await response.blob();

      // Cache it
      this.cache.set(cacheKey, audioBlob);
      console.log('[TTS] ✅ Speech generated successfully');

      return audioBlob;
    } catch (error) {
      console.error('[TTS] Error:', error.message);
      throw error;
    }
  }

  /**
   * Play audio blob
   * @param {Blob} audioBlob - Audio blob to play
   * @param {Function} onEnded - Callback when audio finishes
   */
  play(audioBlob, onEnded) {
    try {
      // Stop current audio if playing
      if (this.currentAudio) {
        this.stop();
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      this.currentAudio = new Audio(audioUrl);
      this.isPlaying = true;

      this.currentAudio.onended = () => {
        this.isPlaying = false;
        if (onEnded) onEnded();
        URL.revokeObjectURL(audioUrl);
      };

      this.currentAudio.onerror = (error) => {
        console.error('[TTS] Playback error:', error);
        this.isPlaying = false;
        URL.revokeObjectURL(audioUrl);
      };

      this.currentAudio.play();
      console.log('[TTS] ▶️ Playing audio');
    } catch (error) {
      console.error('[TTS] Playback error:', error);
      this.isPlaying = false;
      throw error;
    }
  }

  /**
   * Stop playing audio
   */
  stop() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.isPlaying = false;
      console.log('[TTS] ⏹️ Audio stopped');
    }
  }

  /**
   * Check if audio is currently playing
   */
  getIsPlaying() {
    return this.isPlaying;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    console.log('[TTS] 🗑️ Cache cleared');
  }
}

// Export singleton instance
export const tokenMixTtsService = new TokenMixTtsService();
export default tokenMixTtsService;
