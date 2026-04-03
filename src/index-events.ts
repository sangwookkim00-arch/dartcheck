/**
 * DART 기업이벤트 공시 모니터링 - 메인 실행 파일
 * 
 * 실행 흐름:
 * 1. 대상 기업 목록 로드 (data/target-companies-events.json)
 * 2. 전일자 날짜 계산 (한국 시간 기준)
 * 3. 각 기업별 DART 공시 검색 (특정 보고서 키워드 매칭)
 * 4. 결과를 HTML 이메일로 발송
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import { searchAllEventDisclosures } from './dart-api.js';
import { sendEventReport } from './email-events.js';
import type { TargetCompany, MonitoringResult } from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 수신자 목록
const RECEIVERS = [
  'sw8000.kim@samsung.com',
  'kimoon.song@samsung.com',
  'joohee.cha@samsung.com',
  'yunseo.heo@samsung.com'
];

dayjs.extend(utc);
dayjs.extend(timezone);

function loadTargetCompanies(): TargetCompany[] {
  const filePath = path.resolve(__dirname, '..', 'data', 'target-companies-events.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const companies: TargetCompany[] = JSON.parse(raw);
    console.log(`📋 모니터링 대상 기업 ${companies.length}곳 로드 완료`);
    return companies;
  } catch (error) {
    console.error('❌ 대상 기업 목록 로드 실패:', error);
    throw error;
  }
}

function getCheckDateRange(): { startDate: string, endDate: string } {
  const now = dayjs().tz('Asia/Seoul');
  let startDate = now.subtract(1, 'day');
  let endDate = now.subtract(1, 'day');

  const dayOfWeek = now.day();
  if (dayOfWeek === 1) { // 월요일: 금, 토, 일 (3일간)
    startDate = now.subtract(3, 'day');
    endDate = now.subtract(1, 'day');
  } else if (dayOfWeek === 0) { // 일요일: 목, 금, 토
    startDate = now.subtract(3, 'day');
    endDate = now.subtract(1, 'day');
  } else {
    startDate = now.subtract(1, 'day');
    endDate = now.subtract(1, 'day');
  }

  return {
    startDate: startDate.format('YYYYMMDD'),
    endDate: endDate.format('YYYYMMDD')
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('📊 DART 기업이벤트 공시 모니터링 시작');
  console.log('='.repeat(60));
  console.log();

  const companies = loadTargetCompanies();

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

  console.log('🔍 DART 공시 검색 시작...');
  const results = await searchAllEventDisclosures(companies, startDate, endDate);
  console.log();

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
    console.log('✅ 전일자 대상 기업의 기업이벤트 공시가 없습니다.');
  }
  console.log();

  const monitoringResults: MonitoringResult[] = results.map(r => ({
    company: r.company,
    disclosures: r.disclosures,
  }));

  console.log('📧 이메일 발송 중...');
  const emailResult = await sendEventReport(monitoringResults, formattedDate, RECEIVERS);

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

main().catch(error => {
  console.error('❌ 프로그램 실행 중 치명적 오류:', error);
  process.exit(1);
});
