# DART 대주주 공시 모니터링 시스템

삼성생명이 10% 이상 지분을 보유한 상장기업의 **임원·주요주주특정증권등소유상황보고서** 공시를 매일 아침 자동으로 확인하여 이메일로 발송하는 시스템입니다.

## 🔧 설치 및 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경변수 설정
`.env.example`을 복사하여 `.env` 파일을 만들고, 실제 값을 입력하세요:
```bash
cp .env.example .env
```

| 환경변수 | 설명 |
|---------|------|
| `DART_API_KEY` | DART Open API 인증키 ([발급](https://opendart.fss.or.kr)) |
| `SENDER_EMAIL` | 발신 Gmail 주소 |
| `SENDER_PASSWORD` | Gmail 앱 비밀번호 (16자리) |
| `RECEIVER_EMAIL` | 수신자 이메일 (쉼표로 구분) |

## 🚀 실행

### 일일 모니터링 (전일자 기준)
```bash
npm start
```

### 특정 날짜 조회
```bash
CHECK_DATE=20260331 npm start
```

### 대상 기업 목록 업데이트
```bash
npm run update-targets
```

## ⏰ 자동 스케줄링 (GitHub Actions)

매일 한국시간 09:00에 자동 실행됩니다. GitHub Secrets에 환경변수를 등록하세요:
- `DART_API_KEY`
- `SENDER_EMAIL`  
- `SENDER_PASSWORD`
- `RECEIVER_EMAIL`

## 📋 모니터링 대상 기업

`data/target-companies.json`에 정의된 기업 목록:

| 기업명 | 종목코드 | 삼성생명 지분율 |
|--------|---------|---------------|
| 삼성전자 | 005930 | 8.51% |
| 삼성화재 | 000810 | 15.17% |
| 삼성증권 | 016360 | 29.42% |
| 삼성카드 | 029780 | 71.91% |
| 삼성중공업 | 010140 | 12.10% |
| 제일기획 | 030000 | 10.32% |

> 💡 `npm run update-targets`로 DART 타법인출자현황 API를 조회하여 최신 목록을 확인할 수 있습니다.
