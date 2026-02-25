// Vercel Serverless Function for PDF Summarization
// POST /api/summarize - Receives extracted PDF text and returns AI-generated summary

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { text } = req.body;

    // Validate input
    if (!text || text.trim() === '') {
      res.status(400).json({ error: '요약할 텍스트를 입력해주세요.' });
      return;
    }

    // Validate input size (max 500KB to prevent DoS)
    const MAX_TEXT_SIZE = 500 * 1024; // 500KB
    if (text.length > MAX_TEXT_SIZE) {
      res.status(400).json({ error: '텍스트가 너무 깁니다. 500KB 이하의 텍스트만 처리할 수 있습니다.' });
      return;
    }

    // Check API key
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      res.status(500).json({ error: 'API 키가 설정되지 않았습니다.' });
      return;
    }

    // Calculate optimal text length for summarization
    // DeepSeek V3.1 context window: ~32K tokens (≈ 128K characters)
    // Reserve 2K tokens for output, use ~20K tokens for input (≈ 80K characters)
    const MAX_INPUT_CHARS = 80000;
    const truncatedText = text.length > MAX_INPUT_CHARS
      ? text.substring(0, MAX_INPUT_CHARS) + '\n\n[... 문서가 길어 일부 내용이 생략되었습니다 ...]'
      : text;

    // System prompt optimized for Korean PDF summarization
    const systemPrompt = `당신은 PDF 문서 분석 전문가입니다. 주어진 텍스트를 깊이 있게 분석하여 핵심을 추출합니다.

분석 원칙:
- 문서의 주제와 목적을 정확히 파악
- 핵심 개념과 주장을 명확히 구분
- 중요도에 따른 우선순위 설정
- 구체적 데이터와 근거 포함
- 실용적 시사점 도출

출력 형식:
📄 **문서 개요**
[문서 제목 또는 주제를 한 문장으로 요약]

📌 **핵심 내용** (중요도 순으로 3-5개)
• [가장 중요한 핵심 내용 1 - 구체적으로 서술]
• [핵심 내용 2 - 이유나 근거 포함]
• [핵심 내용 3 - 구체적 데이터나 예시 포함]

🔍 **주요 세부사항**
• [중요 수치, 날짜, 고유명사 등]
• [특기할 만한 사실이나 발견]

💡 **결론 및 시사점**
[문서의 결론, 시사점, 또는 활용 방안을 2-3문장으로 서술]

---
한국어로 명료하게 작성하되, 원문의 뉘앙스와 전문성을 유지하세요.`;

    // Call OpenRouter API with retry logic
    let lastError = null;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': req.headers.referer || 'https://pdf-summary.vercel.app',
            'X-Title': 'PDF Summary App'
          },
          body: JSON.stringify({
            model: 'deepseek/deepseek-chat',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `다음 PDF 문서의 텍스트를 분석하여 요약해주세요:\n\n${truncatedText}` }
            ],
            temperature: 0.3,  // Lower temperature for more focused, consistent summaries
            max_tokens: 2048,  // Adequate for structured Korean summary
            top_p: 0.9        // Slight nucleus sampling for natural Korean
          })
        });

        const data = await response.json();

        // Handle API errors
        if (!response.ok) {
          // Rate limit - wait and retry
          if (response.status === 429 && attempt < MAX_RETRIES) {
            const retryAfter = parseInt(response.headers.get('retry-after') || '2');
            await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            continue;
          }

          console.error('OpenRouter API error:', data);
          throw new Error(data.error?.message || 'AI 요약 생성 중 오류가 발생했습니다.');
        }

        // Extract AI response
        const summary = data.choices?.[0]?.message?.content;
        if (!summary) {
          throw new Error('AI 요약을 받지 못했습니다.');
        }

        // Return successful response
        res.status(200).json({
          success: true,
          summary: summary,
          timestamp: new Date().toISOString(),
          model: 'deepseek/deepseek-chat',
          textLength: text.length,
          truncated: text.length > MAX_INPUT_CHARS
        });
        return;

      } catch (error) {
        lastError = error;
        if (attempt === MAX_RETRIES) {
          throw error;
        }
        // Exponential backoff for retries
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // If all retries failed
    throw lastError;

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
}
