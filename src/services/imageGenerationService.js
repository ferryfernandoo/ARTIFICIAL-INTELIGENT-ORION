/**
 * Image Generation Service
 * Handles image generation using TokenMix API (imagen-4-fast)
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const fetchWithTimeout = (url, options, timeoutMs = 60000) => {
  const timeoutId = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs)
  );
  
  const fetchPromise = fetch(url, options);
  
  // If abort signal is provided, we can still respect it
  if (options?.signal) {
    return Promise.race([fetchPromise, timeoutId]);
  }
  
  return Promise.race([fetchPromise, timeoutId]);
};

class ImageGenerationService {
  /**
   * Generate image using TokenMix API through backend proxy
   * @param {string} prompt - Detailed image description/prompt
   * @param {string} size - Image size (1024x1024, 512x512, etc.)
   * @param {string} sessionId - Chat session ID for persistence
   * @param {string} model - Model to use for generation
   * @param {AbortSignal} abortSignal - Signal to abort the request
   * @returns {Promise<Object>} Generated image data with reasoning
   */
  static async generateImage(prompt, size = '1024x1024', sessionId = null, model = 'imagen-4-fast', abortSignal = null) {
    try {
      const finalPrompt = this.enhancePrompt(prompt);
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] generateImage() called with prompt:', finalPrompt.substring(0, 60));
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] size:', size, 'sessionId:', sessionId, 'model:', model);
      
      const apiUrl = `${API_BASE_URL}/api/images/generate`;
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] Making API call to:', apiUrl);
      
      const fetchOptions = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          prompt: finalPrompt,
          size,
          model,
          sessionId,
        }),
      };

      // Add abort signal if provided
      if (abortSignal) {
        fetchOptions.signal = abortSignal;
      }
      
      const response = await fetchWithTimeout(
        apiUrl,
        fetchOptions,
        60000
      );

      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] Got response:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.text();
        console.error('🔴🔴🔴 [IMAGE_GEN_DEBUG] API error:', error);
        throw new Error(`Image generation failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] Full response data:', JSON.stringify(data, null, 2));
      
      const imageUrl = data?.image?.url;
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] Extracted imageUrl:', imageUrl);
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] data.image:', data?.image);
      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] data.image?.id:', data?.image?.id);
      
      if (!imageUrl) {
        console.error('🔴🔴🔴 [IMAGE_GEN_DEBUG] No image URL in response:', data);
        throw new Error('Image generation service returned no image URL');
      }

      console.log('🔴🔴🔴 [IMAGE_GEN_DEBUG] ✅ Image URL:', imageUrl.substring(0, 80));
      return data;
    } catch (error) {
      console.error('🔴🔴🔴 [IMAGE_GEN_DEBUG] Error caught:', error);
      throw error;
    }
  }

  /**
   * Detect image generation request from user message
   * @param {string} userMessage - User's message
   * @returns {Object|null} { type: 'image', prompt: string, size: string } or null
   */
  static detectImageRequest(userMessage) {
    if (!userMessage) return null;

    const lowerMessage = userMessage.toLowerCase();
    console.log('[IMAGE_DETECT] Checking message:', lowerMessage.substring(0, 100));

    // Explicit [IMAGE_REQUEST: ...] directive from user - CHECK FIRST
    const explicitPattern = /\[IMAGE_REQUEST:\s*([^\]]+)\]/i;
    const explicitMatch = userMessage.match(explicitPattern);
    if (explicitMatch && explicitMatch[1]) {
      const explicitPayload = explicitMatch[1].trim();
      const cleanedMessage = userMessage.replace(explicitPattern, '').trim();
      const lowerPayload = explicitPayload.toLowerCase();
      const markerOnly = [
        'explain', 'trigger', 'image_request', 'image request', 'generate', 'go', 'now', 'run'
      ].includes(lowerPayload) && cleanedMessage.length > 0;
      const suggestedSize = this.parseRequestedSize(explicitPayload) || this.parseRequestedSize(cleanedMessage);
      let prompt = markerOnly ? cleanedMessage : explicitPayload;
      if (prompt.length >= 2) {
        prompt = prompt.replace(/\b(?:8k|4k|1024x1024|1280x1280|512x512|768x768)\b/gi, '').trim();
        console.log('[IMAGE_DETECT] ✅ EXPLICIT [IMAGE_REQUEST: ...] detected - using this, ignoring all other patterns');
        console.log('[IMAGE_DETECT] ✅ Prompt:', prompt, 'Size:', suggestedSize, 'markerOnly:', markerOnly);
        return {
          type: 'image',
          prompt,
          size: suggestedSize || '1024x1024',
          detected: true,
          isExplicit: true,
          messageWithoutDirective: cleanedMessage || prompt,
        };
      }
    }

    // Fallback detection for simple "buat gambar" trigger phrases
    const fallbackTriggerPattern = /\b(?:buat|buatkan|buatnya|gambarin|gambarkan|gambarinya|lukis|lukiskan|lukisan)\s+(?:gambar|image|foto|design|ilustrasi|visual)\b/i;
    const fallbackMatch = lowerMessage.match(fallbackTriggerPattern);
    if (fallbackMatch && fallbackMatch.index != null) {
      const promptCandidate = userMessage.slice(fallbackMatch.index + fallbackMatch[0].length).trim();
      if (promptCandidate.length >= 2) {
        const cleanedPrompt = this.cleanImagePrompt(promptCandidate.replace(/\s+ukuran.+$/i, '').trim());
        console.log('[IMAGE_DETECT] ✅ Fallback trigger detected, prompt extracted:', cleanedPrompt);
        return {
          type: 'image',
          prompt: cleanedPrompt,
          size: '1024x1024',
          detected: true,
          isExplicit: false,
        };
      }
    }

    // Indonesian patterns - with verb variations (buat, buatkan, buatnya, gambarin, lukisan, etc)
    const indonesianPatterns = [
      // "buat[kan/nya] gambar/foto/design/ilustrasi/visual [tentang] ..."
      /(?:buat|buatkan|buatnya)\s+(?:gambar|image|foto|design|ilustrasi|visual)\s+(?:tentang\s+)?(.+?)(?:\s+ukuran\s+|$)/i,
      // "gambarin/gambarkan/gambarinya ..."
      /(?:gambar|gambarin|gambarkan|gambarinya)\s+(.+?)(?:\s+ukuran\s+|$)/i,
      // "lukisan/lukis/lukiskan ..."
      /(?:lukis|lukiskan|lukisan|lukisinya)\s+(.+?)(?:\s+ukuran\s+|$)/i,
      // "generate gambar/image/foto ..."
      /generate\s+(?:gambar|image|foto)\s+(.+?)(?:\s+ukuran\s+|$)/i,
      // Direct "gambar [noun]" like "gambar gunung"
      /^gambar\s+(.+?)(?:\s+ukuran\s+|$)/i,
      // "desain/desainkan ..."
      /(?:desain|desainkan|desainnya)\s+(.+?)(?:\s+ukuran\s+|$)/i,
    ];

    // English patterns
    const englishPatterns = [
      /(?:generate|create|make|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo|artwork|illustration)\s+(?:of\s+)?(.+?)(?:\s+size\s+|$)/i,
      /(?:draw|paint|illustrate)\s+(?:an?\s+)?(.+?)(?:\s+size\s+|$)/i,
      /(?:show|display)\s+(?:an?\s+)?(?:image|picture|visual|artwork)\s+(?:of\s+)?(.+?)(?:\s+size\s+|$)/i,
      // Direct patterns
      /^(?:image|picture|photo)\s+(?:of\s+)?(.+?)(?:\s+size\s+|$)/i,
    ];

    // All patterns - only checked if no explicit directive found
    const allPatterns = [...indonesianPatterns, ...englishPatterns];

    for (const pattern of allPatterns) {
      const match = lowerMessage.match(pattern);
      if (match && match[1]) {
        let prompt = match[1].trim();
        
        // Skip if prompt is too short
        if (prompt.length < 2) continue;
        
        console.log('[IMAGE_DETECT] ✅ Natural language image request detected:', prompt);
        
        // Extract size if mentioned
        let size = '1024x1024'; // default
        const sizeMatch = lowerMessage.match(/(?:ukuran|size)\s+(\d+x\d+|small|medium|large|xl)/i);
        if (sizeMatch) {
          const sizeValue = sizeMatch[1].toLowerCase();
          const sizeMap = {
            'small': '512x512',
            'medium': '768x768',
            'large': '1024x1024',
            'xl': '1280x1280',
          };
          size = sizeMap[sizeValue] || sizeValue;
        }

        const result = {
          type: 'image',
          prompt: this.cleanImagePrompt(prompt.replace(/\s+ukuran.+$/i, '').trim()),
          size,
          detected: true,
          isExplicit: false,
        };
        
        console.log('[IMAGE_DETECT] Final natural language result:', result);
        return result;
      }
    }
    
    console.log('[IMAGE_DETECT] No image request detected');
    return null;
  }

  /**
   * Clean and normalize extracted image prompt text
   * @param {string} prompt
   * @returns {string}
   */
  static cleanImagePrompt(prompt) {
    if (!prompt || typeof prompt !== 'string') return '';
    
    // Only remove filler words, DO NOT remove commas or clause separators
    // Those are ESSENTIAL for complex detailed prompts
    let cleaned = prompt
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\b(saja|aja|dong|deh|nih|ya|lah|boleh|tolong|tolonglah|sekali|banget|adalah|itu|ini)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // DO NOT split on commas or 'yang' - these are critical for detailed prompts
    // Just return the cleaned version with all details intact
    return cleaned;
  }

  /**
   * Parse requested image size from a text prompt
   * @param {string} prompt
   * @returns {string|null}
   */
  static parseRequestedSize(prompt) {
    if (!prompt || typeof prompt !== 'string') return null;
    const normalized = prompt.toLowerCase();
    if (/\b8k\b/.test(normalized)) return '1280x1280';
    if (/\b4k\b/.test(normalized)) return '1024x1024';
    const explicitSize = normalized.match(/\b(\d+x\d+)\b/);
    if (explicitSize && explicitSize[1]) {
      return explicitSize[1];
    }
    return null;
  }

  /**
   * Generate a high-quality English image prompt from the Indonesian request.
   * @param {string} originalPrompt
   * @returns {Promise<string|null>}
   */
  static async generateEnglishImagePrompt(originalPrompt) {
    if (!originalPrompt || typeof originalPrompt !== 'string') return null;

    try {
      console.log('[IMAGE_GEN] 🚀 Generating English prompt from:', originalPrompt.substring(0, 80));
      const prompt = `You are an expert image prompt engineer. Convert the following Indonesian request into a single clear, high-quality English prompt for an advanced image generation model. Do not include any extra explanation or commentary; output only the prompt itself.\n\nIndonesian request: "${originalPrompt}"`;

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: prompt,
              }
            ],
            stream: false,
            temperature: 0.2,
            max_tokens: 120,
          }),
        },
        30000
      );

      console.log('[IMAGE_GEN] English prompt API response status:', response.status);
      if (!response.ok) {
        console.warn('[IMAGE_GEN] ⚠️ English prompt generation failed (status', response.status, '), falling back to translation');
        return null;
      }

      const data = await response.json();
      const rawPrompt = data.choices?.[0]?.message?.content || null;
      if (!rawPrompt) {
        console.warn('[IMAGE_GEN] ⚠️ No content in English prompt response');
        return null;
      }

      const lines = rawPrompt.trim().split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      let result = lines.join(' ');
      if (result.toLowerCase().startsWith('prompt:')) {
        result = result.replace(/^prompt:\s*/i, '');
      }
      result = result.replace(/^"(.*)"$/s, '$1').replace(/^'(.*)'$/s, '$1').trim();
      console.log('[IMAGE_GEN] ✅ Generated English prompt:', result.substring(0, 100));
      return result || null;
    } catch (error) {
      console.error('[IMAGE_GEN] ❌ Error generating English prompt:', error.message);
      return null;
    }
  }

  /**
   * Generate AI reasoning for image generation process using Orion AI
   * @param {string} originalPrompt - Original user prompt in Indonesian
   * @param {string} englishPrompt - Translated English prompt
   * @returns {Promise<string>} AI-generated reasoning in English
   */
  static async generateAIReasoning(originalPrompt, englishPrompt) {
    try {
      console.log('[IMAGE_GEN] Generating AI reasoning for image generation...');
      
      const reasoningPrompt = `You are Orion AI, an advanced image generation reasoning engine. 

A user requested an image with this description:
- Original request (Indonesian): "${originalPrompt}"
- Translated to English: "${englishPrompt}"

Generate a detailed technical explanation in English of how you would process and generate this image. Include:
1. Analysis of the user's creative intent
2. Translation/conversion process from Indonesian to technical English
3. Visual parameters optimization (resolution, lighting, composition style)
4. Specific visual elements and details to include
5. Quality enhancement techniques that will be applied
6. Final rendering approach and expected quality level

Format your response in a professional but accessible way. Make it sound like you're explaining your thinking process step-by-step.`;

      const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            messages: [
              {
                role: 'user',
                content: reasoningPrompt,
              }
            ],
            stream: false,
            temperature: 0.7,
            max_tokens: 800,
          }),
        },
        30000
      );

      if (!response.ok) {
        console.warn('[IMAGE_GEN] AI reasoning generation failed, using fallback');
        return null;
      }

      const data = await response.json();
      const generatedReasoning = data.choices?.[0]?.message?.content || null;
      
      if (generatedReasoning) {
        console.log('[IMAGE_GEN] AI reasoning generated successfully');
        return generatedReasoning;
      }
      
      return null;
    } catch (error) {
      console.error('[IMAGE_GEN] Error generating AI reasoning:', error);
      return null;
    }
  }

  /**
   * Translate Indonesian text to English for better image model accuracy
   * @param {string} text - Indonesian text to translate
   * @returns {string} English translation
   */
  static translateToEnglish(text) {
    const translationMap = {
      // Animals
      'ayam': 'chicken', 'ayam jantan': 'rooster', 'ayam betina': 'hen', 'bebek': 'duck',
      'sapi': 'cow', 'kuda': 'horse', 'kambing': 'goat', 'kucing': 'cat', 'anjing': 'dog',
      'burung': 'bird', 'ikan': 'fish', 'serigala': 'wolf', 'harimau': 'tiger',
      'singa': 'lion', 'gajah': 'elephant', 'jerapah': 'giraffe', 'kuda nil': 'hippo',
      // Food & Plants
      'kacang tanah': 'peanut', 'kacang': 'peanut', 'nasi': 'rice', 'roti': 'bread',
      'sayuran': 'vegetables', 'buah': 'fruit', 'tanaman': 'plant', 'bunga': 'flower',
      'pohon': 'tree', 'rumput': 'grass', 'sawah': 'rice field', 'pertanian': 'agriculture',
      'persawahan': 'rice field',
      // Places
      'gunung': 'mountain', 'laut': 'sea', 'pantai': 'beach', 'hutan': 'forest',
      'taman': 'garden', 'kota': 'city', 'desa': 'village', 'rumah': 'house',
      'bangunan': 'building', 'jalan': 'road', 'jembatan': 'bridge', 'kolam': 'pond',
      'sungai': 'river', 'danau': 'lake', 'garis pantai': 'coastline',
      // Colors
      'biru': 'blue', 'putih': 'white', 'merah': 'red', 'hijau': 'green',
      'kuning': 'yellow', 'hitam': 'black', 'abu': 'gray', 'coklat': 'brown',
      'oranye': 'orange', 'ungu': 'purple', 'merah jambu': 'pink',
      // Nature & Sky
      'langit': 'sky', 'awan': 'cloud', 'matahari': 'sun', 'bulan': 'moon',
      'bintang': 'star', 'musim panas': 'summer', 'musim dingin': 'winter',
      'musim semi': 'spring', 'musim gugur': 'fall', 'badai': 'storm',
      'hujan': 'rain', 'salju': 'snow', 'es': 'ice', 'api': 'fire',
      // Time
      'pagi': 'morning', 'siang': 'afternoon', 'sore': 'evening', 'malam': 'night',
      'dusk': 'dusk', 'dawn': 'dawn', 'sunrise': 'sunrise', 'sunset': 'sunset',
      // Descriptive
      'indah': 'beautiful', 'indah sekali': 'gorgeous', 'cantik': 'beautiful',
      'bagus': 'good', 'spektakuler': 'spectacular', 'menakjubkan': 'amazing',
      'luar biasa': 'extraordinary', 'epik': 'epic', 'dramatis': 'dramatic',
      'tenang': 'calm', 'damai': 'peaceful', 'sejuk': 'cool', 'cerah': 'bright',
      'gelap': 'dark', 'suram': 'gloomy', 'terang': 'bright', 'bersinar': 'shining',
      // Quality & Style  
      'detail': 'detailed', 'rapi': 'neat', 'terstruktur': 'structured',
      'profesional': 'professional', 'berkualitas': 'quality', 'tajam': 'sharp',
      'jelas': 'clear', 'ultra': 'ultra', '4k': '4K', '8k': '8K', 'hd': 'HD',
      'sinematik': 'cinematic', 'kontras': 'contrast', 'tekstur': 'texture',
      'fotografi': 'photography', 'fotorealistik': 'photorealistic', 'makro': 'macro',
      'close up': 'close-up', 'wide shot': 'wide shot', 'hdr': 'HDR',
      'pencahayaan': 'lighting', 'cahaya': 'light', 'bayangan': 'shadow',
      'blur': 'blur', 'focus': 'focus',
    };

    let result = text.toLowerCase();
    
    // First pass: replace multi-word phrases (more specific)
    Object.keys(translationMap)
      .filter(key => key.includes(' '))
      .sort((a, b) => b.length - a.length)
      .forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        result = result.replace(regex, translationMap[key]);
      });

    // Second pass: replace single-word terms
    Object.keys(translationMap)
      .filter(key => !key.includes(' '))
      .forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        result = result.replace(regex, translationMap[key]);
      });

    console.log('[IMAGE_GEN] Translation map applied. Input:', text.substring(0, 80), '-> Output:', result.substring(0, 80));
    return result;
  }

  /**
   * Generate detailed reasoning for image generation
   * @param {string} prompt - Original user prompt (in Indonesian)
   * @param {string} englishPrompt - English version of the prompt
   * @returns {string} Detailed reasoning about the image
   */
  static generateImageReasoning(prompt, englishPrompt) {
    const reasoningTexts = [
      `🎨 Menganalisis permintaan: "${prompt}"\n\nProses Generasi:\n• Mentransliterasi ke bahasa Inggris untuk akurasi model maksimal: "${englishPrompt}"\n• Mengoptimalkan parameter visual: resolusi 4K, pencahayaan sinematik, komposisi profesional\n• Meningkatkan detail: tekstur, bayangan, perspektif, dan kedalaman\n• Memastikan kualitas output: sharp focus, HDR, color grading profesional\n• Rendering final dengan model imagen-4-fast untuk hasil terbaik`,
      
      `🎨 Memproses permintaan kreatif: "${prompt}"\n\nAlur Generasi Gambar:\n• Interpretasi: Mengubah deskripsi ke prompt teknis: "${englishPrompt}"\n• Penyempurnaan: Menambahkan parameter kualitas (4K, profesional, sinematik)\n• Optimasi Model: Menggunakan imagen-4-fast dengan setting optimal\n• Rendering: Mengaktifkan efek visual (lighting cinematik, kontras tinggi, detail ultra)\n• Finalisasi: Quality check dan sharp focus enhancement`,
      
      `🎨 Mengenerasi visual dari deskripsi: "${prompt}"\n\nMetodologi Generasi:\n• Konversi ke Bahasa Target: "${englishPrompt}" (untuk akurasi model AI)\n• Parameter Teknis: Resolusi 1024x1024, Model imagen-4-fast, Kualitas Ultra\n• Elemen Visual: Pencahayaan profesional, komposisi seimbang, detail hiperrealis\n• Post-Processing: Color correction, contrast enhancement, sharpness boost\n• Hasil: Gambar berkualitas tinggi dengan detail mendalam dan rendering sempurna`,
    ];

    return reasoningTexts[Math.floor(Math.random() * reasoningTexts.length)];
  }

  /**
   * Build image prompt with minimal quality enhancement
   * Keep user intent intact while improving quality slightly
   * @param {string} userPrompt - Original user prompt (should be in English)
   * @returns {string} Minimally enhanced prompt
   */
  static enhancePrompt(userPrompt) {
    // Check if already has quality keywords
    if (userPrompt.match(/detailed|quality|sharp|4k|hd|professional/i)) {
      console.log('[IMAGE_GEN] Prompt already has quality keywords, returning as-is');
      return userPrompt;
    }
    
    // MINIMAL enhancement - only essential keywords that don't override user intent
    // Keep it simple: user says "mountain" -> "mountain, detailed, high quality" NOT "mountain, cinematic, 4K, photorealistic..."
    const minimalEnhancements = ', detailed, high quality, sharp focus';
    
    const enhanced = userPrompt + minimalEnhancements;
    console.log('[IMAGE_GEN] Enhanced prompt minimally:', userPrompt.substring(0, 60), '-> with additions:', minimalEnhancements);
    return enhanced;
  }
}

export default ImageGenerationService;
