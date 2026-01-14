# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PDF Summary 01** - PDF 문서 요약 AI 웹 애플리케이션

사용자가 PDF 문서를 업로드하면 AI가 텍스트를 추출하고, 핵심 내용을 요약해주는 웹 애플리케이션. "혼자 공부하는 바이브코딩 with 클로드코드" 7장 실습 프로젝트.

## Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| PDF Processing | pdf.js (CDN) |
| AI API | OpenRouter (DeepSeek V3.1) |
| Deployment | Vercel (Serverless Functions) |

## Build/Run Commands

```bash
# Local development - open directly in browser
open index.html

# Local development with Vercel CLI
vercel dev

# Deploy to Vercel
vercel deploy

# Deploy to production
vercel deploy --prod
```

## Architecture Overview

```
pdf-summary-01/
├── index.html              # Main application (HTML + CSS + JS)
├── api/                    # Vercel Serverless Functions
│   └── summarize.js        # PDF summarization endpoint
├── vercel.json             # Vercel deployment config
└── CLAUDE.md               # This file
```

### Data Flow
1. User uploads PDF file via drag & drop or file picker
2. pdf.js extracts text from PDF (client-side)
3. Frontend calls `/api/summarize` endpoint
4. Backend sends text to OpenRouter API (DeepSeek model)
5. AI returns structured summary in Korean
6. Summary displayed with copy functionality

## Environment Configuration

`.env` 파일 또는 Vercel 환경변수 설정:

```env
OPENROUTER_API_KEY=your_api_key_here
```

Vercel에서 설정:
```bash
vercel env add OPENROUTER_API_KEY
```

## API Configuration

### OpenRouter Settings
- Model: `deepseek/deepseek-chat` (DeepSeek V3.1)
- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Temperature: 0.7
- Max tokens: 2000 (adjustable)

### Summarization Prompt Pattern
- System: Korean language summarization expert
- User: Extracted text with length limits
- Response: Structured summary with key points

## Key Features

- PDF file upload (drag & drop + file picker)
- Client-side text extraction (pdf.js)
- AI-powered summarization in Korean
- Progress indicators during processing
- Copy-to-clipboard functionality
- Responsive design (mobile + desktop)
- File size limit: 50MB
- Supported format: PDF only

## Browser Compatibility

| Browser | Minimum Version |
|---------|-----------------|
| Chrome | 90+ |
| Firefox | 88+ |
| Safari | 14+ |
| Edge | 90+ |

## Code Style Guidelines

- User-facing text: Korean (한국어)
- Code comments and dev docs: English
- ES6+ JavaScript syntax
- Semantic HTML5 markup
- Mobile-first responsive CSS

## Related Documentation

- [PRD_PDF_Summary_App.md](../../Study-05/PRD_PDF_Summary_App.md) - Product Requirements Document
- [OpenRouter API Documentation](https://openrouter.ai/docs)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
