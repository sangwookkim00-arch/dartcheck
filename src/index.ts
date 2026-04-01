/**
 * DART 대주주 공시 모니터링 - 메인 실행 파일
 * 
 * 실행 흐름:
 * 1. 대상 기업 목록 로드 (data/target-companies.json)
 * 2. 전일자 날짜 계산 (한국 시간 기준)
 * 3. 각 기업별 DART 공시 검색 (D002 유형 + "주요주주특정증권" 키워드)
 * 4. 결과를 HTML 이메일로 발송
 * 
 * 실행: npm start
 */

import fs from 'fs';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { config } from './config.js';
import { searchAllDisclosures } from './dart-api.js';
import { sendReport } from './email.js';
import type { TargetCompany, MonitoringResult } from './types.js';

// dayjs에 timezone 플러그인 추가 (한국 시간 계산용)
dayjs.extend(utc);
dayjs.extend(timezone);

/**
 * 대상 기업 목록을 JSON 파일에서 로드
 */
function loadTargetCompanies(): TargetCompany[] {
  try {
    const raw = fs.readFileSync(config.paths.targetCompanies, 'utf-8');
    const companies: TargetCompany[] = JSON.parse(raw);
    console.log(`📋 모니터링 대상 기업 ${companies.length}곳 로드 완료`);
    return companies;
  } catch (error) {
    console.error('❌ 대상 기업 목록 로드 실패:', error);
    throw error;
  }
}

/**
 * 검색 대상 기간(한국 영업일 기준)을 계산
 * 
 * 왜 한국 시간 기준? → DART 공시는 한국 시간에 맞춰 등록됨
 * 월요일 실행 시: 금, 토, 일 (3일간) 공시 검색
 * 화~금 실행 시: 전일자 (1일간) 공시 검색
 */
function getCheckDateRange(): { startDate: string, endDate: string } {
  const now = dayjs().tz('Asia/Seoul');
  let startDate = now.subtract(1, 'day');
  let endDate = now.subtract(1, 'day');

  const dayOfWeek = now.day();
  if (dayOfWeek === 1) {
    // 오늘이 월요일(1)이면 → 금, 토, 일 (3일 전 ~ 1일 전) 검색
    startDate = now.subtract(3, 'day');
    endDate = now.subtract(1, 'day');
  } else if (dayOfWeek === 0) {
    // 오늘이 일요일(0)이면 → 목, 금, 토 (3일 전 ~ 1일 전) 검색 (수동 실행 대비)
    startDate = now.subtract(3, 'day');
    endDate = now.subtract(1, 'day');
  } else {
    // 화~토 실행 시 → 전일자 1일 검색
    startDate = now.subtract(1, 'day');
    endDate = now.subtract(1, 'day');
  }

  return {
    startDate: startDate.format('YYYYMMDD'),
    endDate: endDate.format('YYYYMMDD')
  };
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log('='.repeat(60));
  console.log('📊 DART 대주주 공시 모니터링 시작');
  console.log('='.repeat(60));
  console.log();

  // 1. 대상 기업 로드
  const companies = loadTargetCompanies();

  // 2. 검색 대상 날짜 계산
  // 환경변수 CHECK_DATE가 있으면 해당 날짜 사용 (테스트/수동 실행용)
  let startDate: string;
  let endDate: string;
  
  if (process.env.CHECK_DATE) {
    startDate = process.env.CHECK_DATE;
    endDate = process.env.CHECK_DATE;
  } else {
    const range = getCheckDateRange();
    startDate = range.startDate;
    endDate = range.endDate;
  }
  
  const formattedDate = startDate === endDate 
    ? `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)}`
    : `${startDate.slice(0, 4)}-${startDate.slice(4, 6)}-${startDate.slice(6, 8)} ~ ${endDate.slice(0, 4)}-${endDate.slice(4, 6)}-${endDate.slice(6, 8)}`;
    
  console.log(`📅 검색 기준일: ${formattedDate}`);
  console.log();

  // 3. 공시 검색
  console.log('🔍 DART 공시 검색 시작...');
  const results = await searchAllDisclosures(companies, startDate, endDate);
  console.log();

  // 결과 요약 출력
  const totalDisclosures = results.reduce((sum, r) => sum + r.disclosures.length, 0);
  const companiesWithDisclosures = results.filter(r => r.disclosures.length > 0);

  if (totalDisclosures > 0) {
    console.log(`📢 총 ${totalDisclosures}건의 공시 발견 (${companiesWithDisclosures.length}개 기업)`);
    for (const r of companiesWithDisclosures) {
      for (const d of r.disclosures) {
        console.log(`  - [${r.company.name}] ${d.report_nm} (${d.flr_nm})`);
      }
    }
  } else {
    console.log('✅ 전일자 대상 기업의 주요주주특정증권 관련 공시가 없습니다.');
  }
  console.log();

  // 4. MonitoringResult 타입으로 변환
  const monitoringResults: MonitoringResult[] = results.map(r => ({
    company: r.company,
    disclosures: r.disclosures,
  }));

  // 5. 이메일 발송
  console.log('📧 이메일 발송 중...');
  const emailResult = await sendReport(monitoringResults, formattedDate);

  if (emailResult.success) {
    console.log(`✅ ${emailResult.message}`);
  } else {
    console.error(`❌ ${emailResult.message}`);
    process.exit(1);
  }

  console.log();
  console.log('='.repeat(60));
  console.log('📊 모니터링 완료!');
  console.log('='.repeat(60));
}

// 실행
main().catch(error => {
  console.error('❌ 프로그램 실행 중 치명적 오류:', error);
  process.exit(1);
});
