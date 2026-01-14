/**
 * AI 텍스트 요약 모듈
 *
 * OpenRouter API를 사용하여 텍스트를 요약하는 클래스입니다.
 * DeepSeek 모델을 활용하여 한국어 문서 요약을 수행합니다.
 *
 * @author Claude
 * @version 1.0.0
 * @date 2026-01-14
 */

/**
 * AI 요약 처리기 클래스
 * OpenRouter API를 통해 텍스트 요약 기능을 제공합니다.
 */
class Summarizer {
    /**
     * Summarizer 생성자
     *
     * @param {string} [apiKey] - OpenRouter API 키 (선택사항, 나중에 setApiKey로 설정 가능)
     */
    constructor(apiKey = null) {
        // OpenRouter API 엔드포인트
        this.endpoint = 'https://openrouter.ai/api/v1/chat/completions';

        // 사용할 AI 모델 (DeepSeek V3.1 - 무료)
        this.model = 'deepseek/deepseek-chat';

        // API 키 설정
        this.apiKey = apiKey;

        // 요청 타임아웃 (밀리초)
        this.timeout = 60000; // 60초

        // 텍스트 분할 기준 길이 (토큰 초과 방지)
        this.maxChunkLength = 12000; // 약 3000 토큰 (한글 기준)

        // 요약 길이 설정
        this.summaryLengthConfig = {
            short: {
                label: '짧게',
                ratio: 0.05,
                maxTokens: 500,
                instruction: '핵심만 간단히 3-5개 포인트로 요약해주세요.'
            },
            medium: {
                label: '보통',
                ratio: 0.15,
                maxTokens: 2000,
                instruction: '주요 내용을 체계적으로 정리하여 요약해주세요.'
            },
            long: {
                label: '자세히',
                ratio: 0.25,
                maxTokens: 4000,
                instruction: '상세하게 모든 중요한 내용을 빠짐없이 요약해주세요.'
            }
        };
    }

    /**
     * API 키 설정
     *
     * @param {string} apiKey - OpenRouter API 키
     */
    setApiKey(apiKey) {
        if (typeof apiKey !== 'string' || !apiKey.trim()) {
            throw new Error('유효한 API 키를 입력해주세요.');
        }
        this.apiKey = apiKey.trim();
    }

