/**
 * Mock Deepseek API Server
 * Simulasi API Deepseek lokal untuk testing tanpa API key eksternal
 */

import express from 'express';

const app = express();
const PORT = 3002;

app.use(express.json());

/**
 * POST /v1/chat/completions
 * Mock endpoint yang meniru Deepseek API response
 */
app.post('/v1/chat/completions', (req, res) => {
  const { messages, model, stream } = req.body;

  console.log('[mock-deepseek] Chat request:', {
    model,
    messagesCount: messages?.length,
    stream
  });

  // Extract user message
  const userMessage = messages?.find(m => m.role === 'user')?.content || 'No message';

  // Generate mock response based on user input
  let responseContent = 'Saya adalah Orion, asisten AI dari DeepernNova.';

  if (userMessage.toLowerCase().includes('founder') || userMessage.toLowerCase().includes('pendiri')) {
    responseContent = 'Founder DeepernNova adalah Ferry Fernando. DeepernNova adalah perusahaan AI yang berbasis di Indonesia dengan fokus pada solusi teknologi terdepan.';
  } else if (userMessage.toLowerCase().includes('siapa')) {
    responseContent = 'Saya adalah Orion, asisten AI yang dibangun oleh DeepernNova. Saya dirancang untuk membantu dengan informasi dan tugas-tugas berbasis AI.';
  } else if (userMessage.toLowerCase().includes('apa itu deepernova')) {
    responseContent = 'DeepernNova adalah perusahaan teknologi AI yang menyediakan solusi cerdas untuk bisnis modern. Kami berkomitmen memberikan layanan terbaik dengan teknologi terdepan.';
  }

  // If streaming requested, send as SSE
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Send response in chunks
    const words = responseContent.split(' ');

    const sendChunk = (index) => {
      if (index < words.length) {
        const chunk = {
          id: 'mock_' + Date.now(),
          object: 'text_completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'deepseek-v3',
          choices: [
            {
              index: 0,
              delta: {
                content: index === 0 ? responseContent : words[index] + (index < words.length - 1 ? ' ' : '')
              },
              finish_reason: null
            }
          ]
        };

        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        setTimeout(() => sendChunk(index + 1), 50);
      } else {
        // Final chunk
        res.write(`data: ${JSON.stringify({
          id: 'mock_' + Date.now(),
          object: 'text_completion',
          created: Math.floor(Date.now() / 1000),
          model: 'deepseek-v3',
          choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
          usage: { prompt_tokens: 10, completion_tokens: responseContent.split(' ').length, total_tokens: 10 + responseContent.split(' ').length }
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
      }
    };

    sendChunk(0);
  } else {
    // Non-streaming response
    const response = {
      id: 'mock_' + Date.now(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'deepseek-v3',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: responseContent
          },
          finish_reason: 'stop'
        }
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: responseContent.split(' ').length,
        total_tokens: 10 + responseContent.split(' ').length
      }
    };

    console.log('[mock-deepseek] Sending response:', responseContent.substring(0, 50) + '...');
    res.json(response);
  }
});

/**
 * GET /health
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'Mock Deepseek API' });
});

app.listen(PORT, () => {
  console.log(`🎭 Mock Deepseek API running on http://localhost:${PORT}`);
  console.log(`   This server simulates Deepseek API for local testing`);
});
