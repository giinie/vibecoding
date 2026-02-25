/**
 * PDF 텍스트 추출기 모듈
 * 
 * pdf.js 라이브러리를 사용하여 PDF 파일에서 텍스트를 추출하는 클래스입니다.
 * Mozilla CDN에서 pdf.js를 로드하고, 모든 페이지에서 텍스트를 비동기적으로 추출합니다.
 * 
 * @author Claude
 * @version 1.0.0
 * @date 2026-01-14
 */

// pdf.js 라이브러리 CDN 경로
const PDFJS_CDN_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174';

/**
 * PDF 처리기 클래스
 * PDF 파일 유효성 검사 및 텍스트 추출 기능을 제공합니다.
 */
class PDFProcessor {
    /**
     * PDFProcessor 생성자
     * pdf.js 워커를 설정합니다.
     */
    constructor() {
        // pdf.js 라이브러리 로드 상태
        this.isLibraryLoaded = false;
        
        // 파일 크기 제한 (50MB)
        this.MAX_FILE_SIZE = 50 * 1024 * 1024;
        
        // 허용되는 MIME 타입
        this.ALLOWED_MIME_TYPES = ['application/pdf'];
        
        // pdf.js 라이브러리 초기화
        this._initPDFJS();
    }

    /**
     * pdf.js 라이브러리 초기화
     * 워커 스크립트 경로를 설정합니다.
     * @private
     */
    _initPDFJS() {
        // pdfjsLib이 이미 로드되어 있는지 확인
        if (typeof pdfjsLib !== 'undefined') {
            // 워커 스크립트 경로 설정
            pdfjsLib.GlobalWorkerOptions.workerSrc = `${PDFJS_CDN_BASE}/pdf.worker.min.js`;
            this.isLibraryLoaded = true;
        }
    }

    /**
     * pdf.js 라이브러리 동적 로드
     * 라이브러리가 아직 로드되지 않은 경우 동적으로 로드합니다.
     * @returns {Promise<void>}
     * @private
     */
    async _loadPDFJS() {
        if (this.isLibraryLoaded) {
            return;
        }

        return new Promise((resolve, reject) => {
            // 이미 로드되어 있는지 다시 확인
            if (typeof pdfjsLib !== 'undefined') {
                this._initPDFJS();
                resolve();
                return;
            }

            // 스크립트 태그 생성
            const script = document.createElement('script');
            script.src = `${PDFJS_CDN_BASE}/pdf.min.js`;
            script.async = true;

            script.onload = () => {
                this._initPDFJS();
                resolve();
            };

            script.onerror = () => {
                reject(new Error('pdf.js 라이브러리를 로드하는데 실패했습니다.'));
            };

            document.head.appendChild(script);
        });
    }

    /**
     * 파일 유효성 검사
     * PDF 파일 형식과 크기를 검증합니다.
     * 
     * @param {File} file - 검사할 파일 객체
     * @returns {Object} 검증 결과 { valid: boolean, error?: { code: string, message: string } }
     */
    validateFile(file) {
        // 파일 객체 존재 여부 확인
        if (!file) {
            return {
                valid: false,
                error: {
                    code: 'E000',
                    message: '파일이 선택되지 않았습니다.'
                }
            };
        }

        // MIME 타입 검사
        // file.type이 비어있을 수 있으므로 파일 확장자도 함께 확인
        const isPDFByType = this.ALLOWED_MIME_TYPES.includes(file.type);
        const isPDFByExtension = file.name.toLowerCase().endsWith('.pdf');

        if (!isPDFByType && !isPDFByExtension) {
            return {
                valid: false,
                error: {
                    code: 'E001',
                    message: 'PDF 파일만 업로드할 수 있습니다.'
                }
            };
        }

        // 파일 크기 검사
        if (file.size > this.MAX_FILE_SIZE) {
            const maxSizeMB = this.MAX_FILE_SIZE / (1024 * 1024);
            return {
                valid: false,
                error: {
                    code: 'E002',
                    message: `파일 크기는 ${maxSizeMB}MB 이하여야 합니다.`
                }
            };
        }

        // 파일이 비어있는지 확인
        if (file.size === 0) {
            return {
                valid: false,
                error: {
                    code: 'E006',
                    message: '빈 파일은 업로드할 수 없습니다.'
                }
            };
        }

        return { valid: true };
    }

