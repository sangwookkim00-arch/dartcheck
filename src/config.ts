/**
 * 설정 관리 모듈
 * 
 * 왜 별도 모듈로 분리? → 환경변수 로딩/검증을 한 곳에서 관리하여
 * 다른 모듈에서 안전하게 사용 가능
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM에서 __dirname 대체
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드 (프로젝트 루트 기준)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

/**
 * 필수 환경변수를 가져오고, 없으면 에러를 던지는 헬퍼
 * 왜? → 실행 초기에 누락된 설정을 즉시 발견하기 위해
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`❌ 필수 환경변수 "${key}"가 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

// --- 설정 값 내보내기 ---
export const config = {
  // DART Open API
  dart: {
    apiKey: getRequiredEnv('DART_API_KEY'),
    /** 공시 검색 API */
    listUrl: 'https://opendart.fss.or.kr/api/list.json',
    /** 타법인 출자현황 API */
    investmentUrl: 'https://opendart.fss.or.kr/api/otrCprInvstmntSttus.json',
    /** 삼성생명 DART 고유번호 */
    samsungLifeCorpCode: '00126256',
  },

  // 이메일 (SMTP)
  email: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    user: getRequiredEnv('SENDER_EMAIL'),
    pass: getRequiredEnv('SENDER_PASSWORD'),
    /** 수신자 목록 (쉼표로 구분된 문자열 → 배열) */
    receivers: getRequiredEnv('RECEIVER_EMAIL').split(',').map(e => e.trim()),
  },

  // 파일 경로
  paths: {
    /** 대상 기업 목록 JSON */
    targetCompanies: path.resolve(__dirname, '..', 'data', 'target-companies.json'),
  },
} as const;
