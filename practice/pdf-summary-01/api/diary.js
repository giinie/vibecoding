// AI Empathy Diary - Backend API
// OpenRouter API integration for emotion analysis and empathy message generation

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { diaryEntry } = req.body;

  if (!diaryEntry || diaryEntry.trim() === '') {
    return res.status(400).json({ error: '일기 내용을 입력해주세요.' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = `당신은 따뜻하고 공감 능력이 뛰어난 심리 상담사입니다.
사용자가 오늘 있었던 일을 한 줄로 적으면, 다음을 수행해주세요:

1. **감정 분석**: 글에서 느껴지는 주요 감정을 파악합니다 (기쁨, 슬픔, 분노, 불안, 피로, 설렘, 외로움, 뿌듯함 등)
2. **공감 표현**: 그 감정에 진심으로 공감하는 따뜻한 말을 전합니다
3. **위로/격려**: 상황에 맞는 위로나 격려의 메시지를 전합니다
4. **마무리**: 내일을 위한 희망적인 한마디로 마무리합니다

응답 형식:
🎭 감정: [감정 이모지] [감정 분석 결과]

💝 공감:
[공감하는 따뜻한 말]

🌸 위로:
[위로와 격려의 메시지]

✨ 내일을 위해:
[희망적인 마무리]

---
응답은 친근하고 따뜻한 반말체로 작성해주세요. 마치 좋은 친구가 이야기를 들어주는 것처럼요.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://ai-empathy-diary.vercel.app',
        'X-Title': 'AI Empathy Diary'
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `오늘의 일기: ${diaryEntry}` }
        ],
        temperature: 0.8,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: 'AI 응답 생성 중 오류가 발생했습니다.',
        details: errorData.error?.message || 'Unknown error'
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content;

    if (!aiResponse) {
      return res.status(500).json({ error: 'AI 응답을 받지 못했습니다.' });
    }

    return res.status(200).json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      error: '서버 오류가 발생했습니다.',
      details: error.message
    });
  }
}