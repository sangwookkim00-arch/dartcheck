/**
 * DART Open API 클라이언트
 * 
 * 주요 기능:
 * 1. 특정 기업의 특정 일자 "주요주주특정증권" 공시 검색
 * 2. 삼성생명의 타법인 출자현황 조회 (대상 기업 목록 업데이트용)
 */

import axios from 'axios';
import { config } from './config.js';
import type {
  DartListResponse,
  DartDisclosure,
  DartInvestmentResponse,
  DartInvestment,
  TargetCompany,
} from './types.js';

// API 호출 간 딜레이 (DART API rate limit 방지, 초당 10건 제한)
const API_DELAY_MS = 200;

/** 지정 시간만큼 대기하는 유틸 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 특정 기업의 특정 날짜에 대한 지분공시(D002: 임원·주요주주특정증권등소유상황보고서)를 검색
 * 
 * 왜 pblntf_detail_ty=D002? → "임원ㆍ주요주주특정증권등소유상황보고서" 유형만 필터링
 * 추가로 report_nm에서 "주요주주특정증권" 키워드를 이중 체크
 */
export async function searchDisclosures(
  corpCode: string,
  startDate: string, // YYYYMMDD 형식
  endDate: string
): Promise<DartDisclosure[]> {
  try {
    const response = await axios.get<DartListResponse>(config.dart.listUrl, {
      params: {
        crtfc_key: config.dart.apiKey,
        corp_code: corpCode,
        bgn_de: startDate,    // 검색 시작일
        end_de: endDate,      // 검색 종료일
        page_count: 100,
      },
      timeout: 10000,
    });

    const data = response.data;

    // "013" = 조회된 데이터가 없음 (정상 응답이지만 결과 없음)
    if (data.status === '013') {
      return [];
    }

    // 다른 에러 상태 처리  
    if (data.status !== '000') {
      console.warn(`⚠️ DART API 경고 [${corpCode}]: ${data.message} (status: ${data.status})`);
      return [];
    }

    // 주요주주관련 보고서 (D001: 5%보고서, D002: 임원/주요주주 보고서) 필터링
    const filtered = (data.list || []).filter(d =>
      d.report_nm.includes('주요주주특정증권') ||
      d.report_nm.includes('대량보유상황')
    );

    return filtered;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ DART API 호출 실패 [${corpCode}]:`, error.message);
    } else {
      console.error(`❌ 알 수 없는 에러 [${corpCode}]:`, error);
    }
    return [];
  }
}

/**
 * 모든 대상 기업에 대해 공시를 검색하고 결과 반환
 * 
 * 왜 순차 처리? → DART API의 rate limit (초당 10건) 준수를 위해
 * 병렬 호출 시 429 에러 발생 가능
 */
export async function searchAllDisclosures(
  companies: TargetCompany[],
  startDate: string,
  endDate: string
): Promise<{ company: TargetCompany; disclosures: DartDisclosure[] }[]> {
  const results: { company: TargetCompany; disclosures: DartDisclosure[] }[] = [];

  for (const company of companies) {
    console.log(`🔍 공시 검색 중: ${company.name} (${company.corpCode})`);
    const disclosures = await searchDisclosures(company.corpCode, startDate, endDate);

    if (disclosures.length > 0) {
      console.log(`  ✅ ${disclosures.length}건 발견!`);
    }

    results.push({ company, disclosures });

    // API rate limit 방지용 딜레이
    await sleep(API_DELAY_MS);
  }

  return results;
}

/**
 * 특정 기업의 특정 날짜에 대한 기업이벤트 공시를 검색
 * 
 * 조건: pblntf_ty나 pblntf_detail_ty 제약 없이 전체 공시(또는 수시/정기)에서
 * 지정된 보고서명/키워드가 포함된 공시만 필터링
 */
export async function searchEventDisclosures(
  corpCode: string,
  startDate: string,
  endDate: string
): Promise<DartDisclosure[]> {
  try {
    const response = await axios.get<DartListResponse>(config.dart.listUrl, {
      params: {
        crtfc_key: config.dart.apiKey,
        corp_code: corpCode,
        bgn_de: startDate,
        end_de: endDate,
        page_count: 100,
      },
      timeout: 10000,
    });

    const data = response.data;

    // "013" = 조회된 데이터가 없음
    if (data.status === '013') {
      return [];
    }

    if (data.status !== '000') {
      console.warn(`⚠️ DART API 경고 [${corpCode}]: ${data.message} (status: ${data.status})`);
      return [];
    }

    // 키워드 목록: 주주총회, 주식소각, 배당, 유상증자, 무상증자, 유상감자, 무상감자
    const keywords = [
      '주주총회', '주식소각', '배당', '유상증자', '무상증자', '유상감자', '무상감자'
    ];

    const filtered = (data.list || []).filter(d =>
      keywords.some(kw => d.report_nm.includes(kw))
    );

    return filtered;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(`❌ DART API 호출 실패 [${corpCode}]:`, error.message);
    } else {
      console.error(`❌ 알 수 없는 에러 [${corpCode}]:`, error);
    }
    return [];
  }
}

/**
 * 모든 대상 기업에 대해 기업이벤트 공시를 검색하고 결과 반환
 */
export async function searchAllEventDisclosures(
  companies: TargetCompany[],
  startDate: string,
  endDate: string
): Promise<{ company: TargetCompany; disclosures: DartDisclosure[] }[]> {
  const results: { company: TargetCompany; disclosures: DartDisclosure[] }[] = [];

  for (const company of companies) {
    console.log(`🔍 공시 검색 중: ${company.name} (${company.corpCode})`);
    const disclosures = await searchEventDisclosures(company.corpCode, startDate, endDate);

    if (disclosures.length > 0) {
      console.log(`  ✅ ${disclosures.length}건 발견!`);
    }

    results.push({ company, disclosures });

    await sleep(API_DELAY_MS);
  }

  return results;
}


/**
 * 삼성생명의 타법인 출자현황을 DART API로 조회
 * 
 * 왜 사용? → 삼성생명이 10% 이상 지분을 보유한 상장기업 목록을 자동 갱신하기 위해
 * 사업보고서/분기보고서 기준이므로 분기에 1회 업데이트가 적절
 */
export async function getSamsungLifeInvestments(
  year: string,
  reportCode: string = '11011' // 기본값: 사업보고서
): Promise<DartInvestment[]> {
  try {
    const response = await axios.get<DartInvestmentResponse>(config.dart.investmentUrl, {
      params: {
        crtfc_key: config.dart.apiKey,
        corp_code: config.dart.samsungLifeCorpCode,
        bsns_year: year,
        reprt_code: reportCode,
      },
      timeout: 10000,
    });

    const data = response.data;

    if (data.status !== '000') {
      console.warn(`⚠️ 타법인 출자현황 조회 실패: ${data.message}`);
      return [];
    }

    return data.list || [];
  } catch (error) {
    console.error('❌ 타법인 출자현황 API 호출 실패:', error);
    return [];
  }
}

/**
 * DART 보고서의 열람 링크를 생성
 * 접수번호(rcept_no)로 보고서 뷰어 URL 생성
 */
export function getDartReportUrl(rceptNo: string): string {
  return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`;
}
