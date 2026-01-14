# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

pdf-summary-02는 PDF 문서 요약 웹 애플리케이션 연습 프로젝트입니다. 사용자가 PDF 파일을 업로드하면 AI가 자동으로 텍스트를 추출하고 요약을 생성합니다.

이 프로젝트는 `vibecoding` 교재의 7장 "PDF 요약 AI" 예제를 기반으로 하는 practice 디렉토리 내 연습용 프로젝트입니다.

## Tech Stack

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **PDF Processing**: pdf.js (Mozilla CDN)
- **AI Integration**: OpenRouter API
- **AI Model**: DeepSeek V3.1 (`deepseek/deepseek-chat`)
- **Deployment**: Vercel (serverless functions)

## Development Commands

```bash
# 로컬 개발 서버 실행 (Python)
python -m http.server 8000

# Vercel 로컬 개발 (serverless 함수 테스트)
vercel dev

# Vercel 배포
vercel deploy

# 프로덕션 배포
vercel deploy --prod
```

## Architecture

### Data Flow
```
PDF 업로드 → pdf.js 텍스트 추출 → OpenRouter API 호출 → 요약 결과 표시
```

### Key Components

**클라이언트 사이드**:
- 파일 업로드 (드래그&드롭 + 버튼)
- pdf.js를 통한 텍스트 추출 (브라우저 메모리 처리)
- 요약 결과 렌더링

**서버리스 함수** (`api/` 디렉토리):
- OpenRouter API 프록시 (API 키 보안)
- CORS 처리

### Environment Variables

```bash
# .env 또는 Vercel 환경변수
OPENROUTER_API_KEY=your_api_key_here
```

## API Integration

### OpenRouter 호출 구조
```javascript
{
  endpoint: 'https://openrouter.ai/api/v1/chat/completions',
  model: 'deepseek/deepseek-chat',
  messages: [
    { role: 'system', content: '한국어로 문서를 요약해주세요.' },
    { role: 'user', content: extractedText }
  ]
}
```

## Key Constraints

- **파일 크기**: 최대 50MB
- **파일 형식**: PDF만 허용
- **텍스트 PDF만 지원** (이미지 PDF는 OCR 미지원)
- **요약 길이**: 원문의 10-20% 수준

## Reference Projects

- **Study-05**: 공감 AI 다이어리 + PDF 요약 AI (완성본)
- **PRD**: `/Users/giinie/JWS/PyCharm/vibecoding/Study-05/PRD_PDF_Summary_App.md`

## Project Context

이 프로젝트는 `vibecoding` 저장소의 연습용 하위 프로젝트입니다:
- 상위 저장소: `/Users/giinie/JWS/PyCharm/vibecoding`
- Python 환경: `.venv` (Python 3.14+, uv 관리)
- 교재: "혼자 공부하는 바이브코딩 with 클로드코드"