    /**
     * PDF 파일에서 텍스트 추출
     * 모든 페이지에서 텍스트를 추출하고 진행률을 콜백으로 전달합니다.
     * 
     * @param {File} file - PDF 파일 객체
     * @param {Function} [onProgress] - 진행률 콜백 함수 (currentPage, totalPages) => void
     * @returns {Promise<Object>} 추출 결과 { text: string, pageCount: number, charCount: number }
     * @throws {Error} 파일 유효성 검사 실패 또는 텍스트 추출 실패 시
     */
    async extractText(file, onProgress = null) {
        // 1. 파일 유효성 검사
        const validation = this.validateFile(file);
        if (!validation.valid) {
            const error = new Error(validation.error.message);
            error.code = validation.error.code;
            throw error;
        }

        // 2. pdf.js 라이브러리 로드 확인
        await this._loadPDFJS();

        try {
            // 3. 파일을 ArrayBuffer로 변환
            const arrayBuffer = await this._readFileAsArrayBuffer(file);

            // 4. PDF 문서 로드
            const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
                // CMap 설정 (다국어 지원)
                cMapUrl: `${PDFJS_CDN_BASE}/cmaps/`,
                cMapPacked: true
            });

            const pdfDocument = await loadingTask.promise;
            const totalPages = pdfDocument.numPages;

            // 5. 모든 페이지에서 텍스트 추출
            const pageTexts = [];

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
                const page = await pdfDocument.getPage(pageNum);
                const textContent = await page.getTextContent();

                // 텍스트 아이템들을 문자열로 결합
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ');

                pageTexts.push(pageText);

                // 진행률 콜백 호출
                if (typeof onProgress === 'function') {
                    onProgress(pageNum, totalPages);
                }
            }

            // 6. 모든 페이지 텍스트 결합
            const fullText = pageTexts.join('\n\n');

            // 7. 텍스트가 비어있는지 확인 (이미지 PDF 감지)
            const trimmedText = fullText.trim();
            if (trimmedText.length === 0) {
                const error = new Error(
                    '텍스트를 추출할 수 없습니다. 이미지 PDF는 지원하지 않습니다.'
                );
                error.code = 'E003';
                throw error;
            }

            // 8. 결과 반환
            return {
                text: trimmedText,
                pageCount: totalPages,
                charCount: trimmedText.length
            };

        } catch (error) {
            // pdf.js 에러 처리
            if (!error.code) {
                // pdf.js 내부 에러인 경우
                if (error.name === 'PasswordException') {
                    const newError = new Error(
                        '비밀번호로 보호된 PDF 파일입니다. 비밀번호 없이 열 수 있는 파일을 업로드해주세요.'
                    );
                    newError.code = 'E007';
                    throw newError;
                }
                
                if (error.name === 'InvalidPDFException') {
                    const newError = new Error(
                        '손상되었거나 유효하지 않은 PDF 파일입니다.'
                    );
                    newError.code = 'E008';
                    throw newError;
                }

                // 기타 에러
                const newError = new Error(
                    'PDF 파일을 처리하는 중 오류가 발생했습니다: ' + error.message
                );
                newError.code = 'E003';
                throw newError;
            }

            throw error;
        }
    }

    /**
     * 파일을 ArrayBuffer로 변환
     * FileReader API를 사용하여 파일을 읽습니다.
     * 
     * @param {File} file - 변환할 파일 객체
     * @returns {Promise<ArrayBuffer>} ArrayBuffer
     * @private
     */
    _readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (event) => {
                resolve(event.target.result);
            };

            reader.onerror = () => {
                reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
            };

            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 파일 크기를 사람이 읽기 쉬운 형식으로 변환
     * 
     * @param {number} bytes - 바이트 단위 크기
     * @returns {string} 포맷된 크기 문자열 (예: "1.5 MB")
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 전역으로 사용할 수 있도록 내보내기
// ES6 모듈 환경과 브라우저 전역 환경 모두 지원
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PDFProcessor;
} else if (typeof window !== 'undefined') {
    window.PDFProcessor = PDFProcessor;
}
