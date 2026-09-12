# Spiritual Image Creator

성경 말씀과 장면 설명으로 기독교/성경 이미지를 생성하는 웹 앱.

## 스택
Next.js 14 (App Router) · Supabase (Auth, Postgres, Storage) · Together AI (FLUX.2-dev 이미지, Llama 3.3 프롬프트 번역/필터)

## 로컬 실행
```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

## DB 설정
Supabase SQL Editor 에서 `supabase/migrations/` 의 SQL 을 번호 순서대로 실행.

## 구조
- `app/auth/*` 회원가입/로그인 · `app/api/auth/*` 세션 API · `middleware.ts` 경로 보호
- `app/dashboard/*` 대시보드(생성, 갤러리) · `app/api/generate` 이미지 생성 · `app/api/gallery` · `app/api/credit`
- `lib/supabase.ts` 서버 클라이언트 · `lib/auth.ts` 세션 · `lib/together.ts` 이미지 API · `lib/prompt.ts` 번역+안전성
