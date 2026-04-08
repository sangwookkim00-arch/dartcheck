/**
 * DART 대주주 공시 모니터링 시스템 - 타입 정의
 * 
 * 왜 별도 파일로 분리? → 모든 모듈이 동일한 타입을 참조하여 일관성 유지
 */

// --- 모니터링 대상 기업 ---
export interface TargetCompany {
  /** 기업명 (예: "삼성전자") */
  name: string;
  /** DART 고유번호 8자리 */
  corpCode: string;
  /** 종목코드 6자리 (상장 확인용) */
  stockCode: string;
}

// --- DART 공시 검색 API 응답 ---
export interface DartDisclosure {
  /** 회사명 */
  corp_name: string;
  /** DART 고유번호 */
  corp_code: string;
  /** 종목코드 */
  stock_code: string;
  /** 보고서명 (필터링 키워드 매칭에 사용) */
  report_nm: string;
  /** 접수번호 (보고서 링크 생성에 사용) */
  rcept_no: string;
  /** 접수일자 (YYYYMMDD) */
  rcept_dt: string;
  /** 공시 제출인명 */
  flr_nm: string;
}

export interface DartListResponse {
  /** 에러코드: "000"이면 정상 */
  status: string;
  /** 에러 메시지 */
  message: string;
  /** 페이지 번호 */
  page_no?: number;
  /** 페이지 당 건수 */
  page_count?: number;
  /** 총 건수 */
  total_count?: number;
  /** 총 페이지 수 */
  total_page?: number;
  /** 공시 목록 */
  list?: DartDisclosure[];
}

// --- 타법인 출자현황 API 응답 (대상 기업 목록 업데이트용) ---
export interface DartInvestment {
  /** 접수번호 */
  rcept_no: string;
  /** 법인명 */
  inv_prm: string;
  /** 최초취득일자 */
  frst_acqs_de: string;
  /** 출자목적 */
  invstmnt_purps: string;
  /** 기초잔액 수량 */
  frst_blce_qy: string;
  /** 기초잔액 지분율 */
  frst_blce_qota_rt: string;
  /** 기말잔액 수량 */
  trmend_blce_qy: string;
  /** 기말잔액 지분율 */
  trmend_blce_qota_rt: string;
}

export interface DartInvestmentResponse {
  status: string;
  message: string;
  list?: DartInvestment[];
}

// --- 모니터링 결과 ---
export interface MonitoringResult {
  /** 대상 기업 정보 */
  company: TargetCompany;
  /** 발견된 공시 목록 (없으면 빈 배열) */
  disclosures: DartDisclosure[];
}

// --- 이메일 발송 결과 ---
export interface EmailResult {
  success: boolean;
  message: string;
}