    /**
     * API 키 유효성 검사
     * API 키 형식과 실제 사용 가능 여부를 확인합니다.
     *
     * @returns {Promise<Object>} 검증 결과 { valid: boolean, message: string }
     */
    async validateApiKey() {
        // 1. 기본 검사 - API 키 존재 여부
        if (!this.apiKey) {
            return {
                valid: false,
                message: 'API 키가 설정되지 않았습니다.'
            };
        }

        // 2. 형식 검사 - OpenRouter 키는 'sk-or-'로 시작
        if (!this.apiKey.startsWith('sk-or-')) {
            return {
                valid: false,
                message: 'OpenRouter API 키 형식이 올바르지 않습니다. (sk-or-로 시작해야 합니다)'
            };
        }

        // 3. 실제 API 호출로 유효성 확인
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10초 타임아웃

            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'http://localhost',
                    'X-Title': 'PDF Summary App'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        { role: 'user', content: 'test' }
                    ],
                    max_tokens: 1
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.status === 401) {
                return {
                    valid: false,
                    message: 'API 키가 유효하지 않습니다. 올바른 키인지 확인해주세요.'
                };
            }

            if (response.status === 429) {
                return {
                    valid: false,
                    message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
                };
            }

            if (response.ok) {
                return {
                    valid: true,
                    message: 'API 키가 유효합니다.'
                };
            }

            // 기타 오류
            return {
                valid: false,
                message: `API 서버 오류: ${response.status}`
            };

        } catch (error) {
            if (error.name === 'AbortError') {
                return {
                    valid: false,
                    message: 'API 서버 응답 시간이 초과되었습니다.'
                };
            }

            return {
                valid: false,
                message: `연결 오류: ${error.message}`
            };
        }
    }

    /**
     * 텍스트 요약 수행
     *
     * @param {string} text - 요약할 텍스트
     * @param {Object} [options] - 요약 옵션
     * @param {string} [options.length='medium'] - 요약 길이 ('short', 'medium', 'long')
     * @param {Function} [options.onProgress] - 진행률 콜백 (currentChunk, totalChunks, status) => void
     * @returns {Promise<Object>} 요약 결과 { summary: string, originalLength: number, summaryLength: number, chunks: number }
     * @throws {Error} API 호출 실패 또는 요약 실패 시
     */
    async summarize(text, options = {}) {
        // 옵션 기본값 설정
        const {
            length = 'medium',
            onProgress = null
        } = options;

        // 1. API 키 확인
        if (!this.apiKey) {
            throw new Error('API 키가 설정되지 않았습니다. setApiKey()로 API 키를 설정해주세요.');
        }

        // 2. 텍스트 유효성 검사
        if (!text || typeof text !== 'string') {
            throw new Error('요약할 텍스트가 없습니다.');
        }

        const trimmedText = text.trim();
        if (trimmedText.length === 0) {
            throw new Error('텍스트 내용이 비어있습니다.');
        }

        // 3. 요약 길이 설정 확인
        const lengthConfig = this.summaryLengthConfig[length];
        if (!lengthConfig) {
            throw new Error(`유효하지 않은 요약 길이입니다. (short, medium, long 중 선택)`);
        }

        // 4. 텍스트 길이에 따라 분할 여부 결정
        const originalLength = trimmedText.length;
        let summary;

        if (trimmedText.length <= this.maxChunkLength) {
            // 단일 청크로 처리
            if (typeof onProgress === 'function') {
                onProgress(1, 1, '요약 중...');
            }
            summary = await this._callAPI(trimmedText, lengthConfig);
        } else {
            // 텍스트 분할 후 처리
            const chunks = this._splitText(trimmedText);
            summary = await this._summarizeChunks(chunks, lengthConfig, onProgress);
        }

        // 5. 결과 반환
        return {
            summary: summary.trim(),
            originalLength: originalLength,
            summaryLength: summary.trim().length,
            compressionRatio: Math.round((1 - summary.trim().length / originalLength) * 100),
            chunks: Math.ceil(originalLength / this.maxChunkLength)
        };
    }

    /**
     * 텍스트를 청크로 분할
     * 문장 단위로 분할하여 의미가 끊기지 않도록 합니다.
     *
     * @param {string} text - 분할할 텍스트
     * @returns {string[]} 분할된 텍스트 청크 배열
     * @private
     */
    _splitText(text) {
        const chunks = [];

        // 문단 단위로 우선 분할
        const paragraphs = text.split(/\n\n+/);
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            // 현재 청크에 문단을 추가했을 때 최대 길이를 초과하는지 확인
            if ((currentChunk + '\n\n' + paragraph).length > this.maxChunkLength) {
                // 현재 청크 저장
                if (currentChunk.trim()) {
                    chunks.push(currentChunk.trim());
                }

                // 단일 문단이 최대 길이를 초과하는 경우 문장 단위로 분할
                if (paragraph.length > this.maxChunkLength) {
                    const sentences = this._splitIntoSentences(paragraph);
                    let sentenceChunk = '';

                    for (const sentence of sentences) {
                        if ((sentenceChunk + ' ' + sentence).length > this.maxChunkLength) {
                            if (sentenceChunk.trim()) {
                                chunks.push(sentenceChunk.trim());
                            }
                            sentenceChunk = sentence;
                        } else {
                            sentenceChunk += (sentenceChunk ? ' ' : '') + sentence;
                        }
                    }

                    currentChunk = sentenceChunk;
                } else {
                    currentChunk = paragraph;
                }
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
            }
        }

        // 마지막 청크 저장
        if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
        }

        return chunks;
    }

    /**
     * 텍스트를 문장 단위로 분할
     * 한국어와 영어 문장 모두 지원합니다.
     *
     * @param {string} text - 분할할 텍스트
     * @returns {string[]} 문장 배열
     * @private
     */
    _splitIntoSentences(text) {
        // 한국어와 영어 문장 종결 패턴
        const sentencePattern = /[^.!?。？！]*[.!?。？！]+\s*/g;
        const sentences = text.match(sentencePattern) || [text];
        return sentences.filter(s => s.trim());
    }

    /**
     * 분할된 청크들을 순차적으로 요약
     *
     * @param {string[]} chunks - 텍스트 청크 배열
     * @param {Object} lengthConfig - 요약 길이 설정
     * @param {Function|null} onProgress - 진행률 콜백
     * @returns {Promise<string>} 최종 요약 결과
     * @private
     */
    async _summarizeChunks(chunks, lengthConfig, onProgress) {
        const totalChunks = chunks.length;
        const chunkSummaries = [];

        // 1. 각 청크 개별 요약
        for (let i = 0; i < totalChunks; i++) {
            if (typeof onProgress === 'function') {
                onProgress(i + 1, totalChunks + 1, `파트 ${i + 1}/${totalChunks} 요약 중...`);
            }

            const chunkSummary = await this._callAPI(chunks[i], {
                ...lengthConfig,
                instruction: `다음은 긴 문서의 일부입니다. 이 부분의 핵심 내용을 요약해주세요.`
            });

            chunkSummaries.push(chunkSummary);
        }

        // 2. 개별 요약들을 통합하여 최종 요약 생성
        if (chunkSummaries.length === 1) {
            return chunkSummaries[0];
        }

        if (typeof onProgress === 'function') {
            onProgress(totalChunks + 1, totalChunks + 1, '최종 요약 생성 중...');
        }

        const combinedSummaries = chunkSummaries.join('\n\n---\n\n');
        const finalSummary = await this._callAPI(combinedSummaries, {
            ...lengthConfig,
            instruction: `다음은 긴 문서의 각 부분을 요약한 내용입니다. 이를 통합하여 전체 문서의 핵심을 체계적으로 정리해주세요. ${lengthConfig.instruction}`
        });

        return finalSummary;
    }

    /**
     * OpenRouter API 호출
     *
     * @param {string} text - 요약할 텍스트
     * @param {Object} config - 요약 설정
     * @returns {Promise<string>} 요약 결과
     * @private
     */
    async _callAPI(text, config) {
        const systemPrompt = `당신은 전문 문서 요약 AI입니다. 주어진 텍스트를 한국어로 핵심 내용을 정리하여 요약해주세요.

다음 지침을 따라주세요:
1. ${config.instruction}
2. 원문의 핵심 정보를 정확하게 전달하세요.
3. 중요한 포인트는 불릿 포인트(-)로 정리해주세요.
4. 전문 용어는 그대로 사용하되, 필요시 간단한 설명을 추가하세요.
5. 객관적이고 명확한 문체를 사용하세요.`;

        const userPrompt = `다음 텍스트를 요약해주세요:\n\n${text}`;

        // AbortController로 타임아웃 처리
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(this.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': typeof window !== 'undefined' ? window.location.href : 'http://localhost',
                    'X-Title': 'PDF Summary App'
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userPrompt
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: config.maxTokens
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // HTTP 에러 처리
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw this._createAPIError(response.status, errorData);
            }

            const data = await response.json();

            // 응답 데이터 검증
            if (!data.choices || !data.choices[0] || !data.choices[0].message) {
                throw new Error('API 응답 형식이 올바르지 않습니다.');
            }

            return data.choices[0].message.content;

        } catch (error) {
            clearTimeout(timeoutId);

            // 타임아웃 에러
            if (error.name === 'AbortError') {
                const timeoutError = new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
                timeoutError.code = 'E_TIMEOUT';
                throw timeoutError;
            }

            // 네트워크 에러
            if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
                const networkError = new Error('네트워크 연결을 확인해주세요.');
                networkError.code = 'E_NETWORK';
                throw networkError;
            }

            throw error;
        }
    }

    /**
     * API 에러 객체 생성
     * HTTP 상태 코드에 따라 사용자 친화적 에러 메시지를 생성합니다.
     *
     * @param {number} statusCode - HTTP 상태 코드
     * @param {Object} errorData - API 에러 응답 데이터
     * @returns {Error} 에러 객체
     * @private
     */
    _createAPIError(statusCode, errorData) {
        let message;
        let code;

        switch (statusCode) {
            case 400:
                message = '잘못된 요청입니다. 텍스트가 너무 길거나 형식이 올바르지 않습니다.';
                code = 'E_BAD_REQUEST';
                break;

            case 401:
                message = 'API 키가 유효하지 않습니다. 설정에서 올바른 키를 입력해주세요.';
                code = 'E_UNAUTHORIZED';
                break;

            case 402:
                message = 'API 사용 크레딧이 부족합니다. OpenRouter 계정을 확인해주세요.';
                code = 'E_PAYMENT_REQUIRED';
                break;

            case 403:
                message = 'API 접근이 거부되었습니다.';
                code = 'E_FORBIDDEN';
                break;

            case 429:
                message = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
                code = 'E_RATE_LIMIT';
                break;

            case 500:
            case 502:
            case 503:
            case 504:
                message = 'AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';
                code = 'E_SERVER_ERROR';
                break;

            default:
                message = errorData?.error?.message || `API 오류가 발생했습니다. (${statusCode})`;
                code = 'E_UNKNOWN';
        }

        const error = new Error(message);
        error.code = code;
        error.statusCode = statusCode;
        error.details = errorData;

        return error;
    }

    /**
     * 서버리스 함수 프록시를 통한 요약
     * API 키를 클라이언트에 노출하지 않고 서버사이드에서 처리합니다.
     *
     * @param {string} text - 요약할 텍스트
     * @param {Object} [options] - 요약 옵션
     * @param {string} [options.length='medium'] - 요약 길이
     * @param {string} [options.proxyUrl='/api/summarize'] - 프록시 엔드포인트 URL
     * @param {Function} [options.onProgress] - 진행률 콜백
     * @returns {Promise<Object>} 요약 결과
     */
    async summarizeViaProxy(text, options = {}) {
        const {
            length = 'medium',
            proxyUrl = '/api/summarize',
            onProgress = null
        } = options;

        // 텍스트 유효성 검사
        if (!text || typeof text !== 'string' || !text.trim()) {
            throw new Error('요약할 텍스트가 없습니다.');
        }

        const trimmedText = text.trim();
        const originalLength = trimmedText.length;

        if (typeof onProgress === 'function') {
            onProgress(1, 1, '요약 중...');
        }

        // AbortController로 타임아웃 처리
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: trimmedText,
                    length: length
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `서버 오류: ${response.status}`);
            }

            const data = await response.json();

            return {
                summary: data.summary.trim(),
                originalLength: originalLength,
                summaryLength: data.summary.trim().length,
                compressionRatio: Math.round((1 - data.summary.trim().length / originalLength) * 100),
                chunks: 1
            };

        } catch (error) {
            clearTimeout(timeoutId);

            if (error.name === 'AbortError') {
                throw new Error('요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.');
            }

            throw error;
        }
    }
}

// 전역으로 사용할 수 있도록 내보내기
// ES6 모듈 환경과 브라우저 전역 환경 모두 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Summarizer;
} else if (typeof window !== 'undefined') {
    window.Summarizer = Summarizer;
}
