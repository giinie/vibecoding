/**
 * PDF 요약 서버리스 함수
 *
 * OpenRouter API를 프록시하여 클라이언트에서 API 키를 노출하지 않도록 합니다.
 * Vercel Serverless Functions 환경에서 실행됩니다.
 *
 * @author Claude
 * @version 1.0.0
 * @date 2026-01-14
 */

// OpenRouter API 설정
const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'deepseek/deepseek-chat';

// 요약 길이 설정
const SUMMARY_LENGTH_CONFIG = {
    short: {
        maxTokens: 500,
        instruction: '핵심만 간단히 3-5개 포인트로 요약해주세요.'
    },
    medium: {
        maxTokens: 2000,
        instruction: '주요 내용을 체계적으로 정리하여 요약해주세요.'
    },
    long: {
        maxTokens: 4000,
        instruction: '상세하게 모든 중요한 내용을 빠짐없이 요약해주세요.'
    }
};

/**
 * CORS 헤더 설정
 */
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
};

/**
 * 에러 응답 생성
 *
 * @param {number} status - HTTP 상태 코드
 * @param {string} message - 에러 메시지
 * @returns {Response} 에러 응답
 */
function errorResponse(status, message) {
    return new Response(
        JSON.stringify({ error: message }),
        {
            status,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * 성공 응답 생성
 *
 * @param {Object} data - 응답 데이터
 * @returns {Response} 성공 응답
 */
function successResponse(data) {
    return new Response(
        JSON.stringify(data),
        {
            status: 200,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        }
    );
}

/**
 * Vercel Edge Function 핸들러
 *
 * @param {Request} request - HTTP 요청 객체
 * @returns {Promise<Response>} HTTP 응답
 */
export default async function handler(request) {
    // CORS preflight 처리
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // POST 메서드만 허용
    if (request.method !== 'POST') {
        return errorResponse(405, '허용되지 않은 메서드입니다.');
    }

    // API 키 확인
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
        console.error('OPENROUTER_API_KEY 환경변수가 설정되지 않았습니다.');
        return errorResponse(500, '서버 설정 오류입니다. 관리자에게 문의해주세요.');
    }

    try {
        // 요청 본문 파싱
        const body = await request.json();
        const { text, length = 'medium' } = body;

        // 텍스트 유효성 검사
        if (!text || typeof text !== 'string') {
            return errorResponse(400, '요약할 텍스트가 없습니다.');
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            return errorResponse(400, '텍스트 내용이 비어있습니다.');
        }

        // 텍스트 길이 제한 (약 50,000자 - 토큰 초과 방지)
        if (trimmedText.length > 50000) {
            return errorResponse(400, '텍스트가 너무 깁니다. 50,000자 이하로 입력해주세요.');
        }

        // 요약 길이 설정 확인
        const config = SUMMARY_LENGTH_CONFIG[length];
        if (!config) {
            return errorResponse(400, '유효하지 않은 요약 길이입니다. (short, medium, long 중 선택)');
        }

        // 시스템 프롬프트 생성
        const systemPrompt = `당신은 전문 문서 요약 AI입니다. 주어진 텍스트를 한국어로 핵심 내용을 정리하여 요약해주세요.

다음 지침을 따라주세요:
1. ${config.instruction}
2. 원문의 핵심 정보를 정확하게 전달하세요.
3. 중요한 포인트는 불릿 포인트(-)로 정리해주세요.
4. 전문 용어는 그대로 사용하되, 필요시 간단한 설명을 추가하세요.
5. 객관적이고 명확한 문체를 사용하세요.`;

        // OpenRouter API 호출
        const response = await fetch(OPENROUTER_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'HTTP-Referer': request.headers.get('origin') || 'https://pdf-summary.vercel.app',
                'X-Title': 'PDF Summary App'
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: 'system',
                        content: systemPrompt
                    },
                    {
                        role: 'user',
                        content: `다음 텍스트를 요약해주세요:\n\n${trimmedText}`
                    }
                ],
                temperature: 0.3,
                max_tokens: config.maxTokens
            })
        });

        // OpenRouter API 에러 처리
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenRouter API 에러:', response.status, errorData);

            switch (response.status) {
                case 401:
                    return errorResponse(500, 'API 인증 오류입니다. 관리자에게 문의해주세요.');
                case 402:
                    return errorResponse(500, 'API 크레딧이 부족합니다. 관리자에게 문의해주세요.');
                case 429:
                    return errorResponse(429, '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
                case 500:
                case 502:
                case 503:
                    return errorResponse(503, 'AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.');
                default:
                    return errorResponse(500, `AI 서버 오류: ${response.status}`);
            }
        }

        // 응답 파싱
        const data = await response.json();

        // 응답 데이터 검증
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            console.error('OpenRouter 응답 형식 오류:', data);
            return errorResponse(500, 'AI 응답 형식이 올바르지 않습니다.');
        }

        const summary = data.choices[0].message.content;

        // 성공 응답
        return successResponse({
            summary: summary,
            model: MODEL,
            usage: data.usage || null
        });

    } catch (error) {
        console.error('요약 처리 중 오류:', error);

        // JSON 파싱 에러
        if (error instanceof SyntaxError) {
            return errorResponse(400, '잘못된 요청 형식입니다.');
        }

        // 네트워크 에러
        if (error.cause?.code === 'ECONNREFUSED' || error.cause?.code === 'ENOTFOUND') {
            return errorResponse(503, 'AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
        }

        return errorResponse(500, '요약 처리 중 오류가 발생했습니다.');
    }
}

/**
 * Vercel Edge Function 설정
 */
export const config = {
    runtime: 'edge'
};
